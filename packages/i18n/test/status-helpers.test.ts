import type { CliffEntry } from "@cliff-format/core";
import {
  assertEmotionTag,
  assertStatusTag,
  assertTypeTag,
  assertVariantTag,
  isEmotionTag,
  isTypeTag,
  nextStatuses,
  reconcileEntryStatus,
  statusOf,
  statusOrder,
} from "@cliff-format/i18n";
import { describe, expect, it } from "vitest";

function entry(extra: Partial<CliffEntry> = {}): CliffEntry {
  return { id: "item", line: 1, ...extra } as CliffEntry;
}

describe("status helpers", () => {
  it("normalizes missing and invalid statuses to initial", () => {
    expect(statusOf(entry())).toBe("initial");
    expect(statusOf(entry({ status: "bogus" }))).toBe("initial");
    expect(statusOf(entry({ status: "final" }))).toBe("final");
  });

  it("reconciles explicit, missing, changed and unchanged values", () => {
    expect(reconcileEntryStatus(entry(), { explicit: "reviewed" })).toBe("reviewed");
    expect(reconcileEntryStatus(entry())).toBe("initial");
    expect(reconcileEntryStatus(entry({ target: "x", status: "initial" }))).toBe("translated");
    expect(
      reconcileEntryStatus(entry({ source: "new", target: "x", status: "translated" }), {
        source: "old",
      }),
    ).toBe("translated");
    expect(
      reconcileEntryStatus(entry({ source: "same", target: "new", status: "reviewed" }), {
        source: "same",
        target: "old",
      }),
    ).toBe("translated");
    expect(
      reconcileEntryStatus(entry({ source: "same", target: "new", status: "final" }), {
        source: "same",
        target: "old",
      }),
    ).toBe("translated");
    expect(
      reconcileEntryStatus(entry({ source: "same", target: "same", status: "translated" }), {
        source: "same",
        target: "old",
      }),
    ).toBe("translated");
    expect(
      reconcileEntryStatus(entry({ source: "same", target: "same", status: "reviewed" }), {
        source: "same",
        target: "same",
      }),
    ).toBe("reviewed");
  });

  it("exposes the transition graph and order", () => {
    expect(nextStatuses("initial")).toEqual(["translated"]);
    expect(nextStatuses("final")).toEqual(["translated"]);
    expect(statusOrder()).toEqual(["initial", "translated", "reviewed", "final"]);
  });
});

describe("vocabulary guards", () => {
  it("accepts known tags and rejects unknown tags", () => {
    expect(isTypeTag("label")).toBe(true);
    expect(isTypeTag("bad")).toBe(false);
    expect(isEmotionTag("objective")).toBe(true);
    expect(isEmotionTag("bad")).toBe(false);
    expect(assertTypeTag("label")).toBe("label");
    expect(assertEmotionTag("objective")).toBe("objective");
    expect(assertStatusTag("final")).toBe("final");
    expect(assertVariantTag("glossary")).toBe("glossary");
    expect(() => assertTypeTag("bad")).toThrow(TypeError);
    expect(() => assertEmotionTag("bad")).toThrow(TypeError);
    expect(() => assertStatusTag("bad")).toThrow(TypeError);
    expect(() => assertVariantTag("bad")).toThrow(TypeError);
  });
});
