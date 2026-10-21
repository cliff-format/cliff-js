import { expect, test } from "@playwright/test";

test("parses, validates and converts CLIFF in a browser", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(() => {
    const api = (globalThis as { __cliff?: Record<string, unknown> }).__cliff as {
      parse: (text: string) => unknown;
      serialize: (document: unknown) => string;
      validate: (text: string) => Array<{ category: string }>;
      toCliJson: (document: unknown) => unknown;
      displayWidth: (text: string) => number;
      text: string;
    };
    const document = api.parse(api.text);
    return {
      canonical: api.serialize(document),
      issues: api.validate(api.text),
      json: api.toCliJson(document),
      width: api.displayWidth("分辨率"),
    };
  });

  expect(result.canonical).toContain("CLIFF 1.1");
  expect(result.canonical).toContain('source: "Resolution"');
  expect(result.issues).toEqual([]);
  expect((result.json as { "spec-version": string })["spec-version"]).toBe("1.1");
  expect(result.width).toBe(6);
});
