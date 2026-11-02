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

`CliffDocument` contains `specVersion`, `header`, `groups`, an optional `path` and `corrections`. `path` is non-serialized runtime metadata used for file-layout warnings; CLIFF has no `path` field. `CliffGroup.path` is the section/group path, not a field either. `CliffHeader`, `CliffGroup` and `CliffEntry` use camelCase property names; JSON interchange uses kebab-case field names.

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

## @cliff-format/i18n

```ts
createI18n(options: I18nOptions): I18n

i18n.scope({ namespace, clan, group? }): { t, scope }
i18n.add(resource, options?): AddResult
i18n.addDocument(document, options?): AddResult
i18n.files(options?): CliffFile[]
i18n.toCliff(options?): string
i18n.setLocale(locale) / changeLanguage(locale)
i18n.subscribe(listener): () => void
i18n.format(message, params?, options?) / formatToParts(...)
i18n.validate() / diagnostics()
```

`namespace` and `clan` are required by `TranslationScope`. There is no default scope and no
`i18n.t` property; use `i18n.scope()` or the React hook.

The full entry uses `messageformat` for MF2 and `@messageformat/icu-messageformat-1` for MF1.
`@cliff-format/i18n/lite` excludes those dependencies. `@cliff-format/i18n/react` exports
`I18nProvider`, `useI18n` and `useTranslation`.

### Key input

```ts
type KeyInput =
  | string
  | { namespace?: string; clan?: string; group?: string; id: string };
```

Strings accept `namespace:clan.group.id`, `namespace.clan.group.id`,
`namespace/clan/group/id`, scoped short keys and unique ids. Ambiguity throws
`CliffAmbiguousKeyError`; a full key outside the scope throws `CliffScopeMismatchError`.

### Builder

```ts
t("key")                         // MessageBuilder<{ source: false; type: false }>
t("key", params)                 // string
t("key").render()                // lookup
t("key").source("Text")          // authoring; render is never until type is supplied
  .type(TYPE.label)              // A
  .typeFromGroup()               // B: explicit group inheritance
  .emotion(EMOTION.objective)
  .render();
```

Drafts are created on `render()` / `commit()` and exported by `toCliff()`. `source`,
effective `type` and `status` are enforced. `emotion` is optional by CLIFF and derives from
`type`; `requireEmotion` can tighten the project rule.

### Diagnostics

`missing-key`, `ambiguous-key`, `type-mismatch`, `emotion-mismatch`, `source-mismatch`,
`width-exceeded`, `icu-error`, `draft-created`, `fallback-used` and related codes are delivered
through `onDiagnostic` and `diagnostics()`.

## @cliff-format/translate

```ts
createDeepSeekTranslator(options): DeepSeekTranslator
translator.complete(messages, options?): Promise<DeepSeekCompletion>
translator.translate(cliffSource, options?): Promise<TranslationResult>
translator.translateDocument(document, options?): Promise<TranslationResult>
```

Defaults: `baseUrl: "https://api.deepseek.com"`, `model: "deepseek-flash"`,
`temperature: 1.3`, `thinking: "off"` (sent as `{"thinking":{"type":"disabled"}}`), `topP: 1`,
`maxTokens: 8192`, `timeoutMs: 180000`, `maxRetries: 2`.

The prompt contains CLIFF only. Responses are parsed with `parseTolerant`, validated, and merged by
canonical id; only `target` and `status` are copied. `reviewed`/`final` entries are preserved
unless `overwrite: "all"`. See the [translate package README](../packages/translate/README.md).

## @cliff-format/vite

```ts
cliff(options?): Plugin
```

Transforms `.cliff` into a module whose default export is the raw CLIFF string, generates
`virtual:cliff` resources and an ambient `CliffKey` union. Options: `dirs`, `include`,
`exclude`, `virtualModule`, `dts`, `typegen`, `reloadOnChange`. See the
[Vite package README](../packages/vite/README.md).

## Errors

- `CliffError`
- `CliffParseError` (`line`, `category`, `text`)
- `CliffValidationError` (`issues`, `corrections`)
- `UnsupportedSpecVersion` (`declared`, `supported`)
- `CliffLimitError` (`limit`, `observed`)
- `CliffModelError`
- `CliffScopeError`, `CliffScopeMismatchError`, `CliffMissingKeyError`, `CliffAmbiguousKeyError`, `CliffDuplicateKeyError`, `CliffMissingMetadataError`, `CliffIcuError`
- `DeepSeekConfigError`, `DeepSeekHttpError`, `TranslationParseError`, `TranslationValidationError`