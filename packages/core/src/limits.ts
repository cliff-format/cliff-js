import { CliffLimitError } from "./errors.js";

export interface ResourceLimits {
  maxBytes?: number;
  maxLines?: number;
  maxLineLength?: number;
  maxStringLength?: number;
  maxGroupSegments?: number;
  maxListItems?: number;
  maxEntries?: number;
}

export const DEFAULT_LIMITS: Required<ResourceLimits> = {
  maxBytes: 16 * 1024 * 1024,
  maxLines: 1_000_000,
  maxLineLength: 1_048_576,
  maxStringLength: 1_048_576,
  maxGroupSegments: 64,
  maxListItems: 10_000,
  maxEntries: 1_000_000,
};

export type ResolvedLimits = Required<ResourceLimits>;

export function resolveLimits(limits: ResourceLimits = {}): ResolvedLimits {
  const resolved = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(DEFAULT_LIMITS) as (keyof ResourceLimits)[]) {
    const value = limits[key];
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`limit '${key}' must be a positive safe integer`);
    }
    resolved[key] = value;
  }
  return resolved;
}

export function limitError(
  limit: keyof ResourceLimits,
  observed: number,
  message: string,
  line = 0,
  text = "",
): CliffLimitError {
  return new CliffLimitError(message, { limit, observed, line, text });
}
