import {
  type CliffDocument,
  CliffValidationError,
  type Correction,
  hasErrors,
  parse,
  parseTolerant,
  serialize,
  type ValidationIssue,
  validateDocument,
} from "@cliff-format/core";
import { createDeepSeekClient } from "./deepseek.js";
import {
  batchDocument,
  cloneDocument,
  type EntryLocation,
  extractCliff,
  mergeTargets,
  selectEntries,
} from "./document.js";
import {
  CliffTranslateError,
  TranslationParseError,
  TranslationValidationError,
} from "./errors.js";
import { buildTranslationMessages } from "./prompt.js";
import type {
  CliffSource,
  DeepSeekClient,
  DeepSeekCompletion,
  DeepSeekMessage,
  DeepSeekOptions,
  DeepSeekTranslator,
  DeepSeekUsage,
  TranslateOptions,
  TranslateProgress,
  TranslationResult,
} from "./types.js";

function isCliffDocument(resource: CliffSource): resource is CliffDocument {
  return typeof resource === "object" && resource !== null && !(resource instanceof Uint8Array);
}

function parseSource(resource: CliffSource): CliffDocument {
  if (isCliffDocument(resource)) return cloneDocument(resource);
  return parse(resource);
}

function parseGlossary(
  glossary: CliffSource | readonly CliffSource[] | undefined,
): CliffDocument[] {
  if (glossary === undefined) return [];
  const resources = Array.isArray(glossary) ? glossary : [glossary];
  return resources.map((resource) => {
    try {
      return isCliffDocument(resource) ? cloneDocument(resource) : parse(resource);
    } catch (error) {
      throw new CliffTranslateError("could not parse a reference glossary as CLIFF", {
        cause: error,
      });
    }
  });
}

function addUsage(left: DeepSeekUsage, right: DeepSeekUsage): DeepSeekUsage {
  return {
    promptTokens: left.promptTokens + right.promptTokens,
    completionTokens: left.completionTokens + right.completionTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

function emptyUsage(): DeepSeekUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function issueSummary(issues: readonly ValidationIssue[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => "line " + issue.line + ": " + issue.message)
    .join("; ");
}

function errorReason(error: unknown): string {
  if (error instanceof TranslationValidationError) return issueSummary(error.issues);
  if (error instanceof CliffValidationError) return issueSummary(error.issues);
  if (error instanceof Error) return error.message;
  return String(error);
}

function repairInstruction(error: unknown): string {
  return [
    "Your previous answer could not be accepted as a complete CLIFF document.",
    "Reason: " + errorReason(error),
    "Return the complete corrected CLIFF document only.",
    "Keep every namespace, clan, group path, entry id, field, source value and ICU construct",
    "exactly as it appears in the file to translate. Fill in target and set status: translated.",
    "Do not use Markdown code fences, JSON or commentary.",
  ].join("\n");
}

interface BatchOutcome {
  document: CliffDocument;
  corrections: Correction[];
  usage: DeepSeekUsage;
  raw: string;
}

async function completeBatch(
  client: DeepSeekClient,
  document: CliffDocument,
  promptOptions: Parameters<typeof buildTranslationMessages>[1],
  maxRepairAttempts: number,
  signal: AbortSignal | undefined,
  targetLanguage: string,
): Promise<BatchOutcome> {
  const baseMessages = buildTranslationMessages(document, promptOptions);
  let messages: DeepSeekMessage[] = baseMessages;
  let usage = emptyUsage();
  let raw = "";
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    const requestOptions = signal === undefined ? {} : { signal };
    const completion: DeepSeekCompletion = await client.complete(messages, requestOptions);
    usage = addUsage(usage, completion.usage);
    raw = completion.text;
    try {
      const extracted = extractCliff(raw);
      const parsed = parseTolerant(extracted);
      parsed.document.header.targetLanguage = targetLanguage;
      const issues = validateDocument(parsed.document);
      if (hasErrors(issues)) {
        throw new TranslationValidationError(issues, raw);
      }
      return {
        document: parsed.document,
        corrections: parsed.corrections,
        usage,
        raw,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxRepairAttempts) break;
      messages = [
        ...baseMessages,
        { role: "assistant", content: raw },
        { role: "user", content: repairInstruction(error) },
      ];
    }
  }

  if (lastError instanceof TranslationValidationError) throw lastError;
  if (lastError instanceof CliffValidationError) {
    throw new TranslationValidationError(lastError.issues, raw);
  }
  throw new TranslationParseError(
    "could not parse translated CLIFF after " + String(maxRepairAttempts + 1) + " attempt(s)",
    raw,
    { cause: lastError },
  );
}

export async function translateWithClient(
  client: DeepSeekClient,
  resource: CliffSource,
  options: TranslateOptions = {},
): Promise<TranslationResult> {
  const original = parseSource(resource);
  const targetLanguage = (options.targetLanguage ?? original.header.targetLanguage).trim();
  if (targetLanguage.length === 0) {
    throw new CliffTranslateError(
      "targetLanguage is required; set the CLIFF target-language header or pass options.targetLanguage",
    );
  }
  const sourceLanguage = original.header.sourceLanguage.trim();
  if (sourceLanguage.length === 0) {
    throw new CliffTranslateError("sourceLanguage is required by the CLIFF header");
  }
  const overwrite = options.overwrite ?? "initial";
  const status = options.status ?? "translated";
  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new CliffTranslateError("batchSize must be a positive integer");
  }
  const maxRepairAttempts = options.maxRepairAttempts ?? 1;
  if (!Number.isInteger(maxRepairAttempts) || maxRepairAttempts < 0) {
    throw new CliffTranslateError("maxRepairAttempts must be a non-negative integer");
  }

  const base = cloneDocument(original);
  base.header.targetLanguage = targetLanguage;
  const selected = selectEntries(base, overwrite);
  const glossaries = parseGlossary(options.glossary);

  if (selected.length === 0) {
    const issues = validateDocument(base);
    if (hasErrors(issues)) throw new TranslationValidationError(issues, serialize(base));
    return {
      document: base,
      cliff: serialize(base),
      issues,
      corrections: [],
      untranslated: [],
      structuralChanges: [],
      usage: emptyUsage(),
      batches: 0,
    };
  }

  const chunks = chunk(selected, batchSize);
  let result = base;
  let usage = emptyUsage();
  const corrections: Correction[] = [];
  const untranslated = new Set<string>();
  const structuralChanges = new Set<string>();

  for (let index = 0; index < chunks.length; index++) {
    const batch = chunks[index] as EntryLocation[];
    const documentForBatch = batchDocument(result, batch);
    const promptOptions = {
      targetLanguage,
      sourceLanguage,
      glossary: glossaries,
      ...(options.instructions === undefined ? {} : { instructions: options.instructions }),
    };
    const outcome = await completeBatch(
      client,
      documentForBatch,
      promptOptions,
      maxRepairAttempts,
      options.signal,
      targetLanguage,
    );
    const merged = mergeTargets(result, outcome.document, {
      overwrite,
      status,
      selected: batch,
    });
    result = merged.document;
    usage = addUsage(usage, outcome.usage);
    corrections.push(...merged.corrections);
    for (const key of merged.untranslated) untranslated.add(key);
    for (const change of merged.structuralChanges) structuralChanges.add(change);
    const progress: TranslateProgress = {
      batch: index + 1,
      totalBatches: chunks.length,
      entries: batch.length,
    };
    options.onProgress?.(progress);
  }

  const issues = validateDocument(result);
  if (hasErrors(issues)) {
    throw new TranslationValidationError(issues, serialize(result));
  }

  return {
    document: result,
    cliff: serialize(result),
    issues,
    corrections,
    untranslated: [...untranslated],
    structuralChanges: [...structuralChanges],
    usage,
    batches: chunks.length,
  };
}

export function createDeepSeekTranslator(options: DeepSeekOptions = {}): DeepSeekTranslator {
  const client = createDeepSeekClient(options);
  return {
    config: client.config,
    complete: (messages, requestOptions) => client.complete(messages, requestOptions),
    translate: (resource, translateOptions) =>
      translateWithClient(client, resource, translateOptions),
    translateDocument: (document, translateOptions) =>
      translateWithClient(client, document, translateOptions),
  };
}
