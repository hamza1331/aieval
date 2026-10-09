import { evaluate, semanticCheck, type SemanticJudge } from "../src/index.js";

/**
 * A SemanticJudge backed by the OpenAI Chat Completions API using plain `fetch` (no SDK).
 * This is an example, not part of the package. Requires OPENAI_API_KEY; making real requests costs money.
 */
const openAiJudge =
  (model = "gpt-4o-mini"): SemanticJudge =>
  async ({ input, output, criteria }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You grade an AI output against criteria. Reply with JSON: {"score": <number 0..1>, "reasoning": "<one sentence>"}.',
          },
          {
            role: "user",
            content: JSON.stringify({ criteria, input, output }),
          },
        ],
      }),
    });

    if (!response.ok)
      throw new Error(
        `OpenAI request failed: ${response.status} ${await response.text()}`,
      );

    const body = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const verdict = JSON.parse(body.choices[0].message.content) as {
      score: number;
      reasoning?: string;
    };
    return {
      score: verdict.score,
      reasoning: verdict.reasoning,
      metadata: { model },
    };
  };

const result = await evaluate({
  input: "Summarise our refund policy in one sentence.",
  output: { summary: "Refunds are available within 30 days of purchase." },
  checks: [
    semanticCheck(openAiJudge(), {
      criteria: "The summary is concise and mentions the time limit",
    }),
  ],
});

console.log(result.passed, result.warnings, result.metadata?.checks);
