import {
  type CliffDocument,
  type CliffGroup,
  CliffModelError,
  CliffValidationError,
  canonicalId,
  createDocument,
  createExtensions,
  hasErrors,
  isName,
  LANG_RE,
  normalizeIdentifier,
  uniqueIdentifier,
  validateDocument,
} from "@cliff-format/core";
import type { ConversionWarning, ConvertResult } from "./result.js";

export interface JsonImportOptions {
  namespace: string;
  clan: string;
  sourceLanguage: string;
  targetLanguage: string;
  valueRole?: "target" | "source";
  entryType?: string;
  entryStatus?: string;
  keySeparator?: string;
  maxEntries?: number;
  maxDepth?: number;
}

export interface JsonExportOptions {
  keyStyle?: "canonical" | "group-entry" | "entry";
  value?: "target" | "source";
  fallbackToSource?: boolean;
}

export interface FlatEntry {
  key: string;
  value: string;
}

function requireName(value: string, label: string): void {
  if (!isName(value)) throw new CliffModelError(`${label} must be a valid CLIFF name`);
}

function requireLanguage(value: string, label: string): void {
  if (!LANG_RE.test(value)) {
    throw new CliffModelError(`${label} must be a plausible BCP 47 language tag`);
  }
}

function normalizedOptions(options: JsonImportOptions) {
  requireName(options.namespace, "namespace");
  requireName(options.clan, "clan");
  requireLanguage(options.sourceLanguage, "sourceLanguage");
  requireLanguage(options.targetLanguage, "targetLanguage");
  const maxEntries = options.maxEntries ?? 1_000_000;
  const maxDepth = options.maxDepth ?? 64;
  if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0) {
    throw new RangeError("maxEntries must be a positive safe integer");
  }
  if (!Number.isSafeInteger(maxDepth) || maxDepth <= 0) {
    throw new RangeError("maxDepth must be a positive safe integer");
  }
  return {
    namespace: options.namespace,
    clan: options.clan,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    valueRole: options.valueRole ?? "target",
    entryType: options.entryType ?? "sentence",
    entryStatus: options.entryStatus,
    keySeparator: options.keySeparator ?? ".",
    maxEntries,
    maxDepth,
  };
}

export function buildDocumentFromEntries(
  entries: readonly FlatEntry[],
  options: JsonImportOptions,
): ConvertResult {
  const normalized = normalizedOptions(options);
  if (normalized.keySeparator.length === 0) {
    throw new CliffModelError("keySeparator must not be empty");
  }
  if (entries.length > normalized.maxEntries) {
    throw new CliffModelError(
      `JSON contains ${entries.length} entries, which exceeds the limit of ${normalized.maxEntries}`,
    );
  }

  const document = createDocument();
  document.header.namespace = normalized.namespace;
  document.header.clan = normalized.clan;
  document.header.sourceLanguage = normalized.sourceLanguage;
  document.header.targetLanguage = normalized.targetLanguage;
  const warnings: ConversionWarning[] = [];
  const groups = new Map<string, CliffGroup>();
  const usedEntryIds = new Set<string>();

  for (const item of entries) {
    if (item.value.length === 0) {
      warnings.push({ path: item.key, message: "empty value" });
    }
    const parts = item.key.split(normalized.keySeparator);
    if (parts.length === 0 || parts.some((part) => part.length === 0)) {
      throw new CliffModelError(`JSON key '${item.key}' has an empty path segment`);
    }
    const rawEntry = parts[parts.length - 1] as string;
    const normalizedGroupParts = parts.slice(0, -1).map((part) => {
      const value = normalizeIdentifier(part, "group");
      if (value !== part) {
        warnings.push({
          path: item.key,
          message: "normalized a group path segment",
          before: part,
          after: value,
        });
      }
      return value;
    });
    const groupPath = normalizedGroupParts.length > 0 ? normalizedGroupParts.join(".") : "imported";
    let entryId = normalizeIdentifier(rawEntry, "entry");
    if (entryId !== rawEntry) {
      warnings.push({
        path: item.key,
        message: "normalized an entry id",
        before: rawEntry,
        after: entryId,
      });
    }
    if (usedEntryIds.has(entryId)) {
      const before = entryId;
      entryId = uniqueIdentifier(entryId, usedEntryIds);
      warnings.push({
        path: item.key,
        message: "disambiguated a duplicate entry id",
        before,
        after: entryId,
      });
    } else {
      usedEntryIds.add(entryId);
    }

    let group = groups.get(groupPath);
    if (group === undefined) {
      group = {
        path: groupPath,
        line: 0,
        emotion: [],
        entries: [],
        extensions: createExtensions(),
      };
      groups.set(groupPath, group);
      document.groups.push(group);
    }

    const target = normalized.valueRole === "target" ? item.value : undefined;
    const source = normalized.valueRole === "target" ? item.key : item.value;
    const status =
      normalized.entryStatus ??
      (target !== undefined && target.length > 0 ? "translated" : "initial");
    group.entries.push({
      id: entryId,
      line: 0,
      source,
      ...(target !== undefined ? { target } : {}),
      type: normalized.entryType,
      emotion: [],
      status,
      reference: [],
      extensions: createExtensions(),
    });
  }

  const issues = validateDocument(document);
  if (hasErrors(issues)) throw new CliffValidationError(issues);
  return { document, warnings };
}

export function fromFlatJson(value: unknown, options: JsonImportOptions): ConvertResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CliffModelError("flat JSON root must be an object");
  }
  const record = value as Record<string, unknown>;
  const entries: FlatEntry[] = [];
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (typeof item !== "string") {
      throw new CliffModelError(`flat JSON value at '${key}' must be a string`);
    }
    entries.push({ key, value: item });
  }
  return buildDocumentFromEntries(entries, options);
}

function entryKey(document: CliffDocument, group: CliffGroup, id: string, style: string): string {
  if (style === "canonical") {
    return canonicalId(document.header.namespace, document.header.clan, group.path, id);
  }
  if (style === "group-entry") return group.path.length > 0 ? `${group.path}.${id}` : id;
  return id;
}

export function toFlatJson(
  document: CliffDocument,
  options: JsonExportOptions = {},
): Record<string, string> {
  const style = options.keyStyle ?? "canonical";
  const chosen = options.value ?? "target";
  const fallback = options.fallbackToSource ?? false;
  const result = Object.create(null) as Record<string, string>;
  for (const group of document.groups) {
    for (const entry of group.entries) {
      const key = entryKey(document, group, entry.id, style);
      let value = chosen === "target" ? entry.target : entry.source;
      if (value === undefined && fallback) {
        value = chosen === "target" ? entry.source : entry.target;
      }
      if (value === undefined) continue;
      if (Object.hasOwn(result, key)) {
        throw new CliffModelError(`flat JSON key collision at '${key}'`);
      }
      result[key] = value;
    }
  }
  return result;
}
