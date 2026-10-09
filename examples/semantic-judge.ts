import {
  evaluate,
  mockJudge,
  requiredFields,
  semanticCheck,
} from "../src/index.js";

// Runs offline: mockJudge stands in for a real LLM judge (see openai-judge.ts for a real one).
const judge = mockJudge(({ output }) =>
  String((output as { answer: string }).answer).includes("Paris") ? 0.95 : 0.2,
);

const result = await evaluate({
  input: "What is the capital of France?",
  output: { answer: "The capital of France is Lyon." },
  checks: [
    // Deterministic checks decide pass/fail...
    requiredFields(["answer"]),
    // ...the semantic score is advisory by default (warning severity).
    semanticCheck(judge, {
      criteria: "The answer is factually correct",
      threshold: 0.7,
      name: "factuality",
    }),
  ],
});

console.log("passed:", result.passed); // true: semantic issues are warnings by default
console.log(
  "warnings:",
  result.warnings.map((w) => w.message),
);
console.log(
  "score:",
  (result.metadata?.checks as Record<string, { score: number }>).factuality
    .score,
);

// Opt in to strict mode to make low semantic scores fail the run.
const strict = await evaluate({
  input: "What is the capital of France?",
  output: { answer: "The capital of France is Lyon." },
  checks: [
    semanticCheck(judge, {
      criteria: "The answer is factually correct",
      threshold: 0.7,
    }),
  ],
  failOn: "warning",
});
console.log("strict passed:", strict.passed); // false
