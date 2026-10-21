import { readFileSync } from "node:fs";
import { build } from "esbuild";

const coreSource = readFileSync("packages/core/src/index.ts", "utf8");
if (/from\s+["']node:|import\(["']node:/.test(coreSource)) {
  console.error("core index references Node builtins");
  process.exit(1);
}

const result = await build({
  entryPoints: ["packages/json/src/index.ts"],
  bundle: true,
  write: false,
  platform: "browser",
  format: "esm",
  target: "es2022",
  alias: {
    "@cliff-format/core": "./packages/core/src/index.ts",
  },
  logLevel: "silent",
});
for (const output of result.outputFiles) {
  const text = output.text;
  if (/from\s+["']node:|require\(["']node:|from\s+["']fs["']/.test(text)) {
    console.error("browser bundle contains Node builtins");
    process.exit(1);
  }
}
console.log("browser bundle OK");
