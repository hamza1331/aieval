import { z } from "zod";
import type {
  Check,
  CheckContext,
  CheckResult,
  Failure,
  Severity,
} from "./types.js";

export const makeFailure = (
  code: Failure["code"],
  message: string,
  severity: Severity = "error",
  options: Partial<Pick<Failure, "path" | "metadata" | "suggestedRepair">> = {},
): Failure => ({
  code,
  message,
  severity,
  ...options,
});

export const requiredFields = (
  fields: string[],
): Check<Record<string, unknown>> => ({
  name: "requiredFields",
  description: "Ensures required keys are present in an object output.",
  run: (value, _context) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return {
        passed: false,
        failures: [
          makeFailure(
            "schema_violation",
            "Output must be an object for required-field validation.",
            "error",
          ),
        ],
        warnings: [],
      };
    }

    const missing = fields.filter((field) => !(field in value));
    if (missing.length === 0) {
      return { passed: true, failures: [], warnings: [] };
    }

    return {
      passed: false,
      failures: missing.map((field) =>
        makeFailure(
          "missing_field",
          `Missing required field: ${field}`,
          "error",
          {
            path: field,
          },
        ),
      ),
      warnings: [],
    };
  },
});

export const noExtraFields = (
  allowedFields: string[],
  options: { severity?: Severity } = {},
): Check<Record<string, unknown>> => ({
  name: "noExtraFields",
  description:
    "Ensures the object does not contain additional keys beyond the allowed set.",
  run: (value, _context) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return {
        passed: false,
        failures: [
          makeFailure(
            "schema_violation",
            "Output must be an object for extra-field validation.",
            "error",
          ),
        ],
        warnings: [],
      };
    }

    const keys = Object.keys(value);
    const unexpected = keys.filter((key) => !allowedFields.includes(key));
    if (unexpected.length === 0) {
      return { passed: true, failures: [], warnings: [] };
    }

    return {
      passed: false,
      failures: unexpected.map((key) =>
        makeFailure(
          "schema_violation",
          `Unexpected field: ${key}`,
          options.severity ?? "error",
          {
            path: key,
            metadata: { allowedFields },
          },
        ),
      ),
      warnings: [],
    };
  },
});

export const enumCheck = <T extends string | number>(
  field: string,
  allowedValues: readonly T[],
): Check<Record<string, unknown>> => ({
  name: "enumCheck",
  description: "Ensures a field matches one of a set of allowed values.",
  run: (value, _context) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return {
        passed: false,
        failures: [
          makeFailure(
            "schema_violation",
            `Field ${field} cannot be checked because the value is not an object.`,
            "error",
          ),
        ],
        warnings: [],
      };
    }

    const actual = value[field as keyof typeof value];
    if (actual === undefined) {
      return {
        passed: false,
        failures: [
          makeFailure("missing_field", `Missing field: ${field}`, "error", {
            path: field,
          }),
        ],
        warnings: [],
      };
    }

    if (allowedValues.includes(actual as T)) {
      return { passed: true, failures: [], warnings: [] };
    }

    return {
      passed: false,
      failures: [
        makeFailure(
          "invalid_enum",
          `Field ${field} must be one of: ${allowedValues.join(", ")}`,
          "error",
          {
            path: field,
            metadata: { allowedValues, actualValue: actual },
          },
        ),
      ],
      warnings: [],
    };
  },
});

export const fieldTypeCheck = (
  field: string,
  expectedType: "string" | "number" | "boolean" | "object" | "array",
): Check<Record<string, unknown>> => ({
  name: "fieldTypeCheck",
  description: "Ensures a field has the expected runtime type.",
  run: (value, _context) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return {
        passed: false,
        failures: [
          makeFailure(
            "schema_violation",
            `Field ${field} cannot be checked because the value is not an object.`,
            "error",
          ),
        ],
        warnings: [],
      };
    }

    const actual = value[field];
    const actualType =
      actual === null
        ? "object"
        : Array.isArray(actual)
          ? "array"
          : typeof actual;
    if (actualType === expectedType) {
      return { passed: true, failures: [], warnings: [] };
    }

    return {
      passed: false,
      failures: [
        makeFailure(
          "invalid_type",
          `Field ${field} expected type ${expectedType} but received ${actualType}.`,
          "error",
          {
            path: field,
            metadata: { expectedType, actualType },
          },
        ),
      ],
      warnings: [],
    };
  },
});

export const schemaCheck = <T>(schema: z.ZodType<T>): Check<T> => ({
  name: "schemaCheck",
  description: "Runs a Zod schema against the output.",
  run: (value, _context) => {
    const result = schema.safeParse(value);
    if (result.success) {
      return { passed: true, failures: [], warnings: [] };
    }

    return {
      passed: false,
      failures: result.error.issues.map((issue) =>
        makeFailure("schema_violation", issue.message, "error", {
          path: issue.path.join("."),
          metadata: { issueCode: issue.code },
        }),
      ),
      warnings: [],
    };
  },
});

type ValueType = "string" | "number" | "boolean" | "object" | "array";

const typeOf = (value: unknown): string =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

export interface ToolCallDefinition {
  name: string;
  requiredArgs?: string[];
  allowedArgs?: string[];
  argTypes?: Record<string, ValueType>;
  /** When true, arguments not listed in allowedArgs/argTypes are tolerated. Defaults to false. */
  allowExtraArgs?: boolean;
}

const resolveToolArgs = (
  candidate: Record<string, unknown>,
): { args: Record<string, unknown> } | { failure: Failure } => {
  const raw = candidate.args ?? candidate.arguments;
  if (raw === undefined) {
    return { args: {} };
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed == null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return {
          failure: makeFailure(
            "tool_call_mismatch",
            "Tool call arguments must be a JSON object.",
            "error",
            {
              path: "arguments",
            },
          ),
        };
      }
      return { args: parsed as Record<string, unknown> };
    } catch {
      return {
        failure: makeFailure(
          "invalid_json",
          "Tool call arguments are not valid JSON.",
          "error",
          { path: "arguments" },
        ),
      };
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      failure: makeFailure(
        "tool_call_mismatch",
        "Tool call args must be an object.",
        "error",
        { path: "args" },
      ),
    };
  }
  return { args: raw as Record<string, unknown> };
};

const validateToolCall = (
  value: unknown,
  definition: ToolCallDefinition,
): Failure[] => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return [
      makeFailure(
        "tool_call_mismatch",
        "Tool call must be an object.",
        "error",
      ),
    ];
  }

  const candidate = value as Record<string, unknown>;
  const failures: Failure[] = [];

  if (candidate.name !== definition.name) {
    failures.push(
      makeFailure(
        "tool_call_mismatch",
        `Tool call name must be ${definition.name}.`,
        "error",
        {
          path: "name",
          metadata: {
            expectedName: definition.name,
            actualName: candidate.name,
          },
        },
      ),
    );
  }

  const resolved = resolveToolArgs(candidate);
  if ("failure" in resolved) {
    failures.push(resolved.failure);
    return failures;
  }
  const { args } = resolved;

  for (const arg of definition.requiredArgs ?? []) {
    if (!(arg in args)) {
      failures.push(
        makeFailure(
          "missing_field",
          `Tool call is missing required argument: ${arg}`,
          "error",
          {
            path: `args.${arg}`,
          },
        ),
      );
    }
  }

  const argTypes = definition.argTypes ?? {};
  const known = new Set([
    ...(definition.allowedArgs ?? []),
    ...Object.keys(argTypes),
    ...(definition.requiredArgs ?? []),
  ]);
  if (!definition.allowExtraArgs && known.size > 0) {
    for (const key of Object.keys(args)) {
      if (!known.has(key)) {
        failures.push(
          makeFailure(
            "schema_violation",
            `Unexpected tool argument: ${key}`,
            "error",
            { path: `args.${key}` },
          ),
        );
      }
    }
  }

  for (const [key, expectedType] of Object.entries(argTypes)) {
    const actual = args[key];
    if (actual === undefined) continue;
    const actualType = typeOf(actual);
    if (actualType !== expectedType) {
      failures.push(
        makeFailure(
          "invalid_type",
          `Tool argument ${key} expected type ${expectedType} but received ${actualType}.`,
          "error",
          {
            path: `args.${key}`,
            metadata: { expectedType, actualType },
          },
        ),
      );
    }
  }

  return failures;
};

const resultFrom = (failures: Failure[]): CheckResult => ({
  passed: failures.length === 0,
  failures,
  warnings: [],
});

/**
 * Validates a tool call shaped `{ name, args }` (or `{ name, arguments: "<json>" }`).
 */
export const toolCallCheck = <T = unknown>(
  definition: ToolCallDefinition,
): Check<T> => ({
  name: "toolCallCheck",
  description:
    "Validates tool-call structure, required args, and argument types.",
  run: (value, _context) => resultFrom(validateToolCall(value, definition)),
});

/**
 * Validates a tool call against a set of allowed tools. Unknown tool names fail.
 */
toolCallCheck.oneOf = <T = unknown>(
  definitions: ToolCallDefinition[],
): Check<T> => ({
  name: "toolCallCheck.oneOf",
  description:
    "Validates a tool call against one of several allowed tool definitions.",
  run: (value, _context) => {
    const name =
      value != null && typeof value === "object"
        ? (value as Record<string, unknown>).name
        : undefined;
    const definition = definitions.find((candidate) => candidate.name === name);
    if (!definition) {
      return resultFrom([
        makeFailure(
          "tool_call_mismatch",
          `Unsupported tool: ${String(name)}`,
          "error",
          {
            path: "name",
            metadata: {
              allowedTools: definitions.map((candidate) => candidate.name),
              actualName: name,
            },
          },
        ),
      ]);
    }
    return resultFrom(validateToolCall(value, definition));
  },
});

/**
 * Parses a JSON string output and emits `invalid_json` on failure.
 * Use to guard string outputs before running object-level checks.
 */
export const jsonCheck = (): Check<unknown> => ({
  name: "jsonCheck",
  description: "Ensures a string output is valid JSON.",
  run: (value, _context) => {
    if (typeof value !== "string") {
      return resultFrom([
        makeFailure("invalid_json", "Output must be a JSON string.", "error"),
      ]);
    }
    try {
      JSON.parse(value);
      return resultFrom([]);
    } catch (error) {
      return resultFrom([
        makeFailure(
          "invalid_json",
          `Output is not valid JSON: ${error instanceof Error ? error.message : "parse error"}`,
          "error",
        ),
      ]);
    }
  },
});

const getField = (
  value: unknown,
  field: string,
): { ok: true; actual: unknown } | { ok: false; failure: Failure } => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      failure: makeFailure(
        "schema_violation",
        `Field ${field} cannot be checked because the value is not an object.`,
        "error",
      ),
    };
  }
  const actual = (value as Record<string, unknown>)[field];
  if (actual === undefined) {
    return {
      ok: false,
      failure: makeFailure(
        "missing_field",
        `Missing field: ${field}`,
        "error",
        { path: field },
      ),
    };
  }
  return { ok: true, actual };
};

export const nonEmpty = (field: string): Check<Record<string, unknown>> => ({
  name: "nonEmpty",
  description: "Ensures a field is not an empty string, array, or object.",
  run: (value, _context) => {
    const found = getField(value, field);
    if (!found.ok) return resultFrom([found.failure]);
    const { actual } = found;
    const empty =
      actual === null ||
      (typeof actual === "string" && actual.trim() === "") ||
      (Array.isArray(actual) && actual.length === 0) ||
      (typeof actual === "object" &&
        !Array.isArray(actual) &&
        Object.keys(actual as object).length === 0);
    return resultFrom(
      empty
        ? [
            makeFailure(
              "policy_violation",
              `Field ${field} must not be empty.`,
              "error",
              { path: field },
            ),
          ]
        : [],
    );
  },
});

export const regexCheck = (
  field: string,
  pattern: RegExp,
): Check<Record<string, unknown>> => ({
  name: "regexCheck",
  description: "Ensures a string field matches a regular expression.",
  run: (value, _context) => {
    const found = getField(value, field);
    if (!found.ok) return resultFrom([found.failure]);
    const { actual } = found;
    if (typeof actual !== "string") {
      return resultFrom([
        makeFailure(
          "invalid_type",
          `Field ${field} expected type string but received ${typeOf(actual)}.`,
          "error",
          {
            path: field,
          },
        ),
      ]);
    }
    // Reset lastIndex so global/sticky patterns behave deterministically.
    pattern.lastIndex = 0;
    return resultFrom(
      pattern.test(actual)
        ? []
        : [
            makeFailure(
              "policy_violation",
              `Field ${field} does not match ${pattern}.`,
              "error",
              {
                path: field,
                metadata: { pattern: String(pattern) },
              },
            ),
          ],
    );
  },
});

export const rangeCheck = (
  field: string,
  bounds: { min?: number; max?: number },
): Check<Record<string, unknown>> => ({
  name: "rangeCheck",
  description: "Ensures a numeric field falls within optional min/max bounds.",
  run: (value, _context) => {
    const found = getField(value, field);
    if (!found.ok) return resultFrom([found.failure]);
    const { actual } = found;
    if (typeof actual !== "number" || Number.isNaN(actual)) {
      return resultFrom([
        makeFailure(
          "invalid_type",
          `Field ${field} expected type number but received ${typeOf(actual)}.`,
          "error",
          {
            path: field,
          },
        ),
      ]);
    }
    const tooLow = bounds.min !== undefined && actual < bounds.min;
    const tooHigh = bounds.max !== undefined && actual > bounds.max;
    return resultFrom(
      tooLow || tooHigh
        ? [
            makeFailure(
              "policy_violation",
              `Field ${field} must be between ${bounds.min ?? "-∞"} and ${bounds.max ?? "∞"}.`,
              "error",
              { path: field, metadata: { ...bounds, actualValue: actual } },
            ),
          ]
        : [],
    );
  },
});

export const customCheck = <T>(
  name: string,
  fn: (value: T, context: CheckContext) => CheckResult | Promise<CheckResult>,
): Check<T> => ({
  name,
  run: fn,
});
