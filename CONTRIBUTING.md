# Contributing

Thanks for contributing to `aieval`. By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development

Requires Node.js 20+.

```bash
npm install
npm test            # run the test suite
npm run ci          # lint, format check, typecheck, build, tests with coverage
npm run format      # auto-format with Prettier
```

`npm run ci` is exactly what the CI workflow runs; please make sure it passes before opening a PR.

## Adding a check

1. Add a factory to [`src/checks.ts`](src/checks.ts) that returns a `Check`. Return structured `Failure`s with a
   sensible `code`, `severity` and `path`.
2. If the check is JSON-describable, add a `CheckSpec` variant and a `case` in [`src/registry.ts`](src/registry.ts)
   so it works in fixtures and the CLI. Checks that need functions or schemas (like `schemaCheck`) stay code-only.
3. Add unit tests in `test/`, covering both passing and failing paths.
4. Add a golden fixture in `test/fixtures/` when the check detects a known failure mode.
5. Document it in the README check table and add a line under `Unreleased` in the [CHANGELOG](CHANGELOG.md).

## Pull requests

Please keep PRs focused and reviewable. Small, targeted changes are preferred.

## Code standards

- TypeScript-first, strict mode
- keep runtime dependencies minimal (the library currently has none besides the `zod` peer)
- deterministic checks first; anything that calls a model must stay optional and behind an interface
- add tests for new behavior and keep coverage above the configured threshold
- document any new API surface

## Out of scope

To keep the project small, we are not building a hosted dashboard, a dataset management platform, or a general
agent framework. See [PROJECT_DISCOVERY.md](PROJECT_DISCOVERY.md) for the reasoning.
