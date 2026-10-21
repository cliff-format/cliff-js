import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const check = process.argv.includes("--check");
const strict = process.argv.includes("--strict");
const source = JSON.parse(readFileSync("fixtures/upstream/SOURCE.json", "utf8"));
const failures = [];

const repositories = {
  cliff: {
    sibling: "../cliff",
    paths: ["spec/examples", "references"],
  },
  "cliff-test": {
    sibling: "../cliff-test",
    paths: ["tests/fixtures"],
  },
};

for (const [name, entry] of Object.entries(source)) {
  if (!existsSync(join("fixtures/upstream", name === "cliff-test" ? "conformance" : "examples"))) {
    failures.push(`fixtures/upstream is missing content for ${name}`);
  }
  const sibling = repositories[name]?.sibling;
  if (!sibling || !existsSync(sibling)) {
    const message = `sibling repository ${sibling ?? "<unknown>"} is not available; cannot verify ${name} commit`;
    if (strict) failures.push(message);
    else console.warn(message);
    continue;
  }
  let head = "";
  try {
    head = execFileSync("git", ["-C", sibling, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    failures.push(`cannot read HEAD of ${sibling}`);
    continue;
  }
  if (head !== entry.commit) {
    failures.push(`${name}: vendored commit ${entry.commit} does not match sibling HEAD ${head}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(check ? 1 : 1);
}
console.log("fixtures are consistent with SOURCE.json");
