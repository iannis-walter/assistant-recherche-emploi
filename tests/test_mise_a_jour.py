import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOTES_V1 = "# Notes de version\n\n## 1.0.0 — 2026-11-11\nPremière version.\n"
NOTES_V11 = (
    "# Notes de version\n\n## 1.1.0 — 2026-12-01\nNouvelle commande de test.\n\n"
    "## 1.0.0 — 2026-11-11\nPremière version.\n"
)
GIT_ENV = {
    "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "t@example.com",
    "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "t@example.com",
}


def git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=repo, check=True, capture_output=True, text=True,
        env=dict(os.environ, **GIT_ENV),
    ).stdout


class MiseAJourTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.origin = base / "origin.git"
        self.dev = base / "dev"
        self.user = base / "Recherche d'emploi"
        git(base, "init", "-q", "--bare", "-b", "main", str(self.origin))
        git(base, "clone", "-q", str(self.origin), str(self.dev))
        git(self.dev, "checkout", "-q", "-b", "main")
        (self.dev / "tools").mkdir()
        shutil.copy(ROOT / "tools" / "mise_a_jour.sh", self.dev / "tools" / "mise_a_jour.sh")
        shutil.copy(ROOT / "tools" / "profil.py", self.dev / "tools" / "profil.py")
        (self.dev / "tools" / "installer.sh").write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        (self.dev / "VERSION").write_text("1.0.0\n", encoding="utf-8")
        (self.dev / "NOTES-DE-VERSION.md").write_text(NOTES_V1, encoding="utf-8")
        (self.dev / "CLAUDE.md").write_text("# moteur\n", encoding="utf-8")
        (self.dev / ".gitignore").write_text("profil/\n", encoding="utf-8")
        git(self.dev, "add", "-A")
        git(self.dev, "commit", "-q", "-m", "v1.0.0")
        git(self.dev, "push", "-q", "origin", "main")
        git(base, "clone", "-q", str(self.origin), str(self.user))

    def tearDown(self):
        self._tmp.cleanup()

    def release(self, version="1.1.0", notes=NOTES_V11, extra=None):
        (self.dev / "VERSION").write_text(version + "\n", encoding="utf-8")
        (self.dev / "NOTES-DE-VERSION.md").write_text(notes, encoding="utf-8")
        if extra:
            extra(self.dev)
        git(self.dev, "commit", "-q", "-am", version)
        git(self.dev, "push", "-q", "origin", "main")

    def maj(self, *args):
        return subprocess.run(
            ["bash", str(self.user / "tools" / "mise_a_jour.sh"), *args],
            cwd=self.user, capture_output=True, text=True, env=dict(os.environ, **GIT_ENV),
        )

    def test_verifier_reports_up_to_date(self):
        result = self.maj("verifier")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "a_jour 1.0.0")

    def test_verifier_reports_available_version(self):
        self.release()
        result = self.maj("verifier")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "disponible 1.0.0 1.1.0")

    def test_appliquer_fast_forwards_and_prints_notes(self):
        self.release()
        result = self.maj("appliquer")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((self.user / "VERSION").read_text().strip(), "1.1.0")
        self.assertIn("Nouvelle commande de test.", result.stdout)
        self.assertNotIn("Première version.", result.stdout)

    def test_profil_untouched(self):
        (self.user / "profil").mkdir()
        original = (ROOT / "tests" / "fixtures" / "profil-test" / "profil.md").read_bytes()
        (self.user / "profil" / "profil.md").write_bytes(original)
        self.release()
        result = self.maj("appliquer")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((self.user / "profil" / "profil.md").read_bytes(), original)

    def test_dirty_tree_refuses_then_stash_unblocks(self):
        self.release()
        (self.user / "CLAUDE.md").write_text("# modifié en local\n", encoding="utf-8")
        head = git(self.user, "rev-parse", "HEAD")
        refused = self.maj("appliquer")
        self.assertEqual(refused.returncode, 2)
        self.assertEqual(git(self.user, "rev-parse", "HEAD"), head)
        self.assertEqual(self.maj("mettre-de-cote").returncode, 0)
        result = self.maj("appliquer")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("modifié en local", git(self.user, "stash", "show", "-p"))

    def test_offline_fetch_fails_cleanly(self):
        git(self.user, "remote", "set-url", "origin", str(Path(self._tmp.name) / "absent.git"))
        head = git(self.user, "rev-parse", "HEAD")
        result = self.maj("verifier")
        self.assertEqual(result.returncode, 5)
        self.assertEqual(git(self.user, "rev-parse", "HEAD"), head)
        self.assertEqual(self.maj("appliquer").returncode, 5)

    def test_diverged_history_is_refused(self):
        self.release()
        (self.user / "local.txt").write_text("x\n", encoding="utf-8")
        git(self.user, "add", "local.txt")
        git(self.user, "commit", "-q", "-m", "local")
        result = self.maj("appliquer")
        self.assertEqual(result.returncode, 4)

    def test_self_update_does_not_break_run(self):
        def grow_script(repo):
            script = repo / "tools" / "mise_a_jour.sh"
            lines = script.read_text(encoding="utf-8").splitlines(True)
            filler = "".join(f"# ligne ajoutée {i}\n" for i in range(200))
            script.write_text(lines[0] + filler + "".join(lines[1:]), encoding="utf-8")
        self.release(extra=grow_script)
        result = self.maj("appliquer")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Nouvelle commande de test.", result.stdout)


    def test_untracked_collision_is_reported(self):
        def add_file(repo):
            (repo / "extra").mkdir()
            (repo / "extra" / "nouveau.md").write_text("officiel\n", encoding="utf-8")
            git(repo, "add", "extra/nouveau.md")
        self.release(extra=add_file)
        (self.user / "extra").mkdir()
        (self.user / "extra" / "nouveau.md").write_text("à moi\n", encoding="utf-8")
        result = self.maj("appliquer")
        self.assertEqual(result.returncode, 7, result.stdout + result.stderr)
        self.assertIn("extra/nouveau.md", result.stderr)
        self.assertEqual((self.user / "extra" / "nouveau.md").read_text(encoding="utf-8"), "à moi\n")


if __name__ == "__main__":
    unittest.main()
