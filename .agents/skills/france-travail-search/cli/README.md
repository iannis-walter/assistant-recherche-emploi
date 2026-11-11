# france-travail-cli

Zero-dependency CLI for the **official France Travail (ex-Pôle Emploi)
"Offres d'emploi v2" API** — search French job listings and fetch full
posting details. Runs on `bun` with native `fetch`; `bun install` only pulls
dev types for `typecheck`.

## Getting credentials (free, ~5 minutes)

The API is free but requires OAuth2 client credentials:

1. Go to **<https://francetravail.io>** and click *Se connecter* → create an
   account (any email works; no company registration required).
2. Once logged in, open your dashboard and **create an application**
   (*Créer une application*). Give it any name, e.g. `job-search-cli`.
3. In the API catalogue (<https://francetravail.io/data/api/offres-emploi>),
   open **API Offres d'emploi v2** and **subscribe your application** to it
   (*Souscrire* / add the API to your application). Production access is
   granted immediately for this API.
4. Your application page now shows an **Identifiant client** (starts with
   `PAR_...`) and a **Clé secrète**. Export them:

```bash
export FRANCETRAVAIL_CLIENT_ID="PAR_yourapp_..."
export FRANCETRAVAIL_CLIENT_SECRET="your-secret"
```

Without these, every command exits 1 with
`{"error": "...", "code": "MISSING_CREDENTIALS"}` on stderr.

The CLI exchanges them for a Bearer token (`client_credentials` grant, scope
`api_offresdemploiv2 o2dsoffre`) on each run and caches it **in memory only**
for the process lifetime (tokens last ~25 minutes; nothing is written to
disk).

## Install & checks

```bash
cd .agents/skills/france-travail-search/cli
bun install        # dev types only (typescript, @types/bun)
bun run typecheck  # tsc --noEmit
bun test           # network-free suite (arg validation, mapping, formatting)
```

## Usage

```bash
# Search (at least one of -q / -l required)
bun run src/cli.ts search -q "développeur python" -l Paris --format table
bun run src/cli.ts search -q "data engineer" -l 33 --jobage 7 --limit 10
bun run src/cli.ts search -q "chef de projet" -l region:11 --page 2

# Detail (id or public URL)
bun run src/cli.ts detail 197XKRB --format plain
bun run src/cli.ts detail "https://candidat.francetravail.fr/offres/recherche/detail/197XKRB"
```

### Flags

| Flag | Description |
|------|-------------|
| `--query`, `-q` | Keywords; comma-separate for AND (`"python, django"`) |
| `--location`, `-l` | INSEE commune code (`33063`), department (`33`, `2A`, `972`), `commune:`/`departement:`/`region:` prefix, or a major French city name |
| `--jobage <days>` | Posted within N days — rounded up to the API's 1/3/7/14/31; >31 = no filter |
| `--page <n>` | 1-indexed page |
| `--limit`, `-n` | Results per page (= server page size, max 150; default 20) |
| `--format` | `json` (default), `table`, `plain` |

### Output contract

- stdout, `json` format: `{ "meta": { "count", "page", "total"? }, "results": [...] }`
  where each result has at least `id`, `title`, `company`, `location`,
  `date`, `url` (missing → `null`, never omitted) plus `contract`, `salary`.
- Errors: stderr only, `{ "error": "...", "code": "..." }`, exit code 1.
  Codes: `MISSING_CREDENTIALS`, `AUTH_FAILED`, `BAD_ARG`, `NO_QUERY`,
  `BAD_LOCATION`, `NO_ID`, `BAD_ID`, `NOT_FOUND`, `BAD_REQUEST`,
  `RATE_LIMITED`, `SERVER_ERROR`, `API_ERROR`, `BAD_CMD`.
- 429/5xx are retried with exponential backoff + jitter (max 6 retries,
  honours `Retry-After`); a missing offer (API 204/404) → `NOT_FOUND`.

See `../url-reference.md` for the verified API endpoints, parameters, and
response schema.
