import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
}

run(pnpm, ["--dir", "packages/core", "exec", "publint"]);
run(pnpm, ["--dir", "packages/json", "exec", "publint"]);
run(pnpm, ["exec", "attw", "--pack", "packages/core"]);
run(pnpm, ["exec", "attw", "--pack", "packages/json"]);

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
console.log("package smoke tests passed");
