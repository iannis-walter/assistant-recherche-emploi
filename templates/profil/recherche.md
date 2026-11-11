# Search Queries for Job Scraper

<!-- SETUP: Customize these queries based on your skills, target roles, and location -->

## Search Sites

Primary (French job market — each has a CLI skill under `.agents/skills/`):
- **francetravail.fr** (ex-Pôle Emploi) - official national job board, free public API
- **welcometothejungle.com** - tech/startup jobs with rich company profiles
- **apec.fr** - executive/cadre positions (usually with stated salary)
- **hellowork.com** - major generalist board (ex-RegionsJob), strong regional coverage
- **linkedin.com/jobs** - LinkedIn job listings (filter: France / your city)

Secondary (no CLI - via WebSearch):
- **fr.indeed.com** - aggregator (anti-bot protected; use Google `site:` searches)
- **cadremploi.fr** - executive positions
- Direct Google searches with `site:` filters for known target companies

## Query Categories

Queries are grouped by priority. Each query should be combined with your location terms (e.g. "Paris", "Île-de-France", "Lyon") where the site supports it.

### Priority 1: [YOUR_PRIMARY_ROLE_TYPE]

These match your strongest and most desired career direction.

```
site:welcometothejungle.com "[YOUR_PRIMARY_JOB_TITLE]" [YOUR_CITY]
site:hellowork.com "[YOUR_KEY_SKILL]" [YOUR_CITY]
site:linkedin.com/jobs "[YOUR_PRIMARY_JOB_TITLE]" [YOUR_COUNTRY]
```

### Priority 2: [YOUR_DOMAIN_EXPERTISE]

These match your domain expertise.

```
site:apec.fr [YOUR_DOMAIN_KEYWORD_1] [YOUR_CITY] OR [YOUR_REGION]
site:hellowork.com [YOUR_DOMAIN_KEYWORD_2] [YOUR_COUNTRY]
site:linkedin.com/jobs [YOUR_DOMAIN_KEYWORD_1] [YOUR_CITY] [YOUR_COUNTRY]
```

### Priority 3: [YOUR_ADJACENT_ROLE_TYPE]

Adjacent roles you could pivot into.

```
site:welcometothejungle.com "[YOUR_ADJACENT_TITLE_1]" [YOUR_KEY_SKILL] [YOUR_CITY]
site:hellowork.com "[YOUR_ADJACENT_TITLE_2]" [YOUR_KEY_SKILL] [YOUR_CITY]
```

### Priority 4: Broader Technical / Consulting

Wider net for general technical roles.

```
site:hellowork.com [YOUR_KEY_SKILL] développeur [YOUR_CITY]
site:linkedin.com/jobs "[YOUR_KEY_SKILL] developer" [YOUR_CITY]
site:apec.fr "consultant technique" [YOUR_DOMAIN] [YOUR_CITY]
```

Note: search in **both French and English** — French postings mix both freely ("développeur Python" and "Python developer" return different result sets).

## Location Filter

When evaluating results, verify the job location is within reasonable commute distance from your home. Define acceptable areas:
- [YOUR_CITY] and surrounding areas
- [ACCEPTABLE_AREA_1]
- [ACCEPTABLE_AREA_2]
- [BORDERLINE_AREA] (borderline - ~X min by transit)
- [TOO_FAR_AREA] (too far)

Remote/hybrid vocabulary to watch for in French postings: "télétravail", "full remote", "hybride", "2j/semaine de TT".

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
