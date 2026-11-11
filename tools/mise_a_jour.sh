#!/usr/bin/env bash
# Fetch and apply engine updates without ever touching the user's data
# (profil/, documents/, generated CVs and letters are all git-ignored).
#
# Usage: bash tools/mise_a_jour.sh <verifier|appliquer|mettre-de-cote>
#   verifier        prints "a_jour <version>" or "disponible <local> <distante>"
#   appliquer       fast-forwards to origin/main, reinstalls what is needed,
#                   migrates the profile header, prints the new release notes
#   mettre-de-cote  stashes local changes to engine files so an update can run
#
# Exit codes: 0 ok, 2 local changes in the way, 4 history diverged,
# 5 cannot reach the server, 6 updated but an install step needs attention,
# 7 files created on this computer collide with files the update adds, 1 other error. Messages for the user are in French, on stderr.
set -euo pipefail

# The update may rewrite this very file; bash reads scripts incrementally, so
# run from a private copy and pass the repo root along.
if [ -z "${MAJ_RACINE:-}" ]; then
  MAJ_RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  copie="$(mktemp "${TMPDIR:-/tmp}/mise_a_jour.XXXXXX")"
  cp "${BASH_SOURCE[0]}" "$copie"
  MAJ_RACINE="$MAJ_RACINE" MAJ_COPIE="$copie" exec bash "$copie" "$@"
fi
[ -n "${MAJ_COPIE:-}" ] && trap 'rm -f "$MAJ_COPIE"' EXIT

RACINE="$MAJ_RACINE"
cd "$RACINE"
BRANCHE="main"

dire() { printf '%s\n' "$*" >&2; }

recuperer() {
  if ! git fetch --quiet origin "$BRANCHE" 2>/dev/null; then
    dire "Je n'arrive pas à joindre le serveur des mises à jour (connexion internet ?). Rien n'a été modifié, on réessaiera plus tard."
    exit 5
  fi
}

version_locale() { tr -d '[:space:]' < VERSION 2>/dev/null || echo "inconnue"; }
version_distante() { git show "origin/$BRANCHE:VERSION" 2>/dev/null | tr -d '[:space:]'; }

notes_depuis() {
  # Print every release-notes section newer than $1 (sections are newest first).
  local ancienne="$1"
  [ -f NOTES-DE-VERSION.md ] || return 0
  awk -v ancienne="$ancienne" '
    /^## / { split($2, v, " "); if (v[1] == ancienne) exit; dedans = 1 }
    dedans { print }
  ' NOTES-DE-VERSION.md
}

verifier() {
  recuperer
  local locale distante
  locale="$(version_locale)"
  distante="$(version_distante)"
  if [ -z "$distante" ] || [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCHE")" ]; then
    echo "a_jour $locale"
  else
    echo "disponible $locale $distante"
  fi
}

appliquer() {
  recuperer
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    dire "Des fichiers du moteur ont été modifiés sur cet ordinateur, ce qui bloque la mise à jour. Ton profil n'est pas concerné. Je peux mettre ces modifications de côté (rien n'est perdu) puis relancer la mise à jour."
    exit 2
  fi
  local ancienne
  ancienne="$(version_locale)"
  local sortie
  if ! sortie="$(LC_ALL=C git merge --ff-only "origin/$BRANCHE" 2>&1)"; then
    if printf '%s' "$sortie" | grep -q "untracked working tree files would be overwritten"; then
      dire "La mise à jour apporte des fichiers qui existent déjà sur cet ordinateur (créés ici, par exemple avec /add-portal ou /add-template). Rien n'a été modifié. Fichiers concernés :"
      printf '%s\n' "$sortie" | awk '/would be overwritten/ {on=1; next} /^Please move|^Aborting/ {on=0} on && NF {print "  - " $1}' >&2
      exit 7
    fi
    dire "La mise à jour ne peut pas s'appliquer automatiquement (l'historique a divergé). Rien n'a été modifié. Contacte la personne qui t'a donné le kit."
    exit 4
  fi
  local code=0
  bash tools/installer.sh tout >/dev/null 2>&1 || code=$?
  if [ -f profil/profil.md ]; then
    python3 tools/profil.py migrer profil/profil.md >/dev/null || code=6
  fi
  echo "Mise à jour installée : version $(version_locale)."
  notes_depuis "$ancienne"
  if [ "$code" -ne 0 ]; then
    dire "La mise à jour est installée, mais une étape d'installation demande ton attention : tape /diagnostic."
    exit 6
  fi
}

mettre_de_cote() {
  if [ -z "$(git status --porcelain --untracked-files=no)" ]; then
    dire "Aucune modification à mettre de côté."
    return 0
  fi
  git stash push --quiet -m "avant mise à jour $(date +%Y-%m-%dT%H:%M:%S)"
  dire "Modifications mises de côté (rien n'est perdu)."
}

case "${1:-}" in
  verifier) verifier ;;
  appliquer) appliquer ;;
  mettre-de-cote) mettre_de_cote ;;
  *) dire "Usage : bash tools/mise_a_jour.sh verifier|appliquer|mettre-de-cote"; exit 1 ;;
esac
