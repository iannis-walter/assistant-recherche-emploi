# Commencer ici 👋

Ce kit transforme Claude en assistant de recherche d'emploi. Il trouve des offres qui te correspondent, te dit honnêtement si une offre est faite pour toi, prépare un CV et une lettre de motivation adaptés à chaque offre (en PDF), et t'aide à préparer tes entretiens.

Tout se passe sur ton Mac, et tes informations restent sur ton ordinateur.

---

## Avant de commencer (5 minutes)

1. **Un Mac** (un MacBook Air récent est parfait).
2. **Un abonnement Claude Pro au minimum.** La version gratuite ne suffit pas. Pour vérifier : dans l'app Claude, clique sur ton nom en bas à gauche → *Paramètres* → *Facturation*. Il doit être écrit « Pro » ou « Max ».
3. **Ton CV actuel** (PDF ou Word) et **l'export de ton profil LinkedIn** : sur LinkedIn, va sur ton profil → bouton *Plus* → *Enregistrer au format PDF*. Garde les deux fichiers sous la main, ils éviteront de répondre à beaucoup de questions.

<!-- capture : bouton « Plus → Enregistrer au format PDF » sur LinkedIn -->

## Installer (environ 20 minutes, presque tout seul)

1. **Installe l'app Claude pour Mac** depuis https://claude.ai/download, ouvre-la et connecte-toi.
2. Dans le Finder, **crée un dossier vide** : *Documents* → nouveau dossier → nomme-le `Recherche emploi`.
3. Dans l'app Claude, ouvre l'onglet **Code**, puis choisis ce dossier `Recherche emploi` comme dossier de travail. Si l'app te demande si tu fais confiance à ce dossier, réponds oui.

<!-- capture : onglet Code et choix du dossier -->

4. **Copie-colle exactement cette phrase** dans la conversation, puis envoie :

   > Installe l'assistant de recherche d'emploi : lis https://raw.githubusercontent.com/iannis-walter/assistant-recherche-emploi/main/INSTALLATION.md et suis ces instructions dans ce dossier.

### Ce qui va se passer

- Claude va te demander **plusieurs fois l'autorisation** de lancer des commandes : clique sur *Autoriser*. C'est normal.
- Une **fenêtre macOS** peut s'ouvrir pour proposer d'installer des « outils de ligne de commande pour développeurs » : clique sur *Installer* et accepte. Ça prend 5 à 10 minutes. Claude t'attend.
- Claude installe ensuite les outils qui cherchent les offres et qui fabriquent les PDF (environ 10 minutes), puis vérifie que tout marche.
- **On ne te demande jamais ton mot de passe Mac.** Si une fenêtre le demande, refuse et préviens la personne qui t'a donné le kit.
- Ensuite, Claude te pose des questions pour créer ton profil (ton parcours, le métier que tu cherches, où, à quel salaire…). Tu peux glisser ton CV et ton export LinkedIn directement dans la conversation.

<!-- capture : la fenêtre macOS « outils de ligne de commande » -->

Si l'installation s'arrête au milieu (Mac fermé, internet coupé…), recolle simplement la même phrase : tout reprend là où ça s'était arrêté.

---

## Au quotidien

Ouvre l'app Claude → onglet **Code** → dossier `Recherche emploi`, puis tape une commande (tape `/` pour voir la liste) :

| Commande | À quoi ça sert |
|---|---|
| `/scrape` | Chercher de nouvelles offres qui te correspondent |
| `/rank` | Classer les offres trouvées, des plus prometteuses aux moins intéressantes |
| `/apply` + le lien d'une offre | Analyser l'offre, puis préparer un CV et une lettre adaptés (en PDF) |
| `/interview` | Préparer un entretien prévu |
| `/outcome` | Noter la réponse d'une candidature (entretien, refus, offre…) |
| `/setup` | Modifier ton profil |
| `/mise-a-jour` | Récupérer les dernières améliorations du kit |
| `/diagnostic` | **Si quelque chose ne marche pas** : Claude vérifie tout et répare |

Tu peux aussi écrire normalement, par exemple : « Est-ce que cette offre est faite pour moi ? » suivi du lien.

> 💡 `/apply` prend plusieurs minutes et consomme une bonne partie du quota Claude Pro. Si la limite est atteinte, Claude te propose une version plus légère.

## Si ça bloque

1. Tape `/diagnostic`.
2. Si ça ne suffit pas, ferme la conversation, ouvres-en une nouvelle dans le même dossier, et réessaie.
3. En dernier recours, contacte la personne qui t'a donné le kit.
