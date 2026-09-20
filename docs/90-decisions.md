# Architecture Decision Records (append-only)

Do not edit existing entries. New decisions get the next number with date.

## ADR-1 (2026-09-21): Split pages over param-switched single page

`/` stays the pure texture lab; `/stln/` is the composite lab. Path selects
mode, query carries data only. A single page switching on param presence would
fork every render/init path and let composite work regress the reference lab.

## ADR-2 (2026-09-21): Vanilla now, Solid 2.0 later if needed

The compositor’s Canvas core is imperative regardless of framework. Ship Phase 1
and the `/stln/` spike in vanilla; migrate to Solid 2.0 only when reactive
preview wiring (not mapping tables) becomes the dominant bug source.

## ADR-3 (2026-09-21): English-only development, English-default UI

Docs, comments, commits, identifiers: English only. The UI stays bilingual but
defaults to English (reversed from the original Japanese default).

## ADR-4 (2026-09-21): Prefixed namespaces (`tex.*`, `cmp.*`)

Everything this repo adds to URLs carries a prefix; bare keys belong to
`stln-codec` upstream forever. The old unprefixed short aliases (`w`, `p`, `d`,
`light`, `tint`) exist only as `tex.*` forms in the combined schema.

## ADR-5 (2026-09-21): Deno-first, no CDN, `deno bundle` for shipping

`stln-codec` resolves via `deno.jsonc` `imports` (pinned JSR) and ships via
`deno bundle` for `/stln/`. No runtime CDN script tags.

## ADR-6 (2026-09-21): Per-axis composite keys with export size in the URL

`cmp.w`/`cmp.h`/`cmp.dpr` are individually configurable and part of the share
URL, so an exported PNG is reproducible from the URL alone. Bitmap =
`round(w×dpr)` × `round(h×dpr)`; preview reuses the same bitmap (quality first).

## ADR-7 (2026-09-21): Static-only highlighting, light-only UI

Code-pane highlighting is static token backgrounds (no hover linkage). The app
implements light mode only, regardless of OS/browser scheme; the code pane
matches the bright panels.

## ADR-8 (2026-09-21): Delete, don’t archive, outdated docs

Superseded specs and prototype snapshots are removed with `rm` in the same
commit as their replacements (git retains history). Removed this round:
`paper-texture-url-encoding-spec*.md` (→ `docs/10`),
`anisotropic-base-frequency-change-display-fix-plan.md` (implemented),
`refs/by-claud.html` (unreferenced prototype).
