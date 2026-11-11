#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Welcome to the Jungle
// (welcometothejungle.com), the French tech/startup job board. No external CLI
// framework, so it runs anywhere `bun` is available with zero install beyond
// the repo clone.
//
// Personal use only. This queries the same public Algolia index and REST API
// the site's own front-end uses (the API key is a public search-only key
// shipped to every browser), but WTTJ's robots.txt disallows parameterized
// job-search URLs and its terms do not invite bulk extraction. Keep volume
// low, never use it commercially or for bulk collection. Run it on your own
// responsibility.

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

const HELP = `wttj-cli — search jobs on Welcome to the Jungle (welcometothejungle.com, France)

USAGE
  bun run src/cli.ts search -q "<keywords>" [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (job title, skill, role). At least one of
                          --query/--location is required.
  --location, -l <text>   City, region, or country as WTTJ names it, e.g.
                          "Paris", "Lyon", "Ile-de-France", "France".
  --jobage <days>         Posted within N days (client-side filter over the
                          date-sorted index page; see SKILL.md).
  --page <n>              1-indexed page (30 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

DETAIL
  <id|url> is the numeric id from search results (e.g. 3870114) or a posting
  URL like https://www.welcometothejungle.com/fr/companies/<org>/jobs/<slug>.

EXAMPLES
  bun run src/cli.ts search -q "développeur python" -l Paris --format table
  bun run src/cli.ts search -q "data engineer" --jobage 7 --format table
  bun run src/cli.ts detail 3870114 --format plain

Personal use only — keep volume low (see SKILL.md).
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
            'search requires at least one of --query/-q or --location/-l (e.g. -q "développeur python" -l Paris)',
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
      process.stderr.write(JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n")
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
