# Security

## Supported versions

Security fixes are applied to the latest published 0.x release.

## Reporting

Report a vulnerability privately to the CLIFF maintainers. Do not open a public issue before a fix is available.

## Untrusted input

CLIFF documents, JSON resources and file names are untrusted input.

- The parser enforces documented resource limits in strict and tolerant modes.
- Decoded strings are bounded by `maxStringLength`; lines, bytes, list items, group segments and entries have separate limits.
- The package never evaluates CLIFF strings, ICU messages or extension values.
- The package does not resolve `dependency` or `reference` paths. Callers must resolve those inside an explicit project root and reject escapes.
- UI code must escape document text before inserting it into HTML.
- Extension maps are created without a prototype to prevent prototype pollution.
- JSON importers reject non-string leaves, excessive depth, excessive entry counts and key collisions.

## No file I/O in core

`@cliff-format/core` and `@cliff-format/json` do not read or write files. Byte input is decoded by the caller or passed to the parser as `Uint8Array`.
