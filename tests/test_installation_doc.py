"""Run the bootstrap commands of INSTALLATION.md step 4 against a local origin."""

import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://github.com/iannis-walter/assistant-recherche-emploi.git"
GIT_ENV = {"GIT_AUTHOR_NAME": "T", "GIT_AUTHOR_EMAIL": "t@example.com",
           "GIT_COMMITTER_NAME": "T", "GIT_COMMITTER_EMAIL": "t@example.com"}


def git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True,
                   env=dict(os.environ, **GIT_ENV))


def step4_block():
    text = (ROOT / "INSTALLATION.md").read_text(encoding="utf-8")
    section = text[text.index("## 4."):text.index("## 5.")]
    return re.search(r"```bash\n(.*?)```", section, re.S).group(1)


class BootstrapTests(unittest.TestCase):
    def test_bootstrap_tolerates_claude_settings_and_ds_store(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            origin, dev = base / "origin.git", base / "dev"
            git(base, "init", "-q", "--bare", "-b", "main", str(origin))
            git(base, "init", "-q", "-b", "main", str(dev))
            (dev / "tools").mkdir()
            (dev / "tools" / "installer.sh").write_text("exit 0\n", encoding="utf-8")
            git(dev, "add", "-A")
            git(dev, "commit", "-q", "-m", "v1")
            git(dev, "remote", "add", "origin", str(origin))
            git(dev, "push", "-q", "origin", "main")

            user = base / "Recherche emploi"
            (user / ".claude").mkdir(parents=True)
            (user / ".claude" / "settings.local.json").write_text("{}", encoding="utf-8")
            (user / ".DS_Store").write_bytes(b"\x00")
            script = step4_block().replace(URL, str(origin))
            result = subprocess.run(["bash", "-e", "-c", script], cwd=user, capture_output=True,
                                    text=True, env=dict(os.environ, **GIT_ENV))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((user / "tools" / "installer.sh").is_file())
            self.assertTrue((user / ".claude" / "settings.local.json").is_file())


class AppleWindowAnnouncementTests(unittest.TestCase):
    """The Apple tools window can open behind Claude: only a Dock icon shows (VM test, 2026-11-11)."""

    def test_installation_tells_where_to_find_a_hidden_apple_window(self):
        text = (ROOT / "INSTALLATION.md").read_text(encoding="utf-8")
        section = text[text.index("## 3."):text.index("## 4.")]
        self.assertIn("Dock", section)

    def test_installation_ends_by_restarting_the_app(self):
        # The Claude app keeps the PATH it had at launch: tools installed while it was open
        # are only found after quitting and reopening it (VM test, 2026-11-11).
        text = (ROOT / "INSTALLATION.md").read_text(encoding="utf-8")
        self.assertIn("⌘Q", text[text.index("## 7."):])

    def test_path_fix_asks_to_restart_the_app(self):
        text = (ROOT / ".claude" / "commands" / "diagnostic.md").read_text(encoding="utf-8")
        ligne = next(l for l in text.splitlines() if l.startswith("| `chemins`"))
        self.assertIn("⌘Q", ligne)

    def test_guide_tells_where_to_find_a_hidden_apple_window(self):
        text = (ROOT / "COMMENCER-ICI.md").read_text(encoding="utf-8")
        self.assertIn("Dock", text)


if __name__ == "__main__":
    unittest.main()
