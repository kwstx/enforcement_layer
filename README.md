# Enforcement Layers

A multi-layered guardrail framework for autonomous agent systems. Enforcement Layers intercepts, monitors, and audits every action an agent attempts -- before, during, and after execution -- to ensure safety, compliance, and trust.

---

## Overview

Enforcement Layers provides a structured pipeline that every agent action must pass through:

1. **Pre-Execution** -- Validates intent, evaluates predictive risk, and blocks or warns before anything runs.
2. **In-Process Monitoring** -- Observes live execution for scope drift, unauthorized API calls, anomalous data access, and cooperative instability.
3. **Post-Execution Auditing** -- Audits completed actions for compliance violations and triggers automatic remediation when failures are detected.

An adaptive intervention system runs across all layers, dynamically adjusting permissions, escalating to human oversight, or suspending execution based on violation severity. The framework also learns over time: a threshold adaptation engine refines risk tolerances and anomaly sensitivity from historical outcomes, and a violation propagation module ensures that threats detected in one layer tighten enforcement across all others.

---

## Architecture

```
                         GuardrailOrchestrator
                                 |
          ------------------------------------------------
          |                      |                        |
   Pre-Execution            In-Process              Post-Execution
      Layer                   Layer                    Layer
          |                      |                        |
   PredictiveRisk          InProcessMonitor         RemediationEngine
      Engine               AnomalyDetection         StabilityFeedback
                              Engine                  Connector
          \                      |                      /
           ----- Adaptive Intervention Layer ----------
                                 |
              ----------------------------------
              |                                |
     ViolationPropagation         ThresholdAdaptation
          Module                       Engine
              |                                |
              -------- Event Bus --------------
```

### Core Flow

The `GuardrailOrchestrator` coordinates the full lifecycle:

1. An action is submitted with an agent ID, intent, and parameters.
2. The **Pre-Execution Layer** runs predictive risk analysis (synergy shifts, propagation effects, policy forecasts) and baseline authorization checks. Actions with critical risk are blocked; elevated risk generates warnings.
3. The **In-Process Layer** monitors each execution step. The `InProcessMonitor` checks for intent deviation, authority scope drift, unauthorized API calls, excessive data access, and cooperative instability. The `AnomalyDetectionEngine` compares a predicted behavior vector against live behavior and determines mitigation actions (warn, slow, require approval, or halt).
4. On completion, the **Post-Execution Layer** audits results. If critical violations exist or compliance checks fail, the `RemediationEngine` executes rollback transactions, notifies stakeholders, recalibrates trust coefficients, and generates stability feedback reports.
5. Throughout all stages, the **Adaptive Intervention Layer** responds to violations by applying proportional interventions: requiring verification, narrowing scope, escalating to a human, suspending execution, or terminating the session.

---

## Components

### Layers

| Component | Location | Purpose |
|---|---|---|
| Pre-Execution Layer | `src/layers/pre-execution/` | Intent validation, predictive risk analysis, authorization checks |
| In-Process Layer | `src/layers/in-process/` | Real-time behavior monitoring, anomaly detection |
| Post-Execution Layer | `src/layers/post-execution/` | Compliance auditing, remediation triggering |
| Adaptive Intervention Layer | `src/layers/intervention/` | Proportional response to violations across all layers |
| Remediation Engine | `src/layers/remediation/` | Rollback transactions, stakeholder notifications, trust recalibration, stability feedback |

### Core Engines

| Component | Location | Purpose |
|---|---|---|
| Predictive Risk Engine | `src/layers/pre-execution/predictive-risk-engine.ts` | Evaluates synergy shifts, propagation effects, and policy forecasts to produce a risk profile |
| In-Process Monitor | `src/layers/in-process/in-process-monitor.ts` | Tracks execution steps against declared authority scope and monitor policies |
| Anomaly Detection Engine | `src/layers/in-process/anomaly-detection-engine.ts` | Computes deviation scores between predicted and live behavior vectors |
| Remediation Engine | `src/layers/remediation/remediation-engine.ts` | Identifies unauthorized changes, builds and executes rollback transactions, recalibrates trust |
| Stability Feedback Connector | `src/layers/remediation/stability-feedback-connector.ts` | Generates cooperative intelligence metrics, trust calibration curves, and synergy density forecasts |

### Core Infrastructure

| Component | Location | Purpose |
|---|---|---|
| Event Bus | `src/core/event-bus.ts` | Singleton event emitter for decoupled communication between layers |
| Violation Propagation Module | `src/core/violation-propagation.ts` | Propagates violation impact across layers by adjusting risk multipliers and threshold tightness |
| Threshold Adaptation Engine | `src/core/threshold-adaptation-engine.ts` | Learns from historical outcomes to adjust risk tolerance and anomaly sensitivity over time |
| Decision Log | `src/core/decision-log.ts` | Appends structured decision explanations to action contexts for auditability |
| Models | `src/core/models.ts` | All shared types, interfaces, and enums |

### API

| Component | Location | Purpose |
|---|---|---|
| Guardrails API | `src/api/guardrails-api.ts` | External interface for submitting actions, querying live status, retrieving risk assessments, violation logs, remediation reports, decision explanations, and adaptive threshold settings |

---

## Project Structure

```
enforcement_layers/
  src/
    index.ts                         # Public exports
    api/
      guardrails-api.ts              # External-facing API
    core/
      models.ts                      # Types, interfaces, enums
      event-bus.ts                    # Singleton event bus
      decision-log.ts                # Decision explanation logger
      violation-propagation.ts       # Cross-layer violation propagation
      threshold-adaptation-engine.ts # Adaptive threshold learning
    layers/
      base-layer.ts                  # Abstract base for enforcement layers
      pre-execution/
        pre-execution-layer.ts       # Pre-execution validation pipeline
        predictive-risk-engine.ts    # Risk profiling engine
      in-process/
        in-process-layer.ts          # In-process monitoring pipeline
        in-process-monitor.ts        # Step-by-step execution monitor
        anomaly-detection-engine.ts  # Behavior vector anomaly detection
      post-execution/
        post-execution-layer.ts      # Post-execution audit pipeline
      intervention/
        adaptive-intervention-layer.ts  # Proportional intervention responses
      remediation/
        remediation-engine.ts        # Rollback and trust recalibration
        stability-feedback-connector.ts # Cooperative stability analysis
    orchestrator/
      guardrail-orchestrator.ts      # Central coordination of all layers
  test/
  tsconfig.json
  package.json
```

---

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- TypeScript 5.x

### Install

```bash
npm install
```

### Build

```bash
npx tsc --outDir dist
```

### Usage

```typescript
import { GuardrailOrchestrator } from './orchestrator/guardrail-orchestrator';

const orchestrator = new GuardrailOrchestrator();

const result = await orchestrator.coordinate(
  'agent-001',
  'deploy-service',
  { region: 'us-east-1', scope: 'production' }
);

console.log(result.status);           // Final enforcement state
console.log(result.violations);       // Any violations detected
console.log(result.interventions);    // Interventions applied
console.log(result.riskProfile);      // Predictive risk assessment
console.log(result.remediationReport); // Remediation details (if triggered)
```

Or use the `GuardrailsAPI` for a higher-level interface:

```typescript
import { GuardrailsAPI } from './api/guardrails-api';

const api = new GuardrailsAPI();

// Submit and track an action
const handle = api.startTrackedAction('agent-001', 'deploy-service', {
  region: 'us-east-1'
});

// Query live status
const status = api.getLiveExecutionStatus(handle.actionId);

// Get full results after completion
const result = await handle.completion;
const violations = api.getViolationLogs(handle.actionId);
const explanations = api.getDecisionExplanations(handle.actionId);
const thresholds = api.getAdaptiveThresholdSettings();
```

---

## Key Concepts

**Enforcement States** -- Actions move through states (`PENDING`, `PRE_EXECUTION_PASSED`, `EXECUTING`, `SUSPENDED`, `COMPLETED`, `REMEDIATED`, `AUDIT_PASSED`, `AUDIT_FAILED`) as they flow through the pipeline.

**Violations** -- Categorized by type (permission, scope, impact, anomaly, compliance) and severity (low, medium, high, critical). Violations are detected at any layer and propagated system-wide.

**Interventions** -- Proportional responses to violations: require verification, narrow scope, reduce permissions, escalate to human, suspend execution, or terminate the session.

**Risk Profiles** -- Pre-execution assessments that combine synergy shift projections, trust-weighted propagation effects, and policy compliance forecasts into an overall risk score and recommendation.

**Behavior Vectors** -- Multi-dimensional vectors (intent deviation, scope drift, API novelty, data exposure, cooperative instability, data volume) used by the anomaly detection engine to compare predicted versus actual behavior.

**Decision Explanations** -- Every enforcement decision is logged with a structured explanation including the component, outcome, rationale, and evidence, providing a full audit trail.

**Threshold Adaptation** -- The system learns from historical outcomes (false positives, missed violations, real-world impact) to automatically adjust risk tolerance and anomaly sensitivity, balancing safety with agent autonomy.

**Violation Propagation** -- When a violation is detected in any layer, risk multipliers and threshold tightness are increased globally, making subsequent enforcement stricter until conditions are recalibrated.

---

## License

ISC
