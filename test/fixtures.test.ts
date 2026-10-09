import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildChecks, evaluate } from "../src/index.js";

interface Fixture {
  name: string;
  output: unknown;
  checks: unknown[];
  failOn?: "info" | "warning" | "error" | "critical";
  expected: { passed: boolean; codes?: string[]; warningCodes?: string[] };
}

const dir = join(import.meta.dirname, "fixtures");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".json"))
  .sort();

describe("golden fixtures", () => {
  it("has fixtures to run", () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
  });

  for (const file of files) {
    const fixture = JSON.parse(
      readFileSync(join(dir, file), "utf8"),
    ) as Fixture;

    it(`${file}: ${fixture.name}`, async () => {
      const result = await evaluate({
        output: fixture.output,
        checks: buildChecks(fixture.checks),
        failOn: fixture.failOn,
      });

      expect(result.passed).toBe(fixture.expected.passed);
      expect(result.failures.map((f) => f.code).sort()).toEqual(
        [...(fixture.expected.codes ?? [])].sort(),
      );
      if (fixture.expected.warningCodes) {
        expect(result.warnings.map((f) => f.code).sort()).toEqual(
          [...fixture.expected.warningCodes].sort(),
        );
      }
    });
  }
});
