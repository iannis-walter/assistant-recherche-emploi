---
name: france-travail-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in France on
  France Travail (francetravail.fr, ex-Pôle Emploi) via the OFFICIAL free
  "Offres d'emploi v2" API — find French job listings, CDI/CDD/alternance
  offers, or look up a specific France Travail posting by id or URL. Trigger
  phrases: France Travail, pôle emploi, pole emploi, francetravail, offres
  d'emploi, offre d'emploi, recherche emploi, emploi en France, trouver un
  emploi, recherche de poste, CDI, CDD, alternance, French jobs, jobs in
  France, job search France, "des offres de X à <ville>", look up this France
  Travail posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/france-travail-search/cli/src/cli.ts *)
---

# France Travail Search Skill

Search live job listings via the **official France Travail API** ("Offres
d'emploi v2" on [francetravail.io](https://francetravail.io)). This is the
public employment service's own API (ex-Pôle Emploi): free, documented, and
sanctioned — no scraping. Covers all of France (including DOM), all sectors
and contract types (CDI, CDD, intérim, alternance, saisonnier). **Zero
runtime dependencies** — runs with just `bun`.

## Credentials required (free)

The CLI reads `FRANCETRAVAIL_CLIENT_ID` and `FRANCETRAVAIL_CLIENT_SECRET`
from the environment. Without them it exits 1 with a
`MISSING_CREDENTIALS` error. Registering is free: create an account on
<https://francetravail.io>, create an application, subscribe it to the
**API Offres d'emploi v2**, and export the two variables — the step-by-step
guide is in [`cli/README.md`](cli/README.md).

## When to use this skill

- Search job openings anywhere in France (city, département, or region)
- Filter by recency (1 / 3 / 7 / 14 / 31 days)
- Get the full description, contract type, salary, and apply URL of a posting

## Commands

### Search job listings

```bash
bun run .agents/skills/france-travail-search/cli/src/cli.ts search -q "<keywords>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords; comma-separate for AND (e.g. `"python, django"`). At least one of `--query`/`--location` is required.
- `--location <loc>` / `-l <loc>` — the API filters by administrative codes, so accepted forms are:
  - a 5-digit **INSEE commune code**: `33063` (Bordeaux) — note INSEE ≠ postal code;
  - a **department number**: `33`, `75`, `2A`/`2B` (Corsica), `971`-`976` (DOM);
  - an explicit prefix: `commune:33063`, `departement:33` (or `dept:33`), `region:75`;
  - a **major French city name** (`Paris`, `Lyon`, `Marseille`, `Bordeaux`, ... ~37 largest cities built in). Other city names error with `BAD_LOCATION` — pass their INSEE code instead.
- `--jobage <days>` — posted within N days. The API supports 1/3/7/14/31; N is **rounded up** to the next supported value; >31 means no filter.
- `--page <n>` — page number (1-indexed).
- `--limit <n>` / `-n <n>` — results per page (also the server page size, max 150; default 20).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/france-travail-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the alphanumeric offer id from `search` results (e.g. `197XKRB`). You
may also pass a full
`https://candidat.francetravail.fr/offres/recherche/detail/<id>` URL. Returns
the full description, contract type and duration, salary, required
experience, ROME occupation label, and apply URL.

## Usage examples

```bash
# Python developer roles in Paris
bun run .agents/skills/france-travail-search/cli/src/cli.ts search -q "développeur python" -l Paris --format table

# Data engineer roles in Gironde (dept 33), posted in the last week
bun run .agents/skills/france-travail-search/cli/src/cli.ts search -q "data engineer" -l 33 --jobage 7 --format table

# Alternance offers in Toulouse (INSEE 31555), first 10
bun run .agents/skills/france-travail-search/cli/src/cli.ts search -q alternance -l commune:31555 --limit 10

# Project manager roles in Île-de-France (region 11), page 2
bun run .agents/skills/france-travail-search/cli/src/cli.ts search -q "chef de projet" -l region:11 --page 2 --format table

# Nursing jobs around Lyon
bun run .agents/skills/france-travail-search/cli/src/cli.ts search -q infirmier -l Lyon --format table

# Full details for a specific offer
bun run .agents/skills/france-travail-search/cli/src/cli.ts detail 197XKRB --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON output is `{ "meta": { "count", "page", "total"? }, "results": [...] }`;
each result has at least `id`, `title`, `company`, `location`, `date`, `url`
(missing values are `null`, never omitted), plus `contract` and `salary`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }`
and the process exits with code `1`.

## Notes

- Official API, OAuth2 client_credentials; the access token is cached in
  memory for the process run (validity ~25 min). Endpoints and parameters
  verified against the API's official OpenAPI spec — see `url-reference.md`.
- `url` is the offer's public posting page
  (`candidat.francetravail.fr/offres/recherche/detail/<id>`); for offers
  aggregated from partner boards it is the partner's original posting URL
  (`origineOffre.urlOrigine`).
- Location filtering is by INSEE/administrative codes (see `--location`
  above). Free-text place names are NOT supported by the API; the CLI's
  built-in city map covers only the largest cities.
- Pagination is capped by the API at index 3149 (~3150 results per query);
  page size max 150. `meta.total` reports the total match count from the
  API's `Content-Range` header.
- Company is `null` on anonymous offers; `salary` is a free-text label
  ("Annuel de 40000.0 Euros à 50000.0 Euros") when present.
- A search with no matches returns HTTP 204 → empty `results`, exit 0.
- The API rate-limits per application; the CLI retries 429/5xx with
  exponential backoff and honours `Retry-After`.
