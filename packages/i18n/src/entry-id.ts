import { isName } from "@cliff-format/core";
import { CliffAmbiguousEntryError, CliffScopeError, CliffScopeMismatchError } from "./errors.js";
import type { EntryIdInput, MessageRecord, ResolvedEntryId, TranslationScope } from "./types.js";

export interface EntryIdCatalogContext {
  readonly knownNamespaces: ReadonlySet<string>;
  readonly knownClans: ReadonlySet<string>;
  readonly defaultGroup: string;
  readonly aliases: Readonly<Record<string, string>>;
  hasCanonical(canonical: string): boolean;
  recordForCanonical(canonical: string): MessageRecord | undefined;
  suffixMatches(suffix: string): readonly string[];
}

interface ParsedEntryId {
  raw: string;
  namespace?: string;
  segments: string[];
}

export function joinCanonical(namespace: string, clan: string, group: string, id: string): string {
  return [namespace, clan, group, id].filter((part) => part.length > 0).join(".");
}

export function assertScope(scope: TranslationScope): void {
  if (!isName(scope.namespace)) {
    throw new CliffScopeError(
      `namespace "${scope.namespace}" is not a valid CLIFF name (A-Z a-z 0-9 _ -)`,
      scope,
    );
  }
  if (!isName(scope.clan)) {
    throw new CliffScopeError(
      `clan "${scope.clan}" is not a valid CLIFF name (A-Z a-z 0-9 _ -)`,
      scope,
    );
  }
  if (scope.group !== undefined && scope.group.length > 0) {
    for (const segment of scope.group.split(".")) {
      if (!isName(segment)) {
        throw new CliffScopeError(
          `group path "${scope.group}" contains invalid segment "${segment}"`,
          scope,
        );
      }
    }
  }
}

function applyAlias(raw: string, aliases: Readonly<Record<string, string>>): string {
  let current = raw;
  const seen = new Set<string>();
  while (Object.hasOwn(aliases, current)) {
    if (seen.has(current)) {
      throw new CliffScopeError(`alias cycle while resolving "${raw}"`);
    }
    seen.add(current);
    current = aliases[current] as string;
  }
  return current;
}

function parseStringEntryId(raw: string): ParsedEntryId {
  const text = raw.trim();
  if (text.length === 0) {
    throw new CliffScopeError("entry ID must not be empty");
  }
  const colon = /^([A-Za-z0-9_-]+):(.+)$/.exec(text);
  const namespace = colon?.[1];
  const body = colon?.[2] ?? text;
  if (namespace !== undefined && !isName(namespace)) {
    throw new CliffScopeError(`namespace "${namespace}" is not a valid CLIFF name`);
  }
  const segments = body
    .split(/[./]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    throw new CliffScopeError(`entry ID "${raw}" has no path segments`);
  }
  for (const segment of segments) {
    if (!isName(segment)) {
      throw new CliffScopeError(
        `entry ID "${raw}" contains invalid segment "${segment}"; CLIFF names use A-Z a-z 0-9 _ -`,
      );
    }
  }
  return namespace === undefined ? { raw, segments } : { raw, namespace, segments };
}

function candidateEntryIds(parsed: ParsedEntryId, scope: TranslationScope): string[] {
  const joined = parsed.segments.join(".");
  const out: string[] = [];
  const add = (value: string): void => {
    if (value.length > 0 && !out.includes(value)) out.push(value);
  };

  if (parsed.namespace !== undefined) {
    add(`${parsed.namespace}.${joined}`);
    add(`${parsed.namespace}.${scope.clan}.${joined}`);
    if (scope.group !== undefined && scope.group.length > 0) {
      add(`${parsed.namespace}.${scope.clan}.${scope.group}.${joined}`);
    }
    return out;
  }

  add(joined);
  add(`${scope.namespace}.${joined}`);
  add(`${scope.namespace}.${scope.clan}.${joined}`);
  if (scope.group !== undefined && scope.group.length > 0) {
    add(`${scope.namespace}.${scope.clan}.${scope.group}.${joined}`);
  }
  return out;
}

function partsOfRecord(record: MessageRecord): ResolvedEntryId {
  return {
    namespace: record.namespace,
    clan: record.clan,
    group: record.group,
    id: record.id,
    canonical: record.canonical,
    exists: true,
  };
}

function groupPrefixLength(group: string, prefix: string): number {
  const groupSegments = group.split(".");
  const prefixSegments = prefix.split(".").filter((segment) => segment.length > 0);
  let count = 0;
  while (
    count < groupSegments.length &&
    count < prefixSegments.length &&
    groupSegments[count] === prefixSegments[count]
  ) {
    count++;
  }
  return count;
}

function chooseByGroup(records: readonly MessageRecord[], scope: TranslationScope): MessageRecord {
  const prefix = scope.group ?? "";
  const sorted = [...records].sort((left, right) => {
    const leftPrefix = prefix.length > 0 ? groupPrefixLength(left.group, prefix) : 0;
    const rightPrefix = prefix.length > 0 ? groupPrefixLength(right.group, prefix) : 0;
    if (leftPrefix !== rightPrefix) return rightPrefix - leftPrefix;
    const leftSegments = left.group.split(".").length;
    const rightSegments = right.group.split(".").length;
    if (leftSegments !== rightSegments) return rightSegments - leftSegments;
    return left.canonical.localeCompare(right.canonical);
  });
  return sorted[0] as MessageRecord;
}

function validateGroup(group: string): void {
  if (group.length === 0) return;
  for (const segment of group.split(".")) {
    if (!isName(segment)) {
      throw new CliffScopeError(`group path "${group}" contains invalid segment "${segment}"`);
    }
  }
}

function parseAuthoringEntryId(
  parsed: ParsedEntryId,
  scope: TranslationScope,
  context: EntryIdCatalogContext,
): ResolvedEntryId {
  if (parsed.namespace !== undefined && parsed.namespace !== scope.namespace) {
    throw new CliffScopeMismatchError(
      parsed.raw,
      scope,
      `${scope.namespace}.${scope.clan}.<group>.<id>`,
    );
  }

  let segments = [...parsed.segments];

  if (segments[0] === scope.namespace) {
    segments = segments.slice(1);
    if (segments[0] === scope.clan) {
      segments = segments.slice(1);
    } else if (segments[0] !== undefined && context.knownClans.has(segments[0])) {
      throw new CliffScopeMismatchError(
        parsed.raw,
        scope,
        `${scope.namespace}.${scope.clan}.<group>.<id>`,
      );
    }
  } else if (
    segments[0] !== undefined &&
    context.knownNamespaces.has(segments[0]) &&
    segments[0] !== scope.namespace
  ) {
    throw new CliffScopeMismatchError(
      parsed.raw,
      scope,
      `${scope.namespace}.${scope.clan}.<group>.<id>`,
    );
  }

  if (segments[0] === scope.clan) {
    segments = segments.slice(1);
  } else if (
    segments[0] !== undefined &&
    context.knownClans.has(segments[0]) &&
    segments[0] !== scope.clan
  ) {
    throw new CliffScopeMismatchError(
      parsed.raw,
      scope,
      `${scope.namespace}.${scope.clan}.<group>.<id>`,
    );
  }

  if (segments.length === 0) {
    throw new CliffScopeError(`entry ID "${parsed.raw}" has no entry id`);
  }

  const id = segments[segments.length - 1] as string;
  if (!isName(id)) {
    throw new CliffScopeError(`entry id "${id}" is not a valid CLIFF name`);
  }
  const groupSegments = segments.slice(0, -1);
  let group =
    groupSegments.length > 0
      ? groupSegments.join(".")
      : scope.group && scope.group.length > 0
        ? scope.group
        : context.defaultGroup;
  if (scope.group !== undefined && scope.group.length > 0 && groupSegments.length > 0) {
    group = `${scope.group}.${groupSegments.join(".")}`;
  }
  if (group.length === 0) group = context.defaultGroup;
  validateGroup(group);

  return {
    namespace: scope.namespace,
    clan: scope.clan,
    group,
    id,
    canonical: joinCanonical(scope.namespace, scope.clan, group, id),
    exists: false,
  };
}

function resolveObjectEntryId(
  input: NonNullable<Exclude<EntryIdInput, string>>,
  scope: TranslationScope,
  context: EntryIdCatalogContext,
): ResolvedEntryId {
  const namespace = input.namespace ?? scope.namespace;
  const clan = input.clan ?? scope.clan;
  const group =
    input.group && input.group.length > 0
      ? input.group
      : scope.group && scope.group.length > 0
        ? scope.group
        : context.defaultGroup;
  if (namespace !== scope.namespace || clan !== scope.clan) {
    throw new CliffScopeMismatchError(
      input.id,
      scope,
      `${scope.namespace}.${scope.clan}.<group>.<id>`,
    );
  }
  if (!isName(input.id)) {
    throw new CliffScopeError(`entry id "${input.id}" is not a valid CLIFF name`);
  }
  validateGroup(group);
  const canonical = joinCanonical(namespace, clan, group, input.id);
  const record = context.recordForCanonical(canonical);
  if (record !== undefined) return partsOfRecord(record);
  return {
    namespace,
    clan,
    group,
    id: input.id,
    canonical,
    exists: context.hasCanonical(canonical),
  };
}

export function resolveEntryId(
  input: EntryIdInput,
  scope: TranslationScope,
  context: EntryIdCatalogContext,
  strictEntryIds = true,
): ResolvedEntryId {
  assertScope(scope);

  if (typeof input !== "string") {
    return resolveObjectEntryId(input, scope, context);
  }

  const raw = applyAlias(input, context.aliases);
  const parsed = parseStringEntryId(raw);
  if (parsed.namespace !== undefined && parsed.namespace !== scope.namespace) {
    throw new CliffScopeMismatchError(raw, scope, `${scope.namespace}.${scope.clan}.<group>.<id>`);
  }

  const exact = new Map<string, MessageRecord>();
  const mismatched = new Map<string, MessageRecord>();
  for (const candidate of candidateEntryIds(parsed, scope)) {
    const record = context.recordForCanonical(candidate);
    if (record === undefined) continue;
    if (record.namespace !== scope.namespace || record.clan !== scope.clan) {
      mismatched.set(record.canonical, record);
    } else {
      exact.set(record.canonical, record);
    }
  }
  if (exact.size > 0) {
    return partsOfRecord([...exact.values()][0] as MessageRecord);
  }
  if (mismatched.size > 0) {
    throw new CliffScopeMismatchError(raw, scope, `${scope.namespace}.${scope.clan}.<group>.<id>`);
  }

  const suffix = parsed.segments.join(".");
  const suffixRecords = new Map<string, MessageRecord>();
  for (const canonical of context.suffixMatches(suffix)) {
    const record = context.recordForCanonical(canonical);
    if (record !== undefined) suffixRecords.set(record.canonical, record);
  }
  const inScope = [...suffixRecords.values()].filter(
    (record) => record.namespace === scope.namespace && record.clan === scope.clan,
  );
  if (inScope.length === 1) {
    return partsOfRecord(inScope[0] as MessageRecord);
  }
  if (inScope.length > 1) {
    const candidates = inScope.map((record) => record.canonical).sort();
    if (strictEntryIds) {
      throw new CliffAmbiguousEntryError(raw, candidates);
    }
    const chosen = chooseByGroup(inScope, scope);
    return {
      ...partsOfRecord(chosen),
      ambiguous: true,
      candidates,
    };
  }
  if (suffixRecords.size > 0) {
    throw new CliffScopeMismatchError(raw, scope, `${scope.namespace}.${scope.clan}.<group>.<id>`);
  }

  return parseAuthoringEntryId(parsed, scope, context);
}
