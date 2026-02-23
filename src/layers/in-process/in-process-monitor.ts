import {
    ActionContext,
    ExecutionStep,
    InProcessMonitorPolicy,
    Violation,
    ViolationCategory,
    ViolationSeverity,
    EnforcementState
} from '../../core/models';
import { EnforcementEventBus, EnforcementEvents } from '../../core/event-bus';
import { AnomalyDetectionEngine } from './anomaly-detection-engine';

export class InProcessMonitor {
    private context: ActionContext;
    private policy: InProcessMonitorPolicy;
    private eventBus: EnforcementEventBus;
    private cumulativeSensitiveReads: number = 0;
    private anomalyEngine: AnomalyDetectionEngine;

    constructor(context: ActionContext, policy: InProcessMonitorPolicy) {
        this.context = context;
        this.policy = policy;
        this.eventBus = EnforcementEventBus.getInstance();
        this.anomalyEngine = new AnomalyDetectionEngine(context.params['anomalyThresholds'], context.params['anomalySlowDelayMs']);

        // Initialize cumulative reads from existing trace if any
        if (this.context.executionTrace) {
            this.context.executionTrace.forEach(step => {
                step.dataAccess?.forEach(event => {
                    if (event.sensitivity === 'high' || event.sensitivity === 'medium') {
                        this.cumulativeSensitiveReads += (event.recordCount || 0);
                    }
                });
            });
        } else {
            this.context.executionTrace = [];
        }
    }

    public async recordStep(step: ExecutionStep): Promise<Violation[]> {
        const violations: Violation[] = [];

        step.timestamp = step.timestamp || new Date();
        this.context.executionTrace!.push(step);

        // 1. Track deviation from declared intent
        if (step.observedIntent && !this.isIntentAligned(step.observedIntent, this.context.intent)) {
            violations.push(this.createViolation(
                ViolationCategory.ANOMALY,
                ViolationSeverity.MEDIUM,
                `Intent deviation detected: Observed "${step.observedIntent}" while declared intent was "${this.context.intent}"`,
                { observedIntent: step.observedIntent, declaredIntent: this.context.intent }
            ));
        }

        // 2. Authority scope drift
        if (step.authorityScopeUsed) {
            const unauthorizedScopes = step.authorityScopeUsed.filter(
                scope => !this.policy.declaredAuthorityScope.includes(scope)
            );
            if (unauthorizedScopes.length > 0) {
                violations.push(this.createViolation(
                    ViolationCategory.SCOPE,
                    ViolationSeverity.HIGH,
                    `Authority scope drift: Agent used unauthorized scopes: ${unauthorizedScopes.join(', ')}`,
                    { unauthorizedScopes }
                ));
            }
        }

        // 3. Unexpected API calls
        if (step.apiCalls) {
            const unexpectedApis = step.apiCalls.filter(
                api => !this.policy.allowedApis.includes(api)
            );
            if (unexpectedApis.length > 0) {
                violations.push(this.createViolation(
                    ViolationCategory.PERMISSION,
                    ViolationSeverity.HIGH,
                    `Unexpected API calls: Agent called unauthorized APIs: ${unexpectedApis.join(', ')}`,
                    { unexpectedApis }
                ));
            }
        }

        // 4. Anomalous data access patterns
        if (step.dataAccess) {
            for (const access of step.dataAccess) {
                if (access.recordCount && access.recordCount > this.policy.maxRecordsPerStep) {
                    violations.push(this.createViolation(
                        ViolationCategory.ANOMALY,
                        ViolationSeverity.MEDIUM,
                        `Anomalous data access: Step exceeded maximum records per step (${access.recordCount} > ${this.policy.maxRecordsPerStep})`,
                        { resource: access.resource, recordCount: access.recordCount }
                    ));
                }

                if (access.sensitivity === 'high' || access.sensitivity === 'medium') {
                    this.cumulativeSensitiveReads += (access.recordCount || 0);
                }
            }

            if (this.cumulativeSensitiveReads > this.policy.maxCumulativeSensitiveReads) {
                violations.push(this.createViolation(
                    ViolationCategory.ANOMALY,
                    ViolationSeverity.HIGH,
                    `Anomalous data access: Cumulative sensitive reads exceeded threshold (${this.cumulativeSensitiveReads} > ${this.policy.maxCumulativeSensitiveReads})`,
                    { cumulativeSensitiveReads: this.cumulativeSensitiveReads }
                ));
            }
        }

        // 5. Cooperative instability signals
        if (step.cooperativeSignals) {
            for (const signal of step.cooperativeSignals) {
                if (signal.stabilityScore < this.policy.minCooperativeStability) {
                    violations.push(this.createViolation(
                        ViolationCategory.IMPACT,
                        ViolationSeverity.MEDIUM,
                        `Cooperative instability: Stability score for partner ${signal.partnerId} is too low (${signal.stabilityScore} < ${this.policy.minCooperativeStability})`,
                        { partnerId: signal.partnerId, stabilityScore: signal.stabilityScore }
                    ));
                }
                if (signal.conflictScore && signal.conflictScore > this.policy.maxCooperativeConflict) {
                    violations.push(this.createViolation(
                        ViolationCategory.IMPACT,
                        ViolationSeverity.HIGH,
                        `Cooperative instability: Conflict score for partner ${signal.partnerId} is too high (${signal.conflictScore} > ${this.policy.maxCooperativeConflict})`,
                        { partnerId: signal.partnerId, conflictScore: signal.conflictScore }
                    ));
                }
            }
        }

        // 6. Deviation from pre-execution predicted behavior vector
        const anomalyDecision = this.anomalyEngine.evaluate(this.context, step, this.policy);
        const deviationMetadata = {
            deviationScore: anomalyDecision.deviationScore,
            threshold: anomalyDecision.threshold,
            action: anomalyDecision.action,
            predictedVector: anomalyDecision.predicted,
            liveVector: anomalyDecision.live,
            stepId: step.stepId
        };

        if (anomalyDecision.action === 'WARN') {
            violations.push(this.createViolation(
                ViolationCategory.ANOMALY,
                ViolationSeverity.MEDIUM,
                `Anomaly warning: behavior deviation score ${anomalyDecision.deviationScore.toFixed(2)} exceeded warning threshold ${anomalyDecision.threshold?.toFixed(2)}.`,
                deviationMetadata
            ));
        }

        if (anomalyDecision.action === 'SLOW') {
            violations.push(this.createViolation(
                ViolationCategory.ANOMALY,
                ViolationSeverity.MEDIUM,
                `Execution throttled: deviation score ${anomalyDecision.deviationScore.toFixed(2)} exceeded slow threshold ${anomalyDecision.threshold?.toFixed(2)}.`,
                deviationMetadata
            ));
            await this.anomalyEngine.enforceDelayIfNeeded('SLOW');
        }

        if (anomalyDecision.action === 'REQUIRE_APPROVAL') {
            const approved = this.isStepAnomalyApproved(step.stepId);
            if (!approved) {
                violations.push(this.createViolation(
                    ViolationCategory.ANOMALY,
                    ViolationSeverity.HIGH,
                    `Manual approval required: deviation score ${anomalyDecision.deviationScore.toFixed(2)} exceeded approval threshold ${anomalyDecision.threshold?.toFixed(2)}.`,
                    deviationMetadata
                ));
                this.context.status = EnforcementState.SUSPENDED;
            }
        }

        if (anomalyDecision.action === 'HALT') {
            violations.push(this.createViolation(
                ViolationCategory.ANOMALY,
                ViolationSeverity.CRITICAL,
                `Execution halted: deviation score ${anomalyDecision.deviationScore.toFixed(2)} exceeded halt threshold ${anomalyDecision.threshold?.toFixed(2)}.`,
                deviationMetadata
            ));
            this.context.status = EnforcementState.SUSPENDED;
        }

        // Record violations in context and emit events
        if (violations.length > 0) {
            this.context.violations.push(...violations);
            violations.forEach(v => this.eventBus.emitViolation(this.context.actionId, v));

            // Check for critical violations to suspend execution
            if (violations.some(v => v.severity === ViolationSeverity.CRITICAL || v.severity === ViolationSeverity.HIGH)) {
                this.context.status = EnforcementState.SUSPENDED;
            }
        }

        this.eventBus.emitStateChange(this.context);
        return violations;
    }

    private isIntentAligned(observed: string, declared: string): boolean {
        // Simple semantic similarity proxy or keyword matching
        // In a real system, this would use an LLM-based evaluator
        const observedLower = observed.toLowerCase();
        const declaredLower = declared.toLowerCase();

        const declaredKeywords = declaredLower.split(' ').filter(word => word.length > 3);
        const matchCount = declaredKeywords.filter(word => observedLower.includes(word)).length;

        return matchCount > 0 || observedLower.includes(declaredLower) || declaredLower.includes(observedLower);
    }

    private createViolation(
        category: ViolationCategory,
        severity: ViolationSeverity,
        description: string,
        metadata: any
    ): Violation {
        return {
            id: `v-inproc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date(),
            category,
            severity,
            description,
            sourceLayer: 'InProcessMonitor',
            metadata
        };
    }

    public getContext(): ActionContext {
        return this.context;
    }

    private isStepAnomalyApproved(stepId: string): boolean {
        if (this.context.anomalyApprovalGranted === true) {
            return true;
        }

        const approvedSteps = this.context.params['anomalyApprovedSteps'];
        if (approvedSteps === '*') {
            return true;
        }

        return Array.isArray(approvedSteps) && approvedSteps.includes(stepId);
    }
}
