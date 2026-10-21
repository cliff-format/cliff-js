# @cliff-format/json

JSON converters for CLIFF 1.0 / 1.1.

## Install

```bash
pnpm add @cliff-format/core @cliff-format/json
```

`@cliff-format/core` is a peer dependency.

## CLIFF-shaped JSON

`toCliJson` / `fromCliJson` preserve the full CLIFF data model: header, group metadata, entry fields, extensions and the declared specification version. This is the lossless JSON form.

```ts
import { parse } from "@cliff-format/core";
import { toCliJson, fromCliJson } from "@cliff-format/json";

const document = parse(text);
const object = toCliJson(document);
const restored = fromCliJson(object);
```

## Flat and nested JSON

Flat JSON maps dotted keys to strings. Nested JSON maps nested objects to strings and produces a structure i18next can consume for simple keys.

```ts
import { fromFlatJson, toFlatJson, fromNestedJson, toNestedJson } from "@cliff-format/json";

const { document, warnings } = fromFlatJson(
  { "video.resolution": "分辨率" },
  {
    namespace: "demo",
    clan: "settings",
    sourceLanguage: "en-US",
    targetLanguage: "zh-CN",
  }
);

const flat = toFlatJson(document, { keyStyle: "canonical" });
const nested = toNestedJson(document);
```

Import options:

- `valueRole: "target"` (default): key becomes `source`, value becomes `target`; status defaults to `translated`.
- `valueRole: "source"`: value becomes `source` and no target is created; status defaults to `initial`.
- `entryType` defaults to `sentence`.
- `keySeparator` defaults to `.`.

Imports normalize non-conforming keys using the CLIFF tolerant identifier algorithm and return a `warnings` list. They never silently overwrite a duplicate.

Export options:

- `keyStyle`: `canonical` (default), `group-entry`, `entry`.
- `value`: `target` (default) or `source`.
- `fallbackToSource`: when the selected value is missing, fall back to the other side; default `false`.

Flat and nested JSON are lossy: they do not carry header prose, context, types, emotion, status, width, reviewer, extensions or references. Use CLIFF-shaped JSON when those matter.

i18next plural, context and namespace semantics are not implemented; those belong to the future `@cliff-format/i18n` package.

## License

MIT.
