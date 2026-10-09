# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0]

First release.

### Added

- Core API: `evaluate`, `validate`, `assert`, and the `Check`, `Failure`, `Severity` and `EvaluationResult` model.
- Severity-based routing with a `failOn` threshold (default `"error"`); lower severities are reported as warnings.
- Checks: `schemaCheck` (Zod), `requiredFields`, `noExtraFields`, `enumCheck`, `fieldTypeCheck`, `jsonCheck`,
  `nonEmpty`, `regexCheck`, `rangeCheck`, `toolCallCheck`, `toolCallCheck.oneOf`, `customCheck`.
- Tool-call validation for `{ name, args }` and OpenAI-style `{ name, arguments: "<json>" }` calls.
- Optional semantic judging: `semanticCheck`, the `SemanticJudge` interface and `mockJudge`.
- JSON check registry (`buildChecks`) and fixture runner (`loadFixtures`, `runFixture`, `runAll`).
- CLI: `aieval run` and `aieval check`, with `--fail-on`, `--format text|json` and stable exit codes.
- Per-check metadata in `result.metadata.checks` and `durationMs`.
- `EvaluationError` thrown by `assert`, carrying the full result.
- Checks that throw are converted to `critical` failures instead of crashing the run.

[Unreleased]: https://github.com/hamza1331/aieval/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hamza1331/aieval/releases/tag/v0.1.0
