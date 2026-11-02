import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const packages = ["core", "json", "i18n", "translate", "vite"];

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
}

for (const name of packages) {
  run(pnpm, ["--dir", "packages/" + name, "exec", "publint"]);
}
for (const name of packages) {
  run(pnpm, ["exec", "attw", "--pack", "packages/" + name]);
}

const core = await import(pathToFileURL("packages/core/dist/index.js").href);
const doc = core.parse(
  "CLIFF 1.1\nnamespace: demo\nclan: settings\nsource-language: en-US\ntarget-language: zh-CN\n",
);
if (doc.header.clan !== "settings") throw new Error("ESM import smoke test failed");

const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const coreCjs = require("../packages/core/dist/index.cjs");
if (coreCjs.parse === undefined) throw new Error("CJS require smoke test failed");

const json = await import(pathToFileURL("packages/json/dist/index.js").href);
if (json.toCliJson === undefined) throw new Error("JSON ESM import smoke test failed");

const i18n = await import(pathToFileURL("packages/i18n/dist/index.js").href);
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
const instance = i18n.createI18n({ locale: "zh-CN", resources: [sample] });
const t = instance.scope({ namespace: "demo", clan: "settings", group: "video" }).t;
if (t("resolution").render() !== "分辨率") throw new Error("i18n ESM smoke test failed");

const translate = await import(pathToFileURL("packages/translate/dist/index.js").href);
if (translate.createDeepSeekTranslator === undefined) {
  throw new Error("translate ESM import smoke test failed");
}

const vite = await import(pathToFileURL("packages/vite/dist/index.js").href);
if (vite.cliff === undefined) throw new Error("vite ESM import smoke test failed");

console.log("package smoke tests passed");
