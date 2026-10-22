import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
function arg(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const typePattern = "feat|fix|docs|test|refactor|perf|style|chore|build|ci|revert";
const subjectPattern = new RegExp(
  `^(?:\\[AI\\] )?(?:${typePattern})(?:\\([a-z0-9-]+(?:\\/[a-z0-9-]+)?\\))?!?: [^\\n]{1,72}$`,
);
const branchPattern =
  /^(?:feature|fix|docs|test|refactor|ci|build|chore|perf|style|prototype)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const failures = [];

function fail(message) {
  failures.push(message);
}

function checkEnglish(label, text) {
  if (cjk.test(text)) fail(`${label}: contains CJK characters`);
}

function checkSubject(label, subject) {
  if (!subjectPattern.test(subject)) {
    fail(`${label}: does not match '[AI] type(scope): English description'`);
  }
  if (subject.endsWith(".")) fail(`${label}: subject must not end with a period`);
  checkEnglish(label, subject);
}

function git(argsToRun) {
  return execFileSync("git", argsToRun, { encoding: "utf8" }).trim();
}

let insideGit = false;
try {
  insideGit = git(["rev-parse", "--is-inside-work-tree"]) === "true";
} catch {
  insideGit = false;
}

if (insideGit) {
  const base = arg("--base") ?? process.env.VCS_BASE;
  const head = arg("--head") ?? process.env.VCS_HEAD ?? "HEAD";
  let log = "";
  try {
    log = base
      ? execFileSync("git", ["log", "--format=%B%x00", `${base}..${head}`], { encoding: "utf8" })
      : execFileSync("git", ["log", "-1", "--format=%B"], { encoding: "utf8" });
  } catch (error) {
    fail(`cannot read git history: ${error.message}`);
  }
  for (const raw of log.split("\u0000")) {
    const message = raw.trim();
    if (!message) continue;
    const lines = message.split("\n");
    const subject = lines[0] ?? "";
    checkSubject("commit", subject);
    const rest = lines.slice(1).join("\n");
    checkEnglish("commit body", rest);
    if (/【|】/.test(message)) fail("commit: Chinese footer brackets are not allowed");
  }

  let branch = arg("--branch") ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME;
  if (!branch) {
    try {
      branch = git(["branch", "--show-current"]);
    } catch {
      branch = "";
    }
  }
  if (branch && branch !== "main" && branch !== "dev" && !branchPattern.test(branch)) {
    fail(`branch '${branch}' does not match '<type>/<english-slug>' or 'dev'`);
  }
  checkEnglish("branch", branch ?? "");

  const baseBranch = process.env.GITHUB_BASE_REF;
  if (baseBranch && baseBranch !== "main" && baseBranch !== "dev") {
    fail(`pull request base '${baseBranch}' must be 'dev' or 'main'`);
  }
}

const title = arg("--pr-title") ?? process.env.PR_TITLE;
if (title) checkSubject("PR title", title);

const tagMessage = arg("--tag-message") ?? process.env.TAG_MESSAGE;
if (tagMessage) {
  checkEnglish("tag message", tagMessage);
  if (!/^cliff-js \d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tagMessage.trim())) {
    fail("tag message must be 'cliff-js X.Y.Z'");
  }
}

if (existsSync("CHANGELOG.md")) {
  checkEnglish("CHANGELOG.md", readFileSync("CHANGELOG.md", "utf8"));
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("VCS checks passed");
