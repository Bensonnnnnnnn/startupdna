import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdits } from "./edits.js";
import { findText } from "./search.js";

const docs = {
  "data/site.json": {
    tagline: "We admire startups. But we love founders.",
    description: "A founder-interview podcast from Taipei.",
    url: "https://startupdna.example.com/startupdna/",
    location: "Taipei, Taiwan",
    host: {
      name: "Anthony Lin",
      bio: "Anthony Lin created Startup DNA after years observing the industry.",
      linkedin: "https://www.linkedin.com/in/anthony-m-lin",
    },
    aboutShowTitle: "Beyond the pitch deck",
    manifesto: [
      "They are the modern-day explorers of new markets.",
      "Reaching beyond the pitch decks and demos.",
    ],
  },
  "data/founders.json": [
    {
      slug: "palak-jain",
      id: "should-not-match-id",
      name: "Palak Jain",
      photo: "assets/img/palak.jpg",
      photoPosition: "100% center",
      companyUrl: "https://example.com/palak",
      company: "Acme",
      bio: "Palak Jain is building something unique in Taipei.",
      oneLiner: "A short line about grit.",
    },
  ],
  "data/episodes.json": [
    {
      id: "abc123XYZ",
      slug: "palak-episode",
      title: "Inside the unique founder journey",
      hook: "What happens next?",
      description: "A conversation recorded in 2026.",
      published: "2026-10-15",
      url: "https://youtube.com/watch?v=abc123XYZ",
    },
  ],
};

test("finds a unique site tagline", () => {
  const matches = findText(docs, "love founders");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].file, "data/site.json");
  assert.equal(matches[0].field, "tagline");
  assert.match(matches[0].pathLabel, /Tagline/i);
  assert.equal(matches[0].value, docs["data/site.json"].tagline);
});

test("finds a substring in a founder bio", () => {
  const matches = findText(docs, "building something unique");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].file, "data/founders.json");
  assert.deepEqual(matches[0].selector, { slug: "palak-jain" });
  assert.equal(matches[0].field, "bio");
  assert.match(matches[0].pathLabel, /Palak Jain/i);
});

test("finds an episode title", () => {
  const matches = findText(docs, "unique founder journey");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].file, "data/episodes.json");
  assert.deepEqual(matches[0].selector, { id: "abc123XYZ" });
  assert.equal(matches[0].field, "title");
});

test("returns multiple matches without guessing", () => {
  const matches = findText(docs, "Taipei");
  assert.ok(matches.length >= 2);
  const fields = matches.map((m) => `${m.file}:${m.field}`);
  assert.ok(fields.includes("data/site.json:location"));
  assert.ok(fields.includes("data/site.json:description"));
  assert.ok(fields.includes("data/founders.json:bio"));
});

test("returns no match for unknown copy", () => {
  assert.deepEqual(findText(docs, "this-string-is-nowhere"), []);
});

test("finds the About show title, not only manifesto body", () => {
  const matches = findText(docs, "Beyond the pitch deck");
  const fields = matches.map((m) => m.field);
  assert.ok(fields.includes("aboutShowTitle"));
  assert.equal(matches.find((m) => m.field === "aboutShowTitle").pathLabel, "About → Show title");
});

test("is case-insensitive", () => {
  const matches = findText(docs, "LOVE FOUNDERS");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].field, "tagline");
});

test("does not match ids, slugs, photos, urls, or dates", () => {
  assert.deepEqual(findText(docs, "palak-jain"), []);
  assert.deepEqual(findText(docs, "abc123XYZ"), []);
  assert.deepEqual(findText(docs, "100% center"), []);
  assert.deepEqual(findText(docs, "assets/img/palak.jpg"), []);
  assert.deepEqual(findText(docs, "https://example.com/palak"), []);
  assert.deepEqual(findText(docs, "https://startupdna.example.com"), []);
  assert.deepEqual(findText(docs, "2026-10-15"), []);
});

test("ignores empty strings and empty queries", () => {
  assert.deepEqual(findText(docs, "   "), []);
  assert.deepEqual(findText(docs, ""), []);
  const withEmpty = structuredClone(docs);
  withEmpty["data/founders.json"][0].oneLiner = "   ";
  assert.equal(findText(withEmpty, "grit").length, 0);
});

test("search match can be applied through applyEdits", () => {
  const [match] = findText(docs, "building something unique");
  const { docs: next } = applyEdits(docs, [
    {
      file: match.file,
      selector: match.selector,
      field: match.field,
      oldValue: match.value,
      newValue: "Updated bio.",
    },
  ]);
  assert.equal(next["data/founders.json"][0].bio, "Updated bio.");
});
