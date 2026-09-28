/* tex.* URL codec: key table and scalar value codecs.
 *
 * Owns the data layer of docs/10-texture-url-spec.md. Encode (slider state
 * to params) and decode (params to SVG / slider state) build on top of this
 * table. Pure functions, no DOM. Unknown tex.* keys are ignored by decoders;
 * malformed values fall back to the defaults below (lenient policy).
 * See docs/10-texture-url-spec.md sections 3-4.
 */
import { fmt } from "./texture-core.js";

export const TEX_PREFIX = "tex.";

/* Canonical key order (slot order). Used when writing share URLs so they are
 * stable and diffable. */
export const TEX_KEY_ORDER = [
  "tex.tb1.type",
  "tex.tb1.baseFrequency",
  "tex.tb1.numOctaves",
  "tex.tb1.seed",
  "tex.w",
  "tex.p",
  "tex.tb3.baseFrequency",
  "tex.tb3.numOctaves",
  "tex.gb1.stdDeviation",
  "tex.d",
  "tex.tb4.baseFrequency",
  "tex.tb4.numOctaves",
  "tex.dm1.scale",
  "tex.light",
  "tex.dl1.surfaceScale",
  "tex.dl1.azimuth",
  "tex.dl1.elevation",
  "tex.dl1.lighting-color",
  "tex.sl1.surfaceScale",
  "tex.sl1.specularExponent",
  "tex.sl1.azimuth",
  "tex.sl1.elevation",
  "tex.sl1.lighting-color",
  "tex.tint",
  "tex.cm1.values",
  "tex.ct1.tableValues",
  "tex.cm2.values",
  "tex.bl2.mode",
  "tex.bl3.mode",
  "tex.rc1.fill",
  "tex.rc2.fill",
  "tex.rc2.opacity",
  "tex.sv1.viewBox",
];

/* URL-string defaults. Flag/selector keys (tex.w, tex.p, tex.d, tex.light,
 * tex.tint) and literal payloads (tex.cm1.values, tex.ct1.tableValues,
 * tex.cm2.values) have NO default: absence means off. Every other key falls
 * back to the value below when absent or malformed. These literals MUST equal
 * the formatted app DEFAULTS (locked by tests). */
export const TEX_DEFAULTS = {
  "tex.tb1.type": "fractalNoise",
  "tex.tb1.baseFrequency": "0.05",
  "tex.tb1.numOctaves": "3",
  "tex.tb1.seed": "2",
  "tex.tb3.baseFrequency": "0.08",
  "tex.tb3.numOctaves": "2",
  "tex.gb1.stdDeviation": "1.5",
  "tex.tb4.baseFrequency": "0.01",
  "tex.tb4.numOctaves": "2",
  "tex.dm1.scale": "20",
  "tex.dl1.surfaceScale": "2",
  "tex.dl1.azimuth": "60",
  "tex.dl1.elevation": "55",
  "tex.dl1.lighting-color": "ffffff",
  "tex.sl1.surfaceScale": "2",
  "tex.sl1.specularExponent": "12",
  "tex.sl1.azimuth": "60",
  "tex.sl1.elevation": "55",
  "tex.sl1.lighting-color": "ffffff",
  "tex.bl2.mode": "multiply",
  "tex.bl3.mode": "multiply",
  "tex.rc1.fill": "f6f3eb",
  "tex.rc2.fill": "faf8f4",
  "tex.rc2.opacity": "0.9",
  "tex.sv1.viewBox": "0,0,300,300",
};

/* Fixed vocabularies. */
export const NOISE_TYPES = ["fractalNoise", "turbulence"];
export const WEAVE_BLENDS = ["multiply", "overlay", "screen", "darken"];
export const COMPOSITE_BLENDS = [
  "multiply",
  "screen",
  "overlay",
  "normal",
  "darken",
  "soft-light",
];
export const LIGHT_SELECTORS = ["diffuse", "specular"];
export const TINT_SELECTORS = ["matrix", "table"];

export function isTexKey(key) {
  return typeof key === "string" && key.startsWith(TEX_PREFIX);
}

/* ---------- scalar value codecs (null = malformed) ---------- */

export function formatNumberList(nums) {
  return nums.map((n) => fmt(n)).join(",");
}

export function parseNumberList(raw, { minLength = 1, maxLength = 64 } = {}) {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length < minLength || parts.length > maxLength) return null;
  const nums = parts.map((s) => (s === "" ? NaN : Number(s)));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums;
}

export function formatFrequency(freqX, freqY, anisotropic) {
  return anisotropic ? `${fmt(freqX)},${fmt(freqY)}` : fmt(freqX);
}

export function stripHash(color) {
  if (typeof color !== "string") return null;
  let hex = color.startsWith("#") ? color.slice(1) : color;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return hex.toLowerCase();
}

export function addHash(hexNoHash) {
  return `#${hexNoHash}`;
}

export function parseViewBox(raw) {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^0,0,(\d+),(\d+)$/);
  if (!m || m[1] !== m[2]) return null;
  const size = Number(m[1]);
  if (!Number.isInteger(size) || size <= 0) return null;
  return size;
}

export function formatViewBox(size) {
  return `0,0,${size},${size}`;
}

export function parseInteger(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  return n;
}

export function parseVocab(raw, list) {
  return typeof raw === "string" && list.includes(raw) ? raw : null;
}
