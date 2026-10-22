import { readFileSync } from "node:fs";

const root = JSON.parse(readFileSync("package.json", "utf8"));
const version = root.version;
const expectedTag = "v" + version;
const event = process.env.GITHUB_EVENT_NAME ?? "";
const refType = process.env.GITHUB_REF_TYPE ?? "";
const refName = process.env.GITHUB_REF_NAME ?? "";
const dryRun = (process.env.DRY_RUN ?? "false").toLowerCase() === "true";

if (event === "release") {
  if (refName !== expectedTag) {
    console.error(
      "release tag '" + refName + "' does not match package version '" + expectedTag + "'",
    );
    process.exit(1);
  }
} else if (!dryRun) {
  if (refType !== "tag" || refName !== expectedTag) {
    console.error(
      "publishing requires tag '" +
        expectedTag +
        "'; ref was '" +
        (refName || "<none>") +
        "' (" +
        (refType || "unknown") +
        ")",
    );
    process.exit(1);
  }
}

if (dryRun) {
  console.log("release metadata OK for dry-run (package version " + version + ")");
} else {
  console.log("release tag " + expectedTag + " matches package version");
}
