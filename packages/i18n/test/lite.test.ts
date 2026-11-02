import { argumentNames, createI18n, createLiteIcu, detectDialect } from "@cliff-format/i18n/lite";
import { describe, expect, it } from "vitest";

const cliff = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: lite",
  "source-language: en-US",
  "target-language: en-US",
  "",
  "[ui]",
  "type: label",
  "",
  "<hello>",
  'source: "Hello {name}"',
  'target: "Hi {name}"',
  "status: final",
  "",
].join("\n");

describe("lite ICU runtime", () => {
  it("renders simple placeholders and literal parts", () => {
    const i18n = createI18n({
      locale: "en-US",
      sourceLanguage: "en-US",
      resources: [cliff],
    });
    const t = i18n.scope({ namespace: "demo", clan: "lite", group: "ui" }).t;

    expect(t("hello").render({ name: "Ada" })).toBe("Hi Ada");
    expect(t("hello", { name: "Ada" })).toBe("Hi Ada");
    expect(t("hello").renderToParts({ name: "Ada" })).toEqual([
      { type: "literal", value: "Hi " },
      { type: "expression", source: "{name}", value: "Ada" },
    ]);
  });

  it("reports missing placeholders and complex ICU as diagnostics", () => {
    const i18n = createI18n({
      locale: "en-US",
      sourceLanguage: "en-US",
      resources: [cliff],
    });
    const t = i18n.scope({ namespace: "demo", clan: "lite", group: "ui" }).t;

    expect(t("hello").render()).toBe("Hi {name}");
    expect(i18n.diagnostics().some((item) => item.code === "icu-error")).toBe(true);

    expect(i18n.format("{count, plural, one {# item} other {# items}}", { count: 2 })).toBe(
      "{count, plural, one {# item} other {# items}}",
    );
    expect(i18n.formatToParts("plain text")).toEqual([{ type: "literal", value: "plain text" }]);
  });

  it("analyzes plain and complex messages", () => {
    const icu = createLiteIcu();
    expect(icu.analyze("Hello {name}")).toEqual({
      dialect: "mf1",
      arguments: ["name"],
      errors: [],
    });
    expect(icu.analyze("{count, plural, one {#} other {#}}").errors[0]?.type).toBe(
      "icu-unsupported",
    );
    expect(icu.analyze("plain").dialect).toBe("plain");
  });

  it("detects dialects and argument names", () => {
    expect(detectDialect("plain text")).toBe("plain");
    expect(detectDialect("{name}")).toBe("mf1");
    expect(detectDialect("{count, plural, one {#} other {#}}")).toBe("mf1");
    expect(detectDialect("{$name}")).toBe("mf2");
    expect(detectDialect("{{name}}")).toBe("mf2");
    expect(detectDialect("{#bold}")).toBe("mf2");
    expect(detectDialect(".input {$name}")).toBe("mf2");

    expect(argumentNames("{$name} {$name}", "mf2")).toEqual(["name"]);
    expect(argumentNames("{count, plural, one {#} other {#}} {name}", "mf1")).toEqual([
      "count",
      "name",
    ]);
    expect(argumentNames("plain", "plain")).toEqual([]);
  });

  it("handles adjacent and missing expressions in parts", () => {
    const icu = createLiteIcu();
    expect(icu.formatToParts("{a}{b}", "en", { a: 1, b: 2 }).parts).toEqual([
      { type: "expression", source: "{a}", value: "1" },
      { type: "expression", source: "{b}", value: "2" },
    ]);
    expect(icu.formatToParts("{missing}", "en", {}).parts[0]).toEqual({
      type: "expression",
      source: "{missing}",
      value: "{missing}",
    });
    expect(icu.formatToParts("", "en", {}).parts).toEqual([{ type: "literal", value: "" }]);
    expect(icu.formatToParts("{count, plural, one {#} other {#}}", "en", {}).errors[0]?.type).toBe(
      "icu-unsupported",
    );
  });
});
