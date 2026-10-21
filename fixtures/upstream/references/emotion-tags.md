# CLIFF Emotion Tag Reference

`emotion` accepts only the following 23 tags. Tags are case-sensitive,
lowercase, single standard American English words. The value is always a
list, even when it holds exactly one tag: `emotion: [neutral]`,
`emotion: [surprised, playful]`. A bare tag (`emotion: neutral`) is a
validity error.

When `emotion` is omitted, the default is derived from the effective `type`:

| Effective `type` | Default |
| --- | --- |
| `dialogue`, `monologue`, `idiom` | `neutral` |
| every other type | `objective` |

An explicit `emotion` always overrides the default.

## The tags

| Tag | Meaning | Translation guidance |
| --- | --- | --- |
| `neutral` | No marked emotion; ordinary delivery | The target region's standard neutral register. |
| `objective` | Matter-of-fact, informational (narration, labels, nouns) | Informative tone; no emotive coloring. Default for non-speech types. |
| `mechanical` | Deliberately emotionless machine/robot delivery | Flat, formulaic, no warmth; never used as a default. |
| `joyful` | Happy, positive, celebrating | Favor natural, warm phrasing; avoid flat literal tone. |
| `sad` | Sadness, regret, disappointment | Preserve sadness in word choice and rhythm; do not over-formalize. |
| `angry` | Irritation to fury | Short, direct sentences; use the target language's anger idioms. |
| `fearful` | Fear, terror, panic | Keep urgency and caution; do not flatten to neutral. |
| `surprised` | Unexpected discovery, shock | Use target-language exclamations and focus particles. |
| `curious` | Interest, inquiry, wondering | Use question forms that sound genuinely interested in the target language. |
| `disgusted` | Disgust, revulsion | Culturally appropriate expressions of disgust. |
| `anxious` | Worry, unease | Keep the cautious tone and tension. |
| `calm` | Reassuring, soothing, unhurried | Soft transitions, steady pacing. |
| `playful` | Teasing, humorous, light | Localize jokes and wordplay; keep the smile, not the literal words. |
| `serious` | Grave, weighty, formally important | Avoid casual contractions and filler words. |
| `urgent` | Time pressure, warning | Short and direct; keep the force of the call to action. |
| `romantic` | Loving, intimate, flirtatious | Match the target culture's romantic register. |
| `hopeful` | Optimistic, encouraging | Keep forward-looking phrasing. |
| `grateful` | Thankful, appreciative | Use locally idiomatic expressions of thanks. |
| `formal` | High register, respectful, ceremonial | Use the target region's honorifics/formal pronouns. |
| `informal` | Casual, familiar | Casual register; contractions and colloquial forms allowed. |
| `polite` | Polite, gentle request | Polite request forms; avoid imperatives. |
| `rude` | Blunt, insulting, aggressive | Use mid-strength rudeness of the target culture. |
| `nostalgic` | Nostalgia, wistfulness | Preserve the reminiscent tone and past-tense color. |

## Combination tags

Multiple tags are conjunctive: `[anxious, polite]` means "anxious **and**
polite". Contradictory combinations (e.g. `[formal, informal]`) are legal but
authors should avoid them; validators may warn.

## Why these tags, and not more?

The set covers:

- Ekman's six basic emotions (`joyful`, `sad`, `angry`, `fearful`,
  `surprised`, `disgusted`);
- common delivery styles (`neutral`, `calm`, `urgent`, `serious`, `playful`);
- social registers needed for translation (`formal`, `informal`, `polite`,
  `rude`);
- CLIFF-specific working tones: `objective` (informational default) and
  `mechanical` (robot delivery);
- common narrative needs (`romantic`, `hopeful`, `grateful`, `anxious`,
  `nostalgic`).

Granular nuance that does not fit a tag belongs in `context` as free text.