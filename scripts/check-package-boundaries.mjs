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

const policies = {
  core: { runtimeDeps: false, peerCore: false, allowNode: false, workspace: [] },
  json: { runtimeDeps: false, peerCore: true, allowNode: false, workspace: ["@cliff-format/core"] },
  i18n: { runtimeDeps: true, peerCore: true, allowNode: false, workspace: ["@cliff-format/core"] },
  translate: {
    runtimeDeps: false,
    peerCore: true,
    allowNode: false,
    workspace: ["@cliff-format/core"],
  },
  vite: { runtimeDeps: false, peerCore: true, allowNode: true, workspace: ["@cliff-format/core"] },
};

for (const [directory, policy] of Object.entries(policies)) {
  const packageRoot = join("packages", directory);
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  if (!policy.runtimeDeps && Object.keys(manifest.dependencies ?? {}).length > 0) {
    failures.push(manifest.name + " must not have runtime dependencies");
  }
  if (policy.peerCore && manifest.peerDependencies?.["@cliff-format/core"] === undefined) {
    failures.push(manifest.name + " must peer-depend on @cliff-format/core");
  }
  for (const file of walk(join(packageRoot, "src"))) {
    const text = readFileSync(file, "utf8");
    if (!policy.allowNode && /from\s+["']node:|import\(["']node:/.test(text)) {
      failures.push(file + ": imports a Node builtin");
    }
    const workspaceImports = [...text.matchAll(/from\s+["'](@cliff-format\/[^"']+)["']/g)].map(
      (match) => match[1],
    );
    for (const specifier of workspaceImports) {
      if (!policy.workspace.includes(specifier)) {
        failures.push(file + ": unexpected workspace import '" + specifier + "'");
      }
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("package boundaries OK");
