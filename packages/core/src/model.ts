export type SpecVersion = "1.0" | "1.1";

export type CliffInput = string | Uint8Array;

export type IssueCategory =
  | "syntax"
  | "semantic"
  | "vocabulary"
  | "icu"
  | "id"
  | "extension"
  | "warning"
  | "correction"
  | "style";

export interface ValidationIssue {
  line: number;
  category: IssueCategory;
  message: string;
  text: string;
}

export type CorrectionCategory =
  | "list-shape"
  | "field-repeat"
  | "tag-quote"
  | "name-quote"
  | "name-normalized"
  | "id-collision"
  | "version";

export interface Correction {
  line: number;
  category: CorrectionCategory;
  message: string;
  before: string;
  after: string;
}

export const ADVISORY_CATEGORIES = ["warning", "extension", "correction", "style"] as const;

export function isAdvisory(issue: ValidationIssue): boolean {
  return (ADVISORY_CATEGORIES as readonly string[]).includes(issue.category);
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => !isAdvisory(issue));
}

export interface CliffHeader {
  namespace: string;
  clan: string;
  sourceLanguage: string;
  targetLanguage: string;
  version?: string;
  variant: string;
  title?: string;
  info?: string;
  standard?: string;
  dependency: string[];
  extensions: Record<string, string>;
}

export interface CliffGroup {
  path: string;
  line: number;
  context?: string;
  type?: string;
  emotion: string[];
  maxWidth?: number;
  entries: CliffEntry[];
  extensions: Record<string, string>;
}

export interface CliffEntry {
  id: string;
  line: number;
  source?: string;
  target?: string;
  type?: string;
  emotion: string[];
  status?: string;
  context?: string;
  maxWidth?: number;
  reference: string[];
  reviewer?: string;
  extensions: Record<string, string>;
}

export interface CliffDocument {
  specVersion: SpecVersion;
  header: CliffHeader;
  groups: CliffGroup[];
  path?: string;
  corrections: Correction[];
}

export interface TolerantParseResult {
  document: CliffDocument;
  corrections: Correction[];
}

export interface ValidateDocumentOptions {
  checkWidth?: boolean;
  checkLayout?: boolean;
  style?: boolean;
}

export function createExtensions(): Record<string, string> {
  return Object.create(null) as Record<string, string>;
}

export function createHeader(): CliffHeader {
  return {
    namespace: "",
    clan: "",
    sourceLanguage: "",
    targetLanguage: "",
    variant: "standard",
    dependency: [],
    extensions: createExtensions(),
  };
}

export function createDocument(specVersion: SpecVersion = "1.1"): CliffDocument {
  return {
    specVersion,
    header: createHeader(),
    groups: [],
    corrections: [],
  };
}
