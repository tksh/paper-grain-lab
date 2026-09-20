# Paper Grain Lab — Product Overview

Paper Grain Lab is a paper-texture simulator built on pure SVG filters
(`feTurbulence` → weave/fiber layering → distortion → lighting → tinting →
compositing). It has two pages with a shared texture core:

| Page          | URL                                       | Purpose                                                                                                                                                                           |
| ------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure lab      | `https://paper-grain-lab.pages.dev/`      | Standalone SVG texture experimentation. No Straightlines dependency.                                                                                                              |
| Composite lab | `https://paper-grain-lab.pages.dev/stln/` | Composites a paper texture (top layer, `multiply` by default) over a Straightlines illustration via the Canvas API, with customizable order, blend mode, and opacity. PNG export. |

Both pages keep evolving in parallel. The pure page is the reference
implementation of the texture pipeline; the composite page reuses it.

## Phases

- **Phase 1 (current):** finish the pure page as a standalone texture lab —
  texture URL codec (`tex.*`, see `docs/10-texture-url-spec.md`), static SVG
  code highlighting (`docs/40-highlighting-spec.md`), Deno-first workflow
  (`docs/50-deno-workflow.md`).
- **Phase 2:** build `/stln/` — Straightlines integration
  (`docs/30-integration-spec.md`) with composite controls
  (`docs/20-composite-spec.md`), PNG export (lossless WebP / JPEG XL later).

## Requirements that apply to everything

- **Development language is English only.** Docs, code comments, commit
  messages, and identifiers are English. The UI itself stays bilingual
  (English/Japanese), with **English as the default language**.
- **Light mode only.** The UI is a bright theme matching the existing panels. No
  dark mode is implemented, regardless of OS or browser color scheme
  (`color-scheme: light` is set explicitly). The SVG code pane uses the same
  bright styling as the other panels (it was previously dark-on-light inverted;
  see `docs/40-highlighting-spec.md`).
- **No CDN at runtime.** Third-party modules resolve through `deno.jsonc`
  `imports` and are shipped via `deno bundle`. See `docs/50-deno-workflow.md`.
- **Portable reproduction data.** A single share URL fully reproduces the
  result: two lightweight vectors (Straightlines illustration via `stln-codec`
  keys, texture via `tex.*` keys) plus composite parameters (`cmp.*` keys). No
  raster data in URLs. No combined-SVG output; PNG is the export format.

## URL namespace overview

| Prefix        | Owner                                                                    | Spec                                         |
| ------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| _(bare keys)_ | `stln-codec` upstream (frozen by `pfpg` compatibility — do not redefine) | `docs/30-integration-spec.md` (by reference) |
| `tex.*`       | This repo — texture pipeline                                             | `docs/10-texture-url-spec.md`                |
| `cmp.*`       | This repo — composite/raster settings                                    | `docs/20-composite-spec.md`                  |

Rule: everything introduced by this repo carries a prefix. Never add bare
single-letter keys. See `docs/30-integration-spec.md` for the reservation table.

## Glossary

- **Slot:** one of the 8 fixed pipeline stages (noise, weave, pulp-1, distort,
  light, tint, pulp-2, composite), always in the same order.
- **Literal value:** the exact string written into the SVG attribute (e.g. a
  20-number `feColorMatrix values` matrix).
- **Intermediate slider value:** a UI-friendly value the sliders manipulate
  (e.g. `alphaSlope`, `alphaBias`) from which a literal value is computed.
- **Illustration:** the Straightlines artwork SVG (stroke-only, fixed viewBox),
  decoded from URL params via `stln-codec`. Never edited on this site.
- **Texture:** the paper-grain SVG produced by this lab (rect-based, free
  viewBox).
- **Composite:** the Canvas-API raster combination of illustration + texture.

## Key links

- Straightlines spec: https://github.com/tksh/straightlines
- `stln-codec` (URL codec + SVG generator): https://github.com/tksh/stln-codec
- Straightlines customizer/viewer: https://pfpg.pages.dev/
- This lab: https://paper-grain-lab.pages.dev/
