import type { ValidationIssue } from "@cliff-format/core";

export class CliffTranslateError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CliffTranslateError";
  }
}

export class DeepSeekConfigError extends CliffTranslateError {
  constructor(message: string) {
    super(message);
    this.name = "DeepSeekConfigError";
  }
}

export class DeepSeekHttpError extends CliffTranslateError {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`DeepSeek API returned HTTP ${status}: ${body.slice(0, 500)}`);
    this.name = "DeepSeekHttpError";
    this.status = status;
    this.body = body;
  }
}

export class TranslationParseError extends CliffTranslateError {
  readonly raw: string;

  constructor(message: string, raw: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TranslationParseError";
    this.raw = raw;
  }
}

export class TranslationValidationError extends CliffTranslateError {
  readonly issues: readonly ValidationIssue[];
  readonly raw: string;

  constructor(issues: readonly ValidationIssue[], raw: string) {
    super(`translated CLIFF did not validate: ${issues[0]?.message ?? "unknown error"}`);
    this.name = "TranslationValidationError";
    this.issues = issues;
    this.raw = raw;
  }
}
