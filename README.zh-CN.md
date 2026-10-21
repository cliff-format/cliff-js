# CLIFF JavaScript / TypeScript 实现

这是 CLIFF 1.0 / 1.1 的浏览器优先 TypeScript 实现，包含两个 npm 包：

- `@cliff-format/core`：数据模型、严格/宽容解析器、canonical 序列化器、验证器。
- `@cliff-format/json`：CLIFF-shaped、flat、nested JSON 双向转换。

未来 CLI、运行时 i18n、AI 翻译集成、Vite 插件和其他格式转换器都会作为独立包发布，不进入 core。

## 安装

```bash
pnpm add @cliff-format/core @cliff-format/json
```

需要 Node.js 22 或更高版本；包无运行时依赖，可在现代浏览器中使用。

## 快速开始

```ts
import { parse, validate, serialize } from "@cliff-format/core";

const document = parse(text);
const issues = validate(text);
console.log(serialize(document));
```

`parse` 只做严格语法/结构解析；`validate` 执行完整语义校验并返回问题列表。

宽容解析需要显式开启：

```ts
import { parseTolerant } from "@cliff-format/core";

const { document, corrections } = parseTolerant(modelOutput);
```

JSON 转换：

```ts
import { toCliJson, fromCliJson, toFlatJson } from "@cliff-format/json";
```

CLIFF-shaped JSON 无损；flat/nested JSON 是有损的运行时资源视图。

完整文档、API 和 conformance 说明以英文文档为准。

## 版本控制

本仓库遵循 [纯英文版本控制规范](docs/version-control.md)。提交、分支、PR 标题、tag 和 CHANGELOG 一律使用英文。

## 许可证

MIT。
