import type { Correction } from "@cliff-format/core";
import {
  type CliffDocument,
  type CliffEntry,
  type CliffGroup,
  canonicalId,
  createDocument,
} from "@cliff-format/core";
import type { MergedTranslation, OverwriteMode } from "./types.js";

export interface EntryLocation {
  key: string;
  group: CliffGroup;
  entry: CliffEntry;
}

export function cloneDocument(document: CliffDocument): CliffDocument {
  const cloned = createDocument(document.specVersion);
  cloned.header = {
    ...document.header,
    dependency: [...document.header.dependency],
    extensions: { ...document.header.extensions },
  };
  if (document.path !== undefined) cloned.path = document.path;
  cloned.corrections = [...document.corrections];
  cloned.groups = document.groups.map((group) => ({
    ...group,
    emotion: [...group.emotion],
    extensions: { ...group.extensions },
    entries: group.entries.map((entry) => ({
      ...entry,
      emotion: [...entry.emotion],
      reference: [...entry.reference],
      extensions: { ...entry.extensions },
    })),
  }));
  return cloned;
}

export function entryLocations(document: CliffDocument): EntryLocation[] {
  const locations: EntryLocation[] = [];
  for (const group of document.groups) {
    for (const entry of group.entries) {
      locations.push({
        key: canonicalId(document.header.namespace, document.header.clan, group.path, entry.id),
        group,
        entry,
      });
    }
  }
  return locations;
}

export function selectEntries(document: CliffDocument, overwrite: OverwriteMode): EntryLocation[] {
  if (overwrite === "none") return [];
  return entryLocations(document).filter((location) => {
    if (overwrite === "all") return true;
    const entry = location.entry;
    if (entry.status === "reviewed" || entry.status === "final") return false;
    return entry.status === "initial" || entry.target === undefined;
  });
}

export function batchDocument(
  document: CliffDocument,
  selected: readonly EntryLocation[],
): CliffDocument {
  const cloned = cloneDocument(document);
  const allowed = new Set(selected.map((location) => location.key));
  const groups: CliffGroup[] = [];
  for (const group of cloned.groups) {
    const entries = group.entries.filter((entry) =>
      allowed.has(canonicalId(cloned.header.namespace, cloned.header.clan, group.path, entry.id)),
    );
    if (entries.length > 0) {
      groups.push({ ...group, entries });
    }
  }
  cloned.groups = groups;
  return cloned;
}

export function extractCliff(raw: string): string {
  let text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const tick = String.fromCharCode(96);
  const fence = new RegExp(tick + "{3}[a-zA-Z0-9_-]*\\n([\\s\\S]*?)" + tick + "{3}", "m").exec(
    text,
  );
  if (fence !== null) {
    text = fence[1] as string;
  }
  const lines = text.split("\n");
  const versionPattern = /^\s*cliff\s+1\.[01](?:\.\d+)*\s*$/i;
  const start = lines.findIndex((line) => versionPattern.test(line));
  if (start < 0) {
    throw new Error("the model response does not contain a CLIFF version line");
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (versionPattern.test(lines[index] as string)) {
      end = index;
      break;
    }
  }
  let body = lines.slice(start, end).join("\n");
  body = body
    .replace(new RegExp("^\\s*" + tick + "{3}.*$", "gm"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  return body + "\n";
}

export function mergeTargets(
  original: CliffDocument,
  translated: CliffDocument,
  options: {
    overwrite: OverwriteMode;
    status: "initial" | "translated" | "reviewed" | "final";
    selected: readonly EntryLocation[];
  },
): MergedTranslation {
  const result = cloneDocument(original);
  const translatedByKey = new Map(
    entryLocations(translated).map((location) => [location.key, location.entry]),
  );
  const selected = new Set(options.selected.map((location) => location.key));
  const untranslated: string[] = [];
  const structuralChanges: string[] = [];
  const corrections: Correction[] = [...translated.corrections];
  const originalLocations = entryLocations(result);

  for (const location of originalLocations) {
    if (!selected.has(location.key)) continue;
    const candidate = translatedByKey.get(location.key);
    if (candidate === undefined) {
      untranslated.push(location.key);
      continue;
    }
    if (candidate.source !== undefined && candidate.source !== location.entry.source) {
      structuralChanges.push("source-changed:" + location.key);
    }
    if (candidate.target === undefined) {
      untranslated.push(location.key);
      continue;
    }
    if (
      options.overwrite !== "all" &&
      (location.entry.status === "reviewed" || location.entry.status === "final")
    ) {
      continue;
    }
    location.entry.target = candidate.target;
    location.entry.status = options.status;
  }

  for (const key of translatedByKey.keys()) {
    if (!originalLocations.some((location) => location.key === key)) {
      structuralChanges.push("unknown-entry:" + key);
    }
  }

  return { document: result, untranslated, structuralChanges, corrections };
}
