# Test d'acceptation en machine virtuelle macOS

But : vérifier, sur un Mac **vierge**, que quelqu'un qui n'est pas technique peut installer et utiliser le kit en suivant **uniquement** `COMMENCER-ICI.md`. Un nouveau compte utilisateur sur ton propre Mac ne suffit pas : les outils Apple (git, python3) y sont déjà installés pour tout le système, et la fenêtre d'installation macOS, l'étape la plus risquée, n'apparaîtrait jamais.

## 1. Préparer la machine virtuelle (≈ 30 min, une seule fois)

Sur un Mac Apple Silicon, au choix :

- **UTM** (gratuit, interface graphique) : https://mac.getutm.app → *Créer une nouvelle machine virtuelle* → *Virtualiser* → *macOS 12+* → laisser UTM télécharger la dernière image macOS → 8 Go de RAM, 64 Go de disque.
- **Tart** (gratuit, ligne de commande) : `brew install cirruslabs/cli/tart`, puis `tart clone ghcr.io/cirruslabs/macos-sequoia-vanilla:latest vierge` et `tart run vierge`. Choisis une image **vanilla** : les images `-base` ou `-xcode` ont déjà les outils Apple.

Dans la VM :
1. Termine l'assistant de démarrage macOS (compte local, sans identifiant Apple si possible).
2. Vérifie que la VM est bien vierge : ouvre Terminal et tape `xcode-select -p`. La commande doit **échouer** (« unable to get active developer directory »). Si elle réussit, la VM n'est pas vierge.
3. **Prends un instantané** (UTM : *Cloner*, Tart : `tart clone vierge vierge-propre`) pour pouvoir recommencer le test autant de fois que nécessaire.

## 2. Dérouler le parcours (≈ 30 min)

Joue le rôle de ton amie : n'utilise **que** `COMMENCER-ICI.md`, sans ouvrir le Terminal toi-même, et note tout ce qui n'était pas annoncé.

1. Installe l'app Claude, connecte-toi avec un compte **Pro** (pas Max, pour voir les vraies limites).
2. Crée `Documents/Recherche emploi`, ouvre-le dans l'onglet Code, colle la phrase d'installation.
3. Pour chaque fenêtre, demande d'autorisation ou attente, note : *annoncée avant ? oui / non*.
4. Laisse `/setup` aller au bout avec un profil fictif **hors développement** (par exemple Camille Martin, chargée de recrutement à Bordeaux, CV d'1 page). Glisse un faux CV PDF dans la conversation pour tester le chemin « documents ».

## 3. Critères de réussite (document de conception, §7)

Points à surveiller en particulier (repérés en revue) :
- [ ] La fenêtre macOS « Claude souhaite accéder au dossier Documents » est bien annoncée avant d'apparaître.
- [ ] Si tu cliques sur « toujours autoriser » dès la première demande, l'installation continue quand même (le dossier contient alors `.claude/settings.local.json`).
- [ ] La fenêtre « outils de ligne de commande » d'Apple n'apparaît pas avant d'avoir été annoncée (Claude Code lance parfois git dès l'ouverture), et note si elle demande le mot de passe Mac.
- [ ] Les étapes TinyTeX et modèles (plusieurs minutes) ne sont pas coupées au bout de 2 minutes.
- [ ] Claude a bien suivi `INSTALLATION.md` à la lettre (fichier téléchargé avec curl, pas résumé).
- [ ] Coupe le réseau pendant l'étape « Bun » : l'étape doit échouer avec un message clair, pas « réussir » à vide.

- [ ] L'installation va jusqu'au `/setup` sans intervention technique.
- [ ] Chaque fenêtre ou demande a été annoncée à l'avance (aucun « non » dans tes notes).
- [ ] Aucune demande de mot de passe administrateur.
- [ ] `/scrape` renvoie des offres du métier choisi, sans planter sur France Travail (non configuré).
- [ ] `/apply` sur une de ces offres produit un CV qui compile à exactement `cv_pages` page(s) et une lettre d'une page.
- [ ] `python3 tools/check_private_data.py --patterns-file …` est propre (à lancer sur ton Mac, pas dans la VM).

## 4. Reprise

- [ ] Recolle la phrase d'installation dans une nouvelle conversation : tout doit répondre « déjà fait » et rien n'est réinstallé.
- [ ] Coupe le réseau de la VM pendant l'étape TinyTeX, puis rétablis-le et recolle la phrase : l'installation reprend.

## 5. Mise à jour

⚠️ Fais ce test **avant** d'envoyer le lien à ton amie, ou sur un fork de test : `/mise-a-jour` suit toujours `main`. Les versions ne font qu'**avancer** : ne reviens jamais en arrière, ni par `revert` ni par `push --force`, car `/mise-a-jour` afficherait de fausses notes et les copies installées pourraient être bloquées.

1. Sur ton Mac, publie une version `1.0.1` : `VERSION` → `1.0.1`, une section `## 1.0.1 — AAAA-MM-JJ` en haut de `NOTES-DE-VERSION.md`, commit et push sur `main`.
2. Dans la VM : `/mise-a-jour`.
- [ ] La nouvelle version est annoncée, s'installe, et la note est résumée en une phrase.
- [ ] Le dossier `profil/` est identique avant et après.
3. Modifie à la main `CLAUDE.md` dans la VM, publie `1.0.2`, relance `/mise-a-jour`.
- [ ] Claude explique le blocage et propose de mettre les modifications de côté, puis la mise à jour passe.
4. Si les versions de test ont introduit des changements que tu ne veux pas garder, publie une version `1.0.3` qui les retire (nouveau commit, numéro plus grand, note « Nettoyage après les tests »).

## 6. Résilience

- [ ] Renomme `~/.zprofile` (par exemple en `~/.zprofile.bak`), ouvre une nouvelle conversation et tape `/diagnostic` : les outils sont signalés « installés mais pas encore accessibles » et Claude propose de recréer les raccourcis.
- [ ] Supprime `profil/profil.md` puis lance `/scrape` : Claude explique en une phrase que le profil manque et propose `/setup`, sans erreur brute.
