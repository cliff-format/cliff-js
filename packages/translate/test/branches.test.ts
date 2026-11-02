import { parse } from "@cliff-format/core";
import {
  CliffTranslateError,
  createDeepSeekClient,
  createDeepSeekTranslator,
  DeepSeekConfigError,
} from "@cliff-format/translate";
import { describe, expect, it, vi } from "vitest";

const input = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: extra",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[ui]",
  "type: label",
  "",
  "<a>",
  'source: "A"',
  "status: initial",
  "",
  "<b>",
  'source: "B"',
  "status: initial",
  "",
].join("\n");

const answer = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: extra",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[ui]",
  "type: label",
  "",
  "<a>",
  'source: "A"',
  'target: "甲"',
  "status: translated",
  "",
  "<b>",
  'source: "B"',
  'target: "乙"',
  "status: translated",
  "",
].join("\n");

function response(content: unknown, status = 200, usage?: unknown) {
  return new Response(
    JSON.stringify({
      model: "deepseek-flash",
      choices: [{ message: { content }, finish_reason: "stop" }],
      ...(usage === undefined ? {} : { usage }),
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

function mockFetch(...values: Array<Response | (() => Response)>) {
  let index = 0;
  return vi.fn(async () => {
    const value = values[index];
    if (value === undefined) throw new Error("unexpected fetch");
    index++;
    return typeof value === "function" ? value() : value;
  });
}

describe("DeepSeek configuration branches", () => {
  it("rejects invalid numeric and protocol options", () => {
    expect(() => createDeepSeekClient({ apiKey: "k", timeoutMs: 0 })).toThrow(DeepSeekConfigError);
    expect(() => createDeepSeekClient({ apiKey: "k", maxRetries: -1 })).toThrow(
      DeepSeekConfigError,
    );
    expect(() => createDeepSeekClient({ apiKey: "k", retryDelayMs: 1.5 })).toThrow(
      DeepSeekConfigError,
    );
    expect(() => createDeepSeekClient({ apiKey: "k", endpointPath: "bad" })).toThrow(
      DeepSeekConfigError,
    );
    expect(() => createDeepSeekClient({ apiKey: "k", thinking: "bad" as never })).toThrow(
      DeepSeekConfigError,
    );
  });

  it("accepts proxy authorization and explicit thinking", () => {
    const proxy = createDeepSeekClient({
      headers: { Authorization: "Bearer proxy" },
      fetch: mockFetch(response(answer)),
    });
    expect(proxy.config.apiKey).toBeUndefined();
    expect(createDeepSeekClient({ apiKey: "k", thinking: true }).config.thinking).toEqual({
      type: "enabled",
    });
    expect(
      createDeepSeekClient({ apiKey: "k", thinking: { type: "enabled" } }).config.thinking,
    ).toEqual({ type: "enabled" });
  });

  it("rejects missing message content and retries 429", async () => {
    const empty = createDeepSeekClient({
      apiKey: "k",
      fetch: mockFetch(response("")),
      maxRetries: 0,
    });
    await expect(empty.complete([{ role: "user", content: "x" }])).rejects.toBeInstanceOf(
      CliffTranslateError,
    );

    const fetch = mockFetch(response("busy", 429), response(answer));
    const client = createDeepSeekClient({ apiKey: "k", fetch, maxRetries: 1, retryDelayMs: 0 });
    const completion = await client.complete([{ role: "user", content: "x" }]);
    expect(completion.attempts).toBe(2);
  });

  it("returns zero usage when the response omits usage", async () => {
    const fetch = mockFetch(response(answer));
    const client = createDeepSeekClient({ apiKey: "k", fetch });
    const completion = await client.complete([{ role: "user", content: "x" }]);
    expect(completion.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });
});

describe("translation option branches", () => {
  it("rejects invalid options before calling the model", async () => {
    const translator = createDeepSeekTranslator({
      apiKey: "k",
      fetch: mockFetch(response(answer)),
    });
    await expect(translator.translate(input, { targetLanguage: " " })).rejects.toBeInstanceOf(
      CliffTranslateError,
    );
    await expect(translator.translate(input, { batchSize: 0 })).rejects.toBeInstanceOf(
      CliffTranslateError,
    );
    await expect(translator.translate(input, { maxRepairAttempts: -1 })).rejects.toBeInstanceOf(
      CliffTranslateError,
    );
    await expect(translator.translate(input, { glossary: "not cliff" })).rejects.toBeInstanceOf(
      CliffTranslateError,
    );
  });

  it("requires source language on the document", async () => {
    const document = parse(input);
    document.header.sourceLanguage = "";
    const translator = createDeepSeekTranslator({ apiKey: "k", fetch: mockFetch() });
    await expect(translator.translateDocument(document)).rejects.toBeInstanceOf(
      CliffTranslateError,
    );
  });

  it("returns an unchanged document when overwrite is none", async () => {
    const translator = createDeepSeekTranslator({ apiKey: "k", fetch: mockFetch() });
    const result = await translator.translate(input, { overwrite: "none" });
    expect(result.batches).toBe(0);
    expect(result.untranslated).toEqual([]);
    expect(result.cliff).toContain('source: "A"');
  });

  it("translates documents and reports progress", async () => {
    const fetch = mockFetch(response(answer), response(answer));
    const translator = createDeepSeekTranslator({ apiKey: "k", fetch, retryDelayMs: 0 });
    const progress = vi.fn();
    const result = await translator.translateDocument(parse(input), {
      batchSize: 1,
      onProgress: progress,
      status: "final",
    });
    expect(result.batches).toBe(2);
    expect(progress).toHaveBeenCalledTimes(2);
    expect(result.cliff).toContain('target: "甲"');
    expect(result.cliff).toContain("status: final");
  });

  it("accepts bytes and a glossary array", async () => {
    const fetch = mockFetch(response(answer), response(answer));
    const translator = createDeepSeekTranslator({ apiKey: "k", fetch, retryDelayMs: 0 });
    const result = await translator.translate(new TextEncoder().encode(input), {
      batchSize: 1,
      glossary: [input.replace("clan: extra", "clan: terms")],
    });
    expect(result.batches).toBe(2);
  });

  it("surfaces a parse error when no repair attempt is allowed", async () => {
    const fetch = mockFetch(response("not cliff"));
    const translator = createDeepSeekTranslator({ apiKey: "k", fetch, retryDelayMs: 0 });
    await expect(
      translator.translate(input, { maxRepairAttempts: 0, batchSize: 1 }),
    ).rejects.toBeInstanceOf(Error);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
