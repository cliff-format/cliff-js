import { describe, expect, it } from "vitest";
import {
  CliffLimitError,
  CliffParseError,
  createDocument,
  parse,
  parseTolerant,
  serialize,
  UnsupportedSpecVersion,
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

function withEntry(extra: string): string {
  return base.replace("status: final", "status: final\n" + extra);
}

describe("strict parser errors", () => {
  it("rejects unsupported and missing versions", () => {
    expect(() => parse(base.replace("CLIFF 1.1", "CLIFF 1.2"))).toThrow(UnsupportedSpecVersion);
    expect(() => parse(base.replace("CLIFF 1.1", "cliff 1.1"))).toThrow(CliffParseError);
    expect(() => parse("")).toThrow(CliffParseError);
  });

  it("rejects entries before sections and invalid paths", () => {
    expect(() => parse(base.replace("[Video]\ntype: label\n", ""))).toThrow(CliffParseError);
    expect(() => parse(base.replace("[Video]", "[Video..]"))).toThrow(CliffParseError);
  });

  it("rejects unknown and duplicate keys", () => {
    expect(() => parse(base.replace("type: label", "nickname: label"))).toThrow(CliffParseError);
    expect(() => parse(withEntry('source: "again"'))).toThrow(CliffParseError);
  });

  it("rejects malformed strings and lists", () => {
    expect(() => parse(base.replace('source: "Resolution"', 'source: "Resolution'))).toThrow(
      CliffParseError,
    );
    expect(() => parse(base.replace('source: "Resolution"', 'source: "a\\q"'))).toThrow(
      CliffParseError,
    );
    expect(() => parse(withEntry("emotion: []"))).toThrow(CliffParseError);
    expect(() => parse(withEntry("emotion: [objective"))).toThrow(CliffParseError);
    expect(() => parse(withEntry("emotion: [objective, [calm]]"))).toThrow(CliffParseError);
    expect(() => parse(withEntry("reference: []"))).not.toThrow();
  });

  it("rejects orphan and mismatched continuations", () => {
    expect(() => parse(base.replace("[Video]", '"orphan"\n[Video]'))).toThrow(CliffParseError);
    expect(() => parse(withEntry('source: "a"\n["b"]'))).toThrow(CliffParseError);
  });

  it("rejects invalid extensions and entry markers", () => {
    expect(() => parse(withEntry("x-engine: not a value"))).toThrow(CliffParseError);
    expect(() => parse(base.replace("<Resolution>", "<resolution"))).toThrow(CliffParseError);
  });

  it("enforces group and entry limits", () => {
    expect(() => parse(base, { maxGroupSegments: 1, maxEntries: 1 })).not.toThrow();
    expect(() => parse(base, { maxEntries: 0 })).toThrow(RangeError);
    const many = base.replace("[Video]", "[a.b.c]");
    expect(() => parse(many, { maxGroupSegments: 1 })).toThrow(CliffLimitError);
  });

  it("accepts bytes and BOM and rejects invalid UTF-8", () => {
    const bytes = new TextEncoder().encode("\uFEFF" + base.replace(/\n/g, "\r\n"));
    const document = parse(bytes);
    expect(document.header.namespace).toBe("demo");
    expect(() => parse(new Uint8Array([0xff, 0xfe, 0xfd]))).toThrow(CliffParseError);
  });
});

describe("serializer", () => {
  it("emits all optional fields and sorted extensions", () => {
    const document = parse(base);
    const header = document.header;
    header.version = "1.2.3";
    header.variant = "glossary";
    header.title = "Title";
    header.info = "Info";
    header.standard = "Standard";
    header.dependency = ["a", "b"];
    header.extensions = { "x-b": "2", "x-a": "1" } as Record<string, string>;
    const group = document.groups[0]!;
    group.context = "Context";
    group.emotion = ["objective"];
    group.maxWidth = 12;
    group.extensions = { "x-g": "g" } as Record<string, string>;
    const entry = group.entries[0]!;
    entry.context = "Entry context";
    entry.maxWidth = 8;
    entry.reference = ["src/a.ts:1"];
    entry.reviewer = "reviewer";
    entry.extensions = { "x-e": "e" } as Record<string, string>;
    const output = serialize(document);
    expect(output).toContain("variant: glossary");
    expect(output).toContain('title: "Title"');
    expect(output).toContain('dependency: ["a", "b"]');
    expect(output.indexOf("x-a:")).toBeLessThan(output.indexOf("x-b:"));
    expect(output).toContain('reference: ["src/a.ts:1"]');
    expect(serialize(document, { version: "1.0" }).startsWith("CLIFF 1.0\n")).toBe(true);
  });

  it("rejects unrepresentable values", () => {
    const document = parse(base);
    document.header.title = "bad\u0000";
    expect(() => serialize(document)).toThrow();
    const document2 = parse(base);
    document2.header.title = "bad\uD800";
    expect(() => serialize(document2)).toThrow();
  });
});

describe("tolerant edge cases", () => {
  it("handles quoted keys, version spelling, namespace normalization and duplicate sections", () => {
    const text = base
      .replace("CLIFF 1.1", "cliff 1.1.0")
      .replace("namespace: demo", '"namespace": Demo')
      .replace("[Video]", "[Video]\n\n[Video]")
      .replace("status: final", '"status": final');
    const result = parseTolerant(text);
    expect(result.document.specVersion).toBe("1.1");
    expect(result.document.header.namespace).toBe("Demo");
    expect(result.document.groups.map((group) => group.path)).toEqual(["Video", "Video-2"]);
    expect(result.corrections.map((item) => item.category)).toEqual(
      expect.arrayContaining(["version", "name-quote", "id-collision"]),
    );
  });

  it("supports list continuation through quoted brackets", () => {
    const text = base.replace(
      "target-language: zh-CN",
      'target-language: zh-CN\ndependency: ["a"]\n["b"]',
    );
    const result = parseTolerant(text);
    expect(result.document.header.dependency).toEqual(["a", "b"]);
  });

  it("can reject collisions instead of disambiguating", () => {
    const text = base + '\n<Resolution>\nsource: "again"\nstatus: initial\n';
    expect(() => parseTolerant(text, { onIdCollision: "error" })).toThrow(CliffParseError);
  });

  it("refuses repeated tags and quoted unknown keys", () => {
    expect(() => parseTolerant(withEntry("status: final"))).toThrow(CliffParseError);
    expect(() => parseTolerant(base.replace("status: final", '"translater": "x"'))).toThrow(
      CliffParseError,
    );
  });

  it("returns corrections through validate", () => {
    const issues = validate(base.replace("type: label", "type: label\nemotion: objective"), {
      tolerant: true,
    });
    expect(issues.some((item) => item.category === "correction")).toBe(true);
  });
});

describe("validator edge cases", () => {
  it("validates a hand-built model and style", () => {
    const document = createDocument();
    document.header.namespace = "Demo_Bad";
    document.header.clan = "settings";
    document.header.sourceLanguage = "en-US";
    document.header.targetLanguage = "zh-CN";
    const issues = validateDocument(document);
    expect(issues.some((item) => item.message.includes("no entries"))).toBe(true);
    document.groups.push({
      path: "Video",
      line: 1,
      emotion: [],
      entries: [],
      extensions: {},
    });
    const style = validateDocument(document, { style: true });
    expect(style.some((item) => item.category === "style")).toBe(true);
  });

  it("checks layout folder and flat candidates", () => {
    const issues = validate(base, { path: "/project/ja-JP/settings.zh-CN.cliff" });
    expect(
      issues.some((item) => item.category === "warning" && item.message.includes("layout")),
    ).toBe(true);
    const enforced = validate(base, {
      path: "/project/ja-JP/settings.zh-CN.cliff",
      checkLayout: true,
    });
    expect(enforced.some((item) => item.category === "semantic")).toBe(true);
  });

  it("checks width and skips ICU width", () => {
    const tooWide = base.replace('target: "分辨率"', 'target: "分辨率分辨率"\nmax-width: 8');
    const issue = validate(tooWide, { checkWidth: true });
    expect(issue.some((item) => item.message.includes("display width"))).toBe(true);
    const icu = base.replace('target: "分辨率"', 'target: "{count} 分辨率"\nmax-width: 8');
    const skipped = validate(icu, { checkWidth: true });
    expect(skipped.some((item) => item.message.includes("width check skipped"))).toBe(true);
  });

  it("reports glossary warnings", () => {
    const glossary = base
      .replace("target-language: zh-CN", "target-language: zh-CN\nvariant: glossary")
      .replace("type: label", "type: sentence");
    const issues = validate(glossary);
    expect(
      issues.some((item) => item.category === "warning" && item.message.includes("term-level")),
    ).toBe(true);
  });

  it("reports initial with target as warning", () => {
    const text = base.replace("status: final", "status: initial");
    const issues = validate(text);
    expect(issues.some((item) => item.message.includes("status is 'initial'"))).toBe(true);
  });
});
describe("additional coverage", () => {
  it("handles extensions, trailing commas and canonical ids", async () => {
    const text = base
      .replace(
        "target-language: zh-CN",
        'target-language: zh-CN\nx-s: "s"\nx-n: 2\nx-name: foo\nx-lang: en-US\nx-list: [a, 2, "s"]',
      )
      .replace("type: label", 'type: label\nx-g: "g"')
      .replace("status: final", 'status: final\nemotion: [objective,]\nx-e: "e"');
    const document = parse(text);
    expect(document.header.extensions["x-n"]).toBe("2");
    expect(document.header.extensions["x-list"]).toBe('[a, 2, "s"]');
    expect(document.groups[0]?.entries[0]?.emotion).toEqual(["objective"]);
    const { canonicalId } = await import("../src/index.js");
    expect(canonicalId("demo", "settings", "Video", "Resolution")).toBe(
      "demo.settings.Video.Resolution",
    );
  });

  it("covers identifiers helpers", async () => {
    const { normalizeIdentifier, uniqueIdentifier, stripLineTerminator, isTag, isName } =
      await import("../src/index.js");
    expect(normalizeIdentifier("  Save & Load  ", "entry")).toBe("Save-Load");
    expect(normalizeIdentifier("   ", "entry")).toBe("entry");
    const used = new Set<string>(["a"]);
    expect(uniqueIdentifier("a", used)).toBe("a-2");
    expect(stripLineTerminator("x: y, ;").extra).toBe(1);
    expect(stripLineTerminator('x: "y,"').terminators).toBe("");
    expect(isTag("final")).toBe(true);
    expect(isTag("Final")).toBe(false);
    expect(isName("A_b-1")).toBe(true);
  });

  it("handles extension errors and section duplicate validation", () => {
    expect(() =>
      parse(base.replace("target-language: zh-CN", "target-language: zh-CN\nx-a: [1, [2]]")),
    ).toThrow(CliffParseError);
    const duplicate = base + '\n[Video]\ntype: label\n\n<Another>\nsource: "A"\nstatus: initial\n';
    const issues = validate(duplicate);
    expect(
      issues.some((item) => item.category === "id" && item.message.includes("duplicate section")),
    ).toBe(true);
    expect(
      validate(base.replace('source: "Resolution"', 'source: "Resolution"\nreviewer: "R"'), {
        style: true,
      }).some((item) => item.category === "style"),
    ).toBe(false);
  });

  it("validates hand-built invalid models", () => {
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
    expect(issues.some((item) => item.category === "extension")).toBe(false);
    expect(issues.some((item) => item.category === "semantic")).toBe(true);
  });

  it("covers layout flat mismatch and style terminators", () => {
    const issues = validate(base, { path: "/project/settings.ja-JP.cliff" });
    expect(issues.some((item) => item.message.includes("flat layout mismatch"))).toBe(true);
    const style = validate(base.replace("target-language: zh-CN", "target-language: zh-CN,"), {
      style: true,
    });
    expect(style.some((item) => item.category === "style")).toBe(true);
  });

  it("enforces line and byte limits explicitly", () => {
    expect(() => parse(base, { maxBytes: 1 })).toThrow(CliffLimitError);
    expect(() => parse(new Uint8Array([1, 2, 3]), { maxBytes: 2 })).toThrow(CliffLimitError);
    expect(() => parse(base, { maxLineLength: 8 })).toThrow(CliffLimitError);
    expect(() => parse(base, { maxListItems: 1, maxEntries: 1 })).not.toThrow();
  });
});
