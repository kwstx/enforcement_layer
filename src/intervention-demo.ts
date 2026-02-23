import { GuardrailOrchestrator } from './orchestrator/guardrail-orchestrator';
import { EnforcementEventBus, EnforcementEvents } from './core/event-bus';
import { ViolationCategory, ViolationSeverity, ActionContext } from './core/models';

async function runInterventionDemo() {
    const orchestrator = new GuardrailOrchestrator();
    const eventBus = EnforcementEventBus.getInstance();

    console.log('=== Adaptive Intervention Layer Demo ===\n');

    // Helper to trigger a violation for the next action that is proposed
    function triggerViolationOnNext(id: string, severity: ViolationSeverity, description: string) {
        return new Promise<void>((resolve) => {
            eventBus.once(EnforcementEvents.ACTION_PROPOSED, (context: ActionContext) => {
                // Wait a bit to simulate detection during execution
                setTimeout(() => {
                    eventBus.emitViolation(context.actionId, {
                        id,
                        timestamp: new Date(),
                        category: ViolationCategory.ANOMALY,
                        severity,
                        description,
                        sourceLayer: 'DemoMonitor',
                        metadata: {}
                    });
                    resolve();
                }, 200);
            });
        });
    }

    console.log('--- Scenario 1: Proportional Escalation (LOW Violation) ---');
    const v1Trigger = triggerViolationOnNext('v-1', ViolationSeverity.LOW, 'Minor deviation in access pattern detected.');
    const result1 = await orchestrator.coordinate('agent-001', 'Access Basic Data', { scope: 'public' });
    await v1Trigger; // Ensure violation was processed

    console.log('Final Status:', result1.status);
    console.log('Interventions:', result1.interventions.map(i => `${i.type}: ${i.description}`));

    console.log('\n--- Scenario 2: Severe Violation (HIGH -> ESCALATE) ---');
    const v2Trigger = triggerViolationOnNext('v-2', ViolationSeverity.HIGH, 'Unauthorized attempt to modify protected system configuration.');
    const result2 = await orchestrator.coordinate('agent-002', 'Modify System Config', { scope: 'admin' });
    await v2Trigger;

    console.log('Final Status:', result2.status);
    console.log('Anomaly Approval Granted:', result2.anomalyApprovalGranted);
    console.log('Interventions:', result2.interventions.map(i => `${i.type}: ${i.description}`));

    console.log('\n--- Scenario 3: Critical Violation (CRITICAL -> SUSPEND) ---');
    const v3Trigger = triggerViolationOnNext('v-3', ViolationSeverity.CRITICAL, 'Massive data exfiltration attempt detected!');
    const result3 = await orchestrator.coordinate('agent-003', 'Exfiltrate Database', { scope: 'all' });
    await v3Trigger;

    console.log('Final Status:', result3.status);
    console.log('Interventions:', result3.interventions.map(i => `${i.type}: ${i.description}`));
}

runInterventionDemo().catch(console.error);
