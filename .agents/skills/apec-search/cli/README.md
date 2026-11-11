# apec-cli

Zero-dependency Bun CLI for searching executive/cadre jobs on
[APEC](https://www.apec.fr) (apec.fr), the French job board for cadres. Calls
the site's public JSON webservices (the same XHR API the search UI uses) — no
API key, no authentication, no runtime dependencies, no HTML parsing.

> **Personal use only.** APEC's CGU prohibit automated tools and protect the
> offer database against extraction, even though robots.txt is fully open.
> Keep volume low; never use commercially or for bulk collection.

## Setup

```bash
bun install        # dev types only (typescript, @types/bun)
```

## Usage

```bash
# Search
bun run src/cli.ts search -q "ingénieur données" -l Paris --format table
bun run src/cli.ts search -q "data engineer" -l Lyon --jobage 7 --limit 10

# Detail
bun run src/cli.ts detail 179064883W --format plain
bun run src/cli.ts detail "https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/179064883W"
```

Run `bun run src/cli.ts` with no arguments for full help.

## Output contract

- `search --format json`: `{ "meta": { "count", "page", "total" }, "results": [...] }`
  where each result has `id`, `title`, `company`, `location`, `date`, `url`,
  plus `salary`, `contract`, and `snippet` (missing values are `null`, never
  omitted). `id` is APEC's `numeroOffre` (e.g. `179064883W`).
- `detail --format json`: the same fields plus `description` (poste / profil /
  entreprise sections as markdown-ish text) and `skills`.
- Errors go to **stderr** as `{ "error": "...", "code": "..." }`, exit code 1.

## Development

```bash
bun run typecheck   # tsc --noEmit
bun test            # network-free: flag validation + fixture-based mapping
```

Endpoints, nomenclature codes, and portal quirks are documented in
`../url-reference.md`.
