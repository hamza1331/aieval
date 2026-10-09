# Examples

Runnable with [`tsx`](https://github.com/privatenumber/tsx) from the repository root. They import from `../src`, so in
your own project import from `"@hamza1331/aieval"` instead.

| File                                         | Shows                                                                |
| -------------------------------------------- | -------------------------------------------------------------------- |
| [`basic-validation.ts`](basic-validation.ts) | Zod schema + required fields + severity routing                      |
| [`tool-call.ts`](tool-call.ts)               | Rejecting unsupported or malformed agent tool calls before execution |
| [`retry-loop.ts`](retry-loop.ts)             | Validate, feed failures back to the model, retry                     |
| [`semantic-judge.ts`](semantic-judge.ts)     | Optional LLM-judged scoring (offline, with a mock judge)             |
| [`openai-judge.ts`](openai-judge.ts)         | A real judge using `fetch`; needs `OPENAI_API_KEY` and costs money   |
| [`fixtures/`](fixtures)                      | Fixture files for the CLI                                            |

```bash
npx tsx examples/basic-validation.ts
npx tsx examples/tool-call.ts
npx tsx examples/retry-loop.ts
npx tsx examples/semantic-judge.ts

# CLI fixture runner (after `npm run build`)
node dist/cli.js run examples/fixtures
```
