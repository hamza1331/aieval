import { z } from "zod";
import {
  evaluate,
  noExtraFields,
  requiredFields,
  schemaCheck,
} from "../src/index.js";

// A typical structured LLM output: validate it before your code trusts it.
const schema = z.object({
  name: z.string(),
  email: z.string().email(),
});

const modelOutput = {
  name: "Ada Lovelace",
  email: "not-an-email",
  plan: "pro",
};

const result = await evaluate({
  output: modelOutput,
  checks: [
    schemaCheck(schema),
    requiredFields(["name", "email"]),
    // Severity decides what fails: "warning" is reported but does not fail the run (unless failOn: "warning").
    noExtraFields(["name", "email"], { severity: "warning" }),
  ],
});

console.log("passed:", result.passed);
for (const failure of result.failures) {
  console.log(
    `  [${failure.severity}] ${failure.code} ${failure.path ?? ""}: ${failure.message}`,
  );
}
for (const warning of result.warnings) {
  console.log(
    `  (warning) ${warning.code} ${warning.path ?? ""}: ${warning.message}`,
  );
}
