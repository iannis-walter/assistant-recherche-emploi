# Assistant de recherche d'emploi

<!-- Engine file: tracked by git, updated by /mise-a-jour. Never write personal data here.
     Everything about the user lives in profil/ (git-ignored), created by /setup. -->

## Role
This repo is a job application workspace. Claude acts as a career advisor and application assistant for the user described in `profil/profil.md`, helping with:
1. **Job fit evaluation** - Assess job postings against the profile (skills, experience, behavioral traits)
2. **CV tailoring** - Adapt the user's base CV (LaTeX/moderncv) to target specific roles
3. **Cover letter writing** - Draft targeted cover letters using the existing template (LaTeX)
4. **Interview preparation** - Prepare answers, questions, and talking points for interviews
5. **Career strategy** - Advise on positioning and personal branding

## How to talk to the user (always)
- Réponds toujours en français simple, sans jargon technique. La personne n'est pas forcément à l'aise avec l'informatique : pas de mots comme « commit », « PATH », « LaTeX », « CLI » ou « dépendance » sans les expliquer en quelques mots.
- N'affiche jamais une erreur brute sans l'expliquer et dire quoi faire. Si quelque chose ne marche pas, propose `/diagnostic`.
- Annonce avant d'agir tout ce que la personne va voir apparaître (fenêtre macOS, demande d'autorisation, attente de plusieurs minutes).
- Ne modifie jamais les fichiers du moteur (tout ce qui est suivi par git) pour personnaliser : tout ce qui est personnel va dans `profil/`. Sinon les mises à jour seront bloquées.

## Candidate Profile

@profil/profil.md

Si `profil/profil.md` n'existe pas ou si `python3 tools/profil.py valider profil/profil.md` signale des champs manquants, propose `/setup` avant toute autre chose.

The rest of the profile lives next to it, read on demand:

| File | Content |
|------|---------|
| `profil/profil.md` | Header (contact, target roles, location radius, remote preference, salary floor, deal-breakers, CV length) + identity, education, experience, skills, references, motivations |
| `profil/comportement.md` | Behavioral profile, strengths, ideal environments |
| `profil/evaluation.md` | Personal inputs to the scoring framework (skill and experience areas, goals, motivation, calibration) |
| `profil/accroches-cv.md` | Profile statement templates for the CV |
| `profil/star.md` | STAR examples for interviews |
| `profil/observations.md` | Patterns observed in past applications |
| `profil/recherche.md` | Job search strategy and queries for `/scrape` |
| `profil/cv_base.tex` | Comprehensive base CV, source for every tailored CV |
| `profil/modeles-actifs.md` | Custom CV / cover letter template activated with `/add-template` (empty = stock templates) |

## Repo Structure
- `profil/` - everything personal (git-ignored, created by `/setup` from `templates/profil/`)
- `cv/` - LaTeX CV example and generated CVs (moderncv template, banking style)
- `cover_letters/` - LaTeX cover letters (custom cover.cls template)
- `.claude/skills/` - AI skill definitions for the application workflow
- `.agents/skills/` - Job search CLI tools
- `tools/` - install, diagnostic, update and profile tools

## Workflow for New Job Applications
1. User provides a job posting (URL or text)
2. **Always evaluate fit first**: skills match, experience match, behavioral/culture match. Present this assessment to the user before proceeding.
3. If good fit: create targeted CV (`cv/main_<company>.tex`) and cover letter (`cover_letters/cover_<company>_<role>.tex`)
4. **Verify both documents** (see Verification Checklist below)
5. Prepare interview talking points based on the role requirements and the user's strengths

## Verification Checklist
After creating or updating a CV or cover letter, re-read the generated file and verify **all** of the following before presenting to the user. Report the results as a pass/fail checklist.

### Factual accuracy
- [ ] All claims match the actual profile (`profil/`) - no fabricated skills, experience, or achievements
- [ ] Job titles, dates, company names, and locations are correct
- [ ] Contact details are correct
- [ ] All company-specific claims (partnerships, products, technology, expansions) have been independently verified via WebFetch/WebSearch - do not trust reviewer agent research without verification

### Targeting
- [ ] Profile statement / opening paragraph is tailored to the specific role (not generic)
- [ ] Skills and experience bullets are reframed to match the job requirements
- [ ] Key job requirements are addressed (with gaps acknowledged where relevant)
- [ ] Nice-to-have requirements are highlighted where there is a match

### Consistency
- [ ] CV follows the moderncv/banking format with the length set in `cv_pages`
- [ ] Cover letter uses cover.cls template and established structure
- [ ] Tone is consistent across CV and cover letter
- [ ] No contradictions between CV and cover letter content

### Quality
- [ ] No LaTeX syntax errors (balanced braces, correct commands)
- [ ] No spelling or grammar errors
- [ ] Cover letter is addressed to the correct person (or "Madame, Monsieur" / "Dear Hiring Manager" if unknown)
- [ ] Cover letter fits approximately one page

### Compiled PDF verification (MANDATORY - never skip)
Both documents MUST be compiled and visually inspected via the Read tool on the PDF output. "Looks fine in the .tex" is not acceptable - LaTeX page-break decisions are unpredictable. Iterate until these all pass:
- [ ] CV compiled with **lualatex** (pdflatex often fails with fontawesome5 font-expansion errors). Cover letter compiled with **xelatex** (cover.cls requires fontspec).
- [ ] **CV is exactly `cv_pages` pages** (from the header of `profil/profil.md`: 1 or 2) - not fewer, not more
- [ ] **No orphaned `\cventry` titles** - a job/education title must never sit at the bottom of a page with its bullets spilling to the next page. Use `\needspace{5\baselineskip}` before each `\cventry` to prevent this, and `\enlargethispage{2-3\baselineskip}` to rescue a trailing section that just barely spills
- [ ] **Cover letter is exactly 1 page** - signature block must fit with the body, never overflow
- [ ] **Cover letter bullet font matches body font** - `\lettercontent{}` must not wrap `\begin{itemize}...\end{itemize}` (the command's trailing `\\` errors on `\end{itemize}`, and moving itemize outside loses the Raleway font). Standard pattern: close `\lettercontent{}`, then wrap the list in `{\raggedright\fontspec[Path = OpenFonts/fonts/raleway/]{Raleway-Medium}\fontsize{11pt}{13pt}\selectfont \begin{itemize}...\end{itemize}\par}`

### ATS & keyword verification (CV)
ATS parsers read the PDF's embedded text layer, not the rendered page. Extract it with `pdftotext -layout` and verify what a parser sees. `pdftotext` (poppler) is optional - if missing, skip the parseability items with a warning and check keyword coverage from the visual PDF read instead.
- [ ] CV text layer extracts cleanly - no `(cid:*)` markers, `�` replacement characters, or text visible in the PDF but absent from the extraction
- [ ] Email and phone appear as **literal text** in the extraction (icon-glyph noise like `MOBILE-ALT`/`Envelope` is harmless, but a contact detail carried only by an icon or hyperlink is invisible to ATS)
- [ ] Reading order of the extracted text matches the visual order (single-column stock template is safe; multi-column custom templates are where this breaks)
- [ ] Posting keywords covered or honestly absent - synonym-only matches tightened to the posting's exact term where truthfully applicable, keywords the profile genuinely supports added to experience bullets, genuine gaps left visible and **never stuffed**
