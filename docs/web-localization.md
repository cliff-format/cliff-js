# Web Localization With CLIFF

This document defines the web localization layer built on top of `@cliff-format/core`. It explains
why the API looks the way it does, how keys are resolved, and which CLIFF guarantees the runtime
preserves. It is the design record for `@cliff-format/i18n`, `@cliff-format/translate` and
`@cliff-format/vite`.

## 1. One working format

CLIFF is the working format for extraction, translation, review, delivery and runtime. The web
packages read and write CLIFF directly:

```text
CLIFF text ── parse ──> CliffDocument ── index ──> t()/ICU ──> string | parts
     ^                       |
     |                       └── serialize ──> CLIFF text
     └── DeepSeek response parsed as CLIFF, merged by canonical id
```

There is no JSON resource layer. `@cliff-format/json` remains an interoperability package; the web
runtime does not use it.

CLIFF section 2.1 says the format is not a runtime engine format. The i18n package is therefore a
**runtime view over CLIFF documents**, not a new format: it parses CLIFF into an in-memory index,
renders it, and serializes edits back to canonical CLIFF.

## 2. Packages

| Package | Responsibility |
| --- | --- |
| `@cliff-format/i18n` | catalog, key resolution, `t()` builder, locale fallback, ICU, diagnostics |
| `@cliff-format/i18n/lite` | the same runtime without the full ICU dependencies |
| `@cliff-format/i18n/react` | `I18nProvider` and `useTranslation` |
| `@cliff-format/translate` | DeepSeek client, CLIFF prompt assembly, tolerant response merge |
| `@cliff-format/vite` | `.cliff` module transform, `virtual:cliff`, key type generation, HMR |

`@cliff-format/i18n` depends on `@cliff-format/core` (peer), `messageformat` and
`@messageformat/icu-messageformat-1`. React is an optional peer used only by the react subpath.

## 3. Scope is mandatory

Every CLIFF document requires `namespace` and `clan`, and every canonical id starts with them.
The runtime therefore never invents defaults:

```ts
const { t } = i18n.scope({ namespace: "demo", clan: "settings", group: "video" });
```

The scope type requires both strings. A full key must agree with the scope; a mismatch is a
`CliffScopeMismatchError` rather than a silent cross-clan lookup.

`createI18n()` is a resource store, not a translator. It has no `t` property. `t` comes from
`i18n.scope()` or, in React, from `useTranslation()`.

## 4. Key syntax

All of these are first-class inputs and normalize to the same canonical id:

| Form | Example with scope `demo`/`settings`/group `video` |
| --- | --- |
| Colon namespace | `demo:settings.video.resolution` |
| CLIFF canonical | `demo.settings.video.resolution` |
| Friendly path | `demo/settings/video/resolution` |
| Scope clan | `settings.video.resolution` |
| Scope group | `video.resolution` |
| Unique id | `resolution` |

Notes:

- A **name** is `A-Z a-z 0-9 _ -`; a dot is a separator, never part of a name. There is no `path`
  field in CLIFF. The `[video.advanced]` line is the **group path**, and the JS model property
  `CliffGroup.path` is its in-memory representation.
- Resolution checks aliases, exact canonical ids, scope-prefix candidates, then unique suffix
  matches. `strictKeys: true` is the default; ambiguity throws with every candidate.
- No case folding or separator rewriting. Changing a key is changing a translation match key.

## 5. Builder state machine

`t("key")` returns `MessageBuilder<{ source: false; type: false }>`. Calling `.source()` enters
authoring mode; `render()` and `commit()` are `never` until a type is available.

```ts
t("contrast").source("Contrast").type(TYPE.noun).render();       // A: explicit type
t("contrast").source("Contrast").typeFromGroup().render();       // B: explicit inheritance

// @ts-expect-error render is unavailable before type()
t("contrast").source("Contrast").render();
```

A is the default. B is an explicit assertion: the runtime resolves the group and throws
`CliffMissingMetadataError` if the group has no `type`. Lookup mode does not require either step:

```ts
t("resolution").render(); // reads source/type/status from CLIFF
```

Drafts are created on `render()`/`commit()`, not on builder construction. They are real CLIFF
entries with `status: initial` and are exported by `toCliff()`. The API enforces the CLIFF-required
fields: `source`, an effective `type`, and `status`. `emotion` is optional by specification and
derives from the type; `requireEmotion` can tighten that for a project.

## 6. CLIFF coverage

| CLIFF feature | Runtime behaviour |
| --- | --- |
| namespace, clan, source/target language | scope, locale fallback, source fallback |
| version, variant, title, info, standard | preserved and exposed to translation |
| dependency | preserved; glossaries are passed explicitly to the translator |
| group context/type/emotion/max-width | inherited through core helpers |
| entry source/target/status | lookup, draft, fallback and status rules |
| type/emotion | metadata, defaults, expectation diagnostics, translation prompt |
| context/max-width/reference/reviewer | preserved and checked or passed through |
| `x-` extensions | preserved, never inherited |
| canonical ids and uniqueness | catalog index; duplicates rejected |
| 1.0 / 1.1 | parsed by core; declared version preserved |
| tolerant parsing | opt-in on `add()`; corrections reported |
| glossary variant | indexed like any CLIFF document and usable as reference |
| ICU MF1/MF2 | full adapter in the main entry; lite entry refuses explicitly |
| display width | measured on the rendered text with core `displayWidth` |
| resource limits | enforced by core |

## 7. ICU

CLIFF stores ICU syntax verbatim. The i18n runtime does not rewrite it. The full entry point uses
the Unicode MessageFormat implementation:

- `messageformat@4` formats MessageFormat 2 (LDML 48), including `formatToParts`.
- `@messageformat/icu-messageformat-1` compiles MF1 into the same formatter.

Detection follows CLIFF section 14, with an MF1 precedence check so a plural message ending in
`}}` is not mistaken for MF2. `format()` joins literal and expression parts and drops invisible
bidi-isolation parts; `formatToParts()` preserves markup for framework rendering.

The lite entry supports only simple `{name}` placeholders and reports `icu-unsupported` for
complex messages. It is a bundle-size choice, not a silent fallback.

## 8. DeepSeek

`@cliff-format/translate` exchanges CLIFF only. The prompt contains the complete CLIFF document
and optional glossary CLIFF documents; the model is instructed to return the complete file, never
JSON. Responses are stripped of fences, parsed with `parseTolerant`, validated, and merged by
canonical id. Only `target` and `status` are copied.

Defaults are `deepseek-flash`, `temperature: 1.3`, and `thinking: { type: "disabled" }`. Thinking
mode is on by default at the API and ignores temperature, so disabling it is required for the 1.3
setting to matter.

The package is build/server-side by design. The browser should call a proxy; the key is never part
of the client bundle.

## 9. Vite

The Vite plugin transforms `.cliff` into a JavaScript module whose default export is the raw CLIFF
string, and generates `virtual:cliff` resources plus an ambient `CliffKey` union. This gives
editors autocomplete without changing the file format and keeps the runtime parsing CLIFF.

## 10. Pain points addressed

| Pain | Design response |
| --- | --- |
| Opaque string keys | canonical ids, scope, aliases and generated key unions |
| Metadata outside the string | CLIFF type/emotion/context/max-width travel with the entry |
| JSON resource drift | CLIFF in, CLIFF out, no intermediate format |
| Silent missing keys | diagnostics and explicit missing policies |
| Hand-written ICU | official MF1/MF2 runtime and structured parts |
| Locale switching and SSR | per-instance state, `subscribe`, `useSyncExternalStore` |
| Translation corrupts structure | tolerant parse plus merge by canonical id |
| Page text and resource files diverge | `.source()` drafts export as CLIFF |

## 11. Non-goals

- No JSON resource format in the web path.
- No runtime variant keyed by type/emotion; CLIFF canonical ids are unique. Use distinct ids or ICU
  `select` for behavioural variants.
- No automatic dependency fetching; resources are explicit.
- No HTML evaluation; markup is returned as structured parts.
