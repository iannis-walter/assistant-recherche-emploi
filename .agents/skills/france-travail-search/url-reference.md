# France Travail "Offres d'emploi v2" API Reference

Reconnaissance notes for `france-travail-search`, verified July 2026 against
the **official OpenAPI spec (v2.01)** published by France Travail on
francetravail.io, plus live probes of the auth and search endpoints. This is
the file to update if the API changes.

## Where the official spec lives

- Developer portal: <https://francetravail.io> — product page
  <https://francetravail.io/data/api/offres-emploi> (Angular SPA; the
  documentation content is JS-rendered).
- The portal serves the raw OpenAPI document from its own gateway:
  `GET https://francetravail.io/api-peio/v2/api/84/openapi`
  (product id 84 = "Offres d'emploi"; no auth needed). If the id shifts,
  scan `/api-peio/v2/api/{id}/openapi` and match `info.title`.
- Spec highlights confirmed: `info.version: 2.01`,
  `servers[0].url: https://api.francetravail.io/partenaire/offresdemploi`.

## Authentication (OAuth2 client_credentials)

```
POST https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=<FRANCETRAVAIL_CLIENT_ID>
&client_secret=<FRANCETRAVAIL_CLIENT_SECRET>
&scope=api_offresdemploiv2 o2dsoffre
```

- Both scopes are marked **Obligatoire** in the spec's security scheme
  (`authentification_partenaire`, flow `clientCredentials`).
- Response: `{"access_token": "...", "token_type": "Bearer", "expires_in": ~1499}`
  (~25 min). The CLI caches it in memory only.
- Verified live: bogus credentials → HTTP 400
  `{"error":"invalid_client","error_description":"Client authentication failed"}`.
- API calls without a token → HTTP 401 with `Www-Authenticate: Bearer`
  (verified live).

## Search

```
GET https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search
Authorization: Bearer <token>
```

Parameters used by the CLI (all optional per the spec; full list of ~40
params is in the OpenAPI doc):

| Param | Meaning | Notes (from the spec) |
|-------|---------|------------------------|
| `motsCles` | keywords | each keyword ≥ 2 chars, comma-separated, AND semantics |
| `commune` | INSEE commune code | up to 5 values comma-separated; **INSEE code, not postal code** |
| `departement` | department number | up to 5 values; `2A`/`2B`, `971`-`976` valid |
| `region` | region code | see `/v2/referentiel/regions` |
| `distance` | km radius around `commune` | not exposed by the CLI (kept minimal) |
| `publieeDepuis` | posted within N days | integer; portal docs allow 1, 3, 7, 14, 31 — the CLI rounds up |
| `range` | pagination `p-d` | 0-indexed inclusive; ≤150 results per page; `p` ≤ 3000, `d` ≤ 3149 |
| `sort` | 0 pertinence / 1 date / 2 distance | CLI omits it (API default) |

Response codes (from the spec, all confirmed present):

- `200` — all results returned
- `206` — partial content, more pages available
- `204` — **no matching offers** (empty body — not an error)
- `400` — bad request (invalid parameter)
- `500` — server error
- `200`/`206` carry `Content-Range: offres p-d/t` where `t` = total matches.

Body: `{ "resultats": [Offre, ...], "filtresPossibles": [...] }`.

### `Offre` fields used by the CLI (schema `#/components/schemas/Offre`)

| Field | Maps to |
|-------|---------|
| `id` (string, e.g. `197XKRB`) | `id` |
| `intitule` | `title` |
| `entreprise.nom` | `company` (absent on anonymous offers) |
| `lieuTravail.libelle` (e.g. `33 - BORDEAUX`) | `location` |
| `dateCreation` (ISO 8601) | `date` |
| `origineOffre.urlOrigine` | `url` (fallback: constructed public URL) |
| `typeContrat` (`CDI`, `CDD`, `MIS`, ...) | `contract` |
| `salaire.libelle` | `salary` |
| `description`, `experienceLibelle`, `romeLibelle`, `dureeTravailLibelle`, `alternance`, `contact.urlPostulation` | detail extras |

Public posting URL pattern:
`https://candidat.francetravail.fr/offres/recherche/detail/{id}`. For
partner-sourced offers (`origineOffre.origine` = `"2"`), `urlOrigine` points
at the partner site instead.

## Detail

```
GET https://api.francetravail.io/partenaire/offresdemploi/v2/offres/{id}
Authorization: Bearer <token>
```

- `200` — one full `Offre` object (same schema as search results).
- `204` — **the offer does not exist** (the spec's documented "not found"
  signal — not 404; the CLI treats 204 and 404 alike as `NOT_FOUND`).
- `400` / `500` as above.

## Referentiels (not used by the CLI, useful for maintenance)

The same API exposes lookup tables under `/v2/referentiel/…`:
`communes` (INSEE codes), `departements`, `regions`, `metiers` (ROME),
`appellations`, `typesContrats`, `naturesContrats`, `niveauxFormations`,
`permis`, `langues`, `domaines`, `secteursActivites`, `pays`, `continents`,
`themes`, `nafs`. All require the same Bearer token.

## Quirks

- **INSEE ≠ postal code**: Paris is `75056` (not 75001+), Marseille `13055`,
  Lyon `69123`. The CLI ships a built-in map for ~37 major cities and errors
  with `BAD_LOCATION` for other free-text names.
- `publieeDepuis` is typed as a plain integer in the OpenAPI doc; the
  portal's parameter documentation constrains it to {1, 3, 7, 14, 31}
  (could not be re-verified live without credentials — the CLI rounds up to
  those values, which is safe either way).
- A 204 comes with an **empty body** — don't `JSON.parse` it.
- Rate limits are per-application (429 + `Retry-After`); the exact quota is
  shown on your application dashboard on francetravail.io and is not stated
  in the OpenAPI doc.
- Token lifetime observed/documented ≈ 1499 s; the CLI refreshes 60 s early
  and never persists it to disk.
