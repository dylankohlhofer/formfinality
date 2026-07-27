# Form Coach — interface principles

The rules the interface follows. They exist so the Swift port is a *translation* of an
intent, not a re-derivation of it — and so future changes can be checked against
something other than taste.

## 1 · Colour carries meaning, and only meaning

Two lanes, never crossed:

- **Mint / amber / red — your body.** Form feedback only. Nothing else on screen may
  be saturated in these hues, so a coloured limb is always the only coloured thing in
  view.
- **Iris (#9D8DF1) — your choices and your progress.** Selection, focus, the dial's
  arc. Small doses.

Everything else is monochrome: warm graphite ground, bone text, hairlines. If a new
element wants colour, it must say which lane it belongs to — and if it belongs to
neither, it's monochrome.

## 2 · Designed for three metres, not thirty centimetres

The phone is propped across the room; the user is on the floor, mid-effort, often
sideways. So: one huge tabular numeral, one short label, one line of speech made
visible. Everything else is chrome, and **chrome recedes while a set is live** —
returning on hover (desktop) or tap (touch, which has no hover).

## 3 · Controls appear when their question exists

The tier control answers "how hard should this be?" — a question calibration exists
to answer by watching. So it is hidden until the verdict lands or the user chooses to
skip — and hidden again while a workout is live, because changing difficulty mid-set
isn't a real choice. It returns at the debrief, where it is. The CSV button appears when there is telemetry. The score bar appears at tiers
that show scores. An always-visible control implies an always-open question.

## 4 · Card grammar

Every selectable card reads the same three lines: **NAME + tag** · one-sentence blurb
· the detail line (sequence, in mono, generous line-height). Cards are left-aligned
even inside centred overlays — headings centre; reading matter never does. Overlay
content centres with `margin:auto`, never `align-items:center`: a centred flex child
that overflows loses its top above the scroll origin, unreachably.

## 5 · The `hidden` attribute must always win

`el.hidden = true` is the app's single mechanism for showing/gating controls. But the
HTML `hidden` attribute hides only via the UA stylesheet's `display:none`, which *any*
author `display` silently overrides — so `.ctl{display:inline-flex}` defeated
`<button hidden>` and the flip/CSV/tier controls leaked onto the landing page. A global
`[hidden]{ display:none !important }` restores the attribute's meaning everywhere.
Any element the code hides via `.hidden` depends on this rule; the Swift port's
equivalent (an `isHidden` binding) has the same requirement.

## 6 · Native controls are themed at the base

Buttons, inputs and selects are reset and themed globally, because anything that
falls through to user-agent styling arrives white, and autofill arrives blue. This
class of bug (white blobs, invisible selected states) is checked by scripts: every
runtime-toggled class styled, every `var()` defined, every `aria-pressed` toggler
carrying a selected-state rule.

## 7 · One source of truth per fact

The version string renders from `VERSION`. Tier labels render from `TIERS[x].label` —
renaming a tier is a three-string edit, and the ids beneath (`learning` / `building`
/ `strong`) are **frozen**: they name clip folders, vector rows, CSV columns and
dialogue keys. Labels are brand; ids are plumbing.

## 8 · Mobile is the product, not a breakpoint

Full-bleed stage; chrome floats over it; `dvh` for honest height; safe-area insets
respected; 44 px touch targets; 16 px inputs (or iOS zooms); portrait puts the
readout in the letterbox bar rather than over the body; phone-landscape is the
tightest case and gets its own rules; orientation change re-reads the camera
geometry.

## 9 · The interface may not contradict the engine

The score bar's colour bands are the tint's bands. The dial's segments are the rep
target. A channel that disagrees with another channel — a red limb beside a 77 score
— is treated as a bug even when each channel is individually "correct".

---

*Swift port note:* these principles are testable. §1 and §5 are static checks today;
§3 is a visibility matrix worth asserting in UI tests; §6 means the port imports
labels from content rather than typing them.
