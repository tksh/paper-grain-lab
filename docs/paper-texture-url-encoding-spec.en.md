# URL-Parameter Encoding Design for the Paper-Texture SVG Filter Pipeline

This document analyzes the filter pipeline built in Paper Grain Lab and
proposes a URL-parameter specification for a separate application, under the
requirement that: *the actual SVG filter element and attribute names in use
should be encoded directly as URL parameters, and any filter that is not in
use should simply be absent from the URL.*

---

## 1. First, analyze the state space — what can vary, and how

The filter pipeline in this lab has an important property: no matter how
freely the user customizes it, **it never becomes an arbitrarily unbounded
structure.** Whether the source is a preset, a recipe, or manual slider
tweaking, the filter that ultimately gets generated always fits into one of
the following 8 fixed "slots," always in the same order.

| # | Stage | Always present | Condition | SVG elements used |
|---|---|---|---|---|
| 1 | Noise generation | Yes, required | — | `feTurbulence` ×1 |
| 2 | Weave blend | Conditional | `weave.enabled` | `feTurbulence` ×1 + `feBlend` ×1 |
| 3 | Pulp fiber layer (part 1) | Conditional | `pulp.enabled` | `feTurbulence` ×1 + `feGaussianBlur` ×1 |
| 4 | Distortion / tearing | Conditional | `distort.enabled` | `feTurbulence` ×1 + `feDisplacementMap` ×1 |
| 5 | Lighting | Conditional | `light.mode !== "none"` | `feDiffuseLighting` **or** `feSpecularLighting` (mutually exclusive) + child `feDistantLight` |
| 6 | Tint / staining | Conditional | `tint.mode !== "none"` | `feColorMatrix` **or** `feComponentTransfer` (mutually exclusive) + (latter only) child `feFuncR/G/B` ×3 |
| 7 | Pulp fiber layer (part 2) | Tied to stage 3 | `pulp.enabled` | `feColorMatrix` ×1 + `feBlend` ×1 |
| 8 | Final composite | Yes, required | — | `feBlend` ×1 |
| — | Backing sheet | Yes, required | — | `rect` ×2 (base layer / texture layer) |
| — | Canvas | Yes, required | — | `svg`'s `viewBox` |

This table already answers the "hard parts" you flagged:

- **`feTurbulence` can appear up to 4 times** (stages 1, 2, 3, 4) → but each
  occurrence belongs to exactly one, uniquely determined stage; the same
  stage never contains more than one occurrence. In other words, **the
  "stage" itself is a natural instance identifier.**
- **`feBlend` can appear up to 3 times** (stages 2, 7, 8) → same reasoning:
  the stage tells you unambiguously which composite it is.
- **`azimuth`/`elevation` only ever appear on `feDistantLight`** (the child
  of `feDiffuseLighting` or `feSpecularLighting`), so unlike `baseFrequency`
  they never collide with anything in the first place. Even attributes that
  *do* recur across elements (`baseFrequency`, `numOctaves`, `mode`, etc.)
  become unambiguous the moment you know which stage they belong to.
- **The `feDiffuseLighting`/`feSpecularLighting` exclusive choice** and the
  **`feColorMatrix`/`feComponentTransfer` exclusive choice** each reduce to
  a single "which element to use" selector parameter (details below).
- **Nesting** (`feDistantLight`, `feFuncR/G/B`) is, in this pipeline, always
  a **fixed relationship**: if the parent exists, the child always exists
  exactly once (or, for `feFuncR/G/B`, exactly three times with identical
  settings). There is no need to represent a truly arbitrary XML tree — the
  child's attributes can simply be flattened into the parent's slot without
  losing any information.
- **Deterministic reproduction of ordering** doesn't need to depend on the
  order of URL parameters at all. The "order" in the table above is fixed by
  the stage definitions themselves, so the decoder can always assemble the
  SVG in this same order. The key design move is to **decouple "the order
  things are written in the URL" from "the order things are emitted into the
  SVG."**

In conclusion, the total number of structural patterns that can ever be
generated is
`2(weave) × 2(pulp) × 2(distort) × 3(light: none/diffuse/specular) × 3(tint: none/matrix-family/table)`
= at most 72 "structural patterns," each with continuous-valued parameters
layered on top — a **finite, enumerable combinatorial space.** There's no
need to build a generic DSL capable of representing arbitrary filter graphs;
a schema specialized to these 8 slots is fully sufficient (the fully generic
case is discussed in Section 6).

---

## 2. Three core design principles

1. **Order is decided by the schema, not by the URL.**
   Don't trust the order of URL query parameters. Each parameter key
   self-describes which stage / which element / which attribute it belongs
   to, and the decoder always assembles the SVG in the fixed 8-stage order.
2. **Make URL parameter values a 1:1 match with "the literal string that
   actually gets written into the SVG."**
   Rather than putting stage-side, meaning-laden values (e.g. `alphaSlope`,
   `alphaBias`) into the URL, put the **already-computed, actual attribute
   value** — e.g. `values="0 0 0 0 0.35 ..."` — into the URL. Friendly
   slider UIs should be treated purely as "input assistance for producing
   this literal string." This gives you:
   - A decoder that just pours the string into a template left to right,
     with no need to duplicate the same formula on both the encoding and
     decoding sides.
   - Backward compatibility: even if the UI's formula changes in the
     future, existing URLs (i.e. already-committed literal values) are
     unaffected.
3. **Use a flat `key=value` list, prefixed with "owning stage + occurrence
   instance number."**
   Don't invent a custom mini-syntax (like `;`-delimited sub-fields).
   Instead, default to a fully flat form — one attribute per one query
   parameter — so that a standard `URLSearchParams` can be used as-is.

---

## 3. Proposed key naming convention

```
<element abbreviation><occurrence number>.<SVG attribute name> = <literal value>
```

Element abbreviations are fixed, 2-letter lowercase codes:

| Abbrev. | SVG element |
|---|---|
| `tb` | `feTurbulence` |
| `bl` | `feBlend` |
| `gb` | `feGaussianBlur` |
| `dm` | `feDisplacementMap` |
| `dl` | `feDiffuseLighting` (the child `feDistantLight`'s attributes are flattened in alongside it) |
| `sl` | `feSpecularLighting` (same as above) |
| `cm` | `feColorMatrix` |
| `ct` | `feComponentTransfer` (the child `feFuncR/G/B` share identical settings, so they collapse into a single `tableValues`) |
| `rc` | `rect` |
| `sv` | `svg` (`viewBox`, etc.) |

Occurrence numbers are fixed to a stage position (they're a label for "where
in the schema," not a value, so there's nothing to memorize — they're simply
fixed by the spec):

| Occurrence | Corresponding stage |
|---|---|
| `tb1` | Stage 1: primary noise |
| `tb2` / `bl1` | Stage 2: weave blend |
| `tb3` / `gb1` | Stage 3: pulp fiber (part 1) |
| `tb4` / `dm1` | Stage 4: distortion |
| `dl1` **or** `sl1` | Stage 5: lighting (exclusive) |
| `cm1` **or** `ct1` | Stage 6: tint (exclusive) |
| `cm2` / `bl2` | Stage 7: pulp fiber (part 2) |
| `bl3` | Stage 8: final composite |
| `rc1` / `rc2` | Backing sheet (base layer / texture layer) |
| `sv1` | Canvas |

### How to express whether a stage is enabled or disabled

- **Stages with only a single attribute** (weave blend has only
  `feBlend.mode`) can use the mere presence of that attribute as the
  "present = enabled" signal.
  → If `w=multiply` is present, weave blend is enabled — writing this as
  `bl1.mode=multiply` would be redundant, so **single-attribute stages may
  use a shortened key that omits the element abbreviation entirely**
  (`w`) (see the "omission rules" below).
- **Stages with multiple attributes** (pulp, distortion) are safer with an
  explicit ON/OFF flag of their own (`p=1`, `d=1`). Inferring the enabled
  state purely from "are any of these attribute keys present" risks
  misinterpreting a partially-malformed state (e.g. a bug on the
  URL-generating side that dropped some attributes) as "enabled."
- **Stages with a mutually exclusive choice** (lighting, tint) carry a small
  selector key indicating which element to use, and that key doubles as the
  enable flag:
  - `light=diffuse` / `light=specular` / (key absent = no lighting)
  - `tint=matrix` / `tint=table` / (key absent = no tint)
    Note: the three tint "families" (continuous mottling, spots, faint
    overall haze) are all, under the hood, nothing but different contents
    of `feColorMatrix`'s `values` attribute — there's no need to
    distinguish them at the URL level at all. The contents of `cm1.values`
    say everything that's needed.

### Value encoding

| Value type | Policy | Example |
|---|---|---|
| Number | Plain decimal string | `tb1.baseFrequency=0.05` |
| Multi-value attribute (`baseFrequency`'s X/Y, `values`'s 20 numbers, `tableValues`'s N numbers) | Comma-separated (`,` needs no percent-encoding inside a query value) | `tb1.baseFrequency=0.05,0.4` |
| Color | 6-digit hex with the leading `#` stripped (avoids `%23` encoding) | `dl1.lighting-color=ffffff` |
| Enable/disable flag | Key presence = true, with `=1` as the value | `p=1` |
| Element selector | Fixed-vocabulary string | `light=specular` |
| viewBox | `x,y,w,h` as-is, comma-separated | `sv1.viewBox=0,0,300,300` |

### Omission rules (optional optimization to shorten URLs)

- Any attribute whose key is absent falls back to the app's default value.
  → Since **only values that differ from the default ever need to be
  written**, URLs end up considerably shorter in practice in most cases (for
  instance, attributes that the current UI treats as fixed constants —
  `diffuseConstant`, `specularConstant`, `type="matrix"`,
  `xChannelSelector`, `yChannelSelector` — are essentially never written at
  all).
- Conversely, it's worth **reserving the same naming-convention namespace**
  for these "currently fixed, but might be exposed in the UI later"
  attributes too (`dl1.diffuseConstant`, `dm1.xChannelSelector`, etc.). Even
  if unused today, this avoids collisions with existing URLs once an
  attribute is exposed in the future.

---

## 4. Worked examples

### Example A: A simple case (roughly "Rough Grain" — lighting only)

Enabled stages: 1 (noise), 5 (lighting/diffuse), 8 (final composite),
backing sheet, canvas.

```
?tb1.type=fractalNoise&tb1.baseFrequency=0.05&tb1.numOctaves=3&tb1.seed=2
&light=diffuse&dl1.surfaceScale=2&dl1.azimuth=60&dl1.elevation=50&dl1.lighting-color=ffffff
&bl3.mode=multiply
&rc1.fill=f6f3eb&rc2.fill=faf8f4&rc2.opacity=0.95
&sv1.viewBox=0,0,300,300
```

Notice that no weave, pulp, or distortion keys appear at all. Filters that
aren't in use simply never show up in the URL.

### Example B: Every stage enabled (the most complex case — weave + pulp + distortion + specular lighting + spotting)

```
?tb1.type=fractalNoise&tb1.baseFrequency=0.05,0.95&tb1.numOctaves=2&tb1.seed=4
&w=multiply
&p=1&tb3.baseFrequency=0.08&tb3.numOctaves=2&gb1.stdDeviation=1.5
&d=1&tb4.baseFrequency=0.08&tb4.numOctaves=1&dm1.scale=25
&light=specular&sl1.surfaceScale=0.8&sl1.specularExponent=20&sl1.azimuth=225&sl1.elevation=65&sl1.lighting-color=ffffff
&tint=matrix&cm1.values=0,0,0,0,0.35,0,0,0,0,0.25,0,0,0,0,0.15,1,0,0,0,0
&cm2.values=1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0.25,0
&bl2.mode=multiply&bl3.mode=multiply
&rc1.fill=f2e9dc&rc2.fill=f2e9dc&rc2.opacity=0.9
&sv1.viewBox=0,0,300,300
```

`tb1` (primary noise), `tb3` (pulp noise), and `tb4` (distortion noise) all
appear simultaneously three times, but the key-name prefixes alone
(`tb1.`, `tb3.`, `tb4.`) disambiguate them completely.

---

## 5. Decoder pseudo-algorithm

None of the encoding-side computation (slider value → literal string) needs
to leak into the decoder at all — the decoder can be a simple function that
just "pours values into a fixed-order template."

```js
function decodeAndRender(params){
  const g = (key, fallback) => params.has(key) ? params.get(key) : fallback;
  const lines = [];

  // Stage 1: required
  lines.push(feTag("feTurbulence", {
    type: g("tb1.type","fractalNoise"),
    baseFrequency: g("tb1.baseFrequency","0.05").replace(/,/g," "),
    numOctaves: g("tb1.numOctaves","3"),
    seed: g("tb1.seed","0"),
  }, "noise1"));
  let cur = "noise1";

  // Stage 2: conditional
  if (params.has("w")){
    lines.push(feTag("feTurbulence", { /* tb2 is derived from the primary noise,
       so it can be omitted; if you want it fully independent, read tb2.* here */ }, "noise2"));
    lines.push(feTag("feBlend", { in:"noise1", in2:"noise2", mode: params.get("w") }, "noiseWeave"));
    cur = "noiseWeave";
  }

  // ... stages 3–8 are built the same way: "add if the key is present, order is fixed" ...

  return lines.join("\n");
}
```

The key point is that **the only branching condition is "is this stage's
enable flag / selector key present or not"** — the decoder never needs to
understand the *meaning* of a value (e.g. computing a threshold from a
slope). This ends up being structurally identical to this lab's own
`generateSVG()` function. In fact, this lab's internal `state` object is
already nearly 1:1 with the URL schema proposed here — the only difference
is whether it holds meaning-laden intermediate values (like `alphaSlope`) or
the literal values themselves.

---

## 6. If you eventually want to support a fully generic, arbitrary filter graph

For the requirement at hand (adding the paper-texture pipeline as an
optional feature), the "fixed 8-slot scheme" above is sufficient. But if you
later want to build "a node editor that lets users freely add filter nodes
of any kind, in any quantity, in any order," you'd need a fundamentally
different design. For reference, here's the direction it would take:

- Serialize the entire filter as an "ordered list of nodes" into a single
  parameter (e.g. concatenate node descriptors with a delimiter inside one
  `f=` key).
- Each node takes the form `id:elementName:attr=value,attr=value,...`, and
  `in`/`in2` directly reference other nodes' `id`s (or literals like
  `SourceGraphic`).
- Since every node has a unique `id`, the same element name can recur any
  number of times without collision.
- Child elements (like `feDistantLight`) are also modeled as independent
  nodes, with a pseudo-attribute `parent=<parent id>` expressing the
  parent-child relationship (rather than reproducing true XML nesting, a
  node list plus parent references is sufficient to represent it).
- Because **the order in which nodes are written in the list is itself the
  construction order**, there's no need to rely on the order of URL
  parameters (i.e. this simply applies the same idea as Principle 1, but
  inside the list itself).

That said, this approach effectively amounts to building a brand-new "mini
DSL for SVG filters plus its editor UI," and the implementation cost of the
corresponding node add/remove/wiring UI is significant. Given the actual
requirement here (adding the paper-texture option), this is likely
over-engineering — it's recommended to start with the fixed-slot scheme from
Section 3 instead.
