export interface LayoutFinding {
  message: string;
  text: string;
}

const LANGUAGE_DIR_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, "/");
}

function baseName(path: string): string {
  const normalized = normalizeSeparators(path).replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function parentName(path: string): string {
  const normalized = normalizeSeparators(path).replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return "";
  return baseName(normalized.slice(0, index));
}

function stemOf(name: string): string {
  if (name.endsWith(".cliff")) return name.slice(0, -6);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function layoutFindings(
  path: string | undefined,
  clan: string,
  targetLanguage: string,
): LayoutFinding[] {
  if (path === undefined || path.length === 0 || clan.length === 0 || targetLanguage.length === 0) {
    return [];
  }
  const name = baseName(path);
  const parent = parentName(path);
  const stem = stemOf(name);
  const target = targetLanguage.toLowerCase();
  const findings: LayoutFinding[] = [];

  if (LANGUAGE_DIR_RE.test(parent)) {
    if (parent.toLowerCase() !== target) {
      findings.push({
        message: `folder layout mismatch: directory '${parent}' does not match target-language '${targetLanguage}'`,
        text: path,
      });
    }
    if (stem !== clan) {
      findings.push({
        message: `folder layout mismatch: file name '${stem}' does not match clan '${clan}'`,
        text: path,
      });
    }
  }

  const dot = stem.indexOf(".");
  if (dot > 0) {
    const flatClan = stem.slice(0, dot);
    const flatLanguage = stem.slice(dot + 1);
    if (LANGUAGE_DIR_RE.test(flatLanguage)) {
      if (flatClan !== clan || flatLanguage.toLowerCase() !== target) {
        findings.push({
          message: `flat layout mismatch: '${stem}.cliff' does not match header clan '${clan}' and target-language '${targetLanguage}'`,
          text: path,
        });
      }
    }
  }

  return findings;
}
