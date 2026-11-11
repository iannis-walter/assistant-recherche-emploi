#!/usr/bin/env python3
"""Read, validate and migrate the user's profile header (profil/profil.md).

The header is a deliberately tiny, flat YAML subset so it can be parsed with
the standard library on the Python 3.9 shipped with Apple's Command Line Tools:

    ---
    cle: valeur          -> string (surrounding quotes stripped)
    cle: 35              -> int (only for version_profil, rayon_km, cv_pages and the salary;
                            every other field stays text, so 0612345678 keeps its 0)
    cle: null            -> None
    cle: [a, b, c]       -> list of strings (no nesting, no commas inside items)
    ---

An empty string or empty list counts as "not filled in yet".

Usage:
    python3 tools/profil.py valider PATH   # exit 0 if valid, 1 + French messages otherwise
    python3 tools/profil.py migrer PATH    # upgrade an old header, backing it up first
"""

from __future__ import annotations

import re
import shutil
import sys
from datetime import date
from pathlib import Path
from typing import Callable, Dict, List

VERSION_PROFIL = 1

CHAMPS_OBLIGATOIRES = (
    "version_profil",
    "nom",
    "email",
    "telephone",
    "ville",
    "pays",
    "langues",
    "statut",
    "metiers_vises",
    "rayon_km",
    "teletravail",
    "salaire_plancher_brut_annuel",
    "criteres_eliminatoires",
    "cv_pages",
)
CHAMPS_OPTIONNELS = ("linkedin", "site", "github")

VALEURS_TELETRAVAIL = ("non", "hybride", "total", "indifferent")
VALEURS_CV_PAGES = (1, 2)
CHAMPS_ENTIERS = ("version_profil", "rayon_km", "cv_pages")
CHAMPS_NULLABLES = ("salaire_plancher_brut_annuel",)

# from-version -> function rewriting the whole file text to the next version.
ETAPES_MIGRATION: Dict[int, Callable[[str], str]] = {}

_LIGNE = re.compile(r"^([a-z_]+):\s*(.*)$")


def _valeur(brute: str, cle: str = ""):
    brute = brute.strip()
    if brute == "null":
        return None
    if cle in CHAMPS_ENTIERS + CHAMPS_NULLABLES and re.fullmatch(r"-?\d+", brute):
        return int(brute)
    if brute.startswith("[") and brute.endswith("]"):
        interieur = brute[1:-1].strip()
        if not interieur:
            return []
        return [_sans_guillemets(x.strip()) for x in interieur.split(",") if x.strip()]
    return _sans_guillemets(brute)


def _sans_guillemets(texte: str) -> str:
    if len(texte) >= 2 and texte[0] == texte[-1] and texte[0] in "\"'":
        return texte[1:-1]
    return texte


def _bornes_entete(texte: str) -> tuple:
    lignes = texte.splitlines()
    if not lignes or lignes[0].strip() != "---":
        raise ValueError("le profil n'a pas d'en-tête (il doit commencer par ---)")
    for i in range(1, len(lignes)):
        if lignes[i].strip() == "---":
            return lignes, i
    raise ValueError("l'en-tête du profil n'est pas refermé par ---")


def lire_entete(texte: str) -> dict:
    lignes, fin = _bornes_entete(texte)
    entete = {}
    for ligne in lignes[1:fin]:
        if not ligne.strip() or ligne.lstrip().startswith("#"):
            continue
        m = _LIGNE.match(ligne.strip())
        if not m:
            raise ValueError(f"ligne d'en-tête illisible : {ligne.strip()!r}")
        entete[m.group(1)] = _valeur(m.group(2), m.group(1))
    return entete


def lire_profil(chemin: Path) -> dict:
    return lire_entete(Path(chemin).read_text(encoding="utf-8"))


def _vide(valeur) -> bool:
    return valeur == "" or valeur == []


def valider_entete(entete: dict) -> List[str]:
    messages = []
    for champ in CHAMPS_OBLIGATOIRES:
        if champ not in entete:
            messages.append(f"Il manque le champ « {champ} ».")
            continue
        valeur = entete[champ]
        if valeur is None:
            if champ not in CHAMPS_NULLABLES:
                messages.append(f"Le champ « {champ} » n'est pas encore rempli.")
            continue
        if _vide(valeur):
            messages.append(f"Le champ « {champ} » n'est pas encore rempli.")
            continue
        if champ in CHAMPS_ENTIERS and not isinstance(valeur, int):
            messages.append(f"Le champ « {champ} » doit être un nombre entier.")
        elif champ == "salaire_plancher_brut_annuel" and not isinstance(valeur, int):
            messages.append("Le champ « salaire_plancher_brut_annuel » doit être un nombre (ou null).")
        elif champ in ("langues", "metiers_vises", "criteres_eliminatoires") and not isinstance(valeur, list):
            messages.append(f"Le champ « {champ} » doit être une liste entre crochets.")
        elif champ == "teletravail" and valeur not in VALEURS_TELETRAVAIL:
            messages.append(
                f"Le champ « teletravail » doit valoir {', '.join(VALEURS_TELETRAVAIL)} (trouvé : {valeur})."
            )
        elif champ == "cv_pages" and valeur not in VALEURS_CV_PAGES:
            messages.append(f"Le champ « cv_pages » doit valoir 1 ou 2 (trouvé : {valeur}).")
    return messages


def _remplacer_version(texte: str, version: int) -> str:
    lignes, fin = _bornes_entete(texte)
    for i in range(1, fin):
        if lignes[i].startswith("version_profil:"):
            lignes[i] = f"version_profil: {version}"
            break
    else:
        lignes.insert(1, f"version_profil: {version}")
    return "\n".join(lignes) + ("\n" if texte.endswith("\n") else "")


def migrer(chemin: Path) -> bool:
    """Bring the profile header up to VERSION_PROFIL. Return True if changed."""
    chemin = Path(chemin)
    texte = chemin.read_text(encoding="utf-8")
    version = lire_entete(texte).get("version_profil") or 1
    if version >= VERSION_PROFIL:
        return False
    sauvegarde = chemin.parent / ".sauvegardes" / date.today().isoformat()
    sauvegarde.mkdir(parents=True, exist_ok=True)
    shutil.copy2(chemin, sauvegarde / chemin.name)
    while version < VERSION_PROFIL:
        texte = ETAPES_MIGRATION[version](texte)
        version += 1
        texte = _remplacer_version(texte, version)
    chemin.write_text(texte, encoding="utf-8")
    return True


def main(argv: List[str]) -> int:
    if len(argv) != 2 or argv[0] not in ("valider", "migrer"):
        print("usage: profil.py valider|migrer CHEMIN", file=sys.stderr)
        return 2
    action, chemin = argv[0], Path(argv[1])
    if not chemin.is_file():
        print(f"Le profil {chemin} n'existe pas encore : lance /setup.")
        return 1
    try:
        if action == "migrer":
            print("Profil mis à jour." if migrer(chemin) else "Profil déjà à jour.")
            return 0
        messages = valider_entete(lire_profil(chemin))
    except ValueError as exc:
        print(f"Le profil est illisible : {exc}.")
        return 1
    for m in messages:
        print(m)
    if not messages:
        print("Profil complet.")
    return 1 if messages else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
