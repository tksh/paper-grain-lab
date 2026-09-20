# Deno-First Workflow

Owns repo mechanics: module resolution, tasks, bundling, and quality gates.
Product behavior lives in the other `docs/` files, not here.

## 1. `deno.jsonc`

```jsonc
{
  "imports": {
    "@tksh/stln-codec": "jsr:@tksh/stln-codec@0.1.3"
  },
  "tasks": {
    "check": "deno check src/js/app.js",
    "lint": "deno lint",
    "fmt": "deno fmt"
  },
  "fmt": {
    "exclude": [
      "src/js/app.js",
      "src/css/styles.css",
      "src/index.html",
      "src/stln/index.html"
    ]
  },
  "lint": {
    "exclude": ["src/js/app.js"]
  }
}
```

Phase 2 additions (when `src/stln/main.ts` and `tests/` land):

```jsonc
{
  "tasks": {
    "check": "deno check src/js/app.js src/stln/main.ts",
    "bundle:stln": "deno bundle --platform=browser --format=esm --outfile=src/stln/bundle.js src/stln/main.ts",
    "test": "deno test --allow-read tests/"
  }
}
```

Notes:

- `stln-codec` resolves ONLY through `imports` (pinned JSR version — bump via
  `deno outdated`/`deno add`). **No CDN `<script src>` at runtime, ever.**
- `src/js/app.js` (legacy IIFE) is excluded from `fmt` to avoid a whole-file
  reformat diff. `lint` covers the whole repo. All NEW code MUST be `fmt` AND
  `lint` clean — CI runs the tasks as defined here.
- `deno check` covers the legacy script (syntax-level for plain JS) and, in
  Phase 2, the typed `src/stln/main.ts` entry.

## 2. Bundling (Phase 2, `/stln/` only)

- The pure `/` page stays dependency-free (no bundle step).
- `/stln/` entry `src/stln/main.ts` imports `@tksh/stln-codec` (bare specifier →
  resolved by `imports`) plus the shared texture core. Ship it with:

```
deno task bundle:stln
```

i.e.
`deno bundle --platform=browser --format=esm --outfile=src/stln/bundle.js src/stln/main.ts`,
loaded by `src/stln/index.html` as a plain script. Verify `deno bundle --help`
if flags drift between Deno releases.

- Bundle output disposition (checked in vs. gitignored build artifact) is
  decided when `main.ts` lands; until then no bundle step runs in CI.

## 3. Publish mapping

- Static hosting (Cloudflare Pages): repo `src/` is the publish root;
  `src/stln/index.html` serves `/stln/` (verified live).
- Quality gate before any change: `deno task lint`, `deno task fmt --check` (new
  paths), `node --check` for legacy scripts, plus the spec acceptance checks in
  `docs/10`–`docs/40`.

## 4. Test layout (convention for Phase 1+)

- `tests/` (Deno): codec round-trips (`tex.*` encode→decode→SVG identity,
  omission⊆default equivalence), `cmp.*` fallback matrix, namespace reservation
  (no bare-key additions). Browser smoke stays manual via Pages preview deploys
  until a harness is justified.
