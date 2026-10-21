import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = JSON.parse(readFileSync("package.json", "utf8"));
const version = root.version;
const packagesRoot = join(process.cwd(), "packages");
const failures = [];

for (const name of readdirSync(packagesRoot)) {
  const manifestPath = join(packagesRoot, name, "package.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    continue;
  }
  if (manifest.private === true) continue;
  if (manifest.version !== version) {
    failures.push(`${manifest.name}: version ${manifest.version} != root ${version}`);
  }
  if (manifest.name === "@cliff-format/json") {
    const peer = manifest.peerDependencies?.["@cliff-format/core"];
    if (peer !== `^${version}`) {
      failures.push(
        `@cliff-format/json: peer @cliff-format/core is ${peer ?? "missing"}, expected ^${version}`,
      );
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`versions synchronized at ${version}`);
