export const NAME_RE = /^[A-Za-z0-9_-]+$/;
export const TAG_NAME_RE = /^[a-z][a-z0-9-]*$/;
export const LANG_RE = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;
export const NAME_CHAR_CLASS = "[A-Za-z0-9_-]";

const STYLE_KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STYLE_PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const POSITIONAL = /^[0-9]+[^A-Za-z]*/;
const WHITESPACE_RE = /\s+/gu;
const ILLEGAL_RE = /[^A-Za-z0-9_-]/g;
const HYPHEN_RUN_RE = /-{2,}/g;

export const FALLBACK_NAMES: Record<string, string> = {
  entry: "entry",
  group: "group",
  namespace: "ns",
  clan: "clan",
};

export function isName(text: string): boolean {
  return text.length > 0 && NAME_RE.test(text);
}

export function isTag(text: string): boolean {
  return TAG_NAME_RE.test(text);
}

export function isStyleIdentifier(text: string): boolean {
  return text.length > 0 && (STYLE_KEBAB.test(text) || STYLE_PASCAL.test(text));
}

export function hasStyleObligation(text: string): boolean {
  return !POSITIONAL.test(text);
}

export function normalizeIdentifier(text: string, kind = "entry"): string {
  if (isName(text)) return text;
  let normalized = text.normalize("NFKC").trim();
  normalized = normalized.replace(WHITESPACE_RE, "-");
  normalized = normalized.replace(ILLEGAL_RE, "-");
  normalized = normalized.replace(HYPHEN_RUN_RE, "-");
  normalized = normalized.replace(/^-+|-+$/g, "");
  return normalized || FALLBACK_NAMES[kind] || "entry";
}

export function uniqueIdentifier(candidate: string, used: Set<string>, separator = "-"): string {
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let counter = 2;
  while (used.has(candidate + separator + counter)) counter++;
  const resolved = candidate + separator + counter;
  used.add(resolved);
  return resolved;
}

export interface TerminatorSplit {
  body: string;
  terminators: string;
  extra: number;
}

export function stripLineTerminator(line: string): TerminatorSplit {
  let end = line.length;
  while (end > 0 && (line[end - 1] === " " || line[end - 1] === "\t")) end--;
  if (end === 0 || (line[end - 1] !== "," && line[end - 1] !== ";")) {
    return { body: line.slice(0, end), terminators: "", extra: 0 };
  }

  const terminators: string[] = [];
  let index = end - 1;
  while (index >= 0 && (line[index] === "," || line[index] === ";")) {
    terminators.push(line[index] as string);
    index--;
    while (index >= 0 && (line[index] === " " || line[index] === "\t")) index--;
  }
  terminators.reverse();
  return {
    body: line.slice(0, index + 1),
    terminators: terminators.join(""),
    extra: Math.max(terminators.length - 1, 0),
  };
}

export function isWellFormedString(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}
