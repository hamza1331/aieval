import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  EvaluationError,
  assert,
  customCheck,
  enumCheck,
  evaluate,
  fieldTypeCheck,
  noExtraFields,
  nonEmpty,
  requiredFields,
  schemaCheck,
  validate,
} from "../src/index.js";

describe("core validation", () => {
  it("passes valid structured output", async () => {
    const schema = z.object({ name: z.string(), email: z.string() });
    const result = await evaluate({
      output: { name: "Ada", email: "ada@example.com" },
      checks: [schemaCheck(schema), requiredFields(["name", "email"])],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("reports missing required fields", async () => {
    const result = await evaluate({
      output: { name: "Ada" },
      checks: [requiredFields(["name", "email"])],
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].code).toBe("missing_field");
  });

  it("validates schema mismatches with nested paths", async () => {
    const schema = z.object({ user: z.object({ age: z.number() }) });
    const result = await evaluate({
      output: { user: { age: "x" } } as any,
      checks: [schemaCheck(schema)],
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0].path).toBe("user.age");
  });

  it("supports enum validation", async () => {
    const check = enumCheck("status", ["pending", "running"]);
    const result = await evaluate({
      output: { status: "failed" },
      checks: [check],
    });
    expect(result.failures[0].code).toBe("invalid_enum");
    expect(
      (await evaluate({ output: {}, checks: [check] })).failures[0].code,
    ).toBe("missing_field");
    expect(
      (await evaluate({ output: { status: "running" }, checks: [check] }))
        .passed,
    ).toBe(true);
  });

  it("supports field type validation", async () => {
    const result = await evaluate({
      output: { score: "high" },
      checks: [fieldTypeCheck("score", "number")],
    });
    expect(result.failures[0].code).toBe("invalid_type");
    expect(
      (
        await evaluate({
          output: { items: [] },
          checks: [fieldTypeCheck("items", "array")],
        })
      ).passed,
    ).toBe(true);
    expect(
      (
        await evaluate({
          output: { o: null },
          checks: [fieldTypeCheck("o", "object")],
        })
      ).passed,
    ).toBe(true);
  });

  it("rejects non-object output for object-level checks", async () => {
    const checks = [
      requiredFields(["a"]),
      noExtraFields(["a"]),
      enumCheck("a", ["x"]),
      fieldTypeCheck("a", "string"),
      nonEmpty("a"),
    ];
    for (const check of checks) {
      const result = await evaluate({
        output: [1, 2] as any,
        checks: [check as any],
      });
      expect(result.passed, check.name).toBe(false);
      expect(result.failures[0].code, check.name).toBe("schema_violation");
    }
  });

  it("flags extra fields", async () => {
    const result = await evaluate({
      output: { a: 1, b: 2 },
      checks: [noExtraFields(["a"])],
    });
    expect(result.failures[0].path).toBe("b");
  });

  it("supports async custom checks", async () => {
    const check = customCheck<{ n: number }>("positive", async (value) => ({
      passed: value.n > 0,
      failures:
        value.n > 0
          ? []
          : [
              {
                code: "custom_check",
                message: "n must be positive",
                severity: "error",
              },
            ],
      warnings: [],
    }));
    expect((await evaluate({ output: { n: 1 }, checks: [check] })).passed).toBe(
      true,
    );
    expect(
      (await evaluate({ output: { n: -1 }, checks: [check] })).failures[0].code,
    ).toBe("custom_check");
  });

  it("is deterministic and runs checks in order", async () => {
    const order: string[] = [];
    const make = (name: string) =>
      customCheck(name, () => {
        order.push(name);
        return { passed: true, failures: [], warnings: [] };
      });
    const checks = [make("a"), make("b"), make("c")];
    await evaluate({ output: {}, checks });
    await evaluate({ output: {}, checks });
    expect(order).toEqual(["a", "b", "c", "a", "b", "c"]);
  });

  it("exposes validate and assert helpers", async () => {
    expect(
      (await validate({ name: "Ada" }, [requiredFields(["name"])])).passed,
    ).toBe(true);
    await expect(
      assert({ name: "Ada" }, [requiredFields(["name", "email"])]),
    ).rejects.toBeInstanceOf(EvaluationError);
    await expect(
      assert({ name: "Ada" }, [requiredFields(["name"])]),
    ).resolves.toBeUndefined();
  });
});
