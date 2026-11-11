import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools.diagnostic import verifier

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "tests" / "fixtures" / "profil-test" / "profil.md"
KPSEWHICH = '#!/bin/sh\nfor f in "$@"; do echo "/fake/texmf/$f"; done\n'
OK_STUB = "#!/bin/sh\nexit 0\n"


def stub(directory: Path, name: str, body: str = OK_STUB) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    path.write_text(body, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.racine = base / "kit"
        self.home = base / "home"
        self.bin = base / "bin"
        self.racine.mkdir()
        self.home.mkdir()
        self.bin.mkdir()

    def tearDown(self):
        self._tmp.cleanup()

    def all_tools(self):
        for name in ("git", "bun", "lualatex", "xelatex"):
            stub(self.bin, name)
        stub(self.bin, "kpsewhich", KPSEWHICH)

    def profile(self, text=None):
        (self.racine / "profil").mkdir(exist_ok=True)
        (self.racine / "profil" / "profil.md").write_text(
            text if text is not None else FIXTURE.read_text(encoding="utf-8"), encoding="utf-8"
        )

    def run_checks(self, pour=None):
        with mock.patch.dict(os.environ, {"PATH": str(self.bin)}):
            return {v.id: v for v in verifier(self.racine, self.home, pour)}

    def test_all_present_is_ok(self):
        self.all_tools()
        self.profile()
        (self.racine / ".env").write_text(
            "FRANCETRAVAIL_CLIENT_ID=abc\nFRANCETRAVAIL_CLIENT_SECRET=def\n", encoding="utf-8"
        )
        checks = self.run_checks()
        self.assertEqual(
            set(checks),
            {"git", "python", "bun", "lualatex", "xelatex", "paquets_tex", "profil", "france_travail"},
        )
        self.assertTrue(all(v.ok for v in checks.values()), [v for v in checks.values() if not v.ok])

    def test_profile_missing_is_blocking(self):
        self.all_tools()
        profil = self.run_checks()["profil"]
        self.assertFalse(profil.ok)
        self.assertTrue(profil.bloquant)
        self.assertEqual(profil.correctif, "setup")

    def test_profile_incomplete_is_blocking(self):
        self.all_tools()
        text = FIXTURE.read_text(encoding="utf-8").replace("cv_pages: 1\n", "")
        self.profile(text)
        profil = self.run_checks()["profil"]
        self.assertFalse(profil.ok)
        self.assertTrue(profil.bloquant)
        self.assertIn("cv_pages", profil.message)

    def test_tool_found_off_path_reports_path_fix(self):
        stub(self.home / ".bun" / "bin", "bun")
        bun = self.run_checks()["bun"]
        self.assertTrue(bun.ok)
        self.assertEqual(bun.correctif, "chemins")

    def test_messages_keep_proper_nouns(self):
        self.all_tools()
        checks = self.run_checks()
        self.assertIn("LuaLaTeX", checks["lualatex"].message)
        self.assertIn("Apple", checks["git"].message)
        self.assertTrue(checks["bun"].message.startswith("L'outil"))

    def test_missing_tool_points_to_installer_step(self):
        bun = self.run_checks()["bun"]
        self.assertFalse(bun.ok)
        self.assertEqual(bun.correctif, "installer:bun")

    def test_pour_scrape_ignores_tex(self):
        stub(self.bin, "git")
        stub(self.bin, "bun")
        self.profile()
        checks = self.run_checks("scrape")
        self.assertNotIn("lualatex", checks)
        self.assertTrue(all(v.ok for v in checks.values() if v.bloquant))

    def test_france_travail_never_blocks(self):
        self.all_tools()
        self.profile()
        ft = self.run_checks()["france_travail"]
        self.assertFalse(ft.ok)
        self.assertFalse(ft.bloquant)
        self.assertEqual(ft.correctif, "france_travail")

    def test_json_output_shape(self):
        self.all_tools()
        self.profile()
        env = dict(os.environ, PATH=f"{self.bin}{os.pathsep}{Path(sys.executable).parent}")
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools" / "diagnostic.py"), "--json",
             "--racine", str(self.racine), "--home", str(self.home)],
            capture_output=True, text=True, env=env,
        )
        data = json.loads(result.stdout)
        self.assertIsInstance(data, list)
        for item in data:
            self.assertEqual(set(item), {"id", "ok", "bloquant", "message", "correctif"})
        self.assertEqual(result.returncode, 0)

    def test_exit_code_is_1_when_blocking_check_fails(self):
        env = dict(os.environ, PATH=f"{self.bin}{os.pathsep}{Path(sys.executable).parent}")
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools" / "diagnostic.py"), "--pour", "rank",
             "--racine", str(self.racine), "--home", str(self.home)],
            capture_output=True, text=True, env=env,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("/setup", result.stdout)


    def test_pour_apply_blocks_when_tex_off_path(self):
        tinytex = self.home / "Library" / "TinyTeX" / "bin" / "universal-darwin"
        stub(tinytex, "lualatex")
        stub(tinytex, "xelatex")
        stub(self.bin, "kpsewhich", KPSEWHICH)
        self.profile()
        with mock.patch("tools.diagnostic.MACTEX_BIN", self.home / "pas-de-mactex"):
            checks = self.run_checks("apply")
        self.assertFalse(checks["lualatex"].ok)
        self.assertTrue(checks["lualatex"].bloquant)
        self.assertEqual(checks["lualatex"].correctif, "chemins")


if __name__ == "__main__":
    unittest.main()
