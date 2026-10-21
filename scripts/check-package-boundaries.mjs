import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const failures = [];

function walk(path) {
  const output = [];
  for (const name of readdirSync(path)) {
    const full = join(path, name);
    if (statSync(full).isDirectory()) output.push(...walk(full));
    else if (name.endsWith(".ts")) output.push(full);
  }
  return output;
}

const core = JSON.parse(readFileSync("packages/core/package.json", "utf8"));
if (Object.keys(core.dependencies ?? {}).length > 0) {
  failures.push("@cliff-format/core must not have runtime dependencies");
}
for (const file of walk("packages/core/src")) {
  const text = readFileSync(file, "utf8");
  if (/from\s+["']node:|import\(["']node:/.test(text)) {
    failures.push(`${file}: imports a Node builtin`);
  }
  if (/from\s+["']@cliff-format\//.test(text)) {
    failures.push(`${file}: core must not import another workspace package`);
  }
}

const json = JSON.parse(readFileSync("packages/json/package.json", "utf8"));
if (Object.keys(json.dependencies ?? {}).length > 0) {
  failures.push("@cliff-format/json must not have runtime dependencies");
}
if (json.peerDependencies?.["@cliff-format/core"] === undefined) {
  failures.push("@cliff-format/json must peer-depend on @cliff-format/core");
}
for (const file of walk("packages/json/src")) {
  const text = readFileSync(file, "utf8");
  if (/from\s+["']node:|import\(["']node:/.test(text)) {
    failures.push(`${file}: imports a Node builtin`);
  }
  const workspaceImports = [...text.matchAll(/from\s+["'](@cliff-format\/[^"']+)["']/g)].map(
    (match) => match[1],
  );
  for (const specifier of workspaceImports) {
    if (specifier !== "@cliff-format/core") {
      failures.push(`${file}: unexpected workspace import '${specifier}'`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("package boundaries OK");
