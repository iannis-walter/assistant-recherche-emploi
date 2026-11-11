import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORDER = '#!/bin/sh\necho "$(basename "$0") $(pwd) $*" >> "$JOURNAL"\nexit 0\n'


class CompilerTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.kit = base / "kit d'essai"
        (self.kit / "tools").mkdir(parents=True)
        (self.kit / "cv").mkdir()
        (self.kit / "cover_letters").mkdir()
        shutil.copy(ROOT / "tools" / "compiler.sh", self.kit / "tools" / "compiler.sh")
        self.bin = base / "bin"
        self.bin.mkdir()
        for name in ("lualatex", "xelatex"):
            path = self.bin / name
            path.write_text(RECORDER, encoding="utf-8")
            path.chmod(path.stat().st_mode | stat.S_IXUSR)
        self.journal = base / "journal.txt"

    def tearDown(self):
        self._tmp.cleanup()

    def compile(self, rel):
        env = dict(os.environ, PATH=f"{self.bin}:/usr/bin:/bin", JOURNAL=str(self.journal))
        return subprocess.run(["bash", str(self.kit / "tools" / "compiler.sh"), rel],
                              cwd=self.kit, capture_output=True, text=True, env=env)

    def test_cv_uses_lualatex_without_shell_escape(self):
        (self.kit / "cv" / "main_x.tex").write_text("x", encoding="utf-8")
        result = self.compile("cv/main_x.tex")
        self.assertEqual(result.returncode, 0, result.stderr)
        line = self.journal.read_text(encoding="utf-8")
        self.assertTrue(line.startswith("lualatex "), line)
        self.assertIn("-no-shell-escape", line)
        self.assertIn(str(self.kit / "cv"), line)

    def test_cover_letter_uses_xelatex(self):
        (self.kit / "cover_letters" / "cover_x.tex").write_text("x", encoding="utf-8")
        self.assertEqual(self.compile("cover_letters/cover_x.tex").returncode, 0)
        self.assertTrue(self.journal.read_text(encoding="utf-8").startswith("xelatex "))

    def test_refuses_files_elsewhere(self):
        (self.kit / "autre.tex").write_text("x", encoding="utf-8")
        self.assertEqual(self.compile("autre.tex").returncode, 1)
        self.assertFalse(self.journal.exists())


if __name__ == "__main__":
    unittest.main()
