import { WIDE_RANGES, ZERO_WIDTH_RANGES } from "./generated/east-asian-width.js";

function inRanges(codePoint: number, ranges: readonly (readonly [number, number])[]): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const range = ranges[middle] as readonly [number, number];
    if (codePoint < range[0]) high = middle - 1;
    else if (codePoint > range[1]) low = middle + 1;
    else return true;
  }
  return false;
}

const emojiPresentation = /\p{Emoji_Presentation}/u;
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function clusterWidth(cluster: string): number {
  if (cluster.includes("\u200D") || cluster.includes("\uFE0F")) return 2;
  let emoji = false;
  let width = 0;
  for (const char of cluster) {
    const codePoint = char.codePointAt(0) as number;
    if (inRanges(codePoint, ZERO_WIDTH_RANGES)) continue;
    if (emojiPresentation.test(char)) emoji = true;
    if (inRanges(codePoint, WIDE_RANGES)) width += 2;
    else width += 1;
  }
  return emoji ? 2 : width;
}

export function displayWidth(text: string): number {
  if (segmenter !== null) {
    let total = 0;
    for (const { segment } of segmenter.segment(text)) total += clusterWidth(segment);
    return total;
  }
  let total = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) as number;
    if (inRanges(codePoint, ZERO_WIDTH_RANGES)) continue;
    total += emojiPresentation.test(char) || inRanges(codePoint, WIDE_RANGES) ? 2 : 1;
  }
  return total;
}
