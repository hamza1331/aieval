import { describe, expect, it } from "vitest";
import {
  EvaluationError,
  assert,
  customCheck,
  evaluate,
  noExtraFields,
  nonEmpty,
} from "../src/index.js";

describe("severity routing", () => {
  const check = noExtraFields(["a"], { severity: "warning" });

  it("treats warnings as non-failing by default", async () => {
    const result = await evaluate({ output: { a: 1, b: 2 }, checks: [check] });
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it("fails on warnings when failOn is warning", async () => {
    const result = await evaluate({
      output: { a: 1, b: 2 },
      checks: [check],
      failOn: "warning",
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
  });

  it("only fails on critical when failOn is critical", async () => {
    const result = await evaluate({
      output: { a: 1, b: 2 },
      checks: [noExtraFields(["a"])],
      failOn: "critical",
    });
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it("keeps a check's own warnings and info-level issues out of failures", async () => {
    const info = customCheck("info", () => ({
      passed: true,
      failures: [{ code: "custom_check", message: "fyi", severity: "info" }],
      warnings: [
        { code: "custom_check", message: "heads up", severity: "warning" },
      ],
    }));
    const result = await evaluate({ output: {}, checks: [info] });
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(2);
  });

  it("tags failures with the check name without overriding existing metadata", async () => {
    const result = await evaluate({
      output: { a: 1, b: 2 },
      checks: [noExtraFields(["a"])],
    });
    expect(result.failures[0].metadata?.checkName).toBe("noExtraFields");
    expect(result.failures[0].metadata?.allowedFields).toEqual(["a"]);
  });

  it("records duration and preserves caller metadata", async () => {
    const result = await evaluate({
      output: {},
      checks: [],
      metadata: { run: 1 },
    });
    expect(result.metadata?.run).toBe(1);
    expect(typeof result.metadata?.durationMs).toBe("number");
  });
});

describe("error handling", () => {
  it("converts a throwing check into a critical failure and keeps going", async () => {
    const result = await evaluate({
      output: {},
      checks: [
        customCheck("boom", () => {
          throw new Error("kaboom");
        }),
        nonEmpty("x") as any,
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0].severity).toBe("critical");
    expect(result.failures[0].message).toContain("kaboom");
    expect(result.failures).toHaveLength(2);
  });

  it("handles non-Error throws", async () => {
    const result = await evaluate({
      output: {},
      checks: [customCheck("weird", () => Promise.reject("nope"))],
    });
    expect(result.failures[0].message).toContain("nope");
  });

  it("assert throws EvaluationError carrying the result", async () => {
    const error = await assert({ a: 1 }, [nonEmpty("b") as any]).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(EvaluationError);
    expect(error.name).toBe("EvaluationError");
    expect(error.result.failures[0].code).toBe("missing_field");
  });

  it("EvaluationError falls back to a default message", () => {
    const error = new EvaluationError({
      passed: false,
      failures: [],
      warnings: [],
    });
    expect(error.message).toBe("Validation failed");
  });
});
