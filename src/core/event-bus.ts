import { EventEmitter } from 'events';
import { ActionContext, Violation } from './models';

export enum EnforcementEvents {
    ACTION_PROPOSED = 'ACTION_PROPOSED',
    PRE_EXECUTION_STARTED = 'PRE_EXECUTION_STARTED',
    PRE_EXECUTION_COMPLETED = 'PRE_EXECUTION_COMPLETED',
    IN_PROCESS_UPDATE = 'IN_PROCESS_UPDATE',
    VIOLATION_DETECTED = 'VIOLATION_DETECTED',
    ACTION_EXECUTING = 'ACTION_EXECUTING',
    ACTION_COMPLETED = 'ACTION_COMPLETED',
    AUDIT_STARTED = 'AUDIT_STARTED',
    AUDIT_COMPLETED = 'AUDIT_COMPLETED',
    REMEDIATION_TRIGGERED = 'REMEDIATION_TRIGGERED',
    REMEDIATION_COMPLETED = 'REMEDIATION_COMPLETED'
}

export class EnforcementEventBus extends EventEmitter {
    private static instance: EnforcementEventBus;

    private constructor() {
        super();
    }

    public static getInstance(): EnforcementEventBus {
        if (!EnforcementEventBus.instance) {
            EnforcementEventBus.instance = new EnforcementEventBus();
        }
        return EnforcementEventBus.instance;
    }

    public emitViolation(actionId: string, violation: Violation) {
        this.emit(EnforcementEvents.VIOLATION_DETECTED, { actionId, violation });
    }

    public emitStateChange(context: ActionContext) {
        this.emit(EnforcementEvents.IN_PROCESS_UPDATE, context);
    }
}
