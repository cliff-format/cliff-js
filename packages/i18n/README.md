# @cliff-format/i18n

CLIFF-native runtime localization for the browser. It reads and writes CLIFF documents directly:
there is no JSON resource layer, and a type/emotion/context field is part of the message rather
than an external comment.

## Install

~~~bash
pnpm add @cliff-format/core @cliff-format/i18n
~~~

The main entry bundles a full ICU runtime. Use `@cliff-format/i18n/lite` when you need only
simple placeholders, or `@cliff-format/i18n/react` for React 18+.

## Quick start

~~~ts
import { createI18n, TYPE, EMOTION } from "@cliff-format/i18n";

const i18n = createI18n({
  locale: "zh-CN",
  fallbackLocale: "en-US",
  resources: [cliffText],
});

const { t } = i18n.scope({ namespace: "demo", clan: "settings", group: "video" });

const label = t("resolution").render();
const authored = t("contrast")
  .source("Contrast")
  .type(TYPE.noun)
  .emotion(EMOTION.objective)
  .render();
~~~

The scope is mandatory. CLIFF requires a namespace and a clan in every document, so the runtime
does not hide defaults:

~~~ts
// compile error: clan is required
i18n.scope({ namespace: "demo" });
~~~

## Entries, not key-value pairs

CLIFF is a document of groups and entries, not a flat key-value map. An entry is an `<id>` marker
plus fields such as `source`, `target`, `type` and `status`. The canonical ID is
`namespace.clan.group-path.entry-id`.

The argument to `t("...")` is a runtime lookup key. It resolves to that entry ID, or to a scoped
short form of it. `key: value` in a CLIFF file is field syntax; it is not the format's data model.

## Key syntax

Every input form resolves to a CLIFF canonical ID. None of them is a fuzzy match.

| Form | Example |
| --- | --- |
| Colon namespace | `demo:settings.video.resolution` |
| CLIFF canonical | `demo.settings.video.resolution` |
| Friendly path | `demo/settings/video/resolution` |
| Scope clan | `settings.video.resolution` |
| Scope group | `video.resolution` |
| Unique entry | `resolution` |

If a key is ambiguous, the default `strictKeys: true` throws `CliffAmbiguousKeyError`. Set it
to `false` only when a deterministic diagnostic-assisted choice is acceptable.

Aliases are explicit:

~~~ts
createI18n({
  locale: "zh-CN",
  aliases: { "home-title": "demo:marketing.home.hero-title" },
  resources: [cliffText],
});
~~~

## Authoring states

`t("key")` returns a builder. Calling `.source()` enters authoring mode; `render()` and
`commit()` do not exist until a type is supplied.

~~~ts
// A: explicit type, the default
t("contrast").source("Contrast").type(TYPE.noun).render();

// B: explicit group inheritance, only when the group already has a type
t("contrast").source("Contrast").typeFromGroup().render();

// @ts-expect-error render is unavailable before type()
t("contrast").source("Contrast").render();
~~~

A draft is created on `render()` or `commit()`, not when the builder is created. The draft is a
real CLIFF entry with `status: initial`; `i18n.toCliff()` exports it. Lookup mode does not need
`source()` or `type()`:

~~~ts
t("resolution").render();
~~~

## CLIFF import and export

~~~ts
i18n.add("CLIFF 1.1\n...", { sourcePath: "zh-CN/settings.cliff" });
i18n.add(await file.text(), { tolerant: true });

i18n.files();  // [{ filePath, namespace, clan, locale, text, document }]
i18n.toCliff(); // one serialized CLIFF document
~~~

`filePath` and `sourcePath` are runtime/build metadata. They are never written into CLIFF.

Entries whose target is missing or `status: initial` fall back to the source text. A fallback
locale is used before the source-language record when it has a target.

## Status and queries

The builder reconciles status on writes without promoting through review:

- adding a target to an initial entry → `translated`;
- reworking the target of a `reviewed`/`final` entry → `translated`;
- changing the source through `commit({ overwrite: true })` → `translated`;
- an explicit `.status(...)` always wins;
- a missing target means `initial`.

Review and final are deliberate states: the library never promotes to `reviewed` or `final` by
itself. The core validator still enforces that `translated`, `reviewed` and `final` require a
target.

~~~ts
i18n.untranslated({ namespace: "demo", clan: "settings" });
i18n.byStatus("reviewed", { namespace: "demo", clan: "settings" });
i18n.query({ status: ["initial", "translated"], target: "present" });
i18n.statusCounts({ namespace: "demo", clan: "settings" });
~~~

`locale` defaults to `"all"`. Pass a BCP 47 tag to restrict a query to one target language.

Fixed vocabularies are exported as enum-like const objects and guards:

~~~ts
TYPE.label;             // "label"
EMOTION.objective;      // "objective"
STATUS.final;           // "final"
VARIANT.glossary;       // "glossary"
isStatusTag("final");   // true
isVariantTag("glossary"); // true
canTransitionStatus("reviewed", "final"); // true
~~~

## ICU

The full entry point uses:

- [messageformat](https://messageformat.github.io/) for MessageFormat 2 (LDML 48);
- [@messageformat/icu-messageformat-1](https://github.com/messageformat/messageformat/blob/main/mf2/icu-messageformat-1/README.md)
  to compile MF1 into the same formatter.

Dialect detection follows CLIFF section 14, with an MF1 precedence check for plural/select
messages whose closing braces look like MF2 markers.

~~~ts
i18n.format("{count, plural, one {# message} other {# messages}}", { count: 2 });
i18n.formatToParts("{#b}Hello{/b} {$name}", { name: "Alice" });
~~~

`format()` returns text without invisible bidi-isolation characters. `formatToParts()` returns
`literal`, `expression` and `markup` parts for safe framework rendering. The lite entry reports
`icu-unsupported` instead of pretending to format a complex message.

## React

~~~tsx
import { I18nProvider, useTranslation } from "@cliff-format/i18n/react";

createRoot(root).render(
  <I18nProvider i18n={i18n}>
    <App />
  </I18nProvider>,
);

function Home() {
  const { t, i18n } = useTranslation({
    namespace: "demo",
    clan: "marketing",
    group: "home",
  });
  return <h1>{t("hero-title").render()}</h1>;
}
~~~

`useTranslation` returns a scope-bound `t` and the controller. It re-renders on locale changes via
`useSyncExternalStore`. The core package does not depend on React.

Use **one hook per clan** for a page that spans several groups; put the group path in the key:

~~~tsx
const { t } = useTranslation({ namespace: "demo", clan: "marketing" });
t("home.title").render();
t("features.context-title").render();
t("format.line-1").render();
~~~

The `group` option is a convenience prefix for a component whose keys all belong to one group. Do
not call `useTranslation` once per section in the same component: each call creates another scoped
translator and another locale subscription.

## Diagnostics

`onDiagnostic` and `i18n.diagnostics()` report `missing-key`, `ambiguous-key`,
`type-mismatch`, `emotion-mismatch`, `source-mismatch`, `width-exceeded`, `icu-error`,
`draft-created` and related codes. `missing` accepts `"key"`, `"empty"`, `"throw"` or
`"source"`.

## API

```ts
createI18n(options): I18n
i18n.scope({ namespace, clan, group? }): { t, scope }
i18n.add(resource, options?): AddResult
i18n.files(options?): CliffFile[]
i18n.toCliff(options?): string
i18n.setLocale(locale) / changeLanguage(locale)
i18n.subscribe(listener): () => void
i18n.format(message, params?, options?) / formatToParts(...)
i18n.validate() / diagnostics()
```