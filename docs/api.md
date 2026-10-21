# API

## @cliff-format/core

### Parsing

```ts
parse(input: string | Uint8Array, options?: ParseOptions): CliffDocument
parseTolerant(input: string | Uint8Array, options?: TolerantParseOptions): TolerantParseResult
validate(input: string | Uint8Array, options?: ValidateOptions): ValidationIssue[]
validateDocument(document: CliffDocument, options?: ValidateDocumentOptions): ValidationIssue[]
serialize(document: CliffDocument, options?: { version?: "1.0" | "1.1" }): string
```

`parse` throws `CliffParseError` for syntax or structural errors. It does not check required fields, vocabularies, ICU balance, duplicate IDs, layout or width.

`parseTolerant` applies the Appendix C repairs, records every correction and validates the repaired document. It throws `CliffValidationError` when hard errors remain.

`validate` never throws for invalid CLIFF content; it returns issues. It accepts `tolerant`, `checkWidth`, `checkLayout`, `style` and `onIdCollision`.

`serialize` does not validate. It throws `CliffModelError` when a string cannot be represented.

### Model

`CliffDocument` contains `specVersion`, `header`, `groups`, an optional `path` and `corrections`. `CliffHeader`, `CliffGroup` and `CliffEntry` use camelCase property names; JSON interchange uses kebab-case field names.

Each group and entry carries a 1-based `line`. Hand-built models use `line: 0`.

### Diagnostics

```ts
type IssueCategory =
  | "syntax" | "semantic" | "vocabulary" | "icu" | "id"
  | "extension" | "warning" | "correction" | "style";

interface ValidationIssue {
  line: number;
  category: IssueCategory;
  message: string;
  text: string;
}
```

Advisory categories are `warning`, `extension`, `correction` and `style`. `hasErrors` returns true when any other category is present.

### Utilities

- `canonicalId(namespace, clan, groupPath, entryId)`
- `effectiveContext`, `effectiveType`, `effectiveEmotion`, `effectiveMaxWidth`
- `displayWidth(text)`
- `isName`, `isTag`, `normalizeIdentifier`, `uniqueIdentifier`, `stripLineTerminator`
- vocabulary exports: `TYPE_TAGS`, `EMOTION_TAGS`, `STATUS_TAGS`, `VARIANT_TAGS`, `GLOSSARY_TYPES`, `SPEECH_TYPES`

### Resource limits

```ts
interface ResourceLimits {
  maxBytes?: number;
  maxLines?: number;
  maxLineLength?: number;
  maxStringLength?: number;
  maxGroupSegments?: number;
  maxListItems?: number;
  maxEntries?: number;
}
```

Defaults are 16 MiB, 1,000,000 lines, 1,048,576 UTF-16 code units per line and string, 64 group segments, 10,000 list items and 1,000,000 entries.

## @cliff-format/json

```ts
toCliJson(document): CliJsonObject
fromCliJson(value): CliffDocument
toJsonString(document, space?): string
fromJsonString(text): CliffDocument

fromFlatJson(value, options): ConvertResult
toFlatJson(document, options?): Record<string, string>
fromNestedJson(value, options): ConvertResult
toNestedJson(document, options?): Record<string, unknown>
```

CLIFF-shaped JSON is the lossless form. It uses these top-level fields:

```json
{
  "spec-version": "1.1",
  "header": {},
  "groups": []
}
```

Flat/nested output is lossy and only carries keys and values. Import options require `namespace`, `clan`, `sourceLanguage` and `targetLanguage`.

`ConvertResult` contains the imported document and a `warnings` list for key normalization and collision repairs.

See the [JSON package README](../packages/json/README.md) for the complete options.

## Errors

- `CliffError`
- `CliffParseError` (`line`, `category`, `text`)
- `CliffValidationError` (`issues`, `corrections`)
- `UnsupportedSpecVersion` (`declared`, `supported`)
- `CliffLimitError` (`limit`, `observed`)
- `CliffModelError`
