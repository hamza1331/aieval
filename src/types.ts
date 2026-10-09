export type Severity = "info" | "warning" | "error" | "critical";

export type FailureCode =
  | "missing_field"
  | "invalid_type"
  | "invalid_enum"
  | "schema_violation"
  | "invalid_json"
  | "tool_call_mismatch"
  | "unsupported_claim"
  | "policy_violation"
  | "custom_check"
  | "unknown";

export interface Failure {
  code: FailureCode;
  message: string;
  severity: Severity;
  path?: string;
  metadata?: Record<string, unknown>;
  suggestedRepair?: string;
}

export interface CheckResult {
  passed: boolean;
  failures: Failure[];
  warnings: Failure[];
  metadata?: Record<string, unknown>;
}

export type CheckContext = {
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
};

export type CheckFn<T = unknown> = (
  value: T,
  context: CheckContext,
) => CheckResult | Promise<CheckResult>;

export interface Check<T = unknown> {
  name: string;
  description?: string;
  run: CheckFn<T>;
}

export interface EvaluationOptions<T = unknown> {
  input?: unknown;
  output?: T;
  checks: Check<T>[];
  metadata?: Record<string, unknown>;
  /** Minimum severity that counts as a failure. Lower severities become warnings. Defaults to "error". */
  failOn?: Severity;
}

export interface EvaluationResult<T = unknown> {
  passed: boolean;
  failures: Failure[];
  warnings: Failure[];
  output?: T;
  metadata?: Record<string, unknown>;
}
