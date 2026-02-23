import {
    ActionContext,
    EnforcementState,
    RemediationReport,
    RollbackTransaction,
    RollbackTransactionStatus,
    Stakeholder,
    StakeholderNotification,
    SystemChangeRecord,
    TrustRecalibration,
    ViolationSeverity
} from '../../core/models';

export class RemediationEngine {
    public async remediate(context: ActionContext): Promise<ActionContext> {
        const confirmedViolations = this.getConfirmedViolations(context);
        if (confirmedViolations.length === 0) {
            return context;
        }

        const unauthorizedChanges = this.collectUnauthorizedChanges(context);
        const rollbackTransactions = this.buildRollbackTransactions(context, unauthorizedChanges);
        this.executeRollbacks(rollbackTransactions, unauthorizedChanges);

        const notifications = this.notifyStakeholders(context, confirmedViolations.length, rollbackTransactions);
        const trustRecalibration = this.recalibrateTrust(context, confirmedViolations.map(v => v.severity));

        const report: RemediationReport = {
            actionId: context.actionId,
            generatedAt: new Date(),
            confirmedViolationIds: confirmedViolations.map(v => v.id),
            rollbackTransactions,
            notifications,
            trustRecalibration,
            safeRollback: rollbackTransactions.every(
                tx => tx.status === 'APPLIED' || tx.status === 'SKIPPED'
            )
        };

        context.remediationReport = report;
        context.status = EnforcementState.REMEDIATED;
        return context;
    }

    private getConfirmedViolations(context: ActionContext) {
        if (context.status === EnforcementState.AUDIT_FAILED) {
            return context.violations;
        }

        return context.violations.filter(v => v.severity === ViolationSeverity.HIGH || v.severity === ViolationSeverity.CRITICAL);
    }

    private collectUnauthorizedChanges(context: ActionContext): SystemChangeRecord[] {
        const changes = context.systemChanges || [];
        const unauthorizedExplicit = changes.filter(change => change.unauthorized === true);

        if (unauthorizedExplicit.length > 0) {
            return unauthorizedExplicit;
        }

        const violationChangeIds = new Set<string>();
        context.violations.forEach(violation => {
            const changeId = violation.metadata?.changeId;
            if (typeof changeId === 'string') {
                violationChangeIds.add(changeId);
            }
        });

        return changes.filter(change => violationChangeIds.has(change.changeId));
    }

    private buildRollbackTransactions(
        context: ActionContext,
        unauthorizedChanges: SystemChangeRecord[]
    ): RollbackTransaction[] {
        return unauthorizedChanges.map(change => ({
            transactionId: `rbx-${context.actionId}-${change.changeId}`,
            actionId: context.actionId,
            changeId: change.changeId,
            target: change.target,
            rollbackAction: this.describeRollbackAction(change),
            status: 'PENDING',
            startedAt: new Date(),
            trace: [{
                timestamp: new Date(),
                actor: 'RemediationEngine',
                status: 'PENDING',
                detail: 'Rollback transaction initialized.'
            }]
        }));
    }

    private executeRollbacks(
        transactions: RollbackTransaction[],
        unauthorizedChanges: SystemChangeRecord[]
    ) {
        const byChangeId = new Map<string, SystemChangeRecord>();
        unauthorizedChanges.forEach(change => byChangeId.set(change.changeId, change));

        transactions.forEach(tx => {
            const change = byChangeId.get(tx.changeId);
            if (!change) {
                this.appendTrace(tx, 'FAILED', 'Underlying change record not found.');
                tx.status = 'FAILED';
                tx.completedAt = new Date();
                return;
            }

            if (!change.reversible) {
                this.appendTrace(tx, 'SKIPPED', 'Change marked as non-reversible, rollback skipped.');
                tx.status = 'SKIPPED';
                tx.completedAt = new Date();
                return;
            }

            this.appendTrace(tx, 'PENDING', `Applying rollback for ${change.type} on ${change.target}.`);
            this.appendTrace(tx, 'APPLIED', 'Rollback applied successfully.');
            tx.status = 'APPLIED';
            tx.completedAt = new Date();
        });
    }

    private notifyStakeholders(
        context: ActionContext,
        violationCount: number,
        transactions: RollbackTransaction[]
    ): StakeholderNotification[] {
        const recipients = this.resolveStakeholders(context);
        const failedRollbacks = transactions.filter(tx => tx.status === 'FAILED').length;
        const createdAt = new Date();

        return recipients.map((stakeholder, index) => ({
            notificationId: `notify-${context.actionId}-${index + 1}`,
            stakeholderId: stakeholder.id,
            channel: this.resolveNotificationChannel(stakeholder.contact),
            timestamp: createdAt,
            message: `Action ${context.actionId} confirmed ${violationCount} violation(s). Rollback transactions: ${transactions.length}, failures: ${failedRollbacks}.`,
            acknowledged: false
        }));
    }

    private recalibrateTrust(context: ActionContext, severities: ViolationSeverity[]): TrustRecalibration {
        const previousCoefficient = context.trustCoefficient ?? 1.0;
        const penalty = severities.reduce((score, severity) => score + this.severityPenalty(severity), 0);
        const boundedPenalty = Math.min(penalty, 0.9);
        const updatedCoefficient = this.clamp(previousCoefficient - boundedPenalty, 0, 1);

        context.trustCoefficient = updatedCoefficient;

        return {
            previousCoefficient,
            updatedCoefficient,
            delta: updatedCoefficient - previousCoefficient,
            reason: `Penalty ${boundedPenalty.toFixed(2)} applied due to confirmed violations.`,
            timestamp: new Date()
        };
    }

    private resolveStakeholders(context: ActionContext): Stakeholder[] {
        if (context.stakeholders && context.stakeholders.length > 0) {
            return context.stakeholders;
        }

        return [{
            id: 'security-ops',
            role: 'Security Operations',
            contact: 'security-ops@local'
        }];
    }

    private resolveNotificationChannel(contact: string): string {
        if (contact.includes('@')) {
            return 'email';
        }

        if (contact.startsWith('+')) {
            return 'sms';
        }

        return 'internal';
    }

    private describeRollbackAction(change: SystemChangeRecord): string {
        switch (change.type) {
            case 'CREATE':
                return `Delete newly created artifact at ${change.target}`;
            case 'UPDATE':
                return `Restore previous state for ${change.target}`;
            case 'DELETE':
                return `Recreate deleted artifact at ${change.target}`;
            case 'PERMISSION_CHANGE':
                return `Revert permission changes for ${change.target}`;
            case 'CONFIG_CHANGE':
            default:
                return `Restore previous configuration for ${change.target}`;
        }
    }

    private appendTrace(
        transaction: RollbackTransaction,
        status: RollbackTransactionStatus,
        detail: string
    ) {
        transaction.trace.push({
            timestamp: new Date(),
            actor: 'RemediationEngine',
            status,
            detail
        });
    }

    private severityPenalty(severity: ViolationSeverity): number {
        switch (severity) {
            case ViolationSeverity.LOW:
                return 0.02;
            case ViolationSeverity.MEDIUM:
                return 0.05;
            case ViolationSeverity.HIGH:
                return 0.12;
            case ViolationSeverity.CRITICAL:
                return 0.2;
            default:
                return 0.05;
        }
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
    }
}
