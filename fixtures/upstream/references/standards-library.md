# CLIFF Standards Reference Library

CLIFF reuses established standards wherever possible. This is the normative
list of external references for implementers and translation-quality tooling.

## Languages and locales

| Standard | Use in CLIFF |
| --- | --- |
| [BCP 47 / RFC 5646 — Tags for Identifying Languages](https://www.rfc-editor.org/rfc/bcp/bcp47.txt) | Values of `source-language`, `target-language`, and the language segment of the file name |
| [Unicode CLDR](https://cldr.unicode.org/) | Plural rules, locale data, display-name data for ICU expansion |
| [Unicode UTS #35 LDML](https://www.unicode.org/reports/tr35/) | The locale data model behind ICU |

## Translation interchange and process

| Standard | Use in CLIFF |
| --- | --- |
| [XLIFF 2.1 — OASIS Standard](https://docs.oasis-open.org/xliff/v2.1/os/xliff-core-v2.1-os.html) | Data-model reference: file/group/unit, `source`/`target`, `state` |
| [XLIFF 2.2 Part 2: Extended](https://docs.oasis-open.org/xliff/xliff-core/v2.2/cs01/xliff-extended-v2.2-cs01-part2.html) | Optional modules; the glossary module is the model for `variant: glossary` |
| [GNU gettext PO Files](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html) | Legacy interchange; CLIFF fixes its "comments as data" flaw |
| [ISO 17100 — Translation services requirements](https://www.iso.org/standard/59149.html) | Quality baseline for human translation process (status model rationale) |
| [W3C ITS 2.0](https://www.w3.org/TR/its20/) | Internationalization metadata concepts (context, terminology) |
| [Fluent 1.0](https://projectfluent.org/) | Line-oriented localization lessons; `-term` informs CLIFF's glossary variant |

## Message formatting and ICU

| Standard | Use in CLIFF |
| --- | --- |
| [Unicode TR35 LDML Part 9 — MessageFormat](https://www.unicode.org/reports/tr35/tr35-messageFormat.html) | MF1 and MF2 syntax accepted verbatim inside strings |
| [ICU MessageFormat documentation](https://unicode-org.github.io/icu/userguide/format_parse/messages/) | Practical ICU guidance |
| [CLDR plural rules](https://cldr.unicode.org/index/cldr-spec/plural-rules) | Plural category data for MF1 |

## Text metrics

| Standard | Use in CLIFF |
| --- | --- |
| [UAX #11 — East Asian Width](https://www.unicode.org/reports/tr11/) | `max-width` display-cell metric |
| [UAX #29 — Unicode Text Segmentation](https://www.unicode.org/reports/tr29/) | Grapheme clusters for emoji width measurement |
| [UAX #44 — Unicode Character Database](https://www.unicode.org/reports/tr44/) | Character properties referenced by UAX #11 |

## Formats studied for syntax design

| Format | What CLIFF learned |
| --- | --- |
| [JSON (RFC 8259)](https://www.rfc-editor.org/rfc/rfc8259) | What *not* to do under LLM editing; quote discipline |
| [CSV (RFC 4180)](https://www.rfc-editor.org/rfc/rfc4180) | Flat is cheap but insufficient |
| [YAML 1.2.2](https://yaml.org/spec/1.2.2/) | Human-friendly goals; the cost of whitespace-meaningful syntax to avoid |
| [TOML 1.0.0](https://toml.io/en/v1.0.0) | Minimal key/value elegance; single-line arrays; repository layout |
| [INI (informal)](https://en.wikipedia.org/wiki/INI_file) | One-section-per-line grouping without closing markers |
| [PO files (GNU)](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html) | Flat entry model; the lesson that data must not hide in comments |

## Terminology and quality evaluation conventions

- Terminology should be checked first against the project glossary (CLIFF
  `variant: glossary` files), then, where applicable, against the
  [Microsoft Language Portal](https://www.microsoft.com/en-us/language)
  (software terms) and [IATE](https://iate.europa.eu/) (institutional terms).
- Automatic quality measurement may use COMET/xCOMET for overall adequacy
  ([Unbabel/COMET](https://github.com/Unbabel/COMET)) and a glossary-constrained
  terminology-consistency check; surface metrics (BLEU/chrF) alone are
  insufficient for style and terminology.
- Human review should use MQM-style error dimensions
  ([MQM](https://themqm.org/)) — accuracy, fluency, terminology, style —
  rather than a single overall score. "信达雅" (the three elements of
  translation) maps to: 信 = faithfulness, 达 = expressiveness,
  雅 = elegance.
- Proper-noun policy (`standard` field) should reference the project style
  guide.

## Status mapping with XLIFF

| CLIFF | XLIFF 2.1/2.2 `state` |
| --- | --- |
| `initial` | `initial` |
| `translated` | `translated` |
| `reviewed` | `reviewed` |
| `final` | `final` |

See [status-tags.md](status-tags.md).