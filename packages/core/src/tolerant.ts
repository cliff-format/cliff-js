import { CliffValidationError } from "./errors.js";
import { isAdvisory, type TolerantParseResult } from "./model.js";
import { parseInternal, type TolerantParseOptions } from "./parser.js";
import { validateDocument } from "./validator.js";

export function parseTolerant(
  input: string | Uint8Array,
  options: TolerantParseOptions = {},
): TolerantParseResult {
  const document = parseInternal(input, options, true);
  const issues = validateDocument(document);
  const errors = issues.filter((item) => !isAdvisory(item));
  if (errors.length > 0) {
    throw new CliffValidationError(issues, document.corrections);
  }
  return { document, corrections: document.corrections };
}
