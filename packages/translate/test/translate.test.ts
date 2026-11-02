import { parse } from "@cliff-format/core";
import {
  createDeepSeekClient,
  createDeepSeekTranslator,
  DeepSeekConfigError,
  DeepSeekHttpError,
} from "@cliff-format/translate";
import { describe, expect, it, vi } from "vitest";

const input = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: settings",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[video]",
  "type: label",
  "",
  "<brightness>",
  'source: "Brightness"',
  "status: initial",
  "",
  "<contrast>",
  'source: "Contrast"',
  'target: "对比度"',
  "status: reviewed",
  "",
].join("\n");

const translated = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: settings",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[video]",
  "type: label",
  "",
  "<brightness>",
  'source: "Brightness"',
  'target: "亮度"',
  "status: translated",
  "",
  "<contrast>",
  'source: "Contrast"',
  'target: "对比度"',
  "status: reviewed",
  "",
].join("\n");

function apiResponse(
  content: string,
  usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
) {
  return new Response(
    JSON.stringify({
      model: "deepseek-flash",
      choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
      usage,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function mockFetch(...responses: Array<Response | (() => Response)>) {
  let index = 0;
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = responses[index];
    if (next === undefined) throw new Error("unexpected fetch call " + String(index + 1));
    index++;
    return typeof next === "function" ? next() : next;
  });
}

describe("DeepSeek client defaults", () => {
  it("sends temperature 1.3, thinking disabled and the configured model", async () => {
    const fetch = mockFetch(apiResponse(translated));
    const client = createDeepSeekClient({ apiKey: "test-key", fetch, retryDelayMs: 0 });
    const completion = await client.complete([{ role: "user", content: "hi" }]);
    expect(completion.text).toBe(translated);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe("deepseek-flash");
    expect(body.temperature).toBe(1.3);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.stream).toBe(false);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("requires an API key unless a proxy supplies authorization", () => {
    expect(() => createDeepSeekClient({ fetch: mockFetch() })).toThrow(DeepSeekConfigError);
    expect(() =>
      createDeepSeekClient({
        fetch: mockFetch(),
        headers: { Authorization: "Bearer proxy" },
      }),
    ).not.toThrow();
  });

  it("retries 5xx responses", async () => {
    const fetch = mockFetch(new Response("boom", { status: 500 }), apiResponse(translated));
    const client = createDeepSeekClient({
      apiKey: "test-key",
      fetch,
      maxRetries: 1,
      retryDelayMs: 0,
    });
    const completion = await client.complete([{ role: "user", content: "hi" }]);
    expect(completion.attempts).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 401", async () => {
    const fetch = mockFetch(new Response("unauthorized", { status: 401 }), apiResponse(translated));
    const client = createDeepSeekClient({
      apiKey: "test-key",
      fetch,
      maxRetries: 2,
      retryDelayMs: 0,
    });
    await expect(client.complete([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(
      DeepSeekHttpError,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("CLIFF translation", () => {
  it("fills target and status while preserving reviewed entries", async () => {
    const fetch = mockFetch(apiResponse(translated));
    const translator = createDeepSeekTranslator({
      apiKey: "test-key",
      fetch,
      retryDelayMs: 0,
    });
    const result = await translator.translate(input);
    const document = parse(result.cliff);
    const group = document.groups[0];
    const brightness = group?.entries.find((entry) => entry.id === "brightness");
    const contrast = group?.entries.find((entry) => entry.id === "contrast");
    expect(brightness?.target).toBe("亮度");
    expect(brightness?.status).toBe("translated");
    expect(contrast?.target).toBe("对比度");
    expect(contrast?.status).toBe("reviewed");
    expect(result.usage.totalTokens).toBe(15);
    expect(result.batches).toBe(1);
  });

  it("accepts a fenced CLIFF answer", async () => {
    const fence = String.fromCharCode(96).repeat(3);
    const fetch = mockFetch(apiResponse(fence + "cliff\n" + translated + fence));
    const translator = createDeepSeekTranslator({ apiKey: "test-key", fetch, retryDelayMs: 0 });
    const result = await translator.translate(input);
    expect(result.cliff).toContain('target: "亮度"');
  });

  it("batches untranslated entries", async () => {
    const two = [
      "CLIFF 1.1",
      "namespace: demo",
      "clan: settings",
      "source-language: en-US",
      "target-language: zh-CN",
      "",
      "[video]",
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
      "clan: settings",
      "source-language: en-US",
      "target-language: zh-CN",
      "",
      "[video]",
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
    const fetch = mockFetch(apiResponse(answer), apiResponse(answer));
    const translator = createDeepSeekTranslator({ apiKey: "test-key", fetch, retryDelayMs: 0 });
    const result = await translator.translate(two, { batchSize: 1 });
    expect(result.batches).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.cliff).toContain('target: "甲"');
    expect(result.cliff).toContain('target: "乙"');
  });

  it("repairs an unparseable answer once", async () => {
    const fetch = mockFetch(apiResponse("not cliff"), apiResponse(translated));
    const translator = createDeepSeekTranslator({
      apiKey: "test-key",
      fetch,
      retryDelayMs: 0,
    });
    const result = await translator.translate(input, { maxRepairAttempts: 1 });
    expect(result.cliff).toContain('target: "亮度"');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("includes the CLIFF file and a glossary in the prompt", async () => {
    const glossary = [
      "CLIFF 1.1",
      "namespace: demo",
      "clan: settings-terms",
      "source-language: en-US",
      "target-language: zh-CN",
      "variant: glossary",
      "",
      "[terms]",
      "type: noun",
      "",
      "<brightness>",
      'source: "Brightness"',
      'target: "亮度"',
      "type: noun",
      "status: final",
      "",
    ].join("\n");
    const fetch = mockFetch(apiResponse(translated));
    const translator = createDeepSeekTranslator({ apiKey: "test-key", fetch, retryDelayMs: 0 });
    await translator.translate(input, { glossary });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> };
    const prompt = body.messages.map((message) => message.content).join("\n");
    expect(prompt).toContain("REFERENCE GLOSSARY");
    expect(prompt).toContain("settings-terms");
    expect(prompt).toContain("FILE TO TRANSLATE");
    expect(prompt).toContain('source: "Brightness"');
  });
});
