# Startup DNA Discord agent

A Discord bot for the show operator. They paste a snippet of the copy they see on the website, edit that field in a form, then click **Publish**. The bot commits to GitHub and the site goes live.

No Gemini, no Google Cloud AI. The bot can only change `data/site.json`, `data/episodes.json`, and `data/founders.json`.

## What they type

In the allowed Discord channel:

- `/help`
- `/edit-text` → `contains`: paste a snippet of the current copy (or the whole sentence)

The bot searches the live site JSON for that text.

- If it finds one place, a form opens named with the page and field (for example **Founder Palak Jain → Bio**), already filled with the current text.
- If it finds a few places, it lists them with a short preview. Click the one you mean, then the same form opens.
- If it finds nothing, or too many places, paste a longer unique phrase from the page.

Edit the form, submit, then **Publish**. Nothing is live until that click.

## 1. Discord app

1. Open [Discord Developer Portal](https://discord.com/developers/applications) → New Application.
2. Bot → Add Bot → copy **token** (`DISCORD_TOKEN`).
3. OAuth2 → URL Generator → scopes **`bot`** and **`applications.commands`** → permissions: View Channels, Send Messages, Embed Links, Read Message History.
4. Invite the bot to the server and copy the channel ID for `#website` (`DISCORD_CHANNEL_ID`). Enable Developer Mode in Discord to copy IDs.
5. Copy the operator’s user ID into `DISCORD_ALLOWED_USER_IDS` so only they can publish.

Slash commands register themselves when the bot starts. Wait a minute, then type `/` in the channel.

## 2. GitHub token

Create a fine-grained personal access token (or a GitHub App) with **Contents: Read and write** on `Bensonnnnnnnn/startupdna`. Put it in `GITHUB_TOKEN`. The bot clones `main`, runs `node build.js`, and pushes JSON + generated HTML.

## 3. Run locally

```bash
cd agent
cp .env.example .env
# fill in .env
npm install
npm start
```

Then run `/help` in Discord.

## 4. Deploy to Cloud Run

The Discord gateway needs a process that stays up. Use **min instances = 1** and **CPU always allocated**. You can host this on Cloud Run without enabling Vertex AI.

From `agent/`:

```bash
gcloud run deploy startupdna-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --no-cpu-throttling \
  --timeout 3600 \
  --set-env-vars "GITHUB_REPO=Bensonnnnnnnn/startupdna,GITHUB_BRANCH=main,DISCORD_CHANNEL_ID=...,DISCORD_ALLOWED_USER_IDS=..." \
  --set-secrets "DISCORD_TOKEN=DISCORD_TOKEN:latest,GITHUB_TOKEN=GITHUB_TOKEN:latest"
```

Store the Discord and GitHub tokens in [Secret Manager](https://console.cloud.google.com/security/secret-manager) first. `--allow-unauthenticated` only exposes `/health`; Discord connects outbound with the bot token.

Any always-on host works (Fly, Railway, a small VM). Cloud Run with min instances 1 is a few dollars a month.

## Guardrails

- Allowed files: `data/*.json` only
- Publish button required
- Optional allow-list of Discord user IDs
- Proposals expire after 30 minutes
- GitHub commit message names the Discord user
