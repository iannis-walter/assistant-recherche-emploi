"""Structural guarantees of the kit: engine and profile stay separated."""

import subprocess
import unittest
from pathlib import Path

from tools.profil import CHAMPS_OBLIGATOIRES, lire_profil

ROOT = Path(__file__).resolve().parent.parent

TEMPLATES = (
    "profil.md",
    "comportement.md",
    "evaluation.md",
    "accroches-cv.md",
    "star.md",
    "observations.md",
    "recherche.md",
    "modeles-actifs.md",
)
OLD_PROFILE_PATHS = ("01-candidate-profile.md", "02-behavioral-profile.md", "search-queries.md")
STALE_PATH_EXEMPT = {"NOTES-DE-VERSION.md"}
PLACEHOLDER_ALLOWED = {
    "cv/main_example.tex",
    "cover_letters/cover_example.tex",
    ".claude/skills/job-application-assistant/05-cv-templates.md",
    ".claude/skills/job-application-assistant/06-cover-letter-templates.md",
    # These document or check the placeholder convention itself:
    ".claude/commands/add-template.md",
    ".claude/commands/setup.md",
    ".github/workflows/ci.yml",
}


def tracked_files():
    out = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
    ).stdout.decode("utf-8")
    return [p for p in out.split("\0") if p and (ROOT / p).is_file()]


def read(rel):
    return (ROOT / rel).read_bytes().decode("utf-8", errors="replace")


class KitStructureTests(unittest.TestCase):
    def test_gitignore_ignores_profil(self):
        lines = {line.strip() for line in read(".gitignore").splitlines()}
        # Anchored to the root: a bare "profil/" would also ignore templates/profil/.
        self.assertIn("/profil/", lines)
        self.assertNotIn("profil/", lines)

    def test_templates_present(self):
        tracked = set(tracked_files())
        for name in TEMPLATES:
            # Tracked by git, not just present on disk: the published repo must ship them.
            self.assertIn(f"templates/profil/{name}", tracked, name)
        entete = lire_profil(ROOT / "templates" / "profil" / "profil.md")
        for champ in CHAMPS_OBLIGATOIRES:
            self.assertIn(champ, entete)
        self.assertEqual(entete["version_profil"], 1)

    def test_no_stale_profile_paths(self):
        offenders = []
        for rel in tracked_files():
            if rel in STALE_PATH_EXEMPT or rel.startswith("tests/"):
                continue
            text = read(rel)
            for old in OLD_PROFILE_PATHS:
                if old in text:
                    offenders.append(f"{rel}: {old}")
        self.assertEqual(offenders, [])

    def test_claude_md_is_engine_only(self):
        text = read("CLAUDE.md")
        self.assertIn("@profil/profil.md", text)
        self.assertNotIn("[YOUR_", text)
        self.assertNotIn("Claude Code** by name", text)

    def test_placeholders_only_in_allowed_files(self):
        offenders = []
        for rel in tracked_files():
            if rel in PLACEHOLDER_ALLOWED or rel.startswith("templates/") or rel.startswith("tests/"):
                continue
            text = read(rel)
            if "[YOUR_" in text or "[YOUR NAME]" in text:
                offenders.append(rel)
        self.assertEqual(offenders, [])

    def test_neutral_wording(self):
        banned = ("technical skills match", "programming languages", "ml/ai frameworks",
                  "broader technical", "data scientist")
        offenders = []
        for rel in tracked_files():
            if not (rel.startswith(".claude/") or rel.startswith("templates/")):
                continue
            text = read(rel).lower()
            offenders += [f"{rel}: {b}" for b in banned if b in text]
        self.assertEqual(offenders, [])

    def test_cv_length_comes_from_profile(self):
        hardcoded = ("keep to 2 pages", "exactly 2 pages", "must be exactly 2",
                     "hard 2-page limit", "any page count other than 2")
        for rel in (".claude/commands/apply.md",
                    ".claude/skills/job-application-assistant/05-cv-templates.md"):
            text = read(rel)
            for phrase in hardcoded:
                self.assertNotIn(phrase, text.lower(), f"{rel}: {phrase}")
            self.assertIn("cv_pages", text, rel)

    def test_no_developer_only_rules_left(self):
        for rel in tracked_files():
            if not rel.startswith(".claude/"):
                continue
            text = read(rel)
            self.assertNotIn("**Claude Code** by name", text, rel)
            self.assertNotIn("Always in **English**", text, rel)

    def test_commencer_ici_mentions_essentials(self):
        text = read("COMMENCER-ICI.md")
        for needle in (
            "Pro",
            "raw.githubusercontent.com/iannis-walter/assistant-recherche-emploi/main/INSTALLATION.md",
            "/diagnostic",
            "Enregistrer au format PDF",
            "curl",
        ):
            self.assertIn(needle, text)


    def test_every_command_has_preflight(self):
        exempt = {"setup.md", "reset.md", "diagnostic.md", "mise-a-jour.md"}
        missing = [p.name for p in (ROOT / ".claude" / "commands").glob("*.md")
                   if p.name not in exempt and "**Preflight (always first).**" not in p.read_text(encoding="utf-8")]
        self.assertEqual(missing, [])

    def test_settings_compile_through_wrapper_only(self):
        settings = read(".claude/settings.json")
        self.assertNotIn("Bash(lualatex", settings)
        self.assertNotIn("Bash(xelatex", settings)
        self.assertIn("Bash(bash tools/compiler.sh:*)", settings)

    def test_guides_announce_documents_access_prompt(self):
        for rel in ("INSTALLATION.md", "COMMENCER-ICI.md"):
            self.assertIn("accéder au dossier Documents", read(rel), rel)

    def test_installation_runs_long_steps_without_default_timeout(self):
        text = read("INSTALLATION.md")
        self.assertIn("600000", text)
        self.assertIn("installer.sh etat", text)

    def test_vm_doc_moves_versions_forward_only(self):
        text = read("docs/test-vm.md")
        self.assertNotIn("Annule", text)
        self.assertIn("1.0.3", text)


if __name__ == "__main__":
    unittest.main()
