# Integration Spec (`/` + `/stln/`, combined URLs)

Owns page routing, the combined URL grammar, and the data flow between the three
namespaces. Does not redefine any namespace’s keys.

## 1. Namespace reservation

| Keys                                       | Owner                                                  | Defined in                                               |
| ------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| Bare keys (`bits`, `title`, group keys, …) | `stln-codec` upstream (frozen by `pfpg` compatibility) | https://github.com/tksh/stln-codec — never redefine here |
| `tex.*`                                    | This repo, texture pipeline                            | `docs/10-texture-url-spec.md`                            |
| `cmp.*`                                    | This repo, composite/raster settings                   | `docs/20-composite-spec.md`                              |

Adding a new bare single-letter key in this repo is forbidden. New texture or
composite keys require an entry in this table’s follow-up ADR
(`docs/90-decisions.md`).

## 2. Page routing (path selects mode; query carries data only)

- `/` (pure lab): texture experimentation only. **Ignores** bare `stln` keys and
  `cmp.*` keys. Never imports `stln-codec`. No composite canvas element.
- `/stln/` (composite lab): requires an illustration (bare `stln` params
  present); `tex.*`/`cmp.*` optional with spec defaults. Adds a separate result
  `<canvas>` element alongside the existing texture preview. The Straightlines
  SVG is never edited here, so no illustration source pane.
- Rationale recorded in `docs/90-decisions.md` (ADR: split pages over
  param-switched single page).

## 3. Data flow (`/stln/`)

```
URL query
 ├─ bare stln params ─→ stln-codec decodeUrlToSvg({ pathMode: "relativeMerged" })
 │                       → illustration SVG string (+ viewBox)
 ├─ tex.* params ──────→ texture decode (docs/10 §6) → texture SVG string
 └─ cmp.* params ──────→ composite settings (docs/20 §2)
        │ rasterize both at cmp.w/h/dpr → canvas composite → preview + PNG export
```

- `stln-codec` is imported **only** via `deno.jsonc` `imports` and shipped via
  `deno bundle` (no CDN). See `docs/50-deno-workflow.md`.
- `pathMode` defaults to `relativeMerged` (compact; matches `pfpg` default
  sharing). A path-mode selector is deferred — not in the URL schema.
- The texture generator is the **same code** as the pure page (shared core).
  `/stln/` must not fork it.

## 4. Error policy

- `stln` part: strict (upstream throws on invalid flags/malformed payloads) →
  surface a readable error pane on `/stln/`; render nothing rather than a
  partial illustration.
- `tex.*` part: lenient (ignore unknown keys, default malformed values) per
  `docs/10-texture-url-spec.md` §6.
- `cmp.*` part: lenient with documented fallbacks (`docs/20-composite-spec.md`).

## 5. Share links

Canonical key order for stable, diffable URLs: bare `stln` keys (upstream
order), then `tex.*` in slot order, then `cmp.*` in `docs/20` table order.
Omitting a default-valued key and writing it explicitly MUST decode identically
(round-trip property; covered by tests in Phase 2).
