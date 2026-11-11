<p align="center">
  <img src="claude_animation.gif" alt="Assistant de recherche d'emploi" width="200">
</p>

# Assistant de recherche d'emploi

[![CI](https://github.com/iannis-walter/assistant-recherche-emploi/actions/workflows/ci.yml/badge.svg)](https://github.com/iannis-walter/assistant-recherche-emploi/actions/workflows/ci.yml)

Un kit prêt à l'emploi qui transforme [Claude](https://claude.ai) (onglet *Code* de l'app pour Mac) en assistant de recherche d'emploi, **pour n'importe quel métier**, sur le marché français. Il permet de :

- **chercher des offres** sur France Travail, HelloWork, APEC, Welcome to the Jungle et LinkedIn ;
- **évaluer honnêtement** si une offre correspond à ton profil ;
- **préparer un CV et une lettre de motivation** adaptés à chaque offre, en PDF ;
- **préparer tes entretiens**.

👉 **Tu n'es pas technique ? Lis [COMMENCER-ICI.md](COMMENCER-ICI.md).** Une phrase à coller, et Claude installe tout.

---

## Comment c'est organisé

| Dossier / fichier | Rôle | Suivi par git |
|---|---|---|
| `profil/` | **Tout ce qui te concerne** : identité, parcours, critères, profil comportemental, exemples d'entretien, CV de base, stratégie de recherche. Créé par `/setup` à partir de `templates/profil/`. | ❌ jamais |
| `documents/` | Tes documents sources (CV, export LinkedIn, diplômes, lettres de recommandation, anciennes candidatures) | ❌ jamais |
| `cv/`, `cover_letters/` | Modèles LaTeX, et les CV et lettres générés pour chaque offre (les fichiers générés ne sont pas suivis) | modèles seulement |
| `.claude/`, `CLAUDE.md`, `tools/`, `.agents/` | Le moteur : commandes, règles d'évaluation et de rédaction, outils de recherche, installation, diagnostic, mise à jour | ✅ |

Comme le profil est séparé du moteur, `/mise-a-jour` peut récupérer les améliorations sans jamais toucher à tes données.

## Commandes

| Commande | Rôle |
|---|---|
| `/setup` | Créer ou modifier son profil (à partir de documents, d'un CV ou d'un entretien guidé) |
| `/scrape` | Chercher de nouvelles offres adaptées au profil |
| `/rank` | Classer les offres trouvées |
| `/apply <lien>` | Évaluer une offre, puis rédiger CV + lettre, relus par un second agent |
| `/interview` | Préparer un entretien sur une candidature suivie |
| `/outcome` | Enregistrer le résultat d'une candidature |
| `/upskill` | Repérer les compétences à développer d'après les offres suivies |
| `/expand` | Enrichir le profil à partir de documents et de la présence en ligne |
| `/add-portal`, `/add-template` | Ajouter un site d'emploi ou un modèle de CV / lettre |
| `/diagnostic` | Vérifier et réparer l'installation |
| `/mise-a-jour` | Récupérer la dernière version du kit |
| `/reset` | Effacer son profil et/ou ses documents |

## Pour les personnes techniques

L'installation manuelle (sans passer par Claude) est décrite dans [SETUP.md](SETUP.md). Pour publier une nouvelle version, voir [CONTRIBUTING.md](CONTRIBUTING.md).

Vérifications locales :

```bash
python3 -m unittest discover -s tests
python3 tools/lint_skills.py
python3 tools/security_guards.py
```

## Remerciements et licence

Ce kit est une adaptation de [ai-job-search-fr](https://github.com/iannis-walter/ai-job-search-fr), elle-même issue de [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) de Mads Lorentzen (licence MIT). La conception du flux de candidature est la sienne.

> Projet indépendant et open source, non affilié à Anthropic. Claude est mentionné uniquement pour décrire l'outil utilisé.

Licence MIT : voir [LICENSE](LICENSE).
