/* Code-pane highlighting tests (docs/40, docs/60 Milestone B2).
 * Run: deno task test
 */
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import * as core from "../src/js/texture-core.js";
import * as hl from "../src/js/highlight.js";

/** Spans carry no text of their own, so removing them must yield the input. */
function stripSpans(html: string): string {
  return html
    .replace(/<span class="tok" style="background:[^"]+">/g, "")
    .replace(/<\/span>/g, "");
}

function unescape(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function batteryStates(): ReturnType<typeof core.deepClone>[] {
  const base = () => core.deepClone(core.DEFAULTS);
  const out = [base()];
  const full = base();
  core.deepMerge(full, {
    noise: { anisotropic: true },
    weave: { enabled: true },
    pulp: { enabled: true },
    distort: { enabled: true },
    light: { mode: "specular" },
    tint: { mode: "table", levels: 3 },
  });
  out.push(full);
  const spots = base();
  spots.tint.mode = "stainSpots";
  out.push(spots);
  return out;
}

Deno.test("highlighted pane strips back to the exact generator output", () => {
  for (const st of batteryStates()) {
    const svg = core.generateSVG(core.deepClone(st));
    // textContent of the pane equals the generator output: spans add no text.
    assertEquals(unescape(stripSpans(hl.highlightSVG(svg))), svg);
  }
});

Deno.test("every generator element maps to its dot color", () => {
  const expected: Record<string, string> = {
    svg: "#dfe1e6",
    feTurbulence: "#cfe8da",
    feBlend: "#e3d6f0",
    feGaussianBlur: "#f3ddbc",
    feDisplacementMap: "#f2d1cf",
    feDiffuseLighting: "#cfe0f2",
    feSpecularLighting: "#c9eeee",
    feDistantLight: "#eee6c2",
    feColorMatrix: "#f0d6e6",
    feComponentTransfer: "#d8d8f2",
    feFuncR: "#ecdcc0",
    feFuncG: "#ecdcc0",
    feFuncB: "#ecdcc0",
    rect: "#e2e2e2",
  };
  for (const [tag, color] of Object.entries(expected)) {
    assertEquals(hl.tokenColorFor(tag), color, tag);
  }
  assertEquals(hl.tokenColorFor("filter"), undefined);
  assertEquals(hl.tokenColorFor("defs"), undefined);
});

Deno.test("markup is escaped and unknown elements stay plain", () => {
  const line = hl.highlightSVGLine(`      <feBlend in="a&b" mode="x"/>`);
  assertStringIncludes(line, "a&amp;b");
  assert(!line.includes("<feBlend"), "no raw tags leak");
  assertEquals(
    hl.highlightSVGLine("      </feDiffuseLighting>"),
    '      &lt;/<span class="tok" style="background:#cfe0f2">feDiffuseLighting</span>&gt;',
  );
  assertEquals(hl.highlightSVGLine("    <defs>"), "    &lt;defs&gt;");
  assertEquals(hl.highlightSVGLine("not a tag"), "not a tag");
});

Deno.test("code pane is bright and light-mode-only (theme audit)", async () => {
  const css = await Deno.readTextFile(
    new URL("../src/css/styles.css", import.meta.url),
  );
  for (
    const dark of ["#1f1f1f", "#2b2b2b", "#e6e6e6", "prefers-color-scheme"]
  ) {
    assert(!css.includes(dark), `dark leftover: ${dark}`);
  }
  assertStringIncludes(css, "color-scheme: light");
  assertStringIncludes(css, "pre.code .tok");
});
