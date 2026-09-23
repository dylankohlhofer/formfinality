# FormFinder — interface principles

The rules the interface follows. They exist so the Swift port is a *translation* of an
intent, not a re-derivation of it — and so future changes can be checked against
something other than taste.

## 1 · Colour carries meaning, and only meaning

Two lanes, never crossed:

- **Mint / amber / red — your body.** Form feedback only. Nothing else on screen may
  be saturated in these hues, so a coloured limb is always the only coloured thing in
  view.
- **Iris (#9D8DF1), or plum (#6E4D9B) in light mode — your choices and progress.**
  Selection, focus, the dial's arc. Small doses. These are one semantic lane.

Everything else is near-black graphite, off-white text and hairlines. Primary
actions also use iris, so the next step is clear without adding another colour.
Light mode uses ivory surfaces and dark neutral text. Dark is the default; the
user may explicitly select Light or Match device in More. Setup and the camera
always retain dark feedback surfaces, independently of teaching/active state.
If a new element wants colour, it must say which lane it belongs to — and if it belongs to
neither, it's monochrome.

## 2 · Designed for three metres, not thirty centimetres

The phone is propped across the room; the user is on the floor, mid-effort, often
sideways. So: one huge tabular numeral, one short label, one line of speech made
visible. Secondary instruments recede; critical Pause, Skip and End controls stay
legible. The 14 September review removed the live header's low-opacity treatment:
an available escape should not look disabled. Current/next movement gives context
without requiring the person to remember a spoken instruction.

## 3 · Controls appear when their question exists

The 23 September decluttering pass separates three layers: choosing a workout,
doing it, and occasional tools. The idle header shows Workouts, More and About. During
exercise, Pause, Skip, Ask coach and End remain directly reachable. An active
microphone's Off control and a diagnostic recorder's quick flag are never buried.
More contains speech, camera switching, guide outline, Help and technical tools;
opening it must not resize the camera. Native disclosures retain keyboard
operation; Escape closes tools and returns focus, and navigation dismisses them.

Welcome asks only for a starting route. Name/style previews belong under Account,
where they are unavailable until verified identity and paid access are connected.
Apple/Google linkage, cloud sync and Duo remain planned, not connected buttons.
Home separates workouts from This week and History. Preview puts Start before an
expandable exact plan. Debrief keeps observed results and save failures visible,
but technical exports are optional. Optional does not mean hidden consent: all
storage/microphone/diagnostic opt-ins remain explicit and off by default.
This week shows saved routine-days, not an inferred streak or fitness level;
unrecorded days are unknown. History uses compact cards with expandable set
details. Coaching amount/demos remain usable without paid personalisation.
About explains the mission and limitations. Future video and platform releases
are labelled honestly; only real releases may receive download links.

The tier control answers "how hard should this be?" — a question calibration exists
to answer by watching. So it is hidden until the verdict lands or the user chooses to
skip — and hidden again while a workout is live, because changing difficulty mid-set
isn't a real choice. It returns at the debrief, where it is. The CSV button appears when there is telemetry. The score bar appears at tiers
that show scores. An always-visible control implies an always-open question.

## 4 · Card grammar

Workout cards use **category · name · short description · movement/set counts**.
The full sequence, doses, rests and camera views belong in the expandable preview,
not every picker card. Two columns on wide screens become one on phones. Headings
and reading matter are left-aligned inside a bounded content column. Overlay
content centres with `margin:auto`, never `align-items:center`: a centred flex child
that overflows loses its top above the scroll origin, unreachably.
Transitions are brief heading fades and restrained card hover changes, disabled
by reduced-motion preference. Never animate a whole interactive overlay: the
rapid profile/restart test exposed persistent hit-test interference when doing so.

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

## 10 · Interruptions belong to the workout, not just the camera

Preview before starting. Pause before leaving, changing cameras or confirming End.
Background return requires explicit Resume; a hidden tab earns no exercise credit.
An unfinished rep cannot bridge a pause. Ending early retains observed work and
names the incomplete set without grading it or pretending future sets happened.
Calibration interruption offers a fresh check or the observed result, not a resumed
continuous hold. These are core policies that the native shell must preserve.

The current brand/theme/account presentation is in
[[sessions/formfinder-interface-2026-09-23]]. The navigation inventory and remaining
device checks are in [[sessions/interface-simplification-2026-09-23]]; the interruption contract and
earlier inventory are in [[sessions/interface-review-2026-09-14]].

---

*Swift port note:* these principles are testable. §1 and §5 are static checks today;
§3 is a visibility matrix worth asserting in UI tests; §6 means the port imports
labels from content rather than typing them.
