export const TYPE_TAGS: ReadonlySet<string> = new Set([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "numeral",
  "preposition",
  "conjunction",
  "particle",
  "interjection",
  "proper-noun",
  "noun-phrase",
  "verb-phrase",
  "adjective-phrase",
  "adverb-phrase",
  "fixed-phrase",
  "idiom",
  "sentence",
  "description",
  "narration",
  "dialogue",
  "monologue",
  "prompt",
  "label",
  "subtitle",
  "accessibility-cue",
]);

export const EMOTION_TAGS: ReadonlySet<string> = new Set([
  "neutral",
  "objective",
  "mechanical",
  "joyful",
  "sad",
  "angry",
  "fearful",
  "surprised",
  "curious",
  "disgusted",
  "anxious",
  "calm",
  "playful",
  "serious",
  "urgent",
  "romantic",
  "hopeful",
  "grateful",
  "formal",
  "informal",
  "polite",
  "rude",
  "nostalgic",
]);

export const STATUS_TAGS: ReadonlySet<string> = new Set([
  "initial",
  "translated",
  "reviewed",
  "final",
]);

export const VARIANT_TAGS: ReadonlySet<string> = new Set(["standard", "glossary"]);

export const GLOSSARY_TYPES: ReadonlySet<string> = new Set([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "numeral",
  "preposition",
  "conjunction",
  "particle",
  "interjection",
  "proper-noun",
  "noun-phrase",
  "verb-phrase",
  "adjective-phrase",
  "adverb-phrase",
  "fixed-phrase",
  "idiom",
]);

export const SPEECH_TYPES: ReadonlySet<string> = new Set(["dialogue", "monologue", "idiom"]);

export const HEADER_KEYS: ReadonlySet<string> = new Set([
  "namespace",
  "clan",
  "source-language",
  "target-language",
  "version",
  "variant",
  "title",
  "info",
  "standard",
  "dependency",
]);

export const GROUP_KEYS: ReadonlySet<string> = new Set(["context", "type", "emotion", "max-width"]);

export const ENTRY_KEYS: ReadonlySet<string> = new Set([
  "source",
  "target",
  "type",
  "emotion",
  "status",
  "context",
  "max-width",
  "reference",
  "reviewer",
]);

export const STRING_KEYS: ReadonlySet<string> = new Set([
  "version",
  "title",
  "info",
  "standard",
  "source",
  "target",
  "context",
  "reviewer",
]);

export const LIST_KEYS: ReadonlySet<string> = new Set(["emotion", "dependency", "reference"]);

export const NAME_KEYS: ReadonlySet<string> = new Set(["namespace", "clan"]);

export const LANG_KEYS: ReadonlySet<string> = new Set(["source-language", "target-language"]);

export const INT_KEYS: ReadonlySet<string> = new Set(["max-width"]);

export const TAG_KEYS: ReadonlySet<string> = new Set(["variant", "type", "status"]);

export const TAG_VOCABULARIES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["variant", VARIANT_TAGS],
  ["type", TYPE_TAGS],
  ["status", STATUS_TAGS],
]);
