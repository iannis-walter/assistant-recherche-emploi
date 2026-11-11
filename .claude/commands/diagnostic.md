# /diagnostic - Check and Repair the Installation

You are checking that the job search assistant is correctly installed and that the user's profile is complete, then repairing what you can. The user may not be technical: speak plain French, never show raw command output or error traces.

## Step 1: Run the checks

```bash
python3 tools/diagnostic.py --json
```

It prints a JSON list of checks, each with `id`, `ok`, `bloquant`, `message` (plain French, safe to show), `correctif`.

If the command itself fails (for example Python is missing), say that the Apple developer tools seem to be missing and go straight to the `installer:outils-apple` fix below.

## Step 2: Show the result

One line per check, in French, using the `message` field:
- ✅ when `ok` is true and `correctif` is empty
- ⚠️ when `ok` is true but `correctif` is not empty, or when the check is not blocking (`bloquant` false)
- ❌ when `ok` is false and `bloquant` is true

Then one sentence: either « Tout est en ordre. » or « Je peux réparer ça pour toi. »

## Step 3: Offer the fixes

For each check with a non-empty `correctif`, offer the matching fix (ask before running anything; group them if there are several):

| `correctif` | What to do |
|---|---|
| `installer:<etape>` | Announce in one sentence what will happen and roughly how long it takes, then run `bash tools/installer.sh <etape>`. If it exits 3, a macOS window is waiting for the user: tell them to click *Installer* and wait, then run the same step again. |
| `chemins` | Run `bash tools/installer.sh chemins`, then explain that the Claude app only picks up the change when it restarts: she must **quit it completely** (menu *Claude → Quitter Claude*, or ⌘Q; closing the window is not enough), reopen it, and open a new conversation in the same folder. A new conversation alone is not enough. |
| `setup` | Explain which information is missing (from `message`) and offer to run `/setup` (or `/setup --section <name>` if only one part is missing). |
| `france_travail` | Optional, only if they want it: guide them step by step to create free API keys on https://francetravail.io (create an account, create an application, subscribe it to the « Offres d'emploi v2 » API), then write `FRANCETRAVAIL_CLIENT_ID=...` and `FRANCETRAVAIL_CLIENT_SECRET=...` into a `.env` file at the root of the folder (copy `.env.example` first). Never paste the keys back into the conversation summary. |

After the fixes, run Step 1 again and show the new result.

## Rules

- Never delete or overwrite anything in `profil/`, `documents/`, `cv/` or `cover_letters/` while repairing.
- Never use `sudo` or ask for an administrator password: nothing in this kit needs it.
- If a fix fails twice, stop, explain simply what is wrong, and suggest contacting the person who gave them the kit.
