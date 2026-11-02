import {
  type CliffEntry,
  CliffValidationError,
  displayWidth,
  hasErrors,
  validateDocument,
} from "@cliff-format/core";
import { CliffI18nError, CliffMissingEntryError, CliffMissingMetadataError } from "./errors.js";
import { reconcileEntryStatus } from "./status.js";
import type {
  CommitOptions,
  EmotionTag,
  EntryIdInput,
  I18nRuntime,
  MessageBuilder,
  MessageMetadata,
  MessagePart,
  MessageRecord,
  Params,
  ResolvedEntryId,
  StatusTag,
  TFunction,
  TranslationScope,
  TypeTag,
} from "./types.js";
import { assertEmotionTag, assertStatusTag, assertTypeTag } from "./vocabulary.js";

function normalizeEmotion(tags: readonly (EmotionTag | readonly EmotionTag[])[]): EmotionTag[] {
  const out: EmotionTag[] = [];
  for (const tag of tags) {
    if (Array.isArray(tag)) {
      for (const item of tag as readonly EmotionTag[]) out.push(assertEmotionTag(item));
    } else {
      out.push(assertEmotionTag(tag as EmotionTag));
    }
  }
  return out;
}

function sameEmotion(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((tag, index) => tag === right[index]);
}

export class MessageBuilderImpl {
  private sourceText: string | undefined;
  private sourceParams: Params = {};
  private targetText: string | undefined;
  private targetParams: Params = {};
  private extraParams: Params = {};
  private typeTag: TypeTag | undefined;
  private inheritType = false;
  private emotionTags: EmotionTag[] = [];
  private statusTag: StatusTag | undefined;
  private contextText: string | undefined;
  private maxWidthCells: number | undefined;
  private referencePaths: string[] = [];
  private reviewerName: string | undefined;
  private extensionMap: Record<string, string> = {};
  private localeOverride: string | undefined;

  constructor(
    private readonly i18n: I18nRuntime,
    private readonly scope: TranslationScope,
    private readonly entryIdInput: EntryIdInput,
  ) {}

  source(text: string, params: Params = {}): MessageBuilderImpl {
    if (typeof text !== "string") throw new TypeError("source text must be a string");
    this.sourceText = text;
    this.sourceParams = { ...this.sourceParams, ...params };
    return this;
  }

  type(tag: TypeTag): MessageBuilderImpl {
    this.typeTag = assertTypeTag(tag);
    this.inheritType = false;
    return this;
  }

  typeFromGroup(): MessageBuilderImpl {
    if (this.sourceText === undefined) {
      throw new CliffI18nError(".typeFromGroup() must be called after .source()");
    }
    if (this.typeTag !== undefined) {
      throw new CliffI18nError(".typeFromGroup() cannot be used after .type()");
    }
    this.inheritType = true;
    return this;
  }

  emotion(...tags: readonly (EmotionTag | readonly EmotionTag[])[]): MessageBuilderImpl {
    this.emotionTags = normalizeEmotion(tags);
    return this;
  }

  context(text: string): MessageBuilderImpl {
    this.contextText = text;
    return this;
  }

  maxWidth(cells: number): MessageBuilderImpl {
    if (!Number.isInteger(cells) || cells <= 0) {
      throw new TypeError("max-width must be a positive integer");
    }
    this.maxWidthCells = cells;
    return this;
  }

  reference(...paths: string[]): MessageBuilderImpl {
    this.referencePaths = [...this.referencePaths, ...paths];
    return this;
  }

  reviewer(name: string): MessageBuilderImpl {
    this.reviewerName = name;
    return this;
  }

  extension(name: string, value: string): MessageBuilderImpl {
    if (!name.startsWith("x-")) {
      throw new TypeError(`extension name "${name}" must start with "x-"`);
    }
    this.extensionMap[name] = value;
    return this;
  }

  target(text: string, params: Params = {}): MessageBuilderImpl {
    this.targetText = text;
    this.targetParams = { ...this.targetParams, ...params };
    return this;
  }

  status(tag: StatusTag): MessageBuilderImpl {
    this.statusTag = assertStatusTag(tag);
    return this;
  }

  locale(tag: string): MessageBuilderImpl {
    this.localeOverride = tag;
    return this;
  }

  params(params: Params): MessageBuilderImpl {
    this.extraParams = { ...this.extraParams, ...params };
    return this;
  }

  count(value: number): MessageBuilderImpl {
    this.extraParams = { ...this.extraParams, count: value, n: value };
    return this;
  }

  private activeLocale(): string {
    return this.localeOverride ?? this.i18n.getLocale();
  }

  private resolved(): ResolvedEntryId {
    return this.i18n.resolve(this.entryIdInput, this.scope);
  }

  private recordFor(resolved: ResolvedEntryId): MessageRecord | undefined {
    return this.i18n.recordFor(resolved.canonical, this.activeLocale());
  }

  private mergedParams(params?: Params): Params {
    return {
      ...this.i18n.defaultParams,
      ...this.sourceParams,
      ...this.targetParams,
      ...this.extraParams,
      ...params,
    };
  }

  private diagnose(
    code: string,
    severity: "error" | "warning" | "info",
    message: string,
    resolved?: ResolvedEntryId,
  ): void {
    this.i18n.diagnose({
      code,
      severity,
      message,
      ...(resolved === undefined ? {} : { entryId: resolved.canonical }),
      locale: this.activeLocale(),
      namespace: this.scope.namespace,
      clan: this.scope.clan,
      ...(this.scope.group === undefined ? {} : { group: this.scope.group }),
    });
  }

  private requireEffectiveType(resolved: ResolvedEntryId): string | undefined {
    if (this.typeTag !== undefined) return this.typeTag;
    if (!this.inheritType) return undefined;
    const group = this.i18n
      .getCatalog()
      .findGroup(resolved.namespace, resolved.clan, resolved.group);
    if (group?.type === undefined) {
      throw new CliffMissingMetadataError(
        resolved.canonical,
        ["type"],
        `group [${resolved.group}] has no type; add .type(TYPE...) or declare type on the group`,
      );
    }
    return group.type;
  }

  private ensureAuthoringMetadata(resolved: ResolvedEntryId): void {
    if (this.sourceText === undefined) return;
    if (this.typeTag !== undefined) return;
    if (this.inheritType) {
      this.requireEffectiveType(resolved);
      return;
    }
    throw new CliffMissingMetadataError(
      resolved.canonical,
      ["type"],
      "add .type(TYPE...) or .typeFromGroup()",
    );
  }

  private groupEmotion(resolved: ResolvedEntryId): string[] {
    const group = this.i18n
      .getCatalog()
      .findGroup(resolved.namespace, resolved.clan, resolved.group);
    return group?.emotion ? [...group.emotion] : [];
  }

  private requireEmotionIfConfigured(
    resolved: ResolvedEntryId,
    effectiveType: string | undefined,
  ): void {
    const requirement = this.i18n.requireEmotion;
    if (requirement === false) return;
    if (this.emotionTags.length > 0) return;
    const groupEmotion = this.groupEmotion(resolved);
    if (groupEmotion.length > 0) return;
    if (requirement === true) {
      throw new CliffMissingMetadataError(
        resolved.canonical,
        ["emotion"],
        "requireEmotion is enabled; add .emotion(...) or declare emotion on the group",
      );
    }
    if (effectiveType !== undefined && requirement.includes(effectiveType as TypeTag)) {
      throw new CliffMissingMetadataError(
        resolved.canonical,
        ["emotion"],
        `requireEmotion requires an explicit emotion for type "${effectiveType}"`,
      );
    }
  }

  private createDraft(resolved: ResolvedEntryId): MessageRecord {
    const sourceLanguage = this.i18n.getSourceLanguage();
    const targetLanguage = this.activeLocale();
    const effectiveType = this.requireEffectiveType(resolved);
    this.requireEmotionIfConfigured(resolved, effectiveType);
    const status: StatusTag =
      this.statusTag ?? (this.targetText === undefined ? "initial" : "translated");
    if (status !== "initial" && this.targetText === undefined) {
      throw new CliffMissingMetadataError(
        resolved.canonical,
        ["target"],
        `status "${status}" requires a target field`,
      );
    }
    const record = this.i18n.getCatalog().addDraft(
      {
        namespace: resolved.namespace,
        clan: resolved.clan,
        group: resolved.group,
        id: resolved.id,
        sourceLanguage,
        targetLanguage,
      },
      {
        ...(this.sourceText === undefined ? {} : { source: this.sourceText }),
        ...(this.targetText === undefined ? {} : { target: this.targetText }),
        ...(this.typeTag === undefined ? {} : { type: this.typeTag }),
        emotion: this.emotionTags,
        status,
        ...(this.contextText === undefined ? {} : { context: this.contextText }),
        ...(this.maxWidthCells === undefined ? {} : { maxWidth: this.maxWidthCells }),
        ...(this.referencePaths.length === 0 ? {} : { reference: this.referencePaths }),
        ...(this.reviewerName === undefined ? {} : { reviewer: this.reviewerName }),
        ...(Object.keys(this.extensionMap).length === 0 ? {} : { extensions: this.extensionMap }),
      },
    );
    this.diagnose("draft-created", "info", `created CLIFF draft "${resolved.canonical}"`, resolved);
    return record;
  }

  private checkWidth(
    text: string,
    maxWidth: number,
    resolved: ResolvedEntryId,
    locale: string,
  ): void {
    const policy = this.i18n.enforceMaxWidth;
    if (policy === "off") return;
    const cells = displayWidth(text);
    if (cells <= maxWidth) return;
    const message = `rendered display width ${cells} cells exceeds max-width ${maxWidth} for "${resolved.canonical}" in "${locale}"`;
    if (policy === "error") {
      this.diagnose("width-exceeded", "error", message, resolved);
      throw new CliffI18nError(message);
    }
    this.diagnose("width-exceeded", "warning", message, resolved);
  }

  private renderRecord(
    record: MessageRecord,
    resolved: ResolvedEntryId,
    params: Params | undefined,
    parts: false,
  ): string;
  private renderRecord(
    record: MessageRecord,
    resolved: ResolvedEntryId,
    params: Params | undefined,
    parts: true,
  ): MessagePart[];
  private renderRecord(
    record: MessageRecord,
    resolved: ResolvedEntryId,
    params: Params | undefined,
    parts: boolean,
  ): string | MessagePart[] {
    const target = this.targetText ?? record.target;
    const template = target ?? record.source;
    const formatLocale = target !== undefined ? record.locale : record.sourceLanguage;
    const values = this.mergedParams(params);
    const maxWidth = this.maxWidthCells ?? record.maxWidth;
    if (parts) {
      const result = this.i18n.formatToParts(template, values, { locale: formatLocale });
      if (maxWidth !== undefined) {
        const text = result
          .filter((part) => part.type !== "markup")
          .map((part) => (part.type === "literal" ? part.value : part.value))
          .join("");
        this.checkWidth(text, maxWidth, resolved, formatLocale);
      }
      return result;
    }
    const text = this.i18n.format(template, values, { locale: formatLocale });
    if (maxWidth !== undefined) this.checkWidth(text, maxWidth, resolved, formatLocale);
    return text;
  }

  private expectationDiagnostics(record: MessageRecord, resolved: ResolvedEntryId): void {
    if (this.sourceText !== undefined && this.sourceText !== record.source) {
      this.diagnose(
        "source-mismatch",
        "warning",
        `source in CLIFF differs from .source(); CLIFF keeps "${record.source}"`,
        resolved,
      );
    }
    if (this.typeTag !== undefined && record.type !== this.typeTag) {
      this.diagnose(
        "type-mismatch",
        "warning",
        `entry type is "${record.type ?? ""}", not "${this.typeTag}"`,
        resolved,
      );
    }
    if (this.emotionTags.length > 0 && !sameEmotion(this.emotionTags, record.emotion)) {
      this.diagnose(
        "emotion-mismatch",
        "warning",
        `entry emotion is [${record.emotion.join(", ")}], not [${this.emotionTags.join(", ")}]`,
        resolved,
      );
    }
  }

  private missing(resolved: ResolvedEntryId): string {
    const message = `missing CLIFF entry "${resolved.canonical}" for locale "${this.activeLocale()}"`;
    this.diagnose("missing-entry", "warning", message, resolved);
    const behavior = this.i18n.missing;
    if (behavior === "throw") {
      throw new CliffMissingEntryError(resolved.canonical, this.activeLocale());
    }
    if (behavior === "empty") return "";
    if (behavior === "source") return this.sourceText ?? "";
    if (typeof this.entryIdInput === "string") return this.entryIdInput;
    return resolved.canonical;
  }

  render(params?: Params): string {
    const resolved = this.resolved();
    const record = this.recordFor(resolved);
    if (this.sourceText === undefined) {
      if (record === undefined) return this.missing(resolved);
      this.expectationDiagnostics(record, resolved);
      return this.renderRecord(record, resolved, params, false);
    }
    this.ensureAuthoringMetadata(resolved);
    if (record !== undefined) {
      this.expectationDiagnostics(record, resolved);
      return this.renderRecord(record, resolved, params, false);
    }
    const draft = this.createDraft(resolved);
    return this.renderRecord(draft, resolved, params, false);
  }

  renderToParts(params?: Params): MessagePart[] {
    const resolved = this.resolved();
    const record = this.recordFor(resolved);
    if (this.sourceText === undefined) {
      if (record === undefined) {
        const text = this.missing(resolved);
        return [{ type: "literal", value: text }];
      }
      this.expectationDiagnostics(record, resolved);
      return this.renderRecord(record, resolved, params, true);
    }
    this.ensureAuthoringMetadata(resolved);
    if (record !== undefined) {
      this.expectationDiagnostics(record, resolved);
      return this.renderRecord(record, resolved, params, true);
    }
    const draft = this.createDraft(resolved);
    return this.renderRecord(draft, resolved, params, true);
  }

  meta(): MessageMetadata {
    const resolved = this.resolved();
    const record = this.recordFor(resolved);
    const source = this.sourceText ?? record?.source ?? "";
    const target = this.targetText ?? record?.target;
    const type = this.typeTag ?? record?.type;
    const emotion = this.emotionTags.length > 0 ? [...this.emotionTags] : (record?.emotion ?? []);
    const status = this.statusTag ?? record?.status;
    const context = this.contextText ?? record?.context;
    const maxWidth = this.maxWidthCells ?? record?.maxWidth;
    const reference =
      this.referencePaths.length > 0 ? [...this.referencePaths] : (record?.reference ?? []);
    const reviewer = this.reviewerName ?? record?.reviewer;
    return {
      entryId: resolved.canonical,
      namespace: resolved.namespace,
      clan: resolved.clan,
      group: resolved.group,
      id: resolved.id,
      locale: this.activeLocale(),
      sourceLanguage: record?.sourceLanguage ?? this.i18n.getSourceLanguage(),
      targetLanguage: record?.locale ?? this.activeLocale(),
      variant: record?.variant ?? "standard",
      source,
      ...(target === undefined ? {} : { target }),
      ...(type === undefined ? {} : { type }),
      emotion,
      ...(status === undefined ? {} : { status }),
      ...(context === undefined ? {} : { context }),
      ...(maxWidth === undefined ? {} : { maxWidth }),
      reference,
      ...(reviewer === undefined ? {} : { reviewer }),
      extensions: record?.extensions ?? { ...this.extensionMap },
    };
  }

  entry(): CliffEntry | undefined {
    const resolved = this.resolved();
    return this.recordFor(resolved)?.entry;
  }

  commit(options: CommitOptions = {}): MessageBuilderImpl {
    const resolved = this.resolved();
    const existing = this.recordFor(resolved);
    if (existing === undefined) {
      this.ensureAuthoringMetadata(resolved);
      const draft = this.createDraft(resolved);
      this.validateDocument(draft);
      return this;
    }

    if (options.overwrite === true) {
      this.ensureAuthoringMetadata(resolved);
      this.applyOverwrite(existing);
    } else if (this.targetText !== undefined) {
      const previous = {
        ...(existing.entry.source === undefined ? {} : { source: existing.entry.source }),
        ...(existing.entry.target === undefined ? {} : { target: existing.entry.target }),
        ...(this.statusTag === undefined ? {} : { explicit: this.statusTag }),
      };
      existing.entry.target = this.targetText;
      existing.entry.status = reconcileEntryStatus(existing.entry, previous);
    } else {
      this.ensureAuthoringMetadata(resolved);
    }
    this.validateDocument(existing);
    return this;
  }

  private applyOverwrite(record: MessageRecord): void {
    const entry = record.entry;
    const previous = {
      ...(entry.source === undefined ? {} : { source: entry.source }),
      ...(entry.target === undefined ? {} : { target: entry.target }),
      ...(this.statusTag === undefined ? {} : { explicit: this.statusTag }),
    };
    if (this.sourceText !== undefined) entry.source = this.sourceText;
    if (this.targetText !== undefined) entry.target = this.targetText;
    if (this.typeTag !== undefined) entry.type = this.typeTag;
    if (this.emotionTags.length > 0) entry.emotion = [...this.emotionTags];
    if (this.contextText !== undefined) entry.context = this.contextText;
    if (this.maxWidthCells !== undefined) entry.maxWidth = this.maxWidthCells;
    if (this.referencePaths.length > 0) entry.reference = [...this.referencePaths];
    if (this.reviewerName !== undefined) entry.reviewer = this.reviewerName;
    if (Object.keys(this.extensionMap).length > 0) {
      entry.extensions = { ...entry.extensions, ...this.extensionMap };
    }
    entry.status = reconcileEntryStatus(entry, previous);
  }

  private validateDocument(record: MessageRecord): void {
    const issues = validateDocument(record.document);
    if (hasErrors(issues)) {
      throw new CliffValidationError(issues, record.document.corrections);
    }
  }

  width(params?: Params): number {
    return displayWidth(this.render(params));
  }

  fits(params?: Params): boolean {
    const resolved = this.resolved();
    const record = this.recordFor(resolved);
    const maxWidth = this.maxWidthCells ?? record?.maxWidth;
    if (maxWidth === undefined) return true;
    return this.width(params) <= maxWidth;
  }

  toString(): string {
    return this.render();
  }
}

export function createT<EntryIds extends string = string>(
  i18n: I18nRuntime,
  scope: TranslationScope,
): TFunction<EntryIds> {
  const callable = (entryId: EntryIdInput, params?: Params): MessageBuilder | string => {
    const builder = new MessageBuilderImpl(i18n, scope, entryId);
    if (params === undefined) {
      return builder as unknown as MessageBuilder;
    }
    return builder.params(params).render();
  };

  const fn = callable as unknown as TFunction<EntryIds>;
  fn.render = (entryId, params) => new MessageBuilderImpl(i18n, scope, entryId).render(params);
  fn.renderToParts = (entryId, params) =>
    new MessageBuilderImpl(i18n, scope, entryId).renderToParts(params);
  fn.has = (entryId) => {
    const resolved = i18n.resolve(entryId, scope);
    return resolved.exists && i18n.recordFor(resolved.canonical, i18n.getLocale()) !== undefined;
  };
  fn.entry = (entryId) => {
    const resolved = i18n.resolve(entryId, scope);
    return i18n.recordFor(resolved.canonical, i18n.getLocale())?.entry;
  };
  fn.meta = (entryId) => new MessageBuilderImpl(i18n, scope, entryId).meta();
  fn.entryIds = () => i18n.getCatalog().entryIds(scope);
  return fn;
}
