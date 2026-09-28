/* Composite helpers for /stln/ (pure logic; DOM and canvas stay in main.ts).
 *
 * Illustration decoding reuses stln-codec upstream: decode URL params to data,
 * then generate the SVG document. Raster sizing injects explicit dimensions
 * (SVG without intrinsic size rasterizes unpredictably). See docs/20 and
 * docs/30.
 */
import {
  type DecodedParams,
  decodeUrlParams,
  generateSvg,
} from "@tksh/stln-codec";

export const STLN_PATH_MODE = "relativeMerged" as const;

/** Preview bitmap used before C4 makes raster size configurable. */
export const PREVIEW_SIZE = 1024;

export interface Illustration {
  svg: string;
  viewBox: string;
  width: number;
  height: number;
}

/** Partition a combined share query: stln-codec rejects unknown keys, so it
 * must only ever see the bare upstream keys. Our prefixes contain a literal
 * "." which never occurs in upstream key alphabets, making this split sound.
 * See docs/30-integration-spec.md section 3. */
export function stlnQuery(query: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of query) {
    if (!key.startsWith("tex.") && !key.startsWith("cmp.")) {
      out.append(key, value);
    }
  }
  return out;
}

/** Decode an illustration query to an SVG document. Throws upstream errors
 * on invalid params (surfaced by the error pane, docs/30 section 4). */
export async function decodeIllustration(
  query: URLSearchParams,
  opts: { ignoreBg?: boolean } = {},
): Promise<Illustration> {
  const data: DecodedParams = await decodeUrlParams(stlnQuery(query));
  return illustrationSvg(data, { ignoreBg: opts.ignoreBg ?? false });
}

/** Return a copy of an SVG document string with explicit root width/height
 * (existing double-quoted attributes are replaced; the pair is always
 * emitted width-first so output is deterministic). */
export function withExplicitSize(svg: string, w: number, h: number): string {
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open) return svg;
  const tag = open[0]
    .replace(/\s+\bwidth="[^"]*"/, "")
    .replace(/\s+\bheight="[^"]*"/, "")
    .replace(/<svg\b/, `<svg width="${w}" height="${h}"`);
  return svg.slice(0, open.index) + tag +
    svg.slice(open.index! + open[0].length);
}

/** Cover-fit destination rect of a source aspect into a square bitmap. */
export function coverDest(
  srcW: number,
  srcH: number,
  bitmap: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.max(bitmap / srcW, bitmap / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: (bitmap - dw) / 2, dy: (bitmap - dh) / 2, dw, dh };
}

/* ---------- composite settings (docs/20 section 2) ---------- */

export const CMP_ORDER_TOP_TEXTURE = "tex-over-art";
export const CMP_ORDER_TOP_ART = "art-over-tex";
export const CMP_ORDERS = [CMP_ORDER_TOP_TEXTURE, CMP_ORDER_TOP_ART] as const;
export type CmpOrder = (typeof CMP_ORDERS)[number];

/** Canvas 2D blend modes allowed for the top layer (docs/20 section 2). */
export const CMP_BLENDS = [
  "source-over",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;
export type CmpBlend = (typeof CMP_BLENDS)[number];

export interface CompositeSettings {
  order: CmpOrder;
  mode: CmpBlend;
  opacity: number;
  ignoreBg: boolean;
}

export const DEFAULT_CMP: CompositeSettings = {
  order: CMP_ORDER_TOP_TEXTURE,
  mode: "multiply",
  opacity: 1,
  ignoreBg: false,
};

/** Lenient parse: unknown values fall back to DEFAULT_CMP per key. Opacity
 * is clamped to [0,1] so behavior stays deterministic. */
export function parseCmpSettings(query: URLSearchParams): CompositeSettings {
  const orderRaw = query.get("cmp.order");
  const order: CmpOrder = orderRaw === CMP_ORDER_TOP_ART
    ? CMP_ORDER_TOP_ART
    : CMP_ORDER_TOP_TEXTURE;
  const modeRaw = query.get("cmp.mode");
  const mode: CmpBlend =
    (CMP_BLENDS as readonly string[]).includes(modeRaw ?? "")
      ? (modeRaw as CmpBlend)
      : DEFAULT_CMP.mode;
  const opacityRaw = query.get("cmp.opacity");
  // NOTE: Number(null) and Number("") are both 0, so missing/empty values
  // need explicit handling to fall back instead of silencing the layer.
  const opacityNum = opacityRaw === null || opacityRaw.trim() === ""
    ? NaN
    : Number(opacityRaw);
  const opacity = Number.isFinite(opacityNum)
    ? Math.min(1, Math.max(0, opacityNum))
    : DEFAULT_CMP.opacity;
  return {
    order,
    mode,
    opacity,
    ignoreBg: query.get("cmp.ignoreBg") === "1",
  };
}

/** Drop the illustration background group (id 0), keeping sizeData so the
 * viewBox survives (docs/20 section 1). */
export function withoutBackgroundGroup(data: DecodedParams): DecodedParams {
  const linesData = new Map(data.linesData);
  linesData.delete(0);
  return { ...data, linesData };
}

/** Illustration SVG with optional background-group removal. */
export function illustrationSvg(
  data: DecodedParams,
  opts: { ignoreBg: boolean },
): { svg: string; viewBox: string; width: number; height: number } {
  const kept = opts.ignoreBg ? withoutBackgroundGroup(data) : data;
  return {
    svg: generateSvg(kept, { pathMode: STLN_PATH_MODE }),
    viewBox: data.sizeData.viewbox,
    width: data.sizeData.width,
    height: data.sizeData.height,
  };
}

export interface LayerImage {
  img: HTMLImageElement;
  width: number;
  height: number;
}

/** Draw bottom (source-over, opaque) then top (blend + alpha) into a square
 * bitmap. Resets composite state afterwards. Cover-fits each layer by its
 * own aspect. Testable with a stub 2D context. */
export function paintLayers(
  ctx: CanvasRenderingContext2D,
  bottom: LayerImage,
  top: LayerImage,
  cmp: CompositeSettings,
  bitmap: number,
): void {
  ctx.clearRect(0, 0, bitmap, bitmap);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const b = coverDest(bottom.width, bottom.height, bitmap);
  ctx.drawImage(bottom.img, b.dx, b.dy, b.dw, b.dh);
  ctx.globalCompositeOperation = cmp.mode;
  ctx.globalAlpha = cmp.opacity;
  const t = coverDest(top.width, top.height, bitmap);
  ctx.drawImage(top.img, t.dx, t.dy, t.dw, t.dh);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
