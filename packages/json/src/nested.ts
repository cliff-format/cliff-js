import { type CliffDocument, CliffModelError } from "@cliff-format/core";
import {
  buildDocumentFromEntries,
  type FlatEntry,
  type JsonExportOptions,
  type JsonImportOptions,
} from "./flat.js";
import type { ConvertResult } from "./result.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function fromNestedJson(value: unknown, options: JsonImportOptions): ConvertResult {
  if (!isRecord(value)) throw new CliffModelError("nested JSON root must be an object");
  const maxDepth = options.maxDepth ?? 64;
  const maxEntries = options.maxEntries ?? 1_000_000;
  const separator = options.keySeparator ?? ".";
  const entries: FlatEntry[] = [];
  const walk = (object: Record<string, unknown>, prefix: string[], depth: number): void => {
    if (depth > maxDepth) throw new CliffModelError("nested JSON exceeds the depth limit");
    for (const key of Object.keys(object)) {
      if (key.length === 0) throw new CliffModelError("nested JSON has an empty key");
      if (separator.length > 0 && key.includes(separator)) {
        throw new CliffModelError(
          `nested JSON key '${key}' contains the key separator '${separator}'`,
        );
      }
      const item = object[key];
      const path = prefix.concat(key);
      if (isRecord(item)) {
        walk(item, path, depth + 1);
      } else if (typeof item === "string") {
        entries.push({ key: path.join(separator), value: item });
        if (entries.length > maxEntries) {
          throw new CliffModelError("nested JSON exceeds the entry limit");
        }
      } else {
        throw new CliffModelError(`nested JSON leaf '${path.join(separator)}' must be a string`);
      }
    }
  };
  walk(value, [], 1);
  return buildDocumentFromEntries(entries, { ...options, maxDepth, maxEntries });
}

function createObject(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

export function toNestedJson(
  document: CliffDocument,
  options: JsonExportOptions = {},
): Record<string, unknown> {
  const chosen = options.value ?? "target";
  const fallback = options.fallbackToSource ?? false;
  const root = createObject();
  for (const group of document.groups) {
    const segments = group.path.split(".").filter((segment) => segment.length > 0);
    let current = root;
    for (const segment of segments) {
      const existing = current[segment];
      if (existing === undefined) {
        const next = createObject();
        current[segment] = next;
        current = next;
      } else if (isRecord(existing)) {
        current = existing;
      } else {
        throw new CliffModelError(`nested JSON collision at '${segment}'`);
      }
    }
    for (const entry of group.entries) {
      let value = chosen === "target" ? entry.target : entry.source;
      if (value === undefined && fallback) {
        value = chosen === "target" ? entry.source : entry.target;
      }
      if (value === undefined) continue;
      if (Object.hasOwn(current, entry.id)) {
        throw new CliffModelError(`nested JSON key collision at '${entry.id}'`);
      }
      current[entry.id] = value;
    }
  }
  return root;
}
