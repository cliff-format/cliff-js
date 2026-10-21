# CLIFF Content-Type Tag Reference

`type` accepts only the following 26 tags. Tags are case-sensitive, lowercase,
single-word or hyphenated standard American English. This closed vocabulary
avoids free-form fields such as "part of speech" or "kind of text", so tools
and LLMs cannot drift into near-synonyms.

When `type` is omitted on an entry, it is inherited from the group; every
entry MUST resolve to exactly one tag.

## Word-level tags

| Tag | Meaning | Translation guidance |
| --- | --- | --- |
| `noun` | A noun (thing, place, concept) | Use the target language's default singular/plural conventions for isolated nouns. |
| `verb` | A verb (action or state) | Match the target language's infinitive/citation form unless UI conventions say otherwise. |
| `adjective` | An adjective (property or quality) | Preserve the graded/attributive reading; adapt to target adjective morphology. |
| `adverb` | An adverb (manner, time, degree) | Natural adverb placement in the target language. |
| `pronoun` | A pronoun | Respect target pronoun system and politeness registers; never over-translate. |
| `numeral` | A numeral or number word | Follow target numbering conventions; keep ICU variables untouched. |
| `preposition` | A preposition/postposition | Match the target's adposition system; do not copy the source position. |
| `conjunction` | A conjunction | Use natural target connectors; keep logical relations identical. |
| `particle` | A grammatical particle | Only translate if the target language has a parallel particle; otherwise absorb into the phrase. |
| `interjection` | An exclamation or filler | Use a culturally current exclamation with equivalent force. |
| `proper-noun` | A named entity (person, place, brand, ship, block) | Follow the project glossary; if none exists, follow the locale's proper-noun conventions. |

## Phrase-level tags

| Tag | Meaning | Translation guidance |
| --- | --- | --- |
| `noun-phrase` | A multi-word noun phrase | Translate as one unit; reorder heads and modifiers per target grammar. |
| `verb-phrase` | A multi-word verb phrase | Preserve aspect/modality; rebuild the phrase with target collocations. |
| `adjective-phrase` | A multi-word adjectival phrase | Keep the comparison/intensifier semantics; use idiomatic target structure. |
| `adverb-phrase` | A multi-word adverbial phrase | Natural target placement, often sentence-final or topic-adjacent. |
| `fixed-phrase` | A fixed compound or formulaic multi-word term (e.g. "The Block of Grass") | Treat as a single glossary term; preserve article/capitalization when the glossary requires it. |
| `idiom` | An idiom or set expression | Localize for meaning and effect; never translate word-by-word. |

## Text/function-level tags

| Tag | Meaning | Translation guidance |
| --- | --- | --- |
| `sentence` | A standalone sentence with no specialized function | Natural, faithful prose; default `objective` emotion unless annotated. |
| `description` | Descriptive text (item, skill, quest, product) | Keep the descriptive voice; terminology from the glossary must match. |
| `narration` | Story/voice-over narration | Preserve point of view, tense, and rhythm; sound like a native narrator. |
| `dialogue` | Spoken dialogue | Preserve character voice, turn-taking style, and the declared emotion; prefer spoken target language. |
| `monologue` | Inner thought / monologue | Preserve private, unpolished register when the source signals it. |
| `prompt` | UI guidance, tooltip, or instruction text | Short and actionable; use the locale's standard UI imperatives. |
| `label` | Short UI label, button, or menu item | Match the platform's label conventions; respect `max-width`. |
| `subtitle` | On-screen subtitle of speech | Match reading speed and line breaks; keep meaning under time pressure. |
| `accessibility-cue` | Caption shown for accessibility (e.g. sound-effect cue for deaf/hard-of-hearing viewers, "[door creaks]") | Keep the cue format of the target convention (brackets, case, tense); never drop accessibility information. |

## Glossary variant subset

In a `variant: glossary` file, `type` SHOULD be one of the word-level or
phrase-level tags. Text/function-level tags are permitted but a strict
validator warns.

## Why a closed list?

A closed list turns a vague human decision ("what kind of text is this?")
into a typed field an LLM can emit reliably and a validator can check with a
one-line error. Granular nuance that does not fit a tag belongs in `context`.