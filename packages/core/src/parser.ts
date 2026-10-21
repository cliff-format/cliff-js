import { CliffLimitError, CliffParseError, UnsupportedSpecVersion } from "./errors.js";
import {
  isName,
  normalizeIdentifier,
  stripLineTerminator,
  uniqueIdentifier,
} from "./identifiers.js";
import { assertStringLength, normalizeInput } from "./input.js";
import { type ResolvedLimits, type ResourceLimits, resolveLimits } from "./limits.js";
import {
  type CliffDocument,
  type CliffEntry,
  type CliffGroup,
  type CliffHeader,
  type Correction,
  type CorrectionCategory,
  createDocument,
  createExtensions,
  type IssueCategory,
  type SpecVersion,
} from "./model.js";
import {
  ENTRY_KEYS,
  GROUP_KEYS,
  HEADER_KEYS,
  INT_KEYS,
  LANG_KEYS,
  LIST_KEYS,
  NAME_KEYS,
  STRING_KEYS,
  TAG_KEYS,
} from "./vocabulary.js";

const VERSION_RE = /^[ \t]*CLIFF[ \t]+(1\.0|1\.1)[ \t]*$/;
const UNSUPPORTED_VERSION_RE = /^[ \t]*CLIFF[ \t]+(\S+)[ \t]*$/i;
const TOLERANT_VERSION_RE = /^[ \t]*cliff[ \t]+(1\.(?:0|1)(?:\.\d+)*)[ \t]*$/i;
const SECTION_RE = /^[ \t]*\[([^[\]]*)\][ \t]*$/;
const ENTRY_RE = /^[ \t]*<([^<>]*)>[ \t]*$/;
const LANGUAGE_RE = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;
const INTEGER_RE = /^[0-9]+$/;
const ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  "\\": "\\",
};

export const SUPPORTED_VERSIONS = ["1.0", "1.1"] as const;
export const CANONICAL_VERSION: SpecVersion = "1.1";

export interface ParseOptions extends ResourceLimits {
  path?: string;
}

export interface TolerantParseOptions extends ParseOptions {
  onIdCollision?: "disambiguate" | "error";
}

type Container = CliffHeader | CliffGroup | CliffEntry;
type Scope = "header" | "group" | "entry";

export function canonicalId(
  namespace: string,
  clan: string,
  groupPath: string,
  entryId: string,
): string {
  return [namespace, clan, groupPath, entryId].filter((part) => part.length > 0).join(".");
}

function trimWsp(text: string): string {
  return text.replace(/^[ \t]+|[ \t]+$/g, "");
}

function isIgnorable(line: string): boolean {
  const stripped = trimWsp(line);
  return stripped.length === 0 || stripped.startsWith("#");
}

function startsQuote(text: string): boolean {
  return text.startsWith('"') || text.startsWith("'");
}

function isControlCode(code: number): boolean {
  return code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
}

function parseStringAt(text: string): { value: string; rest: string } {
  const quote = text[0];
  if (quote !== '"' && quote !== "'") {
    throw new CliffParseError("expected a quoted string");
  }
  let value = "";
  let index = 1;
  while (index < text.length) {
    const char = text[index] as string;
    if (char === quote) {
      return { value, rest: text.slice(index + 1) };
    }
    if (char === "\\") {
      if (index + 1 >= text.length) {
        throw new CliffParseError("trailing backslash in string");
      }
      const next = text[index + 1] as string;
      if (next === quote) {
        value += next;
      } else if (next === "\\") {
        value += "\\";
      } else if (next === "n" || next === "r" || next === "t") {
        value += ESCAPES[next] as string;
      } else {
        throw new CliffParseError(`unknown escape sequence \\${next}`);
      }
      index += 2;
      continue;
    }
    const code = char.charCodeAt(0);
    if (isControlCode(code)) {
      throw new CliffParseError("raw control character inside string");
    }
    value += char;
    index++;
  }
  throw new CliffParseError("unterminated string");
}

function parseAdjacentStrings(text: string): string {
  let rest = trimWsp(text);
  if (rest.length === 0) throw new CliffParseError("empty value");
  let value = "";
  while (rest.length > 0) {
    if (!startsQuote(rest)) throw new CliffParseError("expected a quoted string");
    const parsed = parseStringAt(rest);
    value += parsed.value;
    rest = parsed.rest.replace(/^[ \t]+/, "");
  }
  return value;
}

function unquoteExactly(text: string): string {
  const rest = trimWsp(text);
  if (!startsQuote(rest)) throw new CliffParseError("expected a quoted string");
  const parsed = parseStringAt(rest);
  if (trimWsp(parsed.rest).length > 0) {
    throw new CliffParseError("unexpected content after the closing quote");
  }
  return parsed.value;
}

function findSeparator(text: string): number | null {
  let quote: string | null = null;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    if (quote !== null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "=" || char === ":") {
      return i;
    }
  }
  return null;
}

function parseFieldLine(line: string): { key: string; value: string } {
  const index = findSeparator(line);
  if (index === null) {
    throw new CliffParseError("expected 'key: value' or 'key = value' field");
  }
  const key = trimWsp(line.slice(0, index));
  const value = trimWsp(line.slice(index + 1));
  if (!isName(key)) {
    throw new CliffParseError(
      `invalid field name '${key}' (a name is one or more of A-Z a-z 0-9 _ -)`,
      { category: "id" },
    );
  }
  if (value.length === 0) throw new CliffParseError("empty value");
  return { key, value };
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  let quote: string | null = null;
  let escaped = false;
  for (const char of text) {
    if (quote !== null) {
      buffer += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
    } else if (char === ",") {
      parts.push(buffer);
      buffer = "";
    } else {
      buffer += char;
    }
  }
  if (quote !== null) throw new CliffParseError("unterminated string inside list");
  parts.push(buffer);
  return parts;
}

function cleanListParts(body: string): string[] {
  const parts = splitTopLevel(body).map((part) => trimWsp(part));
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function isValidGroupPath(path: string): boolean {
  return path.length > 0 && path.split(".").every((segment) => isName(segment));
}

function beginsWithIdentifier(text: string): boolean {
  const stripped = trimWsp(text);
  if (stripped.length === 0) return true;
  if (startsQuote(stripped)) return true;
  return isName(stripped[0] as string);
}

function pathBeginsWithIdentifier(text: string): boolean {
  const stripped = trimWsp(text);
  if (stripped.length === 0) return true;
  return isName(stripped[0] as string);
}

function quotedKeySpan(line: string): { start: number; end: number } | null {
  const start = line.length - line.replace(/^[ \t]+/, "").length;
  const text = line.slice(start);
  if (!startsQuote(text)) return null;
  const quote = text[0] as string;
  let escaped = false;
  for (let i = 1; i < text.length; i++) {
    const char = text[i] as string;
    if (escaped) escaped = false;
    else if (char === "\\") escaped = true;
    else if (char === quote) {
      const rest = text.slice(i + 1).replace(/^[ \t]+/, "");
      if (rest.startsWith(":") || rest.startsWith("=")) {
        return { start, end: start + i + 1 };
      }
      return null;
    }
  }
  return null;
}

function parseGenericList(text: string): string[] {
  const trimmed = trimWsp(text);
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new CliffParseError("unclosed list (closing bracket must be on the same line)");
  }
  const body = trimWsp(trimmed.slice(1, -1));
  if (body.length === 0) return [];
  const items: string[] = [];
  for (const raw of cleanListParts(body)) {
    const part = trimWsp(raw);
    if (part.length === 0) throw new CliffParseError("empty list item");
    if (part.startsWith("[")) throw new CliffParseError("nested lists are not allowed");
    if (startsQuote(part)) {
      items.push(unquoteExactly(part));
    } else if (INTEGER_RE.test(part) || isName(part) || LANGUAGE_RE.test(part)) {
      items.push(part);
    } else {
      throw new CliffParseError("invalid list item");
    }
  }
  return items;
}

function parseExtensionValue(text: string): string {
  const trimmed = trimWsp(text);
  if (trimmed.length === 0) throw new CliffParseError("empty value");
  if (trimmed.startsWith("[")) {
    parseGenericList(trimmed);
  } else if (startsQuote(trimmed)) {
    parseAdjacentStrings(trimmed);
  } else if (!INTEGER_RE.test(trimmed) && !isName(trimmed) && !LANGUAGE_RE.test(trimmed)) {
    throw new CliffParseError("extension value is not a string, list, integer, or name");
  }
  return trimmed;
}

function parseTag(text: string): string {
  const trimmed = trimWsp(text);
  if (trimmed.length === 0) throw new CliffParseError("empty tag");
  if (startsQuote(trimmed)) {
    throw new CliffParseError(
      `tag values are unquoted lowercase words; write ${trimmed.replace(/^['"]|['"]$/g, "")} without quotes`,
    );
  }
  if (!isName(trimmed)) {
    throw new CliffParseError(`'${trimmed}' is not a valid tag (lowercase kebab-case required)`);
  }
  return trimmed;
}

function parseLanguage(text: string): string {
  const trimmed = trimWsp(text);
  if (!LANGUAGE_RE.test(trimmed)) {
    throw new CliffParseError(`'${trimmed}' is not a plausible BCP 47 language tag`);
  }
  return trimmed;
}

function parsePositiveInteger(text: string): number {
  const trimmed = trimWsp(text);
  if (!INTEGER_RE.test(trimmed) || Number(trimmed) <= 0) {
    throw new CliffParseError(`'${trimmed}' is not a positive integer`);
  }
  return Number(trimmed);
}

function parseNameValue(text: string): string {
  const trimmed = trimWsp(text);
  if (!isName(trimmed)) {
    throw new CliffParseError(`'${trimmed}' is not a valid name (one or more of A-Z a-z 0-9 _ -)`, {
      category: "id",
    });
  }
  return trimmed;
}

function parseStrictList(text: string, key: string): string[] {
  const trimmed = trimWsp(text);
  if (!trimmed.startsWith("[")) {
    throw new CliffParseError(`${key} must be a single-line list`);
  }
  if (!trimmed.endsWith("]")) {
    throw new CliffParseError("unclosed list (closing bracket must be on the same line)");
  }
  const body = trimWsp(trimmed.slice(1, -1));
  if (body.length === 0) return [];
  const items: string[] = [];
  for (const raw of cleanListParts(body)) {
    const part = trimWsp(raw);
    if (part.length === 0) throw new CliffParseError("empty list item");
    if (part.startsWith("[")) throw new CliffParseError("nested lists are not allowed");
    if (key === "dependency" || key === "reference") {
      if (!startsQuote(part)) {
        throw new CliffParseError(`${key} list items must be quoted strings`);
      }
      items.push(unquoteExactly(part));
    } else if (key === "emotion") {
      items.push(parseTag(part));
    } else {
      if (startsQuote(part)) items.push(unquoteExactly(part));
      else if (INTEGER_RE.test(part) || isName(part) || LANGUAGE_RE.test(part)) items.push(part);
      else throw new CliffParseError("invalid list item");
    }
  }
  return items;
}

function parseStrictValue(text: string, key: string): string | string[] | number {
  const trimmed = trimWsp(text);
  if (STRING_KEYS.has(key)) return parseAdjacentStrings(trimmed);
  if (LIST_KEYS.has(key)) {
    if (!trimmed.startsWith("[")) {
      const hint =
        key === "emotion"
          ? "emotion: [neutral]"
          : key === "dependency"
            ? 'dependency: ["../terms/terms.zh-CN.cliff"]'
            : 'reference: ["src/ui.cpp:12"]';
      throw new CliffParseError(
        `${key} is a list-typed field and must be written as a list, even for a single item (for example: ${hint})`,
      );
    }
    return parseStrictList(trimmed, key);
  }
  if (TAG_KEYS.has(key)) return parseTag(trimmed);
  if (INT_KEYS.has(key)) return parsePositiveInteger(trimmed);
  if (NAME_KEYS.has(key)) return parseNameValue(trimmed);
  if (LANG_KEYS.has(key)) return parseLanguage(trimmed);
  if (startsQuote(trimmed)) return unquoteExactly(trimmed);
  if (isName(trimmed)) return trimmed;
  throw new CliffParseError(`'${trimmed}' is not a valid name, string, or integer`);
}

export class Parser {
  private readonly doc: CliffDocument;
  private readonly lines: string[];
  private readonly tolerant: boolean;
  private readonly onIdCollision: "disambiguate" | "error";
  private readonly corrections: Correction[];
  private readonly limits: ResolvedLimits;

  private seenVersion = false;
  private currentGroup: CliffGroup | undefined;
  private currentEntry: CliffEntry | undefined;
  private lastContainer: Container | null = null;
  private lastKey: string | null = null;
  private seenHeader = new Set<string>();
  private seenGroup = new Set<string>();
  private seenEntry = new Set<string>();
  private seenPaths = new Set<string>();
  private seenEntryIds = new Set<string>();
  private seenCanonical = new Set<string>();
  private entryCount = 0;

  constructor(
    lines: string[],
    options: ParseOptions & { onIdCollision?: "disambiguate" | "error" },
    tolerant: boolean,
  ) {
    this.doc = createDocument();
    this.doc.corrections = [];
    if (options.path !== undefined) this.doc.path = options.path;
    this.lines = lines;
    this.tolerant = tolerant;
    this.onIdCollision = options.onIdCollision ?? "disambiguate";
    this.corrections = this.doc.corrections;
    this.limits = resolveLimits(options);
  }

  run(): CliffDocument {
    for (let index = 0; index < this.lines.length; index++) {
      const raw = this.lines[index] as string;
      const lineNumber = index + 1;
      const split = stripLineTerminator(raw);
      if (split.extra > 0) {
        this.fail("at most one trailing ',' or ';' is allowed on a line", lineNumber, raw);
      }
      const line = split.body;

      if (isIgnorable(line)) {
        this.lastContainer = null;
        this.lastKey = null;
        continue;
      }

      if (!this.seenVersion) {
        this.parseVersionLine(lineNumber, raw, line);
        this.seenVersion = true;
        continue;
      }

      const section = SECTION_RE.exec(line);
      if (section !== null) {
        const rawPath = trimWsp(section[1] as string);
        if (this.tolerant) {
          if (!pathBeginsWithIdentifier(rawPath)) {
            if (
              this.lastContainer !== null &&
              this.lastKey !== null &&
              LIST_KEYS.has(this.lastKey)
            ) {
              // A bare list continuation can look like a section line; fall through.
            } else {
              this.fail("expected 'key: value' or 'key = value' field", lineNumber, raw);
            }
          } else {
            let groupPath = this.normalizeGroupPath(rawPath, lineNumber);
            if (groupPath !== rawPath) {
              this.correct(
                lineNumber,
                "name-normalized",
                "normalized a group path",
                rawPath,
                groupPath,
              );
            }
            if (this.seenPaths.has(groupPath)) {
              const base = groupPath;
              groupPath = uniqueIdentifier(groupPath, this.seenPaths);
              this.correct(
                lineNumber,
                "id-collision",
                `disambiguated a duplicate section path (was already declared as '[${base}]')`,
                base,
                groupPath,
              );
            } else {
              this.seenPaths.add(groupPath);
            }
            this.openGroup(groupPath, lineNumber);
            continue;
          }
        }

        if (!isValidGroupPath(rawPath)) {
          if (this.lastContainer !== null && this.lastKey !== null && LIST_KEYS.has(this.lastKey)) {
            // A bare list continuation can look like a section line; fall through.
          } else {
            this.fail(
              `invalid group path '[${rawPath}]'; segments must be names (one or more of A-Z a-z 0-9 _ -)`,
              lineNumber,
              raw,
              "id",
            );
          }
        } else {
          this.seenPaths.add(rawPath);
          this.openGroup(rawPath, lineNumber);
          continue;
        }
      }

      const entry = ENTRY_RE.exec(line);
      if (entry !== null) {
        const content = trimWsp(entry[1] as string);
        if (this.tolerant && !beginsWithIdentifier(content)) {
          this.fail("expected 'key: value' or 'key = value' field", lineNumber, raw);
        }
        if (this.currentGroup === undefined) {
          this.fail("entry declared before any [group] section", lineNumber, raw);
        }
        let id = content;
        if (this.tolerant) {
          let unquoted = content;
          if (startsQuote(unquoted)) {
            unquoted = unquoteExactly(unquoted);
            this.correct(
              lineNumber,
              "name-quote",
              "removed the quotes around an entry id",
              content,
              unquoted,
            );
          }
          id = normalizeIdentifier(unquoted, "entry");
          if (id !== unquoted) {
            this.correct(lineNumber, "name-normalized", "normalized an entry id", unquoted, id);
          }
        } else if (!isName(id)) {
          this.fail(
            `invalid entry id '${id}'; a name is one or more of A-Z a-z 0-9 _ -`,
            lineNumber,
            raw,
            "id",
          );
        }
        if (this.seenEntryIds.has(id)) {
          if (this.tolerant) {
            if (this.onIdCollision === "error") {
              this.fail(`duplicate entry id '<${id}>'`, lineNumber, raw, "id");
            }
            const base = id;
            id = uniqueIdentifier(id, this.seenEntryIds);
            this.correct(
              lineNumber,
              "id-collision",
              `disambiguated a duplicate entry id '<${base}>'`,
              base,
              id,
            );
          }
        } else {
          this.seenEntryIds.add(id);
        }
        if (this.entryCount >= this.limits.maxEntries) {
          throw new CliffLimitError(`document has more than ${this.limits.maxEntries} entries`, {
            limit: "maxEntries",
            observed: this.entryCount + 1,
            line: lineNumber,
          });
        }
        this.entryCount++;
        const created: CliffEntry = {
          id,
          line: lineNumber,
          emotion: [],
          reference: [],
          extensions: createExtensions(),
        };
        this.currentGroup?.entries.push(created);
        this.currentEntry = created;
        const canonical = canonicalId(
          this.doc.header.namespace,
          this.doc.header.clan,
          this.currentGroup?.path ?? "",
          id,
        );
        if (this.seenCanonical.has(canonical)) {
          if (this.tolerant) {
            const base = id;
            id = uniqueIdentifier(id, this.seenEntryIds);
            created.id = id;
            this.correct(
              lineNumber,
              "id-collision",
              `disambiguated a duplicate canonical id '${canonical}'`,
              base,
              id,
            );
          }
        }
        this.seenCanonical.add(
          canonicalId(
            this.doc.header.namespace,
            this.doc.header.clan,
            this.currentGroup?.path ?? "",
            created.id,
          ),
        );
        this.seenEntry = new Set<string>();
        this.lastContainer = null;
        this.lastKey = null;
        continue;
      }

      const tolerantQuotedKey = this.tolerant ? quotedKeySpan(line) : null;

      if (tolerantQuotedKey === null && this.lastContainer !== null && this.lastKey !== null) {
        const stripped = trimWsp(line);
        if (STRING_KEYS.has(this.lastKey) && startsQuote(stripped)) {
          const fragment = this.located(lineNumber, raw, () => parseAdjacentStrings(stripped));
          assertStringLength(fragment, lineNumber, this.limits.maxStringLength);
          this.appendString(this.lastContainer, this.lastKey, fragment, lineNumber);
          continue;
        }
        if (LIST_KEYS.has(this.lastKey) && stripped.startsWith("[")) {
          const items = this.located(lineNumber, raw, () =>
            this.tolerant
              ? this.parseTolerantList(stripped, this.lastKey as string, lineNumber)
              : parseStrictList(stripped, this.lastKey as string),
          );
          this.appendList(this.lastContainer, this.lastKey, items, lineNumber);
          continue;
        }
        if (startsQuote(stripped) || stripped.startsWith("[")) {
          this.fail(
            `continuation line does not match the preceding '${this.lastKey}' field`,
            lineNumber,
            raw,
          );
        }
      }

      let fieldLine = line;
      if (tolerantQuotedKey !== null) {
        const before = fieldLine.slice(tolerantQuotedKey.start, tolerantQuotedKey.end);
        const bare = fieldLine.slice(tolerantQuotedKey.start + 1, tolerantQuotedKey.end - 1);
        this.correct(lineNumber, "name-quote", "removed the quotes around a key", before, bare);
        fieldLine =
          fieldLine.slice(0, tolerantQuotedKey.start) +
          bare +
          fieldLine.slice(tolerantQuotedKey.end);
      }

      const { key, value } = this.located(lineNumber, raw, () => parseFieldLine(fieldLine));
      const scope: Scope =
        this.currentGroup === undefined
          ? "header"
          : this.currentEntry !== undefined
            ? "entry"
            : "group";
      const container: Container =
        scope === "header"
          ? this.doc.header
          : scope === "entry"
            ? (this.currentEntry as CliffEntry)
            : (this.currentGroup as CliffGroup);
      const allowed =
        scope === "header" ? HEADER_KEYS : scope === "entry" ? ENTRY_KEYS : GROUP_KEYS;
      const seen =
        scope === "header" ? this.seenHeader : scope === "entry" ? this.seenEntry : this.seenGroup;

      if (!allowed.has(key) && !key.startsWith("x-")) {
        this.fail(
          `unknown ${scope} key '${key}'; known keys: ${[...allowed].sort().join(", ")}`,
          lineNumber,
          raw,
          "semantic",
        );
      }

      if (seen.has(key)) {
        if (!this.tolerant) {
          this.fail(
            `${scope} field '${key}' may appear at most once (CLIFF has no repeatable fields)`,
            lineNumber,
            raw,
            "semantic",
          );
        }
        if (STRING_KEYS.has(key)) {
          const parsed = this.located(lineNumber, raw, () => parseAdjacentStrings(value));
          const current = this.getString(container, key, scope) ?? "";
          const combined = current + parsed;
          assertStringLength(combined, lineNumber, this.limits.maxStringLength);
          this.correct(
            lineNumber,
            "field-repeat",
            `${key}: concatenated a repeated string field (C-style, no inserted character)`,
            current,
            combined,
          );
          this.setValue(container, key, scope, combined);
          this.lastContainer = container;
          this.lastKey = key;
          continue;
        }
        if (LIST_KEYS.has(key)) {
          const parsed = this.located(lineNumber, raw, () =>
            trimWsp(value).startsWith("[")
              ? this.parseTolerantList(value, key, lineNumber)
              : this.parseTolerantListValue(value, key, lineNumber),
          );
          this.correct(
            lineNumber,
            "field-repeat",
            `${key}: appended a repeated field instead of rejecting it`,
            this.getList(container, key, scope).join(","),
            this.getList(container, key, scope).concat(parsed).join(","),
          );
          this.appendList(container, key, parsed, lineNumber);
          this.lastContainer = container;
          this.lastKey = key;
          continue;
        }
        this.fail(
          `${scope} field '${key}' may appear at most once and cannot be merged`,
          lineNumber,
          raw,
          "semantic",
        );
      }

      let parsed: string | string[] | number;
      if (key.startsWith("x-")) {
        parsed = this.located(lineNumber, raw, () => parseExtensionValue(value));
      } else if (this.tolerant) {
        parsed = this.located(lineNumber, raw, () =>
          this.parseTolerantValue(value, key, lineNumber),
        );
      } else {
        parsed = this.located(lineNumber, raw, () => parseStrictValue(value, key));
      }
      if (typeof parsed === "string") {
        assertStringLength(parsed, lineNumber, this.limits.maxStringLength);
      }
      if (key === "emotion" && Array.isArray(parsed) && parsed.length === 0) {
        this.fail("emotion list must contain at least one tag", lineNumber, raw, "semantic");
      }
      if (Array.isArray(parsed) && parsed.length > this.limits.maxListItems) {
        throw new CliffLimitError(
          `list '${key}' has ${parsed.length} items, which exceeds the limit of ${this.limits.maxListItems}`,
          { limit: "maxListItems", observed: parsed.length, line: lineNumber },
        );
      }
      this.setValue(container, key, scope, parsed);
      seen.add(key);
      this.lastContainer = container;
      this.lastKey = key;
    }

    if (!this.seenVersion) {
      throw new CliffParseError("empty file");
    }
    return this.doc;
  }

  private openGroup(path: string, line: number): void {
    const segments = path.split(".");
    if (segments.length > this.limits.maxGroupSegments) {
      throw new CliffLimitError(
        `group path has ${segments.length} segments, which exceeds the limit of ${this.limits.maxGroupSegments}`,
        { limit: "maxGroupSegments", observed: segments.length, line },
      );
    }
    const group: CliffGroup = {
      path,
      line,
      emotion: [],
      entries: [],
      extensions: createExtensions(),
    };
    this.doc.groups.push(group);
    this.currentGroup = group;
    this.currentEntry = undefined;
    this.seenGroup = new Set<string>();
    this.lastContainer = null;
    this.lastKey = null;
  }

  private parseVersionLine(line: number, raw: string, body: string): void {
    if (this.tolerant) {
      const tolerant = TOLERANT_VERSION_RE.exec(body);
      if (tolerant !== null) {
        const declared = tolerant[1] as string;
        const minor = declared.split(".").slice(0, 2).join(".");
        if (minor !== "1.0" && minor !== "1.1") {
          throw new UnsupportedSpecVersion(
            `unsupported CLIFF version '${minor}'; this implementation implements 1.0, 1.1`,
            { declared: minor, supported: SUPPORTED_VERSIONS, line, text: raw },
          );
        }
        this.doc.specVersion = minor as SpecVersion;
        if (trimWsp(body) !== `CLIFF ${minor}`) {
          this.correct(
            line,
            "version",
            "accepted a differently-spelled version line",
            trimWsp(body),
            `CLIFF ${minor}`,
          );
        }
        return;
      }
    }

    const match = VERSION_RE.exec(body);
    if (match !== null) {
      this.doc.specVersion = match[1] as SpecVersion;
      return;
    }
    const unsupported = UNSUPPORTED_VERSION_RE.exec(body);
    if (unsupported !== null) {
      const declared = unsupported[1] as string;
      throw new UnsupportedSpecVersion(
        `unsupported CLIFF version '${declared}'; this implementation implements 1.0, 1.1`,
        { declared, supported: SUPPORTED_VERSIONS, line, text: raw },
      );
    }
    throw new CliffParseError(
      "version line 'CLIFF 1.1' must be the first non-blank, non-comment line",
      { line, text: raw },
    );
  }

  private normalizeGroupPath(path: string, line: number): string {
    const segments = path
      .split(".")
      .map((segment) => normalizeIdentifier(trimWsp(segment), "group"))
      .filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      this.fail(`invalid group path '[${path}]'; segments must be names`, line, path, "id");
    }
    return segments.join(".");
  }

  private parseTolerantValue(text: string, key: string, line: number): string | string[] | number {
    const trimmed = trimWsp(text);
    if (STRING_KEYS.has(key)) return parseAdjacentStrings(trimmed);
    if (LIST_KEYS.has(key)) {
      if (trimmed.startsWith("[")) return this.parseTolerantList(trimmed, key, line);
      return this.parseTolerantListValue(trimmed, key, line);
    }
    if (TAG_KEYS.has(key)) {
      let value = trimmed;
      if (startsQuote(value)) {
        const unquoted = unquoteExactly(value);
        this.correct(
          line,
          "tag-quote",
          `${key}: removed the quotes around a tag value`,
          value,
          unquoted,
        );
        value = unquoted;
      }
      return value;
    }
    if (INT_KEYS.has(key)) return parsePositiveInteger(trimmed);
    if (NAME_KEYS.has(key)) {
      if (startsQuote(trimmed)) return unquoteExactly(trimmed);
      if (!isName(trimmed)) {
        const normalized = normalizeIdentifier(trimmed, key === "namespace" ? "namespace" : "clan");
        this.correct(
          line,
          "name-normalized",
          `${key}: normalized an identifier`,
          trimmed,
          normalized,
        );
        return normalized;
      }
      return trimmed;
    }
    if (LANG_KEYS.has(key)) return parseLanguage(trimmed);
    if (startsQuote(trimmed)) return unquoteExactly(trimmed);
    if (isName(trimmed)) return trimmed;
    throw new CliffParseError(`'${trimmed}' is not a valid name, string, or integer`);
  }

  private parseTolerantListValue(text: string, key: string, line: number): string[] {
    const parts = splitTopLevel(text)
      .map((part) => trimWsp(part))
      .filter((part) => part.length > 0);
    if (parts.length === 0) throw new CliffParseError(`${key} list is empty`);
    const items = parts.map((part) => this.parseTolerantListItem(part, key, line));
    this.correct(
      line,
      "list-shape",
      `${key}: accepted a bare value as a list`,
      text,
      "[" + items.join(", ") + "]",
    );
    return items;
  }

  private parseTolerantList(text: string, key: string, line: number): string[] {
    const trimmed = trimWsp(text);
    if (!trimmed.startsWith("[")) throw new CliffParseError(`${key} must be a single-line list`);
    if (!trimmed.endsWith("]")) {
      throw new CliffParseError("unclosed list (closing bracket must be on the same line)");
    }
    const body = trimWsp(trimmed.slice(1, -1));
    if (body.length === 0) return [];
    return cleanListParts(body).map((part) => {
      const item = trimWsp(part);
      if (item.length === 0) throw new CliffParseError("empty list item");
      if (item.startsWith("[")) throw new CliffParseError("nested lists are not allowed");
      return this.parseTolerantListItem(item, key, line);
    });
  }

  private parseTolerantListItem(part: string, key: string, line: number): string {
    if (key === "dependency" || key === "reference") {
      if (!startsQuote(part)) {
        throw new CliffParseError(`${key} list items must be quoted strings`);
      }
      return unquoteExactly(part);
    }
    if (key === "emotion") {
      let item = part;
      if (startsQuote(item)) {
        const unquoted = unquoteExactly(item);
        this.correct(
          line,
          "tag-quote",
          "emotion: removed the quotes around a tag value",
          item,
          unquoted,
        );
        item = unquoted;
      }
      return item;
    }
    if (startsQuote(part)) return unquoteExactly(part);
    if (INTEGER_RE.test(part) || isName(part) || LANGUAGE_RE.test(part)) return part;
    throw new CliffParseError("invalid list item");
  }

  private getFields(container: Container, scope: Scope, key: string): unknown {
    if (scope === "header") {
      const header = container as CliffHeader;
      switch (key) {
        case "namespace":
          return header.namespace;
        case "clan":
          return header.clan;
        case "source-language":
          return header.sourceLanguage;
        case "target-language":
          return header.targetLanguage;
        case "version":
          return header.version;
        case "variant":
          return header.variant;
        case "title":
          return header.title;
        case "info":
          return header.info;
        case "standard":
          return header.standard;
        case "dependency":
          return header.dependency;
        default:
          return undefined;
      }
    }
    if (scope === "group") {
      const group = container as CliffGroup;
      switch (key) {
        case "context":
          return group.context;
        case "type":
          return group.type;
        case "emotion":
          return group.emotion;
        case "max-width":
          return group.maxWidth;
        default:
          return undefined;
      }
    }
    const entry = container as CliffEntry;
    switch (key) {
      case "source":
        return entry.source;
      case "target":
        return entry.target;
      case "type":
        return entry.type;
      case "emotion":
        return entry.emotion;
      case "status":
        return entry.status;
      case "context":
        return entry.context;
      case "max-width":
        return entry.maxWidth;
      case "reference":
        return entry.reference;
      case "reviewer":
        return entry.reviewer;
      default:
        return undefined;
    }
  }

  private getString(container: Container, key: string, scope: Scope): string | undefined {
    const value = this.getFields(container, scope, key);
    return typeof value === "string" ? value : undefined;
  }

  private getList(container: Container, key: string, scope: Scope): string[] {
    const value = this.getFields(container, scope, key);
    return Array.isArray(value) ? (value as string[]) : [];
  }

  private setValue(
    container: Container,
    key: string,
    scope: Scope,
    value: string | string[] | number,
  ): void {
    if (key.startsWith("x-")) {
      container.extensions[key] = value as string;
      return;
    }
    if (scope === "header") {
      const header = container as CliffHeader;
      switch (key) {
        case "namespace":
          header.namespace = value as string;
          return;
        case "clan":
          header.clan = value as string;
          return;
        case "source-language":
          header.sourceLanguage = value as string;
          return;
        case "target-language":
          header.targetLanguage = value as string;
          return;
        case "version":
          header.version = value as string;
          return;
        case "variant":
          header.variant = value as string;
          return;
        case "title":
          header.title = value as string;
          return;
        case "info":
          header.info = value as string;
          return;
        case "standard":
          header.standard = value as string;
          return;
        case "dependency":
          header.dependency = value as string[];
          return;
        default:
          this.fail(`unknown header key '${key}'`, 0, "", "semantic");
      }
    }
    if (scope === "group") {
      const group = container as CliffGroup;
      switch (key) {
        case "context":
          group.context = value as string;
          return;
        case "type":
          group.type = value as string;
          return;
        case "emotion":
          group.emotion = value as string[];
          return;
        case "max-width":
          group.maxWidth = value as number;
          return;
        default:
          this.fail(`unknown group key '${key}'`, 0, "", "semantic");
      }
    }
    const entry = container as CliffEntry;
    switch (key) {
      case "source":
        entry.source = value as string;
        return;
      case "target":
        entry.target = value as string;
        return;
      case "type":
        entry.type = value as string;
        return;
      case "emotion":
        entry.emotion = value as string[];
        return;
      case "status":
        entry.status = value as string;
        return;
      case "context":
        entry.context = value as string;
        return;
      case "max-width":
        entry.maxWidth = value as number;
        return;
      case "reference":
        entry.reference = value as string[];
        return;
      case "reviewer":
        entry.reviewer = value as string;
        return;
      default:
        this.fail(`unknown entry key '${key}'`, 0, "", "semantic");
    }
  }

  private appendString(container: Container, key: string, fragment: string, line: number): void {
    const current = this.getString(container, key, this.scopeOf(container)) ?? "";
    const combined = current + fragment;
    assertStringLength(combined, line, this.limits.maxStringLength);
    this.setValue(container, key, this.scopeOf(container), combined);
  }

  private appendList(container: Container, key: string, items: string[], line: number): void {
    const current = this.getList(container, key, this.scopeOf(container));
    const combined = current.concat(items);
    if (combined.length > this.limits.maxListItems) {
      throw new CliffParseError(
        `list '${key}' has ${combined.length} items, which exceeds the limit of ${this.limits.maxListItems}`,
        { line, category: "semantic" },
      );
    }
    this.setValue(container, key, this.scopeOf(container), combined);
  }

  private scopeOf(container: Container): Scope {
    if (container === this.doc.header) return "header";
    if (container === this.currentEntry) return "entry";
    return "group";
  }

  private correct(
    line: number,
    category: CorrectionCategory,
    message: string,
    before: string,
    after: string,
  ): void {
    this.corrections.push({ line, category, message, before, after });
  }

  private located<T>(line: number, raw: string, fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof CliffParseError) {
        if (error.line !== 0) throw error;
        throw new CliffParseError(error.message, {
          line,
          category: error.category,
          text: raw,
        });
      }
      throw error;
    }
  }

  private fail(
    message: string,
    line: number,
    raw: string,
    category: IssueCategory = "syntax",
  ): never {
    throw new CliffParseError(message, { line, category, text: raw });
  }
}

export function parseInternal(
  input: string | Uint8Array,
  options: ParseOptions & { onIdCollision?: "disambiguate" | "error" } = {},
  tolerant = false,
): CliffDocument {
  const limits = resolveLimits(options);
  const normalized = normalizeInput(input, limits);
  const parser = new Parser(normalized.lines, options, tolerant);
  return parser.run();
}

export function parse(input: string | Uint8Array, options: ParseOptions = {}): CliffDocument {
  return parseInternal(input, options, false);
}
