import { createI18n, TYPE } from "@cliff-format/i18n";
import { I18nProvider, useTranslation } from "@cliff-format/i18n/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const cliff = `CLIFF 1.1
namespace: demo
clan: settings
source-language: en-US
target-language: zh-CN

[video]
type: label

<resolution>
source: "Resolution"
target: "分辨率"
type: noun
status: final
`;

function View() {
  const { t } = useTranslation({ namespace: "demo", clan: "settings", group: "video" });
  const authored = t("contrast").source("Contrast").type(TYPE.noun).render();
  return createElement("span", null, t("resolution").render(), "|", authored);
}

describe("React adapter", () => {
  it("provides a scoped t to components", () => {
    const i18n = createI18n({
      locale: "zh-CN",
      resources: [cliff],
      sourceLanguage: "en-US",
    });
    const html = renderToStaticMarkup(createElement(I18nProvider, { i18n }, createElement(View)));
    expect(html).toContain("分辨率");
    expect(html).toContain("Contrast");
  });
});
