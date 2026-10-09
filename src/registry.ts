import type { Check, Severity } from "./types.js";
import {
  enumCheck,
  fieldTypeCheck,
  jsonCheck,
  noExtraFields,
  nonEmpty,
  rangeCheck,
  regexCheck,
  requiredFields,
  toolCallCheck,
  type ToolCallDefinition,
} from "./checks.js";

/**
 * JSON-serialisable description of a check. Used by the CLI and fixture files.
 * `schemaCheck` is intentionally absent: Zod schemas cannot be serialised.
 */
export type CheckSpec =
  | { type: "requiredFields"; fields: string[] }
  | { type: "noExtraFields"; allowed: string[]; severity?: Severity }
  | { type: "enum"; field: string; values: Array<string | number> }
  | {
      type: "fieldType";
      field: string;
      expected: "string" | "number" | "boolean" | "object" | "array";
    }
  | ({ type: "toolCall" } & ToolCallDefinition)
  | { type: "toolCallOneOf"; tools: ToolCallDefinition[] }
  | { type: "json" }
  | { type: "nonEmpty"; field: string }
  | { type: "regex"; field: string; pattern: string; flags?: string }
  | { type: "range"; field: string; min?: number; max?: number };

type AnyCheck = Check<any>;

const fail = (index: number, message: string): never => {
  throw new Error(`Invalid check spec at index ${index}: ${message}`);
};

const requireString = (
  spec: Record<string, unknown>,
  key: string,
  index: number,
): string => {
  const value = spec[key];
  if (typeof value !== "string" || value === "")
    fail(index, `"${key}" must be a non-empty string.`);
  return value as string;
};

const requireStringArray = (
  spec: Record<string, unknown>,
  key: string,
  index: number,
): string[] => {
  const value = spec[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(index, `"${key}" must be an array of strings.`);
  }
  return value as string[];
};

export const buildCheck = (spec: unknown, index = 0): AnyCheck => {
  if (spec == null || typeof spec !== "object" || Array.isArray(spec)) {
    return fail(index, "spec must be an object.");
  }
  const s = spec as Record<string, unknown>;

  switch (s.type) {
    case "requiredFields":
      return requiredFields(requireStringArray(s, "fields", index));
    case "noExtraFields":
      return noExtraFields(requireStringArray(s, "allowed", index), {
        severity: s.severity as Severity | undefined,
      });
    case "enum": {
      if (!Array.isArray(s.values)) fail(index, `"values" must be an array.`);
      return enumCheck(
        requireString(s, "field", index),
        s.values as Array<string | number>,
      );
    }
    case "fieldType":
      return fieldTypeCheck(
        requireString(s, "field", index),
        requireString(s, "expected", index) as never,
      );
    case "toolCall": {
      const { type: _type, ...definition } = s;
      requireString(s, "name", index);
      return toolCallCheck(definition as unknown as ToolCallDefinition);
    }
    case "toolCallOneOf": {
      if (!Array.isArray(s.tools) || s.tools.length === 0)
        fail(index, `"tools" must be a non-empty array.`);
      return toolCallCheck.oneOf(s.tools as ToolCallDefinition[]);
    }
    case "json":
      return jsonCheck();
    case "nonEmpty":
      return nonEmpty(requireString(s, "field", index));
    case "regex": {
      const field = requireString(s, "field", index);
      const pattern = requireString(s, "pattern", index);
      try {
        return regexCheck(
          field,
          new RegExp(
            pattern,
            typeof s.flags === "string" ? s.flags : undefined,
          ),
        );
      } catch (error) {
        return fail(
          index,
          `invalid regex: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    case "range": {
      const min = s.min;
      const max = s.max;
      if (
        (min !== undefined && typeof min !== "number") ||
        (max !== undefined && typeof max !== "number")
      ) {
        fail(index, `"min" and "max" must be numbers.`);
      }
      return rangeCheck(requireString(s, "field", index), {
        min: min as number | undefined,
        max: max as number | undefined,
      });
    }
    default:
      return fail(index, `unknown check type "${String(s.type)}".`);
  }
};

export const buildChecks = (specs: unknown): AnyCheck[] => {
  if (!Array.isArray(specs)) {
    throw new Error("Checks must be an array of check specs.");
  }
  return specs.map((spec, index) => buildCheck(spec, index));
};
