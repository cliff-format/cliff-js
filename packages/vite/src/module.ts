import { relative } from "node:path";
import { type CliffDocument, canonicalId, parse } from "@cliff-format/core";
import { toPosix } from "./scan.js";
import { CliffPluginError } from "./types.js";

export interface CliffModuleResult {
  code: string;
  map: null;
}

export function transformCliffModule(
  code: string,
  absolutePath: string,
  root: string,
): CliffModuleResult {
  const filePath = toPosix(relative(root, absolutePath));
  let document: CliffDocument;
  try {
    document = parse(code, { path: filePath });
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
  const meta = {
    filePath,
    namespace: document.header.namespace,
    clan: document.header.clan,
    locale: document.header.targetLanguage,
    keys,
  };
  return {
    code: [
      "const cliff = " + JSON.stringify(code) + ";",
      "const file = " + JSON.stringify(meta) + ";",
      "export { cliff as default, file };",
      "export const filePath = " + JSON.stringify(filePath) + ";",
      "export const namespace = " + JSON.stringify(document.header.namespace) + ";",
      "export const clan = " + JSON.stringify(document.header.clan) + ";",
      "export const locale = " + JSON.stringify(document.header.targetLanguage) + ";",
      "export const keys = " + JSON.stringify(keys) + ";",
      "",
    ].join("\n"),
    map: null,
  };
}
