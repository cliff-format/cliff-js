import {
  CliffI18nError,
  CliffMissingMetadataError,
  createI18n,
  EMOTION,
  TYPE,
} from "@cliff-format/i18n";
import { describe, expect, it } from "vitest";

const cliff = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: builder",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[ui]",
  "type: label",
  "emotion: [objective]",
  "",
  "<item>",
  'source: "Item"',
  'target: "项目"',
  "status: reviewed",
  "max-width: 4",
  "",
  "<wide>",
  'source: "Wide"',
  'target: "宽"',
  "status: final",
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

function tFor(i18n: ReturnType<typeof makeI18n>) {
  return i18n.scope({ namespace: "demo", clan: "builder", group: "ui" }).t;
}

describe("builder methods", () => {
  it("rejects invalid method sequencing and tags", () => {
    const t = tFor(makeI18n());
    expect(() => (t("x") as unknown as { typeFromGroup(): unknown }).typeFromGroup()).toThrow(
      CliffI18nError,
    );
    expect(() =>
      (
        t("x").source("X").type(TYPE.label) as unknown as {
          typeFromGroup(): unknown;
        }
      ).typeFromGroup(),
    ).toThrow(CliffI18nError);
    expect(() => (t("x") as unknown as { source(value: unknown): unknown }).source(1)).toThrow(
      TypeError,
    );
    expect(() => t("x").maxWidth(0)).toThrow(TypeError);
    expect(() => t("x").extension("bad", "value")).toThrow(TypeError);
    expect(() => (t("x") as unknown as { type(value: string): unknown }).type("bad")).toThrow(
      TypeError,
    );
    expect(() => (t("x") as unknown as { status(value: string): unknown }).status("bad")).toThrow(
      TypeError,
    );
    expect(() => (t("x") as unknown as { emotion(value: string): unknown }).emotion("bad")).toThrow(
      TypeError,
    );
  });

  it("carries authoring metadata into the draft", () => {
    const i18n = makeI18n();
    const t = tFor(i18n);
    const builder = t("combo")
      .source("Combo")
      .type(TYPE.label)
      .target("组合")
      .status("reviewed")
      .context("A combo.")
      .maxWidth(20)
      .reference("ui.md")
      .reviewer("Ada")
      .extension("x-owner", "localization")
      .locale("zh-CN")
      .params({ a: "b" })
      .count(3);

    expect(builder.render()).toBe("组合");
    expect(builder.toString()).toBe("组合");
    expect(builder.width()).toBe(4);
    expect(builder.fits()).toBe(true);
    expect(builder.renderToParts()).toEqual([{ type: "literal", value: "组合" }]);
    expect(builder.meta()).toMatchObject({
      entryId: "demo.builder.ui.combo",
      source: "Combo",
      target: "组合",
      type: "label",
      status: "reviewed",
      context: "A combo.",
      maxWidth: 20,
      reference: ["ui.md"],
      reviewer: "Ada",
      extensions: { "x-owner": "localization" },
    });
    expect(builder.entry()?.source).toBe("Combo");
    expect(t("combo").entry()?.status).toBe("reviewed");
    expect(t.has("combo")).toBe(true);
    expect(t.entry("combo")?.source).toBe("Combo");
    expect(t.meta("combo")?.entryId).toBe("demo.builder.ui.combo");
    expect(t.entryIds()).toContain("demo.builder.ui.combo");
  });

  it("commits new drafts and overwrites existing entries", () => {
    const i18n = makeI18n();
    const t = tFor(i18n);
    t("new").source("New").type(TYPE.label).target("新").commit();
    expect(t("new").entry()?.status).toBe("translated");

    t("new")
      .source("New source")
      .type(TYPE.noun)
      .target("新目标")
      .status("reviewed")
      .emotion(EMOTION.objective)
      .context("Updated.")
      .maxWidth(30)
      .reference("new.md")
      .reviewer("Bob")
      .extension("x-owner", "team")
      .commit({ overwrite: true });

    const entry = t("new").entry();
    expect(entry?.source).toBe("New source");
    expect(entry?.target).toBe("新目标");
    expect(entry?.type).toBe("noun");
    expect(entry?.emotion).toEqual(["objective"]);
    expect(entry?.context).toBe("Updated.");
    expect(entry?.maxWidth).toBe(30);
    expect(entry?.reference).toEqual(["new.md"]);
    expect(entry?.reviewer).toBe("Bob");
    expect(entry?.extensions).toEqual({ "x-owner": "team" });
    expect(entry?.status).toBe("reviewed");
  });

  it("requires source, type, emotion and target where configured", () => {
    const strict = makeI18n({ requireEmotion: [TYPE.label] });
    const t = strict.scope({ namespace: "demo", clan: "builder", group: "empty" }).t;
    expect(() => t("no-emotion").source("No emotion").type(TYPE.label).render()).toThrow(
      CliffMissingMetadataError,
    );
    expect(t("noun-emotion").source("Noun").type(TYPE.noun).render()).toBe("Noun");

    const plain = makeI18n();
    const p = tFor(plain);
    expect(() =>
      (p("no-type").source("No type") as unknown as { render(): string }).render(),
    ).toThrow(CliffMissingMetadataError);
    expect(() =>
      p("no-target").source("No target").type(TYPE.label).status("reviewed").render(),
    ).toThrow(CliffMissingMetadataError);
  });

  it("checks width with warn, error and off policies", () => {
    const warn = makeI18n();
    const tw = tFor(warn);
    expect(tw("item").maxWidth(2).render()).toBe("项目");
    expect(warn.diagnostics().some((item) => item.code === "width-exceeded")).toBe(true);

    const error = makeI18n({ enforceMaxWidth: "error" });
    const te = tFor(error);
    expect(() => te("item").maxWidth(2).render()).toThrow(CliffI18nError);

    const off = makeI18n({ enforceMaxWidth: "off" });
    const to = tFor(off);
    expect(to("item").maxWidth(2).render()).toBe("项目");
    expect(off.diagnostics().some((item) => item.code === "width-exceeded")).toBe(false);
  });

  it("reports expectation mismatches and missing parts", () => {
    const i18n = makeI18n();
    const t = tFor(i18n);
    expect(t("item").source("Different").type(TYPE.noun).emotion(EMOTION.urgent).render()).toBe(
      "项目",
    );
    expect(i18n.diagnostics().map((item) => item.code)).toEqual(
      expect.arrayContaining(["source-mismatch", "type-mismatch", "emotion-mismatch"]),
    );
    expect(t("missing").renderToParts()).toEqual([{ type: "literal", value: "missing" }]);
    expect(t("missing").fits()).toBe(true);
  });
});
