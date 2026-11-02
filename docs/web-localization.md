# Web localization with CLIFF

`@cliff-format/i18n` reads CLIFF documents, resolves entry IDs, and renders ICU messages.
`@cliff-format/vite` supplies the documents; `@cliff-format/translate` writes targets.

## Entry IDs

A CLIFF document contains a header, group sections, and entries. An entry starts with `<id>` and
contains fields. Its canonical ID is `namespace.clan.group-path.entry-id`.

Pass a canonical ID, a scoped short form, or an entry ID object to `t()` or `i18n.resolve()`.

## Runtime model

The web packages read and write CLIFF directly:

```text
CLIFF text ── parse ──> CliffDocument ── index ──> t()/ICU ──> string | parts
     ^                       |
     |                       └── serialize ──> CLIFF text
     └── DeepSeek response parsed as CLIFF, merged by canonical ID
```

The runtime parses CLIFF into an index, renders messages, and serializes edits back to CLIFF.
`@cliff-format/json` is for interoperability; the web runtime does not require it.

## Packages

| Package | Responsibility |
| --- | --- |
| `@cliff-format/i18n` | catalog, entry ID resolution, `t()` builder, locale fallback, ICU, diagnostics |
| `@cliff-format/i18n/lite` | the same runtime without the full ICU dependencies |
| `@cliff-format/i18n/react` | `I18nProvider` and `useTranslation` |
| `@cliff-format/translate` | DeepSeek client, CLIFF prompt assembly, tolerant response merge |
| `@cliff-format/vite` | `.cliff` module transform, `virtual:cliff`, entry ID type generation, HMR |

`@cliff-format/i18n` depends on `@cliff-format/core` (peer), `messageformat` and
`@messageformat/icu-messageformat-1`. React is an optional peer used only by the react subpath.

## Scope

Every CLIFF document requires `namespace` and `clan`. Pass both to the scope:

```ts
const { t } = i18n.scope({ namespace: "demo", clan: "settings", group: "video" });
```

A full entry ID must match the scope. A mismatch throws `CliffScopeMismatchError`.

Get `t` from `i18n.scope()` or `useTranslation()`. `createI18n()` has no `t` property.

## Entry ID syntax

The resolver accepts these forms:

| Form | Example with scope `demo`/`settings`/group `video` |
| --- | --- |
| Colon namespace | `demo:settings.video.resolution` |
| CLIFF canonical | `demo.settings.video.resolution` |
| Friendly path | `demo/settings/video/resolution` |
| Scope clan | `settings.video.resolution` |
| Scope group | `video.resolution` |
| Unique entry ID | `resolution` |

- A **name** uses `A-Z a-z 0-9 _ -`; a dot separates names. The `[video.advanced]` line is
  the **group path**; `CliffGroup.path` stores it in memory.
- Resolution checks aliases, exact canonical IDs, scope-prefix candidates, then unique suffix
  matches. `strictEntryIds: true` is the default; ambiguity throws with every candidate.
- Matching is case-sensitive and does not rewrite separators.

## Builder state machine

`t("home.title")` returns `MessageBuilder<{ source: false; type: false }>`. Calling `.source()` enters
authoring mode; `render()` and `commit()` are `never` until a type is available.

```ts
t("contrast").source("Contrast").type(TYPE.noun).render();       // A: explicit type
t("contrast").source("Contrast").typeFromGroup().render();       // B: explicit inheritance

// @ts-expect-error render is unavailable before type()
t("contrast").source("Contrast").render();
```

Use `.type()` for an explicit type. Use `.typeFromGroup()` to inherit the group type; it throws
`CliffMissingMetadataError` when the group has none. Lookup needs neither.

```ts
t("resolution").render(); // reads source/type/status from CLIFF
```

`render()` and `commit()` create a draft. The draft is a CLIFF entry with `status: initial`;
`toCliff()` exports it. The API requires `source`, an effective `type`, and `status`. `emotion` is
optional by specification and derives from the type; `requireEmotion` can tighten that for a project.

## Status

Status records workflow state. Writes apply the transitions the library can determine:

- A target added to an initial entry, or a reworked target on a reviewed/final entry, becomes
  `translated`.
- A changed source becomes `translated`.
- An explicit `.status()` call wins.
- A missing target becomes `initial`.

Only a human review sets `reviewed` or `final`. Core validation requires a target for every
non-initial state.

`i18n.untranslated()`, `i18n.byStatus()`, `i18n.query()` and `i18n.statusCounts()` expose the
catalog without walking files. `TYPE`, `EMOTION`, `STATUS` and `VARIANT` are enum-like const
objects with literal types and guards.

## CLIFF coverage

| CLIFF feature | Runtime behaviour |
| --- | --- |
| namespace, clan, source/target language | scope, locale fallback, source fallback |
| version, variant, title, info, standard | preserved and exposed to translation |
| dependency | preserved; glossaries are passed explicitly to the translator |
| group context/type/emotion/max-width | inherited through core helpers |
| entry source/target/status | lookup, draft, fallback and status rules |
| type/emotion | metadata, defaults, expectation diagnostics, translation prompt |
| context/max-width/reference/reviewer | preserved and checked or passed through |
| `x-` extensions | preserved; stay local to their container |
| canonical IDs and uniqueness | catalog index; duplicates rejected |
| 1.0 / 1.1 | parsed by core; declared version preserved |
| tolerant parsing | opt-in on `add()`; corrections reported |
| glossary variant | indexed like any CLIFF document and usable as reference |
| ICU MF1/MF2 | full adapter in the main entry; lite entry refuses explicitly |
| display width | measured on the rendered text with core `displayWidth` |
| resource limits | enforced by core |

## ICU

The runtime renders ICU syntax in place with the Unicode MessageFormat implementation:

- `messageformat@4` formats MessageFormat 2 (LDML 48), including `formatToParts`.
- `@messageformat/icu-messageformat-1` compiles MF1 into the same formatter.

Detection follows CLIFF section 14, with an MF1 precedence check so a plural message ending in
`}}` is not mistaken for MF2. `format()` joins literal and expression parts and drops invisible
bidi-isolation parts; `formatToParts()` preserves markup for framework rendering.

The lite entry supports simple `{name}` placeholders and reports `icu-unsupported` for complex
messages. Use it to reduce bundle size.

## DeepSeek

`@cliff-format/translate` sends and receives CLIFF. The prompt contains the complete CLIFF
document and optional glossary documents; the model returns the complete file. Responses are
stripped of fences, parsed with `parseTolerant`, validated, and merged by canonical ID. Only
`target` and `status` are copied.

Defaults are `deepseek-flash`, `temperature: 1.3`, and `thinking: { type: "disabled" }`. Set
thinking to `"off"`: the API enables it by default and ignores temperature while it is on.

Run this package on the server or at build time. In the browser, call a proxy; keep the API key
out of the client bundle.

## Vite

The Vite plugin transforms `.cliff` into a JavaScript module whose default export is the raw CLIFF
string, and generates `virtual:cliff` resources plus an ambient `CliffCanonicalId` union. Editors
autocomplete entry IDs; the runtime still parses CLIFF.

## Non-goals

- No JSON resource format in the web path.
- No runtime variant selected by type or emotion; CLIFF canonical IDs are unique. Use distinct IDs
  or ICU `select` for behavioural variants.
- No automatic dependency fetching; resources are explicit.
- No HTML evaluation; markup is returned as structured parts.