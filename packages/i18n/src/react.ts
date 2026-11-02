import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { I18n, ScopedI18n, TFunction, TranslationScope } from "./types.js";

const I18nContext = createContext<I18n<string> | null>(null);

export interface I18nProviderProps<Keys extends string = string> {
  i18n: I18n<Keys>;
  children?: ReactNode;
}

export function I18nProvider<Keys extends string = string>({
  i18n,
  children,
}: I18nProviderProps<Keys>) {
  return createElement(I18nContext.Provider, { value: i18n as unknown as I18n<string> }, children);
}

export function useI18n(): I18n<string> {
  const i18n = useContext(I18nContext);
  if (i18n === null) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return i18n;
}

export interface UseTranslationResult<Keys extends string = string> {
  t: TFunction<Keys>;
  i18n: I18n<string>;
}

export function useTranslation<Keys extends string = string>(
  scope: TranslationScope,
): UseTranslationResult<Keys> {
  const i18n = useI18n();
  const subscribe = useCallback((listener: () => void) => i18n.subscribe(listener), [i18n]);
  const getLocale = useCallback(() => i18n.getLocale(), [i18n]);
  useSyncExternalStore(subscribe, getLocale, getLocale);
  const { namespace, clan, group } = scope;
  const scoped = useMemo<ScopedI18n<Keys>>(
    () =>
      i18n.scope({
        namespace,
        clan,
        ...(group === undefined ? {} : { group }),
      }) as unknown as ScopedI18n<Keys>,
    [i18n, namespace, clan, group],
  );
  return { t: scoped.t, i18n };
}
