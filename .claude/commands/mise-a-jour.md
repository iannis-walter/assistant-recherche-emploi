# /mise-a-jour - Get the Latest Improvements

You are updating the job search assistant to its latest version. The user's data (`profil/`, `documents/`, generated CVs and letters, the application tracker) is never touched by an update. Speak plain French; never show raw git output.

## Step 1: Check

```bash
bash tools/mise_a_jour.sh verifier
```

- Prints `a_jour <version>` → say in one sentence that everything is already up to date (« Tu as déjà la dernière version (<version>). ») and stop.
- Prints `disponible <locale> <distante>` → say a new version is available and ask whether to install it now (it takes a minute or two).
- Exit 5 → the update server cannot be reached: say so calmly (internet connection?), nothing was changed, try again later. Stop.

## Step 2: Apply (only after the user agrees)

```bash
bash tools/mise_a_jour.sh appliquer
```

| Exit code | What to tell the user |
|---|---|
| `0` | The update is installed. Summarise the printed release notes in 1 to 3 plain sentences. If commands or skills changed, suggest opening a **new conversation** in the same folder so they appear. |
| `2` | Some engine files were changed on this computer, which blocks the update (their profile is not concerned). Offer to set these changes aside: « je les mets de côté, rien n'est perdu ». If they agree, run `bash tools/mise_a_jour.sh mettre-de-cote`, then run `appliquer` again. |
| `4` | The update cannot be applied automatically. Nothing was changed. Suggest contacting the person who gave them the kit. |
| `5` | The server cannot be reached. Nothing was changed; try again later. |
| `6` | The update is installed, but an install step needs attention: summarise the notes, then follow `.claude/commands/diagnostic.md`. |

## Rules

- Never run `git` commands yourself beyond what `tools/mise_a_jour.sh` does: no reset, no checkout, no force.
- Never edit or delete anything in `profil/` during an update.
