# aieval

[![CI](https://github.com/hamza1331/aieval/actions/workflows/ci.yml/badge.svg)](https://github.com/hamza1331/aieval/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hamza1331/aieval.svg)](https://www.npmjs.com/package/@hamza1331/aieval)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

TypeScript-first, deterministic-first validation for LLM outputs and agent tool calls.

Catch the failures you can detect with code — malformed JSON, missing fields, enum drift, bad tool-call arguments,
policy violations — **before** you spend time and money on LLM-as-a-judge scoring. Failures are structured and
machine-readable, so they are easy to log, assert on, or feed back to a model for a retry.

- Small and composable: plain functions, no framework, no hosted service
- Strong typing and no runtime dependencies (`zod` is a peer dependency, used by `schemaCheck`)
- A fixture-driven CLI for local checks and CI
- Optional, clearly-labelled semantic (LLM) judging behind a provider-agnostic interface

## Install

```bash
npm install @hamza1331/aieval zod
```

Requires Node.js 20+. `zod` (v4) is a peer dependency used by `schemaCheck`.

## Quick start

```ts
import { z } from "zod";
import { evaluate, requiredFields, schemaCheck } from "@hamza1331/aieval";

const schema = z.object({ name: z.string(), email: z.string() });

const result = await evaluate({
  output: { name: "Ada Lovelace", email: "ada@example.com" },
  checks: [schemaCheck(schema), requiredFields(["name", "email"])],
});

console.log(result.passed); // true
console.log(result.failures); // []
```

Other entry points:

```ts
import { assert, validate } from "@hamza1331/aieval";

const result = await validate(output, checks); // same as evaluate({ output, checks })
await assert(output, checks); // throws EvaluationError (with `.result`) if validation fails
```

## Results and severity

Every issue is a `Failure`:

```ts
interface Failure {
  code: FailureCode; // "missing_field" | "invalid_type" | "invalid_enum" | "schema_violation" | "invalid_json" | ...
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  path?: string; // e.g. "user.age" or "args.city"
  metadata?: Record<string, unknown>; // always includes `checkName`
  suggestedRepair?: string;
}
```

**Severity decides what fails.** Issues at or above `failOn` (default `"error"`) go to `result.failures` and make
`result.passed` false. Lower-severity issues go to `result.warnings` and do not fail the run.

```ts
await evaluate({ output, checks }); // warnings are reported, run still passes
await evaluate({ output, checks, failOn: "warning" }); // strict mode: warnings fail the run
```

If a check throws, `evaluate` records a `critical` failure and keeps going. `result.metadata` carries `durationMs`
and, for checks that report data (like semantic scores), `checks[checkName]`.

## Built-in checks

| Check                                   | What it verifies                                           | Failure code(s)                            |
| --------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `schemaCheck(zodSchema)`                | Output matches a Zod schema                                | `schema_violation`                         |
| `requiredFields(fields)`                | Object has the given keys                                  | `missing_field`                            |
| `noExtraFields(allowed, { severity? })` | No keys outside the allowed set (default severity `error`) | `schema_violation`                         |
| `enumCheck(field, values)`              | Field is one of the allowed values                         | `invalid_enum`, `missing_field`            |
| `fieldTypeCheck(field, type)`           | Field has the runtime type                                 | `invalid_type`                             |
| `jsonCheck()`                           | String output parses as JSON                               | `invalid_json`                             |
| `nonEmpty(field)`                       | Field is not blank/empty                                   | `policy_violation`, `missing_field`        |
| `regexCheck(field, pattern)`            | String field matches a regex                               | `policy_violation`, `invalid_type`         |
| `rangeCheck(field, { min?, max? })`     | Number within bounds                                       | `policy_violation`, `invalid_type`         |
| `toolCallCheck(definition)`             | Tool call matches a contract                               | `tool_call_mismatch`, `missing_field`, ... |
| `toolCallCheck.oneOf(definitions)`      | Tool call matches one of several allowed tools             | `tool_call_mismatch`, ...                  |
| `semanticCheck(judge, options)`         | Optional LLM-judged score (advisory by default)            | `unsupported_claim`                        |
| `customCheck(name, fn)`                 | Your own sync or async logic                               | anything                                   |

### Tool-call validation

Validate a model's tool call before executing it. A call is `{ name, args }`, or `{ name, arguments: "<json string>" }`
as returned by OpenAI-style APIs.

```ts
import { evaluate, toolCallCheck } from "@hamza1331/aieval";

const result = await evaluate({
  output: { name: "get_weather", args: { city: "London", unit: "celsius" } },
  checks: [
    toolCallCheck({
      name: "get_weather",
      requiredArgs: ["city"],
      allowedArgs: ["city", "unit"],
      argTypes: { city: "string", unit: "string" },
    }),
  ],
});
```

Unknown arguments are errors unless you set `allowExtraArgs: true`. To allow several tools and reject everything
else, use `toolCallCheck.oneOf([...definitions])`.

### Custom checks

```ts
import { customCheck } from "@hamza1331/aieval";

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
```

## Optional: semantic judging

Deterministic checks cover what code can verify. For subjective quality you can plug in an LLM judge — a plain
function you provide, so `aieval` has no provider SDK or network dependency.

```ts
import { evaluate, semanticCheck, type SemanticJudge } from "@hamza1331/aieval";

const judge: SemanticJudge = async ({ input, output, criteria }) => {
  // call your model here and return { score: 0..1, reasoning? }
  return { score: 0.9, reasoning: "Grounded in the context." };
};

const result = await evaluate({
  input: question,
  output: answer,
  checks: [
    semanticCheck(judge, {
      criteria: "The answer is grounded in the context",
      threshold: 0.7,
    }),
  ],
});
```

Semantic scores are **advisory by default**: a low score is a `warning`, not a failure. Raise `severity` or use
`failOn: "warning"` to enforce them. Scores appear in `result.metadata.checks`. Use `mockJudge` in tests. See
[`examples/openai-judge.ts`](examples/openai-judge.ts) for a real provider via `fetch`.

## CLI

```bash
# Run fixture files or directories of them
aieval run examples/fixtures
aieval run fixtures/ --fail-on warning --format json

# Validate one output (file or stdin) against a list of check specs
echo '{"name":"Ada"}' | aieval check --checks checks.json
```

A fixture is JSON (a single object or an array):

```json
{
  "name": "model invented a priority",
  "output": { "title": "Login fails", "priority": "urgent" },
  "checks": [
    { "type": "enum", "field": "priority", "values": ["low", "medium", "high"] }
  ],
  "expected": { "passed": false, "codes": ["invalid_enum"] }
}
```

- With `expected`, the case is a **regression test**: the result must match. Without it, the case passes if validation
  passes.
- Check types: `requiredFields`, `noExtraFields`, `enum`, `fieldType`, `toolCall`, `toolCallOneOf`, `json`,
  `nonEmpty`, `regex`, `range`. (`schemaCheck` and `semanticCheck` are code-only.)
- Exit codes: `0` all passed, `1` at least one case failed, `2` usage or input error.

The same machinery is available programmatically: `buildChecks`, `loadFixtures`, `runFixture`, `runAll`.

## Design principles

- Fail fast on what you can check deterministically; keep LLM evaluation optional and separate.
- Make failures explainable and machine-readable.
- Stay small: no dashboard, hosted service, agent framework or dataset platform.

See [`PROJECT_DISCOVERY.md`](PROJECT_DISCOVERY.md) for the research and rationale.

## Roadmap

- Repair and retry strategy helpers
- Adapter packages for OpenAI and LangChain (only if there is demand)
- Trace metadata export (OpenTelemetry / Langfuse)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
