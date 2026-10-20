import { SlashCommandBuilder } from "discord.js";
import { getAt } from "./edits.js";

export const slashCommands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("How to edit the Startup DNA site from Discord"),
  new SlashCommandBuilder()
    .setName("edit-text")
    .setDescription("Find site copy by a snippet, then edit it")
    .addStringOption((o) =>
      o
        .setName("contains")
        .setDescription("A snippet of the copy you see on the website")
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(4000)
    ),
].map((c) => c.toJSON());

export function currentValue(docs, edit) {
  const file = docs[edit.file];
  if (edit.selector?.slug) {
    const rec = file.find((row) => row.slug === edit.selector.slug);
    if (!rec) throw new Error("that person is not on the site");
    return getAt(rec, edit.field);
  }
  if (edit.selector?.id) {
    const rec = file.find((row) => row.id === edit.selector.id);
    if (!rec) throw new Error("that episode is not on the site");
    return getAt(rec, edit.field);
  }
  return getAt(file, edit.field);
}
