import {
  evaluate,
  jsonCheck,
  requiredFields,
  type Failure,
} from "../src/index.js";

// A deliberately flaky "model": returns broken output first, then a valid answer.
const fakeModel = async (prompt: string): Promise<string> =>
  prompt.includes("Fix these problems")
    ? '{"answer":"42","confidence":0.9}'
    : "{answer: 42";

const MAX_ATTEMPTS = 3;
let prompt = "Reply with JSON containing answer and confidence.";

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const raw = await fakeModel(prompt);

  // Deterministic checks first: parse, then validate structure. No extra LLM call needed.
  const parsed = await evaluate({ output: raw, checks: [jsonCheck()] });
  let failures: Failure[] = parsed.failures;

  if (parsed.passed) {
    const structured = await evaluate({
      output: JSON.parse(raw) as Record<string, unknown>,
      checks: [requiredFields(["answer", "confidence"])],
    });
    failures = structured.failures;
  }

  if (failures.length === 0) {
    console.log(`attempt ${attempt}: accepted ->`, raw);
    break;
  }

  console.log(
    `attempt ${attempt}: rejected (${failures.map((f) => f.code).join(", ")})`,
  );
  // Feed machine-readable failures back to the model for a repair attempt.
  prompt = `Fix these problems: ${failures.map((f) => f.message).join("; ")}`;
}
