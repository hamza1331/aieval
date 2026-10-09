import { describe, expect, it } from "vitest";
import { buildCheck, buildChecks, evaluate } from "../src/index.js";

describe("registry", () => {
  it("builds every supported check type", async () => {
    const specs = [
      { type: "requiredFields", fields: ["a"] },
      { type: "noExtraFields", allowed: ["a"], severity: "warning" },
      { type: "enum", field: "a", values: [1, 2] },
      { type: "fieldType", field: "a", expected: "number" },
      { type: "toolCall", name: "t" },
      { type: "toolCallOneOf", tools: [{ name: "t" }] },
      { type: "json" },
      { type: "nonEmpty", field: "a" },
      { type: "regex", field: "a", pattern: "^1$", flags: "i" },
      { type: "range", field: "a", min: 0, max: 5 },
    ];
    const checks = buildChecks(specs);
    expect(checks.map((c) => c.name)).toEqual([
      "requiredFields",
      "noExtraFields",
      "enumCheck",
      "fieldTypeCheck",
      "toolCallCheck",
      "toolCallCheck.oneOf",
      "jsonCheck",
      "nonEmpty",
      "regexCheck",
      "rangeCheck",
    ]);
  });

  it("builds checks that behave like their direct factories", async () => {
    const result = await evaluate({
      output: { a: 9 },
      checks: buildChecks([{ type: "range", field: "a", max: 5 }]),
    });
    expect(result.failures[0].code).toBe("policy_violation");
  });

  it("builds a toolCall check from a spec", async () => {
    const [check] = buildChecks([
      { type: "toolCall", name: "t", requiredArgs: ["x"] },
    ]);
    const result = await evaluate({
      output: { name: "t", args: {} },
      checks: [check],
    });
    expect(result.failures[0].code).toBe("missing_field");
  });

  it("rejects unknown types with the spec index", () => {
    expect(() => buildChecks([{ type: "json" }, { type: "bogus" }])).toThrow(
      /index 1.*unknown check type "bogus"/,
    );
  });

  it("rejects non-array and non-object specs", () => {
    expect(() => buildChecks({})).toThrow(/array/);
    expect(() => buildCheck("x")).toThrow(/object/);
    expect(() => buildCheck([])).toThrow(/object/);
  });

  it("rejects malformed specs", () => {
    expect(() => buildCheck({ type: "requiredFields" })).toThrow(/fields/);
    expect(() => buildCheck({ type: "requiredFields", fields: [1] })).toThrow(
      /fields/,
    );
    expect(() => buildCheck({ type: "enum", field: "a" })).toThrow(/values/);
    expect(() => buildCheck({ type: "nonEmpty", field: "" })).toThrow(/field/);
    expect(() => buildCheck({ type: "toolCall" })).toThrow(/name/);
    expect(() => buildCheck({ type: "toolCallOneOf", tools: [] })).toThrow(
      /tools/,
    );
    expect(() => buildCheck({ type: "range", field: "a", min: "0" })).toThrow(
      /min/,
    );
  });

  it("rejects invalid regex patterns", () => {
    expect(() =>
      buildCheck({ type: "regex", field: "a", pattern: "(" }),
    ).toThrow(/invalid regex/);
  });
});
