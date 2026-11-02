import {
  assertScope,
  CliffAmbiguousEntryError,
  CliffScopeError,
  CliffScopeMismatchError,
  type EntryIdCatalogContext,
  joinCanonical,
  type MessageRecord,
  resolveEntryId,
} from "@cliff-format/i18n";
import { describe, expect, it } from "vitest";

const scope = { namespace: "demo", clan: "app" };

function record(
  canonical: string,
  namespace = "demo",
  clan = "app",
  group = "video",
  id = "title",
): MessageRecord {
  return { canonical, namespace, clan, group, id } as unknown as MessageRecord;
}

function makeContext(
  records: readonly MessageRecord[] = [
    record("demo.app.video.title"),
    record("demo.app.advanced.title", "demo", "app", "advanced"),
    record("other.team.video.title", "other", "team"),
  ],
  aliases: Record<string, string> = {},
): EntryIdCatalogContext {
  const byCanonical = new Map(records.map((item) => [item.canonical, item]));
  return {
    knownNamespaces: new Set(["demo", "other"]),
    knownClans: new Set(["app", "team"]),
    defaultGroup: "fallback",
    aliases,
    hasCanonical: (canonical) => byCanonical.has(canonical),
    recordForCanonical: (canonical) => byCanonical.get(canonical),
    suffixMatches: (suffix) =>
      [...byCanonical.keys()].filter(
        (canonical) => canonical === suffix || canonical.endsWith("." + suffix),
      ),
  };
}

describe("entry ID context", () => {
  it("joins canonical IDs and validates scopes", () => {
    expect(joinCanonical("demo", "app", "", "title")).toBe("demo.app.title");
    expect(joinCanonical("demo", "app", "video", "title")).toBe("demo.app.video.title");
    expect(() => assertScope({ namespace: "demo", clan: "app" })).not.toThrow();
    expect(() => assertScope({ namespace: "demo!", clan: "app" })).toThrow(CliffScopeError);
    expect(() => assertScope({ namespace: "demo", clan: "app!" })).toThrow(CliffScopeError);
    expect(() => assertScope({ namespace: "demo", clan: "app", group: "bad!" })).toThrow(
      CliffScopeError,
    );
  });

  it("rejects empty, malformed, and non-name inputs", () => {
    const context = makeContext();
    expect(() => resolveEntryId("", scope, context)).toThrow(CliffScopeError);
    expect(() => resolveEntryId(":", scope, context)).toThrow(CliffScopeError);
    expect(() => resolveEntryId("demo:", scope, context)).toThrow(CliffScopeError);
    expect(() => resolveEntryId("bad!.title", scope, context)).toThrow(CliffScopeError);
    expect(() => resolveEntryId("demo:bad!.title", scope, context)).toThrow(CliffScopeError);
  });

  it("rejects alias cycles", () => {
    const context = makeContext([], { a: "b", b: "a" });
    expect(() => resolveEntryId("a", scope, context)).toThrow(CliffScopeError);
  });

  it("resolves colon, dot, slash, and scoped short entry IDs", () => {
    const context = makeContext();
    expect(resolveEntryId("demo.app.video.title", scope, context).canonical).toBe(
      "demo.app.video.title",
    );
    expect(resolveEntryId("demo:app.video.title", scope, context).canonical).toBe(
      "demo.app.video.title",
    );
    expect(resolveEntryId("demo/app/video/title", scope, context).canonical).toBe(
      "demo.app.video.title",
    );
    expect(
      resolveEntryId("video.title", { namespace: "demo", clan: "app", group: "video" }, context)
        .canonical,
    ).toBe("demo.app.video.title");
  });

  it("throws when a full entry ID points to another namespace", () => {
    const context = makeContext();
    expect(() => resolveEntryId("other:team.video.title", scope, context)).toThrow(
      CliffScopeMismatchError,
    );
  });

  it("throws when a candidate record belongs to another scope", () => {
    const context = makeContext([record("demo.app.video.ghost", "other", "team")]);
    expect(() => resolveEntryId("demo.app.video.ghost", scope, context)).toThrow(
      CliffScopeMismatchError,
    );
  });

  it("throws when a suffix only matches another scope", () => {
    const context = makeContext([record("other.team.video.only", "other", "team")]);
    expect(() => resolveEntryId("video.only", scope, context)).toThrow(CliffScopeMismatchError);
  });

  it("throws for ambiguous suffixes in strict mode and selects in loose mode", () => {
    const context = makeContext();
    expect(() =>
      resolveEntryId("title", { namespace: "demo", clan: "app", group: "other" }, context),
    ).toThrow(CliffAmbiguousEntryError);
    const selected = resolveEntryId(
      "title",
      { namespace: "demo", clan: "app", group: "video.extra" },
      context,
      false,
    );
    expect(selected.canonical).toBe("demo.app.video.title");
    expect(selected.ambiguous).toBe(true);
    expect(selected.candidates).toEqual(["demo.app.advanced.title", "demo.app.video.title"]);
  });

  it("resolves existing and missing object inputs", () => {
    const context = makeContext();
    expect(resolveEntryId({ id: "title", group: "video" }, scope, context).canonical).toBe(
      "demo.app.video.title",
    );
    const missing = resolveEntryId({ id: "new" }, scope, context);
    expect(missing.canonical).toBe("demo.app.fallback.new");
    expect(missing.exists).toBe(false);
    expect(() => resolveEntryId({ namespace: "other", id: "title" }, scope, context)).toThrow(
      CliffScopeMismatchError,
    );
    expect(() => resolveEntryId({ id: "bad!" }, scope, context)).toThrow(CliffScopeError);
    expect(() => resolveEntryId({ id: "title", group: "bad!" }, scope, context)).toThrow(
      CliffScopeError,
    );
  });

  it("builds authoring IDs from path segments", () => {
    const context = makeContext([]);
    expect(resolveEntryId("video.new", scope, context).canonical).toBe("demo.app.video.new");
    expect(resolveEntryId("demo.app.video.new", scope, context).canonical).toBe(
      "demo.app.video.new",
    );
    expect(resolveEntryId("demo.video.new", scope, context).canonical).toBe("demo.app.video.new");
    expect(resolveEntryId("app.video.new", scope, context).canonical).toBe("demo.app.video.new");
    expect(
      resolveEntryId("new", { namespace: "demo", clan: "app", group: "video" }, context).canonical,
    ).toBe("demo.app.video.new");
    expect(resolveEntryId("new", scope, context).canonical).toBe("demo.app.fallback.new");
  });

  it("rejects authoring paths with no entry ID or a known foreign scope", () => {
    const context = makeContext([]);
    expect(() => resolveEntryId("demo", scope, context)).toThrow(CliffScopeError);
    expect(() => resolveEntryId("demo.app", scope, context)).toThrow(CliffScopeError);
    expect(() => resolveEntryId("other.new", scope, context)).toThrow(CliffScopeMismatchError);
    expect(() => resolveEntryId("team.new", scope, context)).toThrow(CliffScopeMismatchError);
    expect(() => resolveEntryId("demo.team.new", scope, context)).toThrow(CliffScopeMismatchError);
  });
});
