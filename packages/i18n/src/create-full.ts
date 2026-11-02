import { createI18nEngine } from "./engine.js";
import { createFullIcu } from "./icu/full.js";
import type { I18n, I18nOptions } from "./types.js";

export function createI18n<EntryIds extends string = string>(options: I18nOptions): I18n<EntryIds> {
  return createI18nEngine<EntryIds>(options, options.icu ?? createFullIcu());
}
