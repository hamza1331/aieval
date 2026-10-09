export * from "./types.js";
export * from "./checks.js";
export * from "./registry.js";
export * from "./runner.js";
export * from "./semantic.js";

import { makeFailure } from "./checks.js";
import type {
  Check,
  EvaluationOptions,
  EvaluationResult,
  Failure,
  Severity,
} from "./types.js";

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

export class EvaluationError<T = unknown> extends Error {
  readonly result: EvaluationResult<T>;

  constructor(result: EvaluationResult<T>) {
    super(
      result.failures.map((failure) => failure.message).join("; ") ||
        "Validation failed",
    );
    this.name = "EvaluationError";
    this.result = result;
  }
}

export const evaluate = async <T = unknown>({
  input,
  output,
  checks,
  metadata,
  failOn = "error",
}: EvaluationOptions<T>): Promise<EvaluationResult<T>> => {
  const threshold = SEVERITY_RANK[failOn];
  const allFailures: Failure[] = [];
  const allWarnings: Failure[] = [];
  const checkMetadata: Record<string, Record<string, unknown>> = {};
  const startedAt = Date.now();

  const withCheckName = (failure: Failure, checkName: string): Failure => ({
    ...failure,
    metadata: { checkName, ...failure.metadata },
  });

  for (const check of checks) {
    let result;
    try {
      result = await check.run(output as T, { input, output, metadata });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      allFailures.push(
        makeFailure(
          "custom_check",
          `Check "${check.name}" threw: ${message}`,
          "critical",
          {
            metadata: { checkName: check.name },
          },
        ),
      );
      continue;
    }

    for (const failure of result.failures) {
      const tagged = withCheckName(failure, check.name);
      (SEVERITY_RANK[failure.severity] >= threshold
        ? allFailures
        : allWarnings
      ).push(tagged);
    }
    for (const warning of result.warnings) {
      allWarnings.push(withCheckName(warning, check.name));
    }

    if (result.metadata) {
      let key = check.name;
      for (let suffix = 2; key in checkMetadata; suffix++) {
        key = `${check.name}#${suffix}`;
      }
      checkMetadata[key] = result.metadata;
    }
  }

  return {
    passed: allFailures.length === 0,
    failures: allFailures,
    warnings: allWarnings,
    output,
    metadata: {
      ...metadata,
      durationMs: Date.now() - startedAt,
      ...(Object.keys(checkMetadata).length > 0
        ? { checks: checkMetadata }
        : {}),
    },
  };
};

export const validate = async <T = unknown>(
  output: T,
  checks: Check<T>[],
  metadata?: Record<string, unknown>,
): Promise<EvaluationResult<T>> => {
  return evaluate({ output, checks, metadata });
};

export const assert = async <T = unknown>(
  output: T,
  checks: Check<T>[],
  metadata?: Record<string, unknown>,
): Promise<void> => {
  const result = await validate(output, checks, metadata);
  if (!result.passed) {
    throw new EvaluationError(result);
  }
};
