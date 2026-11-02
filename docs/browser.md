# Browser Usage

`@cliff-format/core`, `@cliff-format/json`, `@cliff-format/i18n` and `@cliff-format/translate`
are browser-safe at their root entries. They do not import Node built-ins and do not use DOM APIs
beyond standard `TextEncoder`/`TextDecoder` and `Intl`. `@cliff-format/vite` is Node-only.

## Bundlers

The packages ship ESM and CommonJS with conditional exports. Vite, webpack, Rollup and other modern
bundlers use the ESM entry and TypeScript declarations.

```ts
import { parse, validate, serialize } from "@cliff-format/core";
import { toCliJson } from "@cliff-format/json";
import { createI18n, TYPE } from "@cliff-format/i18n";
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

## Localization runtime

The main i18n entry includes full MF1/MF2 formatting; `@cliff-format/i18n/lite` omits those
dependencies. The React adapter is a separate subpath so applications that do not use React never
load it.

```ts
import { createI18n } from "@cliff-format/i18n";
import { resources } from "virtual:cliff";

export const i18n = createI18n({
  locale: "zh-CN",
  fallbackLocale: "en-US",
  resources,
});
```

## Web Workers

The runtime packages do not use `window` or `document`. They can be imported in a module worker.
Transfer a `Uint8Array` or a string to the worker and return the parsed model, diagnostics or
rendered text.

## Browser support

The packages target ES2022 and modern evergreen browsers. `Intl.Segmenter` is used when available;
the width function falls back to code-point iteration otherwise.

## Bundle check

`scripts/check-browser-bundle.mjs` bundles `@cliff-format/json`, `@cliff-format/i18n`,
`@cliff-format/i18n/lite` and `@cliff-format/translate` with esbuild for the browser and fails if
an output contains a Node built-in. CI runs it.
