# Welcome to the Jungle — endpoint reference

Reconnaissance notes for maintaining `cli/`. Verified live on 2026-07-09.

## Architecture overview

The WTTJ front-end (`www.welcometothejungle.com`) is a SPA behind **AWS
CloudFront + AWS WAF**: plain `curl` on any page (including `robots.txt`)
gets an HTTP `202` with `x-amzn-waf-action: challenge` and an empty body, so
HTML scraping is a dead end. The search UI instead queries a **public Algolia
index** directly from the browser, and job pages hydrate from a separate,
unauthenticated **REST API** (`api.welcometothejungle.com`) that is *not*
WAF-challenged. The CLI uses those two backends only.

The Algolia application ID and API key below are **public search-only
credentials** shipped to every visitor in the site's JS bundle. They allow
read-only queries and nothing else. The key is **referer-restricted**: calls
without a `welcometothejungle.com` origin/referer header get
`403 {"message":"Method not allowed with this referer"}`.

## 1. Search — Algolia multi-query endpoint

```
POST https://csekhvms53-dsn.algolia.net/1/indexes/*/queries
```

Required headers:

| Header | Value |
|--------|-------|
| `x-algolia-application-id` | `CSEKHVMS53` |
| `x-algolia-api-key` | `4bd8f6215d0cc52b26430765769e65a0` (public, search-only) |
| `content-type` | `application/x-www-form-urlencoded` (body is JSON — Algolia convention) |
| `origin` / `referer` | `https://www.welcometothejungle.com` / `.../` (mandatory, see above) |

Body:

```json
{"requests":[{"indexName":"wk_cms_jobs_production","params":"query=python&hitsPerPage=30&page=0"}]}
```

`params` is a URL-encoded query string of Algolia search parameters.

### Indexes

| Index | Purpose |
|-------|---------|
| `wk_cms_jobs_production` | Jobs, relevance-ranked (default) |
| `wk_cms_jobs_production_published_at_desc` | Replica sorted by publish date desc — used for `--jobage` |
| `wk_cms_organizations_production` | Companies (not used by the CLI) |

### Useful search parameters

| Param | Notes |
|-------|-------|
| `query` | Keywords. FR or EN both work. |
| `hitsPerPage` | Site uses 30. Max 1000, but paging is capped at 1000 hits total (`paginationLimitedTo`). |
| `page` | **0-indexed** (CLI `--page` is 1-indexed → subtract 1). |
| `facetFilters` | JSON array; outer = AND, inner array = OR. e.g. `[["offices.city:Lyon","offices.state:Lyon"]]`. Value match is case-insensitive. |
| `attributesToRetrieve` | Trim the (large) hits; the CLI requests only the fields it maps. |

### Facet attributes (verified via `facets=["*"]`)

`offices.city`, `offices.state` (region, unaccented: `Ile-de-France`),
`offices.country`, `offices.country_code`, `office.*` (singular variants),
`contract_type` (`FULL_TIME`, `INTERNSHIP`, `APPRENTICESHIP`, `TEMPORARY`,
`FREELANCE`, `VIE`…), `contract_type_names.{fr,en,es,cs,sk}`, `remote`
(`fulltime`/`partial`/`punctual`/`no`/`unknown`), `language`,
`organization.name`, `organization.slug`, `salary_currency`,
`salary_yearly_minimum`, `experience_level_minimum`, `education_level`,
`sectors.*`, `profession.*`, `promoted`, `reference`, `website.reference`.

**No numeric date attribute is filterable**: `numericFilters` on
`published_at_timestamp` (or `>0`) returns 0 hits — the attribute does not
exist on the index; `published_at` is only an ISO-8601 *string* on each hit.
Date filtering therefore = query the `_published_at_desc` replica + filter
client-side on `published_at`.

### Hit shape (jobs index, key fields)

```
objectID            "3870114"            ← the CLI's result id
name                job title
slug                job slug
organization        { name, slug, nb_employees, logo, … }
offices             [ { city, district, state, country, country_code } ]
office              first/primary office (same shape)
published_at        "2026-07-09T08:00:00.000+02:00"
contract_type       "FULL_TIME"
contract_type_names { fr: "CDI", en: "Permanent contract", … }
remote              "partial"
salary_minimum / salary_maximum / salary_currency / salary_period
experience_level_minimum, education_level, sectors, profession, reference
_geoloc             lat/lng (site also supports aroundLatLng geo search)
```

Response wrapper: `{"results":[{"hits":[…],"nbHits":N,"page":0,"nbPages":N,"hitsPerPage":30,…}]}`.
A per-request error appears as `results[i].message` with HTTP 200.

### Public URL pattern

```
https://www.welcometothejungle.com/fr/companies/{organization.slug}/jobs/{slug}
```

## 2. Object lookup — Algolia getObject

```
GET https://csekhvms53-dsn.algolia.net/1/indexes/wk_cms_jobs_production/{objectID}
    ?attributesToRetrieve=slug,organization.slug
```

Same headers as above (origin/referer mandatory). Used by `detail <id>` to
resolve a numeric id from search results to the org+job slugs. `404` when the
posting has been unpublished.

## 3. Detail — REST API (no auth, no WAF)

```
GET https://api.welcometothejungle.com/api/v1/organizations/{org_slug}/jobs/{job_slug}
```

Returns `{"job": {…}}` with rich HTML fields:

| Field | Notes |
|-------|-------|
| `name`, `slug`, `reference`, `wttj_reference` | identity |
| `description`, `profile`, `recruitment_process`, `company_description`, `benefits` | HTML fragments — the CLI converts to text |
| `published_at`, `updated_at`, `status`, `archived_at` | dates/state |
| `contract_type` (lowercase, e.g. `full_time`), `contract_duration_min/max`, `remote` | contract |
| `salary_min`, `salary_max`, `salary_currency`, `salary_period` | salary |
| `experience_level`, `education_level`, `skills`, `tools`, `language` | requirements |
| `apply_url` | direct ATS link (Lever, Greenhouse, …) |
| `organization` (name, slug, description…), `office`/`offices` | company/location |

`404` (JSON error) for unknown slugs. A related org endpoint exists:
`GET /api/v1/organizations/{slug}`.

## robots.txt / terms (checked 2026-07-09)

`robots.txt` (fetched via a rendering proxy — curl gets the WAF challenge):
`User-agent: *` with `Disallow: */jobs?query=*` and `Disallow: /*?` (any URL
with a query string), plus `/me/*`, `/settings/*`, `/users/*`. So the
parameterized job-search HTML pages are off-limits to crawlers; the CLI does
not touch them, but the intent is clear → the skill carries a **personal use
only** warning. Sitemap: `https://www.welcometothejungle.com/sitemaps/index.xml.gz`.

## Quirks

- `hitsPerPage`/facets responses are large; always set `attributesToRetrieve`
  and empty `attributesToHighlight`/`attributesToSnippet`.
- WTTJ re-publishes ("bumps") offers, so `published_at` skews recent and the
  date-desc replica shows many same-morning timestamps.
- Coverage: `offices.country_code` facet ≈ 94% `FR`, rest ES/GB/BE/MA/IT.
- Region names in facets are unaccented (`Ile-de-France`, not `Île-de-France`).
- The REST `contract_type` is lowercase (`full_time`) while Algolia's is
  uppercase (`FULL_TIME`); `contract_type_names.fr` gives the display label ("CDI").
