import subprocess
import tempfile
import unittest
from pathlib import Path

from tools.check_private_data import Finding, load_patterns, scan_history, scan_tree


def git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", *args],
        cwd=repo,
        check=True,
        capture_output=True,
    )


class ScanTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)
        git(self.repo, "init", "-q")

    def tearDown(self):
        self._tmp.cleanup()

    def test_finds_case_insensitive_match_in_tracked_file(self):
        (self.repo / "a.md").write_text("Appelez le 06 12 34 56 78\n", encoding="utf-8")
        git(self.repo, "add", "a.md")
        self.assertEqual(
            scan_tree(self.repo, ["06 12 34 56 78"]),
            [Finding("a.md", 1, "06 12 34 56 78")],
        )
        (self.repo / "b.md").write_text("ligne\nEXEMPLE INDUSTRIES\n", encoding="utf-8")
        git(self.repo, "add", "b.md")
        self.assertIn(Finding("b.md", 2, "Exemple Industries"), scan_tree(self.repo, ["Exemple Industries"]))

    def test_ignores_untracked_and_gitignored_files(self):
        (self.repo / "a.md").write_text("Appelez le 06 12 34 56 78\n", encoding="utf-8")
        self.assertEqual(scan_tree(self.repo, ["06 12 34 56 78"]), [])

    def test_history_finds_deleted_content(self):
        (self.repo / "a.md").write_text("Appelez le 06 12 34 56 78\n", encoding="utf-8")
        git(self.repo, "add", "a.md")
        git(self.repo, "commit", "-q", "-m", "one")
        (self.repo / "a.md").write_text("rien\n", encoding="utf-8")
        git(self.repo, "commit", "-q", "-am", "two")
        self.assertEqual(scan_tree(self.repo, ["06 12 34 56 78"]), [])
        found = scan_history(self.repo, ["06 12 34 56 78"])
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].pattern, "06 12 34 56 78")

    def test_blank_and_comment_lines_in_pattern_file_are_skipped(self):
        path = self.repo / "motifs.txt"
        path.write_text("\n# note\n  Projet Orion  \n\n", encoding="utf-8")
        self.assertEqual(load_patterns(path), ["Projet Orion"])


if __name__ == "__main__":
    unittest.main()
