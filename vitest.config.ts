import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@cliff-format\/core$/,
        replacement: fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      },
      {
        find: /^@cliff-format\/i18n$/,
        replacement: fileURLToPath(new URL("./packages/i18n/src/index.ts", import.meta.url)),
      },
      {
        find: /^@cliff-format\/i18n\/lite$/,
        replacement: fileURLToPath(new URL("./packages/i18n/src/lite.ts", import.meta.url)),
      },
      {
        find: /^@cliff-format\/i18n\/react$/,
        replacement: fileURLToPath(new URL("./packages/i18n/src/react.ts", import.meta.url)),
      },
      {
        find: /^@cliff-format\/translate$/,
        replacement: fileURLToPath(new URL("./packages/translate/src/index.ts", import.meta.url)),
      },
      {
        find: /^@cliff-format\/vite$/,
        replacement: fileURLToPath(new URL("./packages/vite/src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["packages/**/test/**/*.test.ts", "packages/**/test/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/*/src/generated/**", "**/result.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
