import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { type CliffDocument, canonicalId, parse } from "@cliff-format/core";
import {
  CliffPluginError,
  type CliffPluginOptions,
  type ResolvedCliffOptions,
  type ScannedCliffFile,
} from "./types.js";

export function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

export function resolveCliffOptions(
  options: CliffPluginOptions = {},
  root = options.root ?? process.cwd(),
): ResolvedCliffOptions {
  const dirs = options.dirs ?? (options.dir === undefined ? ["src/locales"] : [options.dir]);
  return {
    root,
    dirs,
    include: options.include ?? /\.cliff$/,
    exclude: options.exclude ?? /(^|\/)node_modules(\/|$)/,
    virtualModule: options.virtualModule ?? "virtual:cliff",
    dts: options.dts ?? "src/cliff-keys.d.ts",
    typegen: options.typegen ?? true,
    reloadOnChange: options.reloadOnChange ?? true,
  };
}

async function walk(
  root: string,
  directory: string,
  options: ResolvedCliffOptions,
): Promise<string[]> {
  const absolute = resolve(root, directory);
  let entries: Dirent[];
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(absolute, entry.name);
    const normalized = toPosix(full);
    if (options.exclude.test(normalized)) continue;
    if (entry.isDirectory()) {
      files.push(...(await walk(root, relative(root, full), options)));
      continue;
    }
    if (entry.isFile() && options.include.test(full)) {
      files.push(full);
    }
  }
  return files;
}

export async function findCliffFiles(options: ResolvedCliffOptions): Promise<string[]> {
  const files: string[] = [];
  const seen = new Set<string>();
  for (const directory of options.dirs) {
    for (const file of await walk(options.root, directory, options)) {
      if (!seen.has(file)) {
        seen.add(file);
        files.push(file);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

export async function scanCliffFile(
  absolutePath: string,
  options: ResolvedCliffOptions,
): Promise<ScannedCliffFile> {
  const text = await readFile(absolutePath, "utf8");
  const filePath = toPosix(relative(options.root, absolutePath));
  let document: CliffDocument;
  try {
    document = parse(text, { path: filePath });
  } catch (error) {
    throw new CliffPluginError(
      "could not parse CLIFF file " +
        filePath +
        ": " +
        (error instanceof Error ? error.message : String(error)),
      { cause: error },
    );
  }
  const keys: string[] = [];
  for (const group of document.groups) {
    for (const entry of group.entries) {
      keys.push(canonicalId(document.header.namespace, document.header.clan, group.path, entry.id));
    }
  }
  return {
    absolutePath,
    filePath,
    namespace: document.header.namespace,
    clan: document.header.clan,
    locale: document.header.targetLanguage,
    keys,
    text,
  };
}

export async function scanCliffFiles(options: ResolvedCliffOptions): Promise<ScannedCliffFile[]> {
  const paths = await findCliffFiles(options);
  return Promise.all(paths.map((path) => scanCliffFile(path, options)));
}

function importSpecifier(absolutePath: string): string {
  const normalized = toPosix(absolutePath);
  return JSON.stringify(normalized.startsWith("/") ? "/@fs" + normalized : "/@fs/" + normalized);
}

export function virtualModuleCode(
  files: readonly ScannedCliffFile[],
  virtualModule: string,
): string {
  const imports = files
    .map(
      (file, index) =>
        "import cliff" + String(index) + " from " + importSpecifier(file.absolutePath) + ";",
    )
    .join("\n");
  const resources = files.map((_, index) => "cliff" + String(index)).join(", ");
  const meta = files
    .map(
      (file) =>
        "  { filePath: " +
        JSON.stringify(file.filePath) +
        ", namespace: " +
        JSON.stringify(file.namespace) +
        ", clan: " +
        JSON.stringify(file.clan) +
        ", locale: " +
        JSON.stringify(file.locale) +
        ", keys: " +
        JSON.stringify(file.keys) +
        " }",
    )
    .join(",\n");
  return [
    imports,
    "",
    "export const resources = [" + resources + "];",
    "export const files = [",
    meta,
    "];",
    "export const virtualModule = " + JSON.stringify(virtualModule) + ";",
    "export default resources;",
    "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function generateDts(files: readonly ScannedCliffFile[], virtualModule: string): string {
  const keys = [...new Set(files.flatMap((file) => file.keys))].sort();
  const keyUnion = keys.length === 0 ? "never" : keys.map((key) => JSON.stringify(key)).join(" | ");
  return [
    "// Generated by @cliff-format/vite. Do not edit.",
    "declare module " + JSON.stringify(virtualModule) + " {",
    "  export type CliffKey = " + keyUnion + ";",
    "  export interface CliffFileMeta {",
    "    readonly filePath: string;",
    "    readonly namespace: string;",
    "    readonly clan: string;",
    "    readonly locale: string;",
    "    readonly keys: readonly CliffKey[];",
    "  }",
    "  export const resources: readonly string[];",
    "  export const files: CliffFileMeta[];",
    "  export const virtualModule: string;",
    "  const defaultExport: readonly string[];",
    "  export default defaultExport;",
    "}",
    'declare module "*.cliff" {',
    "  const cliff: string;",
    "  export default cliff;",
    "  export const filePath: string;",
    "  export const namespace: string;",
    "  export const clan: string;",
    "  export const locale: string;",
    "  export const keys: readonly string[];",
    "  export const file: {",
    "    readonly filePath: string;",
    "    readonly namespace: string;",
    "    readonly clan: string;",
    "    readonly locale: string;",
    "    readonly keys: readonly string[];",
    "  };",
    "}",
    "",
  ].join("\n");
}

export async function writeDts(
  files: readonly ScannedCliffFile[],
  options: ResolvedCliffOptions,
): Promise<void> {
  if (options.dts === false || !options.typegen) return;
  const target = resolve(options.root, options.dts);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, generateDts(files, options.virtualModule), "utf8");
}
