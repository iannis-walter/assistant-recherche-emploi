import { describe, test, expect } from "bun:test";
import { runCLI } from "./helpers";

// All assertions here trigger validation errors that are emitted BEFORE any
// network call, so the suite is network-free. The MISSING_CREDENTIALS test
// runs the CLI with the env vars stripped, which also fails pre-network.

const NO_CREDS = { unsetEnv: ["FRANCETRAVAIL_CLIENT_ID", "FRANCETRAVAIL_CLIENT_SECRET"] };

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr);
  } catch {
    return {};
  }
}

describe("france-travail CLI flag validation", () => {
  describe("numeric flag validation", () => {
    for (const name of ["jobage", "page", "limit"]) {
      test(`--${name} non-numeric exits 1 with BAD_ARG`, async () => {
        const result = await runCLI(
          ["search", "-q", "développeur", `--${name}`, "foo"],
          NO_CREDS,
        );
        expect(result.exitCode).not.toBe(0);
        const err = parsedStderr(result.stderr);
        expect(err.code).toBe("BAD_ARG");
        expect(err.error).toMatch(new RegExp(name));
      });
    }
  });

  describe("search argument validation", () => {
    test("missing both --query and --location exits 1 with NO_QUERY", async () => {
      const result = await runCLI(["search"], NO_CREDS);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("NO_QUERY");
    });

    test("an unresolvable --location exits 1 with BAD_LOCATION", async () => {
      const result = await runCLI(
        ["search", "-q", "développeur", "-l", "Trifouillis-les-Oies"],
        NO_CREDS,
      );
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("BAD_LOCATION");
      expect(err.error).toMatch(/INSEE/);
    });
  });

  describe("credentials", () => {
    test("missing env credentials exits 1 with MISSING_CREDENTIALS", async () => {
      const result = await runCLI(["search", "-q", "développeur"], NO_CREDS);
      expect(result.exitCode).toBe(1);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("MISSING_CREDENTIALS");
      expect(err.error).toMatch(/FRANCETRAVAIL_CLIENT_ID/);
      expect(err.error).toMatch(/francetravail\.io/);
      // Errors go to stderr only, never stdout.
      expect(result.stdout).toBe("");
    });

    test("detail without credentials exits 1 with MISSING_CREDENTIALS", async () => {
      const result = await runCLI(["detail", "197XKRB"], NO_CREDS);
      expect(result.exitCode).toBe(1);
      expect(parsedStderr(result.stderr).code).toBe("MISSING_CREDENTIALS");
    });
  });

  describe("detail argument validation", () => {
    test("missing id exits 1 with NO_ID", async () => {
      const result = await runCLI(["detail"], NO_CREDS);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("NO_ID");
    });

    test("an unparseable id exits 1 with BAD_ID (no network)", async () => {
      const result = await runCLI(["detail", "not an id!!"], NO_CREDS);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("BAD_ID");
    });
  });

  describe("command dispatch", () => {
    test("unknown command exits 1 with BAD_CMD", async () => {
      const result = await runCLI(["frobnicate"], NO_CREDS);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("BAD_CMD");
    });

    test("no command prints help and exits 1", async () => {
      const result = await runCLI([], NO_CREDS);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toMatch(/USAGE/);
    });
  });
});
