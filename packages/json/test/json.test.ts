import { parse } from "@cliff-format/core";
import { describe, expect, it } from "vitest";
import {
  fromCliJson,
  fromFlatJson,
  fromJsonString,
  fromNestedJson,
  toCliJson,
  toFlatJson,
  toJsonString,
  toNestedJson,
} from "../src/index.js";

const text = `CLIFF 1.1
namespace: demo
clan: settings
source-language: en-US
target-language: zh-CN
version: "1.0"
variant: glossary
title: "Title"
info: "Info"
standard: "Standard"
dependency: ["a"]
x-h: "h"

[Video]
context: "Context"
type: label
emotion: [objective]
max-width: 12
x-g: "g"

<Resolution>
source: "Resolution"
target: "分辨率"
type: noun
emotion: [objective]
status: final
context: "Entry context"
max-width: 8
reference: ["src/a.ts:1"]
reviewer: "reviewer"
x-e: "e"
`;
const document = parse(text);
const options = {
  namespace: "demo",
  clan: "settings",
  sourceLanguage: "en-US",
  targetLanguage: "zh-CN",
};

describe("CLIFF-shaped JSON", () => {
  it("preserves all fields", () => {
    const object = toCliJson(document);
    const restored = fromCliJson(object);
    expect(restored.header.variant).toBe("glossary");
    expect(restored.header.version).toBe("1.0");
    expect(restored.header.extensions["x-h"]).toBe('"h"');
    expect(restored.groups[0]?.maxWidth).toBe(12);
    expect(restored.groups[0]?.entries[0]?.reference).toEqual(["src/a.ts:1"]);
  });

  it("rejects malformed objects", () => {
    expect(() => fromCliJson(null)).toThrow();
    expect(() => fromCliJson({ header: {}, groups: [] })).toThrow();
    expect(() =>
      fromCliJson({
        "spec-version": "2.0",
        header: {
          namespace: "a",
          clan: "b",
          "source-language": "en-US",
          "target-language": "zh-CN",
        },
        groups: [],
      }),
    ).toThrow();
    expect(() =>
      fromCliJson({
        header: {
          namespace: "a",
          clan: "b",
          "source-language": "en-US",
          "target-language": "zh-CN",
        },
        groups: [{}],
      }),
    ).toThrow();
  });

  it("round-trips JSON text", () => {
    expect(fromJsonString(toJsonString(document)).header.clan).toBe("settings");
    expect(() => fromJsonString("{")).toThrow();
  });
});

describe("flat JSON", () => {
  it("imports target and source roles", () => {
    const target = fromFlatJson({ "a.b": "B" }, options);
    expect(target.document.groups[0]?.entries[0]?.status).toBe("translated");
    const source = fromFlatJson({ "a.b": "B" }, { ...options, valueRole: "source" });
    expect(source.document.groups[0]?.entries[0]?.target).toBeUndefined();
    expect(source.document.groups[0]?.entries[0]?.status).toBe("initial");
  });

  it("reports normalization warnings and custom separators", () => {
    const result = fromFlatJson(
      { "Video Setup/Save & Load": "S" },
      { ...options, keySeparator: "/" },
    );
    expect(result.document.groups[0]?.path).toBe("Video-Setup");
    expect(result.document.groups[0]?.entries[0]?.id).toBe("Save-Load");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects invalid values and limits", () => {
    expect(() => fromFlatJson({ a: 1 }, options)).toThrow();
    expect(() => fromFlatJson({ a: "A", b: "B" }, { ...options, maxEntries: 1 })).toThrow();
    expect(() => fromFlatJson({ "a..b": "B" }, options)).toThrow();
  });

  it("exports keys and detects collisions", () => {
    const flat = toFlatJson(document);
    expect(flat["demo.settings.Video.Resolution"]).toBe("分辨率");
    expect(toFlatJson(document, { keyStyle: "entry" }).Resolution).toBe("分辨率");
    const copy = parse(text);
    copy.groups.push({
      path: "Other",
      line: 0,
      emotion: [],
      entries: [{ ...copy.groups[0]!.entries[0]!, id: "Resolution" }],
      extensions: {},
    });
    expect(() => toFlatJson(copy, { keyStyle: "entry" })).toThrow();
  });
});

describe("nested JSON", () => {
  it("imports nested JSON", () => {
    const result = fromNestedJson({ video: { resolution: "分辨率" } }, options);
    expect(result.document.groups[0]?.path).toBe("video");
  });

  it("rejects non-string leaves, depth and separator keys", () => {
    expect(() => fromNestedJson({ a: 1 }, options)).toThrow();
    expect(() => fromNestedJson({ a: { b: { c: "C" } } }, { ...options, maxDepth: 1 })).toThrow();
    expect(() => fromNestedJson({ "a.b": "B" }, options)).toThrow();
  });

  it("exports nested JSON and detects collisions", () => {
    const nested = toNestedJson(document);
    expect((nested.Video as Record<string, string>).Resolution).toBe("分辨率");
    const copy = parse(text);
    copy.groups.push({
      path: "Video",
      line: 0,
      emotion: [],
      entries: [{ ...copy.groups[0]!.entries[0]!, id: "Resolution" }],
      extensions: {},
    });
    expect(() => toNestedJson(copy)).toThrow();
  });
});
