import { readFileSync } from "node:fs";

const root = JSON.parse(readFileSync("package.json", "utf8"));
const tag = process.env.GITHUB_REF_NAME ?? "";
if (tag !== `v${root.version}`) {
  console.error(`release tag '${tag}' does not match package version 'v${root.version}'`);
  process.exit(1);
}
console.log(`release tag ${tag} matches package version`);
