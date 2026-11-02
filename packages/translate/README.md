# @cliff-format/translate

Translate CLIFF documents with the DeepSeek API. The input is a CLIFF document, the output is a
CLIFF document; there is no JSON resource intermediate and the model is never asked for JSON.

## Install

~~~bash
pnpm add @cliff-format/core @cliff-format/translate
~~~

Run it on the server or at build time. A browser bundle must not contain the API key; use your own
proxy and pass `baseUrl` / headers instead.

## Quick start

~~~ts
import { createDeepSeekTranslator } from "@cliff-format/translate";

const translator = createDeepSeekTranslator({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: "deepseek-flash",
  temperature: 1.3,
  thinking: "off",
});

const result = await translator.translate(cliffText, {
  targetLanguage: "zh-CN",
  overwrite: "initial",
  batchSize: 100,
});

console.log(result.cliff);        // complete CLIFF
console.log(result.untranslated); // canonical IDs without a target
console.log(result.usage);
~~~

## Defaults

| Option | Default |
| --- | --- |
| `baseUrl` | `https://api.deepseek.com` |
| `model` | `deepseek-flash` |
| `temperature` | `1.3` |
| `thinking` | `"off"` → `{"thinking":{"type":"disabled"}}` |
| `topP` | `1` |
| `maxTokens` | `8192` |
| `timeoutMs` | `180000` |
| `maxRetries` | `2` (429, 5xx and network errors only) |

Thinking is enabled by default on the API, and thinking mode ignores `temperature`. Leaving it on
would make the 1.3 setting ineffective; the client disables it by default. See the
[DeepSeek thinking-mode guide](https://api-docs.deepseek.com/guides/thinking_mode).

## Translation behaviour

- The prompt contains the complete CLIFF document and any glossary CLIFF documents.
- The model must return the whole CLIFF document, with `target` filled and `status: translated`.
- Responses are stripped of fences, parsed with `parseTolerant`, validated, and merged by canonical
  id. Only `target` and `status` are copied; source, type, emotion, context, width, references,
  reviewer and extensions stay as the original document wrote them.
- `reviewed` and `final` entries are not overwritten unless `overwrite: "all"`.
- Unparseable or invalid answers are repaired once by default (`maxRepairAttempts: 1`).
- `batchSize` splits large documents into complete CLIFF documents; results are merged by canonical
  id, never by array position.

## Options

```ts
interface TranslateOptions {
  targetLanguage?: string;
  instructions?: string;
  glossary?: CliffSource | CliffSource[];
  overwrite?: "initial" | "all" | "none";
  batchSize?: number;
  status?: "initial" | "translated" | "reviewed" | "final";
  maxRepairAttempts?: number;
  signal?: AbortSignal;
  onProgress?: (progress) => void;
}
```

## Errors

`DeepSeekConfigError`, `DeepSeekHttpError`, `TranslationParseError` and
`TranslationValidationError` are exported. The result always carries validation `issues` for
advisory findings; hard validation errors throw.

## Security

- The package never reads `process.env`; the caller injects `apiKey` or proxy headers.
- API responses are treated as untrusted data and parsed as CLIFF; nothing is evaluated.
- Resource limits come from `@cliff-format/core`.