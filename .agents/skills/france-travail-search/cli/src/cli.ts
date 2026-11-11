#!/usr/bin/env bun
// Self-contained CLI for the OFFICIAL France Travail (ex-Pôle Emploi)
// "Offres d'emploi v2" API (francetravail.io). Zero runtime dependencies —
// bun's native fetch + TypeScript. Requires free API credentials:
// export FRANCETRAVAIL_CLIENT_ID / FRANCETRAVAIL_CLIENT_SECRET
// (register an application on https://francetravail.io — see README.md).

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `france-travail-cli — search jobs on the official France Travail API

USAGE
  bun run src/cli.ts search --query "<keywords>" [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

CREDENTIALS (required, free)
  export FRANCETRAVAIL_CLIENT_ID="PAR_..."
  export FRANCETRAVAIL_CLIENT_SECRET="..."
  Register an application on https://francetravail.io and subscribe it to the
  "API Offres d'emploi v2" (see README.md for the step-by-step guide).

SEARCH FLAGS
  --query, -q <text>      Keywords, comma-separated for AND (job title, skill).
  --location, -l <loc>    INSEE commune code (33063), department (33, 75, 2A,
                          972), "commune:<code>" / "departement:<n>" /
                          "region:<n>", or a major French city name (Paris,
                          Lyon, Marseille, ...). At least one of -q/-l required.
  --jobage <days>         Posted within N days. API supports 1/3/7/14/31 —
                          rounded UP to the next value; >31 means no filter.
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Results per page / cap (max 150 per API page). Default 20.
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "développeur python" -l Paris --format table
  bun run src/cli.ts search -q "data engineer" -l 33 --jobage 7 --format table
  bun run src/cli.ts search -q alternance -l commune:31555 --limit 10
  bun run src/cli.ts detail 197XKRB --format plain

Official API — respect the published rate limits; the CLI retries 429/5xx
with exponential backoff.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const query = typeof flags.query === "string" ? flags.query : undefined
    const location = typeof flags.location === "string" ? flags.location : undefined
    if (!query && !location) {
      process.stderr.write(
        JSON.stringify({
          error:
            'at least one of --query/-q or --location/-l is required (e.g. -q "développeur" -l Paris)',
          code: "NO_QUERY",
        }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) +
            "\n",
        )
        return null
      }
      return val
    }

    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      flags.jobage = String(v)
    }
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      flags.page = String(v)
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      flags.limit = String(v)
    }

    const opts: SearchOpts = {
      query,
      location,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(
        JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
