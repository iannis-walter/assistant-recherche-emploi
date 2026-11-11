# Installation guidée — instructions pour Claude

Ce fichier est lu par Claude quand la personne colle la phrase d'installation du guide `COMMENCER-ICI.md` dans l'onglet *Code* de l'app Claude pour Mac. Suis ces étapes **dans l'ordre**, dans le dossier de travail actuel.

**Règles pendant toute l'installation :**
- Parle en français simple et chaleureux. La personne n'est pas technique : pas de jargon, jamais d'erreur brute sans explication.
- **Annonce avant d'agir** tout ce qu'elle va voir (fenêtre macOS, demande d'autorisation, attente), avec une durée approximative.
- N'utilise jamais `sudo` et ne demande jamais de mot de passe administrateur : rien ici n'en a besoin.
- Si une étape échoue deux fois, arrête-toi, explique simplement ce qui bloque et propose de recoller la phrase d'installation plus tard (tout reprend là où ça s'est arrêté).

---

## 1. Vérifier le dossier

Regarde le contenu du dossier actuel.
- **Vide** (ou seulement des fichiers cachés du système comme `.DS_Store`) : continue à l'étape 2.
- **Contient déjà ce kit** (un fichier `tools/installer.sh` et un dossier `.claude/`) : c'est une reprise. Dis-le simplement et va directement à l'étape 5.
- **Contient autre chose** : explique qu'il faut un dossier vide, propose-lui de créer un dossier `Recherche emploi` dans *Documents*, de l'ouvrir dans l'onglet Code, puis de recoller la phrase. Arrête-toi là.

## 2. Prévenir pour les autorisations

Dis-lui avant la première commande :

> Pendant l'installation, je vais te demander plusieurs fois l'autorisation de lancer des commandes sur ton Mac. C'est normal : clique simplement sur *Autoriser* à chaque fois. Si l'app te demande si tu fais confiance à ce dossier, réponds oui. Tout se passe dans ce dossier et dans ton dossier personnel, rien n'est envoyé ailleurs.

## 3. Outils Apple pour développeurs

Lance `xcode-select -p`.
- S'il réussit, passe à l'étape 4.
- S'il échoue, **annonce d'abord** :

  > Une fenêtre macOS va s'ouvrir pour proposer d'installer des « outils de ligne de commande pour développeurs ». Clique sur *Installer*, puis accepte la licence. Ça prend environ 5 à 10 minutes : je t'attends et je reprends tout seul ensuite.

  Puis lance `xcode-select --install`. Ensuite, vérifie toutes les 30 secondes avec `xcode-select -p`, pendant 30 minutes au maximum, **en arrière-plan** pour que la conversation reste disponible (par exemple : `for i in $(seq 60); do xcode-select -p >/dev/null 2>&1 && exit 0; sleep 30; done; exit 1`). Si elle te pose une question entre-temps, réponds-lui.
  - Si l'installation se termine : dis-le et continue.
  - Au bout de 30 minutes sans succès : dis-le calmement et explique comment reprendre (recoller la même phrase une fois la fenêtre macOS terminée).

## 4. Récupérer le kit

```bash
git clone https://github.com/iannis-walter/assistant-recherche-emploi.git .
```

Si le dossier contient seulement `.DS_Store` et que git refuse, supprime ce `.DS_Store` puis relance.

## 5. Installer les outils

Lance les étapes de `bash tools/installer.sh` **une par une**, dans cet ordre, en annonçant chacune en une phrase :

| Étape | À annoncer |
|---|---|
| `outils-apple` | (déjà fait à l'étape 3, ce sera instantané) |
| `bun` | « J'installe l'outil qui cherche les offres d'emploi, environ 1 minute. » |
| `tinytex` | « J'installe l'outil qui fabrique tes CV et lettres en PDF, environ 5 minutes. » |
| `paquets-tex` | « J'ajoute les modèles de CV et de lettre, environ 2 minutes. » |
| `chemins` | « Je crée des raccourcis pour que ces outils soient trouvés automatiquement. » |
| `portails` | « Je prépare les outils des sites d'emploi (France Travail, HelloWork, APEC, LinkedIn…). » |
| `verif` | « Je vérifie que tout marche en fabriquant un CV et une lettre d'essai. » |

Codes de sortie :
- `0` : étape faite (ou déjà faite) → étape suivante.
- `3` : une fenêtre macOS attend la personne → explique-lui quoi faire, attends, puis relance la même étape.
- `1` : erreur → lis le message (en français), explique-le simplement, puis applique la logique de `.claude/commands/diagnostic.md` (lance `python3 tools/diagnostic.py --json` et propose le correctif indiqué).

L'étape `verif` affiche « Profil : … pas encore créé » : c'est normal à ce stade, le profil vient juste après.

## 6. Créer son profil

Dis-lui que l'installation est terminée, puis lis `.claude/commands/setup.md` et **déroule-le dans cette même conversation** (les nouvelles commandes `/…` n'apparaîtront qu'à la prochaine conversation, donc ne compte pas dessus maintenant).

Avant de commencer, rappelle-lui que le plus simple est de déposer son CV actuel et l'export PDF de son profil LinkedIn (sur LinkedIn : *Plus* → *Enregistrer au format PDF*). Elle peut aussi les glisser directement dans la conversation : enregistre-les alors dans `documents/cv/` et `documents/linkedin/`.

## 7. Conclure

Quand `/setup` est terminé, dis-lui :

> Tout est prêt ! À partir de ta prochaine conversation dans ce dossier, tape `/` pour voir toutes les commandes. Les plus utiles :
> - `/scrape` : chercher de nouvelles offres
> - `/apply` suivi du lien d'une offre : l'analyser et préparer CV + lettre
> - `/interview` : préparer un entretien
> - `/mise-a-jour` : récupérer les améliorations
> - `/diagnostic` : si quelque chose ne marche pas
