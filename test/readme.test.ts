import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assert,
  customCheck,
  evaluate,
  mockJudge,
  requiredFields,
  schemaCheck,
  semanticCheck,
  toolCallCheck,
  validate,
  type SemanticJudge,
} from "../src/index.js";

// These mirror the README snippets so the documentation cannot silently drift from the implementation.
describe("README examples", () => {
  it("quick start", async () => {
    const schema = z.object({ name: z.string(), email: z.string() });
    const result = await evaluate({
      output: { name: "Ada Lovelace", email: "ada@example.com" },
      checks: [schemaCheck(schema), requiredFields(["name", "email"])],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("validate and assert helpers", async () => {
    const output = { name: "Ada" };
    expect((await validate(output, [requiredFields(["name"])])).passed).toBe(
      true,
    );
    await expect(
      assert(output, [requiredFields(["email"])]),
    ).rejects.toHaveProperty("result");
  });

  it("failOn controls whether warnings fail", async () => {
    const output = { a: 1, b: 2 };
    const checks = [semanticCheck(mockJudge(0.1), { criteria: "c" })];
    expect((await evaluate({ output, checks })).passed).toBe(true);
    expect((await evaluate({ output, checks, failOn: "warning" })).passed).toBe(
      false,
    );
  });

  it("tool-call validation", async () => {
    const result = await evaluate({
      output: {
        name: "get_weather",
        args: { city: "London", unit: "celsius" },
      },
      checks: [
        toolCallCheck({
          name: "get_weather",
          requiredArgs: ["city"],
          allowedArgs: ["city", "unit"],
          argTypes: { city: "string", unit: "string" },
        }),
      ],
    });
    expect(result.passed).toBe(true);
  });

  it("custom checks", async () => {
    const evenScore = customCheck<{ score: number }>(
      "evenScore",
      async (value) => ({
        passed: value.score % 2 === 0,
        failures:
          value.score % 2 === 0
            ? []
            : [
                {
                  code: "policy_violation",
                  message: "score must be even",
                  severity: "error",
                  path: "score",
                },
              ],
        warnings: [],
      }),
    );
    expect(
      (await evaluate({ output: { score: 2 }, checks: [evenScore] })).passed,
    ).toBe(true);
    expect(
      (await evaluate({ output: { score: 3 }, checks: [evenScore] }))
        .failures[0].path,
    ).toBe("score");
  });

  it("semantic judging is advisory by default", async () => {
    const judge: SemanticJudge = async () => ({
      score: 0.9,
      reasoning: "Grounded in the context.",
    });
    const result = await evaluate({
      input: "question",
      output: "answer",
      checks: [
        semanticCheck(judge, {
          criteria: "The answer is grounded in the context",
          threshold: 0.7,
        }),
      ],
    });
    expect(result.passed).toBe(true);
    expect(result.metadata?.checks).toBeDefined();
  });

  it("README lists every exported check", () => {
    const readme = readFileSync(
      join(import.meta.dirname, "..", "README.md"),
      "utf8",
    );
    for (const name of [
      "schemaCheck",
      "requiredFields",
      "noExtraFields",
      "enumCheck",
      "fieldTypeCheck",
      "jsonCheck",
      "nonEmpty",
      "regexCheck",
      "rangeCheck",
      "toolCallCheck",
      "semanticCheck",
      "customCheck",
    ]) {
      expect(readme, name).toContain(name);
    }
  });
});
