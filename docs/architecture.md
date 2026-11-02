# Architecture

## Packages

| Package | Responsibility | Runtime dependencies |
| --- | --- | --- |
| `@cliff-format/core` | model, parser, serializer, validator, identifiers, width, layout | none |
| `@cliff-format/json` | CLIFF-shaped, flat and nested JSON conversion | peer `@cliff-format/core` |
| `@cliff-format/i18n` | CLIFF runtime catalog, entry ID resolution, `t()` builder, ICU, diagnostics | peer `@cliff-format/core`; `messageformat`, `@messageformat/icu-messageformat-1`; optional peer React |
| `@cliff-format/translate` | DeepSeek client, CLIFF prompt and tolerant response merge | peer `@cliff-format/core` |
| `@cliff-format/vite` | `.cliff` module transform, `virtual:cliff`, type generation, HMR | peer `@cliff-format/core`, `vite` |

Core never imports another workspace package. The web packages depend on the core public API; they
do not add a new localization file format.

## Data flow

```text
string / Uint8Array
        |
        v
 input normalization (UTF-8, BOM, CRLF, limits)
        |
        v
 parser state machine  ── corrections (tolerant mode only)
        |
        v
 CliffDocument  ──────────────> serializer ──> canonical CLIFF
        |
        +──> validator ──> ValidationIssue[]
        |
        +──> @cliff-format/json ──> CLIFF-shaped / flat / nested JSON
        |
        +──> @cliff-format/i18n catalog ──> entry ID resolution ──> t() ──> ICU ──> string | parts
        |
        +──> @cliff-format/translate ──> DeepSeek ──> CLIFF ──> parse/validate/merge
```

The Vite plugin embeds the raw CLIFF text in the module graph. It does not compile resources to
JSON.

## Invariants

1. `parse` is a strict syntax/structure parser. It does not enforce required fields, vocabularies, ICU balance, duplicate identifiers, layout or width.
2. `validate` is the conformance gate. It never throws for invalid CLIFF content.
3. `parseTolerant` applies only the Appendix C repairs, then validates. It returns a document only when the repaired output is strictly valid.
4. `serialize` emits the version line the document declared and never rewrites identifiers.
5. Comments, blank lines and trailing terminators are not part of the model.
6. Extensions are preserved as raw CLIFF text and stay local to their container.
7. JSON importers never silently overwrite a key or identifier; renames and collisions are reported.
8. The core entry point is browser-safe: no Node built-ins, no file I/O, no evaluation of document content.
9. The i18n runtime is a view over CLIFF documents. It never converts a document to a JSON resource.
10. `t()` scope requires namespace and clan. Authoring cannot `render()` before `source` and an effective `type` exist.
11. Translation copies only `target` and `status`; structure and metadata come from the original CLIFF document.
12. File paths are build/runtime metadata, not CLIFF fields. `CliffDocument.path` is never serialized.

## Error model

- `CliffParseError` — syntax or structural parse failure.
- `CliffValidationError` — semantic validation failure from a validating operation such as `parseTolerant`; carries all issues.
- `CliffLimitError` — a documented resource limit was exceeded.
- `CliffModelError` — a malformed model or JSON object.
- `UnsupportedSpecVersion` — a CLIFF version this build does not implement.
- `CliffError` — base class.
- `CliffScopeError`, `CliffScopeMismatchError`, `CliffMissingEntryError`, `CliffAmbiguousEntryError`, `CliffDuplicateEntryError`, `CliffMissingMetadataError`, `CliffIcuError` — runtime localization errors.
- `DeepSeekConfigError`, `DeepSeekHttpError`, `TranslationParseError`, `TranslationValidationError` — translation errors.

## Versioning

All published packages share one fixed version. The repository release tag is `vX.Y.Z`. See [version-control.md](version-control.md).