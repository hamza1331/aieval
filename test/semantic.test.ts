import { describe, expect, it } from "vitest";
import {
  customCheck,
  evaluate,
  mockJudge,
  requiredFields,
  semanticCheck,
} from "../src/index.js";

const criteria = "Answer is grounded in the context";

describe("semanticCheck", () => {
  it("passes at and above the threshold, fails below", async () => {
    const run = (score: number) =>
      evaluate({
        output: "x",
        checks: [semanticCheck(mockJudge(score), { criteria, threshold: 0.7 })],
        failOn: "warning",
      });

    expect((await run(0.9)).passed).toBe(true);
    expect((await run(0.7)).passed).toBe(true);
    const low = await run(0.69);
    expect(low.passed).toBe(false);
    expect(low.failures[0].code).toBe("unsupported_claim");
  });

  it("defaults to threshold 0.5 and advisory warning severity", async () => {
    const result = await evaluate({
      output: "x",
      checks: [semanticCheck(mockJudge(0.2), { criteria })],
    });
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].severity).toBe("warning");
    expect(result.warnings[0].metadata).toMatchObject({
      kind: "semantic",
      score: 0.2,
      threshold: 0.5,
      criteria,
    });
  });

  it("fails the run when severity is error or failOn is warning", async () => {
    const strictCheck = semanticCheck(mockJudge(0.1), {
      criteria,
      severity: "error",
    });
    expect(
      (await evaluate({ output: "x", checks: [strictCheck] })).passed,
    ).toBe(false);

    const advisory = semanticCheck(mockJudge(0.1), { criteria });
    expect(
      (await evaluate({ output: "x", checks: [advisory], failOn: "warning" }))
        .passed,
    ).toBe(false);
  });

  it("passes input, output and criteria to the judge", async () => {
    const judge = mockJudge(1);
    await evaluate({
      input: "question",
      output: { answer: 42 },
      checks: [semanticCheck(judge, { criteria })],
    });
    expect(judge.calls).toEqual([
      { input: "question", output: { answer: 42 }, criteria },
    ]);
  });

  it("surfaces the score in result metadata for passing and failing cases", async () => {
    const pass = await evaluate({
      output: "x",
      checks: [
        semanticCheck(
          () => ({
            score: 0.9,
            reasoning: "looks fine",
            metadata: { model: "m" },
          }),
          {
            criteria,
            name: "grounded",
          },
        ),
      ],
    });
    expect(pass.metadata?.checks).toMatchObject({
      grounded: {
        kind: "semantic",
        score: 0.9,
        reasoning: "looks fine",
        model: "m",
      },
    });

    const fail = await evaluate({
      output: "x",
      checks: [semanticCheck(mockJudge(0.1), { criteria })],
    });
    expect((fail.metadata?.checks as any).semanticCheck.score).toBe(0.1);
  });

  it("disambiguates metadata keys for checks sharing a name", async () => {
    const result = await evaluate({
      output: "x",
      checks: [
        semanticCheck(mockJudge(0.9), { criteria }),
        semanticCheck(mockJudge(0.8), { criteria }),
        semanticCheck(mockJudge(0.7), { criteria }),
      ],
    });
    expect(Object.keys(result.metadata?.checks as object)).toEqual([
      "semanticCheck",
      "semanticCheck#2",
      "semanticCheck#3",
    ]);
  });

  it("treats invalid scores as a critical failure", async () => {
    for (const score of [
      NaN,
      -0.1,
      1.1,
      Infinity,
      "0.5" as unknown as number,
    ]) {
      const result = await evaluate({
        output: "x",
        checks: [semanticCheck(() => ({ score }), { criteria })],
      });
      expect(result.passed, String(score)).toBe(false);
      expect(result.failures[0].severity).toBe("critical");
      expect(result.failures[0].code).toBe("custom_check");
    }
    const missing = await evaluate({
      output: "x",
      checks: [semanticCheck(() => undefined as any, { criteria })],
    });
    expect(missing.failures[0].message).toContain("undefined");
  });

  it("turns judge errors into critical failures", async () => {
    const throws = semanticCheck(
      () => {
        throw new Error("rate limited");
      },
      { criteria, name: "j" },
    );
    const rejects = semanticCheck(() => Promise.reject(new Error("timeout")), {
      criteria,
    });
    const result = await evaluate({ output: "x", checks: [throws, rejects] });
    expect(result.failures.map((f) => f.severity)).toEqual([
      "critical",
      "critical",
    ]);
    expect(result.failures[0].message).toContain("rate limited");
    expect(result.failures[1].message).toContain("timeout");
  });

  it("runs alongside deterministic checks and reports independently", async () => {
    const judge = mockJudge(0.1);
    const result = await evaluate({
      output: { name: "Ada" },
      checks: [
        requiredFields(["name", "email"]),
        semanticCheck(judge, { criteria }),
      ],
    });
    expect(result.failures.map((f) => f.code)).toEqual(["missing_field"]);
    expect(result.warnings.map((f) => f.code)).toEqual(["unsupported_claim"]);
  });

  it("never calls a judge unless a semantic check is present", async () => {
    const judge = mockJudge(1);
    await evaluate({ output: { a: 1 }, checks: [requiredFields(["a"])] });
    expect(judge.calls).toHaveLength(0);
  });

  it("omits checks metadata when no check reports any", async () => {
    const result = await evaluate({
      output: {},
      checks: [
        requiredFields([]),
        customCheck("noop", () => ({
          passed: true,
          failures: [],
          warnings: [],
        })),
      ],
    });
    expect(result.metadata?.checks).toBeUndefined();
  });
});

describe("mockJudge", () => {
  it("supports sequences, repeating the last score", async () => {
    const judge = mockJudge([0.1, 0.9]);
    const request = { input: undefined, output: "x", criteria };
    expect((await judge(request)).score).toBe(0.1);
    expect((await judge(request)).score).toBe(0.9);
    expect((await judge(request)).score).toBe(0.9);
    expect(judge.calls).toHaveLength(3);
  });

  it("supports functions returning scores or verdicts", async () => {
    const byLength = mockJudge(({ output }) =>
      String(output).length > 3 ? 1 : 0,
    );
    const verdict = mockJudge(() => ({ score: 0.4, reasoning: "meh" }));
    const request = { input: undefined, output: "abcd", criteria };
    expect((await byLength(request)).score).toBe(1);
    expect(await verdict(request)).toEqual({ score: 0.4, reasoning: "meh" });
  });
});
