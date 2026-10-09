import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  UsageError,
  loadFixtures,
  parseSeverity,
  runAll,
  runFixture,
} from "../src/index.js";

let dir: string;

const write = (name: string, data: unknown): string => {
  const file = join(dir, name);
  writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
  return file;
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "aieval-runner-"));
});

describe("loadFixtures", () => {
  it("loads single and array fixture files", () => {
    const single = write("single.json", { output: {}, checks: [] });
    const many = write("many.json", [
      { name: "a", output: {}, checks: [] },
      { name: "b", output: {}, checks: [] },
    ]);
    const loaded = loadFixtures([single, many]);
    expect(loaded).toHaveLength(3);
    expect(loaded[2].index).toBe(1);
  });

  it("loads a directory sorted and non-recursive, ignoring non-json", () => {
    const sub = join(dir, "sub");
    mkdirSync(join(sub, "nested"), { recursive: true });
    writeFileSync(
      join(sub, "b.json"),
      JSON.stringify({ name: "b", output: 1, checks: [] }),
    );
    writeFileSync(
      join(sub, "a.json"),
      JSON.stringify({ name: "a", output: 1, checks: [] }),
    );
    writeFileSync(join(sub, "notes.txt"), "ignore me");
    writeFileSync(
      join(sub, "nested", "c.json"),
      JSON.stringify({ name: "c", output: 1, checks: [] }),
    );
    expect(loadFixtures([sub]).map((l) => l.fixture.name)).toEqual(["a", "b"]);
  });

  it("rejects missing paths, unreadable JSON and malformed fixtures", () => {
    expect(() => loadFixtures([join(dir, "nope.json")])).toThrow(
      /Path not found/,
    );
    expect(() => loadFixtures([write("bad.json", "{oops")])).toThrow(
      /Invalid JSON/,
    );
    expect(() => loadFixtures([write("str.json", '"x"')])).toThrow(
      /must be an object/,
    );
    expect(() => loadFixtures([write("noout.json", { checks: [] })])).toThrow(
      /missing "output"/,
    );
    expect(() => loadFixtures([write("nochecks.json", { output: 1 })])).toThrow(
      /"checks" array/,
    );
    expect(() =>
      loadFixtures([
        write("badfail.json", { output: 1, checks: [], failOn: "loud" }),
      ]),
    ).toThrow(UsageError);
    expect(() =>
      loadFixtures([
        write("badexp.json", { output: 1, checks: [], expected: {} }),
      ]),
    ).toThrow(/invalid "expected"/);
    expect(() =>
      loadFixtures([
        write("badexp2.json", { output: 1, checks: [], expected: null }),
      ]),
    ).toThrow(/invalid "expected"/);
    expect(() =>
      loadFixtures([write("badcase.json", [{ output: 1, checks: [] }, 5])]),
    ).toThrow(/case 2/);
  });

  it("reports unreadable files", () => {
    // A directory entry named *.json that is itself a directory cannot be read as a file.
    const weird = join(dir, "weird");
    mkdirSync(join(weird, "x.json"), { recursive: true });
    expect(() => loadFixtures([weird])).toThrow(/Cannot read file/);
  });
});

describe("runFixture / runAll", () => {
  const load = (fixture: object) =>
    loadFixtures([write(`f-${Math.random()}.json`, fixture)])[0];

  it("validation mode passes or fails with the evaluation", async () => {
    const ok = await runFixture(
      load({
        name: "ok",
        output: { a: 1 },
        checks: [{ type: "requiredFields", fields: ["a"] }],
      }),
    );
    const bad = await runFixture(
      load({
        name: "bad",
        output: {},
        checks: [{ type: "requiredFields", fields: ["a"] }],
      }),
    );
    expect(ok.passed).toBe(true);
    expect(bad.passed).toBe(false);
    expect(bad.mismatch).toBeUndefined();
  });

  it("regression mode compares against expected", async () => {
    const matching = await runFixture(
      load({
        output: {},
        checks: [{ type: "requiredFields", fields: ["a"] }],
        expected: { passed: false, codes: ["missing_field"] },
      }),
    );
    expect(matching.passed).toBe(true);

    const wrong = await runFixture(
      load({
        output: {},
        checks: [{ type: "requiredFields", fields: ["a"] }],
        expected: { passed: true },
      }),
    );
    expect(wrong.passed).toBe(false);
    expect(wrong.mismatch).toMatch(/passed=true/);
    expect(wrong.mismatch).toMatch(/failure codes/);
  });

  it("checks expected warning codes", async () => {
    const spec = [
      { type: "noExtraFields", allowed: ["a"], severity: "warning" },
    ];
    const ok = await runFixture(
      load({
        output: { b: 1 },
        checks: spec,
        expected: { passed: true, warningCodes: ["schema_violation"] },
      }),
    );
    expect(ok.passed).toBe(true);
    const bad = await runFixture(
      load({
        output: { b: 1 },
        checks: spec,
        expected: { passed: true, warningCodes: [] },
      }),
    );
    expect(bad.mismatch).toMatch(/warning codes/);
  });

  it("option failOn overrides the fixture's failOn", async () => {
    const fixture = load({
      output: { b: 1 },
      failOn: "critical",
      checks: [{ type: "noExtraFields", allowed: ["a"] }],
    });
    expect((await runFixture(fixture)).passed).toBe(true);
    expect((await runFixture(fixture, { failOn: "error" })).passed).toBe(false);
  });

  it("uses a derived name when none is given", async () => {
    const result = await runFixture(load({ output: {}, checks: [] }));
    expect(result.name).toMatch(/f-.*\.json$/);
  });

  it("wraps bad check specs in UsageError", async () => {
    await expect(
      runFixture(load({ output: {}, checks: [{ type: "bogus" }] })),
    ).rejects.toBeInstanceOf(UsageError);
  });

  it("runAll summarises results", async () => {
    const loaded = [
      load({ name: "p", output: {}, checks: [] }),
      load({
        name: "f",
        output: {},
        checks: [{ type: "requiredFields", fields: ["a"] }],
      }),
    ];
    const summary = await runAll(loaded);
    expect(summary).toMatchObject({ passed: false, total: 2, failed: 1 });
  });

  it("parseSeverity validates input", () => {
    expect(parseSeverity("warning")).toBe("warning");
    expect(() => parseSeverity("nope")).toThrow(UsageError);
  });
});
