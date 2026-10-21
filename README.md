# CLIFF for JavaScript and TypeScript

Browser-first parser, serializer and validator for **CLIFF 1.0 / 1.1**, the Contextual Localization Integrated File Format.

This repository is the JavaScript/TypeScript implementation of the CLIFF specification. It is a pnpm workspace with two published packages:

| Package | Purpose |
| --- | --- |
| [`@cliff-format/core`](packages/core/README.md) | CLIFF data model, strict and tolerant parser, canonical serializer, validator |
| [`@cliff-format/json`](packages/json/README.md) | CLIFF-shaped, flat and nested JSON converters |

Future functionality — CLI, runtime i18n, AI translation integration, Vite integration and the other format converters — is intentionally kept out of the core package and will ship as separate packages.

## Install

```bash
pnpm add @cliff-format/core @cliff-format/json
```

Node 22 or newer is required for tooling. The packages have no runtime dependencies and run in modern browsers.

## Quick start

```ts
import { parse, validate, serialize } from "@cliff-format/core";

const text = `CLIFF 1.1
namespace: demo
clan: settings
source-language: en-US
target-language: zh-CN

[Video]
type: label

<Resolution>
source: "Resolution"
target: "分辨率"
status: final
`;

const document = parse(text);
const issues = validate(text);

if (issues.length === 0) {
  console.log(serialize(document));
}
```

- `parse` performs strict syntax and structural parsing. It does not enforce required fields, vocabularies, ICU balance, duplicate IDs, layout or width.
- `validate` parses and performs the complete semantic validation. It returns issues instead of throwing for invalid CLIFF content.
- `serialize` writes canonical CLIFF. It preserves the version line the document declared and does not rewrite identifiers.

### Tolerant parsing

Tolerant parsing is opt-in and follows Appendix C of the specification. It repairs the documented shapes, records every repair and only returns a document when the repaired output is strictly valid.

```ts
import { parseTolerant } from "@cliff-format/core";

const { document, corrections } = parseTolerant(modelOutput);
for (const correction of corrections) {
  console.log(correction.line, correction.category, correction.message);
}
```

### JSON conversion

```ts
import { parse } from "@cliff-format/core";
import { toCliJson, fromCliJson, toFlatJson } from "@cliff-format/json";

const document = parse(text);
const lossless = toCliJson(document);
const restored = fromCliJson(lossless);
const flat = toFlatJson(document, { keyStyle: "canonical" });
```

The CLIFF-shaped JSON form is lossless. Flat and nested JSON are lossy runtime-resource views; the [JSON package README](packages/json/README.md) lists what they omit.

## Conformance

| Capability | Status |
| --- | --- |
| CLIFF 1.0 / 1.1 parser | Yes |
| Tolerant parser (Appendix C) | Yes |
| Canonical serializer | Yes |
| Validator | Yes |
| Style checker | Yes, opt-in warnings |
| Layout checker | Yes, warnings by default |
| Display width | Yes, opt-in; ICU variants are not evaluated |
| Converters | JSON only in 0.1.0 |

The test suite runs the normative specification examples and the `cliff-test` conformance fixtures. See [docs/conformance.md](docs/conformance.md).

## Browser support

The root entry points use only standard JavaScript, `TextEncoder`/`TextDecoder`, `Intl.Segmenter` and `Intl` APIs. They do not import Node built-ins. See [docs/browser.md](docs/browser.md).

## Version control

This repository follows the English-only version control policy in [docs/version-control.md](docs/version-control.md). Commits, branches, pull request titles, tags and changelog entries are English.

## Development

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs lint, type checking, tests, builds, package metadata checks, version checks, boundary checks, the browser bundle check and the fixture provenance check. No benchmark is part of the project.

## Links

- [CLIFF specification](https://github.com/cliff-format/cliff/blob/main/spec/cliff-1.1.0.md)
- [CLIFF ABNF](https://github.com/cliff-format/cliff/blob/main/spec/abnf/cliff-1.1.abnf)
- [Conformance fixtures](https://github.com/cliff-format/cliff-test/tree/main/tests/fixtures)
- [Python reference implementation](https://github.com/cliff-format/cliff-python)
- [Version control policy](docs/version-control.md)

## License

MIT. See [LICENSE](LICENSE).