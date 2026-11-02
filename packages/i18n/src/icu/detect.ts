import type { IcuAnalysis, IcuDialect } from "./types.js";

const MF2_DIRECTIVE_RE = /(^|[\s.])\.(input|local|match)\b/;
const MF2_VARIABLE_RE = /\{\s*\$[A-Za-z_]/;
const MF2_MARKUP_RE = /\{[#/][A-Za-z]/;
const MF1_TYPE_RE =
  /\{\s*[A-Za-z_][A-Za-z0-9_-]*\s*,\s*(plural|select|selectordinal|number|date|time)\b/;

export function detectDialect(message: string): IcuDialect {
  if (
    MF2_DIRECTIVE_RE.test(message) ||
    MF2_VARIABLE_RE.test(message) ||
    MF2_MARKUP_RE.test(message)
  ) {
    return "mf2";
  }
  if (MF1_TYPE_RE.test(message)) return "mf1";
  if (message.includes("{{") || message.includes("}}")) return "mf2";
  if (message.includes("{") || message.includes("}")) return "mf1";
  return "plain";
}

export function argumentNames(message: string, dialect: IcuDialect): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string): void => {
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  };
  if (dialect === "mf2") {
    for (const match of message.matchAll(/\{\s*\$([A-Za-z_][A-Za-z0-9_-]*)/g)) {
      if (match[1] !== undefined) add(match[1]);
    }
    return names;
  }
  for (const match of message.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_-]*)\s*[,}]/g)) {
    if (match[1] !== undefined) add(match[1]);
  }
  return names;
}

export function analyzePlain(
  message: string,
  dialect: IcuDialect,
  errors: IcuAnalysis["errors"] = [],
): IcuAnalysis {
  return { dialect, arguments: argumentNames(message, dialect), errors };
}
