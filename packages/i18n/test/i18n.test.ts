import { parse } from "@cliff-format/core";
import {
  CliffDuplicateEntryError,
  CliffMissingMetadataError,
  CliffScopeMismatchError,
  createI18n,
  EMOTION,
  TYPE,
} from "@cliff-format/i18n";
import { describe, expect, it, vi } from "vitest";

const settingsZh = `CLIFF 1.1
namespace: demo
clan: settings
source-language: en-US
target-language: zh-CN

[video]
type: label
emotion: [objective]
max-width: 12

<resolution>
source: "Resolution"
target: "分辨率"
type: noun
status: final

<brightness>
source: "Brightness"
target: "亮度"
status: reviewed
context: "Video settings screen."

[video.advanced]
type: label

<gamma>
source: "Gamma"
target: "伽马"
status: final
`;

const marketingZh = `CLIFF 1.1
namespace: demo
clan: marketing
source-language: en-US
target-language: zh-CN

[home]
type: label

<hero-title>
source: "The localization format built for translators"
target: "为翻译者而生的本地化格式"
status: final
`;

const settingsEn = `CLIFF 1.1
namespace: demo
clan: settings
source-language: en-US
target-language: en-US

[video]
type: label

<resolution>
source: "Resolution"
target: "Resolution"
status: final
`;

function makeI18n(extra: Partial<Parameters<typeof createI18n>[0]> = {}) {
  return createI18n({
    locale: "zh-CN",
    fallbackLocale: "en-US",
    resources: [settingsZh, marketingZh, settingsEn],
    sourceLanguage: "en-US",
    ...extra,
  });
}

function tFor(i18n: ReturnType<typeof makeI18n>, group?: string) {
  return i18n.scope({ namespace: "demo", clan: "settings", ...(group ? { group } : {}) }).t;
}

describe("CLIFF entry ID resolution", () => {
  it("accepts colon, dot, slash and scoped short entry IDs", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    expect(t("resolution").render()).toBe("分辨率");
    expect(t("demo:settings.video.resolution").render()).toBe("分辨率");
    expect(t("demo.settings.video.resolution").render()).toBe("分辨率");
    expect(t("demo/settings/video/resolution").render()).toBe("分辨率");
    expect(t("settings.video.resolution").render()).toBe("分辨率");
    expect(t("video.resolution").render()).toBe("分辨率");
    expect(t("resolution", {})).toBe("分辨率");
  });

  it("supports group-prefixed entry IDs", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    expect(t("advanced.gamma").render()).toBe("伽马");
  });

  it("supports aliases", () => {
    const i18n = makeI18n({
      aliases: { "home-title": "demo:marketing.home.hero-title" },
    });
    const t = i18n.scope({ namespace: "demo", clan: "marketing" }).t;
    expect(t("home-title").render()).toBe("为翻译者而生的本地化格式");
  });

  it("rejects a full entry ID that points outside the scope", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    expect(() => t("demo:marketing.home.hero-title").render()).toThrow(CliffScopeMismatchError);
  });

  it("returns the input for a missing entry and records a diagnostic", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    expect(t("missing-entry").render()).toBe("missing-entry");
    expect(i18n.diagnostics().some((diagnostic) => diagnostic.code === "missing-entry")).toBe(true);
  });
});

describe("catalog and locale behavior", () => {
  it("falls back to the source-language document", () => {
    const i18n = makeI18n();
    i18n.setLocale("fr-FR");
    const t = tFor(i18n, "video");
    expect(t("resolution").render()).toBe("Resolution");
  });

  it("notifies subscribers when the locale changes", () => {
    const i18n = makeI18n();
    const listener = vi.fn();
    const unsubscribe = i18n.subscribe(listener);
    i18n.setLocale("en-US");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    i18n.setLocale("zh-CN");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("exports CLIFF and records file paths as runtime metadata", () => {
    const i18n = makeI18n();
    const files = i18n.files();
    expect(files).toHaveLength(3);
    expect(files.map((file) => file.filePath).sort()).toEqual([
      "en-US/settings.cliff",
      "zh-CN/marketing.cliff",
      "zh-CN/settings.cliff",
    ]);
    expect(files[0]?.text.startsWith("CLIFF 1.1")).toBe(true);
    expect(() => i18n.toCliff()).toThrow(/use files\(\)/);
  });

  it("rejects duplicate canonical ids in the same locale", () => {
    const i18n = makeI18n();
    expect(() => i18n.add(settingsZh)).toThrow(CliffDuplicateEntryError);
  });

  it("reports a canonical CLIFF round trip", () => {
    const i18n = createI18n({
      locale: "zh-CN",
      resources: [settingsZh],
      sourceLanguage: "en-US",
    });
    const text = i18n.toCliff();
    const document = parse(text);
    expect(document.header.clan).toBe("settings");
    expect(document.groups[0]?.entries[0]?.id).toBe("resolution");
    expect(text).toContain('source: "Resolution"');
    expect(text).not.toContain("path:");
  });
});

describe("authoring builder", () => {
  it("creates a valid CLIFF draft from source and type", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    const value = t("contrast").source("Contrast").type(TYPE.noun).render();
    expect(value).toBe("Contrast");
    const entry = t("contrast").entry();
    expect(entry?.source).toBe("Contrast");
    expect(entry?.type).toBe("noun");
    expect(entry?.status).toBe("initial");
    const file = i18n
      .files()
      .find((candidate) => candidate.locale === "zh-CN" && candidate.clan === "settings");
    expect(file?.text).toContain("<contrast>");
    expect(file?.text).toContain("status: initial");
  });

  it("supports typeFromGroup and leaves entry.type unset", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    t("sharpness").source("Sharpness").typeFromGroup().render();
    const document = parse(
      i18n.files().find((file) => file.clan === "settings" && file.locale === "zh-CN")!.text,
    );
    const group = document.groups.find((candidate) => candidate.path === "video");
    const entry = group?.entries.find((candidate) => candidate.id === "sharpness");
    expect(group?.type).toBe("label");
    expect(entry?.type).toBeUndefined();
  });

  it("rejects typeFromGroup when the group has no type", () => {
    const i18n = makeI18n();
    const t = i18n.scope({ namespace: "demo", clan: "settings", group: "no-type-group" }).t;
    expect(() => t("orphan").source("Orphan").typeFromGroup().render()).toThrow(
      CliffMissingMetadataError,
    );
  });

  it("throws at runtime when source is provided without type", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    const builder = t("no-type").source("No type") as unknown as { render(): string };
    expect(() => builder.render()).toThrow(CliffMissingMetadataError);
  });

  it("requires emotion when the project enables requireEmotion", () => {
    const i18n = makeI18n({ requireEmotion: true });
    const t = i18n.scope({ namespace: "demo", clan: "settings", group: "strict-group" }).t;
    expect(() => t("strict").source("Strict").type(TYPE.label).render()).toThrow(
      CliffMissingMetadataError,
    );
    expect(t("strict").source("Strict").type(TYPE.label).emotion(EMOTION.objective).render()).toBe(
      "Strict",
    );
  });

  it("formats ICU through the instance API", () => {
    const i18n = makeI18n();
    expect(i18n.format("{count, plural, one {# item} other {# items}}", { count: 2 })).toBe(
      "2 items",
    );
    expect(i18n.formatToParts("Hello {$name}", { name: "Alice" })[0]?.type).toBe("literal");
  });

  it("checks max-width on the rendered text", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    expect(t("resolution").fits()).toBe(true);
    expect(t("resolution").maxWidth(2).fits()).toBe(false);
    expect(i18n.diagnostics().some((diagnostic) => diagnostic.code === "width-exceeded")).toBe(
      true,
    );
  });

  it("uses expectation diagnostics instead of mutating existing entries", () => {
    const i18n = makeI18n();
    const t = tFor(i18n, "video");
    expect(t("resolution").type(TYPE.label).render()).toBe("分辨率");
    expect(t("resolution").meta().type).toBe("noun");
    expect(i18n.diagnostics().some((diagnostic) => diagnostic.code === "type-mismatch")).toBe(true);
  });
});
