# Browser Usage

Both packages are browser-safe. The root entry points do not import Node built-ins and do not use DOM APIs beyond standard `TextEncoder`/`TextDecoder` and `Intl`.

## Bundlers

The packages ship ESM and CommonJS with conditional exports. Vite, webpack, Rollup and other modern bundlers use the ESM entry and TypeScript declarations.

```ts
import { parse, validate, serialize } from "@cliff-format/core";
import { toCliJson } from "@cliff-format/json";
```

## Reading a file

```ts
const file = input.files?.[0];
if (file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = parse(bytes);
  const issues = validate(bytes);
}
```

`parse` and `validate` accept a `Uint8Array` and decode it as strict UTF-8.

## Web Workers

The packages do not use the DOM, `window` or `document`. They can be imported in a module worker. Transfer a `Uint8Array` or a string to the worker and return the parsed model or diagnostics.

## Browser support

The packages target ES2022 and modern evergreen browsers. `Intl.Segmenter` is used when available; the width function falls back to code-point iteration otherwise.

## Bundle check

`scripts/check-browser-bundle.mjs` bundles `@cliff-format/json` with esbuild for the browser and fails if the output contains a Node built-in. CI runs it.
