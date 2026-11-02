import type { CliffEntry } from "@cliff-format/core";
import { STATUS_ORDER, type StatusTag } from "./types.js";
import { isStatusTag } from "./vocabulary.js";

export const STATUS_TRANSITIONS: Record<StatusTag, readonly StatusTag[]> = {
  initial: ["translated"],
  translated: ["reviewed", "translated"],
  reviewed: ["final", "translated"],
  final: ["translated"],
};

export function statusOf(entry: CliffEntry): StatusTag {
  const value = entry.status ?? "";
  return isStatusTag(value) ? value : "initial";
}

export function canTransitionStatus(from: StatusTag, to: StatusTag): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export interface StatusContext {
  source?: string;
  target?: string;
  explicit?: StatusTag;
}

/**
 * Return the status a write should leave on an entry.
 * An explicit status wins. Otherwise a missing target is initial, and a changed
 * source or reworked reviewed/final target returns to translated.
 */
export function reconcileEntryStatus(entry: CliffEntry, previous: StatusContext = {}): StatusTag {
  if (previous.explicit !== undefined) return previous.explicit;
  const current = statusOf(entry);
  if (entry.target === undefined) return "initial";
  if (current === "initial") return "translated";

  const sourceChanged = previous.source !== undefined && previous.source !== entry.source;
  if (sourceChanged) return "translated";

  const targetChanged = previous.target !== undefined && previous.target !== entry.target;
  if (targetChanged && (current === "reviewed" || current === "final")) {
    return "translated";
  }
  return current;
}

export function nextStatuses(status: StatusTag): readonly StatusTag[] {
  return STATUS_TRANSITIONS[status];
}

export function statusOrder(): readonly StatusTag[] {
  return STATUS_ORDER;
}
