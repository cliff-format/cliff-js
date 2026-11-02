import {
  type CliffDocument,
  type CliffEntry,
  type CliffGroup,
  canonicalId,
  createDocument,
  createExtensions,
  effectiveContext,
  effectiveEmotion,
  effectiveMaxWidth,
  effectiveType,
  isName,
  serialize,
  type ValidationIssue,
  validateDocument,
} from "@cliff-format/core";
import { CliffDuplicateKeyError, CliffI18nError } from "./errors.js";
import type { KeyCatalogContext } from "./key.js";
import { statusOf } from "./status.js";
import type {
  CliffFile,
  EntryQuery,
  FileOptions,
  MessageRecord,
  StatusCounts,
  StatusTag,
  TranslatedDraft,
  TranslationScope,
} from "./types.js";

export interface CatalogOptions {
  aliases?: Readonly<Record<string, string>>;
  defaultGroup?: string;
}

function localeKey(tag: string): string {
  return tag.toLowerCase();
}

function localeVariants(tag: string): string[] {
  const parts = tag.split("-").filter((part) => part.length > 0);
  const variants: string[] = [];
  for (let length = parts.length; length >= 1; length--) {
    variants.push(parts.slice(0, length).join("-"));
  }
  return variants;
}

function addSuffix(map: Map<string, Set<string>>, suffix: string, canonical: string): void {
  if (suffix.length === 0) return;
  const existing = map.get(suffix);
  if (existing === undefined) {
    map.set(suffix, new Set([canonical]));
  } else {
    existing.add(canonical);
  }
}

function recordFrom(document: CliffDocument, group: CliffGroup, entry: CliffEntry): MessageRecord {
  const namespace = document.header.namespace;
  const clan = document.header.clan;
  const groupPath = group.path;
  const canonical = canonicalId(namespace, clan, groupPath, entry.id);
  const type = effectiveType(entry, group);
  const context = effectiveContext(entry, group);
  const maxWidth = effectiveMaxWidth(entry, group);
  return {
    canonical,
    namespace,
    clan,
    group: groupPath,
    id: entry.id,
    locale: document.header.targetLanguage,
    sourceLanguage: document.header.sourceLanguage,
    document,
    groupRef: group,
    entry,
    variant: document.header.variant,
    source: entry.source ?? "",
    ...(entry.target === undefined ? {} : { target: entry.target }),
    ...(type === undefined ? {} : { type }),
    emotion: effectiveEmotion(entry, group),
    ...(entry.status === undefined ? {} : { status: entry.status }),
    ...(context === undefined ? {} : { context }),
    ...(maxWidth === undefined ? {} : { maxWidth }),
    reference: [...entry.reference],
    ...(entry.reviewer === undefined ? {} : { reviewer: entry.reviewer }),
    extensions: { ...entry.extensions },
    ...(document.path === undefined ? {} : { filePath: document.path }),
  };
}

export class Catalog implements KeyCatalogContext {
  readonly defaultGroup: string;
  readonly aliases: Readonly<Record<string, string>>;
  private readonly documentsList: CliffDocument[] = [];
  private readonly byLocale = new Map<string, Map<string, MessageRecord>>();
  private readonly byCanonical = new Map<string, MessageRecord[]>();
  private readonly suffixMap = new Map<string, Set<string>>();
  private readonly namespaceSet = new Set<string>();
  private readonly clanSet = new Set<string>();
  private readonly groupSet = new Set<string>();
  private readonly localeSet = new Set<string>();
  private readonly sourceLanguageSet = new Set<string>();

  constructor(options: CatalogOptions = {}) {
    this.defaultGroup = options.defaultGroup ?? "general";
    this.aliases = options.aliases ?? {};
  }

  get knownNamespaces(): ReadonlySet<string> {
    return this.namespaceSet;
  }

  get knownClans(): ReadonlySet<string> {
    return this.clanSet;
  }

  get documents(): readonly CliffDocument[] {
    return this.documentsList;
  }

  get sourceLanguages(): readonly string[] {
    return [...this.sourceLanguageSet];
  }

  addDocument(document: CliffDocument): MessageRecord[] {
    const locale = document.header.targetLanguage;
    const key = localeKey(locale);
    let localeMap = this.byLocale.get(key);
    if (localeMap === undefined) {
      localeMap = new Map<string, MessageRecord>();
      this.byLocale.set(key, localeMap);
    }

    const added: MessageRecord[] = [];
    for (const group of document.groups) {
      for (const entry of group.entries) {
        const record = recordFrom(document, group, entry);
        if (localeMap.has(record.canonical)) {
          throw new CliffDuplicateKeyError(record.canonical, locale);
        }
        this.indexRecord(record, localeMap);
        added.push(record);
      }
    }

    this.documentsList.push(document);
    this.namespaceSet.add(document.header.namespace);
    this.clanSet.add(document.header.clan);
    this.localeSet.add(locale);
    if (document.header.sourceLanguage.length > 0) {
      this.sourceLanguageSet.add(document.header.sourceLanguage);
    }
    return added;
  }

  addDraft(
    parts: {
      namespace: string;
      clan: string;
      group: string;
      id: string;
      sourceLanguage: string;
      targetLanguage: string;
    },
    draft: TranslatedDraft,
  ): MessageRecord {
    const document = this.ensureDocument(parts);
    let group = document.groups.find((candidate) => candidate.path === parts.group);
    if (group === undefined) {
      group = {
        path: parts.group,
        line: 0,
        emotion: [],
        entries: [],
        extensions: createExtensions(),
      };
      document.groups.push(group);
      this.groupSet.add(parts.group);
    }

    const entry: CliffEntry = {
      id: parts.id,
      line: 0,
      emotion: draft.emotion ? [...draft.emotion] : [],
      reference: draft.reference ? [...draft.reference] : [],
      extensions: draft.extensions ? { ...draft.extensions } : createExtensions(),
    };
    if (draft.source !== undefined) entry.source = draft.source;
    if (draft.target !== undefined) entry.target = draft.target;
    if (draft.type !== undefined) entry.type = draft.type;
    if (draft.status !== undefined) entry.status = draft.status;
    if (draft.context !== undefined) entry.context = draft.context;
    if (draft.maxWidth !== undefined) entry.maxWidth = draft.maxWidth;
    if (draft.reviewer !== undefined) entry.reviewer = draft.reviewer;

    const canonical = canonicalId(parts.namespace, parts.clan, parts.group, parts.id);
    const localeMap = this.byLocale.get(localeKey(parts.targetLanguage));
    if (localeMap?.has(canonical) === true) {
      throw new CliffDuplicateKeyError(canonical, parts.targetLanguage);
    }

    group.entries.push(entry);
    const record = recordFrom(document, group, entry);
    if (localeMap === undefined) {
      const created = new Map<string, MessageRecord>();
      this.byLocale.set(localeKey(parts.targetLanguage), created);
      this.indexRecord(record, created);
    } else {
      this.indexRecord(record, localeMap);
    }
    this.localeSet.add(parts.targetLanguage);
    this.sourceLanguageSet.add(parts.sourceLanguage);
    return record;
  }

  private ensureDocument(parts: {
    namespace: string;
    clan: string;
    group: string;
    id: string;
    sourceLanguage: string;
    targetLanguage: string;
  }): CliffDocument {
    const existing = this.documentsList.find(
      (document) =>
        document.header.namespace === parts.namespace &&
        document.header.clan === parts.clan &&
        localeKey(document.header.targetLanguage) === localeKey(parts.targetLanguage),
    );
    if (existing !== undefined) return existing;

    const document = createDocument("1.1");
    document.header.namespace = parts.namespace;
    document.header.clan = parts.clan;
    document.header.sourceLanguage = parts.sourceLanguage;
    document.header.targetLanguage = parts.targetLanguage;
    document.header.variant = "standard";
    this.documentsList.push(document);
    this.namespaceSet.add(parts.namespace);
    this.clanSet.add(parts.clan);
    return document;
  }

  private indexRecord(record: MessageRecord, localeMap: Map<string, MessageRecord>): void {
    localeMap.set(record.canonical, record);
    const existing = this.byCanonical.get(record.canonical);
    if (existing === undefined) {
      this.byCanonical.set(record.canonical, [record]);
    } else {
      existing.push(record);
    }
    this.namespaceSet.add(record.namespace);
    this.clanSet.add(record.clan);
    this.groupSet.add(record.group);
    addSuffix(this.suffixMap, `${record.clan}.${record.group}.${record.id}`, record.canonical);
    addSuffix(this.suffixMap, `${record.group}.${record.id}`, record.canonical);
    const lastGroup = record.group.split(".").at(-1);
    if (lastGroup !== undefined) {
      addSuffix(this.suffixMap, `${lastGroup}.${record.id}`, record.canonical);
    }
    addSuffix(this.suffixMap, record.id, record.canonical);
  }

  hasCanonical(canonical: string): boolean {
    return this.byCanonical.has(canonical);
  }

  recordForCanonical(canonical: string): MessageRecord | undefined {
    return this.byCanonical.get(canonical)?.[0];
  }

  recordsForCanonical(canonical: string): readonly MessageRecord[] {
    return this.byCanonical.get(canonical) ?? [];
  }

  suffixMatches(suffix: string): readonly string[] {
    return [...(this.suffixMap.get(suffix) ?? [])];
  }

  record(canonical: string, locale: string): MessageRecord | undefined {
    return this.byLocale.get(localeKey(locale))?.get(canonical);
  }

  selectRecord(
    canonical: string,
    localeChain: readonly string[],
    sourceLanguage?: string,
  ): MessageRecord | undefined {
    const records = this.byCanonical.get(canonical);
    if (records === undefined) return undefined;
    for (const tag of localeChain) {
      const found = records.find(
        (record) => localeKey(record.locale) === tag && record.target !== undefined,
      );
      if (found !== undefined) return found;
    }
    for (const tag of localeChain) {
      const found = records.find((record) => localeKey(record.locale) === tag);
      if (found !== undefined) return found;
    }
    if (sourceLanguage !== undefined) {
      const found = records.find(
        (record) => localeKey(record.locale) === localeKey(sourceLanguage),
      );
      if (found !== undefined) return found;
    }
    return records[0];
  }

  localeChain(
    locale: string,
    fallbacks: readonly string[] = [],
    sourceLanguage?: string,
  ): string[] {
    const tags: string[] = [];
    const add = (tag: string): void => {
      for (const variant of localeVariants(tag)) {
        const normalized = localeKey(variant);
        if (normalized.length > 0 && !tags.includes(normalized)) tags.push(normalized);
      }
    };
    add(locale);
    for (const fallback of fallbacks) add(fallback);
    if (sourceLanguage !== undefined) add(sourceLanguage);
    return tags;
  }

  namespaces(): string[] {
    return [...this.namespaceSet].sort();
  }

  clans(namespace?: string): string[] {
    if (namespace === undefined) return [...this.clanSet].sort();
    const clans = new Set<string>();
    for (const records of this.byCanonical.values()) {
      for (const record of records) {
        if (record.namespace === namespace) clans.add(record.clan);
      }
    }
    return [...clans].sort();
  }

  groups(scope: Partial<TranslationScope> = {}): string[] {
    const groups = new Set<string>();
    for (const records of this.byCanonical.values()) {
      for (const record of records) {
        if (scope.namespace !== undefined && record.namespace !== scope.namespace) continue;
        if (scope.clan !== undefined && record.clan !== scope.clan) continue;
        if (
          scope.group !== undefined &&
          scope.group.length > 0 &&
          !(record.group === scope.group || record.group.startsWith(`${scope.group}.`))
        ) {
          continue;
        }
        groups.add(record.group);
      }
    }
    return [...groups].sort();
  }

  keys(scope: Partial<TranslationScope> = {}): string[] {
    const keys = new Set<string>();
    for (const records of this.byCanonical.values()) {
      for (const record of records) {
        if (scope.namespace !== undefined && record.namespace !== scope.namespace) continue;
        if (scope.clan !== undefined && record.clan !== scope.clan) continue;
        if (
          scope.group !== undefined &&
          scope.group.length > 0 &&
          !(record.group === scope.group || record.group.startsWith(`${scope.group}.`))
        ) {
          continue;
        }
        keys.add(record.canonical);
      }
    }
    return [...keys].sort();
  }

  allRecords(): MessageRecord[] {
    const records: MessageRecord[] = [];
    for (const group of this.byCanonical.values()) records.push(...group);
    return records;
  }

  query(options: EntryQuery = {}): MessageRecord[] {
    const statuses =
      options.status === undefined
        ? undefined
        : new Set<StatusTag>(Array.isArray(options.status) ? options.status : [options.status]);
    return this.allRecords().filter((record) => {
      if (options.namespace !== undefined && record.namespace !== options.namespace) return false;
      if (options.clan !== undefined && record.clan !== options.clan) return false;
      if (
        options.group !== undefined &&
        options.group.length > 0 &&
        !(record.group === options.group || record.group.startsWith(`${options.group}.`))
      ) {
        return false;
      }
      if (
        options.locale !== undefined &&
        options.locale !== "all" &&
        localeKey(record.locale) !== localeKey(options.locale)
      ) {
        return false;
      }
      if (statuses !== undefined && !statuses.has(statusOf(record.entry))) return false;
      if (options.target === "present" && record.target === undefined) return false;
      if (options.target === "missing" && record.target !== undefined) return false;
      return true;
    });
  }

  untranslated(options: Omit<EntryQuery, "status" | "target"> = {}): MessageRecord[] {
    return this.query(options).filter(
      (record) => record.target === undefined || statusOf(record.entry) === "initial",
    );
  }

  byStatus(status: StatusTag, options: Omit<EntryQuery, "status"> = {}): MessageRecord[] {
    return this.query({ ...options, status });
  }

  statusCounts(options: Omit<EntryQuery, "status"> = {}): StatusCounts {
    const counts: StatusCounts = {
      initial: 0,
      translated: 0,
      reviewed: 0,
      final: 0,
    };
    for (const record of this.query(options)) counts[statusOf(record.entry)]++;
    return counts;
  }

  locales(): string[] {
    return [...this.localeSet].sort();
  }

  findGroup(namespace: string, clan: string, groupPath: string): CliffGroup | undefined {
    for (const document of this.documentsList) {
      if (document.header.namespace !== namespace || document.header.clan !== clan) continue;
      const group = document.groups.find((candidate) => candidate.path === groupPath);
      if (group !== undefined) return group;
    }
    return undefined;
  }

  files(options: FileOptions = {}): CliffFile[] {
    const files: CliffFile[] = [];
    const used = new Set<string>();
    const layout = options.layout ?? "folder";
    for (const document of this.documentsList) {
      const header = document.header;
      let filePath = document.path;
      if (filePath === undefined || filePath.length === 0) {
        filePath =
          layout === "flat"
            ? `${header.clan}.${header.targetLanguage}.cliff`
            : `${header.targetLanguage}/${header.clan}.cliff`;
      }
      if (used.has(filePath)) {
        throw new CliffI18nError(`duplicate CLIFF output path "${filePath}"`);
      }
      used.add(filePath);
      files.push({
        filePath,
        namespace: header.namespace,
        clan: header.clan,
        locale: header.targetLanguage,
        text: serialize(document),
        document,
      });
    }
    return files;
  }

  toCliff(options: FileOptions = {}): string {
    const files = this.files(options);
    if (files.length === 0) return "";
    if (files.length > 1) {
      throw new CliffI18nError(
        `${files.length} CLIFF documents are loaded; use files() and write each one separately`,
      );
    }
    const first = files[0];
    if (first === undefined) return "";
    return first.text;
  }

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const document of this.documentsList) {
      issues.push(...validateDocument(document));
    }
    return issues;
  }
}

export function assertCatalogParts(parts: {
  namespace: string;
  clan: string;
  group: string;
  id: string;
}): void {
  if (!isName(parts.namespace)) throw new CliffI18nError(`invalid namespace "${parts.namespace}"`);
  if (!isName(parts.clan)) throw new CliffI18nError(`invalid clan "${parts.clan}"`);
  if (!isName(parts.id)) throw new CliffI18nError(`invalid entry id "${parts.id}"`);
  for (const segment of parts.group.split(".")) {
    if (!isName(segment)) {
      throw new CliffI18nError(`invalid group path "${parts.group}"`);
    }
  }
}
