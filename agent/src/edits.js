export const ALLOWED_FILES = ["data/site.json", "data/episodes.json", "data/founders.json"];

const isAllowed = (file) => ALLOWED_FILES.includes(file);

export function getAt(obj, field) {
  if (!field) return obj;
  const parts = String(field)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setAt(obj, field, value) {
  const parts = String(field)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  if (!parts.length) throw new Error("empty field");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function findRecord(doc, file, selector) {
  if (!selector || (!selector.slug && !selector.id)) return { target: doc, isArray: false };
  if (!Array.isArray(doc)) throw new Error(`${file} is not a list`);
  const rec = doc.find((row) => {
    if (selector.slug && row.slug === selector.slug) return true;
    if (selector.id && row.id === selector.id) return true;
    return false;
  });
  if (!rec) throw new Error(`no matching record in ${file}`);
  return { target: rec, isArray: true };
}

function normalize(value) {
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

export function applyEdits(docs, edits) {
  const next = {
    "data/site.json": structuredClone(docs["data/site.json"]),
    "data/episodes.json": structuredClone(docs["data/episodes.json"]),
    "data/founders.json": structuredClone(docs["data/founders.json"]),
  };
  const applied = [];

  for (const edit of edits || []) {
    if (!isAllowed(edit.file)) throw new Error(`cannot edit ${edit.file}`);
    if (!edit.field) throw new Error("missing field");
    const { target } = findRecord(next[edit.file], edit.file, edit.selector);
    const current = getAt(target, edit.field);
    if (edit.oldValue != null && normalize(current) !== normalize(edit.oldValue)) {
      throw new Error(
        `value changed under ${edit.file} ${edit.field}: expected the text I showed, found something else`
      );
    }
    setAt(target, edit.field, edit.newValue);
    applied.push({
      file: edit.file,
      selector: edit.selector || null,
      field: edit.field,
      oldValue: current,
      newValue: edit.newValue,
    });
  }
  return { docs: next, applied };
}

export function summarizeEdits(edits) {
  return (edits || [])
    .map((e) => {
      const who = e.selector?.slug || e.selector?.id || e.file.replace("data/", "").replace(".json", "");
      return `**${who}** \`${e.field}\``;
    })
    .join("\n");
}

export function clip(text, n = 700) {
  const s = String(text ?? "");
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
