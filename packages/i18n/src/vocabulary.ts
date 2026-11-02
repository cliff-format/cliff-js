import { EMOTION_TAGS, STATUS_TAGS, TYPE_TAGS } from "@cliff-format/core";
import { EMOTION, type EmotionTag, STATUS, type StatusTag, TYPE, type TypeTag } from "./types.js";

export function isTypeTag(value: string): value is TypeTag {
  return TYPE_TAGS.has(value);
}

export function isEmotionTag(value: string): value is EmotionTag {
  return EMOTION_TAGS.has(value);
}

export function isStatusTag(value: string): value is StatusTag {
  return STATUS_TAGS.has(value);
}

export function assertTypeTag(value: string): TypeTag {
  if (!isTypeTag(value)) {
    throw new TypeError(`invalid CLIFF type tag "${value}"`);
  }
  return value;
}

export function assertEmotionTag(value: string): EmotionTag {
  if (!isEmotionTag(value)) {
    throw new TypeError(`invalid CLIFF emotion tag "${value}"`);
  }
  return value;
}

export function assertStatusTag(value: string): StatusTag {
  if (!isStatusTag(value)) {
    throw new TypeError(`invalid CLIFF status tag "${value}"`);
  }
  return value;
}

export { EMOTION, STATUS, TYPE };
