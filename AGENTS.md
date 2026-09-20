# AGENTS.md — paper-grain-lab

## Read first

1. `docs/00-overview.md` (product, pages, phases, hard requirements).
2. The spec for your task: `docs/10` (texture URL), `docs/20` (composite),
   `docs/30` (integration), `docs/40` (highlighting), or `docs/50` (workflow).
3. `docs/90-decisions.md` for why things are the way they are.

`docs/*.md` (English) are the source of truth. If code disagrees with docs, ask
— do not silently follow the code.

## Layout

- `src/index.html` + `src/js/app.js` + `src/css/styles.css` — pure lab (`/`).
  Legacy vanilla IIFE; English-default bilingual UI; light theme only.
- `src/stln/index.html` — composite lab (`/stln/`). Shared texture core is
  reused, never forked. Phase 2 adds `src/stln/main.ts` (bundled, see below).
- `docs/` — all specs/plans. `tests/` — Deno tests (Phase 1+).
- No `refs/` directory. Do not recreate it.

## URL namespaces (hard rules)

- Bare keys belong to `stln-codec` upstream — never define or redefine them.
- Texture keys: `tex.*` only (`docs/10`). Composite keys: `cmp.*` only
  (`docs/20`). Never add unprefixed keys.
- Path selects page mode; query carries data only. `/` ignores `stln`/`cmp`
  keys.

## Toolchain (Deno-first, no CDN)

- `deno task check`, `deno task lint`, `deno task fmt` MUST pass before commit.
  Legacy `src/js/app.js` is fmt-excluded until modularized — new code has no
  excludes.
- Import `stln-codec` only via `deno.jsonc` `imports` (`@tksh/stln-codec`). Ship
  browser code with `deno bundle` per `docs/50`. No CDN `<script src>`.
- Verify legacy scripts with `node --check`.

## Don'ts

- No dark mode, no `prefers-color-scheme` branches (`color-scheme: light`).
- No combined-SVG output; PNG export only (WebP/JPEG-XL later).
- No illustration editing on lab side; never modify Straightlines SVG here.
- No non-English docs, comments, or commit messages (UI `ja:` literals stay —
  they are product content, not development language).
- Commit messages: Conventional Commits (e.g. `feat(ui): …`, `docs: …`,
  `chore: …`). Only commit when explicitly asked.

## Definition of done

- Spec acceptance checks in the relevant `docs/` file pass.
- `pane.textContent === generatorOutput` invariant holds for the code pane.
- Round-trip property holds: omitting a default-valued URL key decodes
  identically to writing it explicitly.
