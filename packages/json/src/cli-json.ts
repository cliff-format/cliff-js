import {
  type CliffDocument,
  type CliffEntry,
  type CliffGroup,
  CliffModelError,
  createDocument,
  createExtensions,
  type SpecVersion,
} from "@cliff-format/core";

export interface CliJsonObject {
  "spec-version": SpecVersion;
  header: Record<string, unknown>;
  groups: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownString(value: Record<string, unknown>, key: string, label: string): string {
  const result = value[key];
  if (typeof result !== "string") {
    throw new CliffModelError(`${label} must be a string`);
  }
  return result;
}

function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  const result = value[key];
  if (result === undefined || result === null) return undefined;
  if (typeof result !== "string") throw new CliffModelError(`${key} must be a string`);
  return result;
}

function stringArray(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new CliffModelError(`${label} must be an array of strings`);
  }
  return value.slice() as string[];
}

function extensions(value: unknown, label: string): Record<string, string> {
  if (value === undefined || value === null) return createExtensions();
  if (!isRecord(value)) throw new CliffModelError(`${label} must be an object`);
  const result = createExtensions();
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (typeof item !== "string") {
      throw new CliffModelError(`${label}.${key} must be a string`);
    }
    result[key] = item;
  }
  return result;
}

function pickHeaderString(header: Record<string, unknown>, keys: string[], label: string): string {
  for (const key of keys) {
    const value = header[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  throw new CliffModelError(`CLIFF-shaped input is missing required header field '${label}'`);
}

export function isCliffObject(value: unknown): value is CliJsonObject {
  return isRecord(value) && isRecord(value.header) && Array.isArray(value.groups);
}

export function toCliJson(document: CliffDocument): CliJsonObject {
  const header = document.header;
  const headerData: Record<string, unknown> = {
    namespace: header.namespace,
    clan: header.clan,
    "source-language": header.sourceLanguage,
    "target-language": header.targetLanguage,
  };
  if (header.version !== undefined) headerData.version = header.version;
  if (header.variant !== "standard") headerData.variant = header.variant;
  if (header.title !== undefined) headerData.title = header.title;
  if (header.info !== undefined) headerData.info = header.info;
  if (header.standard !== undefined) headerData.standard = header.standard;
  if (header.dependency.length > 0) headerData.dependency = [...header.dependency];
  if (Object.keys(header.extensions).length > 0) headerData.extensions = { ...header.extensions };

  const groups = document.groups.map((group) => {
    const groupData: Record<string, unknown> = { path: group.path };
    if (group.context !== undefined) groupData.context = group.context;
    if (group.type !== undefined) groupData.type = group.type;
    if (group.emotion.length > 0) groupData.emotion = [...group.emotion];
    if (group.maxWidth !== undefined) groupData["max-width"] = group.maxWidth;
    if (Object.keys(group.extensions).length > 0) {
      groupData.extensions = { ...group.extensions };
    }
    groupData.entries = group.entries.map((entry) => {
      const entryData: Record<string, unknown> = { id: entry.id };
      if (entry.source !== undefined) entryData.source = entry.source;
      if (entry.target !== undefined) entryData.target = entry.target;
      if (entry.type !== undefined) entryData.type = entry.type;
      if (entry.emotion.length > 0) entryData.emotion = [...entry.emotion];
      if (entry.status !== undefined) entryData.status = entry.status;
      if (entry.context !== undefined) entryData.context = entry.context;
      if (entry.maxWidth !== undefined) entryData["max-width"] = entry.maxWidth;
      if (entry.reference.length > 0) entryData.reference = [...entry.reference];
      if (entry.reviewer !== undefined) entryData.reviewer = entry.reviewer;
      if (Object.keys(entry.extensions).length > 0) {
        entryData.extensions = { ...entry.extensions };
      }
      return entryData;
    });
    return groupData;
  });

  return { "spec-version": document.specVersion, header: headerData, groups };
}

export function toJsonString(document: CliffDocument, space = 2): string {
  return JSON.stringify(toCliJson(document), null, space);
}

export function fromCliJson(value: unknown): CliffDocument {
  if (!isCliffObject(value)) {
    throw new CliffModelError("input is not a CLIFF-shaped object");
  }
  const headerData = value.header;
  const document = createDocument(
    value["spec-version"] === "1.0" ? "1.0" : value["spec-version"] === "1.1" ? "1.1" : "1.1",
  );
  if (
    value["spec-version"] !== undefined &&
    value["spec-version"] !== "1.0" &&
    value["spec-version"] !== "1.1"
  ) {
    throw new CliffModelError(`unsupported spec-version '${String(value["spec-version"])}'`);
  }
  document.header.namespace = pickHeaderString(headerData, ["namespace"], "namespace");
  document.header.clan = pickHeaderString(headerData, ["clan"], "clan");
  document.header.sourceLanguage = pickHeaderString(
    headerData,
    ["source-language", "source_language", "sourceLanguage"],
    "source-language",
  );
  document.header.targetLanguage = pickHeaderString(
    headerData,
    ["target-language", "target_language", "targetLanguage"],
    "target-language",
  );
  const version = optionalString(headerData, "version");
  if (version !== undefined) document.header.version = version;
  const variant = optionalString(headerData, "variant");
  if (variant !== undefined) document.header.variant = variant;
  const title = optionalString(headerData, "title");
  if (title !== undefined) document.header.title = title;
  const info = optionalString(headerData, "info");
  if (info !== undefined) document.header.info = info;
  const standard = optionalString(headerData, "standard");
  if (standard !== undefined) document.header.standard = standard;
  document.header.dependency = stringArray(headerData.dependency, "header.dependency");
  document.header.extensions = extensions(headerData.extensions, "header.extensions");

  for (const rawGroup of value.groups) {
    if (!isRecord(rawGroup)) throw new CliffModelError("each group must be an object");
    const path = ownString(rawGroup, "path", "group.path");
    const group: CliffGroup = {
      path,
      line: 0,
      emotion: stringArray(rawGroup.emotion, "group.emotion"),
      entries: [],
      extensions: extensions(rawGroup.extensions, "group.extensions"),
    };
    const groupContext = optionalString(rawGroup, "context");
    if (groupContext !== undefined) group.context = groupContext;
    const groupType = optionalString(rawGroup, "type");
    if (groupType !== undefined) group.type = groupType;
    const groupWidth = rawGroup["max-width"];
    if (groupWidth !== undefined && groupWidth !== null) {
      if (typeof groupWidth !== "number" || !Number.isInteger(groupWidth)) {
        throw new CliffModelError("group.max-width must be an integer");
      }
      group.maxWidth = groupWidth;
    }
    const rawEntries = rawGroup.entries;
    if (!Array.isArray(rawEntries)) throw new CliffModelError("group.entries must be an array");
    for (const rawEntry of rawEntries) {
      if (!isRecord(rawEntry)) throw new CliffModelError("each entry must be an object");
      const entry: CliffEntry = {
        id: ownString(rawEntry, "id", "entry.id"),
        line: 0,
        emotion: stringArray(rawEntry.emotion, "entry.emotion"),
        reference: stringArray(rawEntry.reference, "entry.reference"),
        extensions: extensions(rawEntry.extensions, "entry.extensions"),
      };
      for (const key of ["source", "target", "type", "status", "context", "reviewer"] as const) {
        const item = optionalString(rawEntry, key);
        if (item !== undefined) entry[key] = item;
      }
      const entryWidth = rawEntry["max-width"];
      if (entryWidth !== undefined && entryWidth !== null) {
        if (typeof entryWidth !== "number" || !Number.isInteger(entryWidth)) {
          throw new CliffModelError("entry.max-width must be an integer");
        }
        entry.maxWidth = entryWidth;
      }
      group.entries.push(entry);
    }
    document.groups.push(group);
  }
  return document;
}

export function fromJsonString(text: string): CliffDocument {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new CliffModelError("invalid JSON", { cause });
  }
  return fromCliJson(value);
}
