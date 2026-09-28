# paper-grain-lab

A paper-texture simulator using pure SVG filters, plus (Phase 2) Canvas-based
compositing of the texture over Straightlines illustrations.

- Live: https://paper-grain-lab.pages.dev/ (pure lab) and
  https://paper-grain-lab.pages.dev/stln/ (composite lab)
- Start with `docs/00-overview.md`, then the spec for your area (`docs/10`
  texture URL, `docs/20` composite, `docs/30` integration, `docs/40`
  highlighting, `docs/50` workflow). Decisions: `docs/90-decisions.md`.
- Agent instructions: `AGENTS.md`.
- Related: [Straightlines spec](https://github.com/tksh/straightlines),
  [stln-codec](https://github.com/tksh/stln-codec),
  [pfpg customizer](https://pfpg.pages.dev/)

## Development

Prerequisite: [Deno](https://deno.com/) (see `deno --version`).

```sh
deno task dev      # rebuild the /stln/ bundle and serve src/ at http://localhost:8000/
```

Open http://localhost:8000/ for the pure lab and http://localhost:8000/stln/ for
the composite lab.

Other tasks: `deno task check`, `deno task lint`, `deno task fmt`,
`deno task test`, `deno task bundle:stln`. All must pass before commit.
