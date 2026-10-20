import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdits } from "./edits.js";

test("updates site tagline", () => {
  const { docs } = applyEdits(
    {
      "data/site.json": { tagline: "old" },
      "data/episodes.json": [],
      "data/founders.json": [],
    },
    [{ file: "data/site.json", field: "tagline", oldValue: "old", newValue: "new" }]
  );
  assert.equal(docs["data/site.json"].tagline, "new");
});

test("updates founder bio by slug", () => {
  const { docs } = applyEdits(
    {
      "data/site.json": {},
      "data/episodes.json": [],
      "data/founders.json": [{ slug: "palak-jain", bio: "A" }],
    },
    [
      {
        file: "data/founders.json",
        selector: { slug: "palak-jain" },
        field: "bio",
        oldValue: "A",
        newValue: "B",
      },
    ]
  );
  assert.equal(docs["data/founders.json"][0].bio, "B");
});

test("rejects files outside data json", () => {
  assert.throws(() =>
    applyEdits(
      {
        "data/site.json": {},
        "data/episodes.json": [],
        "data/founders.json": [],
      },
      [{ file: "build.js", field: "x", newValue: "no" }]
    )
  );
});
