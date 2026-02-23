import { ActionContext, Intervention, InterventionType, Violation, ViolationSeverity, EnforcementState } from '../../core/models';
import { BaseEnforcementLayer } from '../base-layer';

export class AdaptiveInterventionLayer extends BaseEnforcementLayer {

    getName(): string {
        return 'Adaptive Intervention Layer';
    }

    async process(context: ActionContext): Promise<ActionContext> {
        if (!context.violations || context.violations.length === 0) {
            return context;
        }

        console.log(`[${this.getName()}] Analyzing ${context.violations.length} violations for action ${context.actionId}`);

        for (const violation of context.violations) {
            // Check if an intervention for this violation already exists
            const existingIntervention = context.interventions.find(i => i.metadata.violationId === violation.id);
            if (!existingIntervention) {
                const intervention = this.determineIntervention(violation);
                context.interventions.push(intervention);

                console.log(`[${this.getName()}] Triggered ${intervention.type} due to ${violation.severity} severity violation: ${violation.description}`);

                // Apply side effects based on intervention type
                this.applyInterventionEffects(context, intervention);
            }
        }

        return context;
    }

    private determineIntervention(violation: Violation): Intervention {
        let type: InterventionType;
        let description: string;

        switch (violation.severity) {
            case ViolationSeverity.LOW:
                type = InterventionType.REQUIRE_VERIFICATION;
                description = 'Additional logging and verification of subsequent steps required.';
                break;
            case ViolationSeverity.MEDIUM:
                type = InterventionType.NARROW_SCOPE;
                description = 'Restricting authority scope to immediate requirements only.';
                break;
            case ViolationSeverity.HIGH:
                type = InterventionType.ESCALATE_TO_HUMAN;
                description = 'Manual approval required for further execution.';
                break;
            case ViolationSeverity.CRITICAL:
            default:
                type = InterventionType.SUSPEND_EXECUTION;
                description = 'Immediate suspension of execution pending forensic audit.';
                break;
        }

        return {
            id: `int-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            type,
            description,
            reason: violation.description,
            severity: violation.severity,
            applied: true,
            metadata: {
                violationId: violation.id,
                triggeredBy: violation.sourceLayer
            }
        };
    }

    private applyInterventionEffects(context: ActionContext, intervention: Intervention) {
        if (!context.metadata) {
            context.metadata = {};
        }

        switch (intervention.type) {
            case InterventionType.SUSPEND_EXECUTION:
            case InterventionType.TERMINATE_SESSION:
                context.status = EnforcementState.SUSPENDED;
                break;
            case InterventionType.ESCALATE_TO_HUMAN:
                context.anomalyApprovalGranted = false;
                break;
            case InterventionType.NARROW_SCOPE:
                // Logic to actually restrict context.params or metadata could go here
                if (context.params && context.params.scope) {
                    context.params.originalScope = context.params.scope;
                    context.params.scope = 'restricted-minimal';
                }
                break;
            case InterventionType.REDUCE_PERMISSIONS:
                context.metadata.restrictedPermissions = true;
                break;
        }
    }
}
