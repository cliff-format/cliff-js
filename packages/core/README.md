# @cliff-format/core

CLIFF 1.0 / 1.1 data model, parser, serializer and validator for JavaScript and TypeScript.

## Install

```bash
pnpm add @cliff-format/core
```

## Usage

```ts
import {
  parse,
  parseTolerant,
  validate,
  serialize,
} from "@cliff-format/core";

const document = parse(text);
const issues = validate(text);
const canonical = serialize(document);
const { document: repaired, corrections } = parseTolerant(modelOutput);
```

## API

- `parse(input, options?)` — strict syntax/structure parser. Throws `CliffParseError`.
- `parseTolerant(input, options?)` — Appendix C repairs plus full validation; throws `CliffValidationError` if the repaired document is not strictly valid.
- `validate(input, options?)` — parses and validates; returns `ValidationIssue[]` and never throws for invalid CLIFF content.
- `validateDocument(document, options?)` — validates a hand-built or imported document.
- `serialize(document, options?)` — canonical CLIFF output.
- `displayWidth(text)`, `effectiveContext/Type/Emotion/MaxWidth`, `canonicalId`, identifier helpers.

The parser accepts `string` or `Uint8Array`. Byte input is decoded as strict UTF-8.

## Options

`parse` and `validate` accept resource limits:

```ts
{
  maxBytes: 16 * 1024 * 1024,
  maxLines: 1_000_000,
  maxLineLength: 1_048_576,
  maxStringLength: 1_048_576,
  maxGroupSegments: 64,
  maxListItems: 10_000,
  maxEntries: 1_000_000
}
```

`validate` also accepts `tolerant`, `checkWidth`, `checkLayout`, `style` and `onIdCollision`.

## Boundaries

This package contains no Node built-ins and no runtime dependencies. It does not read files, execute ICU messages, resolve dependency paths or convert to other formats.

## License

MIT.
