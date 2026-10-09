import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildChecks } from "./registry.js";
import {
  UsageError,
  loadFixtures,
  parseSeverity,
  runAll,
  runFixture,
  type CaseResult,
  type LoadedFixture,
  type RunSummary,
} from "./runner.js";

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  readStdin: () => Promise<string>;
}

const USAGE = `Usage:
  aieval run <file|dir>... [--fail-on <severity>] [--format text|json]
  aieval check [output.json] --checks <checks.json> [--fail-on <severity>] [--format text|json]
  aieval --help | --version

Commands:
  run     Run fixture files ({ name, output, checks, expected? }) or directories of them.
          With "expected" a case is a regression test; without it, the case passes if validation passes.
  check   Validate one output (file or stdin) against a JSON array of check specs.

Options:
  --fail-on <severity>  info | warning | error | critical (default: error)
  --format <format>     text (default) or json
  -h, --help            Show this help
  -v, --version         Show version

Exit codes: 0 all passed, 1 at least one case failed, 2 usage or input error.
`;

const readVersion = (): string => {
  const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  return (JSON.parse(raw) as { version: string }).version;
};

const formatCase = (result: CaseResult): string[] => {
  const lines = [`${result.passed ? "PASS" : "FAIL"} ${result.name}`];
  if (result.mismatch) {
    lines.push(`  ! ${result.mismatch}`);
  }
  if (!result.passed || result.mismatch) {
    for (const failure of result.evaluation.failures) {
      lines.push(
        `  - ${failure.code}${failure.path ? ` (${failure.path})` : ""}: ${failure.message}`,
      );
    }
  }
  for (const warning of result.evaluation.warnings) {
    lines.push(
      `  ~ ${warning.code}${warning.path ? ` (${warning.path})` : ""}: ${warning.message}`,
    );
  }
  return lines;
};

const formatText = (summary: RunSummary): string => {
  const lines = summary.cases.flatMap(formatCase);
  lines.push(
    "",
    `${summary.total - summary.failed} passed, ${summary.failed} failed, ${summary.total} total`,
  );
  return `${lines.join("\n")}\n`;
};

const formatJson = (summary: RunSummary): string =>
  `${JSON.stringify(
    {
      passed: summary.passed,
      total: summary.total,
      failed: summary.failed,
      cases: summary.cases.map((result) => ({
        file: result.file,
        name: result.name,
        passed: result.passed,
        mismatch: result.mismatch,
        failures: result.evaluation.failures,
        warnings: result.evaluation.warnings,
      })),
    },
    null,
    2,
  )}\n`;

const parseJsonText = (text: string, label: string): unknown => {
  if (!text.trim()) {
    throw new UsageError(`No input provided for ${label}.`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new UsageError(
      `Invalid JSON in ${label}: ${error instanceof Error ? error.message : "parse error"}`,
    );
  }
};

const readFileText = (path: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new UsageError(`Cannot read file: ${path}`);
  }
};

/** Runs the CLI in-process and returns the exit code. */
export const runCli = async (argv: string[], io: CliIO): Promise<number> => {
  try {
    let parsed;
    try {
      parsed = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
          "fail-on": { type: "string" },
          format: { type: "string", default: "text" },
          checks: { type: "string" },
          help: { type: "boolean", short: "h" },
          version: { type: "boolean", short: "v" },
        },
      });
    } catch (error) {
      throw new UsageError(
        error instanceof Error ? error.message : String(error),
      );
    }

    const { values, positionals } = parsed;

    if (values.help || (positionals.length === 0 && !values.version)) {
      (values.help ? io.stdout : io.stderr)(USAGE);
      return values.help ? 0 : 2;
    }
    if (values.version) {
      io.stdout(`${readVersion()}\n`);
      return 0;
    }

    const format = values.format;
    if (format !== "text" && format !== "json") {
      throw new UsageError(
        `Invalid format "${String(format)}". Expected text or json.`,
      );
    }
    const failOn =
      values["fail-on"] !== undefined
        ? parseSeverity(values["fail-on"])
        : undefined;

    const [command, ...rest] = positionals;
    let summary: RunSummary;

    if (command === "run") {
      if (rest.length === 0) {
        throw new UsageError("`run` needs at least one file or directory.");
      }
      const loaded = loadFixtures(rest);
      if (loaded.length === 0) {
        throw new UsageError("No fixtures found.");
      }
      summary = await runAll(loaded, { failOn });
    } else if (command === "check") {
      if (!values.checks) {
        throw new UsageError("`check` requires --checks <checks.json>.");
      }
      if (rest.length > 1) {
        throw new UsageError("`check` accepts at most one output file.");
      }
      const specs = parseJsonText(readFileText(values.checks), values.checks);
      try {
        buildChecks(specs);
      } catch (error) {
        throw new UsageError(
          `${values.checks}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const label = rest[0] ?? "stdin";
      const output = parseJsonText(
        rest[0] ? readFileText(rest[0]) : await io.readStdin(),
        label,
      );
      const loaded: LoadedFixture = {
        file: label,
        index: 0,
        fixture: { name: label, output, checks: specs as unknown[] },
      };
      const result = await runFixture(loaded, { failOn });
      summary = {
        passed: result.passed,
        total: 1,
        failed: result.passed ? 0 : 1,
        cases: [result],
      };
    } else {
      throw new UsageError(`Unknown command "${command}".`);
    }

    io.stdout(format === "json" ? formatJson(summary) : formatText(summary));
    return summary.passed ? 0 : 1;
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${error.message}\n\n${USAGE}`);
      return 2;
    }
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
};
