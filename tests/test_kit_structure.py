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
        self.assertIn("profil/", lines)

    def test_templates_present(self):
        for name in TEMPLATES:
            self.assertTrue((ROOT / "templates" / "profil" / name).is_file(), name)
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


if __name__ == "__main__":
    unittest.main()
