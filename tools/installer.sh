#!/usr/bin/env bash
# Install everything the kit needs, one idempotent step at a time.
# Nothing here needs sudo or an administrator password.
#
# Usage: bash tools/installer.sh [--simulation] <etape>
#   etape: etat | outils-apple | bun | tinytex | paquets-tex | chemins | portails | verif | tout
#   --simulation  print "EXEC: <command>" instead of running anything that installs
#
# Exit codes: 0 done (or already done), 3 waiting for the user (a macOS window
# is open), 1 error. Messages for the user are in French, on stderr.
set -euo pipefail

SIM=0
if [ "${1:-}" = "--simulation" ]; then SIM=1; shift; fi
ETAPE="${1:-}"

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TINYTEX_BIN="$HOME/Library/TinyTeX/bin/universal-darwin"
MACTEX_BIN="${KIT_MACTEX_BIN:-/Library/TeX/texbin}"
BUN_BIN="$HOME/.bun/bin"
MARQUEUR_DEBUT="# >>> assistant-recherche-emploi >>>"
MARQUEUR_FIN="# <<< assistant-recherche-emploi <<<"
PAQUETS_TEX=(moderncv fontawesome5 fontawesome6 academicons import luatexbase pgf titlesec textpos xltxtra xunicode cite realscripts needspace)
FICHIERS_TEX=(moderncv.cls fontawesome5.sty academicons.sty titlesec.sty textpos.sty xltxtra.sty needspace.sty)

# Tools installed by earlier steps of this same run must be found by later ones.
export PATH="$BUN_BIN:$TINYTEX_BIN:$PATH:$MACTEX_BIN"

dire() { printf '%s\n' "$*" >&2; }

executer() {
  if [ "$SIM" = 1 ]; then
    printf 'EXEC: %s\n' "$*"
  else
    "$@"
  fi
}

outils_apple_ok() {
  if command -v xcode-select >/dev/null 2>&1; then
    xcode-select -p >/dev/null 2>&1
  else
    command -v git >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1
  fi
}
bun_ok() { command -v bun >/dev/null 2>&1; }
# Found AND able to start: a TinyTeX killed mid-install leaves binaries that fail.
tex_ok() { lualatex --version >/dev/null 2>&1 && xelatex --version >/dev/null 2>&1; }
paquets_tex_ok() {
  command -v kpsewhich >/dev/null 2>&1 || return 1
  local n
  n=$(kpsewhich "${FICHIERS_TEX[@]}" 2>/dev/null | grep -c . || true)
  [ "$n" -ge "${#FICHIERS_TEX[@]}" ]
}
# Both files: the Claude app reads ~/.zprofile only when it starts, but its shell
# reads ~/.zshrc before every command, so an app opened before the install still works.
FICHIERS_CHEMINS=("$HOME/.zprofile" "$HOME/.zshrc")
marqueur_present() { [ -f "$1" ] && grep -qF "$MARQUEUR_DEBUT" "$1"; }
chemins_ok() {
  local f
  for f in "${FICHIERS_CHEMINS[@]}"; do marqueur_present "$f" || return 1; done
}
portails_ok() {
  local cli
  for cli in "$RACINE"/.agents/skills/*/cli; do
    [ -f "$cli/package.json" ] || continue
    [ -d "$cli/node_modules" ] || return 1
  done
  return 0
}

etat_de() { if "$1"; then echo ok; else echo manquant; fi; }

etape_etat() {
  echo "outils-apple=$(etat_de outils_apple_ok)"
  echo "bun=$(etat_de bun_ok)"
  echo "tinytex=$(etat_de tex_ok)"
  echo "paquets-tex=$(etat_de paquets_tex_ok)"
  echo "chemins=$(etat_de chemins_ok)"
  echo "portails=$(etat_de portails_ok)"
}

etape_outils_apple() {
  if outils_apple_ok; then dire "Outils Apple : déjà installés."; return 0; fi
  if ! command -v xcode-select >/dev/null 2>&1; then
    dire "Il manque git ou python3 et ce n'est pas un Mac : installe-les avec le gestionnaire de paquets du système."
    return 1
  fi
  dire "Une fenêtre macOS va proposer d'installer les outils pour développeurs : clique sur « Installer », puis accepte. Ça prend 5 à 10 minutes. Si tu ne la vois pas, clique sur la nouvelle icône apparue dans le Dock."
  executer xcode-select --install || true
  return 3
}

etape_bun() {
  if bun_ok; then dire "Outil de recherche d'offres (Bun) : déjà installé."; return 0; fi
  dire "Installation de l'outil de recherche d'offres (Bun), environ 1 minute…"
  local tmp
  tmp="$(mktemp -d)"
  executer curl -fsSL https://bun.sh/install -o "$tmp/install-bun.sh" 2>/dev/null \
    || { dire "Je n'arrive pas à télécharger l'outil de recherche d'offres. Vérifie la connexion internet, puis relance."; return 1; }
  executer bash "$tmp/install-bun.sh" >/dev/null 2>&1 \
    || { dire "L'installation de l'outil de recherche d'offres a échoué. Relance l'installation ; si ça recommence, tape /diagnostic."; return 1; }
  [ "$SIM" = 1 ] && return 0
  bun_ok || { dire "L'outil de recherche d'offres n'est toujours pas disponible après l'installation. Relance l'installation."; return 1; }
  dire "Outil de recherche d'offres installé."
}

etape_tinytex() {
  if tex_ok; then dire "Outil de fabrication des CV et lettres : déjà installé."; return 0; fi
  dire "Installation de l'outil qui fabrique les CV et les lettres (TinyTeX), environ 5 minutes…"
  local tmp
  tmp="$(mktemp -d)"
  executer curl -fsSL https://yihui.org/tinytex/install-bin-unix.sh -o "$tmp/install-tinytex.sh" 2>/dev/null \
    || { dire "Je n'arrive pas à télécharger l'outil de fabrication des CV. Vérifie la connexion internet, puis relance."; return 1; }
  executer sh "$tmp/install-tinytex.sh" "$tmp" --no-path >/dev/null 2>&1 \
    || { dire "L'installation de l'outil de fabrication des CV a échoué ou a été interrompue. Relance-la : elle repart proprement."; return 1; }
  [ "$SIM" = 1 ] && return 0
  tex_ok || { dire "L'outil de fabrication des CV ne démarre pas après l'installation. Relance l'installation."; return 1; }
  dire "Outil de fabrication des CV et lettres installé."
}

etape_paquets_tex() {
  if paquets_tex_ok; then dire "Modèles de CV et de lettre : déjà installés."; return 0; fi
  if ! command -v tlmgr >/dev/null 2>&1; then
    dire "L'outil de fabrication des CV n'est pas encore installé : lance d'abord l'étape tinytex."
    return 1
  fi
  dire "Installation des modèles de CV et de lettre, environ 2 minutes…"
  executer tlmgr install "${PAQUETS_TEX[@]}" >/dev/null 2>&1 \
    || { dire "L'ajout des modèles de CV et de lettre a échoué (connexion internet ?). Relance l'installation."; return 1; }
  [ "$SIM" = 1 ] && return 0
  paquets_tex_ok || { dire "Il manque encore des modèles de CV ou de lettre après l'installation. Relance l'installation."; return 1; }
  dire "Modèles de CV et de lettre installés."
}

etape_chemins() {
  if chemins_ok; then dire "Raccourcis vers les outils : déjà en place."; return 0; fi
  local f
  for f in "${FICHIERS_CHEMINS[@]}"; do
    marqueur_present "$f" && continue
    if [ "$SIM" = 1 ]; then
      printf 'EXEC: ajout des raccourcis Bun et TinyTeX dans %s\n' "$f"
      continue
    fi
    {
      printf '\n%s\n' "$MARQUEUR_DEBUT"
      printf 'export PATH="$HOME/.bun/bin:$HOME/Library/TinyTeX/bin/universal-darwin:$PATH"\n'
      printf '%s\n' "$MARQUEUR_FIN"
    } >> "$f"
  done
  [ "$SIM" = 1 ] && return 0
  dire "Raccourcis vers les outils ajoutés (ils marcheront dans les prochaines conversations)."
}

etape_portails() {
  if portails_ok; then dire "Outils des sites d'emploi : déjà prêts."; return 0; fi
  if ! bun_ok && [ "$SIM" = 0 ]; then
    dire "L'outil de recherche d'offres (Bun) n'est pas installé : lance d'abord l'étape bun."
    return 1
  fi
  dire "Préparation des outils des sites d'emploi…"
  local cli
  for cli in "$RACINE"/.agents/skills/*/cli; do
    [ -f "$cli/package.json" ] || continue
    [ -d "$cli/node_modules" ] && continue
    if [ "$SIM" = 1 ]; then
      printf 'EXEC: (cd %s && bun install)\n' "$cli"
    else
      (cd "$cli" && bun install --silent >/dev/null 2>&1) \
        || { dire "La préparation d'un outil de site d'emploi a échoué (connexion internet ?). Relance l'installation."; return 1; }
    fi
  done
  [ "$SIM" = 1 ] && return 0
  portails_ok || { dire "Certains outils de sites d'emploi ne sont pas prêts. Relance l'installation."; return 1; }
}

etape_verif() {
  dire "Vérification : je fabrique un CV et une lettre d'essai…"
  local tmp
  tmp="$(mktemp -d)"
  if [ "$SIM" = 1 ]; then
    printf 'EXEC: lualatex -interaction=nonstopmode -halt-on-error main_example.tex\n'
    printf 'EXEC: xelatex -interaction=nonstopmode -halt-on-error cover_smoke.tex\n'
    printf 'EXEC: python3 tools/diagnostic.py --pour apply\n'
    return 0
  fi
  cp -R "$RACINE/cv" "$tmp/cv"
  (cd "$tmp/cv" && lualatex -interaction=nonstopmode -halt-on-error main_example.tex >/dev/null) \
    || { dire "La fabrication du CV d'essai a échoué."; return 1; }
  mkdir "$tmp/lettre"
  cp -R "$RACINE/cover_letters/cover.cls" "$RACINE/cover_letters/OpenFonts" "$tmp/lettre/"
  cat > "$tmp/lettre/cover_smoke.tex" <<'EOF'
\documentclass[]{cover}
\begin{document}
\namesection{Test}{Candidate}{test@example.com}
\companyname{Example Company}
\companyaddress{123 Hiring Street\\Example City}
\currentdate{\today}
\lettercontent{Madame, Monsieur,}
\lettercontent{Lettre d'essai pour vérifier l'installation.}
\closing{Cordialement,}
\signature{Test Candidate}
\end{document}
EOF
  (cd "$tmp/lettre" && xelatex -interaction=nonstopmode -halt-on-error cover_smoke.tex >/dev/null) \
    || { dire "La fabrication de la lettre d'essai a échoué."; return 1; }
  dire "CV et lettre d'essai fabriqués sans problème."
  python3 "$RACINE/tools/diagnostic.py" --pour apply || true
}

lancer() {
  case "$1" in
    etat) etape_etat ;;
    outils-apple) etape_outils_apple ;;
    bun) etape_bun ;;
    tinytex) etape_tinytex ;;
    paquets-tex) etape_paquets_tex ;;
    chemins) etape_chemins ;;
    portails) etape_portails ;;
    verif) etape_verif ;;
    *) dire "Étape inconnue : « $1 ». Étapes possibles : etat, outils-apple, bun, tinytex, paquets-tex, chemins, portails, verif, tout."; return 1 ;;
  esac
}

if [ "$ETAPE" = "tout" ]; then
  for e in outils-apple bun tinytex paquets-tex chemins portails verif; do
    code=0
    lancer "$e" || code=$?
    if [ "$code" -ne 0 ]; then exit "$code"; fi
  done
  dire "Installation terminée."
  exit 0
fi

code=0
lancer "$ETAPE" || code=$?
exit "$code"
