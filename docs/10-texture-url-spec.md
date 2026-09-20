# Texture URL Spec (`tex.*` namespace)

Single source of truth for encoding the paper-texture pipeline into URL
parameters. Replaces the earlier `paper-texture-url-encoding-spec*.md` (design
memos for a separate app — deleted).

## 1. Scope and principles

- This document owns **only** the `tex.*` namespace. `stln` (bare) keys belong
  to `stln-codec` upstream; `cmp.*` belongs to `docs/20-composite-spec.md`.
- The pipeline always fits 8 fixed **slots** in fixed order (see table in §2).
  At most 72 structural patterns exist
  (`2 weave × 2 pulp × 2 distort × 3 light × 3 tint`); continuous parameters
  layer on top. No generic filter-graph DSL is in scope.
- **Order is decided by the schema, not the URL.** The decoder assembles SVG in
  fixed slot order regardless of query-param order.
- **URL values are literal SVG strings.** The URL carries the already-computed
  attribute value (e.g. `values="0 0 0 0 0.35 …"`), never intermediate slider
  values (`alphaSlope`, `alphaBias`). Sliders are input assistance for producing
  literals. Consequence: changing a slider formula never breaks existing URLs.
- **Flat `key=value` pairs**, one attribute per param, usable with plain
  `URLSearchParams`. Multi-value attributes use comma separation (`,` needs no
  percent-encoding in query values).
- **Absent key = default / disabled.** Only non-default values need encoding.
  Unused filters simply never appear.

## 2. Slot table

| # | Stage                     | Presence        | Condition           | Elements                                                                                  |
| - | ------------------------- | --------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| 1 | Noise generation          | Required        | —                   | `feTurbulence` ×1                                                                         |
| 2 | Weave blend               | Conditional     | `tex.w` present     | `feTurbulence` ×1 + `feBlend` ×1                                                          |
| 3 | Pulp fiber layer (part 1) | Conditional     | `tex.p=1`           | `feTurbulence` ×1 + `feGaussianBlur` ×1                                                   |
| 4 | Distortion                | Conditional     | `tex.d=1`           | `feTurbulence` ×1 + `feDisplacementMap` ×1                                                |
| 5 | Lighting                  | Conditional     | `tex.light` present | `feDiffuseLighting` **or** `feSpecularLighting` (exclusive) + child `feDistantLight`      |
| 6 | Tinting                   | Conditional     | `tex.tint` present  | `feColorMatrix` **or** `feComponentTransfer` (exclusive) + (latter only) `feFuncR/G/B` ×3 |
| 7 | Pulp fiber layer (part 2) | Tied to stage 3 | `tex.p=1`           | `feColorMatrix` ×1 + `feBlend` ×1                                                         |
| 8 | Final composite           | Required        | —                   | `feBlend` ×1                                                                              |
| — | Backing sheet             | Required        | —                   | `rect` ×2 (base / texture layer)                                                          |
| — | Canvas                    | Required        | —                   | `svg` `viewBox`                                                                           |

Stage identity disambiguates recurrences: `feTurbulence` occurs in stages 1–4,
`feBlend` in stages 2/7/8, each at most once per stage. Child elements are fixed
relationships (parent present ⇒ child present exactly once, or `feFuncR/G/B`
exactly three times with identical settings), so child attributes flatten into
the parent slot.

## 3. Key naming

```
tex.<element><occurrence>.<SVG attribute> = <literal value>
```

Element codes (lowercase, fixed):

| Code | Element                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `tb` | `feTurbulence`                                                              |
| `bl` | `feBlend`                                                                   |
| `gb` | `feGaussianBlur`                                                            |
| `dm` | `feDisplacementMap`                                                         |
| `dl` | `feDiffuseLighting` (`feDistantLight` attrs flattened alongside)            |
| `sl` | `feSpecularLighting` (same)                                                 |
| `cm` | `feColorMatrix`                                                             |
| `ct` | `feComponentTransfer` (`feFuncR/G/B` share settings → single `tableValues`) |
| `rc` | `rect`                                                                      |
| `sv` | `svg`                                                                       |

Occurrence → stage: `tb1` stage 1; `tb2`/`bl1` stage 2; `tb3`/`gb1` stage 3;
`tb4`/`dm1` stage 4; `dl1` **or** `sl1` stage 5; `cm1` **or** `ct1` stage 6;
`cm2`/`bl2` stage 7; `bl3` stage 8; `rc1`/`rc2` backing; `sv1` canvas.

Short aliases (presence-doubled-as-flag, all under `tex.`):

| Key                           | Meaning                              |
| ----------------------------- | ------------------------------------ |
| `tex.w=<mode>`                | Stage 2 enabled; value is `bl1.mode` |
| `tex.p=1`                     | Stages 3+7 enabled                   |
| `tex.d=1`                     | Stage 4 enabled                      |
| `tex.light=diffuse\|specular` | Stage 5 enabled + element choice     |
| `tex.tint=matrix\|table`      | Stage 6 enabled + element choice     |

## 4. Full key list with defaults

Omitted keys fall back to the defaults below. Encoder SHOULD omit default-valued
keys.

| Key                                                 | Type                       | Default                             |
| --------------------------------------------------- | -------------------------- | ----------------------------------- |
| `tex.tb1.type`                                      | `fractalNoise\|turbulence` | `fractalNoise`                      |
| `tex.tb1.baseFrequency`                             | number or `x,y`            | `0.05`                              |
| `tex.tb1.numOctaves`                                | int                        | `3`                                 |
| `tex.tb1.seed`                                      | int                        | `2`                                 |
| `tex.w`                                             | blend mode                 | _(absent = stage 2 off)_            |
| `tex.p`                                             | `1`                        | _(absent = stages 3+7 off)_         |
| `tex.tb3.baseFrequency`                             | number                     | `0.08`                              |
| `tex.tb3.numOctaves`                                | int                        | `2`                                 |
| `tex.gb1.stdDeviation`                              | number                     | `1.5`                               |
| `tex.d`                                             | `1`                        | _(absent = stage 4 off)_            |
| `tex.tb4.baseFrequency`                             | number                     | `0.01`                              |
| `tex.tb4.numOctaves`                                | int                        | `2`                                 |
| `tex.dm1.scale`                                     | number                     | `20`                                |
| `tex.light`                                         | `diffuse\|specular`        | _(absent = stage 5 off)_            |
| `tex.dl1.surfaceScale` / `tex.sl1.surfaceScale`     | number                     | `2`                                 |
| `tex.dl1.azimuth` / `tex.sl1.azimuth`               | number                     | `60`                                |
| `tex.dl1.elevation` / `tex.sl1.elevation`           | number                     | `55`                                |
| `tex.dl1.lighting-color` / `tex.sl1.lighting-color` | 6-hex, no `#`              | `ffffff`                            |
| `tex.sl1.specularExponent`                          | number                     | `12`                                |
| `tex.tint`                                          | `matrix\|table`            | _(absent = stage 6 off)_            |
| `tex.cm1.values`                                    | 20 comma-separated numbers | _(required when `tex.tint=matrix`)_ |
| `tex.ct1.tableValues`                               | N comma-separated numbers  | _(required when `tex.tint=table`)_  |
| `tex.cm2.values`                                    | 20 comma-separated numbers | _(required when `tex.p=1`)_         |
| `tex.bl2.mode`                                      | blend mode                 | `multiply`                          |
| `tex.bl3.mode`                                      | blend mode                 | `multiply`                          |
| `tex.rc1.fill`                                      | 6-hex, no `#`              | `f6f3eb`                            |
| `tex.rc2.fill`                                      | 6-hex, no `#`              | `faf8f4`                            |
| `tex.rc2.opacity`                                   | 0–1                        | `0.9`                               |
| `tex.sv1.viewBox`                                   | `x,y,w,h`                  | `0,0,300,300`                       |

Value rules: numbers are plain decimal strings; colors strip the leading `#`
(avoids `%23`); `=1` flag values mean present/true. Reserved-but-currently-fixed
attributes (`diffuseConstant`, `specularConstant`, `xChannelSelector`,
`yChannelSelector`, `type="matrix"`) keep their dotted names reserved and are
never written today.

## 5. Encode (slider state → URL)

For each slot, compute the **literal** from slider state (same math as the SVG
generator: hex→float color matrix assembly, `x,y` join, `#` strip), then emit
the key only if it differs from default. Tint families (`alpha`, `stainMottle`,
`stainSpots`, `stainHaze`) all emit `tex.tint=matrix` plus the resulting
`tex.cm1.values` — the URL never distinguishes them.

## 6. Decode

Two decoder modes share the parser:

- **Render** (exact): pour literals into the fixed 8-slot SVG template in order;
  branch only on flag/selector presence. Never needs slider semantics.
- **Restore** (best-effort slider recovery): map literals back to slider state.
  `tex.tint` mode is inferred when only `tex.cm1.values` shape is available:
  20-number identity-RGB row + variable 20th value ⇒ `alpha`; `s 0 0 0`
  alpha-row ⇒ `stainMottle`; `s s s 0` alpha-row ⇒ `stainSpots`; `0 0 0`
  alpha-row + variable 19th value ⇒ `stainHaze`; `tex.ct1.*` present ⇒ `table`.
  Slider values that cannot be recovered (exact slope/bias/color decomposition
  is underdetermined) fall back to defaults and the change-tracker treats the
  restored state as the new baseline.

Texture decoding is **lenient**: unknown `tex.*` keys are ignored, malformed
values fall back to defaults. (Contrast: `stln-codec` decoding is strict and
throws — see `docs/30-integration-spec.md`.)

## 7. Examples

Rough grain (noise + diffuse light + composite):

```
?tex.tb1.type=fractalNoise&tex.tb1.baseFrequency=0.05&tex.tb1.numOctaves=3&tex.tb1.seed=2
&tex.light=diffuse&tex.dl1.surfaceScale=2&tex.dl1.azimuth=60&tex.dl1.elevation=50&tex.dl1.lighting-color=ffffff
&tex.bl3.mode=multiply
&tex.rc1.fill=f6f3eb&tex.rc2.fill=faf8f4&tex.rc2.opacity=0.95
&tex.sv1.viewBox=0,0,300,300
```

All stages on (weave + pulp + distort + specular + stain):

```
?tex.tb1.type=fractalNoise&tex.tb1.baseFrequency=0.05,0.95&tex.tb1.numOctaves=2&tex.tb1.seed=4
&tex.w=multiply
&tex.p=1&tex.tb3.baseFrequency=0.08&tex.tb3.numOctaves=2&tex.gb1.stdDeviation=1.5
&tex.d=1&tex.tb4.baseFrequency=0.08&tex.tb4.numOctaves=1&tex.dm1.scale=25
&tex.light=specular&tex.sl1.surfaceScale=0.8&tex.sl1.specularExponent=20&tex.sl1.azimuth=225&tex.sl1.elevation=65&tex.sl1.lighting-color=ffffff
&tex.tint=matrix&tex.cm1.values=0,0,0,0,0.35,0,0,0,0,0.25,0,0,0,0,0.15,1,0,0,0,0
&tex.cm2.values=1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0.25,0
&tex.bl2.mode=multiply&tex.bl3.mode=multiply
&tex.rc1.fill=f2e9dc&tex.rc2.fill=f2e9dc&tex.rc2.opacity=0.9
&tex.sv1.viewBox=0,0,300,300
```
