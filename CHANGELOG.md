# Changelog

All notable changes to the CLIFF JavaScript packages are recorded here.

## 0.1.0 — 2026-10-22

First release.

### New Features

- Added `@cliff-format/core`, a browser-first CLIFF 1.0/1.1 data model, strict parser, tolerant parser and canonical serializer.
- Added full semantic validation for required fields, closed vocabularies, status rules, duplicate identifiers, ICU brace balance, file layout, display width and style.
- Added the Appendix C tolerant repairs with per-repair reports and deterministic identifier normalization and collision handling.
- Added opt-in layout, width and style checks.
- Added `@cliff-format/json` with lossless CLIFF-shaped JSON and lossy flat/nested JSON conversion.

### Other Changes

- Added a TypeScript API with ESM and CommonJS builds and strict declaration files.
- Added the English version control policy, validation scripts and CI workflows.
- Vendored the CLIFF specification examples and `cliff-test` conformance fixtures with source metadata.

### For developers

- Requires Node.js 22 or newer for tooling; the runtime packages have no dependencies.
- Run `pnpm verify` for lint, type checking, tests, build and package checks.
- No benchmark is included.
