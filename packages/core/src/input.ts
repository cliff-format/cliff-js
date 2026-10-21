import { CliffLimitError, CliffParseError } from "./errors.js";
import { isWellFormedString } from "./identifiers.js";
import { limitError, type ResolvedLimits } from "./limits.js";

export interface NormalizedInput {
  text: string;
  lines: string[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function normalizeInput(
  input: string | Uint8Array,
  limits: ResolvedLimits,
): NormalizedInput {
  let text: string;

  if (typeof input === "string") {
    if (input.length > limits.maxBytes) {
      throw limitError(
        "maxBytes",
        input.length,
        `document is larger than the limit of ${limits.maxBytes} bytes`,
      );
    }
    const bytes = encoder.encode(input).byteLength;
    if (bytes > limits.maxBytes) {
      throw limitError(
        "maxBytes",
        bytes,
        `document is ${bytes} bytes, which exceeds the limit of ${limits.maxBytes} bytes`,
      );
    }
    if (!isWellFormedString(input)) {
      throw new CliffParseError("input contains an unpaired surrogate");
    }
    text = input;
  } else {
    if (input.byteLength > limits.maxBytes) {
      throw limitError(
        "maxBytes",
        input.byteLength,
        `document is ${input.byteLength} bytes, which exceeds the limit of ${limits.maxBytes} bytes`,
      );
    }
    try {
      text = decoder.decode(input);
    } catch {
      throw new CliffParseError("document is not valid UTF-8");
    }
  }

  if (text.startsWith("\uFEFF")) text = text.slice(1);
  if (text.includes("\r")) {
    text = text.replace(/\r\n/g, "\n");
    if (text.includes("\r")) {
      throw new CliffParseError("bare CR is not a valid line ending");
    }
  }

  const lines = text.split("\n");
  if (lines.length > limits.maxLines) {
    throw limitError(
      "maxLines",
      lines.length,
      `document has ${lines.length} lines, which exceeds the limit of ${limits.maxLines}`,
    );
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.length > limits.maxLineLength) {
      throw limitError(
        "maxLineLength",
        line.length,
        `line is ${line.length} characters long, which exceeds the limit of ${limits.maxLineLength}`,
        i + 1,
        line.slice(0, 120),
      );
    }
  }
  return { text, lines };
}

export function assertStringLength(value: string, line: number, limit: number): void {
  if (value.length > limit) {
    throw new CliffLimitError(
      `string is ${value.length} characters long, which exceeds the limit of ${limit}`,
      { limit: "maxStringLength", observed: value.length, line },
    );
  }
}
