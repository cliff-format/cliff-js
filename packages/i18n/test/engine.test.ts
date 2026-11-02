import { parse } from "@cliff-format/core";
import {
  CliffI18nError,
  CliffMissingEntryError,
  CliffScopeError,
  createI18n,
  TYPE,
} from "@cliff-format/i18n";
import { describe, expect, it, vi } from "vitest";

const cliff = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: engine",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[ui]",
  "type: label",
  "emotion: [objective]",
  "",
  "<title>",
  'source: "Title"',
  'target: "标题"',
  "status: final",
  "",
  "<count>",
  'source: "{count, plural, one {# item} other {# items}}"',
  'target: "{count, plural, one {# 项} other {# 项}}"',
  "status: translated",
  "",
].join("\n");

function makeI18n(extra: Record<string, unknown> = {}) {
  return createI18n({
    locale: "zh-CN",
    sourceLanguage: "en-US",
    resources: [cliff],
    ...extra,
  });
}

describe("engine options and lifecycle", () => {
  it("validates locale input", () => {
    expect(() => createI18n({ locale: "" })).toThrow(CliffScopeError);
    expect(() => createI18n({ locale: "   " })).toThrow(CliffScopeError);
  });

  it("derives source language from documents", () => {
    const i18n = createI18n({ locale: "zh-CN", resources: [cliff] });
    expect(i18n.sourceLanguage).toBe("en-US");
    expect((i18n as unknown as { getSourceLanguage(): string }).getSourceLanguage()).toBe("en-US");
    expect(createI18n({ locale: "en-US" }).sourceLanguage).toBeUndefined();
    expect(() =>
      (
        createI18n({ locale: "en-US" }) as unknown as { getSourceLanguage(): string }
      ).getSourceLanguage(),
    ).toThrow(CliffI18nError);
  });

  it("changes locale once and notifies subscribers", () => {
    const i18n = makeI18n();
    const listener = vi.fn();
    const unsubscribe = i18n.subscribe(listener);
    const version = i18n.getVersion();

    i18n.changeLanguage("zh-CN");
    expect(listener).not.toHaveBeenCalled();
    i18n.changeLanguage("en-US");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(i18n.getVersion()).toBe(version + 1);
    expect(i18n.language).toBe("en-US");
    expect(() => i18n.setLocale("")).toThrow(CliffScopeError);

    unsubscribe();
    i18n.setLocale("zh-CN");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("adds documents and can validate without rejecting on add", () => {
    const i18n = createI18n({ locale: "zh-CN", sourceLanguage: "en-US" });
    const document = parse(cliff);
    const added = i18n.addDocument(document);
    expect(added.documents).toHaveLength(1);

    const tolerantI18n = createI18n({ locale: "zh-CN", sourceLanguage: "en-US" });
    const tolerant = tolerantI18n.add(cliff.replace("clan: engine", "clan: tolerant"), {
      tolerant: true,
    });
    expect(tolerant.documents).toHaveLength(1);

    const invalid =
      'CLIFF 1.1\nnamespace: demo\nclan: invalid\nsource-language: en-US\ntarget-language: en-US\n\n[ui]\ntype: label\n\n<bad>\nsource: "Bad"\nstatus: final\n';
    const invalidI18n = createI18n({ locale: "en-US", sourceLanguage: "en-US" });
    const result = invalidI18n.add(invalid, { validate: false });
    expect(result.issues.length).toBeGreaterThan(0);
    expect(invalidI18n.validate().length).toBeGreaterThan(0);
  });

  it("returns catalog views and entry IDs", () => {
    const i18n = makeI18n();
    expect(i18n.namespaces()).toEqual(["demo"]);
    expect(i18n.clans("demo")).toEqual(["engine"]);
    expect(i18n.groups({ namespace: "demo", clan: "engine" })).toEqual(["ui"]);
    expect(i18n.locales()).toEqual(["zh-CN"]);
    expect(i18n.entryIds({ namespace: "demo", clan: "engine" })).toEqual([
      "demo.engine.ui.count",
      "demo.engine.ui.title",
    ]);
    expect(i18n.has("title", { namespace: "demo", clan: "engine", group: "ui" })).toBe(true);
    expect(i18n.has("missing", { namespace: "demo", clan: "engine", group: "ui" })).toBe(false);
    expect(i18n.byStatus("final", { namespace: "demo", clan: "engine" })).toHaveLength(1);
    expect(i18n.statusCounts({ namespace: "demo", clan: "engine" })).toEqual({
      initial: 0,
      translated: 1,
      reviewed: 0,
      final: 1,
    });
  });
});

describe("engine diagnostics and fallbacks", () => {
  it("records and clears missing-entry diagnostics", () => {
    const i18n = makeI18n();
    const t = i18n.scope({ namespace: "demo", clan: "engine", group: "ui" }).t;
    expect(t("missing").render()).toBe("missing");
    expect(i18n.diagnostics()).toHaveLength(1);
    i18n.clearDiagnostics();
    expect(i18n.diagnostics()).toHaveLength(0);
  });

  it("supports each missing behavior", () => {
    const scope = { namespace: "demo", clan: "engine", group: "ui" };
    const empty = makeI18n({ missing: "empty" }).scope(scope).t;
    expect(empty("missing").render()).toBe("");
    const source = makeI18n({ missing: "source" }).scope(scope).t;
    expect(source("missing").source("Fallback").type(TYPE.label).render()).toBe("Fallback");
    const throwing = makeI18n({ missing: "throw" }).scope(scope).t;
    expect(() => throwing("missing").render()).toThrow(CliffMissingEntryError);
    const identifier = makeI18n({ missing: "entryId" }).scope(scope).t;
    expect(identifier("missing").render()).toBe("missing");
  });

  it("limits diagnostics and ignores listener failures", () => {
    const i18n = makeI18n({
      maxDiagnostics: 1,
      onDiagnostic: () => {
        throw new Error("listener failure");
      },
    });
    const t = i18n.scope({ namespace: "demo", clan: "engine", group: "ui" }).t;
    expect(t("first-missing").render()).toBe("first-missing");
    expect(t("second-missing").render()).toBe("second-missing");
    expect(i18n.diagnostics()).toHaveLength(1);
    expect(i18n.diagnostics()[0]?.entryId).toContain("second-missing");
  });

  it("survives ICU runtime failures", () => {
    const icu = {
      analyze: () => ({ dialect: "plain" as const, arguments: [], errors: [] }),
      format: () => {
        throw new Error("format failure");
      },
      formatToParts: () => {
        throw new Error("parts failure");
      },
    };
    const i18n = makeI18n({ icu });
    expect(i18n.format("text")).toBe("text");
    expect(i18n.formatToParts("text")).toEqual([{ type: "literal", value: "text" }]);
    expect(i18n.diagnostics().filter((item) => item.code === "icu-error")).toHaveLength(2);
  });

  it("formats with locale, currency and time zone options", () => {
    const i18n = makeI18n();
    expect(i18n.format("{n, number}", { n: 12 }, { locale: "en-US" })).toBe("12");
    expect(i18n.formatToParts("{n, number}", { n: 12 }, { locale: "en-US" })[0]?.type).toBe(
      "expression",
    );
  });
});
