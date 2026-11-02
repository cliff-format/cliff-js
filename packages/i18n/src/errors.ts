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
  readonly entryId: string;

  constructor(entryId: string, scope: TranslationScope, expected: string) {
    super(
      `entry ID "${entryId}" resolves outside the active scope (${scope.namespace}.${scope.clan}); expected ${expected}`,
      scope,
    );
    this.name = "CliffScopeMismatchError";
    this.entryId = entryId;
  }
}

export class CliffMissingEntryError extends CliffI18nError {
  readonly entryId: string;
  readonly locale: string;

  constructor(entryId: string, locale: string) {
    super(`missing CLIFF entry "${entryId}" for locale "${locale}"`);
    this.name = "CliffMissingEntryError";
    this.entryId = entryId;
    this.locale = locale;
  }
}

export class CliffAmbiguousEntryError extends CliffI18nError {
  readonly entryId: string;
  readonly candidates: readonly string[];

  constructor(entryId: string, candidates: readonly string[]) {
    super(`ambiguous CLIFF entry "${entryId}"; candidates: ${candidates.join(", ")}`);
    this.name = "CliffAmbiguousEntryError";
    this.entryId = entryId;
    this.candidates = candidates;
  }
}

export class CliffDuplicateEntryError extends CliffI18nError {
  readonly entryId: string;
  readonly locale: string;

  constructor(entryId: string, locale: string) {
    super(`duplicate canonical CLIFF entry ID "${entryId}" for locale "${locale}"`);
    this.name = "CliffDuplicateEntryError";
    this.entryId = entryId;
    this.locale = locale;
  }
}

export class CliffMissingMetadataError extends CliffI18nError {
  readonly entryId: string;
  readonly fields: readonly string[];

  constructor(entryId: string, fields: readonly string[], detail = "") {
    super(
      `entry ${entryId} is missing required CLIFF field${fields.length === 1 ? "" : "s"} ${fields
        .map((field) => `"${field}"`)
        .join(", ")}${detail ? "; " + detail : ""}`,
    );
    this.name = "CliffMissingMetadataError";
    this.entryId = entryId;
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
