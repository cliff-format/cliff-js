import type { I18n, MessageBuilder, Params } from "@cliff-format/i18n";
import { TYPE } from "@cliff-format/i18n";
import type { I18nProviderProps } from "@cliff-format/i18n/react";
import { describe, expect, expectTypeOf, it } from "vitest";

type Lookup = MessageBuilder<{ source: false; type: false }>;
type Sourced = MessageBuilder<{ source: true; type: false }>;
type Ready = MessageBuilder<{ source: true; type: true }>;
type IsNever<T> = [T] extends [never] ? true : false;

expectTypeOf<Lookup["render"]>().toEqualTypeOf<(params?: Params) => string>();
expectTypeOf<IsNever<Sourced["render"]>>().toEqualTypeOf<true>();
expectTypeOf<Ready["render"]>().toEqualTypeOf<(params?: Params) => string>();
expectTypeOf<Sourced["typeFromGroup"]>().toEqualTypeOf<
  () => MessageBuilder<{ source: true; type: true }>
>();
expectTypeOf<IsNever<Lookup["typeFromGroup"]>>().toEqualTypeOf<true>();
expectTypeOf<Ready["commit"]>().toEqualTypeOf<
  (options?: {
    overwrite?: boolean;
    validate?: boolean;
  }) => MessageBuilder<{ source: true; type: true }>
>();
declare const i18n: I18n;

function providerTypeChecks(): void {
  const typed = null as unknown as I18n<"demo.settings.video.resolution">;
  const props: I18nProviderProps<"demo.settings.video.resolution"> = { i18n: typed };
  void props;
}

function typeChecks(): void {
  const t = i18n.scope({ namespace: "demo", clan: "settings", group: "video" }).t;
  t("contrast").source("Contrast").type(TYPE.noun).render();
  t("contrast").source("Contrast").typeFromGroup().render();

  // @ts-expect-error render is never available before type()
  t("contrast").source("Contrast").render();

  // @ts-expect-error namespace and clan are both required
  i18n.scope({ namespace: "demo" });

  // @ts-expect-error typeFromGroup requires source first
  t("contrast").typeFromGroup();
}

describe("builder state types", () => {
  it("keeps the compile-time checks in the typechecker", () => {
    void typeChecks;
    void providerTypeChecks;
    expect(true).toBe(true);
  });
});
