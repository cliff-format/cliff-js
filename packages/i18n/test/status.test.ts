import {
  canTransitionStatus,
  createI18n,
  isStatusTag,
  isVariantTag,
  STATUS,
  TYPE,
  VARIANT,
} from "@cliff-format/i18n";
import { describe, expect, it } from "vitest";

const cliff = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: statuses",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[ui]",
  "type: label",
  "",
  "<draft>",
  'source: "Draft"',
  "status: initial",
  "",
  "<translated>",
  'source: "Translated"',
  'target: "已翻译"',
  "status: translated",
  "",
  "<reviewed>",
  'source: "Reviewed"',
  'target: "已审核"',
  "status: reviewed",
  "",
  "<final>",
  'source: "Final"',
  'target: "最终"',
  "status: final",
  "",
].join("\n");

function makeI18n() {
  return createI18n({
    locale: "zh-CN",
    sourceLanguage: "en-US",
    resources: [cliff],
  });
}

function scoped(i18n: ReturnType<typeof makeI18n>) {
  return i18n.scope({ namespace: "demo", clan: "statuses", group: "ui" }).t;
}

describe("fixed vocabularies", () => {
  it("exports enum-like constants and guards", () => {
    expect(STATUS.final).toBe("final");
    expect(VARIANT.glossary).toBe("glossary");
    expect(isStatusTag("reviewed")).toBe(true);
    expect(isStatusTag("Review")).toBe(false);
    expect(isVariantTag("glossary")).toBe(true);
  });

  it("exposes the status transition graph", () => {
    expect(canTransitionStatus("initial", "translated")).toBe(true);
    expect(canTransitionStatus("translated", "reviewed")).toBe(true);
    expect(canTransitionStatus("reviewed", "final")).toBe(true);
    expect(canTransitionStatus("initial", "final")).toBe(false);
    expect(canTransitionStatus("final", "translated")).toBe(true);
  });
});

describe("status queries", () => {
  it("counts and filters statuses", () => {
    const i18n = makeI18n();
    expect(i18n.statusCounts({ namespace: "demo", clan: "statuses" })).toEqual({
      initial: 1,
      translated: 1,
      reviewed: 1,
      final: 1,
    });
    expect(
      i18n.byStatus("reviewed", { namespace: "demo", clan: "statuses" }).map((record) => record.id),
    ).toEqual(["reviewed"]);
    expect(
      i18n
        .query({
          namespace: "demo",
          clan: "statuses",
          status: ["initial", "final"],
        })
        .map((record) => record.id),
    ).toEqual(["draft", "final"]);
    expect(
      i18n
        .query({ namespace: "demo", clan: "statuses", target: "present" })
        .map((record) => record.id),
    ).toEqual(["translated", "reviewed", "final"]);
  });

  it("returns untranslated entries by target presence or initial status", () => {
    const i18n = makeI18n();
    expect(
      i18n.untranslated({ namespace: "demo", clan: "statuses" }).map((record) => record.id),
    ).toEqual(["draft"]);
  });

  it("filters by locale", () => {
    const i18n = makeI18n();
    expect(i18n.query({ locale: "zh-CN" })).toHaveLength(4);
    expect(i18n.query({ locale: "en-US" })).toHaveLength(0);
  });
});

describe("automatic status reconciliation", () => {
  it("moves a reviewed entry back to translated when the target is reworked", () => {
    const i18n = makeI18n();
    const t = scoped(i18n);
    t("reviewed").source("Reviewed").type(TYPE.label).target("重新审核").commit();
    expect(t("reviewed").entry()?.status).toBe("translated");
  });

  it("moves a final entry back to translated when the source changes", () => {
    const i18n = makeI18n();
    const t = scoped(i18n);
    t("final").source("Final changed").type(TYPE.label).commit({ overwrite: true });
    expect(t("final").entry()?.status).toBe("translated");
    expect(t("final").entry()?.target).toBe("最终");
  });

  it("keeps an explicitly supplied status", () => {
    const i18n = makeI18n();
    const t = scoped(i18n);
    t("reviewed").source("Reviewed").type(TYPE.label).target("已审核").status("reviewed").commit();
    expect(t("reviewed").entry()?.status).toBe("reviewed");
  });

  it("creates a translated draft when a target is supplied", () => {
    const i18n = makeI18n();
    const t = scoped(i18n);
    t("new").source("New").type(TYPE.label).target("新").render();
    expect(t("new").entry()?.status).toBe("translated");
    expect(i18n.byStatus("translated", { clan: "statuses" }).map((record) => record.id)).toContain(
      "new",
    );
  });
});
