# APEC URL & API Reference

Reconnaissance notes for `apec-search` (verified live with plain `curl`,
July 2026). This is the file to update when APEC changes its webservices.

## Access & terms

- **robots.txt** (`https://www.apec.fr/robots.txt`): fully open — "All robots
  will spider the domain", `User-agent: *` with **no Disallow rules**.
- **CGU** (`https://www.apec.fr/infos-legales/infos-cgu.html`): despite the
  open robots.txt, the terms prohibit using "un logiciel robot ou tout autre
  procédé ou outil automatisé équivalent" to navigate the site, and the offer
  database is protected as a *base de données* (art. L.342 code de la
  propriété intellectuelle) — no reproduction/extraction without APEC's
  consent.
- **Consequence**: the skill carries a prominent personal-use-only warning;
  keep volume low.
- No anti-bot protection was encountered: all endpoints below answer plain
  `curl` with a browser User-Agent (no Datadome/Cloudflare challenge, no
  cookies required).

## Architecture

apec.fr is an Angular SPA (Jahia CMS) backed by public JSON webservices under
`/cms/webservices/`. There is no server-rendered results HTML worth parsing —
the JSON API is the data source. Endpoint map recovered from the app bundle
(`/modules/apec-jahia-module/javascript/angular-output/offres/dist/main-*.js`).

**Required headers** (all endpoints): a browser `User-Agent` and
`Accept: application/json` (the referentiel endpoints return **406** without
the Accept header; the others are lenient, but send it everywhere).

## Search

```
POST https://www.apec.fr/cms/webservices/rechercheOffre
Content-Type: application/json
```

Request body (all keys optional unless noted; unknown keys are ignored):

| Key | Type | Meaning |
|-----|------|---------|
| `motsCles` | string | keyword search (title, skill, role) |
| `lieux` | number[] | location codes (`lieuId` from the lieu autocomplete, see below). Département codes are 1-2 digit numbers (Paris = `75`); communes/regions have 6-digit ids |
| `anciennetePublication` | number | posting-age code: `101850` = last 24h, `101851` = last 7 days, `101852` = last 30 days, `101853`/omit = all (referentiel `POSITION_DURATION_FILTERING_SERVICE_DOMAIN`) |
| `typesContrat` | number[] | contract-type codes: `101888` CDI, `101887` CDD, `20053` Alternance, `101930` Intérim, `597171` Stage (referentiel `RECHERCHE_OFFRE_TYPE_CONTRAT`) |
| `pagination` | object | `{"range": <page size>, "startIndex": <0-based offset>}` — the UI uses range 20 |
| `sorts` | array | `[{"type": "DATE", "direction": "DESCENDING"}]` (also `SCORE` for relevance) |
| `activeFiltre` | boolean | send `true` (the UI always does) |

Response:

```json
{
  "resultats": [ ... ],
  "offreFilters": [ ... facet counts ... ],
  "totalCount": 3968
}
```

Per-result fields used by the CLI:

| Field | Example | Maps to |
|-------|---------|---------|
| `numeroOffre` | `"179064883W"` | `id` (the public offer number, numeric id + `W`) |
| `id` | `179064883` | internal numeric id (not used in URLs) |
| `intitule` | `"Ingénieur de recherche F/H"` | `title` |
| `nomCommercial` | `"BULL SAS"` | `company` |
| `lieuTexte` | `"Les Clayes-sous-Bois - 78"` | `location` |
| `datePublication` | `"2026-07-09T08:34:55.000+0000"` | `date` (ISO) |
| `salaireTexte` | `"50 - 55 k€ brut annuel"` | `salary` (or `"A négocier"`) |
| `texteOffre` | first ~300 chars of the description | `snippet` |
| `typeContrat` | `101888` | `contract` (code → label) |

Public posting URL (Angular route `detail-offre/:numeroOffre`):

```
https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/{numeroOffre}
```

## Detail

```
GET https://www.apec.fr/cms/webservices/offre/public?numeroOffre={numeroOffre}
```

- `numeroOffre` **must include the trailing `W`** (`179064883W`); the bare
  numeric id returns 404. Unknown offers also return 404 (Tomcat HTML error
  page, not JSON).
- Do **not** use `GET /cms/webservices/offre/{id}` — that is the
  recruiter-side service and returns **401** anonymously.

Response fields used by the CLI:

| Field | Meaning |
|-------|---------|
| `numeroOffre`, `intitule` | id, title |
| `enseigne` / `nomCompteEtablissement` | company (either may be empty for confidential offers) |
| `lieux[].libelleLieu` | location(s), e.g. `"Les Clayes-sous-Bois - 78"` |
| `datePublication`, `datePremierePublication` | ISO dates |
| `salaireTexte` | salary text — APEC postings usually state one |
| `idNomTypeContrat` | contract code (same nomenclature as search) |
| `texteHtml` | main description (HTML with named entities: `&rsquo;`, `&egrave;`…) |
| `texteHtmlProfil` | "profil recherché" section (HTML) |
| `texteHtmlEntreprise` | company blurb (HTML) |
| `competences[].libelle` | skills/languages tags (`type`: `SAVOIR_FAIRE`/`LANGUE`) |
| `offreConfidentielle` | boolean |

## Location autocomplete (used by `--location`)

```
GET https://www.apec.fr/cms/webservices/autocompletion/lieuautocomplete?q={text}&max=10&byLeftAndRight=false
```

Returns `[{"lieuDisplay": "Paris - 75", "lieuId": 75, "lieuType":
"FR_DEPARTEMENT", ...}]`. **`byLeftAndRight=false` is important** — without it
matching is infix/fuzzy and "paris" returns "Cormeilles-en-Parisis" first;
with it, results are prefix-matched and the first hit is the expected one
(`Paris - 75`, `Lyon - 69`). Types: `FR_COMMUNE`, `FR_COMMUNE_A_ARRONDISSEMENT`,
`FR_DEPARTEMENT`, `FR_REGION`, `FR_FRANCE`, `ZONE_MONDE`. The CLI takes the
first suggestion's `lieuId` and passes it in the search body's `lieux`.

## Referentiels (code → label lookups)

```
POST https://www.apec.fr/cms/webservices/referentielstatique/presentations/visuels/liste/hierarchie
Content-Type: application/json
Accept: application/json          <- 406 without it
{"codesPresentations": ["RECHERCHE_OFFRE_TYPE_CONTRAT"]}
```

Verified nomenclatures (hardcoded in the CLI so it makes no extra calls):

- `POSITION_DURATION_FILTERING_SERVICE_DOMAIN`: 101850 "Dernières 24h",
  101851 "Les 7 derniers jours", 101852 "Les 30 derniers jours",
  101853 "Toutes les offres".
- `RECHERCHE_OFFRE_TYPE_CONTRAT`: 101888 CDI, 101887 CDD, 20053 Alternance,
  101930 Intérim, 597141 CDI intérimaire, 101889 "Mission d'intérim",
  597137/597138 CDD-Alternance (apprentissage/professionnalisation),
  597139/597140 CDI-Alternance, 597171 Stage.

## Quirks

- The detail webservice's HTML fields use **named** entities (`&rsquo;`,
  `&eacute;`, `&egrave;`, `&ugrave;`…), not just numeric ones — the entity
  decoder must handle the common French set.
- `salaireTexte` is free text; "A négocier" means undisclosed.
- Confidential offers (`offreConfidentielle: true`) may carry an empty or
  placeholder company name.
- Search's `datePublication` is refreshed when an offer is renewed;
  `datePremierePublication` (detail only) is the original date.
- The Angular UI sends many more body keys (`pointGeolocDeReference`,
  `distance`, `salaireMinimum`/`salaireMaximum` defaults 20/200, `fonctions`,
  `secteursActivite`, `typesTeletravail`…) — all optional; the minimal body
  documented above is verified to work.
