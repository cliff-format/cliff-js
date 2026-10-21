# Security

## Input handling

All CLIFF input, JSON input and file names are untrusted.

- Byte input is decoded as strict UTF-8. Invalid bytes are rejected.
- Unpaired surrogate code units, raw control characters, bare CR and Unicode whitespace outside strings are rejected.
- The parser enforces configurable limits in strict and tolerant modes. Exceeding a limit raises a located error; data is never truncated silently.

| Limit | Default |
| --- | --- |
| `maxBytes` | 16 MiB |
| `maxLines` | 1,000,000 |
| `maxLineLength` | 1,048,576 UTF-16 code units |
| `maxStringLength` | 1,048,576 UTF-16 code units |
| `maxGroupSegments` | 64 |
| `maxListItems` | 10,000 |
| `maxEntries` | 1,000,000 |

JSON importers additionally enforce `maxDepth` and `maxEntries`.

## No evaluation

CLIFF strings, ICU payloads and extension values are never evaluated. The package does not provide an ICU formatter. Callers that render translations are responsible for using a safe formatter and for escaping HTML.

## Paths

`dependency` and `reference` are opaque path strings. The core package does not resolve them. A caller that loads dependencies must resolve them inside an explicit project root and reject paths that escape it.

## Prototype pollution

Extension maps are created without a prototype. JSON importers use own-property reads and do not assign arbitrary keys onto `Object.prototype`. Tests cover `__proto__` and `constructor` keys.

## No file I/O

The published packages do not read or write files. Byte input is passed by the caller. A future CLI or Node loader will be a separate package.
