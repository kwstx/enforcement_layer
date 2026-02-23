import { ActionContext, RiskProfile, SynergyShift, PropagationEffect, PolicyForecast, BehaviorVector } from '../../core/models';

export class PredictiveRiskEngine {
    /**
     * Evaluates potential real-world consequences using projected synergy shifts, 
     * trust-weighted propagation effects, and policy impact forecasts.
     */
    public async evaluate(context: ActionContext): Promise<RiskProfile> {
        console.log(`[PredictiveRiskEngine] Evaluating risk for action: ${context.intent}`);

        const synergyShifts = this.projectSynergyShifts(context);
        const propagationEffects = this.calculatePropagationEffects(context);
        const policyForecasts = this.forecastPolicyImpact(context);

        const realWorldConsequences = this.summarizeConsequences(synergyShifts, propagationEffects, policyForecasts);

        const overallRiskScore = this.calculateOverallRisk(synergyShifts, propagationEffects, policyForecasts);

        let recommendation: 'PROCEED' | 'HOLD' | 'BLOCK' = 'PROCEED';
        if (overallRiskScore > 0.8) recommendation = 'BLOCK';
        else if (overallRiskScore > 0.4) recommendation = 'HOLD';

        return {
            overallRiskScore,
            synergyShifts,
            propagationEffects,
            policyForecasts,
            realWorldConsequences,
            recommendation
        };
    }

    public predictBehaviorVector(context: ActionContext): BehaviorVector {
        const intentLower = context.intent.toLowerCase();
        const includesHighImpactVerb = ['delete', 'remove', 'reset', 'shutdown'].some(v => intentLower.includes(v));
        const trustedAgent = context.agentId.startsWith('trusted-');

        const clamp = (value: number) => Math.max(0, Math.min(1, value));

        return {
            intentDeviationRisk: includesHighImpactVerb ? 0.35 : 0.12,
            scopeDriftRisk: trustedAgent ? 0.1 : 0.25,
            apiNoveltyRisk: context.params.networkAccess ? 0.45 : 0.15,
            sensitiveDataExposureRisk: context.params.privacySensitive ? 0.6 : 0.2,
            cooperativeInstabilityRisk: context.params.networkAccess ? 0.35 : 0.15,
            dataVolumeRisk: clamp(context.params.scaling ? 0.55 : 0.25)
        };
    }

    private projectSynergyShifts(context: ActionContext): SynergyShift[] {
        // Simulated logic: actions with 'delete' or 'reset' might negatively impact synergy
        const shifts: SynergyShift[] = [];

        if (context.intent.toLowerCase().includes('delete') || context.intent.toLowerCase().includes('remove')) {
            shifts.push({
                component: 'DataIntegrityModule',
                previousSynergy: 0.9,
                projectedSynergy: 0.6,
                delta: -0.3,
                reason: 'Removal of data nodes reduces structural synergy.'
            });
        }

        if (context.params.scaling) {
            shifts.push({
                component: 'ResourceAllocator',
                previousSynergy: 0.8,
                projectedSynergy: 0.95,
                delta: 0.15,
                reason: 'Dynamic scaling improves operational synergy.'
            });
        }

        return shifts;
    }

    private calculatePropagationEffects(context: ActionContext): PropagationEffect[] {
        const effects: PropagationEffect[] = [];

        // Trust-weighted propagation: actions from untrusted agents spread more risk
        const baseTrustWeight = context.agentId.startsWith('trusted-') ? 0.2 : 0.8;

        if (context.params.networkAccess) {
            effects.push({
                targetSystem: 'ExternalAPI-Gateways',
                probability: 0.65,
                impactMagnitude: 0.7,
                trustWeight: baseTrustWeight,
                description: 'Potential cascade into external dependencies via network bridge.'
            });
        }

        return effects;
    }

    private forecastPolicyImpact(context: ActionContext): PolicyForecast[] {
        const forecasts: PolicyForecast[] = [];

        // Policy impact forecasts
        if (context.params.privacySensitive) {
            forecasts.push({
                policyId: 'GDPR-Compliance-Rule-7',
                complianceDelta: -0.2,
                forecastedOutcome: 'Increased audit risk due to sensitive data handling.'
            });
        } else {
            forecasts.push({
                policyId: 'Global-Safety-Guardrails',
                complianceDelta: 0.05,
                forecastedOutcome: 'Minimal impact on safety standards.'
            });
        }

        return forecasts;
    }

    private calculateOverallRisk(
        synergy: SynergyShift[],
        propagation: PropagationEffect[],
        policy: PolicyForecast[]
    ): number {
        let score = 0.1; // Base risk

        // Negative synergy shifts increase risk
        synergy.forEach(s => {
            if (s.delta < 0) score += Math.abs(s.delta) * 0.5;
        });

        // Propagation effects contribute based on probability, magnitude, and trust
        propagation.forEach(p => {
            score += (p.probability * p.impactMagnitude * p.trustWeight);
        });

        // Negative policy compliance deltas increase risk
        policy.forEach(pf => {
            if (pf.complianceDelta < 0) score += Math.abs(pf.complianceDelta);
        });

        return Math.min(1.0, score);
    }

    private summarizeConsequences(
        synergy: SynergyShift[],
        propagation: PropagationEffect[],
        policy: PolicyForecast[]
    ): string[] {
        const consequences: string[] = [];

        // Analyze Synergy Shifts
        const majorDegradation = synergy.find(s => s.delta <= -0.25);
        if (majorDegradation) {
            consequences.push(`Operational Risk: ${majorDegradation.reason} Potential for cascading modular instability within ${majorDegradation.component}.`);
        }

        const improvement = synergy.find(s => s.delta > 0.1);
        if (improvement) {
            consequences.push(`Efficiency Gain: ${improvement.reason}`);
        }

        // Analyze Propagation Effects
        const highProbEffect = propagation.find(p => p.probability > 0.5);
        if (highProbEffect) {
            consequences.push(`Propagation Risk: High likelihood (${(highProbEffect.probability * 100).toFixed(0)}%) of secondary impact on ${highProbEffect.targetSystem}. ${highProbEffect.description}`);
        }

        // Analyze Policy Forecasts
        const policyViolation = policy.find(pf => pf.complianceDelta < 0);
        if (policyViolation) {
            consequences.push(`Compliance Risk: Negative forecast for ${policyViolation.policyId.replace(/-/g, ' ')}. Outcome: ${policyViolation.forecastedOutcome}`);
        }

        if (consequences.length === 0) {
            consequences.push('System state remains within nominal stability parameters.');
        }

        return consequences;
    }
}
