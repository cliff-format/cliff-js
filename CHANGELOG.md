# Changelog

All notable changes to the CLIFF JavaScript packages are recorded here. Each version lists the
features that changed behaviour, the packaging and documentation work around them, and the notes
that matter to people building against the library.

## 0.1.0 — 2026-10-22

First public release.

### New Features

- Added `@cliff-format/core`, a browser-first CLIFF 1.0/1.1 data model, strict parser, tolerant
  parser and canonical serializer.
- Added strict parsing that rejects exactly what the grammar rejects: identifiers are
  case-sensitive and never rewritten, tags stay in their closed vocabularies, terminators are
  accepted but never re-emitted, layout stays a warning, and resource limits are enforced.
- Added tolerant parsing with the seven relaxations of specification Appendix C, and a per-repair
  report covering list shape, repeated fields, quoted tags, quoted ids, quoted keys, identifier
  normalization, collisions and version spelling. The mode enforces the C.6 output guarantee.
- Added a canonical serializer that preserves the version line the document declared and is a
  fixed point under parse/serialize.
- Added validation for required fields, closed vocabularies, status rules, duplicate ids, ICU
  brace balance, file layout, display width and style.
- Added `@cliff-format/json` with lossless CLIFF-shaped JSON, plus flat and nested JSON for
  runtime resources. Imports report key normalization and collision repairs; flat and nested
  exports are documented as lossy.
- Added opt-in validation checks: `checkLayout` promotes a layout mismatch to an error,
  `style` reports style-guide deviations, and `checkWidth` reports display-width overflow.
- Added configurable resource limits for bytes, lines, line length, decoded strings, group path
  segments, list items and entry count, so an oversized document fails with a located error
  instead of exhausting memory.

### Other Changes

- Added a TypeScript API with ESM and CommonJS builds, conditional exports and strict declaration
  files.
- Added the English version control policy, commit and version checks, and CI workflows for
  Node 22/24/26 and Chromium/Firefox/WebKit.
- Adopted a `main`/`dev` branch workflow: feature and fix work targets `dev`; releases merge
  `dev` into `main` and are tagged on `main`.
- Vendored the CLIFF specification examples and `cliff-test` conformance fixtures with source
  metadata.
- Added package metadata checks with publint and Are the Types Wrong, plus an isolated tarball
  install smoke test.
- Restyled the README around the CLIFF wordmark, the package map and the browser-first API.
- Kept 0.1.0 focused on the core parser, serializer, validator and JSON converter. No CLI, Node
  file loader, benchmark, runtime i18n or additional format converter is included.

### For developers

- Node.js 22 or newer is required for tooling. The runtime packages have no dependencies;
  `@cliff-format/json` declares `@cliff-format/core` as a peer dependency.
- Build with `pnpm build` and validate package metadata with `pnpm check:package`.
- Run the test suite with `pnpm test` and the browser suite with `pnpm test:browser`.
- Run the full local gate with `pnpm verify`. No benchmark is included.