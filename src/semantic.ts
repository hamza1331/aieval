import { makeFailure } from "./checks.js";
import type { Check, CheckContext, Severity } from "./types.js";

export interface JudgeRequest {
  input: unknown;
  output: unknown;
  criteria: string;
}

export interface JudgeVerdict {
  /** Score between 0 and 1 inclusive. */
  score: number;
  reasoning?: string;
  metadata?: Record<string, unknown>;
}

/** A caller-supplied function that scores an output against criteria, typically by calling an LLM. */
export type SemanticJudge = (
  request: JudgeRequest,
) => Promise<JudgeVerdict> | JudgeVerdict;

export interface SemanticCheckOptions {
  criteria: string;
  /** Minimum passing score. Defaults to 0.5. */
  threshold?: number;
  /** Severity of the failure when the score is below the threshold. Defaults to "warning" (advisory). */
  severity?: Severity;
  /** Check name used in failures and result metadata. Defaults to "semanticCheck". */
  name?: string;
}

/**
 * Optional LLM-judged check. Scores are advisory by default: a low score is reported as a warning
 * unless `severity` is raised or `failOn` is lowered. Results are tagged `metadata.kind = "semantic"`.
 */
export const semanticCheck = <T = unknown>(
  judge: SemanticJudge,
  options: SemanticCheckOptions,
): Check<T> => {
  const threshold = options.threshold ?? 0.5;
  const severity = options.severity ?? "warning";

  return {
    name: options.name ?? "semanticCheck",
    description: `Semantic judge: ${options.criteria}`,
    run: async (value: T, context: CheckContext) => {
      const verdict = await judge({
        input: context.input,
        output: value,
        criteria: options.criteria,
      });

      if (
        verdict == null ||
        typeof verdict.score !== "number" ||
        !Number.isFinite(verdict.score) ||
        verdict.score < 0 ||
        verdict.score > 1
      ) {
        return {
          passed: false,
          failures: [
            makeFailure(
              "custom_check",
              `Semantic judge returned an invalid score: ${String(verdict?.score)}. Expected a number between 0 and 1.`,
              "critical",
              {
                metadata: { kind: "semantic", criteria: options.criteria },
              },
            ),
          ],
          warnings: [],
          metadata: { kind: "semantic", criteria: options.criteria },
        };
      }

      const metadata = {
        kind: "semantic",
        score: verdict.score,
        threshold,
        criteria: options.criteria,
        reasoning: verdict.reasoning,
        ...verdict.metadata,
      };

      if (verdict.score >= threshold) {
        return { passed: true, failures: [], warnings: [], metadata };
      }

      return {
        passed: false,
        failures: [
          makeFailure(
            "unsupported_claim",
            `Semantic score ${verdict.score} is below threshold ${threshold} for: ${options.criteria}`,
            severity,
            { metadata },
          ),
        ],
        warnings: [],
        metadata,
      };
    },
  };
};

export interface MockJudge extends SemanticJudge {
  calls: JudgeRequest[];
}

/**
 * Deterministic judge for tests and examples. Accepts a fixed score, a sequence of scores
 * (the last one repeats), or a function mapping a request to a score or verdict.
 */
export const mockJudge = (
  scores:
    number | number[] | ((request: JudgeRequest) => number | JudgeVerdict),
): MockJudge => {
  const calls: JudgeRequest[] = [];
  const judge = ((request: JudgeRequest): JudgeVerdict => {
    const index = calls.length;
    calls.push(request);
    const raw =
      typeof scores === "function"
        ? scores(request)
        : Array.isArray(scores)
          ? scores[Math.min(index, scores.length - 1)]
          : scores;
    return typeof raw === "number" ? { score: raw } : raw;
  }) as MockJudge;
  judge.calls = calls;
  return judge;
};
