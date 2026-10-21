import {
  ADVISORY_CATEGORIES,
  type Correction,
  type IssueCategory,
  type ValidationIssue,
} from "./model.js";

export interface ParseErrorOptions {
  line?: number;
  category?: IssueCategory;
  text?: string;
}

export class CliffError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CliffError";
  }
}

export class CliffParseError extends CliffError {
  readonly line: number;
  readonly category: IssueCategory;
  readonly text: string;

  constructor(message: string, options: ParseErrorOptions = {}) {
    super(message);
    this.name = "CliffParseError";
    this.line = options.line ?? 0;
    this.category = options.category ?? "syntax";
    this.text = options.text ?? "";
  }
}

export class CliffValidationError extends CliffParseError {
  readonly issues: ValidationIssue[];
  readonly corrections: Correction[];

  constructor(issues: ValidationIssue[], corrections: Correction[] = []) {
    const first =
      issues.find(
        (issue) => !(ADVISORY_CATEGORIES as readonly string[]).includes(issue.category),
      ) ?? issues[0];
    super(first?.message ?? "CLIFF validation failed", {
      line: first?.line ?? 0,
      category: first?.category ?? "semantic",
      text: first?.text ?? "",
    });
    this.name = "CliffValidationError";
    this.issues = issues;
    this.corrections = corrections;
  }
}

export class UnsupportedSpecVersion extends CliffParseError {
  readonly declared: string;
  readonly supported: readonly string[];

  constructor(
    message: string,
    options: ParseErrorOptions & { declared: string; supported: readonly string[] },
  ) {
    super(message, { ...options, category: "semantic" });
    this.name = "UnsupportedSpecVersion";
    this.declared = options.declared;
    this.supported = options.supported;
  }
}

export class CliffLimitError extends CliffParseError {
  readonly limit: string;
  readonly observed: number;

  constructor(message: string, options: ParseErrorOptions & { limit: string; observed: number }) {
    super(message, { ...options, category: "semantic" });
    this.name = "CliffLimitError";
    this.limit = options.limit;
    this.observed = options.observed;
  }
}

export class CliffModelError extends CliffError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CliffModelError";
  }
}
