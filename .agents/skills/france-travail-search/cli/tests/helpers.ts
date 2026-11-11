import { join } from "path";

const CLI_PATH = join(import.meta.dir, "../src/cli.ts");

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunOpts {
  /** Extra environment variables to set for the child process. */
  env?: Record<string, string>;
  /** Environment variable names to REMOVE for the child process. */
  unsetEnv?: string[];
}

export async function runCLI(args: string[], opts: RunOpts = {}): Promise<CLIResult> {
  const env: Record<string, string | undefined> = { ...process.env, ...(opts.env ?? {}) };
  for (const name of opts.unsetEnv ?? []) delete env[name];

  const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

export function parseJSON<T = unknown>(result: CLIResult): T {
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI exited with code ${result.exitCode}. stderr: ${result.stderr}`
    );
  }
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(
      `Failed to parse JSON. stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
}
