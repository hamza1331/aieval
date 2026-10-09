import { describe, expect, it } from "vitest";
import {
  evaluate,
  toolCallCheck,
  type ToolCallDefinition,
} from "../src/index.js";

const definition: ToolCallDefinition = {
  name: "get_weather",
  requiredArgs: ["city"],
  allowedArgs: ["city", "unit"],
  argTypes: { city: "string", unit: "string" },
};

describe("toolCallCheck", () => {
  it("passes the README example (quick start)", async () => {
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

  it("accepts JSON-string arguments", async () => {
    const result = await evaluate({
      output: { name: "get_weather", arguments: '{"city":"London"}' },
      checks: [toolCallCheck(definition)],
    });
    expect(result.passed).toBe(true);
  });

  it("reports invalid JSON arguments", async () => {
    const result = await evaluate({
      output: { name: "x", arguments: "{oops" },
      checks: [toolCallCheck({ name: "x" })],
    });
    expect(result.failures[0].code).toBe("invalid_json");
  });

  it("rejects JSON arguments that are not an object", async () => {
    const result = await evaluate({
      output: { name: "x", arguments: "[1]" },
      checks: [toolCallCheck({ name: "x" })],
    });
    expect(result.failures[0].code).toBe("tool_call_mismatch");
  });

  it("rejects args that are not an object", async () => {
    const result = await evaluate({
      output: { name: "x", args: 5 },
      checks: [toolCallCheck({ name: "x" })],
    });
    expect(result.failures[0].code).toBe("tool_call_mismatch");
  });

  it("rejects a non-object tool call", async () => {
    const result = await evaluate({
      output: "nope",
      checks: [toolCallCheck({ name: "x" })],
    });
    expect(result.failures[0].message).toBe("Tool call must be an object.");
  });

  it("reports wrong tool name", async () => {
    const result = await evaluate({
      output: { name: "other", args: {} },
      checks: [toolCallCheck({ name: "x" })],
    });
    expect(result.failures[0].path).toBe("name");
  });

  it("reports missing, extra and mistyped args", async () => {
    const result = await evaluate({
      output: { name: "get_weather", args: { unit: 5, bogus: true } },
      checks: [toolCallCheck(definition)],
    });
    expect(result.failures.map((f) => f.code).sort()).toEqual([
      "invalid_type",
      "missing_field",
      "schema_violation",
    ]);
  });

  it("tolerates extra args when allowExtraArgs is set", async () => {
    const result = await evaluate({
      output: { name: "get_weather", args: { city: "A", bogus: true } },
      checks: [toolCallCheck({ ...definition, allowExtraArgs: true })],
    });
    expect(result.passed).toBe(true);
  });

  it("treats missing args as empty", async () => {
    const result = await evaluate({
      output: { name: "ping" },
      checks: [toolCallCheck({ name: "ping" })],
    });
    expect(result.passed).toBe(true);
  });

  it("oneOf validates against the matching tool", async () => {
    const check = toolCallCheck.oneOf([definition, { name: "ping" }]);
    expect(
      (await evaluate({ output: { name: "ping" }, checks: [check] })).passed,
    ).toBe(true);
    const bad = await evaluate({
      output: { name: "get_weather", args: {} },
      checks: [check],
    });
    expect(bad.failures[0].code).toBe("missing_field");
  });

  it("oneOf rejects unsupported tools", async () => {
    const result = await evaluate({
      output: { name: "delete_db", args: {} },
      checks: [toolCallCheck.oneOf([{ name: "get_weather" }])],
    });
    expect(result.failures[0].message).toContain("Unsupported tool");
    expect(result.failures[0].metadata?.allowedTools).toEqual(["get_weather"]);
  });

  it("oneOf handles non-object input", async () => {
    const result = await evaluate({
      output: 3,
      checks: [toolCallCheck.oneOf([{ name: "x" }])],
    });
    expect(result.failures[0].code).toBe("tool_call_mismatch");
  });
});
