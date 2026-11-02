import type { CliffDocument, Correction, ValidationIssue } from "@cliff-format/core";

export type CliffSource = string | Uint8Array | CliffDocument;

export type StatusTag = "initial" | "translated" | "reviewed" | "final";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DeepSeekThinking {
  type: "enabled" | "disabled";
  effort?: string;
}

export interface DeepSeekOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  thinking?: "off" | "on" | false | true | DeepSeekThinking;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  endpointPath?: string;
  headers?: Readonly<Record<string, string>>;
  fetch?: typeof fetch;
  requireApiKey?: boolean;
}

export interface ResolvedDeepSeekConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  thinking: DeepSeekThinking;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  endpointPath: string;
  headers: Readonly<Record<string, string>>;
  fetch: typeof fetch;
  requireApiKey: boolean;
}

export interface DeepSeekCompletion {
  text: string;
  model: string;
  finishReason?: string;
  usage: DeepSeekUsage;
  attempts: number;
}

export interface DeepSeekRequestOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export interface DeepSeekClient {
  readonly config: ResolvedDeepSeekConfig;
  complete(
    messages: readonly DeepSeekMessage[],
    options?: DeepSeekRequestOptions,
  ): Promise<DeepSeekCompletion>;
}

export type OverwriteMode = "initial" | "all" | "none";

export interface TranslateProgress {
  batch: number;
  totalBatches: number;
  entries: number;
}

export interface TranslateOptions {
  targetLanguage?: string;
  instructions?: string;
  glossary?: CliffSource | readonly CliffSource[];
  overwrite?: OverwriteMode;
  batchSize?: number;
  status?: StatusTag;
  maxRepairAttempts?: number;
  signal?: AbortSignal;
  onProgress?: (progress: TranslateProgress) => void;
}

export interface TranslationResult {
  document: CliffDocument;
  cliff: string;
  issues: readonly ValidationIssue[];
  corrections: readonly Correction[];
  untranslated: readonly string[];
  structuralChanges: readonly string[];
  usage: DeepSeekUsage;
  batches: number;
}

export interface DeepSeekTranslator extends DeepSeekClient {
  translate(resource: CliffSource, options?: TranslateOptions): Promise<TranslationResult>;
  translateDocument(
    document: CliffDocument,
    options?: TranslateOptions,
  ): Promise<TranslationResult>;
}

export interface PromptOptions {
  targetLanguage: string;
  sourceLanguage: string;
  instructions?: string;
  glossary?: readonly CliffDocument[];
}

export interface MergedTranslation {
  document: CliffDocument;
  untranslated: string[];
  structuralChanges: string[];
  corrections: Correction[];
}

export interface ParseTranslationResult {
  document: CliffDocument;
  corrections: Correction[];
  issues: ValidationIssue[];
}

export const EMPTY_USAGE: DeepSeekUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};
