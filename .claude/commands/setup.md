# /setup - Profile Onboarding

You are running the onboarding setup for the job search assistant. Your goal is to collect the user's professional information and populate their profile in `profil/` so the `/apply` workflow works out of the box.

**Talk to the user in plain, friendly French throughout** (the instructions below are in English for maintainers; the quoted messages are templates to say in French). The user may not be technical: never mention Markdown, LaTeX, git or file formats unless they ask.

**Where things go:** everything personal is written under `profil/` (git-ignored). Never write personal data into tracked engine files (`CLAUDE.md`, `.claude/`, `cv/main_example.tex`, `templates/`): that would block future updates.

There are three paths into setup. Step 0 picks the right one; all three converge on Step 3 (file generation) and Step 4 (confirmation).

---

## Step 0: Prepare `profil/`, Welcome & Choose Path

First, silently create the `profil/` folder if it is missing and copy into it every file of `templates/profil/` that is not already there (`profil.md`, `comportement.md`, `evaluation.md`, `accroches-cv.md`, `star.md`, `observations.md`, `recherche.md`, `modeles-actifs.md`). **Never overwrite a file that already exists in `profil/`** — that is the user's data.

If `$ARGUMENTS` contains `--section <name>`, prepare `profil/` as described below, then skip directly to that section in Path C for an update-only flow, writing only to the matching `profil/` file. Do not run the path-selection prompt.

Otherwise, before greeting the user, scan the `documents/` folder. Use Glob with `documents/**/*` and count files per subfolder (`cv/`, `linkedin/`, `diplomas/`, `references/`, `applications/`).

Then welcome the user with a single message that lists three paths. The wording changes based on what was found.

**If `documents/` has files** in one or more subfolders, lead with Path A:

> **Welcome to the AI Job Search setup!**
>
> I'll help you build your professional profile so Claude can evaluate job postings, tailor CVs, write cover letters, and prepare you for interviews.
>
> I see files in your `documents/` folder: [list per subfolder, e.g. "2 in cv/, 1 in linkedin/, 3 in references/"]. Three ways to start:
>
> **Path A: Read my documents folder** (recommended for what you have) - I'll read everything in `documents/`, cross-reference for consistency, and build your profile from real source materials. Idempotent and safe to re-run as you add more documents.
>
> **Path B: Single CV import** - Paste or @-mention a single CV/resume here. I'll extract it and ask follow-up questions for what's missing.
>
> **Path C: Interview mode** - I'll walk you through structured questions section by section.
>
> Which would you like?

**If `documents/` is empty or missing**, surface Path A as a "do this if you have materials" option, and add one plain sentence: the easiest start is to drop their current CV into `documents/cv/` and the PDF export of their LinkedIn profile into `documents/linkedin/` (on LinkedIn: *Plus* → *Enregistrer au format PDF*); offer to help them put the files in the right place (they can also just drag the files into this conversation and you save them there):

> **Welcome to the AI Job Search setup!**
>
> I'll help you build your professional profile so Claude can evaluate job postings, tailor CVs, write cover letters, and prepare you for interviews.
>
> Three ways to start:
>
> **Path A: Documents folder** (best signal if you have several materials) - Drop your CV / LinkedIn export / diplomas / reference letters in the `documents/` folder, then say "go". I'll read everything and build your profile from it. See `documents/README.md` for the folder layout.
>
> **Path B: Single CV import** - Paste or @-mention a single CV/resume here. I'll extract it and ask follow-up questions for what's missing.
>
> **Path C: Interview mode** - I'll walk you through structured questions section by section. Good if you're starting from scratch.
>
> Which would you like?

Wait for the user's choice. If they pick A but the folder is still empty, tell them what to add (point at `documents/README.md`) and stop.

---

## Path A: Documents Folder

Reads structured documents in `documents/`, cross-references them for consistency, and merges extracted data into the profile files in `profil/`. Read-before-write and idempotent: changes already present will not be proposed again.

Follow these steps **exactly in order**.

### Step A1: Inventory

Use Glob with `documents/**/*` to scan the full tree. Print:

```
## Documents Found

**cv/**: [list files, or "(empty)"]
**linkedin/**: [list files, or "(empty)"]
**diplomas/**: [list files, or "(empty)"]
**references/**: [list files, or "(empty)"]
**applications/**: [list subfolders with their files, or "(empty)"]

I will read these and cross-reference before proposing any changes.
```

If every subfolder is empty, stop and tell the user to populate the folder. Point at `documents/README.md` for the layout.

### Step A2: Read Existing Skill Files

Read these in parallel before extracting anything. You must know what is already there to make the merge intelligent.

- `profil/profil.md` (header + identity, education, experience, skills, references, motivations)
- `profil/comportement.md` (behavioral profile)
- `profil/evaluation.md` (personal inputs to the scoring framework)
- `profil/accroches-cv.md` (CV profile statements)
- `profil/star.md` (STAR examples and candidates)
- `profil/observations.md` (patterns from past applications)

Also read the engine rules these files feed (read-only, never edit them): `.claude/skills/job-application-assistant/03-writing-style.md`, `04-job-evaluation.md`, `05-cv-templates.md`, `06-cover-letter-templates.md`, `07-interview-prep.md`.

Hold this content in context throughout Path A. Do not re-read.

### Step A3: Parse Documents

Read each document found in Step A1. Process subfolders in this order: `cv/`, `linkedin/`, `diplomas/`, `references/`, `applications/`.

**`cv/` documents:** name, contact (email, phone, LinkedIn, GitHub), education (degree, institution, dates, thesis), work experience (title, company, dates, location, bullets), skills, publications, awards, profile/summary.

**`linkedin/` documents:** About/summary section (full text, used for behavioral inference), work experience, education, skills and endorsements, certifications, volunteer work, publications, recommendations received (full text). If multiple LinkedIn exports are present, use the most recently modified file.

**`diplomas/` documents:** official degree title and level, institution name (official spelling), graduation date, grade or distinction or GPA if visible.

**`references/` documents:** referee name, title, organization; full text of the letter (extract specific quotes); competency language used.

**`applications/<company>_<role>/` subfolders:**
- `job_posting.md`: role title, company, required skills, experience level, sector, role type
- `cover_letter.tex`: opening structure, body structure, bullet style, closing, recurring phrases
- `cv_draft.tex`: profile statement, section ordering, framing for this role type
- `outcome.md`: status (in_progress/hired/offer_declined/rejected/no_response/interview_only), interview stages, notes. Skip `in_progress` applications for calibration — they have no final signal yet.

After reading, proceed to Step A4 without intermediate output. The user sees a complete picture in Step A6.

### Step A4: Cross-Reference Check

Before mapping anything to skill files, check for inconsistencies:

- Date mismatches between CV / LinkedIn / diploma
- Title mismatches across documents for the same role
- Education mismatches (degree name, graduation date)
- Employer name variations

If inconsistencies are found, present them as a numbered list and wait for the user to resolve each one before continuing:

```
## Cross-Reference Issues Found

These need to be resolved before I continue. For each one, tell me which version is correct.

1. **Role title mismatch - [COMPANY]:**
   CV says: "[TITLE_A]"
   LinkedIn says: "[TITLE_B]"
   Which is correct?

2. ...
```

If no inconsistencies, state "No cross-reference issues found." and continue.

### Step A5: Build Change Sets

For each skill file, compare extracted document content against the current file content from Step A2. Build two buckets.

**Additive changes:** entirely new content not in the skill file in any form. Examples: a certification not in `profil/profil.md`, a new endorsement skill, a referee not yet listed, a new behavioral quote from a reference letter, a new award.

**Conflicting changes:** content that touches something already in a skill file but disagrees. Examples: a different date range for an existing job, a different job title for the same role, a different graduation date than what is recorded.

**Inference rules** (apply when populating from inferred sources):

- **`profil/comportement.md`:** Source is LinkedIn About + recommendation letters. Extract recurring themes, adjectives, phrases about how the candidate works. Add only to the "Strongest Behaviors", "How You Work Best", or "Management Style Preferences" sections. Do not overwrite existing scored assessments. Always label inferred additions: *[Inferred from LinkedIn About / Reference letter - review before relying on this]*
- **`profil/observations.md` (style):** Source is `cover_letter.tex` files. Extract recurring patterns. Add as observations under "## Patterns Observed in Past Applications". Never modify `03-writing-style.md` itself. Only add if 2+ cover letters show a genuine pattern.
- **`profil/evaluation.md`:** Source is `job_posting.md` + `outcome.md` pairs. If an application reached interview or offer: note role type and sector as a confirmed strong-fit signal. If 2+ applications repeat a no-response or rejection pattern: note it. Add findings under "## Calibration from Past Applications". Never modify the scoring framework in `04-job-evaluation.md`.
- **`profil/accroches-cv.md`:** Source is `cv_draft.tex` files. Extract any profile statement that does not already appear there. Label with: *[Used for: <company>_<role>]*
- **`profil/observations.md` (cover letters):** Source is `cover_letter.tex` files. Extract opening patterns, bullet structures, closing formulations, under "## Cover Letter Patterns". Add only what is structurally distinct from `06-cover-letter-templates.md`.
- **`profil/star.md`:** Source is CV bullets, LinkedIn descriptions, reference letter quotes. Identify achievements not yet covered by an existing STAR example. Do NOT draft full STAR examples. Add stubs under "## STAR Candidates (Complete Manually)":

```markdown
### [Achievement title]
**Source:** [CV / LinkedIn / Reference letter - role/company]
**What happened:** [one sentence]
**Why it matters:** [interview question types this could answer]
**S/T/A/R stub:**
- Situation:
- Task:
- Action:
- Result:
```

### Step A6: Present and Confirm Changes

Present the full change set before writing anything.

**Additive changes** (single grouped list, organized by target file):

```
## Proposed Additive Changes

### profil/profil.md
- [ ] New certification: [title], [issuer], [date] - extracted from LinkedIn
- [ ] New reference: [name, title, company]
  Quote: "[relevant quote]"

### profil/comportement.md
- [ ] New behavioral observation [labeled as inference]: "[phrase]"

[and so on per file]
```

Then ask:

> **Apply all additive changes?** These add new content without touching anything already in the files.
> Reply **yes** to apply all, or list the numbers you want to skip.

Wait for the response. Apply only the confirmed items.

**Conflicting changes** (one at a time):

```
## Conflict 1 of [N]: Job title - [COMPANY]

**Current in profil/profil.md:**
[TITLE_A] - [COMPANY] ([START]-[END])

**Proposed (from LinkedIn export):**
[TITLE_B] - [COMPANY] ([START]-[END])

Options:
  [keep] Keep the existing text
  [replace] Replace with the version from the document
  [manual] I'll edit this myself - skip for now
```

Wait for the user's choice on each conflict. If no conflicts, state "No conflicting changes found." and skip this section.

### Step A7: Write Confirmed Changes and Fill Gaps

Apply the confirmed changes with the Edit tool. Make targeted edits only. Do not rewrite entire files. State which changes were applied per file. If a file has no confirmed changes, state "No changes made to [filename]."

Documents cover skills, experience, education, references, and behavioral signal. They do not cover everything `/apply` and `/scrape` need. After the writes, ask follow-up questions for gaps:

- Career goals and target role types
- What excites the user in their next role
- Deal-breakers and must-haves
- Salary expectations / baseline (optional)
- CV length (see `cv_pages` in Step 3)
- Commute or location constraints (if not visible from CV)
- Job search configuration (use the questions from Path C Section 9 below)

Then proceed to Step 3 to fill the profile header, the base CV (`profil/cv_base.tex`) and the search strategy (`profil/recherche.md`). Step 3 will detect which `profil/` files Path A already populated and skip those substeps.

---

## Path B: Single CV Import

If the user provides a single CV/resume:

1. Read the document thoroughly.
2. Extract all structured information: name, contact, education, experience, skills, publications, awards.
3. Present a summary of what was extracted.
4. Ask follow-up questions for gaps (behavioral profile, career goals, deal-breakers, salary expectations, references).
5. Proceed to Step 3 (file generation).

---

## Path C: Interview Mode

Walk through each section conversationally. Ask questions naturally, not as a form. Let the user answer in their own words and you'll structure the data.

### Section 1: Identity & Contact
Ask about:
- Full name
- Location (city, country)
- Phone, email, LinkedIn, and a website / portfolio / GitHub only if it matters in their profession
- Languages spoken (with proficiency levels)
- Current employment status
- Family/commute constraints (if any)

### Section 2: Education
For each degree:
- Level (PhD, MSc, BSc, etc.), field, institution, years
- Thesis topic (if applicable)
- Key coursework or topics

Also ask about certifications (online courses, professional certs).

### Section 3: Professional Experience
For each role (most recent first):
- Job title, company, dates, location
- Key responsibilities (3-5 bullets)
- Key achievements or projects
- Technologies/tools used

Also ask about independent projects, freelance work, or side projects.

### Section 4: Skills
Ask for « les compétences clés, outils et logiciels de ton métier », with examples taken from **their** target profession (a recruiter: sourcing, structured interviews, ATS such as Taleo; a nurse: care techniques, patient-record software; an accountant: closing, payroll, Sage; a developer: languages and frameworks). Never assume a technical profile.
- Key skills of their profession + proficiency level
- Tools, software and equipment they use
- Domain expertise
- Licences, certifications or authorisations specific to the job (e.g. CACES, driving licence, nursing diploma)
- Any other skills

### Section 5: Publications & Awards (optional)
- Peer-reviewed papers, conference presentations
- Hackathons, competitions, awards
- Skip if not applicable

### Section 6: Behavioral Profile (optional)
If they have a formal assessment (PI, DISC, Myers-Briggs, StrengthsFinder):
- Ask them to describe or share the results

If not, ask behavioral questions:
- "What work environments do you thrive in?"
- "What drains your energy at work?"
- "How do you prefer to work in teams?"
- "How do you make decisions, quickly or deliberately?"
- "What's your communication style?"
- Synthesize answers into a behavioral profile

### Section 7: Career Goals & Preferences
- Target roles and industries
- What excites you in work
- Deal-breakers and must-haves
- Salary expectations/baseline (optional)
- **CV length:** ask how long their CV should be. Default to **1 page** for under ~10 years of experience or non-executive roles (the French norm), **2 pages** otherwise. Store it as `cv_pages`.
- What environments to avoid
- Commute/location constraints

### Section 8: References (optional)
For each reference:
- Name, title, company, email, phone
- Relationship to the user

### Section 9: Job Search Configuration
This section generates the search queries that power `/scrape`. Use the information from Sections 1, 4, and 7 to build targeted queries.

Ask about:
- **Role titles to search for:** "What job titles should I search for?" (give 2-3 examples from their own field, e.g. for HR: Chargée de recrutement, Chargée RH, Talent Acquisition) Collect 3-8 specific titles.
- **Key skills as search terms:** "Which of your skills are most likely to appear in job postings?" Pick 3-5 that are distinctive and searchable.
- **Target companies (optional):** "Are there specific companies you'd like to monitor for openings?"
- **Geographic scope:** "Which cities or regions should I search in? How far are you willing to commute?" Use this to define the location filter tiers (ideal, acceptable, borderline, too far).
- **Job portals:** choose the relevant portals for their profession yourself and state your choice in one sentence, rather than asking them to know the sites. Welcome to the Jungle and freehire are mostly tech/startup; HelloWork, France Travail and LinkedIn are general; APEC is for cadre/executive roles. If a specialised job board exists for their profession (e.g. healthcare, hospitality, public sector), mention it and offer `/add-portal` to add it. Note: if the user is outside France, acknowledge that the built-in CLI tools are France-specific and suggest they can add their own portal integrations via /add-portal or rely on LinkedIn/Google site-searches.

**Important:** Also suggest role types the user may not have considered, based on their skill profile. For example:
- If they have strong expertise in one domain: "Have you considered advisory or training roles in that domain (consultant, trainer, coordinator)?"
- If their skills are valued in other sectors: "Companies in adjacent industries also hire for these skills. Should I include searches for [adjacent sector]?"
- If they have coordination or mentoring experience: "Would you also want to search for team lead or coordinator roles?"

This proactive suggestion step helps users discover career paths they might not have considered.

---

## Step 3: Generate Profile Files

Once data collection is complete, generate or finish populating the following files, all under `profil/`. **For Path A**, some files are already populated by Step A7; check each before writing and skip what is no longer placeholder text. Never edit tracked engine files.

### 1. Fill the header of `profil/profil.md`
Fill every field of the front matter (between the `---` lines). Keep the format exactly: one `cle: valeur` per line, lists as `[a, b]` with no comma inside an item, `null` when unknown.
- `nom`, `email`, `telephone`, `ville`, `pays`; `linkedin`, `site`, `github` only if they have one (otherwise leave `""`)
- `langues`, `statut`, `metiers_vises` (the 3-8 role titles from Section 9)
- `rayon_km` (commute radius), `teletravail` (`non`, `hybride`, `total` or `indifferent`)
- `salaire_plancher_brut_annuel` (an integer in euros, or `null` if they prefer not to say)
- `criteres_eliminatoires` (short phrases), `cv_pages` (1 or 2)

### 2. Fill the prose of `profil/profil.md` *(Path B and C; skip if Path A populated it)*
Identity, education, professional experience, independent projects, skills, certifications, publications, awards, references, what excites them, target sectors, deal-breakers.

### 3. Populate `profil/comportement.md` *(Path B and C; skip if Path A populated it)*
Write the behavioral profile based on assessment results or synthesized answers.

### 4. Populate `profil/evaluation.md` *(Path B and C; skip if Path A populated it)*
Strong / moderate / weak skill areas, experience areas, career goals, energizing and draining tasks, life situation.

### 5. Populate `profil/accroches-cv.md` *(Path B and C; skip if Path A populated it)*
2-3 role-specific profile statement templates based on their background.

### 6. Populate `profil/star.md` *(Path B and C; skip if Path A populated it)*
Create STAR examples from their actual experience (at least 3-4 examples). Path A leaves STAR stubs under "## STAR Candidates (Complete Manually)" rather than full examples; if any stubs are present, mention them in Step 4 so the user knows to flesh them out.

### 7. Create `profil/cv_base.tex`
Copy `cv/main_example.tex` to `profil/cv_base.tex` (never edit `cv/main_example.tex` itself) and fill it with their actual name, contact info, education and experience entries. Leave out the GitHub link from `\extrainfo{...}` when `github` is empty, and the LinkedIn link when `linkedin` is empty.

### 8. Fill `profil/recherche.md`
Replace all placeholder tokens in the search strategy with the user's information from Section 9 (or the equivalent follow-up questions in Path A's Step A7):
- Replace `[YOUR_PRIMARY_ROLE_TYPE]`, `[YOUR_PRIMARY_JOB_TITLE]`, etc. with actual role titles
- Replace `[YOUR_KEY_SKILL]`, `[YOUR_DOMAIN_KEYWORD_1]`, etc. with actual skills and domain terms
- Replace `[YOUR_CITY]`, `[YOUR_COUNTRY]`, `[YOUR_REGION]` with actual location
- Fill in the location filter tiers (ideal, acceptable, borderline, too far) based on commute constraints
- Organize queries into priority categories matching the user's career direction:
  - Priority 1: Their strongest/most desired role direction
  - Priority 2: Their domain expertise
  - Priority 3: Adjacent roles they could pivot into
  - Priority 4: Broader roles (wider net)

---

## Step 4: Validate, Confirm & Next Steps

Run `python3 tools/profil.py valider profil/profil.md`. If it lists missing or invalid fields, ask the user **only** for those (in plain French, one short question each), fix the header, and run it again until it prints « Profil complet. ». Do not declare setup complete before that.

Then present a short summary in French, for example:

> **C'est prêt !** Ton profil est enregistré sur ton ordinateur, dans le dossier `profil/` (il ne part nulle part ailleurs) :
>
> - ton profil et tes critères (métiers visés, rayon, télétravail, salaire, critères éliminatoires)
> - ton profil comportemental et tes exemples d'entretien (méthode STAR)
> - ton CV de base, d'où partiront tous tes CV adaptés ([cv_pages] page(s))
> - ta stratégie de recherche d'offres
>
> **Pour la suite :**
> - tape `/scrape` pour chercher des offres maintenant
> - colle le lien d'une offre avec `/apply` pour l'analyser et préparer CV + lettre
> - `/setup --section search` permet plus tard d'ajuster ta recherche

If Path A left any STAR stubs in `profil/star.md`, also say that [N] interview examples need their details completed before being used.

---

## Design Principles

- Three onboarding paths converge on the same `profil/` files. Step 0 picks the right path based on what's in `documents/`. Steps 3 and 4 are shared.
- Path A is read-before-write and idempotent. Re-running it as documents are added does not duplicate or overwrite existing content; conflicts are surfaced for explicit resolution.
- Path A labels inferred behavioral or style additions so the user can review them critically before relying on them.
- Each section in Path C is a natural conversation, not a form. The user can skip optional sections.
- Synthesize answers into structured formats (the user does not need to know markdown or LaTeX).
- Can be re-run with `--section <name>` to update specific sections (e.g., `/setup --section search` to reconfigure job search queries without re-doing the full profile).
- Section 9 (search) in Path C, and the equivalent follow-up questions in Path A, proactively suggest role types the user may not have considered.
- At the end, suggest running `/scrape` and `/apply` with a test job posting.
