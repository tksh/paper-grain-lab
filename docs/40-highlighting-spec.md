# SVG Code Highlighting Spec (pure page)

Owns the SVG source pane on `/`: static token coloring that reuses the
filter-usage colors so feature ↔ code correspondence is visible at a glance.

## 1. Requirements

- **Light theme only.** The code pane uses the same bright styling as the other
  panels (light panel background, dark ink text) — no dark code block, no
  `prefers-color-scheme` branches anywhere in the app (`color-scheme: light` is
  set globally). Only the current light mode is implemented, regardless of OS or
  browser color scheme.
- **Static coloring only.** Token background colors; no hover linkage between
  code and sections, no click-to-scroll. (Interactive linkage is a possible
  follow-up, not this spec.)
- Token background colors MUST be the existing `ELEMENT_COLORS` map (same values
  as the section dots and field badges). The pastel palette is already
  light-background-safe, which is why the bright pane works without new colors.
- Copy behavior unchanged: the copy button reads plain SVG text. Highlighting is
  a view layer only.

## 2. Tokenizer

- Input: the exact string produced by the texture SVG generator (single source
  of truth — highlight what is rendered, nothing else).
- Rule (line-based, sufficient for generator output): for each output line,
  match the leading element name (`feTurbulence`, `feBlend`, `rect`, `svg`, …);
  wrap the element name token in a span with its `ELEMENT_COLORS` background;
  leave attribute text uncolored (ink color). One span per line keeps the
  implementation trivial and robust.
- Escaping: escape `&<>"` in ALL text before wrapping. The pane switches from
  `textContent` assignment to escaped-`innerHTML` assignment; the copy path
  keeps reading `textContent`, which returns the original SVG byte-for-byte.

## 3. Non-requirements / invariants

- Full re-render of the pane on every input event is acceptable (output is a few
  dozen lines; current `render()` already rebuilds dots the same way).
- Byte-equality invariant: `pane.textContent === generatorOutput` at all times.
  Any test or review MUST assert this (copy-paste fidelity is the point of the
  pane).
- No new colors, no theme switcher, no per-attribute coloring in Phase 1.

## 4. Acceptance

1. Every generator line shows the correct element background per
   `ELEMENT_COLORS`; unknown element names fall back to uncolored ink text.
2. Copy button output is byte-identical to the pre-highlighting output for
   several presets (including ones with `<`/`>`/`&` in attribute values, if
   any).
3. No dark styles remain in the pane; forcing OS dark mode does not change the
   pane (or any panel) appearance.
