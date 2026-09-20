# Composite Spec (`cmp.*` namespace)

Single source of truth for compositing a paper texture over a Straightlines
illustration on the `/stln/` page via the Canvas API. Owns **only** the `cmp.*`
namespace.

## 1. Layer model

- Two layers, each rasterized independently at the output bitmap size, then
  combined in one canvas 2D context:
  - **Art layer:** illustration SVG from `stln-codec` decode (stroke-only, fixed
    viewBox). Never edited here.
  - **Texture layer:** texture SVG from this lab (`tex.*` decode → same
    generator as the pure page).
- Default order: **texture over art** with blend `multiply` (paper grain darkens
  the illustration like real paper). Order, mode, and opacity are all
  customizable (see §2).
- Dual background: by default **both** backgrounds are kept (Straightlines
  `id="0"` stroke background + texture `rect` base). Setting `cmp.ignoreBg=1`
  drops the illustration’s `id="0"` group before rasterizing.

## 2. Keys

| Key            | Type                         | Default        | Notes                                                                 |
| -------------- | ---------------------------- | -------------- | --------------------------------------------------------------------- |
| `cmp.order`    | `tex-over-art\|art-over-tex` | `tex-over-art` | Which layer is drawn on top with `cmp.mode`/`cmp.opacity`             |
| `cmp.mode`     | blend mode                   | `multiply`     | Applied to the top layer via `globalCompositeOperation`               |
| `cmp.opacity`  | 0–1                          | `1`            | `globalAlpha` of the top layer; independent of texture `finalOpacity` |
| `cmp.ignoreBg` | `0\|1`                       | `0`            | `1` drops illustration group `id="0"`                                 |
| `cmp.w`        | int px                       | `1024`         | Output layout width (CSS px); part of the share URL                   |
| `cmp.h`        | int px                       | `1024`         | Output layout height (CSS px); part of the share URL                  |
| `cmp.dpr`      | 1–4                          | `2`            | Bitmap multiplier for quality-first HiDPI output                      |

Blend allowlist (canvas 2D values): `source-over`, `multiply`, `screen`,
`overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`,
`soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`,
`luminosity`. Unknown values fall back to `multiply`. (`soft-light` has varying
browser fidelity — acceptable; documented, not blocked.)

## 3. Rasterization

- Output bitmap = `round(cmp.w × cmp.dpr)` × `round(cmp.h × cmp.dpr)` device px.
  The on-screen preview uses the same bitmap, CSS-scaled to fit (quality over
  speed; `cmp.dpr` stays customizable for slow devices).
- Each SVG source gets explicit `width`/`height` attributes equal to the bitmap
  size before `Image` decode (avoids default 300×150 rasterization).
- Scaling: `cover` + center into the bitmap (both sources are square today, so
  this is a no-op; the rule future-proofs non-square illustrations).
- Async protocol: decode SVG strings → `Blob` URLs → `Image.decode()`/load →
  draw in order with a generation counter; revoke object URLs; never draw a
  stale generation. Same-origin blob URLs keep the canvas untainted for `toBlob`
  export.

## 4. Export

- PNG now: `canvas.toBlob("image/png")` at full bitmap size.
- Lossless WebP / JPEG XL later: mime switch only; URL schema already carries
  everything needed (no new keys planned; a `cmp.format` key would be added only
  if auto-negotiation proves insufficient).
- Export size is fully determined by `cmp.w`/`cmp.h`/`cmp.dpr`, which are part
  of the share URL — an exported PNG is reproducible from the URL alone.
