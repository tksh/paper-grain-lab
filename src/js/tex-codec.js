/* tex.* URL codec: key table and scalar value codecs.
 *
 * Owns the data layer of docs/10-texture-url-spec.md. Encode (slider state
 * to params) and decode (params to SVG / slider state) build on top of this
 * table. Pure functions, no DOM. Unknown tex.* keys are ignored by decoders;
 * malformed values fall back to the defaults below (lenient policy).
 * See docs/10-texture-url-spec.md sections 3-4.
 */
import { deepClone, DEFAULTS, fmt, hexToRgb01 } from "./texture-core.js";

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
  "tex.sv1.viewBox": "0_0_300_300",
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
  // Underscore keeps URLs clean: unlike ",", "_" needs no percent-encoding.
  return nums.map((n) => fmt(n)).join("_");
}

export function parseNumberList(raw, { minLength = 1, maxLength = 64 } = {}) {
  if (typeof raw !== "string") return null;
  // Underscore-separated only (same convention as the pfpg artwork site).
  const parts = raw.split("_");
  if (parts.length < minLength || parts.length > maxLength) return null;
  const nums = parts.map((s) => (s === "" ? NaN : Number(s)));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums;
}

export function formatFrequency(freqX, freqY, anisotropic) {
  return anisotropic ? `${fmt(freqX)}_${fmt(freqY)}` : fmt(freqX);
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
  const m = raw.trim().match(/^0_0_(\d+)_(\d+)$/);
  if (!m || m[1] !== m[2]) return null;
  const size = Number(m[1]);
  if (!Number.isInteger(size) || size <= 0) return null;
  return size;
}

export function formatViewBox(size) {
  return `0_0_${size}_${size}`;
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

/* ---------- literal matrix builders (mirror the SVG generator math) ----------
 * Each returns the underscore-separated URL form of a 20-number feColorMatrix
 * values attribute (SVG uses spaces; URLs use underscores). Computed components
 * go through fmt() exactly as the generator does, so render (A3) stays
 * byte-identical by converting underscores back to spaces. */

function rgb01(color) {
  const { r, g, b } = hexToRgb01(color);
  return [fmt(r), fmt(g), fmt(b)];
}

function cmAlphaValues(grainAlpha) {
  return [
    "1",
    "0",
    "0",
    "0",
    "0",
    "0",
    "1",
    "0",
    "0",
    "0",
    "0",
    "0",
    "1",
    "0",
    "0",
    "0",
    "0",
    "0",
    fmt(grainAlpha),
    "0",
  ].join("_");
}

function cmStainValues(color, slope, bias, spotted) {
  const [r, g, b] = rgb01(color);
  const s = fmt(slope), bi = fmt(bias);
  const alphaRow = spotted ? [s, s, s, "0", bi] : [s, "0", "0", "0", bi];
  return [
    "0",
    "0",
    "0",
    "0",
    r,
    "0",
    "0",
    "0",
    "0",
    g,
    "0",
    "0",
    "0",
    "0",
    b,
    ...alphaRow,
  ].join("_");
}

function cmHazeValues(color, grainAlpha) {
  const [r, g, b] = rgb01(color);
  return [
    "0",
    "0",
    "0",
    "0",
    r,
    "0",
    "0",
    "0",
    "0",
    g,
    "0",
    "0",
    "0",
    "0",
    b,
    "0",
    "0",
    "0",
    fmt(grainAlpha),
    "0",
  ].join("_");
}

function cmFiberValues(fiberAlpha) {
  return [
    "1",
    "0",
    "0",
    "0",
    "0",
    "0",
    "1",
    "0",
    "0",
    "0",
    "0",
    "0",
    "1",
    "0",
    "0",
    "0",
    "0",
    "0",
    fmt(fiberAlpha),
    "0",
  ].join("_");
}

function tableValues(levels) {
  return Array.from({ length: levels }, (_, i) => i % 2).join("_");
}

/* ---------- encode: slider state to URL params ----------
 * Emits only non-default keys (docs/10 section 4 table). Flag/selector keys
 * have no default: presence means on. Output follows TEX_KEY_ORDER so share
 * URLs are stable and diffable. Returns a URLSearchParams. */
export function encodeTextureState(st) {
  const found = new Map();
  // diff() records key=value only when it differs from the table default.
  const diff = (key, value) => {
    if (value !== TEX_DEFAULTS[key]) found.set(key, value);
  };

  // Stage 1: noise (always structurally present; only diffs are written).
  diff("tex.tb1.type", st.noise.type);
  diff(
    "tex.tb1.baseFrequency",
    formatFrequency(st.noise.freqX, st.noise.freqY, st.noise.anisotropic),
  );
  diff("tex.tb1.numOctaves", String(st.noise.octaves));
  diff("tex.tb1.seed", String(st.noise.seed));

  // Stage 2: weave (presence of tex.w is the flag).
  if (st.weave.enabled) found.set("tex.w", st.weave.blend);

  // Stages 3+7: pulp (presence of tex.p is the flag; payloads required).
  if (st.pulp.enabled) {
    found.set("tex.p", "1");
    diff("tex.tb3.baseFrequency", fmt(st.pulp.fiberFreq));
    diff("tex.tb3.numOctaves", String(st.pulp.fiberOctaves));
    diff("tex.gb1.stdDeviation", fmt(st.pulp.blur));
    found.set("tex.cm2.values", cmFiberValues(st.pulp.fiberAlpha));
    // NOTE: bl2.mode is hardcoded to "multiply" by the generator, so
    // tex.bl2.mode is never written (it always equals its default).
  }

  // Stage 4: distortion (presence of tex.d is the flag).
  if (st.distort.enabled) {
    found.set("tex.d", "1");
    diff("tex.tb4.baseFrequency", fmt(st.distort.freq));
    diff("tex.tb4.numOctaves", String(st.distort.octaves));
    diff("tex.dm1.scale", fmt(st.distort.scale));
  }

  // Stage 5: lighting (presence of tex.light is the flag + element choice).
  if (st.light.mode === "diffuse" || st.light.mode === "specular") {
    const el = st.light.mode === "diffuse" ? "dl1" : "sl1";
    found.set("tex.light", st.light.mode);
    diff(`tex.${el}.surfaceScale`, fmt(st.light.surfaceScale));
    if (st.light.mode === "specular") {
      diff(`tex.${el}.specularExponent`, String(st.light.specExp));
    }
    diff(`tex.${el}.azimuth`, String(st.light.azimuth));
    diff(`tex.${el}.elevation`, String(st.light.elevation));
    diff(`tex.${el}.lighting-color`, stripHash(st.light.color));
  }

  // Stage 6: tinting (presence of tex.tint is the flag + element choice).
  if (st.tint.mode === "table") {
    found.set("tex.tint", "table");
    found.set("tex.ct1.tableValues", tableValues(st.tint.levels));
  } else if (st.tint.mode !== "none") {
    found.set("tex.tint", "matrix");
    const t = st.tint;
    if (t.mode === "alpha") {
      found.set("tex.cm1.values", cmAlphaValues(t.grainAlpha));
    } else if (t.mode === "stainMottle") {
      found.set(
        "tex.cm1.values",
        cmStainValues(t.color, t.alphaSlope, t.alphaBias, false),
      );
    } else if (t.mode === "stainSpots") {
      found.set(
        "tex.cm1.values",
        cmStainValues(t.color, t.alphaSlope, t.alphaBias, true),
      );
    } else if (t.mode === "stainHaze") {
      found.set("tex.cm1.values", cmHazeValues(t.color, t.grainAlpha));
    }
  }

  // Stage 8 + backing + canvas: only diffs are written.
  diff("tex.bl3.mode", st.composite.blend);
  diff("tex.rc1.fill", stripHash(st.base.fillColor));
  diff("tex.rc2.fill", stripHash(st.base.highlightColor));
  diff("tex.rc2.opacity", fmt(st.composite.finalOpacity));
  diff("tex.sv1.viewBox", formatViewBox(st.canvas.size));

  const params = new URLSearchParams();
  for (const key of TEX_KEY_ORDER) {
    if (found.has(key)) params.set(key, found.get(key));
  }
  return params;
}

/* ---------- decode-render: URL params to SVG (exact) ----------
 * Pours literal values into the fixed 8-slot template in slot order,
 * branching only on flag/selector presence (docs/10 section 6). Never needs
 * slider semantics. Lenient: unknown keys ignored, malformed values fall
 * back to TEX_DEFAULTS (payloads without a default fall back to zeros, which
 * render the stage inert but keep the page alive). */
function rawList(params, key) {
  // Underscore-separated literal to space-separated SVG form.
  const raw = params.get(key);
  if (typeof raw !== "string") return null;
  const parts = raw.split("_");
  if (parts.length === 0) return null;
  if (parts.some((s) => s === "" || !Number.isFinite(Number(s)))) return null;
  return parts.join(" ");
}

function singleNumber(params, key, fallbackKey) {
  const list = rawList(params, key);
  if (list !== null && !list.includes(" ")) return list;
  return TEX_DEFAULTS[fallbackKey];
}

function matrixOrZeros(params, key) {
  // The generator separates the four 5-number rows with double spaces; the
  // URL carries flat underscore lists, so regroup here to stay byte-identical.
  const list = rawList(params, key);
  const nums = list !== null && list.split(" ").length === 20
    ? list.split(" ")
    : new Array(20).fill("0");
  return [0, 1, 2, 3].map((r) => nums.slice(r * 5, r * 5 + 5).join(" ")).join(
    "  ",
  );
}

function tableOrDefault(params, key) {
  const list = rawList(params, key);
  if (list !== null) return list;
  return "0 1";
}

function colorOrDefault(params, key, fallbackKey) {
  const hex = params.has(key) ? stripHash(params.get(key)) : null;
  return `#${hex ?? TEX_DEFAULTS[fallbackKey]}`;
}

function intOrDefault(params, key, fallbackKey) {
  const n = params.has(key) ? parseInteger(params.get(key)) : null;
  return n ?? TEX_DEFAULTS[fallbackKey];
}

export function decodeTextureToSvg(params) {
  const lines = [];
  const L = (ind, s) => lines.push("  ".repeat(ind) + s);
  const size = params.has("tex.sv1.viewBox")
    ? (parseViewBox(params.get("tex.sv1.viewBox")) ?? 300)
    : (parseViewBox(TEX_DEFAULTS["tex.sv1.viewBox"]) ?? 300);

  L(
    0,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">`,
  );
  L(1, `<defs>`);
  L(2, `<filter id="fp-filter" x="-20%" y="-20%" width="140%" height="140%">`);

  let cur = "noise1";
  // Stage 1: required.
  const type1 = parseVocab(params.get("tex.tb1.type"), NOISE_TYPES) ??
    TEX_DEFAULTS["tex.tb1.type"];
  const freqParts = (rawList(params, "tex.tb1.baseFrequency") ??
    TEX_DEFAULTS["tex.tb1.baseFrequency"]).split(" ");
  const freqA = freqParts.length <= 2
    ? freqParts.join(" ")
    : TEX_DEFAULTS["tex.tb1.baseFrequency"];
  const oct1 = intOrDefault(params, "tex.tb1.numOctaves", "tex.tb1.numOctaves");
  const seed1 = intOrDefault(params, "tex.tb1.seed", "tex.tb1.seed");
  L(
    3,
    `<feTurbulence type="${type1}" baseFrequency="${freqA}" numOctaves="${oct1}" seed="${seed1}" result="noise1"/>`,
  );

  // Stage 2: weave (tex.w presence is the flag; tb2 derives from tb1).
  const weaveBlend = params.has("tex.w")
    ? parseVocab(params.get("tex.w"), WEAVE_BLENDS)
    : null;
  if (weaveBlend !== null) {
    const freqB = freqParts.length === 2
      ? `${freqParts[1]} ${freqParts[0]}`
      : freqA;
    L(
      3,
      `<feTurbulence type="${type1}" baseFrequency="${freqB}" numOctaves="${oct1}" seed="${
        Number(seed1) + 1
      }" result="noise2"/>`,
    );
    L(
      3,
      `<feBlend in="noise1" in2="noise2" mode="${weaveBlend}" result="noiseWeave"/>`,
    );
    cur = "noiseWeave";
  }

  // Stages 3+7: pulp (tex.p presence is the flag).
  if (params.has("tex.p")) {
    L(
      3,
      `<feTurbulence type="fractalNoise" baseFrequency="${
        singleNumber(params, "tex.tb3.baseFrequency", "tex.tb3.baseFrequency")
      }" numOctaves="${
        intOrDefault(params, "tex.tb3.numOctaves", "tex.tb3.numOctaves")
      }" seed="${Number(seed1) + 2}" result="fiberRaw"/>`,
    );
    L(
      3,
      `<feGaussianBlur in="fiberRaw" stdDeviation="${
        singleNumber(params, "tex.gb1.stdDeviation", "tex.gb1.stdDeviation")
      }" result="fiberSoft"/>`,
    );
  }

  // Stage 4: distortion (tex.d presence is the flag).
  if (params.has("tex.d")) {
    L(
      3,
      `<feTurbulence type="turbulence" baseFrequency="${
        singleNumber(params, "tex.tb4.baseFrequency", "tex.tb4.baseFrequency")
      }" numOctaves="${
        intOrDefault(params, "tex.tb4.numOctaves", "tex.tb4.numOctaves")
      }" seed="${Number(seed1) + 3}" result="dispMap"/>`,
    );
    L(
      3,
      `<feDisplacementMap in="${cur}" in2="dispMap" scale="${
        singleNumber(params, "tex.dm1.scale", "tex.dm1.scale")
      }" xChannelSelector="R" yChannelSelector="G" result="noiseWarp"/>`,
    );
    cur = "noiseWarp";
  }

  // Stage 5: lighting (tex.light presence is the flag + element choice).
  const lightSel = params.has("tex.light")
    ? parseVocab(params.get("tex.light"), LIGHT_SELECTORS)
    : null;
  if (lightSel === "diffuse" || lightSel === "specular") {
    const el = lightSel === "diffuse" ? "dl1" : "sl1";
    const tag = lightSel === "diffuse"
      ? "feDiffuseLighting"
      : "feSpecularLighting";
    const color = colorOrDefault(
      params,
      `tex.${el}.lighting-color`,
      `tex.${el}.lighting-color`,
    );
    const surf = singleNumber(
      params,
      `tex.${el}.surfaceScale`,
      `tex.${el}.surfaceScale`,
    );
    const az = intOrDefault(params, `tex.${el}.azimuth`, `tex.${el}.azimuth`);
    const el2 = intOrDefault(
      params,
      `tex.${el}.elevation`,
      `tex.${el}.elevation`,
    );
    const open = lightSel === "diffuse"
      ? `<${tag} in="${cur}" lighting-color="${color}" diffuseConstant="1" surfaceScale="${surf}" result="lit">`
      : `<${tag} in="${cur}" lighting-color="${color}" specularConstant="1" specularExponent="${
        singleNumber(
          params,
          `tex.${el}.specularExponent`,
          `tex.${el}.specularExponent`,
        )
      }" surfaceScale="${surf}" result="lit">`;
    L(3, open);
    L(4, `<feDistantLight azimuth="${az}" elevation="${el2}"/>`);
    L(3, `</${tag}>`);
    cur = "lit";
  }

  // Stage 6: tinting (tex.tint presence is the flag + element choice).
  const tintSel = params.has("tex.tint")
    ? parseVocab(params.get("tex.tint"), TINT_SELECTORS)
    : null;
  if (tintSel === "matrix") {
    L(
      3,
      `<feColorMatrix in="${cur}" type="matrix" values="${
        matrixOrZeros(params, "tex.cm1.values")
      }" result="colored"/>`,
    );
    cur = "colored";
  } else if (tintSel === "table") {
    L(3, `<feComponentTransfer in="${cur}" result="colored">`);
    const table = tableOrDefault(params, "tex.ct1.tableValues");
    L(4, `<feFuncR type="table" tableValues="${table}"/>`);
    L(4, `<feFuncG type="table" tableValues="${table}"/>`);
    L(4, `<feFuncB type="table" tableValues="${table}"/>`);
    L(3, `</feComponentTransfer>`);
    cur = "colored";
  }

  // Stage 7 (part 2): tied to tex.p. bl2.mode is hardcoded to multiply by the
  // generator, so a foreign tex.bl2.mode is intentionally ignored here.
  if (params.has("tex.p")) {
    L(
      3,
      `<feColorMatrix in="fiberSoft" type="matrix" values="${
        matrixOrZeros(params, "tex.cm2.values")
      }" result="fiberMask"/>`,
    );
    L(
      3,
      `<feBlend in="${cur}" in2="fiberMask" mode="multiply" result="coloredFiber"/>`,
    );
    cur = "coloredFiber";
  }

  // Stage 8 + backing + canvas.
  const blend3 = parseVocab(params.get("tex.bl3.mode"), COMPOSITE_BLENDS) ??
    TEX_DEFAULTS["tex.bl3.mode"];
  L(3, `<feBlend in="SourceGraphic" in2="${cur}" mode="${blend3}"/>`);
  L(2, `</filter>`);
  L(1, `</defs>`);
  L(
    1,
    `<rect width="100%" height="100%" fill="${
      colorOrDefault(params, "tex.rc1.fill", "tex.rc1.fill")
    }"/>`,
  );
  const opacity = singleNumber(params, "tex.rc2.opacity", "tex.rc2.opacity");
  L(
    1,
    `<rect width="100%" height="100%" fill="${
      colorOrDefault(params, "tex.rc2.fill", "tex.rc2.fill")
    }" filter="url(#fp-filter)" opacity="${opacity}"/>`,
  );
  L(0, `</svg>`);
  return lines.join("\n");
}

/* ---------- decode-restore: URL params to slider state (best-effort) ----------
 * Starts from DEFAULTS and applies what the params carry (docs/10 section 6).
 * Malformed values leave the corresponding slider at its default. tint.mode
 * is inferred from the cm1.values matrix shape because the URL only stores
 * the "matrix" family, never the slider family name. Values outside slider
 * ranges pass through untouched (sliders display-clamp them); no range table
 * is duplicated here. */
function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function float01ToHexByte(f) {
  return Math.round(Math.min(1, Math.max(0, f)) * 255).toString(16).padStart(
    2,
    "0",
  );
}

function matrix20(params, key) {
  if (!params.has(key)) return null;
  const nums = parseNumberList(params.get(key), {
    minLength: 20,
    maxLength: 20,
  });
  return nums;
}

function inferTintMode(nums) {
  // Returns { mode, color, alphaSlope, alphaBias, grainAlpha } with only the
  // relevant fields set, or null when the shape is unrecognized.
  if (nums === null) return null;
  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0]
    .every((v, i) => approx(nums[i], v));
  const alpha = nums.slice(15, 20);
  const rgbConstant = [0, 1, 2].every((row) =>
    nums.slice(row * 5, row * 5 + 4).every((v) => approx(v, 0))
  );
  const color = `#${float01ToHexByte(nums[4])}${float01ToHexByte(nums[9])}${
    float01ToHexByte(nums[14])
  }`;
  if (
    identity && approx(alpha[0], 0) && approx(alpha[1], 0) &&
    approx(alpha[2], 0)
  ) {
    return { mode: "alpha", grainAlpha: alpha[3] };
  }
  if (!rgbConstant) return null;
  const [s0, s1, s2, s3, bi] = alpha;
  if (approx(s1, 0) && approx(s2, 0) && approx(s3, 0)) {
    return { mode: "stainMottle", color, alphaSlope: s0, alphaBias: bi };
  }
  if (approx(s0, s1) && approx(s1, s2) && approx(s3, 0)) {
    return { mode: "stainSpots", color, alphaSlope: s0, alphaBias: bi };
  }
  if (approx(s0, 0) && approx(s1, 0) && approx(s2, 0)) {
    return { mode: "stainHaze", color, grainAlpha: s3 };
  }
  return null;
}

function singleFloat(params, key) {
  if (!params.has(key)) return null;
  const nums = parseNumberList(params.get(key), { minLength: 1, maxLength: 1 });
  return nums === null ? null : nums[0];
}

export function decodeTextureToState(params) {
  const st = deepClone(DEFAULTS);
  // Absent flag/selector keys mean "stage off" (docs/10 section 4), which for
  // light differs from the app default: start that stage off.
  st.light.mode = "none";

  // Stage 1: noise.
  const type = params.has("tex.tb1.type")
    ? parseVocab(params.get("tex.tb1.type"), NOISE_TYPES)
    : null;
  if (type !== null) st.noise.type = type;
  if (params.has("tex.tb1.baseFrequency")) {
    const nums = parseNumberList(params.get("tex.tb1.baseFrequency"), {
      minLength: 1,
      maxLength: 2,
    });
    if (nums !== null) {
      st.noise.freqX = nums[0];
      if (nums.length === 2) {
        st.noise.freqY = nums[1];
        st.noise.anisotropic = true;
      } else {
        st.noise.freqY = nums[0];
        st.noise.anisotropic = false;
      }
    }
  }
  const oct1 = params.has("tex.tb1.numOctaves")
    ? parseInteger(params.get("tex.tb1.numOctaves"))
    : null;
  if (oct1 !== null) st.noise.octaves = oct1;
  const seed1 = params.has("tex.tb1.seed")
    ? parseInteger(params.get("tex.tb1.seed"))
    : null;
  if (seed1 !== null) st.noise.seed = seed1;

  // Stage 2: weave.
  const weaveBlend = params.has("tex.w")
    ? parseVocab(params.get("tex.w"), WEAVE_BLENDS)
    : null;
  if (weaveBlend !== null) {
    st.weave.enabled = true;
    st.weave.blend = weaveBlend;
  }

  // Stages 3+7: pulp.
  if (params.has("tex.p")) {
    st.pulp.enabled = true;
    const ff = singleFloat(params, "tex.tb3.baseFrequency");
    if (ff !== null) st.pulp.fiberFreq = ff;
    const fo = params.has("tex.tb3.numOctaves")
      ? parseInteger(params.get("tex.tb3.numOctaves"))
      : null;
    if (fo !== null) st.pulp.fiberOctaves = fo;
    const blur = singleFloat(params, "tex.gb1.stdDeviation");
    if (blur !== null) st.pulp.blur = blur;
    const cm2 = matrix20(params, "tex.cm2.values");
    if (cm2 !== null) st.pulp.fiberAlpha = cm2[18];
    // NOTE: tex.bl2.mode has no slider (generator hardcodes multiply).
  }

  // Stage 4: distortion.
  if (params.has("tex.d")) {
    st.distort.enabled = true;
    const freq = singleFloat(params, "tex.tb4.baseFrequency");
    if (freq !== null) st.distort.freq = freq;
    const oct = params.has("tex.tb4.numOctaves")
      ? parseInteger(params.get("tex.tb4.numOctaves"))
      : null;
    if (oct !== null) st.distort.octaves = oct;
    const scale = singleFloat(params, "tex.dm1.scale");
    if (scale !== null) st.distort.scale = scale;
  }

  // Stage 5: lighting.
  const lightSel = params.has("tex.light")
    ? parseVocab(params.get("tex.light"), LIGHT_SELECTORS)
    : null;
  if (lightSel !== null) {
    const el = lightSel === "diffuse" ? "dl1" : "sl1";
    st.light.mode = lightSel;
    const surf = singleFloat(params, `tex.${el}.surfaceScale`);
    if (surf !== null) st.light.surfaceScale = surf;
    if (lightSel === "specular") {
      const exp = singleFloat(params, `tex.${el}.specularExponent`);
      if (exp !== null) st.light.specExp = exp;
    }
    const az = singleFloat(params, `tex.${el}.azimuth`);
    if (az !== null) st.light.azimuth = az;
    const elev = singleFloat(params, `tex.${el}.elevation`);
    if (elev !== null) st.light.elevation = elev;
    const hex = params.has(`tex.${el}.lighting-color`)
      ? stripHash(params.get(`tex.${el}.lighting-color`))
      : null;
    if (hex !== null) st.light.color = addHash(hex);
  }

  // Stage 6: tinting.
  const tintSel = params.has("tex.tint")
    ? parseVocab(params.get("tex.tint"), TINT_SELECTORS)
    : null;
  if (tintSel === "table") {
    st.tint.mode = "table";
    if (params.has("tex.ct1.tableValues")) {
      const nums = parseNumberList(params.get("tex.ct1.tableValues"), {
        minLength: 1,
        maxLength: 64,
      });
      if (nums !== null && nums.length >= 2) st.tint.levels = nums.length;
    }
  } else if (tintSel === "matrix") {
    const inferred = inferTintMode(matrix20(params, "tex.cm1.values"));
    if (inferred === null) {
      st.tint.mode = "stainMottle"; // stage is on; sliders stay default.
    } else {
      st.tint.mode = inferred.mode;
      if (inferred.color !== undefined) st.tint.color = inferred.color;
      if (inferred.alphaSlope !== undefined) {
        st.tint.alphaSlope = inferred.alphaSlope;
      }
      if (inferred.alphaBias !== undefined) {
        st.tint.alphaBias = inferred.alphaBias;
      }
      if (inferred.grainAlpha !== undefined) {
        st.tint.grainAlpha = inferred.grainAlpha;
      }
    }
  }

  // Stage 8 + backing + canvas.
  const blend3 = params.has("tex.bl3.mode")
    ? parseVocab(params.get("tex.bl3.mode"), COMPOSITE_BLENDS)
    : null;
  if (blend3 !== null) st.composite.blend = blend3;
  const rc1 = params.has("tex.rc1.fill")
    ? stripHash(params.get("tex.rc1.fill"))
    : null;
  if (rc1 !== null) st.base.fillColor = addHash(rc1);
  const rc2 = params.has("tex.rc2.fill")
    ? stripHash(params.get("tex.rc2.fill"))
    : null;
  if (rc2 !== null) st.base.highlightColor = addHash(rc2);
  const opacity = singleFloat(params, "tex.rc2.opacity");
  if (opacity !== null) st.composite.finalOpacity = opacity;
  if (params.has("tex.sv1.viewBox")) {
    const size = parseViewBox(params.get("tex.sv1.viewBox"));
    if (size !== null) st.canvas.size = size;
  }

  return st;
}
