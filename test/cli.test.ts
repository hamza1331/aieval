import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../src/cliMain.js";

const root = join(import.meta.dirname, "..");
const fixturesDir = join(import.meta.dirname, "fixtures");
let tmp: string;

const run = async (argv: string[], stdin = "") => {
  let stdout = "";
  let stderr = "";
  const code = await runCli(argv, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    readStdin: async () => stdin,
  });
  return { code, stdout, stderr };
};

const write = (name: string, data: unknown): string => {
  const file = join(tmp, name);
  writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
  return file;
};

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "aieval-cli-"));
});

describe("aieval run", () => {
  it("passes on the golden fixtures directory", async () => {
    const { code, stdout } = await run(["run", fixturesDir]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/15 passed, 0 failed, 15 total/);
  });

  it("exits 1 when a case fails and lists failures", async () => {
    const file = write("fail.json", {
      name: "missing",
      output: {},
      checks: [{ type: "requiredFields", fields: ["a"] }],
    });
    const { code, stdout } = await run(["run", file]);
    expect(code).toBe(1);
    expect(stdout).toContain("FAIL missing");
    expect(stdout).toContain("missing_field (a)");
    expect(stdout).toMatch(/0 passed, 1 failed, 1 total/);
  });

  it("shows regression mismatches", async () => {
    const file = write("mismatch.json", {
      name: "m",
      output: {},
      checks: [],
      expected: { passed: false },
    });
    const { code, stdout } = await run(["run", file]);
    expect(code).toBe(1);
    expect(stdout).toContain("! expected passed=false");
  });

  it("prints warnings for passing cases", async () => {
    const file = write("warn.json", {
      name: "w",
      output: { b: 1 },
      checks: [{ type: "noExtraFields", allowed: ["a"], severity: "warning" }],
    });
    const { code, stdout } = await run(["run", file]);
    expect(code).toBe(0);
    expect(stdout).toContain("~ schema_violation (b)");
  });

  it("--fail-on warning makes warnings fail", async () => {
    const file = write("warn2.json", {
      name: "w2",
      output: { b: 1 },
      checks: [{ type: "noExtraFields", allowed: ["a"], severity: "warning" }],
    });
    expect((await run(["run", file, "--fail-on", "warning"])).code).toBe(1);
  });

  it("emits machine-readable JSON with --format json", async () => {
    const file = write("json.json", {
      name: "j",
      output: {},
      checks: [{ type: "requiredFields", fields: ["a"] }],
    });
    const { code, stdout } = await run(["run", file, "--format", "json"]);
    const parsed = JSON.parse(stdout);
    expect(code).toBe(1);
    expect(parsed).toMatchObject({ passed: false, total: 1, failed: 1 });
    expect(parsed.cases[0].failures[0].code).toBe("missing_field");
  });
});

describe("aieval check", () => {
  const checks = [{ type: "requiredFields", fields: ["name"] }];

  it("validates an output file", async () => {
    const checksFile = write("checks.json", checks);
    const ok = await run([
      "check",
      write("out-ok.json", { name: "Ada" }),
      "--checks",
      checksFile,
    ]);
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain("PASS");
    const bad = await run([
      "check",
      write("out-bad.json", {}),
      "--checks",
      checksFile,
    ]);
    expect(bad.code).toBe(1);
  });

  it("reads the output from stdin", async () => {
    const checksFile = write("checks2.json", checks);
    const ok = await run(["check", "--checks", checksFile], '{"name":"Ada"}');
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain("PASS stdin");
  });

  it("reports usage errors", async () => {
    const checksFile = write("checks3.json", checks);
    expect((await run(["check", "--checks", checksFile], "")).code).toBe(2);
    expect(
      (await run(["check", "--checks", checksFile], "{bad")).stderr,
    ).toContain("Invalid JSON");
    expect((await run(["check"], "{}")).stderr).toContain("--checks");
    expect(
      (await run(["check", "a.json", "b.json", "--checks", checksFile])).stderr,
    ).toContain("at most one");
    expect(
      (await run(["check", "--checks", join(tmp, "missing.json")], "{}"))
        .stderr,
    ).toContain("Cannot read file");
    expect(
      (
        await run(
          ["check", "--checks", write("badspec.json", [{ type: "x" }])],
          "{}",
        )
      ).stderr,
    ).toContain("unknown check type");
  });
});

describe("usage and errors", () => {
  it("prints help with exit 0", async () => {
    const { code, stdout } = await run(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Usage:");
  });

  it("prints the version", async () => {
    const { code, stdout } = await run(["--version"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("shows usage with exit 2 when no command is given", async () => {
    const { code, stderr } = await run([]);
    expect(code).toBe(2);
    expect(stderr).toContain("Usage:");
  });

  it("rejects bad input with exit 2", async () => {
    expect((await run(["bogus"])).code).toBe(2);
    expect((await run(["run"])).stderr).toContain("at least one");
    expect((await run(["run", join(tmp, "nope.json")])).code).toBe(2);
    expect((await run(["run", tmp + "/does-not-exist"])).code).toBe(2);
    expect(
      (await run(["run", fixturesDir, "--format", "xml"])).stderr,
    ).toContain("Invalid format");
    expect(
      (await run(["run", fixturesDir, "--fail-on", "loud"])).stderr,
    ).toContain("Invalid severity");
    expect((await run(["run", fixturesDir, "--nope"])).code).toBe(2);
  });

  it("errors when a directory has no fixtures", async () => {
    const empty = mkdtempSync(join(tmpdir(), "aieval-empty-"));
    const { code, stderr } = await run(["run", empty]);
    expect(code).toBe(2);
    expect(stderr).toContain("No fixtures found");
  });
});

describe("built binary", () => {
  beforeAll(() => {
    execFileSync("npm", ["run", "build"], { cwd: root, stdio: "ignore" });
  }, 60_000);

  it("runs end-to-end with correct exit codes", () => {
    const ok = spawnSync("node", ["dist/cli.js", "run", fixturesDir], {
      cwd: root,
      encoding: "utf8",
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("15 passed");

    const stdin = spawnSync(
      "node",
      [
        "dist/cli.js",
        "check",
        "--checks",
        write("bin-checks.json", [{ type: "requiredFields", fields: ["a"] }]),
      ],
      {
        cwd: root,
        encoding: "utf8",
        input: "{}",
      },
    );
    expect(stdin.status).toBe(1);
    expect(stdin.stdout).toContain("FAIL stdin");

    expect(spawnSync("node", ["dist/cli.js"], { cwd: root }).status).toBe(2);
  });
});
