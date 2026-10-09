import { evaluate, toolCallCheck } from "../src/index.js";

// Allow only the tools your agent is permitted to call, with a contract for each.
const toolCheck = toolCallCheck.oneOf([
  {
    name: "get_weather",
    requiredArgs: ["city"],
    argTypes: { city: "string", unit: "string" },
  },
  {
    name: "get_time",
    requiredArgs: ["timezone"],
    argTypes: { timezone: "string" },
  },
]);

const calls = [
  { name: "get_weather", args: { city: "London", unit: "celsius" } },
  // OpenAI-style: arguments arrive as a JSON string.
  { name: "get_time", arguments: '{"timezone":"Europe/London"}' },
  { name: "get_weather", args: { city: 42 } },
  { name: "delete_database", args: {} },
];

for (const call of calls) {
  const result = await evaluate({ output: call, checks: [toolCheck] });
  console.log(
    `${call.name}: ${result.passed ? "OK, safe to execute" : "REJECTED"}`,
  );
  for (const failure of result.failures) {
    console.log(`  ${failure.code}: ${failure.message}`);
  }
}
