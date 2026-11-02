import { EMOTION_TAGS, STATUS_TAGS, TYPE_TAGS, VARIANT_TAGS } from "@cliff-format/core";
import type { EmotionTag, StatusTag, TypeTag, VariantTag } from "./types.js";

export function isTypeTag(value: string): value is TypeTag {
  return TYPE_TAGS.has(value);
}

export function isEmotionTag(value: string): value is EmotionTag {
  return EMOTION_TAGS.has(value);
}

export function isStatusTag(value: string): value is StatusTag {
  return STATUS_TAGS.has(value);
}

export function isVariantTag(value: string): value is VariantTag {
  return VARIANT_TAGS.has(value);
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

export function assertVariantTag(value: string): VariantTag {
  if (!isVariantTag(value)) {
    throw new TypeError(`invalid CLIFF variant tag "${value}"`);
  }
  return value;
}
