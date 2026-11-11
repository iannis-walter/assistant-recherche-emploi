---
name: wttj-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs on Welcome to the
  Jungle (welcometothejungle.com), the leading French tech/startup job board —
  find French startup and tech job listings, CDI/alternance/stage offers at
  startups and scale-ups, or look up a specific WTTJ posting. Trigger phrases:
  welcome to the jungle, wttj, jobs startup, emploi startup, offres d'emploi
  tech, recherche emploi startup, jobs tech France, startup jobs in France,
  French startup jobs, scale-up, "des offres startup à <ville>", look up this
  Welcome to the Jungle posting.
context: fork
allowed-tools: Bash(bun run .agents/skills/wttj-search/cli/src/cli.ts *)
---

# Welcome to the Jungle Search Skill

Search live job listings from **Welcome to the Jungle** (welcometothejungle.com),
the leading French tech/startup job board (strong coverage of startups,
scale-ups, and product/tech roles; also consulting, marketing, and other
sectors). Data comes from the same public Algolia search index and REST API
the site's own front-end uses — no authentication, no scraping of WAF-guarded
HTML, and **zero runtime dependencies**: it runs with just `bun`.

## ⚠️ Personal use only

This queries WTTJ's public search backend with the **public, search-only
Algolia API key that the site ships to every browser** — it grants read-only
search access and nothing more. Still: WTTJ's `robots.txt` disallows
parameterized job-search URLs (`*/jobs?query=*`) for crawlers, the site itself
sits behind an AWS WAF bot challenge, and its terms do not invite bulk
extraction. So **keep volume low, never use this commercially or for bulk data
collection.** Run it on your own responsibility.

## When to use this skill

- Search French startup/tech job openings (nationwide, or by city/region)
- Filter by recency (posted within the last N days)
- Get the full description, candidate profile, recruitment process, salary,
  and apply link for a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "<keywords>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). At least one of `--query`/`--location` is required.
- `--location <text>` / `-l <text>` — matched against WTTJ's office facets (city OR region/state OR country), e.g. `Paris`, `Lyon`, `Bordeaux`, `"Ile-de-France"`, `France`. Facet matching is exact-value but case-insensitive; use the name as WTTJ writes it (regions without accents, e.g. `Ile-de-France`).
- `--jobage <days>` — posted within N days. The index has **no filterable numeric date attribute**, so this queries the date-sorted replica index and filters the returned page client-side: you get the newest matches first, but a page can yield fewer than 30 results once old postings are dropped. Paginate for more.
- `--page <n>` — page number (1-indexed, 30 results per page, Algolia caps paging at 1000 hits total).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/wttj-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric id from `search` results (e.g. `3870114`; it is resolved to
the posting's slugs via Algolia, then fetched from the REST API). You may also
pass a full posting URL:
`https://www.welcometothejungle.com/fr/companies/<org>/jobs/<slug>`.
Returns the full description, candidate profile ("Profil recherché"),
recruitment process, contract type, remote policy, salary when displayed, and
the direct apply link (often the company's own ATS).

## Usage examples

```bash
# Python developer roles in Paris
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "développeur python" -l Paris --format table

# Data engineer roles anywhere in France, posted in the last 7 days
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "data engineer" --jobage 7 --format table

# Product manager roles in Lyon, first 10
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "product manager" -l Lyon --limit 10

# DevOps roles across Ile-de-France, page 2
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q devops -l "Ile-de-France" --page 2 --format table

# Full details for a specific offer (id from search results)
bun run .agents/skills/wttj-search/cli/src/cli.ts detail 3870114 --format plain

# Full details from a posting URL
bun run .agents/skills/wttj-search/cli/src/cli.ts detail "https://www.welcometothejungle.com/fr/companies/margo/jobs/developpeur-senior-python-practice-se-margo_paris" --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source is WTTJ's public Algolia index `wk_cms_jobs_production`
  (app `CSEKHVMS53`) and the REST detail API at
  `api.welcometothejungle.com` — see `url-reference.md`. The Algolia key is a
  public search-only key embedded in the site's JS; requests must carry a
  `welcometothejungle.com` origin/referer header or Algolia answers 403.
- Search results include `contract` (CDI, Stage, Alternance… in French),
  `remote` (`fulltime`/`partial`/`punctual`/`no`/`unknown`), and `salary`
  when the recruiter published one (a minority of offers).
- `date` on search results is the posting's `published_at` ISO timestamp.
  WTTJ regularly re-publishes ("bumps") offers, so dates skew recent.
- Coverage is mostly France (`FR` ≈ 95% of offices) with some ES/GB/BE/MA
  offers; `--location France` filters to French offices.
- `--location` matches **any** of a posting's offices, but the `location`
  column shows the posting's primary office — so a multi-office company can
  match `-l Lyon` while displaying its Paris/Courbevoie headquarters.
- The public site is behind an AWS WAF challenge — do not try to fetch
  `welcometothejungle.com` HTML pages directly; use this CLI's API route.
- Algolia may rate-limit; the CLI retries 429/5xx with exponential backoff.
  Keep volume low (see the personal-use warning above).
