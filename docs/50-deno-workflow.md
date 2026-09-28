# Deno-First Workflow

Owns repo mechanics: module resolution, tasks, bundling, and quality gates.
Product behavior lives in the other `docs/` files, not here.

## 1. `deno.jsonc`

```jsonc
{
  "imports": {
    "@std/assert": "jsr:@std/assert@1",
    "@tksh/stln-codec": "jsr:@tksh/stln-codec@0.1.3"
  },
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext", "deno.ns"]
  },
  "tasks": {
    "check": "deno check src/js/app.js src/js/tex-codec.js src/js/texture-core.js src/js/highlight.js src/stln/main.ts",
    "lint": "deno lint",
    "fmt": "deno fmt",
    "test": "deno test --allow-read tests/",
    "bundle:stln": "deno bundle --platform=browser --format=esm -o src/stln/bundle.js src/stln/main.ts"
  },
  "fmt": {
    "exclude": [
      "src/js/app.js",
      "src/css/styles.css",
      "src/index.html",
      "src/stln/index.html",
      "src/stln/bundle.js"
    ]
  },
  "lint": {
    "exclude": ["src/stln/bundle.js"]
  }
}
```

When adding entries, extend the `check` task and (for `/stln/` browser code) the
bundle input. Generated `src/stln/bundle.js` is committed so the page works with
zero deploy configuration; it is fmt/lint-excluded.

Notes:

- `stln-codec` resolves ONLY through `imports` (pinned JSR version — bump via
  `deno outdated`/`deno add`). **No CDN `<script src>` at runtime, ever.**
- `src/js/app.js` (legacy IIFE) is excluded from `fmt` to avoid a whole-file
  reformat diff. `lint` covers the whole repo. All NEW code MUST be `fmt` AND
  `lint` clean — CI runs the tasks as defined here.
- `deno check` covers the legacy script (syntax-level for plain JS) and the
  typed `src/stln/main.ts` entry (full type-check with DOM lib).

## 2. Bundling (Phase 2, `/stln/` only)

- The pure `/` page stays dependency-free (no bundle step).
- `/stln/` entry `src/stln/main.ts` imports `@tksh/stln-codec` (bare specifier →
  resolved by `imports`) plus the shared texture core. Ship it with:

```
deno task bundle:stln
```

i.e.
`deno bundle --platform=browser --format=esm -o src/stln/bundle.js src/stln/main.ts`,
loaded by `src/stln/index.html` as a module script. `deno bundle` is
experimental: re-check `deno bundle --help` when upgrading Deno (the output flag
is `-o`, not `--outfile`).

- `src/stln/bundle.js` is committed (works with zero deploy configuration) and
  fmt/lint-excluded as a generated artifact. Rebuild it with
  `deno task bundle:stln` whenever `src/stln/main.ts` or its imports change, and
  commit the result in the same commit.

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
