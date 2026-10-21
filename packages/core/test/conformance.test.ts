import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CliffParseError,
  CliffValidationError,
  parse,
  parseTolerant,
  serialize,
  validate,
} from "../src/index.js";

const ROOT = join(process.cwd(), "fixtures", "upstream");

function filesIn(path: string): string[] {
  const output: string[] = [];
  for (const name of readdirSync(path)) {
    const full = join(path, name);
    if (statSync(full).isDirectory()) output.push(...filesIn(full));
    else if (name.endsWith(".cliff")) output.push(full);
  }
  return output;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function hard(issues: ReturnType<typeof validate>) {
  return issues.filter(
    (issue) => !["warning", "extension", "correction", "style"].includes(issue.category),
  );
}

describe("specification examples", () => {
  const files = [
    ...filesIn(join(ROOT, "examples", "cliff-1.0.0")),
    ...filesIn(join(ROOT, "examples", "cliff-1.1.0")),
  ];

  it("has examples", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`round-trips ${file.slice(ROOT.length + 1)}`, () => {
      const text = read(file);
      const document = parse(text, { path: file });
      expect(hard(validate(text, { path: file }))).toEqual([]);
      const once = serialize(document);
      expect(hard(validate(once, { path: file }))).toEqual([]);
      expect(serialize(parse(once, { path: file }))).toBe(once);
    });
  }
});

describe("conformance fixtures", () => {
  it("accepts valid fixtures", () => {
    for (const file of filesIn(join(ROOT, "conformance", "valid"))) {
      const text = read(file);
      const document = parse(text, { path: file });
      expect(hard(validate(text, { path: file })), file).toEqual([]);
      expect(serialize(parse(serialize(document)))).toBe(serialize(document));
    }
  });

  it("rejects invalid fixtures", () => {
    for (const file of filesIn(join(ROOT, "conformance", "invalid"))) {
      const text = read(file);
      const issues = validate(text, { path: file });
      expect(hard(issues).length, file).toBeGreaterThan(0);
    }
  });

  it("treats layout as a recommendation and enforces it on request", () => {
    for (const file of filesIn(join(ROOT, "conformance", "layout"))) {
      const text = read(file);
      expect(hard(validate(text, { path: file })), file).toEqual([]);
      expect(hard(validate(text, { path: file, checkLayout: true })).length, file).toBeGreaterThan(
        0,
      );
    }
  });

  it("repairs tolerant fixtures into strict-valid documents", () => {
    const unrepairable = new Set([
      "unrepairable.zh-CN.cliff",
      "quoted-unknown-key.zh-CN.cliff",
      "closing-tag.zh-CN.cliff",
    ]);
    for (const file of filesIn(join(ROOT, "conformance", "tolerant"))) {
      const name = file.split(/[\\/]/).at(-1) as string;
      const text = read(file);
      if (unrepairable.has(name)) {
        expect(() => parseTolerant(text, { path: file }), file).toThrow();
        continue;
      }
      let strictRejected = false;
      try {
        parse(text, { path: file });
      } catch (error) {
        expect(error).toBeInstanceOf(CliffParseError);
        strictRejected = true;
      }
      if (!strictRejected) {
        expect(hard(validate(text, { path: file })), file).not.toEqual([]);
      }
      const result = parseTolerant(text, { path: file });
      expect(result.corrections.length, file).toBeGreaterThan(0);
      const once = serialize(result.document);
      expect(hard(validate(once, { path: file })), file).toEqual([]);
      expect(serialize(parse(once, { path: file }))).toBe(once);
    }
  });

  it("reports style fixtures without failing them", () => {
    for (const file of filesIn(join(ROOT, "conformance", "style"))) {
      const text = read(file);
      expect(hard(validate(text, { path: file })), file).toEqual([]);
      const styled = validate(text, { path: file, style: true });
      expect(
        styled.some((issue) => issue.category === "style"),
        file,
      ).toBe(true);
    }
  });

  it("refuses unrepairable documents with a located category", () => {
    for (const name of [
      "unrepairable.zh-CN.cliff",
      "quoted-unknown-key.zh-CN.cliff",
      "closing-tag.zh-CN.cliff",
    ]) {
      const file = join(ROOT, "conformance", "tolerant", name);
      try {
        parseTolerant(read(file), { path: file });
        throw new Error(`${name} was accepted`);
      } catch (error) {
        expect(error).toBeInstanceOf(CliffParseError);
        if (error instanceof CliffValidationError) {
          expect(error.issues.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
