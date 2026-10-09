import { describe, expect, it } from "vitest";
import {
  evaluate,
  jsonCheck,
  nonEmpty,
  rangeCheck,
  regexCheck,
} from "../src/index.js";

describe("value checks", () => {
  it("jsonCheck flags invalid and non-string output", async () => {
    expect(
      (await evaluate({ output: "{bad", checks: [jsonCheck()] })).failures[0]
        .code,
    ).toBe("invalid_json");
    expect(
      (await evaluate({ output: 5, checks: [jsonCheck()] })).failures[0].code,
    ).toBe("invalid_json");
    expect(
      (await evaluate({ output: '{"ok":1}', checks: [jsonCheck()] })).passed,
    ).toBe(true);
  });

  it("nonEmpty rejects blank strings, empty arrays/objects and null", async () => {
    for (const value of ["  ", [], {}, null]) {
      const result = await evaluate({
        output: { v: value },
        checks: [nonEmpty("v")],
      });
      expect(result.failures[0].code).toBe("policy_violation");
    }
    expect(
      (await evaluate({ output: { v: "x" }, checks: [nonEmpty("v")] })).passed,
    ).toBe(true);
    expect(
      (await evaluate({ output: {}, checks: [nonEmpty("v")] })).failures[0]
        .code,
    ).toBe("missing_field");
  });

  it("regexCheck validates patterns, including global regexes", async () => {
    const check = regexCheck("email", /^[^@]+@[^@]+$/g);
    expect(
      (await evaluate({ output: { email: "a@b" }, checks: [check] })).passed,
    ).toBe(true);
    expect(
      (await evaluate({ output: { email: "a@b" }, checks: [check] })).passed,
    ).toBe(true);
    expect(
      (await evaluate({ output: { email: "nope" }, checks: [check] })).passed,
    ).toBe(false);
    expect(
      (await evaluate({ output: { email: 5 }, checks: [check] })).failures[0]
        .code,
    ).toBe("invalid_type");
  });

  it("rangeCheck enforces bounds", async () => {
    const check = rangeCheck("score", { min: 0, max: 1 });
    expect(
      (await evaluate({ output: { score: 0.5 }, checks: [check] })).passed,
    ).toBe(true);
    expect(
      (await evaluate({ output: { score: 2 }, checks: [check] })).passed,
    ).toBe(false);
    expect(
      (await evaluate({ output: { score: -1 }, checks: [check] })).passed,
    ).toBe(false);
    expect(
      (await evaluate({ output: { score: "1" }, checks: [check] })).failures[0]
        .code,
    ).toBe("invalid_type");
    expect(
      (await evaluate({ output: { score: NaN }, checks: [check] })).passed,
    ).toBe(false);
  });

  it("rangeCheck supports one-sided bounds", async () => {
    expect(
      (
        await evaluate({
          output: { n: 100 },
          checks: [rangeCheck("n", { min: 0 })],
        })
      ).passed,
    ).toBe(true);
    expect(
      (
        await evaluate({
          output: { n: -100 },
          checks: [rangeCheck("n", { max: 0 })],
        })
      ).passed,
    ).toBe(true);
  });
});
