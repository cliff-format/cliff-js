import { parse } from "@cliff-format/core";
import { describe, expect, it } from "vitest";
import {
  fromCliJson,
  fromFlatJson,
  fromNestedJson,
  isCliffObject,
  toCliJson,
  toFlatJson,
  toJsonString,
  toNestedJson,
} from "../src/index.js";

const options = {
  namespace: "demo",
  clan: "settings",
  sourceLanguage: "en-US",
  targetLanguage: "zh-CN",
};

const text = `CLIFF 1.1
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

describe("json coverage", () => {
  it("covers CLIFF-shaped validation paths", () => {
    expect(isCliffObject({ header: {}, groups: [] })).toBe(true);
    expect(isCliffObject({})).toBe(false);
    const minimal = toCliJson(parse(text));
    const restored = fromCliJson({ ...minimal, "spec-version": "1.0" });
    expect(restored.specVersion).toBe("1.0");
    expect(() =>
      fromCliJson({ ...minimal, header: { ...minimal.header, namespace: "" } }),
    ).toThrow();
    expect(() =>
      fromCliJson({ ...minimal, header: { ...minimal.header, extensions: { a: 1 } } }),
    ).toThrow();
    expect(() =>
      fromCliJson({ ...minimal, groups: [{ path: "x", entries: [], "max-width": "x" }] }),
    ).toThrow();
    expect(() => fromCliJson({ ...minimal, groups: [{ path: "x", entries: [{}] }] })).toThrow();
  });

  it("covers flat import/export options", () => {
    const source = fromFlatJson({ "a.b": "B" }, { ...options, entryStatus: "reviewed" });
    expect(source.document.groups[0]?.entries[0]?.status).toBe("reviewed");
    const duplicate = fromFlatJson({ "a b": "A", "a-b": "B" }, options);
    expect(duplicate.document.groups[0]?.entries[0]?.id).toBe("a-b");
    expect(duplicate.document.groups[0]?.entries[1]?.id).toBe("a-b-2");
    expect(duplicate.warnings.some((item) => item.message.includes("duplicate"))).toBe(true);
    expect(() => fromFlatJson({ a: "A" }, { ...options, keySeparator: "" })).toThrow();
    expect(() => fromFlatJson({}, { ...options, maxEntries: 0 })).toThrow();
    expect(() => fromFlatJson({ a: "A" }, { ...options, keySeparator: "" })).toThrow();
    const doc = fromFlatJson({ a: "A" }, options).document;
    expect(toFlatJson(doc, { value: "source", keyStyle: "entry" }).a).toBe("a");
    expect(toFlatJson(doc, { value: "target", keyStyle: "entry", fallbackToSource: true }).a).toBe(
      "A",
    );
  });

  it("covers nested errors and collisions", () => {
    expect(() => fromNestedJson([], options)).toThrow();
    expect(() => fromNestedJson({ "": "x" }, options)).toThrow();
    expect(() => fromNestedJson({ a: { b: { c: "C" } } }, { ...options, maxDepth: 1 })).toThrow();
    expect(() => fromNestedJson({ a: ["x"] }, options)).toThrow();
    expect(() => fromNestedJson({ a: 1 }, options)).toThrow();
    const nestedDoc = parse(text);
    nestedDoc.groups.push({
      path: "Video",
      line: 0,
      emotion: [],
      entries: [
        {
          id: "Resolution",
          line: 0,
          target: "duplicate",
          emotion: [],
          reference: [],
          extensions: {},
        },
      ],
      extensions: {},
    });
    expect(() => toNestedJson(nestedDoc)).toThrow();
  });

  it("covers JSON text and invalid spec versions", () => {
    expect(toJsonString(parse(text))).toContain('"spec-version": "1.1"');
    expect(fromFlatJson({ a: "" }, options).warnings.length).toBeGreaterThan(0);
    expect(() =>
      fromCliJson({
        ...toCliJson(parse(text)),
        header: { ...toCliJson(parse(text)).header, "source-language": undefined },
      }),
    ).toThrow();
    expect(() => fromCliJson({ "spec-version": "2.0", header: {}, groups: [] })).toThrow();
  });
});
