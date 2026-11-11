# Contributing

This repo is a **French-market specialization** of [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) by Mads Lorentzen (MIT). The upstream project stays market-agnostic by design; this fork is where the French-specific work lives.

## Scope

Welcome here:

- **French portal skills** and fixes to the shipped ones (France Travail, Welcome to the Jungle, APEC, HelloWork) — portals change their markup and APIs, keeping the parsers alive is the main maintenance surface.
- **French conventions**: lettre de motivation structure, CV norms, brut/net salary handling, contract types (CDI/CDD/alternance/stage/VIE), statut cadre.
- **Robustness and correctness fixes** with the failing case demonstrated.
- **Docs** that close real gaps.

Better sent upstream (they will benefit every market, including this one):

- Universal workflow features, new commands, changes to `/setup`/`/apply`/`/rank` logic.
- Improvements to `/add-portal` or `/add-template`.

## The portal-skill contract

Every portal skill honors the same contract so `/scrape` can drive them interchangeably:

- Commands: `search` and `detail <id|url>`, flags `--query`, `--location`, `--jobage`, `--page`, `--limit`, `--format json|table|plain`.
- JSON output `{meta: {count, page}, results: [{id, title, company, location, date, url}]}` — missing values are `null`, never omitted.
- Errors as JSON on stderr, exit 1. Backoff on 429/5xx. Zero runtime dependencies.

See `.claude/commands/add-portal.md` for the full spec.

## Checks

Run what CI runs before opening a PR:

```bash
python3 tools/lint_skills.py
python3 tools/security_guards.py
python3 -m unittest discover -s tests
# in each touched CLI:
bun run typecheck && bun test
```

Portal skills that touch ToS-restricted sources carry a personal-use-only warning, and CI deliberately makes no live portal requests. Don't "fix" that.

## Credit

Incorporated code gets a `Co-authored-by` trailer; fixes written from your report get a named mention in the commit. Both happen unprompted — the norm is inherited from upstream and kept.
