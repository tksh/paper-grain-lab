/* Static SVG source highlighting for the pure-page code pane.
 *
 * Line-based tokenizer: wraps the leading element name of each generator
 * output line in a span carrying the same background color as the section
 * dots and field badges (ELEMENT_COLORS), so feature-to-code correspondence
 * is visible at a glance. Pure functions, no DOM — the pane assigns the
 * result to innerHTML while the copy path keeps reading textContent, which
 * preserves the pane.textContent === generatorOutput invariant.
 * See docs/40-highlighting-spec.md.
 */
import { ELEMENT_COLORS } from "./texture-core.js";

export function escapeHTML(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Element name to token background color. Combined map keys are resolved to
 * mirror the section dots: diffuse lighting uses the shared lighting color,
 * specular lighting uses its distinctive color, feFuncR/G/B share one. */
export function tokenColorFor(tag) {
  if (tag === "feDiffuseLighting") {
    return ELEMENT_COLORS["feDiffuseLighting/feSpecularLighting"];
  }
  if (tag === "feSpecularLighting") {
    return ELEMENT_COLORS["feSpecularLighting"];
  }
  if (tag === "feFuncR" || tag === "feFuncG" || tag === "feFuncB") {
    return ELEMENT_COLORS["feFuncR/feFuncG/feFuncB"];
  }
  return ELEMENT_COLORS[tag];
}

export function highlightSVGLine(line) {
  const escaped = escapeHTML(line);
  const m = line.match(/^\s*<\/?([A-Za-z]+)/);
  if (!m) return escaped;
  const color = tokenColorFor(m[1]);
  if (color === undefined) return escaped;
  return escaped.replace(
    /^(\s*)&lt;(\/?)([A-Za-z]+)/,
    `$1&lt;$2<span class="tok" style="background:${color}">$3</span>`,
  );
}

export function highlightSVG(svg) {
  return svg.split("\n").map(highlightSVGLine).join("\n");
}
