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

/** Decode an illustration query to an SVG document. Throws upstream errors
 * on invalid params (surfaced by the error pane, docs/30 section 4). */
export async function decodeIllustration(
  query: URLSearchParams,
): Promise<Illustration> {
  const data: DecodedParams = await decodeUrlParams(query);
  const svg = generateSvg(data, { pathMode: STLN_PATH_MODE });
  return {
    svg,
    viewBox: data.sizeData.viewbox,
    width: data.sizeData.width,
    height: data.sizeData.height,
  };
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
