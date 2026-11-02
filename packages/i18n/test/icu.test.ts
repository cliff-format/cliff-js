import { createFullIcu, createLiteIcu, detectDialect } from "@cliff-format/i18n";
import { describe, expect, it } from "vitest";

describe("ICU dialect detection", () => {
  it("detects plain, MF1 and MF2", () => {
    expect(detectDialect("Hello")).toBe("plain");
    expect(detectDialect("{count, plural, other {# items}}")).toBe("mf1");
    expect(detectDialect(".input {$count :number} .match $count one {{one}} * {{# many}}")).toBe(
      "mf2",
    );
  });
});

describe("full ICU runtime", () => {
  const icu = createFullIcu();

  it("formats MF1 plural, select and number", () => {
    expect(
      icu.format("{count, plural, =0 {No messages} one {# message} other {# messages}}", "en", {
        count: 2,
      }).text,
    ).toBe("2 messages");
    expect(
      icu.format("{gender, select, female {She} male {He} other {They}} replied", "en", {
        gender: "female",
      }).text,
    ).toBe("She replied");
    expect(icu.format("Value: {value, number}", "en", { value: 1234.5 }).text).toBe(
      "Value: 1,234.5",
    );
  });

  it("formats MF2 match and expressions", () => {
    const message =
      ".input {$count :number} .match $count one {{one message}} * {{You have {$count} messages}}";
    expect(icu.format(message, "en", { count: 2 }).text).toBe("You have 2 messages");
  });

  it("returns structured markup parts", () => {
    const result = icu.formatToParts("{#b}Hello {/b}{$name}", "en", { name: "Bob" });
    expect(result.parts[0]).toEqual({ type: "markup", kind: "open", name: "b", source: "" });
    expect(result.parts[1]).toEqual({ type: "literal", value: "Hello " });
    expect(result.parts[2]).toEqual({ type: "markup", kind: "close", name: "b", source: "" });
    expect(result.parts[3]?.type).toBe("expression");
  });

  it("reports invalid ICU without throwing", () => {
    const result = icu.format("{count, plural, other {# items}", "en", { count: 1 });
    expect(result.text).toBe("{count, plural, other {# items}");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("exposes arguments from analysis", () => {
    expect(icu.analyze("{count, plural, other {# items}}").arguments).toEqual(["count"]);
    expect(icu.analyze("Hello {$name}").arguments).toEqual(["name"]);
  });
});

describe("lite ICU runtime", () => {
  const icu = createLiteIcu();

  it("formats simple placeholders", () => {
    expect(icu.format("Hello {name}", "en", { name: "Alice" }).text).toBe("Hello Alice");
  });

  it("refuses complex ICU explicitly", () => {
    const result = icu.format("{count, plural, other {# items}}", "en", { count: 1 });
    expect(result.text).toBe("{count, plural, other {# items}}");
    expect(result.errors[0]?.type).toBe("icu-unsupported");
  });
});
