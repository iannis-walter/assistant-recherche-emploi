#!/usr/bin/env python3
"""Check that everything the kit needs is installed and the profile is complete.

Usage:
    python3 tools/diagnostic.py [--pour apply|scrape|interview|expand|rank|outcome|upskill] [--json]

Exit 0 when no blocking check fails, 1 otherwise. Messages are plain French for
the user; `correctif` tells Claude which fix to offer:
    ""                -> nothing to do
    "installer:<step>" -> bash tools/installer.sh <step>
    "chemins"         -> bash tools/installer.sh chemins, then quit and reopen the Claude app
    "setup"           -> /setup
    "france_travail"  -> optional guided creation of the France Travail API keys
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, NamedTuple, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from profil import lire_profil, valider_entete  # noqa: E402


class Verif(NamedTuple):
    id: str
    ok: bool
    bloquant: bool
    message: str
    correctif: str


TOUS = ("git", "python", "bun", "lualatex", "xelatex", "paquets_tex", "profil", "france_travail")
REQUIS = {
    "scrape": ("bun", "profil"),
    "apply": ("lualatex", "xelatex", "paquets_tex", "profil"),
}
PAQUETS_TEX = ("moderncv.cls", "fontawesome5.sty", "academicons.sty", "titlesec.sty", "textpos.sty", "xltxtra.sty",
               "needspace.sty")
NOMS = {
    "git": "les outils Apple pour développeurs (git)",
    "bun": "l'outil de recherche d'offres (Bun)",
    "lualatex": "l'outil qui fabrique les CV (LuaLaTeX)",
    "xelatex": "l'outil qui fabrique les lettres (XeLaTeX)",
}


def _maj(texte: str) -> str:
    return texte[:1].upper() + texte[1:]


MACTEX_BIN = Path("/Library/TeX/texbin")


def _hors_path(home: Path, nom: str) -> List[Path]:
    if nom == "bun":
        return [home / ".bun" / "bin" / "bun"]
    return [
        home / "Library" / "TinyTeX" / "bin" / "universal-darwin" / nom,
        MACTEX_BIN / nom,
    ]


def _trouver(nom: str, home: Path):
    """Return (path, on_path)."""
    sur_path = shutil.which(nom)
    if sur_path:
        return sur_path, True
    for candidat in _hors_path(home, nom):
        if candidat.is_file():
            return str(candidat), False
    return None, False


def _outil(nom: str, home: Path, etape: str, strict: bool = False, hors_path_ok: bool = False) -> Verif:
    """strict: a command is about to use the tool, so off-PATH means blocked.
    hors_path_ok: the kit's own wrapper finds the tool off PATH, so that is fine."""
    chemin, sur_path = _trouver(nom, home)
    if chemin and (sur_path or hors_path_ok):
        return Verif(nom, True, True, f"{_maj(NOMS[nom])} : installé.", "")
    if chemin:
        return Verif(nom, not strict, True, f"{_maj(NOMS[nom])} : installé mais pas encore accessible.", "chemins")
    return Verif(nom, False, True, f"{_maj(NOMS[nom])} : pas installé.", f"installer:{etape}")


def _git(home: Path) -> Verif:
    if shutil.which("xcode-select"):
        try:
            ok = subprocess.run(["xcode-select", "-p"], capture_output=True, timeout=10).returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            ok = False
        if not ok:
            return Verif("git", False, True, "Les outils Apple pour développeurs ne sont pas installés.", "installer:outils-apple")
    return _outil("git", home, "outils-apple")


def _python() -> Verif:
    if sys.version_info >= (3, 9):
        return Verif("python", True, True, "Python : installé.", "")
    return Verif("python", False, True, "Python est trop ancien.", "installer:outils-apple")


def _paquets_tex(home: Path) -> Verif:
    chemin, _ = _trouver("kpsewhich", home)
    if not chemin:
        return Verif("paquets_tex", False, True, "Les modèles de CV et de lettre ne sont pas installés.", "installer:tinytex")
    try:
        sortie = subprocess.run([chemin, *PAQUETS_TEX], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.TimeoutExpired):
        sortie = ""
    trouves = [ligne for ligne in sortie.splitlines() if ligne.strip()]
    if len(trouves) >= len(PAQUETS_TEX):
        return Verif("paquets_tex", True, True, "Modèles de CV et de lettre : installés.", "")
    return Verif("paquets_tex", False, True, "Il manque des éléments pour fabriquer les CV et les lettres.", "installer:paquets-tex")


def _profil(racine: Path) -> Verif:
    chemin = racine / "profil" / "profil.md"
    if not chemin.is_file():
        return Verif("profil", False, True, "Ton profil n'est pas encore créé.", "setup")
    try:
        messages = valider_entete(lire_profil(chemin))
    except ValueError as exc:
        return Verif("profil", False, True, f"Ton profil est illisible ({exc}).", "setup")
    if messages:
        return Verif("profil", False, True, "Ton profil est incomplet : " + " ".join(messages), "setup")
    return Verif("profil", True, True, "Profil : complet.", "")


def _france_travail(racine: Path) -> Verif:
    valeurs = {}
    env = racine / ".env"
    if env.is_file():
        for ligne in env.read_text(encoding="utf-8").splitlines():
            if "=" in ligne and not ligne.lstrip().startswith("#"):
                cle, _, valeur = ligne.partition("=")
                valeurs[cle.strip()] = valeur.strip()
    if valeurs.get("FRANCETRAVAIL_CLIENT_ID") and valeurs.get("FRANCETRAVAIL_CLIENT_SECRET"):
        return Verif("france_travail", True, False, "France Travail : activé.", "")
    return Verif("france_travail", False, False, "France Travail n'est pas activé (facultatif).", "france_travail")


def verifier(racine: Path, home: Path, pour: Optional[str]) -> List[Verif]:
    racine, home = Path(racine), Path(home)
    if pour is None:
        ids = TOUS
    else:
        ids = REQUIS.get(pour, ("profil",))
    strict = pour is not None
    fabriques = {
        "git": lambda: _git(home),
        "python": _python,
        "bun": lambda: _outil("bun", home, "bun", strict),
        # Off-PATH is fine: tools/compiler.sh adds the TinyTeX folder itself, and the Claude app
        # keeps the PATH it had at launch, so an install done with the app open is still usable.
        "lualatex": lambda: _outil("lualatex", home, "tinytex", hors_path_ok=True),
        "xelatex": lambda: _outil("xelatex", home, "tinytex", hors_path_ok=True),
        "paquets_tex": lambda: _paquets_tex(home),
        "profil": lambda: _profil(racine),
        "france_travail": lambda: _france_travail(racine),
    }
    return [fabriques[i]() for i in ids]


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description="Vérifie l'installation du kit et le profil.")
    parser.add_argument("--pour", choices=("apply", "scrape", "interview", "expand", "rank", "outcome", "upskill"))
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--racine", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--home", type=Path, default=Path.home())
    args = parser.parse_args(argv)

    verifs = verifier(args.racine, args.home, args.pour)
    if args.json:
        print(json.dumps([v._asdict() for v in verifs], ensure_ascii=False, indent=2))
    else:
        for v in verifs:
            symbole = "✅" if v.ok and not v.correctif else ("⚠️" if v.ok or not v.bloquant else "❌")
            suite = ""
            if v.correctif == "setup":
                suite = " → lance /setup"
            elif v.correctif:
                suite = " → tape /diagnostic pour que je répare"
            print(f"{symbole} {v.message}{suite}")
    return 1 if any(v.bloquant and not v.ok for v in verifs) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
