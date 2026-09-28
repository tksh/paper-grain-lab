# Implementation Task List (docs/00–50)

Each checkbox is one commit. Commit in milestone order; tasks within Milestone B
are independent of Milestone A and may interleave. Reference the cited spec
section for acceptance — do not re-derive requirements from code.

Conventions: `feat(tex): …` for codec, `feat(ui): …` for panes, `feat(stln): …`
for the composite page, `test: …` only when a commit adds tests alone,
`chore: …` for wiring.

## Milestone A — shared core + `tex.*` codec (pure page)

- [ ] **A0 —
      `refactor(core): extract shared texture core as importable module(s)`.**
      Move `DEFAULTS`, generator math (`fmt`, `noiseBaseFrequency`,
      `hexToRgb01`, `generateSVG`), `ELEMENT_COLORS`, and the `tex.*` defaults
      table out of the `src/js/app.js` IIFE into modules importable by both `/`
      and `/stln/` and by Deno tests. No behavior change; pure page works
      identically (`docs/00-overview.md`, `docs/50-deno-workflow.md`).
- [ ] **A1 — `feat(tex): add tex key table with defaults and value codecs`.**
      Data only: every key in `docs/10-texture-url-spec.md` §4 with its default,
      plus formatters (comma-joined multi-values, `#`-stripped hex, `=1` flags)
      and parsers with fallback. No UI wiring.
- [ ] **A2 — `feat(tex): implement encode (slider state → params)`.** Compute
      literals with the same math as the SVG generator (matrix assembly per tint
      family → `tex.cm1.values`; pulp alpha → `tex.cm2.values`; `x,y` join; hex
      strip); omit default-valued keys (`docs/10` §4–§5). Acceptance: golden
      encodings for the §7 examples.
- [ ] **A3 — `feat(tex): implement decode-render (params → SVG)`.** Fixed 8-slot
      template in slot order, branching only on flag/selector presence
      (`docs/10` §6, render mode). Acceptance: decode-render output is
      byte-identical to the generator for the §7 examples.
- [ ] **A4 — `feat(tex): implement decode-restore (params → slider state)`.**
      Best-effort slider recovery incl. `tex.tint` family inference from
      `cm1.values` shape (`docs/10` §6); unrecoverable values fall back to
      defaults and the restored state becomes the change-tracker baseline.
      Acceptance: inference matrix test + omission round-trip property (omitted
      key ≡ explicit default).
- [ ] **A5 — `feat(ui): wire share-link UI on the pure page`.** Copy-link button
      (+ optional address-bar sync); on load, parse query, restore sliders via
      A4, ignore bare `stln`/`cmp.*` keys (`docs/30-integration-spec.md` §2).
      Acceptance: paste-share-URL restores the exact texture; unknown keys never
      break the page.
- [ ] **A6 — `chore(tests): add tests/ harness and codec round-trip suite`.**
      `tests/` dir + `deno task test` wiring (`docs/50` §4: extend `deno.jsonc`
      tasks). Covers A1–A4 goldens, omission equivalence, and the namespace
      reservation rule (no unprefixed keys added).

## Milestone B — code-pane highlighting (pure page, independent of A)

- [ ] **B1 — `feat(ui): static token highlighting in the SVG source pane`.**
      Line-based tokenizer: escape `&<>"`, wrap leading element names in spans
      with `ELEMENT_COLORS` backgrounds (`docs/40-highlighting-spec.md` §1–§2).
      Bright pane styling only; no hover linkage.
- [ ] **B2 — `test(ui): copy-invariant and theme audit for the code pane`.**
      Assert `pane.textContent === generatorOutput` across presets and that no
      dark styles survive (including forced OS dark mode) (`docs/40` §3–§4).

## Milestone C — `/stln/` composite lab (needs A0–A4)

- [ ] **C1 — `feat(stln): add bundled entry and replace placeholder page`.**
      `src/stln/main.ts` importing `@tksh/stln-codec` via `deno.jsonc`
      `imports`; `deno task bundle:stln` wiring; `src/stln/index.html` loads the
      bundle instead of the placeholder (`docs/50` §2, `docs/30` §3). No CDN.
- [ ] **C2 — `feat(stln): illustration decode and rasterization`.**
      `decodeUrlToSvg` with `pathMode: "relativeMerged"`; explicit
      `width`/`height` at bitmap size; Blob-URL + generation-counter async
      protocol with cleanup (`docs/20-composite-spec.md` §3).
- [ ] **C3 — `feat(stln): canvas composite with order/mode/opacity/ignoreBg`.**
      Result `<canvas>` element (separate from the texture preview);
      `cmp.order`/`cmp.mode` (allowlist)/`cmp.opacity`/`cmp.ignoreBg` per
      `docs/20` §1–§2. Defaults: texture-over-art, `multiply`, both backgrounds
      kept.
- [ ] **C4 — `feat(stln): raster size controls and PNG export`.**
      `cmp.w`/`cmp.h`/`cmp.dpr` → bitmap `round(w×dpr)` × `round(h×dpr)`;
      preview reuses the bitmap CSS-scaled; PNG export via `toBlob` (`docs/20`
      §3–§4). Export size reproducible from URL alone.
- [ ] **C5 — `feat(stln): combined share-link and error pane`.** Canonical key
      order (stln, then `tex.*` slot order, then `cmp.*`) per `docs/30` §5;
      strict `stln` errors surface a readable pane and render nothing partial
      (`docs/30` §4).
- [ ] **C6 — `test(stln): composite round-trip and fallback matrix`.** Omission
      equivalence for `tex.*`/`cmp.*`, blend allowlist fallback, malformed-`cmp`
      defaults, namespace reservation (bare keys untouched).

## Milestone D — closeout

- [ ] **D1 — `docs: mark implementation status and retire this list`.** Update
      `docs/00-overview.md` phase map with what shipped; check off boxes here as
      commits land (or delete this file once all boxes are checked — git retains
      it).
