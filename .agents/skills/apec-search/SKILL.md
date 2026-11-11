---
name: apec-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in France on APEC
  (apec.fr), the French executive/cadre job board — find cadre job listings,
  CDI/CDD executive offers with stated salaries, or look up a specific APEC
  posting. Trigger phrases: apec, emploi cadre, offres cadres, poste cadre,
  offres d'emploi cadres, recherche emploi cadre, ingénieur, chef de projet,
  French executive jobs, cadre jobs in France, "des offres cadres à <ville>",
  look up this APEC posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/apec-search/cli/src/cli.ts *)
---

# APEC Search Skill

Search live job listings from **APEC** (apec.fr), the French job board for
executives and managers (*cadres*). Postings are salaried professional roles
(CDI/CDD, mostly) and — unusually for French boards — **most state a salary
range**. No authentication, no API key, and **zero runtime dependencies** —
it runs with just `bun`, calling the same public JSON webservices the apec.fr
search page uses.

## ⚠️ Personal use only

This calls APEC's public webservices. Although `robots.txt` is fully open,
APEC's CGU prohibit navigating the site with "un logiciel robot ou tout autre
procédé ou outil automatisé équivalent" and protect the offer database against
extraction (code de la propriété intellectuelle, art. L.342). So **keep volume
low, never use this commercially or for bulk data collection.** Run it on your
own responsibility.

## When to use this skill

- Search cadre/executive job openings anywhere in France (city, département, or region)
- Filter by recency (last 24h / 7 days / 30 days)
- Get the full description, salary, contract type, and skills of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/apec-search/cli/src/cli.ts search -q "<keywords>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). At least one of `--query`/`--location` is required.
- `--location <text>` / `-l <text>` — a French city, département, or region, e.g. `Paris`, `Lyon`, `Bordeaux`, `"Île-de-France"`. Resolved to APEC's internal location code via its autocomplete (first match wins; the match used is not echoed, so prefer unambiguous names).
- `--jobage <days>` — posted within N days, mapped to APEC's date filter: `1` → last 24h, `2-7` → 7 days, `8-30` → 30 days. Coarser than exact days; >30 is ignored (all offers).
- `--page <n>` — page number (1-indexed, 20 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/apec-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the offer number from `search` results (e.g. `179064883W`; the bare
numeric form `179064883` also works — the CLI restores the required `W`
suffix). You may also pass a full
`https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/<id>`
URL. Returns the full description (poste / profil recherché / entreprise
sections), **salary text** (APEC postings usually state one), contract type,
skills/languages tags, and publication date.

## Usage examples

```bash
# Data engineering roles in Paris
bun run .agents/skills/apec-search/cli/src/cli.ts search -q "ingénieur données" -l Paris --format table

# Data engineer roles in Lyon, posted in the last week
bun run .agents/skills/apec-search/cli/src/cli.ts search -q "data engineer" -l Lyon --jobage 7 --format table

# Project manager roles across Île-de-France, first 10
bun run .agents/skills/apec-search/cli/src/cli.ts search -q "chef de projet" -l "Île-de-France" --limit 10

# Product owner roles in Bordeaux, page 2
bun run .agents/skills/apec-search/cli/src/cli.ts search -q "product owner" -l Bordeaux --page 2 --format table

# Full details for a specific offer
bun run .agents/skills/apec-search/cli/src/cli.ts detail 179064883W --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning (includes the salary column) |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data comes from APEC's public JSON webservices (`POST
  /cms/webservices/rechercheOffre`, `GET /cms/webservices/offre/public`) — the
  same XHR calls the Angular search UI makes; no HTML parsing (see
  `url-reference.md`).
- Search results include `salary` (e.g. `"50 - 55 k€ brut annuel"`, or `"A
  négocier"` when undisclosed), `contract` (CDI/CDD/…), and a `snippet` of the
  description.
- `--location` costs one extra request (APEC's location autocomplete) to turn
  the text into a `lieux` code; without `--location` a search is a single
  request. `detail` accepts only the offer's own id — there is no location
  parameter to resolve.
- Results are sorted by publication date, newest first.
- Offer ids are the APEC `numeroOffre` (numeric + `W`, e.g. `179064883W`) —
  pass them as-is to `detail`.
- Confidential offers may have `company: null`.
- Page size is fixed at 20 results per page.
- APEC may rate-limit; the CLI retries 429/5xx with exponential backoff. Keep
  volume low (see the personal-use warning above).
