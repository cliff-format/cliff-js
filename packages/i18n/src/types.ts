import type {
  CliffDocument,
  CliffEntry,
  CliffGroup,
  Correction,
  ParseOptions,
  ValidationIssue,
} from "@cliff-format/core";
import type { IcuRuntime, MessagePart } from "./icu/types.js";

export const TYPE = {
  noun: "noun",
  verb: "verb",
  adjective: "adjective",
  adverb: "adverb",
  pronoun: "pronoun",
  numeral: "numeral",
  preposition: "preposition",
  conjunction: "conjunction",
  particle: "particle",
  interjection: "interjection",
  "proper-noun": "proper-noun",
  "noun-phrase": "noun-phrase",
  "verb-phrase": "verb-phrase",
  "adjective-phrase": "adjective-phrase",
  "adverb-phrase": "adverb-phrase",
  "fixed-phrase": "fixed-phrase",
  idiom: "idiom",
  sentence: "sentence",
  description: "description",
  narration: "narration",
  dialogue: "dialogue",
  monologue: "monologue",
  prompt: "prompt",
  label: "label",
  subtitle: "subtitle",
  "accessibility-cue": "accessibility-cue",
} as const;

export type TypeTag = (typeof TYPE)[keyof typeof TYPE];

export const EMOTION = {
  neutral: "neutral",
  objective: "objective",
  mechanical: "mechanical",
  joyful: "joyful",
  sad: "sad",
  angry: "angry",
  fearful: "fearful",
  surprised: "surprised",
  curious: "curious",
  disgusted: "disgusted",
  anxious: "anxious",
  calm: "calm",
  playful: "playful",
  serious: "serious",
  urgent: "urgent",
  romantic: "romantic",
  hopeful: "hopeful",
  grateful: "grateful",
  formal: "formal",
  informal: "informal",
  polite: "polite",
  rude: "rude",
  nostalgic: "nostalgic",
} as const;

export type EmotionTag = (typeof EMOTION)[keyof typeof EMOTION];

export const STATUS = {
  initial: "initial",
  translated: "translated",
  reviewed: "reviewed",
  final: "final",
} as const;

export type StatusTag = (typeof STATUS)[keyof typeof STATUS];

export const VARIANT = {
  standard: "standard",
  glossary: "glossary",
} as const;

export type VariantTag = (typeof VARIANT)[keyof typeof VARIANT];

export const STATUS_ORDER = ["initial", "translated", "reviewed", "final"] as const;

export type Params = Record<string, unknown>;

export type EntryIdOf<EntryIds extends string> = string extends EntryIds
  ? string
  : EntryIds | (string & {});

export type CliffResource = string | Uint8Array | CliffDocument;

export interface TranslationScope {
  namespace: string;
  clan: string;
  group?: string;
}

export type EntryIdInput =
  | string
  | {
      namespace?: string;
      clan?: string;
      group?: string;
      id: string;
    };

export interface EntryQuery {
  namespace?: string;
  clan?: string;
  group?: string;
  locale?: string | "all";
  status?: StatusTag | readonly StatusTag[];
  target?: "any" | "present" | "missing";
}

export type StatusCounts = Record<StatusTag, number>;

export interface ResolvedEntryId {
  namespace: string;
  clan: string;
  group: string;
  id: string;
  canonical: string;
  exists: boolean;
  ambiguous?: boolean;
  candidates?: readonly string[];
}

export interface MessageRecord {
  canonical: string;
  namespace: string;
  clan: string;
  group: string;
  id: string;
  locale: string;
  sourceLanguage: string;
  document: CliffDocument;
  groupRef: CliffGroup;
  entry: CliffEntry;
  variant: string;
  source: string;
  target?: string;
  type?: string;
  emotion: string[];
  status?: string;
  context?: string;
  maxWidth?: number;
  reference: string[];
  reviewer?: string;
  extensions: Record<string, string>;
  filePath?: string;
}

export interface MessageMetadata {
  entryId: string;
  namespace: string;
  clan: string;
  group: string;
  id: string;
  locale: string;
  sourceLanguage: string;
  targetLanguage: string;
  variant: string;
  source: string;
  target?: string;
  type?: string;
  emotion: string[];
  status?: string;
  context?: string;
  maxWidth?: number;
  reference: string[];
  reviewer?: string;
  extensions: Record<string, string>;
}

export interface MessageState {
  source: boolean;
  type: boolean;
}

export type RenderMethod<S extends MessageState> = S["source"] extends true
  ? S["type"] extends true
    ? (params?: Params) => string
    : never
  : (params?: Params) => string;

export type RenderPartsMethod<S extends MessageState> = S["source"] extends true
  ? S["type"] extends true
    ? (params?: Params) => MessagePart[]
    : never
  : (params?: Params) => MessagePart[];

export interface CommitOptions {
  overwrite?: boolean;
  validate?: boolean;
}

export interface MessageBuilder<S extends MessageState = { source: false; type: false }> {
  source(text: string, params?: Params): MessageBuilder<{ source: true; type: S["type"] }>;
  type(tag: TypeTag): MessageBuilder<{ source: S["source"]; type: true }>;
  typeFromGroup: S extends { source: true; type: false }
    ? () => MessageBuilder<{ source: true; type: true }>
    : never;
  emotion(...tags: readonly (EmotionTag | readonly EmotionTag[])[]): MessageBuilder<S>;
  context(text: string): MessageBuilder<S>;
  maxWidth(cells: number): MessageBuilder<S>;
  reference(...paths: string[]): MessageBuilder<S>;
  reviewer(name: string): MessageBuilder<S>;
  extension(name: string, value: string): MessageBuilder<S>;
  target(text: string, params?: Params): MessageBuilder<S>;
  status(tag: StatusTag): MessageBuilder<S>;
  locale(tag: string): MessageBuilder<S>;
  params(params: Params): MessageBuilder<S>;
  count(value: number): MessageBuilder<S>;
  render: RenderMethod<S>;
  renderToParts: RenderPartsMethod<S>;
  commit: S extends { source: true; type: true }
    ? (options?: CommitOptions) => MessageBuilder<S>
    : never;
  meta(): MessageMetadata;
  entry(): CliffEntry | undefined;
  width(params?: Params): number;
  fits(params?: Params): boolean;
  toString(): string;
}

export interface TFunction<EntryIds extends string = string> {
  (entryId: EntryIdOf<EntryIds>): MessageBuilder<{ source: false; type: false }>;
  (entryId: EntryIdOf<EntryIds>, params: Params): string;
  render(entryId: EntryIdOf<EntryIds>, params?: Params): string;
  renderToParts(entryId: EntryIdOf<EntryIds>, params?: Params): MessagePart[];
  has(entryId: EntryIdOf<EntryIds>): boolean;
  entry(entryId: EntryIdOf<EntryIds>): CliffEntry | undefined;
  meta(entryId: EntryIdOf<EntryIds>): MessageMetadata | undefined;
  entryIds(): string[];
}

export interface ScopedI18n<EntryIds extends string = string> {
  readonly t: TFunction<EntryIds>;
  readonly scope: TranslationScope;
}

export type MissingBehavior = "entryId" | "empty" | "throw" | "source";
export type WidthPolicy = "off" | "warn" | "error";
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface I18nDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  entryId?: string;
  locale?: string;
  namespace?: string;
  clan?: string;
  group?: string;
  line?: number;
  details?: Record<string, unknown>;
}

export interface I18nOptions {
  locale: string;
  fallbackLocale?: string | readonly string[];
  resources?: readonly CliffResource[];
  sourceLanguage?: string;
  defaultGroup?: string;
  params?: Params;
  aliases?: Readonly<Record<string, string>>;
  missing?: MissingBehavior;
  strictEntryIds?: boolean;
  requireEmotion?: boolean | readonly TypeTag[];
  enforceMaxWidth?: WidthPolicy;
  icu?: IcuRuntime;
  parse?: ParseOptions;
  onDiagnostic?: (diagnostic: I18nDiagnostic) => void;
  maxDiagnostics?: number;
}

export interface TranslatedDraft {
  source?: string;
  target?: string;
  type?: string;
  emotion?: readonly string[];
  status?: string;
  context?: string;
  maxWidth?: number;
  reference?: readonly string[];
  reviewer?: string;
  extensions?: Record<string, string>;
}

export interface AddOptions {
  sourcePath?: string;
  tolerant?: boolean;
  validate?: boolean;
}

export interface AddResult {
  documents: readonly CliffDocument[];
  issues: readonly ValidationIssue[];
  corrections: readonly Correction[];
}

export interface FileOptions {
  layout?: "folder" | "flat";
}

export interface CliffFile {
  filePath: string;
  namespace: string;
  clan: string;
  locale: string;
  text: string;
  document: CliffDocument;
}

export interface I18n<EntryIds extends string = string> {
  readonly locale: string;
  readonly language: string;
  readonly sourceLanguage: string | undefined;
  getLocale(): string;
  setLocale(locale: string): void;
  changeLanguage(locale: string): void;
  getVersion(): number;
  subscribe(listener: () => void): () => void;
  scope(scope: TranslationScope): ScopedI18n<EntryIds>;
  add(resource: CliffResource, options?: AddOptions): AddResult;
  addDocument(document: CliffDocument, options?: AddOptions): AddResult;
  has(
    entryId: EntryIdOf<EntryIds> | Exclude<EntryIdInput, string>,
    scope: TranslationScope,
  ): boolean;
  resolve(
    entryId: EntryIdOf<EntryIds> | Exclude<EntryIdInput, string>,
    scope: TranslationScope,
  ): ResolvedEntryId;
  entryIds(scope?: Partial<TranslationScope>): string[];
  query(options?: EntryQuery): MessageRecord[];
  untranslated(options?: Omit<EntryQuery, "status" | "target">): MessageRecord[];
  byStatus(status: StatusTag, options?: Omit<EntryQuery, "status">): MessageRecord[];
  statusCounts(options?: Omit<EntryQuery, "status">): StatusCounts;
  namespaces(): string[];
  clans(namespace?: string): string[];
  groups(scope?: Partial<TranslationScope>): string[];
  locales(): string[];
  files(options?: FileOptions): CliffFile[];
  toCliff(options?: FileOptions): string;
  validate(): ValidationIssue[];
  diagnostics(): readonly I18nDiagnostic[];
  clearDiagnostics(): void;
  format(
    message: string,
    params?: Params,
    options?: { locale?: string; currency?: string; timeZone?: string },
  ): string;
  formatToParts(
    message: string,
    params?: Params,
    options?: { locale?: string; currency?: string; timeZone?: string },
  ): MessagePart[];
}

export interface I18nRuntime {
  resolve(entryId: EntryIdInput, scope: TranslationScope): ResolvedEntryId;
  recordFor(canonical: string, locale: string): MessageRecord | undefined;
  format(
    message: string,
    params: Params,
    options: { locale: string; currency?: string; timeZone?: string },
  ): string;
  formatToParts(
    message: string,
    params: Params,
    options: { locale: string; currency?: string; timeZone?: string },
  ): MessagePart[];
  diagnose(diagnostic: I18nDiagnostic): void;
  getSourceLanguage(): string;
  getLocale(): string;
  getCatalog(): import("./catalog.js").Catalog;
  readonly defaultParams: Params;
  readonly missing: MissingBehavior;
  readonly requireEmotion: boolean | readonly TypeTag[];
  readonly enforceMaxWidth: WidthPolicy;
}

export type { IcuRuntime, MessagePart } from "./icu/types.js";
