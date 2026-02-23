import {
    ActionContext,
    AnomalyMitigationAction,
    AnomalyToleranceThresholds,
    BehaviorVector,
    ExecutionStep,
    InProcessMonitorPolicy
} from '../../core/models';

export interface AnomalyDetectionDecision {
    deviationScore: number;
    action: AnomalyMitigationAction;
    predicted: BehaviorVector;
    live: BehaviorVector;
    threshold: number | null;
}

export class AnomalyDetectionEngine {
    private readonly thresholds: AnomalyToleranceThresholds;
    private readonly actionDelayMs: number;

    constructor(thresholds?: Partial<AnomalyToleranceThresholds>, actionDelayMs: number = 250) {
        this.thresholds = {
            warn: thresholds?.warn ?? 0.25,
            slow: thresholds?.slow ?? 0.4,
            requireApproval: thresholds?.requireApproval ?? 0.6,
            halt: thresholds?.halt ?? 0.8
        };
        this.actionDelayMs = actionDelayMs;
    }

    public async enforceDelayIfNeeded(action: AnomalyMitigationAction): Promise<void> {
        if (action !== 'SLOW') {
            return;
        }

        await new Promise(resolve => setTimeout(resolve, this.actionDelayMs));
    }

    public evaluate(
        context: ActionContext,
        step: ExecutionStep,
        policy: InProcessMonitorPolicy
    ): AnomalyDetectionDecision {
        const predicted = context.predictedBehaviorVector || this.defaultPredictedVector();
        const live = this.deriveLiveBehaviorVector(context, step, policy);
        const deviationScore = this.computeDeviationScore(predicted, live);
        const { action, threshold } = this.resolveAction(deviationScore);

        return {
            deviationScore,
            action,
            predicted,
            live,
            threshold
        };
    }

    private resolveAction(score: number): { action: AnomalyMitigationAction, threshold: number | null } {
        if (score >= this.thresholds.halt) {
            return { action: 'HALT', threshold: this.thresholds.halt };
        }
        if (score >= this.thresholds.requireApproval) {
            return { action: 'REQUIRE_APPROVAL', threshold: this.thresholds.requireApproval };
        }
        if (score >= this.thresholds.slow) {
            return { action: 'SLOW', threshold: this.thresholds.slow };
        }
        if (score >= this.thresholds.warn) {
            return { action: 'WARN', threshold: this.thresholds.warn };
        }
        return { action: 'NONE', threshold: null };
    }

    private computeDeviationScore(predicted: BehaviorVector, live: BehaviorVector): number {
        const deltas = [
            Math.abs(predicted.intentDeviationRisk - live.intentDeviationRisk),
            Math.abs(predicted.scopeDriftRisk - live.scopeDriftRisk),
            Math.abs(predicted.apiNoveltyRisk - live.apiNoveltyRisk),
            Math.abs(predicted.sensitiveDataExposureRisk - live.sensitiveDataExposureRisk),
            Math.abs(predicted.cooperativeInstabilityRisk - live.cooperativeInstabilityRisk),
            Math.abs(predicted.dataVolumeRisk - live.dataVolumeRisk)
        ];

        const meanDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
        return Math.max(0, Math.min(1, meanDelta));
    }

    private deriveLiveBehaviorVector(
        context: ActionContext,
        step: ExecutionStep,
        policy: InProcessMonitorPolicy
    ): BehaviorVector {
        const normalize = (value: number) => Math.max(0, Math.min(1, value));
        const highImpactIntentWords = ['delete', 'drop', 'exfiltrate', 'disable', 'override', 'shutdown'];
        const observedIntent = (step.observedIntent || '').toLowerCase();
        const declaredIntent = context.intent.toLowerCase();

        const intentDeviationRisk =
            !observedIntent
                ? 0
                : this.intentSimilarity(observedIntent, declaredIntent) >= 0.25
                    ? 0
                    : highImpactIntentWords.some(word => observedIntent.includes(word)) ? 1 : 0.65;

        const usedScopes = step.authorityScopeUsed || [];
        const unauthorizedScopes = usedScopes.filter(scope => !policy.declaredAuthorityScope.includes(scope));
        const scopeDriftRisk = usedScopes.length === 0 ? 0 : normalize(unauthorizedScopes.length / usedScopes.length);

        const usedApis = step.apiCalls || [];
        const unexpectedApis = usedApis.filter(api => !policy.allowedApis.includes(api));
        const apiNoveltyRisk = usedApis.length === 0 ? 0 : normalize(unexpectedApis.length / usedApis.length);

        const stepReads = (step.dataAccess || [])
            .filter(access => access.operation === 'read')
            .reduce((sum, access) => sum + (access.recordCount || 0), 0);
        const stepSensitiveReads = (step.dataAccess || [])
            .filter(access => access.operation === 'read' && (access.sensitivity === 'medium' || access.sensitivity === 'high'))
            .reduce((sum, access) => sum + (access.recordCount || 0), 0);

        const sensitiveDataExposureRisk = stepReads === 0 ? 0 : normalize(stepSensitiveReads / stepReads);
        const dataVolumeRisk = normalize(stepReads / Math.max(1, policy.maxRecordsPerStep));

        let cooperativeInstabilityRisk = 0;
        if (step.cooperativeSignals && step.cooperativeSignals.length > 0) {
            const instabilityValues = step.cooperativeSignals.map(signal => {
                const stabilityDeficit = signal.stabilityScore < policy.minCooperativeStability
                    ? (policy.minCooperativeStability - signal.stabilityScore)
                    : 0;
                const conflictExcess = signal.conflictScore && signal.conflictScore > policy.maxCooperativeConflict
                    ? (signal.conflictScore - policy.maxCooperativeConflict)
                    : 0;
                return normalize(stabilityDeficit + conflictExcess);
            });

            cooperativeInstabilityRisk = normalize(
                instabilityValues.reduce((sum, value) => sum + value, 0) / instabilityValues.length
            );
        }

        return {
            intentDeviationRisk: normalize(intentDeviationRisk),
            scopeDriftRisk,
            apiNoveltyRisk,
            sensitiveDataExposureRisk,
            cooperativeInstabilityRisk,
            dataVolumeRisk
        };
    }

    private intentSimilarity(observed: string, declared: string): number {
        const observedTokens = new Set(observed.split(/\s+/).filter(token => token.length > 3));
        const declaredTokens = new Set(declared.split(/\s+/).filter(token => token.length > 3));

        if (observedTokens.size === 0 || declaredTokens.size === 0) {
            return 0;
        }

        let overlap = 0;
        observedTokens.forEach(token => {
            if (declaredTokens.has(token)) {
                overlap += 1;
            }
        });

        return overlap / declaredTokens.size;
    }

    private defaultPredictedVector(): BehaviorVector {
        return {
            intentDeviationRisk: 0.15,
            scopeDriftRisk: 0.15,
            apiNoveltyRisk: 0.15,
            sensitiveDataExposureRisk: 0.2,
            cooperativeInstabilityRisk: 0.15,
            dataVolumeRisk: 0.25
        };
    }
}
