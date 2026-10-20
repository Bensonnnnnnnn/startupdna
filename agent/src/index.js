import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { currentValue, slashCommands } from "./commands.js";
import { applyEdits, clip, summarizeEdits } from "./edits.js";
import { createGithub } from "./github.js";
import { MAX_PICK_BUTTONS, findText } from "./search.js";

function publicError(err) {
  let s = String(err?.message || err);
  for (const key of ["GITHUB_TOKEN", "DISCORD_TOKEN"]) {
    const secret = process.env[key];
    if (secret) s = s.split(secret).join("[redacted]");
  }
  return s.replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]");
}

function loadDotEnv() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const i = text.indexOf("=");
    if (i < 1) continue;
    const key = text.slice(0, i).trim();
    let value = text.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}
loadDotEnv();

const channelId = process.env.DISCORD_CHANNEL_ID;
const allowedUsers = (process.env.DISCORD_ALLOWED_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const pending = new Map();
const github = createGithub();
let docsCache = { at: 0, docs: null };
let publishLock = null;
let lastPublishAt = 0;
const PUBLISH_COOLDOWN_MS = 20_000;

async function loadDocs() {
  if (docsCache.docs && Date.now() - docsCache.at < 15_000) return docsCache.docs;
  const docs = await github.loadDocs();
  docsCache = { at: Date.now(), docs };
  return docs;
}

function isAllowed(userId) {
  if (!allowedUsers.length) return true;
  return allowedUsers.includes(userId);
}

function proposalId() {
  return Math.random().toString(36).slice(2, 10);
}

function buttons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pub:${id}`).setLabel("Publish").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`can:${id}`).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
  );
}

function pickButtons(id, matches) {
  const row = new ActionRowBuilder();
  matches.forEach((m, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`pick:${id}:${i}`)
        .setLabel(clip(`${i + 1}. ${m.pathLabel}`, 80))
        .setStyle(ButtonStyle.Primary)
    );
  });
  return row;
}

function formatMatches(matches) {
  return matches
    .map((m, i) => `**${i + 1}. ${m.pathLabel}**\n${clip(m.value, 140)}`)
    .join("\n\n");
}

function editEmbed(edits, userTag) {
  const lines = edits.map((e) => {
    const who = e.pathLabel || e.selector?.slug || e.selector?.id || e.file;
    return `**${who}** · \`${e.field}\`\nBefore: ${clip(e.oldValue, 400)}\nAfter: ${clip(e.newValue, 400)}`;
  });
  return new EmbedBuilder()
    .setTitle("Proposed site copy change")
    .setDescription(lines.join("\n\n").slice(0, 4000))
    .setFooter({ text: `Not live until you click Publish · ${userTag}` })
    .setColor(0xf56b08);
}

function deny(interaction, text) {
  const payload = { content: text, ephemeral: true };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

function modalFor(customId, label, current, style) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(label.slice(0, 45));
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(label.slice(0, 45))
    .setStyle(style === "short" ? TextInputStyle.Short : TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(style === "short" ? 256 : 4000);
  if (current) input.setValue(String(current).slice(0, style === "short" ? 256 : 4000));
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

async function openEditModal(interaction, match) {
  const docs = await loadDocs();
  let value;
  try {
    value = currentValue(docs, match);
  } catch (err) {
    await deny(interaction, `Could not open that field: ${publicError(err)}`);
    return;
  }
  const text = String(value ?? "");
  if (!text.trim()) {
    await deny(interaction, "That field is no longer on the site. Search again.");
    return;
  }
  if (text.length > 4000) {
    await deny(
      interaction,
      `**${match.pathLabel}** is ${text.length} characters. Discord forms cap at 4000, so this field can’t be edited here.`
    );
    return;
  }
  const id = proposalId();
  pending.set(id, {
    kind: "modal",
    file: match.file,
    selector: match.selector || null,
    field: match.field,
    pathLabel: match.pathLabel,
    style: match.style,
    userId: interaction.user.id,
    createdAt: Date.now(),
  });
  const style = match.style === "short" && text.length <= 256 ? "short" : "paragraph";
  await interaction.showModal(modalFor(`m:${id}`, match.pathLabel, text, style));
}

async function queueEdit(interaction, edit) {
  const docs = await loadDocs();
  const oldValue = currentValue(docs, edit);
  const newValue = edit.newValue;
  if (String(oldValue ?? "") === String(newValue ?? "")) {
    await interaction.reply({ content: "That already matches the live site. Nothing to publish.", ephemeral: true });
    return;
  }
  const edits = [{ ...edit, oldValue }];
  applyEdits(docs, edits);
  const id = proposalId();
  pending.set(id, {
    kind: "publish",
    edits,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    createdAt: Date.now(),
  });
  await interaction.reply({
    content: "Review this, then Publish. Nothing is live yet.",
    embeds: [editEmbed(edits, interaction.user.tag)],
    components: [buttons(id)],
  });
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async (c) => {
  await c.application.commands.set(slashCommands);
  console.log(`Discord connected as ${c.user.tag}; slash commands registered`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (channelId && interaction.channelId && interaction.channelId !== channelId) {
      if (interaction.isRepliable()) await deny(interaction, "Use the website channel for copy edits.");
      return;
    }
    if (!isAllowed(interaction.user.id)) {
      if (interaction.isRepliable()) await deny(interaction, "This bot only accepts edits from the show operator.");
      return;
    }

    if (interaction.isButton()) {
      const [kind, id, extra] = String(interaction.customId).split(":");
      const proposal = pending.get(id);
      if (!proposal) {
        await deny(interaction, "That proposal expired. Run the command again.");
        return;
      }
      if (kind === "pick") {
        const match = proposal.matches?.[Number(extra)];
        if (!match) {
          await deny(interaction, "That option expired. Run `/edit-text` again.");
          return;
        }
        await openEditModal(interaction, match);
        return;
      }
      if (kind === "can") {
        pending.delete(id);
        await interaction.update({ content: "Cancelled. Nothing was published.", embeds: [], components: [] });
        return;
      }
      if (kind !== "pub") return;
      if (publishLock) {
        const waited = Math.max(1, Math.round((Date.now() - publishLock.startedAt) / 1000));
        await deny(interaction, `Already publishing (${waited}s in). Wait for that to finish.`);
        return;
      }
      if (Date.now() - lastPublishAt < PUBLISH_COOLDOWN_MS) {
        const wait = Math.ceil((PUBLISH_COOLDOWN_MS - (Date.now() - lastPublishAt)) / 1000);
        await deny(interaction, `Slow down — wait ${wait}s before publishing again.`);
        return;
      }
      publishLock = { userTag: proposal.userTag, startedAt: Date.now() };
      pending.delete(id);
      await interaction.update({
        content: "Publishing… cloning the repo, rebuilding pages, then pushing to GitHub. This can take about a minute.",
        embeds: [],
        components: [],
      });
      try {
        const result = await github.publish({
          edits: proposal.edits,
          summary: summarizeEdits(proposal.edits),
          userTag: proposal.userTag,
        });
        docsCache = { at: 0, docs: null };
        lastPublishAt = Date.now();
        const elapsed = Math.round((Date.now() - publishLock.startedAt) / 1000);
        await interaction.editReply({
          content: result.url
            ? `Published in ${elapsed}s: ${result.url}\nVercel will rebuild the live site in a minute or so.`
            : "Those files already matched the site. Nothing to commit.",
        });
      } catch (err) {
        console.error(err);
        await interaction.editReply({
          content: `Publish failed: ${publicError(err)}\nRun \`/edit-text\` again when you're ready to retry.`,
        });
      } finally {
        publishLock = null;
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      const [prefix, id] = String(interaction.customId).split(":");
      if (prefix !== "m") return;
      const target = pending.get(id);
      if (!target || target.kind !== "modal") {
        await deny(interaction, "That edit form expired. Run `/edit-text` again.");
        return;
      }
      pending.delete(id);
      const newValue = interaction.fields.getTextInputValue("value");
      await queueEdit(interaction, {
        file: target.file,
        selector: target.selector,
        field: target.field,
        pathLabel: target.pathLabel,
        newValue,
      });
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "help") {
      await interaction.reply({
        ephemeral: true,
        content: [
          "Edit the live site from this channel. Nothing goes live until you click **Publish**.",
          "",
          "`/edit-text` paste a snippet of the copy you see on the website.",
          "A form opens with the current text. Change it, submit, then **Publish**.",
        ].join("\n"),
      });
      return;
    }

    if (interaction.commandName !== "edit-text") return;

    const query = interaction.options.getString("contains");
    const docs = await loadDocs();
    const matches = findText(docs, query);

    if (!matches.length) {
      await interaction.reply({
        ephemeral: true,
        content: "Couldn't find that text on the site. Paste a longer unique phrase from the page.",
      });
      return;
    }

    if (matches.length > MAX_PICK_BUTTONS) {
      await interaction.reply({
        ephemeral: true,
        content: `That text appears in ${matches.length} places, which is too many to pick from here. Paste a longer unique phrase from the site.`,
      });
      return;
    }

    if (matches.length === 1) {
      const match = matches[0];
      if (String(match.value).length > 4000) {
        await interaction.reply({
          ephemeral: true,
          content: `Found **${match.pathLabel}**, but it is ${match.value.length} characters. Discord forms cap at 4000, so this field can’t be edited here.`,
        });
        return;
      }
      await openEditModal(interaction, match);
      return;
    }

    const id = proposalId();
    pending.set(id, {
      kind: "pick",
      matches,
      userId: interaction.user.id,
      createdAt: Date.now(),
    });
    await interaction.reply({
      ephemeral: true,
      content: [
        `That text appears in ${matches.length} places. Pick which one to edit, or run \`/edit-text\` with a longer unique phrase.`,
        formatMatches(matches),
      ].join("\n\n"),
      components: [pickButtons(id, matches)],
    });
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      await deny(interaction, `Could not do that: ${publicError(err)}`).catch(() => {});
    }
  }
});

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, p] of pending) if (p.createdAt < cutoff) pending.delete(id);
}, 60 * 1000);

http
  .createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(req.url === "/health" ? "ok" : "startupdna-agent");
  })
  .listen(Number(process.env.PORT || 8080), () => {
    console.log(`health on :${process.env.PORT || 8080}`);
  });

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is required");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
