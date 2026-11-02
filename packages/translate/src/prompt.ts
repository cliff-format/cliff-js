import { type CliffDocument, serialize } from "@cliff-format/core";
import type { DeepSeekMessage, PromptOptions } from "./types.js";

const SYSTEM_PROMPT = `You are a professional localization translator and localization engineer.
You translate product, literary, legal and game content between languages, and you edit
localization resource files without breaking their structure. We need the translated CLIFF
file itself, complete: the file we gave you, with its text in the target language and its
structure intact.`;

const TASK_RULES = `Translate the CLIFF document below from {sourceLanguage} into {targetLanguage}.

WHAT WE NEED
1. The translated CLIFF document, complete: the document that appears under
   "FILE TO TRANSLATE", opening with its version line and ending with the last field of its
   last entry.
2. Every namespace, clan, group path, entry id, field name and field order preserved exactly.
   Identifiers are case-sensitive; do not recapitalize, hyphenate or otherwise rename one.
3. The source field verbatim. Your work goes into the target field of each entry.
4. Every ICU MessageFormat construct character for character: placeholders, plural/select
   branches, number/date skeletons, MF2 directives, markup tags, and the text inside them.
5. Meaning translated: register, tone, terminology and wordplay natural in {targetLanguage},
   guided by the CLIFF type, emotion, context and max-width that the file carries.
6. Every entry that has a source but no target, or status: initial, should receive a target and
   status: translated. Do not overwrite entries whose status is reviewed or final.
7. Do not add entries, remove entries, merge groups, change the version line, or alter any
   field other than target and status.

CLIFF EDIT SAFETY
- Every text value is one quoted string. A double quote inside a string stays escaped as \\".
  A newline inside a string is written as \\n.
- Tags (type, emotion, status, variant) are bare lowercase words, never quoted.
- List-valued fields keep their brackets: emotion: [objective], reference: ["src/ui.cpp:12"].
- The section line [group.path] and the entry line <entry-id> each stand alone. Fields belong
  to the nearest preceding section or entry line.
- ICU syntax is payload. Do not translate variable names, tags, function names or option keys.

OUTPUT
Return only the CLIFF document. No Markdown code fences, no JSON, no commentary, no diff.`;

const SYSTEM_MESSAGE = `${SYSTEM_PROMPT}\n\n${TASK_RULES}`;

function renderPrompt(document: CliffDocument, options: PromptOptions): string {
  const sections: string[] = [];
  sections.push(
    `Translate the CLIFF document below from ${options.sourceLanguage} into ${options.targetLanguage}.`,
  );
  if (options.instructions !== undefined && options.instructions.trim().length > 0) {
    sections.push(`ADDITIONAL PROJECT INSTRUCTIONS\n${options.instructions.trim()}`);
  }
  if (options.glossary !== undefined && options.glossary.length > 0) {
    sections.push(
      "REFERENCE GLOSSARY - CONTEXT FOR YOUR READING\n" +
        "These renderings are canonical. Use them exactly whenever the term appears in the\n" +
        "file you translate. This block is reference material, not part of your answer.",
    );
    for (const glossary of options.glossary) {
      sections.push(`--- GLOSSARY ${glossary.header.namespace}.${glossary.header.clan} ---`);
      sections.push(serialize(glossary));
    }
    sections.push("--- END OF REFERENCE GLOSSARY ---");
  }
  sections.push("FILE TO TRANSLATE - RETURN THIS FILE, COMPLETE");
  sections.push(serialize(document));
  return sections.join("\n\n");
}

export function buildTranslationMessages(
  document: CliffDocument,
  options: PromptOptions,
): DeepSeekMessage[] {
  const system = SYSTEM_MESSAGE.replaceAll("{sourceLanguage}", options.sourceLanguage).replaceAll(
    "{targetLanguage}",
    options.targetLanguage,
  );
  return [
    { role: "system", content: system },
    { role: "user", content: renderPrompt(document, options) },
  ];
}
