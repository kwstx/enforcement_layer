import { BaseEnforcementLayer } from '../base-layer';
import { ActionContext, EnforcementState, ViolationCategory, ViolationSeverity, InProcessMonitorPolicy } from '../../core/models';
import { EnforcementEvents } from '../../core/event-bus';
import { InProcessMonitor } from './in-process-monitor';

export class InProcessLayer extends BaseEnforcementLayer {
    getName(): string {
        return 'InProcessMonitoring';
    }

    private getDefaultPolicy(): InProcessMonitorPolicy {
        return {
            declaredAuthorityScope: ['read:public', 'read:user_profile', 'write:internal_logs'],
            allowedApis: ['google.auth.v1', 'internal.storage.v1', 'openai.api.v1'],
            maxRecordsPerStep: 50,
            maxCumulativeSensitiveReads: 200,
            minCooperativeStability: 0.7,
            maxCooperativeConflict: 0.3
        };
    }

    async process(context: ActionContext): Promise<ActionContext> {
        if (context.status !== EnforcementState.PRE_EXECUTION_PASSED) {
            return context;
        }

        context.status = EnforcementState.EXECUTING;
        this.eventBus.emit(EnforcementEvents.ACTION_EXECUTING, context);

        console.log(`[${this.getName()}] Monitoring action: ${context.actionId}`);

        const policy = (context.params['inProcessPolicy'] as InProcessMonitorPolicy) || this.getDefaultPolicy();
        const monitor = new InProcessMonitor(context, policy);

        // Simulate multi-step execution if steps are provided in params for demo purposes
        const simulatedSteps = context.params['simulatedSteps'];
        if (simulatedSteps && Array.isArray(simulatedSteps)) {
            for (const step of simulatedSteps) {
                console.log(`[${this.getName()}] Recording step: ${step.stepId}`);
                await monitor.recordStep(step);

                if ((monitor.getContext().status as EnforcementState) === EnforcementState.SUSPENDED) {
                    console.warn(`[${this.getName()}] Execution SUSPENDED due to violations at step: ${step.stepId}`);
                    break;
                }
            }
        }

        // Basic check for existing params if no steps provided
        const resourceUsage = context.params['resourceUsage'];
        if (typeof resourceUsage === 'number' && resourceUsage > 100) {
            const violation = {
                id: `v-proc-${Date.now()}`,
                timestamp: new Date(),
                category: ViolationCategory.IMPACT,
                severity: ViolationSeverity.MEDIUM,
                description: 'Excessive resource usage detected during execution.',
                sourceLayer: this.getName(),
                metadata: { resourceUsage }
            };

            context.violations.push(violation);
            this.eventBus.emitViolation(context.actionId, violation);
        }

        return context;
    }
}
