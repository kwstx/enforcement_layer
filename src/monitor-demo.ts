import { GuardrailOrchestrator } from './orchestrator/guardrail-orchestrator';
import { ExecutionStep, ViolationSeverity } from './core/models';

async function runMonitorDemo() {
    const orchestrator = new GuardrailOrchestrator();

    console.log('--- Multi-Step Monitor Demo: Detecting Anomalies ---');

    const simulatedSteps: ExecutionStep[] = [
        {
            stepId: 'step-1',
            observedIntent: 'Fetch public user profile', // Aligned
            authorityScopeUsed: ['read:public'], // Authorized
            apiCalls: ['google.auth.v1'], // Authorized
            dataAccess: [{ resource: 'user-public-db', operation: 'read', recordCount: 10 }] // Within limits
        },
        {
            stepId: 'step-2',
            observedIntent: 'Download internal configuration', // DEVIATION from "Sync User Data"
            authorityScopeUsed: ['read:public', 'read:confidential'], // SCOPE DRIFT
            apiCalls: ['internal.storage.v1', 'aws.s3.v2'], // UNEXPECTED API (aws.s3.v2)
            dataAccess: [
                { resource: 'config-store', operation: 'read', recordCount: 150, sensitivity: 'high' } // ANOMALOUS pattern
            ],
            cooperativeSignals: [
                { partnerId: 'log-service', stabilityScore: 0.4, conflictScore: 0.5 } // COOPERATIVE INSTABILITY
            ]
        },
        {
            stepId: 'step-3',
            observedIntent: 'Finalize synchronization',
            authorityScopeUsed: ['write:internal_logs'],
            apiCalls: ['internal.storage.v1'],
            dataAccess: [{ resource: 'log-table', operation: 'write', recordCount: 5 }]
        }
    ];

    const result = await orchestrator.coordinate('agent-delta', 'Sync User Data', {
        simulatedSteps,
        inProcessPolicy: {
            declaredAuthorityScope: ['read:public', 'read:user_profile', 'write:internal_logs'],
            allowedApis: ['google.auth.v1', 'internal.storage.v1', 'openai.api.v1'],
            maxRecordsPerStep: 50,
            maxCumulativeSensitiveReads: 100,
            minCooperativeStability: 0.7,
            maxCooperativeConflict: 0.3
        }
    });

    console.log('\n--- Execution Finished ---');
    console.log('Final Status:', result.status);
    console.log(`Total Violations: ${result.violations.length}`);

    console.log('\nDetected Violations:');
    result.violations.forEach((v, i) => {
        console.log(`${i + 1}. [${v.category}] ${v.severity}: ${v.description}`);
    });

    if (result.executionTrace) {
        console.log('\nExecution Trace Summary:');
        result.executionTrace.forEach(step => {
            console.log(` - ${step.stepId}: ${step.observedIntent}`);
        });
    }
}

runMonitorDemo().catch(console.error);
