import { mf1ToMessage } from "@messageformat/icu-messageformat-1";
import { MessageFormat } from "messageformat";
import { analyzePlain, detectDialect } from "./detect.js";
import type {
  IcuAnalysis,
  IcuError,
  IcuFormatOptions,
  IcuFormatResult,
  IcuPartsResult,
  IcuRuntime,
  MessagePart,
} from "./types.js";

interface Formatter {
  format(values: Record<string, unknown>, onError?: (error: unknown) => void): string;
  formatToParts(
    values: Record<string, unknown>,
    onError?: (error: unknown) => void,
  ): readonly unknown[];
}

type Compiled = { kind: "plain"; text: string } | { kind: "message"; formatter: Formatter };

function toIcuError(error: unknown): IcuError {
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      type: String(record.type ?? "error"),
      message: String(record.message ?? error),
      ...(typeof record.source === "string" ? { source: record.source } : {}),
    };
  }
  return { type: "error", message: String(error) };
}

function compile(message: string, locale: string): Compiled {
  const dialect = detectDialect(message);
  if (dialect === "plain") return { kind: "plain", text: message };
  const formatter =
    dialect === "mf1"
      ? (mf1ToMessage(locale, message) as unknown as Formatter)
      : (new MessageFormat(locale, message) as unknown as Formatter);
  return { kind: "message", formatter };
}

function formatNestedParts(parts: readonly unknown[]): string {
  return normalizeParts(parts)
    .filter((part) => part.type !== "markup")
    .map((part) => (part.type === "literal" ? part.value : part.value))
    .join("");
}

function normalizeParts(parts: readonly unknown[]): MessagePart[] {
  const normalized: MessagePart[] = [];
  for (const raw of parts) {
    if (typeof raw !== "object" || raw === null) continue;
    const part = raw as Record<string, unknown>;
    const type = String(part.type ?? "");
    if (type === "literal" || type === "text") {
      normalized.push({ type: "literal", value: String(part.value ?? "") });
      continue;
    }
    if (type === "bidiIsolation") continue;
    if (type === "markup") {
      const kind = String(part.kind ?? "standalone");
      normalized.push({
        type: "markup",
        kind: kind === "open" || kind === "close" ? kind : "standalone",
        name: String(part.name ?? ""),
        source: String(part.source ?? ""),
      });
      continue;
    }
    const nested = Array.isArray(part.parts)
      ? formatNestedParts(part.parts)
      : typeof part.value === "string"
        ? part.value
        : String(part.value ?? "");
    normalized.push({
      type: "expression",
      source: String(part.source ?? ""),
      value: nested,
      ...(typeof part.locale === "string" ? { locale: part.locale } : {}),
    });
  }
  return normalized;
}

export function createFullIcu(): IcuRuntime {
  const cache = new Map<string, Compiled | { kind: "error"; error: IcuError }>();

  const get = (message: string, locale: string): Compiled | { kind: "error"; error: IcuError } => {
    const key = `${locale}\u0000${message}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    try {
      const compiled = compile(message, locale);
      cache.set(key, compiled);
      return compiled;
    } catch (error) {
      const failed = { kind: "error" as const, error: toIcuError(error) };
      cache.set(key, failed);
      return failed;
    }
  };

  const formatResult = (
    message: string,
    locale: string,
    values: Record<string, unknown>,
    _options: IcuFormatOptions = {},
  ): IcuFormatResult => {
    const compiled = get(message, locale);
    if (compiled.kind === "error") return { text: message, errors: [compiled.error] };
    if (compiled.kind === "plain") return { text: compiled.text, errors: [] };

    const errors: IcuError[] = [];
    try {
      const parts = compiled.formatter.formatToParts(values, (error) => {
        errors.push(toIcuError(error));
      });
      const text = normalizeParts(parts)
        .filter((part) => part.type !== "markup")
        .map((part) => (part.type === "literal" ? part.value : part.value))
        .join("");
      return { text, errors };
    } catch (error) {
      const fallbackErrors = [toIcuError(error)];
      try {
        const text = compiled.formatter.format(values, (runtimeError) => {
          fallbackErrors.push(toIcuError(runtimeError));
        });
        return { text: String(text), errors: fallbackErrors };
      } catch (fallbackError) {
        fallbackErrors.push(toIcuError(fallbackError));
        return { text: message, errors: fallbackErrors };
      }
    }
  };

  return {
    format(message, locale, values, options) {
      return formatResult(message, locale, values, options);
    },
    formatToParts(message, locale, values, _options): IcuPartsResult {
      const compiled = get(message, locale);
      if (compiled.kind === "error") {
        return {
          parts: [{ type: "literal", value: message }],
          errors: [compiled.error],
        };
      }
      if (compiled.kind === "plain") {
        return { parts: [{ type: "literal", value: compiled.text }], errors: [] };
      }
      const errors: IcuError[] = [];
      try {
        const parts = compiled.formatter.formatToParts(values, (error) => {
          errors.push(toIcuError(error));
        });
        return { parts: normalizeParts(parts), errors };
      } catch (error) {
        return {
          parts: [{ type: "literal", value: message }],
          errors: [toIcuError(error)],
        };
      }
    },
    analyze(message): IcuAnalysis {
      const dialect = detectDialect(message);
      const errors: IcuError[] = [];
      if (dialect !== "plain") {
        const compiled = get(message, "en");
        if (compiled.kind === "error") errors.push(compiled.error);
      }
      return analyzePlain(message, dialect, errors);
    },
  };
}
