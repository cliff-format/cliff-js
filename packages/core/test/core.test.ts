import { describe, expect, it } from "vitest";
import {
  fromCliJson,
  fromFlatJson,
  fromNestedJson,
  toCliJson,
  toFlatJson,
  toNestedJson,
} from "../../json/src/index.js";
import {
  CliffParseError,
  CliffValidationError,
  displayWidth,
  parse,
  parseTolerant,
  serialize,
  validate,
} from "../src/index.js";

const minimal = `CLIFF 1.1
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

describe("core parser", () => {
  it("parses and canonicalizes a minimal document", () => {
    const document = parse(minimal);
    expect(document.specVersion).toBe("1.1");
    expect(document.header.namespace).toBe("demo");
    expect(document.groups[0]?.entries[0]?.target).toBe("分辨率");
    expect(validate(minimal)).toEqual([]);
    const once = serialize(document);
    expect(serialize(parse(once))).toBe(once);
    expect(once).toContain("CLIFF 1.1");
    expect(once).toContain('source: "Resolution"');
  });

  it("preserves a declared 1.0 version", () => {
    const text = minimal.replace("CLIFF 1.1", "CLIFF 1.0");
    const document = parse(text);
    expect(document.specVersion).toBe("1.0");
    expect(serialize(document).startsWith("CLIFF 1.0\n")).toBe(true);
  });

  it("supports comments, terminators and adjacent strings", () => {
    const text = `CLIFF 1.1,
namespace: demo,
clan: settings;
source-language: en-US
target-language: zh-CN
info: "one" "two"

# comment
[Video];
type: label

<Resolution>,
source: "Res" "olution"
target: "分辨率"
status: final
`;
    const document = parse(text);
    expect(document.header.info).toBe("onetwo");
    expect(document.groups[0]?.entries[0]?.source).toBe("Resolution");
    expect(validate(text).filter((issue) => issue.category !== "style")).toEqual([]);
  });

  it("supports list continuations and does not confuse them with sections", () => {
    const text = minimal.replace(
      "target-language: zh-CN",
      'target-language: zh-CN\ndependency: ["a"]\n            ["b", "c"]',
    );
    const document = parse(text);
    expect(document.header.dependency).toEqual(["a", "b", "c"]);
  });

  it("rejects bare CR and unpaired surrogates", () => {
    expect(() => parse(minimal.replace("\n", "\r"))).toThrow(CliffParseError);
    expect(() => parse('CLIFF 1.1\nnamespace: "\uD800"')).toThrow(CliffParseError);
  });

  it("rejects two terminators", () => {
    expect(() =>
      parse(minimal.replace("source-language: en-US", "source-language: en-US;;")),
    ).toThrow(CliffParseError);
  });

  it("enforces resource limits", () => {
    expect(() => parse(minimal, { maxLines: 2 })).toThrow(CliffParseError);
    expect(() => parse(minimal, { maxBytes: 10 })).toThrow(CliffParseError);
    expect(() => parse(minimal, { maxStringLength: 2 })).toThrow(CliffParseError);
  });
});

describe("validator", () => {
  it("reports required fields and vocabularies", () => {
    const text = minimal
      .replace("target-language: zh-CN", "target-language: zh-CN")
      .replace("status: final", "status: done")
      .replace("type: label", "type: Label");
    const issues = validate(text);
    expect(issues.some((issue) => issue.category === "vocabulary")).toBe(true);
  });

  it("reports status/target contradictions", () => {
    const text = minimal.replace('target: "分辨率"\n', "");
    const issues = validate(text);
    expect(issues.some((issue) => issue.category === "semantic")).toBe(true);
  });

  it("checks ICU braces", () => {
    const text = minimal.replace('target: "分辨率"', 'target: "{count, plural, other {x}"');
    expect(validate(text).some((issue) => issue.category === "icu")).toBe(true);
  });
});

describe("tolerant parser", () => {
  it("repairs bare lists, quoted tags and repeated fields", () => {
    const text = minimal
      .replace("type: label", 'type: "label"')
      .replace('target: "分辨率"', 'target: "分辨"\ntarget: "率"')
      .replace("status: final", "emotion: objective\nstatus: final");
    const result = parseTolerant(text);
    expect(result.corrections.map((item) => item.category)).toEqual(
      expect.arrayContaining(["tag-quote", "field-repeat", "list-shape"]),
    );
    expect(result.document.groups[0]?.entries[0]?.target).toBe("分辨率");
    expect(result.document.groups[0]?.entries[0]?.emotion).toEqual(["objective"]);
    expect(
      validate(serialize(result.document)).filter((issue) => issue.category !== "warning"),
    ).toEqual([]);
  });

  it("normalizes quoted and reserved entry ids and reports collisions", () => {
    const text = minimal.replace(
      /<Resolution>[\s\S]*$/,
      '<"Save & Load">\nsource: "S"\nstatus: initial\n',
    );
    const result = parseTolerant(text);
    expect(result.document.groups[0]?.entries[0]?.id).toBe("Save-Load");
    expect(result.corrections.some((item) => item.category === "name-normalized")).toBe(true);
  });

  it("refuses unrepairable semantic errors", () => {
    const text = minimal.replace("type: label\n", "");
    expect(() => parseTolerant(text)).toThrow(CliffValidationError);
  });

  it("disambiguates duplicate ids by default", () => {
    const text = minimal + '\n<Resolution>\nsource: "second"\nstatus: initial\n';
    const result = parseTolerant(text);
    expect(result.document.groups[0]?.entries[1]?.id).toBe("Resolution-2");
    expect(result.corrections.some((item) => item.category === "id-collision")).toBe(true);
  });
});

describe("width", () => {
  it("implements the specification examples", () => {
    expect(displayWidth("分辨率")).toBe(6);
    expect(displayWidth("OK")).toBe(2);
    expect(displayWidth("OK 分辨率")).toBe(9);
    expect(displayWidth("👩‍💻")).toBe(2);
    expect(displayWidth("e\u0301")).toBe(1);
  });
});

describe("json converters", () => {
  const document = parse(minimal);

  it("round-trips the CLIFF-shaped JSON", () => {
    const object = toCliJson(document);
    expect(object["spec-version"]).toBe("1.1");
    const restored = fromCliJson(object);
    expect(serialize(restored)).toBe(serialize(document));
  });

  it("imports and exports flat JSON", () => {
    const result = fromFlatJson(
      { "video.resolution": "分辨率", "video.fullscreen": "全屏" },
      {
        namespace: "demo",
        clan: "settings",
        sourceLanguage: "en-US",
        targetLanguage: "zh-CN",
      },
    );
    expect(result.document.groups[0]?.path).toBe("video");
    expect(result.document.groups[0]?.entries[0]?.source).toBe("video.resolution");
    const flat = toFlatJson(result.document, { keyStyle: "group-entry" });
    expect(flat["video.resolution"]).toBe("分辨率");
    const nested = toNestedJson(result.document);
    expect((nested.video as Record<string, string>).resolution).toBe("分辨率");
  });

  it("imports nested JSON", () => {
    const result = fromNestedJson(
      { video: { resolution: "分辨率" } },
      {
        namespace: "demo",
        clan: "settings",
        sourceLanguage: "en-US",
        targetLanguage: "zh-CN",
      },
    );
    expect(result.document.groups[0]?.entries[0]?.target).toBe("分辨率");
  });
});
