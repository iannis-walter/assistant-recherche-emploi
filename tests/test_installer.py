import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKER = "# >>> assistant-recherche-emploi >>>"
STEPS = ("outils-apple", "bun", "tinytex", "paquets-tex", "chemins", "portails")
KPSEWHICH = '#!/bin/sh\nfor f in "$@"; do echo "/fake/texmf/$f"; done\n'


def stub(directory: Path, name: str, body: str = "#!/bin/sh\nexit 0\n") -> None:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    path.write_text(body, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.home = base / "home"
        self.bin = base / "bin"
        self.home.mkdir()
        self.kit = self.make_kit(base / "kit")

    def tearDown(self):
        self._tmp.cleanup()

    def make_kit(self, kit: Path) -> Path:
        (kit / "tools").mkdir(parents=True)
        shutil.copy(ROOT / "tools" / "installer.sh", kit / "tools" / "installer.sh")
        cli = kit / ".agents" / "skills" / "demo-search" / "cli"
        cli.mkdir(parents=True)
        (cli / "package.json").write_text("{}", encoding="utf-8")
        return kit

    def all_tools(self):
        stub(self.bin, "xcode-select")
        for name in ("git", "python3", "bun", "lualatex", "xelatex", "tlmgr"):
            stub(self.bin, name)
        stub(self.bin, "kpsewhich", KPSEWHICH)

    def run_installer(self, *args, kit=None):
        env = {"PATH": f"{self.bin}:/usr/bin:/bin", "HOME": str(self.home)}
        return subprocess.run(
            ["bash", str((kit or self.kit) / "tools" / "installer.sh"), *args],
            capture_output=True, text=True, env=env, cwd=str(kit or self.kit),
        )

    def test_etat_lists_every_step(self):
        result = self.run_installer("etat")
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = dict(line.split("=", 1) for line in result.stdout.split())
        self.assertEqual(set(lines), set(STEPS))
        self.assertTrue(set(lines.values()) <= {"ok", "manquant"})

    def test_outils_apple_missing_returns_3(self):
        stub(self.bin, "xcode-select", '#!/bin/sh\n[ "$1" = "-p" ] && exit 2\nexit 0\n')
        result = self.run_installer("--simulation", "outils-apple")
        self.assertEqual(result.returncode, 3)
        self.assertIn("EXEC: xcode-select --install", result.stdout)

    def test_missing_bun_is_installed(self):
        stub(self.bin, "xcode-select")
        result = self.run_installer("--simulation", "bun")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("EXEC:", result.stdout)
        self.assertIn("bun.sh/install", result.stdout)

    def test_rerun_is_idempotent(self):
        self.all_tools()
        (self.kit / ".agents" / "skills" / "demo-search" / "cli" / "node_modules").mkdir()
        self.assertEqual(self.run_installer("chemins").returncode, 0)
        result = self.run_installer("--simulation", "tout")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        execs = [line for line in result.stdout.splitlines() if line.startswith("EXEC:")]
        self.assertTrue(execs, "verif should still simulate its compile commands")
        for line in execs:
            self.assertRegex(line, r"lualatex|xelatex|diagnostic\.py", line)
        etat = self.run_installer("etat").stdout
        self.assertNotIn("manquant", etat)

    def test_chemins_appends_once(self):
        self.assertEqual(self.run_installer("chemins").returncode, 0)
        self.assertEqual(self.run_installer("chemins").returncode, 0)
        content = (self.home / ".zprofile").read_text(encoding="utf-8")
        self.assertEqual(content.count(MARKER), 1)
        self.assertIn(".bun/bin", content)
        self.assertIn("Library/TinyTeX/bin/universal-darwin", content)

    def test_unknown_step_is_an_error(self):
        result = self.run_installer("n-importe-quoi")
        self.assertEqual(result.returncode, 1)

    def test_path_with_space_and_apostrophe(self):
        kit = self.make_kit(Path(self._tmp.name) / "Recherche d'emploi" / "mon kit")
        self.all_tools()
        result = self.run_installer("etat", kit=kit)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("bun=ok", result.stdout)


    def run_real(self, *args):
        env = {"PATH": f"{self.bin}:/usr/bin:/bin", "HOME": str(self.home),
               "KIT_MACTEX_BIN": str(Path(self._tmp.name) / "pas-de-mactex")}
        return subprocess.run(["bash", str(self.kit / "tools" / "installer.sh"), *args],
                              capture_output=True, text=True, env=env, cwd=str(self.kit))

    def test_bun_download_failure_fails(self):
        stub(self.bin, "curl", "#!/bin/sh\necho 'curl: (6) Could not resolve host' >&2\nexit 6\n")
        result = self.run_real("bun")
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertNotIn("curl:", result.stderr)

    def test_bun_still_missing_after_install_fails(self):
        stub(self.bin, "curl", '#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = "-o" ] && { shift; echo "exit 0" > "$1"; }; shift; done\nexit 0\n')
        result = self.run_real("bun")
        self.assertEqual(result.returncode, 1, result.stderr)

    def test_tinytex_offline_fails_cleanly(self):
        stub(self.bin, "curl", "#!/bin/sh\nexit 6\n")
        result = self.run_real("tinytex")
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertNotIn("No such file", result.stderr)

    def test_broken_tex_is_reported_missing(self):
        stub(self.bin, "lualatex", "#!/bin/sh\nexit 1\n")
        stub(self.bin, "xelatex", "#!/bin/sh\nexit 1\n")
        result = self.run_real("etat")
        self.assertIn("tinytex=manquant", result.stdout)


if __name__ == "__main__":
    unittest.main()
