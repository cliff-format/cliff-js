import type { TranslationScope } from "./types.js";

export class CliffI18nError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CliffI18nError";
  }
}

export class CliffScopeError extends CliffI18nError {
  readonly scope: Partial<TranslationScope>;

  constructor(message: string, scope: Partial<TranslationScope> = {}) {
    super(message);
    this.name = "CliffScopeError";
    this.scope = scope;
  }
}

export class CliffScopeMismatchError extends CliffScopeError {
  readonly key: string;

  constructor(key: string, scope: TranslationScope, expected: string) {
    super(
      `key "${key}" resolves outside the active scope (${scope.namespace}.${scope.clan}); expected ${expected}`,
      scope,
    );
    this.name = "CliffScopeMismatchError";
    this.key = key;
  }
}

export class CliffMissingKeyError extends CliffI18nError {
  readonly key: string;
  readonly locale: string;

  constructor(key: string, locale: string) {
    super(`missing CLIFF entry "${key}" for locale "${locale}"`);
    this.name = "CliffMissingKeyError";
    this.key = key;
    this.locale = locale;
  }
}

export class CliffAmbiguousKeyError extends CliffI18nError {
  readonly key: string;
  readonly candidates: readonly string[];

  constructor(key: string, candidates: readonly string[]) {
    super(`ambiguous CLIFF key "${key}"; candidates: ${candidates.join(", ")}`);
    this.name = "CliffAmbiguousKeyError";
    this.key = key;
    this.candidates = candidates;
  }
}

export class CliffDuplicateKeyError extends CliffI18nError {
  readonly key: string;
  readonly locale: string;

  constructor(key: string, locale: string) {
    super(`duplicate canonical CLIFF id "${key}" for locale "${locale}"`);
    this.name = "CliffDuplicateKeyError";
    this.key = key;
    this.locale = locale;
  }
}

export class CliffMissingMetadataError extends CliffI18nError {
  readonly key: string;
  readonly fields: readonly string[];

  constructor(key: string, fields: readonly string[], detail = "") {
    super(
      `entry ${key} is missing required CLIFF field${fields.length === 1 ? "" : "s"} ${fields
        .map((field) => `"${field}"`)
        .join(", ")}${detail ? "; " + detail : ""}`,
    );
    this.name = "CliffMissingMetadataError";
    this.key = key;
    this.fields = fields;
  }
}

export class CliffIcuError extends CliffI18nError {
  readonly messageText: string;

  constructor(messageText: string, detail: string) {
    super(`invalid ICU message: ${detail}`);
    this.name = "CliffIcuError";
    this.messageText = messageText;
  }
}
