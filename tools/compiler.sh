#!/usr/bin/env bash
# Compile a CV or a cover letter safely: the engine is chosen by folder
# (cv/ -> lualatex, cover_letters/ -> xelatex) and always runs with
# -no-shell-escape, so a .tex file can never run shell commands.
#
# Usage: bash tools/compiler.sh cv/main_<entreprise>.tex
#        bash tools/compiler.sh cover_letters/cover_<entreprise>_<poste>.tex
# Exit: the engine's exit code; 1 if the file is missing or in another folder.
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FICHIER="${1:-}"
dire() { printf '%s\n' "$*" >&2; }
# Find TinyTeX even when the shell's PATH does not list it yet (app opened before the install).
export PATH="$PATH:$HOME/Library/TinyTeX/bin/universal-darwin:${KIT_MACTEX_BIN:-/Library/TeX/texbin}"

case "$FICHIER" in
  cv/*.tex) MOTEUR=lualatex ;;
  cover_letters/*.tex) MOTEUR=xelatex ;;
  *) dire "Je ne compile que les CV (dossier cv/) et les lettres (dossier cover_letters/)."; exit 1 ;;
esac
case "$FICHIER" in */../*|../*) dire "Chemin refusé."; exit 1 ;; esac
[ -f "$RACINE/$FICHIER" ] || { dire "Le fichier $FICHIER n'existe pas."; exit 1; }

cd "$RACINE/$(dirname "$FICHIER")"
exec "$MOTEUR" -no-shell-escape -interaction=nonstopmode "$(basename "$FICHIER")"
