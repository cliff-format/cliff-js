# Architecture

## Packages

| Package | Responsibility | Runtime dependencies |
| --- | --- | --- |
| `@cliff-format/core` | model, parser, serializer, validator, identifiers, width, layout | none |
| `@cliff-format/json` | CLIFF-shaped, flat and nested JSON conversion | peer `@cliff-format/core` |

Future packages — CLI, runtime i18n, AI integration, Vite integration and the other format converters — depend on core. Core never imports them.

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
        v
 validator ──> ValidationIssue[]
        |
        v
 @cliff-format/json ──> CLIFF-shaped / flat / nested JSON
```

## Invariants

1. `parse` is a strict syntax/structure parser. It does not enforce required fields, vocabularies, ICU balance, duplicate identifiers, layout or width.
2. `validate` is the conformance gate. It never throws for invalid CLIFF content.
3. `parseTolerant` applies only the Appendix C repairs, then validates. It returns a document only when the repaired output is strictly valid.
4. `serialize` emits the version line the document declared and never rewrites identifiers.
5. Comments, blank lines and trailing terminators are not part of the model.
6. Extensions are preserved as raw CLIFF text and are never inherited.
7. JSON importers never silently overwrite a key or identifier; renames and collisions are reported.
8. The core entry point is browser-safe: no Node built-ins, no file I/O, no evaluation of document content.

## Error model

- `CliffParseError` — syntax or structural parse failure.
- `CliffValidationError` — semantic validation failure from a validating operation such as `parseTolerant`; carries all issues.
- `CliffLimitError` — a documented resource limit was exceeded.
- `CliffModelError` — a malformed model or JSON object.
- `UnsupportedSpecVersion` — a CLIFF version this build does not implement.
- `CliffError` — base class.

## Versioning

All published packages share one fixed version. The repository release tag is `vX.Y.Z`. See [version-control.md](version-control.md).
