import { CliffParseError } from "./errors.js";
import {
  hasStyleObligation,
  isName,
  isStyleIdentifier,
  LANG_RE,
  stripLineTerminator,
} from "./identifiers.js";
import { normalizeInput } from "./input.js";
import { layoutFindings } from "./layout.js";
import { resolveLimits } from "./limits.js";
import type {
  CliffDocument,
  CliffEntry,
  CliffGroup,
  IssueCategory,
  ValidateDocumentOptions,
  ValidationIssue,
} from "./model.js";
import { canonicalId, type ParseOptions, parseInternal } from "./parser.js";
import {
  EMOTION_TAGS,
  GLOSSARY_TYPES,
  SPEECH_TYPES,
  STATUS_TAGS,
  TYPE_TAGS,
  VARIANT_TAGS,
} from "./vocabulary.js";
import { displayWidth } from "./width.js";

export interface ValidateOptions extends ParseOptions {
  tolerant?: boolean;
  checkWidth?: boolean;
  checkLayout?: boolean;
  style?: boolean;
  onIdCollision?: "disambiguate" | "error";
}

function issue(line: number, category: IssueCategory, message: string, text = ""): ValidationIssue {
  return { line, category, message, text };
}

function braceBalance(value: string, line: number): ValidationIssue[] {
  if (!value.includes("{") && !value.includes("}")) return [];
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i] as string;
    if (char === "\\" && i + 1 < value.length) {
      i++;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth < 0) {
        return [issue(line, "icu", "unmatched closing brace '}' inside string", value)];
      }
    }
  }
  if (depth !== 0) {
    return [issue(line, "icu", `unbalanced ICU braces: ${depth} unclosed '{'`, value)];
  }
  return [];
}

function badTag(key: string, value: string, allowed: ReadonlySet<string>): string {
  return `${key}: invalid tag '${value}'; allowed: ${[...allowed].sort().join(", ")}`;
}

function extensionIssues(
  extensions: Record<string, string>,
  line: number,
  scope: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(extensions).sort()) {
    if (!isName(key) || !key.startsWith("x-")) {
      issues.push(issue(line, "id", `invalid ${scope} extension key '${key}'`));
      continue;
    }
    issues.push(
      issue(
        line,
        "extension",
        `unknown ${scope} extension field '${key}' is ignored`,
        `${key}: ${extensions[key]}`,
      ),
    );
  }
  return issues;
}

function styleIdentifier(
  issues: ValidationIssue[],
  line: number,
  kind: string,
  value: string,
  text = "",
): void {
  if (!value || isStyleIdentifier(value) || !hasStyleObligation(value)) return;
  issues.push(
    issue(
      line,
      "style",
      `${kind} '${value}' is valid CLIFF but does not follow style/README.md (recommended: kebab-case or PascalCase, not mixed)`,
      text || value,
    ),
  );
}

export function effectiveMaxWidth(entry: CliffEntry, group: CliffGroup): number | undefined {
  return entry.maxWidth ?? group.maxWidth;
}

export function effectiveType(entry: CliffEntry, group: CliffGroup): string | undefined {
  return entry.type ?? group.type;
}

export function effectiveEmotion(entry: CliffEntry, group: CliffGroup): string[] {
  if (entry.emotion.length > 0) return [...entry.emotion];
  if (group.emotion.length > 0) return [...group.emotion];
  return SPEECH_TYPES.has(effectiveType(entry, group) ?? "") ? ["neutral"] : ["objective"];
}

export function effectiveContext(entry: CliffEntry, group: CliffGroup): string | undefined {
  const parts = [group.context, entry.context].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function validateDocument(
  document: CliffDocument,
  options: ValidateDocumentOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const header = document.header;

  const required: [string, string][] = [
    ["namespace", header.namespace],
    ["clan", header.clan],
    ["source-language", header.sourceLanguage],
    ["target-language", header.targetLanguage],
  ];
  for (const [key, value] of required) {
    if (value.length === 0) {
      issues.push(issue(0, "semantic", `missing required header field '${key}'`));
    }
  }
  if (header.namespace.length > 0 && !isName(header.namespace)) {
    issues.push(issue(0, "id", `invalid namespace '${header.namespace}'`));
  }
  if (header.clan.length > 0 && !isName(header.clan)) {
    issues.push(issue(0, "id", `invalid clan '${header.clan}'`));
  }
  if (header.sourceLanguage.length > 0 && !LANG_RE.test(header.sourceLanguage)) {
    issues.push(issue(0, "semantic", `invalid source-language '${header.sourceLanguage}'`));
  }
  if (header.targetLanguage.length > 0 && !LANG_RE.test(header.targetLanguage)) {
    issues.push(issue(0, "semantic", `invalid target-language '${header.targetLanguage}'`));
  }
  if (!VARIANT_TAGS.has(header.variant)) {
    issues.push(issue(0, "vocabulary", badTag("variant", header.variant, VARIANT_TAGS)));
  }
  if (
    header.variant === "standard" &&
    document.groups.every((group) => group.entries.length === 0)
  ) {
    issues.push(issue(0, "semantic", "standard variant file has no entries"));
  }

  for (const finding of layoutFindings(document.path, header.clan, header.targetLanguage)) {
    issues.push(
      issue(
        0,
        options.checkLayout === true ? "semantic" : "warning",
        finding.message +
          (options.checkLayout === true ? "" : " (layout is a recommendation in CLIFF 1.1)"),
        finding.text,
      ),
    );
  }
  issues.push(...extensionIssues(header.extensions, 0, "header"));
  for (const correction of document.corrections) {
    issues.push(
      issue(
        correction.line,
        "correction",
        correction.before || correction.after
          ? `${correction.message} (was ${JSON.stringify(correction.before)}, now ${JSON.stringify(correction.after)})`
          : correction.message,
        correction.before || correction.after,
      ),
    );
  }

  const seenPaths = new Set<string>();
  const firstEntry = new Map<string, { line: number; canonical: string }>();
  const seenCanonical = new Set<string>();

  for (const group of document.groups) {
    if (group.path.length === 0 || !group.path.split(".").every((segment) => isName(segment))) {
      issues.push(issue(group.line, "id", `invalid section path '[${group.path}]'`));
    }
    if (seenPaths.has(group.path)) {
      issues.push(
        issue(group.line, "id", `duplicate section path '[${group.path}]'`, `[${group.path}]`),
      );
    }
    seenPaths.add(group.path);

    if (group.type !== undefined && !TYPE_TAGS.has(group.type)) {
      issues.push(
        issue(group.line, "vocabulary", badTag("type", group.type, TYPE_TAGS), group.type),
      );
    }
    for (const emotion of group.emotion) {
      if (!EMOTION_TAGS.has(emotion)) {
        issues.push(
          issue(group.line, "vocabulary", badTag("emotion", emotion, EMOTION_TAGS), emotion),
        );
      }
    }
    if (
      group.maxWidth !== undefined &&
      (!Number.isInteger(group.maxWidth) || group.maxWidth <= 0)
    ) {
      issues.push(issue(group.line, "semantic", "max-width must be a positive integer"));
    }
    if (group.context !== undefined) issues.push(...braceBalance(group.context, group.line));
    issues.push(...extensionIssues(group.extensions, group.line, "group"));

    for (const entry of group.entries) {
      if (!isName(entry.id)) {
        issues.push(issue(entry.line, "id", `invalid entry id '${entry.id}'`));
      }
      const canonical = canonicalId(header.namespace, header.clan, group.path, entry.id);
      const first = firstEntry.get(entry.id);
      if (first !== undefined) {
        issues.push(
          issue(
            entry.line,
            "id",
            `duplicate entry id '${entry.id}': also declared on line ${first.line}; conflicting canonical IDs '${first.canonical}' and '${canonical}'`,
            `<${entry.id}>`,
          ),
        );
      } else {
        firstEntry.set(entry.id, { line: entry.line, canonical });
      }
      if (seenCanonical.has(canonical)) {
        issues.push(
          issue(entry.line, "id", `duplicate canonical id '${canonical}'`, `<${entry.id}>`),
        );
      }
      seenCanonical.add(canonical);

      if (entry.source === undefined) {
        issues.push(
          issue(entry.line, "semantic", `entry '${entry.id}' is missing required field 'source'`),
        );
      }
      if (entry.status === undefined) {
        issues.push(
          issue(entry.line, "semantic", `entry '${entry.id}' is missing required field 'status'`),
        );
      }
      const resolvedType = effectiveType(entry, group);
      if (resolvedType === undefined) {
        issues.push(
          issue(
            entry.line,
            "semantic",
            `entry '${entry.id}' is missing required field 'type' and the group has no type`,
          ),
        );
      } else if (!TYPE_TAGS.has(resolvedType)) {
        issues.push(
          issue(entry.line, "vocabulary", badTag("type", resolvedType, TYPE_TAGS), resolvedType),
        );
      }
      if (
        entry.maxWidth !== undefined &&
        (!Number.isInteger(entry.maxWidth) || entry.maxWidth <= 0)
      ) {
        issues.push(issue(entry.line, "semantic", "max-width must be a positive integer"));
      }
      for (const emotion of entry.emotion) {
        if (!EMOTION_TAGS.has(emotion)) {
          issues.push(
            issue(entry.line, "vocabulary", badTag("emotion", emotion, EMOTION_TAGS), emotion),
          );
        }
      }
      if (entry.status !== undefined) {
        if (!STATUS_TAGS.has(entry.status)) {
          issues.push(
            issue(
              entry.line,
              "vocabulary",
              badTag("status", entry.status, STATUS_TAGS),
              entry.status,
            ),
          );
        }
        if (
          ["translated", "reviewed", "final"].includes(entry.status) &&
          entry.target === undefined
        ) {
          issues.push(
            issue(entry.line, "semantic", `status '${entry.status}' requires a target field`),
          );
        }
        if (entry.status === "initial" && entry.target !== undefined) {
          issues.push(issue(entry.line, "warning", "target is present but status is 'initial'"));
        }
      }
      for (const [, value] of [
        ["source", entry.source],
        ["target", entry.target],
        ["context", entry.context],
        ["reviewer", entry.reviewer],
      ] as const) {
        if (value !== undefined) issues.push(...braceBalance(value, entry.line));
      }
      issues.push(...extensionIssues(entry.extensions, entry.line, "entry"));

      if (options.checkWidth === true) {
        const maxWidth = effectiveMaxWidth(entry, group);
        if (maxWidth !== undefined && entry.target !== undefined) {
          if (entry.target.includes("{") || entry.target.includes("}")) {
            issues.push(
              issue(
                entry.line,
                "warning",
                "width check skipped for a target containing ICU syntax; variant evaluation is not implemented",
                entry.target,
              ),
            );
          } else {
            const cells = displayWidth(entry.target);
            if (cells > maxWidth) {
              issues.push(
                issue(
                  entry.line,
                  "warning",
                  `target display width ${cells} cells exceeds max-width ${maxWidth}: '${entry.target}'`,
                  entry.target,
                ),
              );
            }
          }
        }
      }

      if (header.variant === "glossary") {
        if (resolvedType !== undefined && !GLOSSARY_TYPES.has(resolvedType)) {
          issues.push(
            issue(
              entry.line,
              "warning",
              `glossary type '${resolvedType}' is not term-level; term-level types are: ${[...GLOSSARY_TYPES].sort().join(", ")}`,
              resolvedType,
            ),
          );
        }
        if (entry.target === undefined) {
          issues.push(issue(entry.line, "warning", "glossary entry is missing target"));
        }
      }
    }
  }

  for (const value of [header.title, header.info, header.standard]) {
    if (value !== undefined) issues.push(...braceBalance(value, 0));
  }

  if (options.style === true) {
    styleIdentifier(issues, 0, "namespace", header.namespace);
    styleIdentifier(issues, 0, "clan", header.clan);
    for (const group of document.groups) {
      for (const segment of group.path.split(".")) {
        styleIdentifier(issues, group.line, "group segment", segment, `[${group.path}]`);
      }
      for (const entry of group.entries) {
        styleIdentifier(issues, entry.line, "entry id", entry.id, `<${entry.id}>`);
      }
    }
  }

  return issues;
}

function terminatorStyleIssues(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] as string;
    const split = stripLineTerminator(raw);
    if (split.terminators.length > 0) {
      issues.push(
        issue(
          i + 1,
          "style",
          `line ends with a '${split.terminators.at(-1) as string}' terminator; CLIFF 1.1 accepts it but style/README.md recommends not writing it`,
          raw.trim(),
        ),
      );
    }
  }
  return issues;
}

export function validate(
  input: string | Uint8Array,
  options: ValidateOptions = {},
): ValidationIssue[] {
  let document: CliffDocument;
  try {
    document = parseInternal(input, options, options.tolerant === true);
  } catch (error) {
    if (error instanceof CliffParseError) {
      return [issue(error.line, error.category, error.message, error.text)];
    }
    throw error;
  }
  const issues = validateDocument(document, options);
  if (options.style === true) {
    try {
      const normalized = normalizeInput(input, resolveLimits(options));
      issues.push(...terminatorStyleIssues(normalized.text));
    } catch {
      // A parse already succeeded, so normalization should not fail here.
    }
  }
  return issues;
}
