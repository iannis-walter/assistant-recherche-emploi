---
name: hellowork-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in France on
  HelloWork (hellowork.com, ex-RegionsJob), the major French generalist job
  board — find French job listings, CDI/CDD/alternance/stage offers, or look up
  a specific HelloWork posting. Trigger phrases: hellowork, offres d'emploi,
  recherche emploi, emploi en France, offre d'emploi, trouver un emploi,
  recherche de poste, CDI, CDD, alternance, French jobs, jobs in France,
  job search France, "des offres de X à <ville>", look up this HelloWork
  posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/hellowork-search/cli/src/cli.ts *)
---

# HelloWork Search Skill

Search live job listings from **HelloWork** (hellowork.com), the major French
generalist job board (ex-RegionsJob). Covers all of France, all sectors, all
contract types (CDI, CDD, intérim, alternance, stage, freelance). No
authentication, no API key, and **zero runtime dependencies** — it runs with
just `bun`.

## ⚠️ Personal use only

This reads HelloWork's public job pages. HelloWork's terms of use (CGU art.
8.2) **explicitly prohibit automated data extraction** ("screen scraping / web
scraping") without a written license, and `robots.txt` disallows the search
path for generic crawlers. So **keep volume low, never use this commercially
or for bulk data collection.** Run it on your own responsibility.

## When to use this skill

- Search for job openings anywhere in France (city, département, or region)
- Filter by recency (last 24h / 3 days / week / month)
- Get the full description, salary, and contract type of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/hellowork-search/cli/src/cli.ts search -q "<keywords>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). At least one of `--query`/`--location` is required.
- `--location <text>` / `-l <text>` — a French city, département, or region, e.g. `Paris`, `Lyon`, `Bordeaux`, `"Île-de-France"`.
- `--jobage <days>` — posted within N days, mapped to HelloWork's date facet: `1` → last 24h, `2-3` → 3 days, `4-7` → 1 week, `8-31` → 1 month. Coarser than exact days; >31 is ignored (all offers).
- `--page <n>` — page number (1-indexed, 30 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/hellowork-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric offer ID from `search` results (e.g. `79737515`). You may
also pass a full `https://www.hellowork.com/fr-fr/emplois/<id>.html` URL.
Returns the full description (with section headings), contract type, salary
when displayed, tags (telework, education, experience), and posting date.

## Usage examples

```bash
# Back-end developer roles in Paris
bun run .agents/skills/hellowork-search/cli/src/cli.ts search -q "développeur back-end" -l Paris --format table

# Data engineer roles in Lyon, posted in the last week
bun run .agents/skills/hellowork-search/cli/src/cli.ts search -q "data engineer" -l Lyon --jobage 7 --format table

# Alternance offers in Bordeaux, first 10
bun run .agents/skills/hellowork-search/cli/src/cli.ts search -q alternance -l Bordeaux --limit 10

# Project manager roles across Île-de-France, page 2
bun run .agents/skills/hellowork-search/cli/src/cli.ts search -q "chef de projet" -l "Île-de-France" --page 2 --format table

# Full details for a specific offer
bun run .agents/skills/hellowork-search/cli/src/cli.ts detail 79737515 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Server-rendered HTML is parsed with regex anchored on stable `data-cy`
  attributes and hidden form inputs; there is no public JSON API and no
  JobPosting JSON-LD (see `url-reference.md`).
- Search results include `contract` (CDI/CDD/alternance/…) and `salary` when
  HelloWork displays them (salary shown on roughly half of offers).
- Result dates on search cards are relative French labels ("il y a 5 jours");
  the CLI converts them to approximate ISO dates. `detail` returns the exact
  publication date from the page's analytics data.
- Anonymous offers ("Cette entreprise souhaite rester anonyme") have
  `company: null`.
- Page size is fixed at 30 results per page.
- HelloWork may rate-limit; the CLI retries 429/5xx with exponential backoff.
  Keep volume low (see the personal-use warning above).
