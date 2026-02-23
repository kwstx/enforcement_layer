export enum EnforcementState {
    PENDING = 'PENDING',
    PRE_EXECUTION_PASSED = 'PRE_EXECUTION_PASSED',
    PRE_EXECUTION_FAILED = 'PRE_EXECUTION_FAILED',
    EXECUTING = 'EXECUTING',
    SUSPENDED = 'SUSPENDED',
    COMPLETED = 'COMPLETED',
    REMEDIATED = 'REMEDIATED',
    AUDIT_PASSED = 'AUDIT_PASSED',
    AUDIT_FAILED = 'AUDIT_FAILED'
}

export enum ViolationSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export enum ViolationCategory {
    PERMISSION = 'PERMISSION',
    SCOPE = 'SCOPE',
    IMPACT = 'IMPACT',
    ANOMALY = 'ANOMALY',
    COMPLIANCE = 'COMPLIANCE'
}

export interface Violation {
    id: string;
    timestamp: Date;
    category: ViolationCategory;
    severity: ViolationSeverity;
    description: string;
    sourceLayer: string;
    metadata: Record<string, any>;
}

export interface DataAccessEvent {
    resource: string;
    operation: 'read' | 'write' | 'delete';
    recordCount?: number;
    sensitivity?: 'low' | 'medium' | 'high';
}

export interface CooperativeSignal {
    partnerId: string;
    stabilityScore: number; // 0.0 to 1.0
    conflictScore?: number; // 0.0 to 1.0
}

export interface ExecutionStep {
    stepId: string;
    timestamp?: Date;
    observedIntent?: string;
    authorityScopeUsed?: string[];
    apiCalls?: string[];
    dataAccess?: DataAccessEvent[];
    cooperativeSignals?: CooperativeSignal[];
}

export interface InProcessMonitorPolicy {
    declaredAuthorityScope: string[];
    allowedApis: string[];
    maxRecordsPerStep: number;
    maxCumulativeSensitiveReads: number;
    minCooperativeStability: number;
    maxCooperativeConflict: number;
}

export interface SynergyShift {
    component: string;
    previousSynergy: number;
    projectedSynergy: number;
    delta: number;
    reason: string;
}

export interface PropagationEffect {
    targetSystem: string;
    probability: number;
    impactMagnitude: number;
    trustWeight: number;
    description: string;
}

export interface PolicyForecast {
    policyId: string;
    complianceDelta: number; // -1.0 to 1.0
    forecastedOutcome: string;
}

export interface RiskProfile {
    overallRiskScore: number; // 0.0 to 1.0
    synergyShifts: SynergyShift[];
    propagationEffects: PropagationEffect[];
    policyForecasts: PolicyForecast[];
    realWorldConsequences: string[];
    recommendation: 'PROCEED' | 'HOLD' | 'BLOCK';
}

export interface BehaviorVector {
    intentDeviationRisk: number; // 0.0 to 1.0
    scopeDriftRisk: number; // 0.0 to 1.0
    apiNoveltyRisk: number; // 0.0 to 1.0
    sensitiveDataExposureRisk: number; // 0.0 to 1.0
    cooperativeInstabilityRisk: number; // 0.0 to 1.0
    dataVolumeRisk: number; // 0.0 to 1.0
}

export interface AnomalyToleranceThresholds {
    warn: number;
    slow: number;
    requireApproval: number;
    halt: number;
}

export type AnomalyMitigationAction = 'NONE' | 'WARN' | 'SLOW' | 'REQUIRE_APPROVAL' | 'HALT';

export interface ActionContext {
    actionId: string;
    agentId: string;
    intent: string;
    params: Record<string, any>;
    startTime?: Date;
    endTime?: Date;
    status: EnforcementState;
    violations: Violation[];
    riskProfile?: RiskProfile;
    predictedBehaviorVector?: BehaviorVector;
    executionTrace?: ExecutionStep[];
    anomalyApprovalGranted?: boolean;
}
