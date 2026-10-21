import { describe, expect, it } from "vitest";
import {
  CliffParseError,
  CliffValidationError,
  createDocument,
  parse,
  parseTolerant,
  serialize,
  validate,
  validateDocument,
} from "../src/index.js";

const base = `CLIFF 1.1
namespace: demo
clan: settings
source-language: en-US
target-language: zh-CN

[Video]
type: label

<Resolution>
source: "Resolution"
target: "分辨率"
status: final
`;

describe("parser coverage", () => {
  it("covers invalid scalar values", () => {
    for (const replacement of [
      'namespace: "demo"',
      "source-language: en_US",
      "max-width: 0",
      'type: "label"',
      "emotion: objective",
      "emotion: []",
      "reference: [foo]",
      'source: "tab\there"',
      'source: "a\\q"',
    ]) {
      const text = base
        .replace("namespace: demo", replacement)
        .replace("source-language: en-US", replacement)
        .replace("status: final", replacement)
        .replace("type: label", replacement);
      expect(() => parse(text), replacement).toThrow(CliffParseError);
    }
  });

  it("covers header/group scope errors", () => {
    expect(() => parse(base.replace("type: label", "namespace: other"))).toThrow(CliffParseError);
    expect(() => parse(base.replace("[Video]", '[Video]\n\n[x]\nsource: "x"'))).toThrow(
      CliffParseError,
    );
  });

  it("covers tolerant normalization and quoted keys with equals", () => {
    const result = parseTolerant(
      base
        .replace("namespace: demo", "namespace: Demo Name")
        .replace("[Video]", "[Video Setup & Audio]")
        .replace("type: label", '"type" = label')
        .replace("status: final", "'status' = final"),
    );
    expect(result.document.header.namespace).toBe("Demo-Name");
    expect(result.document.groups[0]?.path).toBe("Video-Setup-Audio");
    expect(result.corrections.length).toBeGreaterThan(0);
  });

  it("covers tolerant markup and unsupported versions", () => {
    expect(() => parseTolerant(base + "\n</terms>\n")).toThrow(CliffParseError);
    expect(() => parseTolerant(base.replace("CLIFF 1.1", "CLIFF 1.2"))).toThrow(CliffParseError);
  });

  it("covers list limits and duplicate canonical ids", () => {
    expect(() =>
      parse(base.replace("type: label", "type: label\nemotion: [objective, calm]"), {
        maxListItems: 1,
      }),
    ).toThrow(CliffParseError);
    const duplicate =
      base + '\n[Video]\ntype: label\n\n<Resolution>\nsource: "B"\nstatus: initial\n';
    expect(validate(duplicate).some((item) => item.category === "id")).toBe(true);
  });
});

describe("validator coverage", () => {
  it("reports header and metadata errors", () => {
    const document = createDocument();
    document.header.namespace = "bad name";
    document.header.clan = "bad name";
    document.header.sourceLanguage = "en_US";
    document.header.targetLanguage = "zh-CN";
    document.header.variant = "weird";
    document.header.extensions = { bad: "x" } as Record<string, string>;
    document.groups.push({
      path: "bad path",
      line: 1,
      type: "invalid",
      emotion: ["invalid"],
      maxWidth: 0,
      entries: [
        {
          id: "bad id",
          line: 2,
          type: "invalid",
          emotion: ["invalid"],
          status: "done",
          maxWidth: -1,
          reference: [],
          extensions: { bad: "x" },
        },
      ],
      extensions: { bad: "x" },
    });
    const issues = validateDocument(document);
    expect(issues.some((item) => item.category === "id")).toBe(true);
    expect(issues.some((item) => item.category === "vocabulary")).toBe(true);
    expect(issues.some((item) => item.category === "semantic")).toBe(true);
  });

  it("reports duplicate entry and canonical ids", () => {
    const text = base + '\n<Resolution>\nsource: "B"\nstatus: initial\n';
    const issues = validate(text);
    expect(issues.some((item) => item.message.includes("duplicate entry id"))).toBe(true);
    expect(issues.some((item) => item.message.includes("duplicate canonical id"))).toBe(true);
  });

  it("reports glossary target warning and extension warnings", () => {
    const text = base
      .replace("target-language: zh-CN", "target-language: zh-CN\nvariant: glossary")
      .replace('source: "Resolution"\ntarget: "分辨率"', 'source: "Resolution"')
      .replace("target-language: zh-CN", "target-language: zh-CN")
      .replace("type: label", 'type: label\nx-g: "g"');
    const issues = validate(text);
    expect(issues.some((item) => item.message.includes("glossary entry is missing target"))).toBe(
      true,
    );
    expect(issues.some((item) => item.category === "extension")).toBe(true);
  });

  it("reports flat layout mismatch and style", () => {
    const issues = validate(base, { path: "/project/settings.ja-JP.cliff" });
    expect(issues.some((item) => item.message.includes("flat layout mismatch"))).toBe(true);
    expect(validate(base, { style: true }).some((item) => item.category === "style")).toBe(false);
    expect(
      validate(base.replace("[Video]", "[Video_Setup]"), { style: true }).some(
        (item) => item.category === "style",
      ),
    ).toBe(true);
  });

  it("covers serializer extension errors", () => {
    const document = parse(base);
    document.header.extensions = { "bad key": "x" } as Record<string, string>;
    expect(() => serialize(document)).toThrow();
    const document2 = parse(base);
    document2.header.extensions = { "x-a": "line\nbreak" } as Record<string, string>;
    expect(() => serialize(document2)).toThrow();
  });
});
describe("extra branch coverage", () => {
  it("covers extension scopes and validation error construction", () => {
    const header = parse(base.replace("target-language: zh-CN", "target-language: zh-CN\nx-h: 1"));
    expect(header.header.extensions["x-h"]).toBe("1");
    const group = parse(base.replace("type: label", "type: label\nx-g: 1"));
    expect(group.groups[0]?.extensions["x-g"]).toBe("1");
    const entry = parse(base.replace("status: final", "status: final\nx-e: 1"));
    expect(entry.groups[0]?.entries[0]?.extensions["x-e"]).toBe("1");
    expect(new CliffValidationError([]).message).toBe("CLIFF validation failed");
  });
});
