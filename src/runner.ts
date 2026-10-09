import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluate } from "./index.js";
import { buildChecks } from "./registry.js";
import type { EvaluationResult, Severity } from "./types.js";

/** Thrown for problems with how the runner was invoked or with fixture contents. Maps to CLI exit code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export interface FixtureExpectation {
  passed: boolean;
  codes?: string[];
  warningCodes?: string[];
}

export interface Fixture {
  name?: string;
  output: unknown;
  checks: unknown[];
  failOn?: Severity;
  /** When present the case is a regression test: the evaluation must match this expectation. */
  expected?: FixtureExpectation;
}

export interface LoadedFixture {
  file: string;
  index: number;
  fixture: Fixture;
}

export interface CaseResult {
  file: string;
  name: string;
  /** Whether the case itself succeeded (matched `expected`, or the evaluation passed when no `expected`). */
  passed: boolean;
  evaluation: EvaluationResult;
  mismatch?: string;
}

export interface RunSummary {
  passed: boolean;
  total: number;
  failed: number;
  cases: CaseResult[];
}

const SEVERITIES: Severity[] = ["info", "warning", "error", "critical"];

export const parseSeverity = (value: string): Severity => {
  if (!SEVERITIES.includes(value as Severity)) {
    throw new UsageError(
      `Invalid severity "${value}". Expected one of: ${SEVERITIES.join(", ")}.`,
    );
  }
  return value as Severity;
};

const readJson = (file: string): unknown => {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new UsageError(`Cannot read file: ${file}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new UsageError(
      `Invalid JSON in ${file}: ${error instanceof Error ? error.message : "parse error"}`,
    );
  }
};

const validateFixture = (
  value: unknown,
  file: string,
  index: number,
): Fixture => {
  const where = `${file}${index > 0 ? ` (case ${index + 1})` : ""}`;
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new UsageError(`Fixture in ${where} must be an object.`);
  }
  const candidate = value as Record<string, unknown>;
  if (!("output" in candidate)) {
    throw new UsageError(`Fixture in ${where} is missing "output".`);
  }
  if (!Array.isArray(candidate.checks)) {
    throw new UsageError(`Fixture in ${where} must have a "checks" array.`);
  }
  if (candidate.failOn !== undefined) {
    parseSeverity(String(candidate.failOn));
  }
  if (candidate.expected !== undefined) {
    const expected = candidate.expected as Record<string, unknown> | null;
    if (
      expected == null ||
      typeof expected !== "object" ||
      typeof expected.passed !== "boolean"
    ) {
      throw new UsageError(
        `Fixture in ${where} has an invalid "expected" (needs a boolean "passed").`,
      );
    }
  }
  return candidate as unknown as Fixture;
};

/** Loads fixtures from files and/or directories. Directories are scanned non-recursively for `*.json`. */
export const loadFixtures = (paths: string[]): LoadedFixture[] => {
  const files: string[] = [];
  for (const path of paths) {
    const absolute = resolve(path);
    let stats;
    try {
      stats = statSync(absolute);
    } catch {
      throw new UsageError(`Path not found: ${path}`);
    }
    if (stats.isDirectory()) {
      const entries = readdirSync(absolute)
        .filter((entry) => entry.endsWith(".json"))
        .sort()
        .map((entry) => join(absolute, entry));
      files.push(...entries);
    } else {
      files.push(absolute);
    }
  }

  const loaded: LoadedFixture[] = [];
  for (const file of files) {
    const data = readJson(file);
    const items = Array.isArray(data) ? data : [data];
    items.forEach((item, index) => {
      loaded.push({ file, index, fixture: validateFixture(item, file, index) });
    });
  }
  return loaded;
};

const sameCodes = (actual: string[], expected: string[]): boolean =>
  JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());

/** Runs a single fixture. `failOn` (if given) overrides the fixture's own value. */
export const runFixture = async (
  loaded: LoadedFixture,
  options: { failOn?: Severity } = {},
): Promise<CaseResult> => {
  const { fixture, file, index } = loaded;
  const name = fixture.name ?? `${file}${index > 0 ? `#${index + 1}` : ""}`;

  let checks;
  try {
    checks = buildChecks(fixture.checks);
  } catch (error) {
    throw new UsageError(
      `${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const evaluation = await evaluate({
    output: fixture.output,
    checks,
    failOn: options.failOn ?? fixture.failOn,
  });

  if (!fixture.expected) {
    return { file, name, passed: evaluation.passed, evaluation };
  }

  const { expected } = fixture;
  const problems: string[] = [];
  if (evaluation.passed !== expected.passed) {
    problems.push(
      `expected passed=${expected.passed} but got passed=${evaluation.passed}`,
    );
  }
  const actualCodes = evaluation.failures.map((failure) => failure.code);
  const expectedCodes = expected.codes ?? [];
  if (!sameCodes(actualCodes, expectedCodes)) {
    problems.push(
      `expected failure codes [${expectedCodes.join(", ")}] but got [${actualCodes.join(", ")}]`,
    );
  }
  if (expected.warningCodes) {
    const actualWarnings = evaluation.warnings.map((warning) => warning.code);
    if (!sameCodes(actualWarnings, expected.warningCodes)) {
      problems.push(
        `expected warning codes [${expected.warningCodes.join(", ")}] but got [${actualWarnings.join(", ")}]`,
      );
    }
  }

  return {
    file,
    name,
    passed: problems.length === 0,
    evaluation,
    mismatch: problems.length > 0 ? problems.join("; ") : undefined,
  };
};

export const runAll = async (
  loaded: LoadedFixture[],
  options: { failOn?: Severity } = {},
): Promise<RunSummary> => {
  const cases: CaseResult[] = [];
  for (const item of loaded) {
    cases.push(await runFixture(item, options));
  }
  const failed = cases.filter((result) => !result.passed).length;
  return { passed: failed === 0, total: cases.length, failed, cases };
};
