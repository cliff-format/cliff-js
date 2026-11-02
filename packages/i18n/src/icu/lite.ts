import { analyzePlain, detectDialect } from "./detect.js";
import type { IcuAnalysis, IcuError, IcuRuntime, MessagePart } from "./types.js";

const SIMPLE_MESSAGE = /^[^{}]*(?:\{[A-Za-z_][A-Za-z0-9_]*\}[^{}]*)*$/;
const SIMPLE_ARGUMENT = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

function unsupported(message: string): IcuError {
  return {
    type: "icu-unsupported",
    message:
      "the lite ICU runtime does not format plural/select/number/date messages; use @cliff-format/i18n instead",
    source: message,
  };
}

function simpleParts(message: string, values: Record<string, unknown>): MessagePart[] {
  const parts: MessagePart[] = [];
  let cursor = 0;
  for (const match of message.matchAll(SIMPLE_ARGUMENT)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: "literal", value: message.slice(cursor, index) });
    const name = match[1] as string;
    const value = values[name];
    parts.push({
      type: "expression",
      source: `{${name}}`,
      value: value === undefined ? `{${name}}` : String(value),
    });
    cursor = index + match[0].length;
  }
  if (cursor < message.length) parts.push({ type: "literal", value: message.slice(cursor) });
  if (parts.length === 0 && message.length > 0) parts.push({ type: "literal", value: message });
  return parts;
}

export function createLiteIcu(): IcuRuntime {
  return {
    format(message, _locale, values) {
      const dialect = detectDialect(message);
      if (dialect === "plain") return { text: message, errors: [] };
      if (!SIMPLE_MESSAGE.test(message)) {
        return { text: message, errors: [unsupported(message)] };
      }
      const errors: IcuError[] = [];
      const text = message.replace(SIMPLE_ARGUMENT, (whole, name: string) => {
        const value = values[name];
        if (value === undefined) {
          errors.push({
            type: "unresolved-var",
            message: `missing ICU argument "${name}"`,
            source: whole,
          });
          return whole;
        }
        return String(value);
      });
      return { text, errors };
    },
    formatToParts(message, _locale, values) {
      const dialect = detectDialect(message);
      if (dialect === "plain") {
        return { parts: [{ type: "literal", value: message }], errors: [] };
      }
      if (!SIMPLE_MESSAGE.test(message)) {
        return {
          parts: [{ type: "literal", value: message }],
          errors: [unsupported(message)],
        };
      }
      return { parts: simpleParts(message, values), errors: [] };
    },
    analyze(message): IcuAnalysis {
      const dialect = detectDialect(message);
      const errors: IcuError[] = [];
      if (dialect !== "plain" && !SIMPLE_MESSAGE.test(message)) {
        errors.push(unsupported(message));
      }
      return analyzePlain(message, dialect, errors);
    },
  };
}
