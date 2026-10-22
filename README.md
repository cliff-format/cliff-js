<h1 align="center">CLIFF for JavaScript</h1>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/cliff-format/cliff-js/main/docs/assets/cliff-wordmark-dark.svg">
    <img alt="CLIFF — the Contextual Localization Integrated File Format"
         src="https://raw.githubusercontent.com/cliff-format/cliff-js/main/docs/assets/cliff-wordmark-light.svg"
         width="420">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/cliff-format/cliff-js/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/cliff-format/cliff-js/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/cliff-format/cliff/blob/main/spec/cliff-1.1.0.md"><img alt="CLIFF 1.0 | 1.1" src="https://img.shields.io/badge/CLIFF-1.0%20%7C%201.1-2ea043"></a>
  <img alt="Node.js 22+" src="https://img.shields.io/badge/node-%E2%89%A522-339933">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-2ea043"></a>
  <img alt="Version 0.1.0" src="https://img.shields.io/badge/version-0.1.0-blue">
</p>

---

CLIFF keeps translation context — namespace, clan, group path, entry id, type, emotion,
width — next to every string, in a line-oriented format that stays cheap for translators and
LLMs alike. **cliff-js** is the JavaScript and TypeScript implementation of that format: a typed
data model, a strict parser, a tolerant parser, a canonical serializer, a validator, and JSON
converters for browser and Node.js pipelines.

| | |
| --- | --- |
| **Parse** | Strict mode rejects exactly what the grammar rejects; tolerant mode applies the seven documented repairs of Appendix C and reports each one. |
| **Serialize** | Canonical output that round-trips, preserving the specification version the document declared. |
| **Validate** | Required fields, closed vocabularies, status rules, duplicate ids, ICU brace balance, layout, display width, and style. |
| **Convert** | Lossless CLIFF-shaped JSON, plus flat and nested JSON for runtime resources. |
| **Typed and browser-first** | ESM, CommonJS and .d.ts from one source; no runtime dependencies and no Node built-ins in the browser entry points. |

The implementation targets CLIFF 1.1 and is checked against the normative examples of both 1.0
and 1.1, plus the [cliff-test](https://github.com/cliff-format/cliff-test) conformance fixtures.

## Packages

| Package | Purpose |
| --- | --- |
| [`@cliff-format/core`](packages/core/README.md) | Data model, strict and tolerant parser, canonical serializer, validator |
| [`@cliff-format/json`](packages/json/README.md) | CLIFF-shaped, flat and nested JSON conversion |

The core package contains no Node built-ins and no runtime dependencies. `@cliff-format/json`
declares `@cliff-format/core` as a peer dependency.

## Installation

~~~bash
pnpm add @cliff-format/core
~~~

Add the JSON package when converting to or from JSON resources:

~~~bash
pnpm add @cliff-format/core @cliff-format/json
~~~

Node.js 22 or newer is required for the build and test tooling. The published packages run in
modern browsers.

## Quick start

~~~ts
import { parse, serialize, validate } from "@cliff-format/core";

const text = [
  "CLIFF 1.1",
  "namespace: demo",
  "clan: settings",
  "source-language: en-US",
  "target-language: zh-CN",
  "",
  "[Video]",
  "type: label",
  "",
  "<Resolution>",
  'source: "Resolution"',
  'target: "分辨率"',
  "status: final",
  "",
].join("\n");

const document = parse(text);
console.log(document.specVersion);               // "1.1"
console.log(document.header.namespace);          // "demo"
console.log(document.groups[0]?.path);           // "Video"
console.log(document.groups[0]?.entries[0]?.id); // "Resolution"

console.log(serialize(document));                 // canonical CLIFF

for (const issue of validate(text)) {
  console.log(issue.line, issue.category, issue.message);
}
~~~

`parse` is the strict syntax and structure parser. It does not enforce required fields,
vocabularies, ICU balance, duplicate ids, layout or width. `validate` is the full semantic gate
and returns diagnostics instead of throwing for invalid CLIFF content.

## Strict and tolerant parsing

CLIFF 1.1 defines two readings of the same syntax, and `@cliff-format/core` exposes both. Strict
is the default; the mode is never chosen for you.

**Strict** (`parse`) rejects everything the grammar rejects:

- identifiers may use `A-Z a-z 0-9 _ -`, never `.`, are case-sensitive, and are never rewritten;
- tags (`type`, `emotion`, `status`, `variant`) stay in their closed vocabularies;
- one optional trailing `,` or `;` per line is accepted and is never re-emitted;
- a file-layout mismatch is a warning, because layout is a recommendation;
- resource limits are enforced.

**Tolerant** (`parseTolerant`) adds the seven relaxations of Appendix C and reports every repair:

| Relaxation | Input | Result |
| --- | --- | --- |
| C.2.1 bare scalar in a list-typed field | `emotion: objective` | `["objective"]` |
| C.2.2 repeated field in one scope | two `target:` lines | concatenated / appended in order |
| C.2.3 quoted tag | `status: "final"` | `final` |
| C.2.4 quoted entry id | `<"resolution">` | `resolution` |
| C.2.5 identifier with a reserved character | `<Save & Load>` | `Save-Load` (+ collision handling) |
| C.2.6 version-line spelling | `cliff 1.1.0` | `CLIFF 1.1` |
| C.2.7 quoted key | `"context": "…"` | `context: "…"` |

Every repair is recorded, so nothing is fixed silently:

~~~ts
import { parseTolerant } from "@cliff-format/core";

const { document, corrections } = parseTolerant(modelOutput);
for (const correction of corrections) {
  console.log(correction.line, correction.category, correction.message, correction.before, "->", correction.after);
}
~~~

Categories: `list-shape`, `field-repeat`, `tag-quote`, `name-quote`, `name-normalized`,
`id-collision`, `version`.

The mode never guesses. Appendix C.5 lists what a tolerant parser must refuse — a missing
required field, a word outside a closed vocabulary, an unbalanced ICU brace, a malformed line, an
unsupported version — and those raise `CliffParseError` or `CliffValidationError` with a line
number and a category.

`parseTolerant` enforces the C.6 output guarantee: the repaired document validates under the
strict rules, and canonical output is a fixed point.

The JavaScript implementation follows Appendix C and does not add the extra `cliff-python`
leniencies for a missing version line, tag case folding or nested list flattening. See
[docs/conformance.md](docs/conformance.md) for the complete difference list.

## JSON conversion

`@cliff-format/json` provides three shapes:

- **CLIFF-shaped JSON** — the lossless form. It preserves the header, group metadata, every entry
  field, extensions and the declared specification version.
- **Flat JSON** — dotted keys mapped to strings.
- **Nested JSON** — nested objects suitable for simple i18next resources.

~~~ts
import { parse } from "@cliff-format/core";
import {
  fromCliJson,
  fromFlatJson,
  toCliJson,
  toFlatJson,
  toNestedJson,
} from "@cliff-format/json";

const document = parse(text);

const lossless = toCliJson(document);
const restored = fromCliJson(lossless);

const { document: imported, warnings } = fromFlatJson(
  { "video.resolution": "分辨率" },
  {
    namespace: "demo",
    clan: "settings",
    sourceLanguage: "en-US",
    targetLanguage: "zh-CN",
  },
);

const flat = toFlatJson(imported, { keyStyle: "canonical" });
const nested = toNestedJson(imported);
~~~

Flat and nested JSON are lossy runtime-resource views. They do not carry header prose, context,
types, emotion, status, width, reviewer, references or extensions. Use CLIFF-shaped JSON when
those matter.

| Format | Fidelity |
| --- | --- |
| CLIFF-shaped JSON | Lossless |
| Flat JSON | key/value only |
| Nested JSON | key/value only |

Import options include `valueRole`, `entryType`, `entryStatus` and `keySeparator`.
i18next plural, context and namespace semantics belong to the future `@cliff-format/i18n`
package. See the [JSON package README](packages/json/README.md) for the complete option list.

## API

| Function | Description |
| --- | --- |
| `parse(input, options?)` | Strict syntax and structure parser. Throws `CliffParseError`. |
| `parseTolerant(input, options?)` | Appendix C repairs plus full validation. Returns `{ document, corrections }`. |
| `validate(input, options?)` | Full semantic validation. Returns `ValidationIssue[]`. |
| `validateDocument(document, options?)` | Validate a hand-built or imported document. |
| `serialize(document, options?)` | Canonical CLIFF output. |
| `displayWidth(text)` | Rendered display width under UAX #11, with grapheme clustering. |
| `effectiveContext / effectiveType / effectiveEmotion / effectiveMaxWidth` | Resolve a group-inherited value for one entry. |
| `canonicalId / isName / isTag / normalizeIdentifier` | Identifier rules and canonical ids. |
| `toCliJson / fromCliJson / toJsonString / fromJsonString` | Lossless CLIFF-shaped JSON. |
| `fromFlatJson / toFlatJson / fromNestedJson / toNestedJson` | Runtime-resource JSON views. |

### Diagnostics

| Category | Meaning |
| --- | --- |
| `syntax`, `semantic`, `vocabulary`, `icu`, `id` | Errors: the file does not conform. |
| `warning` | A recommendation (layout mismatch, glossary shape, width overflow). |
| `extension` | An `x-` field was ignored, as the specification requires. |
| `correction` | A tolerant parse repaired something; reports `before` → `after`. |
| `style` | A deviation from the style guide; never an error. |

### Resource limits

`parse`, `parseTolerant` and `validate` accept configurable limits:

| Limit | Default |
| --- | --- |
| `maxBytes` | 16 MiB |
| `maxLines` | 1,000,000 |
| `maxLineLength` | 1,048,576 UTF-16 code units |
| `maxStringLength` | 1,048,576 UTF-16 code units |
| `maxGroupSegments` | 64 |
| `maxListItems` | 10,000 |
| `maxEntries` | 1,000,000 |

Exceeding a limit raises a located `CliffLimitError` instead of exhausting memory. Limits apply
in strict and tolerant mode alike.

## Browser usage

The root entry points use only standard JavaScript, `TextEncoder`/`TextDecoder` and `Intl` APIs.
They do not import Node built-ins.

~~~ts
const bytes = new Uint8Array(await file.arrayBuffer());
const document = parse(bytes);
const issues = validate(bytes);
~~~

Both string and `Uint8Array` input are accepted; byte input is decoded as strict UTF-8. The
packages can run in a module worker. See [docs/browser.md](docs/browser.md).

## Repository layout

~~~text
cliff-js/
├── packages/
│   ├── core/          # @cliff-format/core
│   └── json/          # @cliff-format/json
├── fixtures/upstream/ # specification examples and conformance fixtures
├── docs/              # architecture, API, conformance, security, VCS policy
├── browser/           # Playwright browser smoke test
├── scripts/           # checks, fixture sync, package smoke test
└── .github/workflows/ # CI, VCS and release workflows
~~~

The core package has no runtime dependencies. Future CLI, i18n, AI, build-plugin and other
format-converter packages will live beside it and depend on the core public API.

## Development

~~~bash
pnpm install
pnpm verify
~~~

`pnpm verify` runs lint, type checking, tests, builds, package metadata checks, version checks,
boundary checks, the browser bundle check and the fixture provenance check. The Playwright suite
runs in CI with `pnpm test:browser`.

The repository follows the English-only [version control policy](docs/version-control.md).
Documentation-only changes skip the heavy `CI` workflow; the lightweight `VCS` workflow still
checks the commit message. A full run can be started manually from the Actions tab.

## Links

- [CLIFF specification](https://github.com/cliff-format/cliff/blob/main/spec/cliff-1.1.0.md)
- [CLIFF ABNF](https://github.com/cliff-format/cliff/blob/main/spec/abnf/cliff-1.1.abnf)
- [Conformance fixtures](https://github.com/cliff-format/cliff-test/tree/main/tests/fixtures)
- [Conformance notes](docs/conformance.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Issues](https://github.com/cliff-format/cliff-js/issues)
- [Version control policy](docs/version-control.md)

## License

MIT — see [LICENSE](LICENSE). The CLIFF wordmark under `docs/assets/` comes from the CLIFF
project and is licensed under the MIT License as well.