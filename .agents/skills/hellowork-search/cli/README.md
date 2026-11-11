# hellowork-cli

Zero-dependency Bun CLI for searching jobs on [HelloWork](https://www.hellowork.com)
(hellowork.com, ex-RegionsJob), the major French generalist job board. Parses
the public server-rendered HTML pages — no API key, no authentication, no
runtime dependencies.

> **Personal use only.** HelloWork's CGU (art. 8.2) prohibit automated data
> extraction, and robots.txt disallows the search path for generic crawlers.
> Keep volume low; never use commercially or for bulk collection.

## Setup

```bash
bun install        # dev types only (typescript, @types/bun)
```

## Usage

```bash
# Search
bun run src/cli.ts search -q "développeur back-end" -l Paris --format table
bun run src/cli.ts search -q "data engineer" -l Lyon --jobage 7 --limit 10

# Detail
bun run src/cli.ts detail 79737515 --format plain
bun run src/cli.ts detail https://www.hellowork.com/fr-fr/emplois/79737515.html
```

Run `bun run src/cli.ts` with no arguments for full help.

## Output contract

- `search --format json`: `{ "meta": { "count", "page", "total" }, "results": [...] }`
  where each result has `id`, `title`, `company`, `location`, `date`, `url`,
  plus `contract` and `salary` (missing values are `null`, never omitted).
- `detail --format json`: the same fields plus `description` and `tags`.
- Errors go to **stderr** as `{ "error": "...", "code": "..." }`, exit code 1.

## Development

```bash
bun run typecheck   # tsc --noEmit
bun test            # network-free: flag validation + fixture-based parsing
```

Parsing anchors and portal quirks are documented in `../url-reference.md`.
