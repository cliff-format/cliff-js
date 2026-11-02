import {
  type CliffDocument,
  CliffValidationError,
  hasErrors,
  type ParseOptions,
  parse,
  parseTolerant,
  type ValidationIssue,
  validateDocument,
} from "@cliff-format/core";
import { createT } from "./builder.js";
import { Catalog, type CatalogOptions } from "./catalog.js";
import { CliffI18nError, CliffScopeError } from "./errors.js";
import type { IcuRuntime } from "./icu/types.js";
import { assertScope, resolveKey } from "./key.js";
import type {
  AddOptions,
  AddResult,
  CliffFile,
  CliffResource,
  FileOptions,
  I18n,
  I18nDiagnostic,
  I18nOptions,
  I18nRuntime,
  KeyInput,
  MessageRecord,
  MissingBehavior,
  Params,
  ResolvedKey,
  ScopedI18n,
  TranslationScope,
  TypeTag,
  WidthPolicy,
} from "./types.js";

function isCliffDocument(resource: CliffResource): resource is CliffDocument {
  return typeof resource === "object" && resource !== null && !(resource instanceof Uint8Array);
}

export class I18nImpl implements I18n<string>, I18nRuntime {
  readonly catalog: Catalog;
  readonly defaultParams: Params;
  readonly missing: MissingBehavior;
  readonly requireEmotion: boolean | readonly TypeTag[];
  readonly enforceMaxWidth: WidthPolicy;

  private readonly icu: IcuRuntime;
  private readonly fallbacks: string[];
  private readonly strictKeys: boolean;
  private readonly parseOptions: ParseOptions;
  private readonly onDiagnostic: ((diagnostic: I18nDiagnostic) => void) | undefined;
  private readonly maxDiagnostics: number;
  private readonly diagnosticsList: I18nDiagnostic[] = [];
  private readonly listeners = new Set<() => void>();
  private currentLocale: string;
  private sourceLanguageValue: string | undefined;
  private version = 0;

  constructor(options: I18nOptions, defaultIcu: IcuRuntime) {
    if (typeof options.locale !== "string" || options.locale.trim().length === 0) {
      throw new CliffScopeError("locale is required");
    }
    this.currentLocale = options.locale.trim();
    this.fallbacks =
      typeof options.fallbackLocale === "string"
        ? [options.fallbackLocale]
        : [...(options.fallbackLocale ?? [])];
    const catalogOptions: CatalogOptions = {};
    if (options.aliases !== undefined) catalogOptions.aliases = options.aliases;
    if (options.defaultGroup !== undefined) catalogOptions.defaultGroup = options.defaultGroup;
    this.catalog = new Catalog(catalogOptions);
    this.defaultParams = options.params ?? {};
    this.missing = options.missing ?? "key";
    this.requireEmotion = options.requireEmotion ?? false;
    this.enforceMaxWidth = options.enforceMaxWidth ?? "warn";
    this.icu = options.icu ?? defaultIcu;
    this.strictKeys = options.strictKeys ?? true;
    this.parseOptions = options.parse ?? {};
    this.onDiagnostic = options.onDiagnostic;
    this.maxDiagnostics = options.maxDiagnostics ?? 1000;
    this.sourceLanguageValue = options.sourceLanguage;
    for (const resource of options.resources ?? []) {
      this.add(resource);
    }
    if (this.sourceLanguageValue === undefined && this.catalog.sourceLanguages.length > 0) {
      this.sourceLanguageValue = this.catalog.sourceLanguages[0];
    }
  }

  get locale(): string {
    return this.currentLocale;
  }

  get language(): string {
    return this.currentLocale;
  }

  get sourceLanguage(): string | undefined {
    return this.sourceLanguageValue;
  }

  getVersion(): number {
    return this.version;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  setLocale(locale: string): void {
    const next = locale.trim();
    if (next.length === 0) throw new CliffScopeError("locale must not be empty");
    if (next === this.currentLocale) return;
    this.currentLocale = next;
    this.notify();
  }

  changeLanguage(locale: string): void {
    this.setLocale(locale);
  }

  scope(scope: TranslationScope): ScopedI18n<string> {
    assertScope(scope);
    return { t: createT<string>(this, scope), scope };
  }

  add(resource: CliffResource, options: AddOptions = {}): AddResult {
    let document: CliffDocument;
    let issues: ValidationIssue[];
    let corrections: ReturnType<typeof parseTolerant>["corrections"] = [];
    if (isCliffDocument(resource)) {
      document = resource;
      issues = validateDocument(document);
    } else {
      const parseOptions: ParseOptions = {
        ...this.parseOptions,
        ...(options.sourcePath === undefined ? {} : { path: options.sourcePath }),
      };
      if (options.tolerant === true) {
        const result = parseTolerant(resource, parseOptions);
        document = result.document;
        corrections = result.corrections;
        issues = validateDocument(document);
      } else {
        document = parse(resource, parseOptions);
        issues = validateDocument(document);
      }
    }

    if (options.validate !== false && hasErrors(issues)) {
      throw new CliffValidationError(issues, corrections);
    }

    const added = this.catalog.addDocument(document);
    if (this.sourceLanguageValue === undefined) {
      this.sourceLanguageValue = document.header.sourceLanguage;
    }
    this.notify();
    void added;
    return { documents: [document], issues, corrections };
  }

  addDocument(document: CliffDocument, options: AddOptions = {}): AddResult {
    return this.add(document, options);
  }

  resolve(key: KeyInput, scope: TranslationScope): ResolvedKey {
    const resolved = resolveKey(key, scope, this.catalog, this.strictKeys);
    if (resolved.ambiguous === true) {
      this.diagnose({
        code: "ambiguous-key",
        severity: "warning",
        message: `ambiguous key "${typeof key === "string" ? key : key.id}"; chose "${resolved.canonical}"`,
        key: resolved.canonical,
        locale: this.currentLocale,
        namespace: resolved.namespace,
        clan: resolved.clan,
        group: resolved.group,
        ...(resolved.candidates === undefined
          ? {}
          : { details: { candidates: resolved.candidates } }),
      });
    }
    return resolved;
  }

  recordFor(canonical: string, locale: string): MessageRecord | undefined {
    const chain = this.catalog.localeChain(locale, this.fallbacks, this.sourceLanguageValue);
    return this.catalog.selectRecord(canonical, chain, this.sourceLanguageValue);
  }

  has(key: KeyInput, scope: TranslationScope): boolean {
    const resolved = this.resolve(key, scope);
    return resolved.exists && this.recordFor(resolved.canonical, this.currentLocale) !== undefined;
  }

  keys(scope: Partial<TranslationScope> = {}): string[] {
    return this.catalog.keys(scope);
  }

  namespaces(): string[] {
    return this.catalog.namespaces();
  }

  clans(namespace?: string): string[] {
    return this.catalog.clans(namespace);
  }

  groups(scope: Partial<TranslationScope> = {}): string[] {
    return this.catalog.groups(scope);
  }

  locales(): string[] {
    return this.catalog.locales();
  }

  files(options: FileOptions = {}): CliffFile[] {
    return this.catalog.files(options);
  }

  toCliff(options: FileOptions = {}): string {
    return this.catalog.toCliff(options);
  }

  validate(): ValidationIssue[] {
    return this.catalog.validate();
  }

  diagnostics(): readonly I18nDiagnostic[] {
    return this.diagnosticsList;
  }

  clearDiagnostics(): void {
    this.diagnosticsList.length = 0;
  }

  diagnose(diagnostic: I18nDiagnostic): void {
    this.diagnosticsList.push(diagnostic);
    if (this.diagnosticsList.length > this.maxDiagnostics) {
      this.diagnosticsList.splice(0, this.diagnosticsList.length - this.maxDiagnostics);
    }
    if (this.onDiagnostic !== undefined) {
      try {
        this.onDiagnostic(diagnostic);
      } catch {
        // A diagnostic listener must never break rendering.
      }
    }
  }

  getLocale(): string {
    return this.currentLocale;
  }

  getSourceLanguage(): string {
    if (this.sourceLanguageValue === undefined) {
      throw new CliffI18nError(
        "CLIFF source-language is not set; pass sourceLanguage or load a CLIFF document",
      );
    }
    return this.sourceLanguageValue;
  }

  getCatalog(): Catalog {
    return this.catalog;
  }

  format(
    message: string,
    params: Params = {},
    options: { locale?: string; currency?: string; timeZone?: string } = {},
  ): string {
    const locale = options.locale ?? this.currentLocale;
    const icuOptions: { currency?: string; timeZone?: string } = {};
    if (options.currency !== undefined) icuOptions.currency = options.currency;
    if (options.timeZone !== undefined) icuOptions.timeZone = options.timeZone;
    try {
      const result = this.icu.format(message, locale, params, icuOptions);
      for (const error of result.errors) {
        this.diagnose({
          code: "icu-error",
          severity: "warning",
          message: `${error.type}: ${error.message}`,
          locale,
          ...(error.source === undefined ? {} : { details: { source: error.source } }),
        });
      }
      return result.text;
    } catch (error) {
      this.diagnose({
        code: "icu-error",
        severity: "error",
        message: String(error),
        locale,
      });
      return message;
    }
  }

  formatToParts(
    message: string,
    params: Params = {},
    options: { locale?: string; currency?: string; timeZone?: string } = {},
  ) {
    const locale = options.locale ?? this.currentLocale;
    const icuOptions: { currency?: string; timeZone?: string } = {};
    if (options.currency !== undefined) icuOptions.currency = options.currency;
    if (options.timeZone !== undefined) icuOptions.timeZone = options.timeZone;
    try {
      const result = this.icu.formatToParts(message, locale, params, icuOptions);
      for (const error of result.errors) {
        this.diagnose({
          code: "icu-error",
          severity: "warning",
          message: `${error.type}: ${error.message}`,
          locale,
          ...(error.source === undefined ? {} : { details: { source: error.source } }),
        });
      }
      return result.parts;
    } catch (error) {
      this.diagnose({
        code: "icu-error",
        severity: "error",
        message: String(error),
        locale,
      });
      return [{ type: "literal" as const, value: message }];
    }
  }
}

export function createI18nEngine<Keys extends string = string>(
  options: I18nOptions,
  defaultIcu: IcuRuntime,
): I18n<Keys> {
  return new I18nImpl(options, defaultIcu) as unknown as I18n<Keys>;
}
