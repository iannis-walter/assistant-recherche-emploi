# HelloWork URL & Parsing Reference

Reconnaissance notes for `hellowork-search` (verified live with plain `curl`,
July 2026). This is the file to update when HelloWork changes its markup.

## Access & terms

- **robots.txt** (`https://www.hellowork.com/robots.txt`): for `User-Agent: *`,
  `Disallow: /*?` and `Disallow: /fr-fr/emploi/recherche.html` — the search
  path is disallowed for generic crawlers. Detail pages
  (`/fr-fr/emplois/{id}.html`) are not disallowed. (Interestingly, AI crawlers
  — GPTBot, ccbot, etc. — are explicitly *allowed* on `/*?`.)
- **CGU**: every page's HTML source opens with a comment citing CGU art. 8.2 —
  automated extraction ("screen scraping / web scraping") is prohibited
  without a written license, private and non-commercial use only.
- **Consequence**: the skill carries a prominent personal-use-only warning;
  keep volume low.
- Plain `fetch`/`curl` with a browser User-Agent works fine — no Cloudflare or
  anti-bot challenge was encountered (HTTP 200, ~600 KB per search page).

## Search

```
GET https://www.hellowork.com/fr-fr/emploi/recherche.html?k=<keywords>&l=<location>&p=<page>&d=<facet>
```

| Param | Meaning | Notes |
|-------|---------|-------|
| `k`   | keywords | URL-encoded, e.g. `k=d%C3%A9veloppeur` |
| `l`   | location | city / département / region text, e.g. `l=Paris` |
| `p`   | page, 1-indexed | pagination is a GET form with submit buttons `name="p"`; `p=2` etc. work as plain query params (verified: pages 1 and 2 return 30 distinct offers each) |
| `d`   | posting age facet | `all` (default), `h` = last 24h, `d` = last 3 days, `w` = last week, `m` = last month (radio inputs `name="d"`) |

Other facets exist (contract `c`, telework, salary…) but are not needed for
the contract flags.

### Results markup (30 cards/page)

No ItemList JSON-LD and no embedded JSON blob; results are server-rendered
HTML. Anchors per result:

- Split anchor: each result `<li>` carries `data-id-storage-item-id="{id}"`
  (id also in `data-hide-offer-item-id-value`).
- **id / title / company**: the hide-offer form inside each `<li>` has hidden
  inputs — `name="offerId"`, `name="title"`, `name="company"` (company `value`
  is empty for anonymous offers). These are the cleanest source.
- **url**: `href="/fr-fr/emplois/{id}.html"` on the `data-cy="offerTitle"`
  link; can be reconstructed from the id.
- **location**: `<div ... data-cy="localisationCard">Paris 9e - 75</div>`
- **contract**: `<div ... data-cy="contractCard">CDI</div>`
- **salary** (when shown, ~half of offers):
  `<div class="readonly tag-secondary-s typo-s-bold w-fit border-0">45 000 - 55 000 € / an</div>`
  (no data-cy; class-anchored; uses U+202F narrow no-break spaces)
- **date**: `<div class="typo-s text-grey-500 pl-1 pt-1">il y a 5 jours</div>`
  — relative French label only; the CLI converts to approximate ISO.
- **total count**: the `<h1>` contains e.g. `2 025 offres`.

Other stable `data-cy` on cards: `serpCard`, `offerTitle`, `hideOfferBtn`,
`bookmarkBtn`, `contractTag` (telework tag).

## Detail

```
GET https://www.hellowork.com/fr-fr/emplois/{id}.html
```

~200 KB, HTTP 200, 404 for unknown ids. **No JobPosting JSON-LD** (only
WebSite / Organization / BreadcrumbList). Anchors:

- **title**: `<span ... data-cy="jobTitle">…</span>` inside the `<h1>`.
- **company**: `<a href="/fr-fr/entreprises/{slug}.html">Name</a>` right after
  the title inside the `<h1>`; absent for anonymous offers. Fallback:
  dataLayer `"Nom-Entreprise":"…"` (lowercased slug).
- **location + contract**: first `<ul class="mt-3 inline-flex">` after the
  title; two `<li class="typo-long-m-bold …">` items (location, contract).
- **salary**: `data-cy="salary-tag-button"` button → inner `<span>` text.
- **tags** (telework, education level, sector, experience): header
  `<ul class="flex flex-wrap gap-3">` items
  `<li class="…tag-secondary-s border-0 readonly…">`.
- **date**: GTM dataLayer push in `<head>`:
  `"datePublicationOffre":"20260704"` (YYYYMMDD). Visible fallback:
  `Publiée le 04/07/2026` near the bottom. dataLayer also has `"contrat"`,
  `"idOffre"`, `"Ville"`, etc.
- **description**: section/details blocks, each with a heading
  `<span class="text-left typo-m-bold …">Heading</span>`:
  - main block ("Les missions du poste" / "Détail du poste"): body div with
    `data-truncate-text-target="content"`;
  - collapsible blocks ("Le profil recherché", "Infos complémentaires",
    company blurb): body `<div class="typo-long-m break-words">`.
  The parser pairs each body with the nearest preceding heading. Bodies
  contain `<p>/<br>/<ul>/<li>/<strong>` HTML.

## Quirks

- Salary and numbers use U+202F (narrow no-break space) as thousands
  separator — normalize when cleaning text.
- Detail pages embed *suggested-offer* cards further down the page
  (`bookmark-frame-card…`), so field regexes must be scoped to the header
  region (the parser slices around the `jobTitle` index).
- ESN offers show an extra "publiée par une ESN" notice block; harmless.
- The apply button (`data-cy="applyButtonHeader"`) points at `#postuler` or an
  external ATS redirect (`/fr-fr/offer/redirect` — disallowed by robots.txt);
  no stable public apply URL is exposed, so the skill doesn't emit one.
