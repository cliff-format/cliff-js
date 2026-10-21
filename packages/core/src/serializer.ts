import { CliffModelError } from "./errors.js";
import { isName, isWellFormedString } from "./identifiers.js";
import type { CliffDocument, CliffEntry, CliffGroup, CliffHeader, SpecVersion } from "./model.js";

function assertRepresentable(value: string): void {
  if (!isWellFormedString(value)) {
    throw new CliffModelError("string contains an unpaired surrogate");
  }
  for (const char of value) {
    const code = char.codePointAt(0) as number;
    if (code === 0x0a || code === 0x0d || code === 0x09) continue;
    if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      throw new CliffModelError(
        `string contains an unrepresentable control character U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
      );
    }
  }
}

function quote(value: string): string {
  assertRepresentable(value);
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function quotedList(items: readonly string[]): string {
  return "[" + items.map(quote).join(", ") + "]";
}

function bareList(items: readonly string[]): string {
  return "[" + items.join(", ") + "]";
}

function extensionLines(extensions: Record<string, string>): string[] {
  return Object.keys(extensions)
    .sort()
    .map((key) => {
      if (!isName(key) || !key.startsWith("x-")) {
        throw new CliffModelError(`invalid extension key '${key}'`);
      }
      const value = extensions[key] as string;
      assertRepresentable(value);
      if (value.includes("\n") || value.includes("\r")) {
        throw new CliffModelError(`extension '${key}' value must be single-line`);
      }
      return `${key}: ${value}`;
    });
}

function headerLines(header: CliffHeader, version: SpecVersion): string[] {
  const lines = [`CLIFF ${version}`];
  lines.push(`namespace: ${header.namespace}`);
  lines.push(`clan: ${header.clan}`);
  lines.push(`source-language: ${header.sourceLanguage}`);
  lines.push(`target-language: ${header.targetLanguage}`);
  if (header.version !== undefined) lines.push(`version: ${quote(header.version)}`);
  if (header.variant !== "standard") lines.push(`variant: ${header.variant}`);
  if (header.title !== undefined) lines.push(`title: ${quote(header.title)}`);
  if (header.info !== undefined) lines.push(`info: ${quote(header.info)}`);
  if (header.standard !== undefined) lines.push(`standard: ${quote(header.standard)}`);
  if (header.dependency.length > 0) lines.push(`dependency: ${quotedList(header.dependency)}`);
  lines.push(...extensionLines(header.extensions));
  return lines;
}

function entryLines(entry: CliffEntry): string[] {
  const lines = [`<${entry.id}>`];
  if (entry.source !== undefined) lines.push(`source: ${quote(entry.source)}`);
  if (entry.target !== undefined) lines.push(`target: ${quote(entry.target)}`);
  if (entry.type !== undefined) lines.push(`type: ${entry.type}`);
  if (entry.emotion.length > 0) lines.push(`emotion: ${bareList(entry.emotion)}`);
  if (entry.status !== undefined) lines.push(`status: ${entry.status}`);
  if (entry.context !== undefined) lines.push(`context: ${quote(entry.context)}`);
  if (entry.maxWidth !== undefined) lines.push(`max-width: ${entry.maxWidth}`);
  if (entry.reference.length > 0) lines.push(`reference: ${quotedList(entry.reference)}`);
  if (entry.reviewer !== undefined) lines.push(`reviewer: ${quote(entry.reviewer)}`);
  lines.push(...extensionLines(entry.extensions));
  return lines;
}

function groupLines(group: CliffGroup): string[] {
  const lines = [`[${group.path}]`];
  if (group.context !== undefined) lines.push(`context: ${quote(group.context)}`);
  if (group.type !== undefined) lines.push(`type: ${group.type}`);
  if (group.emotion.length > 0) lines.push(`emotion: ${bareList(group.emotion)}`);
  if (group.maxWidth !== undefined) lines.push(`max-width: ${group.maxWidth}`);
  lines.push(...extensionLines(group.extensions));
  for (const entry of group.entries) {
    lines.push("");
    lines.push(...entryLines(entry));
  }
  return lines;
}

export interface SerializeOptions {
  version?: SpecVersion;
}

export function serialize(document: CliffDocument, options: SerializeOptions = {}): string {
  const version = options.version ?? document.specVersion ?? "1.1";
  const lines = headerLines(document.header, version);
  for (const group of document.groups) {
    lines.push("");
    lines.push(...groupLines(group));
  }
  return lines.join("\n") + "\n";
}
