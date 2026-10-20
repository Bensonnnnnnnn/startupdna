import { getAt } from "./edits.js";

export const MAX_PICK_BUTTONS = 5;

const SITE_FILE = "data/site.json";
const FOUNDERS_FILE = "data/founders.json";
const EPISODES_FILE = "data/episodes.json";

function consider(matches, q, rec) {
  const value = rec.value;
  if (typeof value !== "string") return;
  if (!value.trim()) return;
  if (!value.toLowerCase().includes(q)) return;
  matches.push({
    file: rec.file,
    selector: rec.selector || null,
    field: rec.field,
    pathLabel: rec.pathLabel,
    style: rec.style || "paragraph",
    value,
  });
}

function stringAt(obj, field) {
  return getAt(obj, field);
}

function collectSite(site, q, matches) {
  const fields = [
    ["tagline", "Homepage → Tagline", "short"],
    ["description", "Homepage → Description", "paragraph"],
    ["location", "Homepage → Location", "short"],
    ["host.name", "Host → Name", "short"],
    ["host.nickname", "Host → Nickname", "short"],
    ["host.role", "Host → Role", "short"],
    ["host.bio", "Host → Bio", "paragraph"],
    ["aboutShowTitle", "About → Show title", "short"],
  ];
  for (const [field, pathLabel, style] of fields) {
    consider(matches, q, {
      file: SITE_FILE,
      field,
      pathLabel,
      style,
      value: stringAt(site, field),
    });
  }
  (Array.isArray(site.manifesto) ? site.manifesto : []).forEach((line, i) => {
    consider(matches, q, {
      file: SITE_FILE,
      field: `manifesto.${i}`,
      pathLabel: `Homepage → Manifesto line ${i + 1}`,
      style: "paragraph",
      value: line,
    });
  });
  (Array.isArray(site.pullQuotes) ? site.pullQuotes : []).forEach((quote, i) => {
    consider(matches, q, {
      file: SITE_FILE,
      field: `pullQuotes.${i}.text`,
      pathLabel: `Homepage → Pull quote ${i + 1}`,
      style: "paragraph",
      value: quote?.text,
    });
  });
  (Array.isArray(site.partners) ? site.partners : []).forEach((partner, i) => {
    consider(matches, q, {
      file: SITE_FILE,
      field: `partners.${i}.name`,
      pathLabel: `Homepage → Partner ${i + 1} name`,
      style: "short",
      value: partner?.name,
    });
    consider(matches, q, {
      file: SITE_FILE,
      field: `partners.${i}.role`,
      pathLabel: `Homepage → Partner ${i + 1} role`,
      style: "short",
      value: partner?.role,
    });
  });
}

function collectFounder(rec, q, matches) {
  if (!rec?.slug) return;
  const who = rec.name || rec.slug;
  const selector = { slug: rec.slug };
  const fields = [
    ["name", "Name", "short"],
    ["chineseName", "Chinese name", "short"],
    ["title", "Role / title", "short"],
    ["company", "Company", "short"],
    ["location", "Location", "short"],
    ["oneLiner", "One-liner", "paragraph"],
    ["bio", "Bio", "paragraph"],
    ["companyBlurb", "Company blurb", "paragraph"],
  ];
  for (const [field, label, style] of fields) {
    consider(matches, q, {
      file: FOUNDERS_FILE,
      selector,
      field,
      pathLabel: `Founder ${who} → ${label}`,
      style,
      value: rec[field],
    });
  }
  (Array.isArray(rec.traits) ? rec.traits : []).forEach((trait, i) => {
    consider(matches, q, {
      file: FOUNDERS_FILE,
      selector,
      field: `traits.${i}`,
      pathLabel: `Founder ${who} → Trait ${i + 1}`,
      style: "short",
      value: trait,
    });
  });
  (Array.isArray(rec.quotes) ? rec.quotes : []).forEach((quote, i) => {
    consider(matches, q, {
      file: FOUNDERS_FILE,
      selector,
      field: `quotes.${i}.text`,
      pathLabel: `Founder ${who} → Quote ${i + 1}`,
      style: "paragraph",
      value: quote?.text,
    });
  });
}

function collectEpisode(rec, q, matches) {
  if (!rec?.id) return;
  const who = rec.guestLabel || rec.title || rec.id;
  const selector = { id: rec.id };
  const fields = [
    ["title", "Title", "paragraph"],
    ["hook", "Hook", "paragraph"],
    ["description", "Description", "paragraph"],
    ["guestLabel", "Guest name", "short"],
    ["company", "Company", "short"],
    ["series", "Series", "short"],
  ];
  for (const [field, label, style] of fields) {
    consider(matches, q, {
      file: EPISODES_FILE,
      selector,
      field,
      pathLabel: `Episode ${who} → ${label}`,
      style,
      value: rec[field],
    });
  }
  (Array.isArray(rec.takeaways) ? rec.takeaways : []).forEach((line, i) => {
    consider(matches, q, {
      file: EPISODES_FILE,
      selector,
      field: `takeaways.${i}`,
      pathLabel: `Episode ${who} → Takeaway ${i + 1}`,
      style: "paragraph",
      value: line,
    });
  });
}

export function findText(docs, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return [];
  const matches = [];
  collectSite(docs?.[SITE_FILE] || {}, q, matches);
  for (const rec of docs?.[FOUNDERS_FILE] || []) collectFounder(rec, q, matches);
  for (const rec of docs?.[EPISODES_FILE] || []) collectEpisode(rec, q, matches);
  return matches;
}
