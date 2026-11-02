import { createI18nEngine } from "./engine.js";
import { createFullIcu } from "./icu/full.js";
import type { I18n, I18nOptions } from "./types.js";

export function createI18n<Keys extends string = string>(options: I18nOptions): I18n<Keys> {
  return createI18nEngine<Keys>(options, options.icu ?? createFullIcu());
}
