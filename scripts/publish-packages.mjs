import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dryRun =
  process.argv.includes("--dry-run") || (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
const directories = ["packages/core", "packages/json"];
const npm = "npm";
const shell = process.platform === "win32";

for (const directory of directories) {
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const specifier = manifest.name + "@" + manifest.version;

  const existing = spawnSync(npm, ["view", specifier, "version", "--json"], {
    encoding: "utf8",
    shell,
  });
  if (existing.status === 0) {
    console.log(specifier + " is already published; skipping");
    continue;
  }
  const output = (existing.stdout ?? "") + "\n" + (existing.stderr ?? "");
  if (!/E404|404 Not Found/.test(output)) {
    console.error("cannot determine whether " + specifier + " is published");
    console.error(output.trim());
    process.exit(1);
  }

  const args = dryRun
    ? ["publish", "--dry-run", "--access", "public"]
    : ["publish", "--access", "public", "--provenance"];
  console.log((dryRun ? "Dry-run publishing " : "Publishing ") + specifier);
  const result = spawnSync(npm, args, {
    cwd: resolve(directory),
    stdio: "inherit",
    shell,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
