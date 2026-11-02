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
- The i18n runtime does not evaluate HTML. `format()` returns text; `formatToParts()` returns structured literal, expression and markup parts for the caller to render safely.
- The DeepSeek client never reads environment variables. Callers inject an API key or proxy headers; browser builds must use a server-side proxy.
- The Vite plugin reads files under its configured directories at build time and writes only the configured declaration file.

## No file I/O in core

`@cliff-format/core`, `@cliff-format/json`, `@cliff-format/i18n` and `@cliff-format/translate` do
not read or write files. Byte input is decoded by the caller or passed to the parser as
`Uint8Array`. `@cliff-format/vite` is a build tool and reads only its configured CLIFF directories.