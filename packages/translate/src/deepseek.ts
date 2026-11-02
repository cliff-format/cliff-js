import { CliffTranslateError, DeepSeekConfigError, DeepSeekHttpError } from "./errors.js";
import type {
  DeepSeekClient,
  DeepSeekCompletion,
  DeepSeekMessage,
  DeepSeekOptions,
  DeepSeekRequestOptions,
  DeepSeekThinking,
  DeepSeekUsage,
  ResolvedDeepSeekConfig,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-flash";
const DEFAULT_TEMPERATURE = 1.3;
const DEFAULT_TOP_P = 1;
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;

function requirePositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DeepSeekConfigError(`${name} must be a positive number`);
  }
  return value;
}

function requireNonNegative(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DeepSeekConfigError(`${name} must be a non-negative integer`);
  }
  return value;
}

function thinkingBody(value: DeepSeekOptions["thinking"]): DeepSeekThinking {
  if (value === undefined || value === "off" || value === false) {
    return { type: "disabled" };
  }
  if (value === "on" || value === true) return { type: "enabled" };
  if (typeof value === "object" && (value.type === "enabled" || value.type === "disabled")) {
    return { ...value };
  }
  throw new DeepSeekConfigError("thinking must be 'off', 'on', false, true or a thinking object");
}

function hasHeader(headers: Readonly<Record<string, string>>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

function resolveConfig(options: DeepSeekOptions): ResolvedDeepSeekConfig {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = options.model ?? DEFAULT_MODEL;
  const apiKey = options.apiKey;
  const headers = { ...(options.headers ?? {}) };
  const requireApiKey = options.requireApiKey ?? true;
  const hasAuthorization = hasHeader(headers, "authorization");
  if (requireApiKey && (apiKey === undefined || apiKey.length === 0) && !hasAuthorization) {
    throw new DeepSeekConfigError(
      "DeepSeek API key is required; pass apiKey or an Authorization header (use a server-side proxy in the browser)",
    );
  }
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (fetchImpl === undefined) {
    throw new DeepSeekConfigError(
      "fetch is not available in this runtime; pass a fetch implementation",
    );
  }
  const endpointPath = options.endpointPath ?? "/chat/completions";
  if (!endpointPath.startsWith("/")) {
    throw new DeepSeekConfigError("endpointPath must start with '/'");
  }
  return {
    ...(apiKey === undefined ? {} : { apiKey }),
    baseUrl,
    model,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    topP: options.topP ?? DEFAULT_TOP_P,
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    thinking: thinkingBody(options.thinking),
    timeoutMs: requirePositive(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeoutMs"),
    maxRetries: requireNonNegative(options.maxRetries ?? DEFAULT_MAX_RETRIES, "maxRetries"),
    retryDelayMs: requireNonNegative(
      options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      "retryDelayMs",
    ),
    endpointPath,
    headers,
    fetch: fetchImpl as typeof fetch,
    requireApiKey,
  };
}

function usageFrom(raw: unknown): DeepSeekUsage {
  if (typeof raw !== "object" || raw === null) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const record = raw as Record<string, unknown>;
  const promptTokens = Number(record.prompt_tokens ?? 0);
  const completionTokens = Number(record.completion_tokens ?? 0);
  const totalTokens = Number(record.total_tokens ?? promptTokens + completionTokens);
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce(
  config: ResolvedDeepSeekConfig,
  messages: readonly DeepSeekMessage[],
  options: DeepSeekRequestOptions,
): Promise<DeepSeekCompletion> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };
  if (!hasHeader(headers, "authorization") && config.apiKey !== undefined) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const payload: Record<string, unknown> = {
    model: config.model,
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    temperature: options.temperature ?? config.temperature,
    top_p: config.topP,
    max_tokens: options.maxTokens ?? config.maxTokens,
    stream: false,
    thinking: config.thinking,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const onAbort = (): void => controller.abort();
  if (options.signal !== undefined) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    const response = await config.fetch(`${config.baseUrl}${config.endpointPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.status === 429 || response.status >= 500) {
      throw new DeepSeekHttpError(response.status, await response.text());
    }
    if (!response.ok) {
      throw new DeepSeekHttpError(response.status, await response.text());
    }
    const data = (await response.json()) as Record<string, unknown>;
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const first = choices[0];
    const message =
      typeof first === "object" && first !== null
        ? (first as Record<string, unknown>).message
        : undefined;
    const content =
      typeof message === "object" && message !== null
        ? (message as Record<string, unknown>).content
        : undefined;
    if (typeof content !== "string" || content.length === 0) {
      throw new CliffTranslateError("DeepSeek returned an empty or missing message.content");
    }
    const finishReason =
      typeof first === "object" && first !== null
        ? (first as Record<string, unknown>).finish_reason
        : undefined;
    return {
      text: content,
      model: typeof data.model === "string" ? data.model : config.model,
      ...(typeof finishReason === "string" ? { finishReason } : {}),
      usage: usageFrom(data.usage),
      attempts: 1,
    };
  } finally {
    clearTimeout(timer);
    if (options.signal !== undefined) {
      options.signal.removeEventListener("abort", onAbort);
    }
  }
}

export function createDeepSeekClient(options: DeepSeekOptions = {}): DeepSeekClient {
  const config = resolveConfig(options);
  return {
    config,
    async complete(messages, requestOptions = {}) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        try {
          const completion = await requestOnce(config, messages, requestOptions);
          return { ...completion, attempts: attempt };
        } catch (error) {
          lastError = error;
          const httpError = error instanceof DeepSeekHttpError ? error : undefined;
          const retryable =
            httpError === undefined || httpError.status === 429 || httpError.status >= 500;
          if (!retryable || attempt > config.maxRetries) break;
          const delay = config.retryDelayMs * 2 ** (attempt - 1);
          if (delay > 0) await sleep(delay);
        }
      }
      if (lastError instanceof Error) throw lastError;
      throw new CliffTranslateError(`DeepSeek request failed: ${String(lastError)}`);
    },
  };
}

export { DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_TEMPERATURE };
