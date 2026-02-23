import { BaseEnforcementLayer } from '../base-layer';
import { ActionContext, EnforcementState, ViolationCategory, ViolationSeverity } from '../../core/models';
import { EnforcementEvents } from '../../core/event-bus';
import { PredictiveRiskEngine } from './predictive-risk-engine';

export class PreExecutionLayer extends BaseEnforcementLayer {
    private riskEngine: PredictiveRiskEngine;

    constructor() {
        super();
        this.riskEngine = new PredictiveRiskEngine();
    }

    getName(): string {
        return 'PreExecutionValidation';
    }

    async process(context: ActionContext): Promise<ActionContext> {
        this.eventBus.emit(EnforcementEvents.PRE_EXECUTION_STARTED, context);

        console.log(`[${this.getName()}] Validating intent: ${context.intent}`);

        // 1. Predictive Risk Analysis
        const riskProfile = await this.riskEngine.evaluate(context);
        context.riskProfile = riskProfile;
        context.predictedBehaviorVector = this.riskEngine.predictBehaviorVector(context);

        if (riskProfile.recommendation === 'BLOCK') {
            const violation = {
                id: `v-risk-${Date.now()}`,
                timestamp: new Date(),
                category: ViolationCategory.IMPACT,
                severity: ViolationSeverity.CRITICAL,
                description: `Action blocked by Predictive Risk Engine. Overall Risk: ${riskProfile.overallRiskScore.toFixed(2)}. ${riskProfile.realWorldConsequences.join(' ')}`,
                sourceLayer: this.getName(),
                metadata: { riskProfile }
            };

            context.violations.push(violation);
            context.status = EnforcementState.PRE_EXECUTION_FAILED;
            this.eventBus.emitViolation(context.actionId, violation);
            return context;
        }

        if (riskProfile.recommendation === 'HOLD') {
            const violation = {
                id: `v-warn-${Date.now()}`,
                timestamp: new Date(),
                category: ViolationCategory.IMPACT,
                severity: ViolationSeverity.HIGH,
                description: `Heuristic warning: Elevated risk detected (${riskProfile.overallRiskScore.toFixed(2)}). Manual review suggested.`,
                sourceLayer: this.getName(),
                metadata: { riskProfile }
            };
            context.violations.push(violation);
            // We don't necessarily fail here, but we could if that's the policy.
            // For now, let's proceed but with violations recorded.
        }

        // 2. Baseline validation logic
        if (context.params.unauthorized) {
            const violation = {
                id: `v-pre-${Date.now()}`,
                timestamp: new Date(),
                category: ViolationCategory.PERMISSION,
                severity: ViolationSeverity.HIGH,
                description: 'Unauthorized parameter detected in pre-execution.',
                sourceLayer: this.getName(),
                metadata: { param: 'unauthorized' }
            };

            context.violations.push(violation);
            context.status = EnforcementState.PRE_EXECUTION_FAILED;
            this.eventBus.emitViolation(context.actionId, violation);
        } else {
            context.status = EnforcementState.PRE_EXECUTION_PASSED;
        }

        this.eventBus.emit(EnforcementEvents.PRE_EXECUTION_COMPLETED, context);
        return context;
    }
}
