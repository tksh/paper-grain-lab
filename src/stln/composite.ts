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
  return coverRect(srcW, srcH, bitmap, bitmap);
}

/** Cover-fit destination rect into a (possibly non-square) bitmap. */
export function coverRect(
  srcW: number,
  srcH: number,
  bw: number,
  bh: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.max(bw / srcW, bh / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: (bw - dw) / 2, dy: (bh - dh) / 2, dw, dh };
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

/** Draw bottom (source-over, opaque) then top (blend + alpha). Resets
 * composite state afterwards. Cover-fits each layer by its own aspect into
 * the (possibly non-square) bitmap. Testable with a stub 2D context. */
export function paintLayers(
  ctx: CanvasRenderingContext2D,
  bottom: LayerImage,
  top: LayerImage,
  cmp: CompositeSettings,
  bw: number,
  bh: number,
): void {
  ctx.clearRect(0, 0, bw, bh);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const b = coverRect(bottom.width, bottom.height, bw, bh);
  ctx.drawImage(bottom.img, b.dx, b.dy, b.dw, b.dh);
  ctx.globalCompositeOperation = cmp.mode;
  ctx.globalAlpha = cmp.opacity;
  const t = coverRect(top.width, top.height, bw, bh);
  ctx.drawImage(top.img, t.dx, t.dy, t.dw, t.dh);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/* ---------- raster settings (docs/20 sections 3-4) ---------- */

export interface RasterSettings {
  w: number;
  h: number;
  dpr: number;
}

export const DEFAULT_RASTER: RasterSettings = { w: 1024, h: 1024, dpr: 2 };

/** Lenient parse: positive integers for w/h, 1-4 clamped dpr. */
export function parseRasterSettings(query: URLSearchParams): RasterSettings {
  const dim = (key: "cmp.w" | "cmp.h", fallback: number): number => {
    const raw = query.get(key);
    if (raw === null || raw.trim() === "") return fallback;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  const dprRaw = query.get("cmp.dpr");
  const dprNum = dprRaw === null || dprRaw.trim() === "" ? NaN : Number(dprRaw);
  return {
    w: dim("cmp.w", DEFAULT_RASTER.w),
    h: dim("cmp.h", DEFAULT_RASTER.h),
    dpr: Number.isFinite(dprNum)
      ? Math.min(4, Math.max(1, dprNum))
      : DEFAULT_RASTER.dpr,
  };
}

/** Output bitmap in device pixels (also the PNG export size). */
export function bitmapSize(r: RasterSettings): { bw: number; bh: number } {
  return { bw: Math.round(r.w * r.dpr), bh: Math.round(r.h * r.dpr) };
}

/* ---------- share links (docs/30 section 5) ---------- */

/** Base URL of the Straightlines illustration editor. */
export const ILLUSTRATION_BASE = "https://pfpg.pages.dev/";

/** Illustration-editor link: bare stln keys only (tex. and cmp. keys stripped), so
 * manual edits to illustration params in the active URL survive the trip. */
export function illustrationURL(query: URLSearchParams): string {
  const bare = stlnQuery(query).toString();
  return bare ? `${ILLUSTRATION_BASE}?${bare}` : `${ILLUSTRATION_BASE}?`;
}

const CMP_KEY_ORDER = [
  "cmp.order",
  "cmp.mode",
  "cmp.opacity",
  "cmp.ignoreBg",
  "cmp.w",
  "cmp.h",
  "cmp.dpr",
] as const;

/** Encode composite+raster settings, omitting defaults (canonical order). */
export function encodeCmpSettings(
  cmp: CompositeSettings,
  raster: RasterSettings,
): URLSearchParams {
  const params = new URLSearchParams();
  if (cmp.order !== DEFAULT_CMP.order) params.set("cmp.order", cmp.order);
  if (cmp.mode !== DEFAULT_CMP.mode) params.set("cmp.mode", cmp.mode);
  if (cmp.opacity !== DEFAULT_CMP.opacity) {
    params.set("cmp.opacity", String(cmp.opacity));
  }
  if (cmp.ignoreBg) params.set("cmp.ignoreBg", "1");
  if (raster.w !== DEFAULT_RASTER.w) params.set("cmp.w", String(raster.w));
  if (raster.h !== DEFAULT_RASTER.h) params.set("cmp.h", String(raster.h));
  if (raster.dpr !== DEFAULT_RASTER.dpr) {
    params.set("cmp.dpr", String(raster.dpr));
  }
  const ordered = new URLSearchParams();
  for (const key of CMP_KEY_ORDER) {
    const v = params.get(key);
    if (v !== null) ordered.set(key, v);
  }
  return ordered;
}

/** Verbatim tex.* slice of a query (original order preserved). */
export function texQuery(query: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of query) {
    if (key.startsWith("tex.")) out.append(key, value);
  }
  return out;
}

/** Combined share query: bare (stln) keys verbatim in original order, then
 * tex.*, then freshly encoded cmp.* (docs/30 section 5 canonical order).
 * The tex.* part defaults to passing the current query through verbatim;
 * callers with live-editable texture state pass freshly encoded params so
 * the link reproduces on-screen edits (unknown keys are then normalized
 * away — documented, not silent). */
export function buildShareQuery(
  current: URLSearchParams,
  cmpParams: URLSearchParams,
  texOverride?: URLSearchParams,
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of current) {
    if (!key.startsWith("tex.") && !key.startsWith("cmp.")) {
      out.append(key, value);
    }
  }
  for (const [key, value] of (texOverride ?? texQuery(current))) {
    out.append(key, value);
  }
  for (const [key, value] of cmpParams) out.append(key, value);
  return out;
}
