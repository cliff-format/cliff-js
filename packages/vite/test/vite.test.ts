import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type UnknownHook = ((...args: unknown[]) => unknown) | { handler: (...args: unknown[]) => unknown };

function callHook(hook: UnknownHook | undefined, thisArg: unknown, ...args: unknown[]): unknown {
  if (hook === undefined) throw new Error("hook is missing");
  const fn = typeof hook === "function" ? hook : hook.handler;
  return fn.call(thisArg, ...args);
}

import {
  cliff,
  generateDts,
  resolveCliffOptions,
  scanCliffFiles,
  transformCliffModule,
  virtualModuleCode,
  writeDts,
} from "@cliff-format/vite";

const sample = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: settings",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[video]",
  "type: label",
  "",
  "<resolution>",
  'source: "Resolution"',
  'target: "分辨率"',
  "status: final",
  "",
].join("\n");

const roots: string[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "cliff-vite-"));
  roots.push(root);
  await mkdir(join(root, "src", "locales", "zh-CN"), { recursive: true });
  await mkdir(join(root, "src", "locales", "en-US"), { recursive: true });
  await writeFile(join(root, "src", "locales", "zh-CN", "settings.cliff"), sample, "utf8");
  await writeFile(
    join(root, "src", "locales", "en-US", "settings.cliff"),
    sample
      .replace("target-language: zh-CN", "target-language: en-US")
      .replace('target: "分辨率"', 'target: "Resolution"'),
    "utf8",
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CLIFF Vite plugin", () => {
  it("scans CLIFF files and extracts canonical entry IDs", async () => {
    const root = await fixture();
    const options = resolveCliffOptions({ root, dts: "src/cliff-entry-ids.d.ts" }, root);
    const files = await scanCliffFiles(options);
    expect(files).toHaveLength(2);
    expect(files[0]?.filePath).toBe("src/locales/en-US/settings.cliff");
    expect(files[0]?.entryIds).toEqual(["demo.settings.video.resolution"]);
    expect(files[0]?.namespace).toBe("demo");
    expect(files[0]?.locale).toBe("en-US");
  });

  it("generates a virtual module with raw CLIFF imports and metadata", async () => {
    const root = await fixture();
    const options = resolveCliffOptions({ root }, root);
    const files = await scanCliffFiles(options);
    const code = virtualModuleCode(files, "virtual:cliff");
    expect(code).toContain("export const resources = [");
    expect(code).toContain("export const files = [");
    expect(code).toContain('filePath: "src/locales/en-US/settings.cliff"');
    expect(code).toContain("/@fs/");
    expect(code).toContain("export default resources;");
  });

  it("generates an ambient module declaration and writes it", async () => {
    const root = await fixture();
    const options = resolveCliffOptions({ root, dts: "types/cliff-entry-ids.d.ts" }, root);
    const files = await scanCliffFiles(options);
    const dts = generateDts(files, "virtual:cliff");
    expect(dts).toContain('declare module "virtual:cliff"');
    expect(dts).toContain('export type CliffEntryId = "demo.settings.video.resolution";');
    expect(dts).toContain("export const resources: readonly string[];");
    expect(dts).toContain('declare module "*.cliff"');
    await writeDts(files, options);
    const written = await readFile(join(root, "types", "cliff-entry-ids.d.ts"), "utf8");
    expect(written).toBe(dts);
  });

  it("transforms a .cliff file into a JavaScript module without JSON resources", async () => {
    const root = await fixture();
    const file = join(root, "src", "locales", "zh-CN", "settings.cliff");
    const result = transformCliffModule(sample, file, root);
    expect(result.code).toContain("const cliff = ");
    expect(result.code).toContain("export { cliff as default, file };");
    expect(result.code).toContain('"namespace":"demo"');
    expect(result.code).toContain('"entryIds":["demo.settings.video.resolution"]');
  });

  it("provides transform, virtual load and build start hooks", async () => {
    const root = await fixture();
    const plugin = cliff({ root, dirs: ["src/locales"], dts: "types/cliff-entry-ids.d.ts" });
    const addWatchFile = vi.fn();
    await callHook(plugin.buildStart as UnknownHook | undefined, { addWatchFile });
    expect(addWatchFile).toHaveBeenCalled();
    const virtualId = callHook(plugin.resolveId as UnknownHook | undefined, {}, "virtual:cliff");
    expect(virtualId).toBe("\0virtual:cliff");
    const loaded = await callHook(plugin.load as UnknownHook | undefined, {}, String(virtualId));
    expect(String(loaded)).toContain("export const resources");
    const transformed = (await callHook(
      plugin.transform as UnknownHook | undefined,
      {},
      sample,
      join(root, "src", "locales", "zh-CN", "settings.cliff"),
    )) as { code: string };
    expect(transformed.code).toContain("const cliff = ");
  });
});
