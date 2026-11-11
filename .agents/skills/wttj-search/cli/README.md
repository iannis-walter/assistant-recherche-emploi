# wttj-cli

CLI for searching jobs on **Welcome to the Jungle** (welcometothejungle.com),
the leading French tech/startup job board.

**Data source**: WTTJ's public Algolia index (`wk_cms_jobs_production`, app `CSEKHVMS53`,
public search-only API key) for search, and the unauthenticated REST API at
`api.welcometothejungle.com` for full postings. See `../url-reference.md`.
**Authentication**: None required (the Algolia key is public and search-only).
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **Personal use only.** WTTJ's robots.txt disallows parameterized job-search URLs and the
> site does not invite bulk extraction. Keep volume low, don't use it commercially or for
> bulk data collection, and run it on your own responsibility.

## Installation

```bash
cd .agents/skills/wttj-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search job listings (at least one of `--query`/`--location`) |
| `detail` | Fetch full detail for a single posting (numeric id or posting URL) |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Python developer roles in Paris
bun run src/cli.ts search -q "développeur python" -l Paris --format table

# Data engineer roles, last 7 days
bun run src/cli.ts search -q "data engineer" --jobage 7 --format table

# Full detail for one job (id from search results)
bun run src/cli.ts detail 3870114 --format plain
```

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). At least one of `--query`/`--location` required. |
| `--location` | `-l` | City, region, or country as WTTJ names it (`Paris`, `Lyon`, `Ile-de-France`, `France`). Exact facet value, case-insensitive. |
| `--jobage` | | Posted within N days (client-side filter over the date-sorted index page; see `../SKILL.md`). |
| `--page` | | 1-indexed page (30 results/page; Algolia caps paging at 1000 hits). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Development

```bash
bun run typecheck   # tsc --noEmit
bun run test        # network-free arg-parsing + parsing unit tests
```

See `../SKILL.md` for the full reference and `../url-reference.md` for the
endpoint documentation a maintainer needs when WTTJ changes its backend.
