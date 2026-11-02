# Conformance

## Target

The implementation targets CLIFF 1.1 and accepts documents that declare CLIFF 1.0. The canonical
version line for a new document is `CLIFF 1.1`; a round-tripped 1.0 document keeps `CLIFF 1.0`.

## Test suites

| Suite | Assertion |
| --- | --- |
| Specification examples | strict parse, zero hard validation errors, canonical round trip and fixed point |
| `valid` fixtures | strict parse and zero hard errors |
| `invalid` fixtures | at least one hard error |
| `layout` fixtures | warnings by default, errors under `checkLayout` |
| `tolerant` fixtures | strict rejection, tolerant repair, strict-valid output and idempotence |
| `style` fixtures | zero hard errors and at least one style warning |
| Unrepairable tolerant fixtures | refused with a located error |
| i18n tests | entry ID resolution, scope enforcement, builder states, CLIFF round trip, ICU, React SSR |
| translate tests | DeepSeek defaults, fenced CLIFF, target merge, batching, repair |
| vite tests | scanning, virtual module, type generation, transform hooks |

The vendored fixtures and their source commits are recorded in `fixtures/upstream/SOURCE.json`.

## Tolerant mode

The implementation applies Appendix C.2's seven relaxations:

1. `list-shape` — bare scalar or comma series in a list-typed field.
2. `field-repeat` — concatenate a string field or append a list field.
3. `tag-quote` — remove quotes around a tag.
4. `name-quote` — remove quotes around an entry ID or key.
5. `name-normalized` — normalize entry IDs, group segments, namespace and clan with C.3.
6. `version` — accept spelling differences in the version line.
7. `name-quote` for quoted keys, under exactly the scope rules of a bare key.

Collisions are handled deterministically under C.4. The default is to append `-2`, `-3`, ...;
`onIdCollision: "error"` rejects instead.

The implementation does **not** add the following leniencies found in `cliff-python`:

- assuming a missing version line;
- folding the case of a tag;
- flattening a nested list.

These are not part of Appendix C. A repeated tag or integer field cannot be merged and is rejected
rather than dropped.

`parseTolerant` enforces C.6: it validates before returning, so a successful result serializes to a
strictly valid document and is a canonical fixed point.

## ICU

Core validation checks brace balance. The i18n full entry point additionally parses messages with
`messageformat` / `@messageformat/icu-messageformat-1` and reports parse failures as
`icu-error` diagnostics. Dialect detection follows CLIFF section 14 with an MF1 precedence check
for plural/select messages whose closing braces resemble MF2 markers. The lite entry refuses
complex ICU explicitly.

## Differences from `cliff-python`

`cliff-python` is a behavioural reference, not a byte-for-byte compatibility requirement.
Deliberate differences:

- Tolerant parsing implements only Appendix C; it does not guess a missing version, fold tag case or flatten nested lists.
- Namespace and clan are normalized under C.2.5 when they violate the name rule.
- Empty `emotion` lists, an empty `standard` file and ICU braces in header prose are reported under the specification's MUST requirements.
- Input handling is stricter: unpaired surrogates, C0/C1 controls and non-SP/HTAB whitespace outside strings are rejected.
- Width uses a generated UAX #11 table and grapheme clustering rather than the Python implementation's internal approximation.
- ICU width variants are not evaluated statically. Runtime `width()` measures the rendered variant; core `checkWidth` skips ICU targets with a warning.

## Known limitations

- Core alone is not a runtime localization engine; use `@cliff-format/i18n` for rendering.
- Flat and nested JSON are lossy; CLIFF-shaped JSON is the lossless form.
- The i18n runtime does not implement i18next plural/context key conventions; use CLIFF ids and ICU.
- ICU markup is rendered through parts; the runtime does not evaluate HTML.
- No CLI or Node file loader is part of 0.1.0.
- No benchmark is included.

## Running

```bash
pnpm test
pnpm test:coverage
pnpm test:browser
pnpm fixtures:check
```