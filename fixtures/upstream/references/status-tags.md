# CLIFF Translation Status Reference

`status` accepts exactly four tags: `initial`, `translated`, `reviewed`,
`final`. In CLIFF 1.0 `status` is **required on every entry**; there is no
default, because an explicit state is the only safe state in a workflow file.

## State machine

```
initial ──translate──▶ translated ──review──▶ reviewed ──lock──▶ final
  ▲                       │                     │
  └─────── retranslate ───┴─────── rework ──────┘
```

| From | To | Meaning |
| --- | --- | --- |
| `initial` | `translated` | A target text was produced (human, machine, or mixed) |
| `translated` | `reviewed` | A human reviewer approved the text |
| `reviewed` | `final` | The text is locked for release |
| any | `translated` | The source changed or rework was requested; review is invalidated |

## Constraints

- `target` may be omitted only when `status: initial`.
- A writer MUST set `target` before `translated`, `reviewed`, or `final`.
- Setting `reviewed` or `final` without `target` is a validity error.
- `reviewer` is optional at any stage; it SHOULD be set when leaving
  `translated`.

## Mapping to XLIFF 2.1/2.2

| CLIFF | XLIFF `state` | Note |
| --- | --- | --- |
| `initial` | `initial` | No target text yet (extraction state) |
| `translated` | `translated` | Target text exists |
| `reviewed` | `reviewed` | Human approval |
| `final` | `final` | Locked |

XLIFF's richer states (`needs-review-translation`,
`needs-review-simplification`, `signed-off`) are tool-chain states. CLIFF keeps
the four states every translation workflow needs; tools may track finer states
out of band.