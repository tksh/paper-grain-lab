// src/js/texture-core.js
function fmt(n) {
  n = Number(n);
  if (Number.isNaN(n)) return "0";
  return parseFloat(n.toFixed(4)).toString();
}
function noiseBaseFrequency(st) {
  return st.noise.anisotropic ? `${fmt(st.noise.freqX)} ${fmt(st.noise.freqY)}` : fmt(st.noise.freqX);
}
function hexToRgb01(hex) {
  hex = (hex || "#000000").replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const num = parseInt(hex, 16) || 0;
  return {
    r: (num >> 16 & 255) / 255,
    g: (num >> 8 & 255) / 255,
    b: (num & 255) / 255
  };
}
function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}
var DEFAULTS = {
  noise: {
    type: "fractalNoise",
    freqX: 0.05,
    freqY: 0.05,
    anisotropic: false,
    octaves: 3,
    seed: 2
  },
  weave: {
    enabled: false,
    blend: "multiply"
  },
  pulp: {
    enabled: false,
    fiberFreq: 0.08,
    fiberOctaves: 2,
    blur: 1.5,
    fiberAlpha: 0.35
  },
  distort: {
    enabled: false,
    freq: 0.01,
    octaves: 2,
    scale: 20
  },
  light: {
    mode: "diffuse",
    surfaceScale: 2,
    azimuth: 60,
    elevation: 55,
    specExp: 12,
    color: "#ffffff"
  },
  tint: {
    mode: "none",
    color: "#3a2a18",
    alphaSlope: 1,
    alphaBias: -1.5,
    levels: 5,
    grainAlpha: 0.2
  },
  composite: {
    blend: "multiply",
    finalOpacity: 0.9
  },
  base: {
    fillColor: "#f6f3eb",
    highlightColor: "#faf8f4"
  },
  canvas: {
    size: 300
  }
};
function generateSVG(st) {
  const lines = [];
  const L = (ind, s) => lines.push("  ".repeat(ind) + s);
  const size = st.canvas.size;
  L(0, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">`);
  L(1, `<defs>`);
  L(2, `<filter id="fp-filter" x="-20%" y="-20%" width="140%" height="140%">`);
  let cur = "noise1";
  const freqA = noiseBaseFrequency(st);
  L(3, `<feTurbulence type="${st.noise.type}" baseFrequency="${freqA}" numOctaves="${st.noise.octaves}" seed="${st.noise.seed}" result="noise1"/>`);
  if (st.weave.enabled) {
    const freqB = st.noise.anisotropic ? `${fmt(st.noise.freqY)} ${fmt(st.noise.freqX)}` : fmt(st.noise.freqX);
    L(3, `<feTurbulence type="${st.noise.type}" baseFrequency="${freqB}" numOctaves="${st.noise.octaves}" seed="${st.noise.seed + 1}" result="noise2"/>`);
    L(3, `<feBlend in="noise1" in2="noise2" mode="${st.weave.blend}" result="noiseWeave"/>`);
    cur = "noiseWeave";
  }
  if (st.pulp.enabled) {
    L(3, `<feTurbulence type="fractalNoise" baseFrequency="${fmt(st.pulp.fiberFreq)}" numOctaves="${st.pulp.fiberOctaves}" seed="${st.noise.seed + 2}" result="fiberRaw"/>`);
    L(3, `<feGaussianBlur in="fiberRaw" stdDeviation="${fmt(st.pulp.blur)}" result="fiberSoft"/>`);
  }
  if (st.distort.enabled) {
    L(3, `<feTurbulence type="turbulence" baseFrequency="${fmt(st.distort.freq)}" numOctaves="${st.distort.octaves}" seed="${st.noise.seed + 3}" result="dispMap"/>`);
    L(3, `<feDisplacementMap in="${cur}" in2="dispMap" scale="${st.distort.scale}" xChannelSelector="R" yChannelSelector="G" result="noiseWarp"/>`);
    cur = "noiseWarp";
  }
  if (st.light.mode === "diffuse") {
    L(3, `<feDiffuseLighting in="${cur}" lighting-color="${st.light.color}" diffuseConstant="1" surfaceScale="${fmt(st.light.surfaceScale)}" result="lit">`);
    L(4, `<feDistantLight azimuth="${st.light.azimuth}" elevation="${st.light.elevation}"/>`);
    L(3, `</feDiffuseLighting>`);
    cur = "lit";
  } else if (st.light.mode === "specular") {
    L(3, `<feSpecularLighting in="${cur}" lighting-color="${st.light.color}" specularConstant="1" specularExponent="${st.light.specExp}" surfaceScale="${fmt(st.light.surfaceScale)}" result="lit">`);
    L(4, `<feDistantLight azimuth="${st.light.azimuth}" elevation="${st.light.elevation}"/>`);
    L(3, `</feSpecularLighting>`);
    cur = "lit";
  }
  if (st.tint.mode === "alpha") {
    L(3, `<feColorMatrix in="${cur}" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${fmt(st.tint.grainAlpha)} 0" result="colored"/>`);
    cur = "colored";
  } else if (st.tint.mode === "stainMottle") {
    const { r, g, b } = hexToRgb01(st.tint.color);
    const s = fmt(st.tint.alphaSlope), bi = fmt(st.tint.alphaBias);
    L(3, `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${fmt(r)}  0 0 0 0 ${fmt(g)}  0 0 0 0 ${fmt(b)}  ${s} 0 0 0 ${bi}" result="colored"/>`);
    cur = "colored";
  } else if (st.tint.mode === "stainSpots") {
    const { r, g, b } = hexToRgb01(st.tint.color);
    const s = fmt(st.tint.alphaSlope), bi = fmt(st.tint.alphaBias);
    L(3, `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${fmt(r)}  0 0 0 0 ${fmt(g)}  0 0 0 0 ${fmt(b)}  ${s} ${s} ${s} 0 ${bi}" result="colored"/>`);
    cur = "colored";
  } else if (st.tint.mode === "stainHaze") {
    const { r, g, b } = hexToRgb01(st.tint.color);
    L(3, `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${fmt(r)}  0 0 0 0 ${fmt(g)}  0 0 0 0 ${fmt(b)}  0 0 0 ${fmt(st.tint.grainAlpha)} 0" result="colored"/>`);
    cur = "colored";
  } else if (st.tint.mode === "table") {
    const table = Array.from({
      length: st.tint.levels
    }, (_, i) => i % 2).join(" ");
    L(3, `<feComponentTransfer in="${cur}" result="colored">`);
    L(4, `<feFuncR type="table" tableValues="${table}"/>`);
    L(4, `<feFuncG type="table" tableValues="${table}"/>`);
    L(4, `<feFuncB type="table" tableValues="${table}"/>`);
    L(3, `</feComponentTransfer>`);
    cur = "colored";
  }
  if (st.pulp.enabled) {
    const a = fmt(st.pulp.fiberAlpha);
    L(3, `<feColorMatrix in="fiberSoft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${a} 0" result="fiberMask"/>`);
    L(3, `<feBlend in="${cur}" in2="fiberMask" mode="multiply" result="coloredFiber"/>`);
    cur = "coloredFiber";
  }
  L(3, `<feBlend in="SourceGraphic" in2="${cur}" mode="${st.composite.blend}"/>`);
  L(2, `</filter>`);
  L(1, `</defs>`);
  L(1, `<rect width="100%" height="100%" fill="${st.base.fillColor}"/>`);
  L(1, `<rect width="100%" height="100%" fill="${st.base.highlightColor}" filter="url(#fp-filter)" opacity="${fmt(st.composite.finalOpacity)}"/>`);
  L(0, `</svg>`);
  return lines.join("\n");
}

// src/js/tex-codec.js
var TEX_DEFAULTS = {
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
  "tex.sv1.viewBox": "0,0,300,300"
};
var NOISE_TYPES = [
  "fractalNoise",
  "turbulence"
];
var WEAVE_BLENDS = [
  "multiply",
  "overlay",
  "screen",
  "darken"
];
var COMPOSITE_BLENDS = [
  "multiply",
  "screen",
  "overlay",
  "normal",
  "darken",
  "soft-light"
];
var LIGHT_SELECTORS = [
  "diffuse",
  "specular"
];
var TINT_SELECTORS = [
  "matrix",
  "table"
];
function parseNumberList(raw, { minLength = 1, maxLength = 64 } = {}) {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length < minLength || parts.length > maxLength) return null;
  const nums = parts.map((s) => s === "" ? NaN : Number(s));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums;
}
function stripHash(color) {
  if (typeof color !== "string") return null;
  let hex = color.startsWith("#") ? color.slice(1) : color;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return hex.toLowerCase();
}
function addHash(hexNoHash) {
  return `#${hexNoHash}`;
}
function parseViewBox(raw) {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^0,0,(\d+),(\d+)$/);
  if (!m || m[1] !== m[2]) return null;
  const size = Number(m[1]);
  if (!Number.isInteger(size) || size <= 0) return null;
  return size;
}
function parseInteger(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  return n;
}
function parseVocab(raw, list) {
  return typeof raw === "string" && list.includes(raw) ? raw : null;
}
function rawList(params, key) {
  const raw = params.get(key);
  if (typeof raw !== "string") return null;
  const parts = raw.split(/[\s,]+/).filter((s) => s !== "");
  if (parts.length === 0) return null;
  if (parts.some((s) => !Number.isFinite(Number(s)))) return null;
  return parts.join(" ");
}
function singleNumber(params, key, fallbackKey) {
  const list = rawList(params, key);
  if (list !== null && !list.includes(" ")) return list;
  return TEX_DEFAULTS[fallbackKey];
}
function matrixOrZeros(params, key) {
  const list = rawList(params, key);
  const nums = list !== null && list.split(" ").length === 20 ? list.split(" ") : new Array(20).fill("0");
  return [
    0,
    1,
    2,
    3
  ].map((r) => nums.slice(r * 5, r * 5 + 5).join(" ")).join("  ");
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
function decodeTextureToSvg(params) {
  const lines = [];
  const L = (ind, s) => lines.push("  ".repeat(ind) + s);
  const size = params.has("tex.sv1.viewBox") ? parseViewBox(params.get("tex.sv1.viewBox")) ?? 300 : Number(TEX_DEFAULTS["tex.sv1.viewBox"].split(",")[2]);
  L(0, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">`);
  L(1, `<defs>`);
  L(2, `<filter id="fp-filter" x="-20%" y="-20%" width="140%" height="140%">`);
  let cur = "noise1";
  const type1 = parseVocab(params.get("tex.tb1.type"), NOISE_TYPES) ?? TEX_DEFAULTS["tex.tb1.type"];
  const freqParts = (rawList(params, "tex.tb1.baseFrequency") ?? TEX_DEFAULTS["tex.tb1.baseFrequency"]).split(" ");
  const freqA = freqParts.length <= 2 ? freqParts.join(" ") : TEX_DEFAULTS["tex.tb1.baseFrequency"];
  const oct1 = intOrDefault(params, "tex.tb1.numOctaves", "tex.tb1.numOctaves");
  const seed1 = intOrDefault(params, "tex.tb1.seed", "tex.tb1.seed");
  L(3, `<feTurbulence type="${type1}" baseFrequency="${freqA}" numOctaves="${oct1}" seed="${seed1}" result="noise1"/>`);
  const weaveBlend = params.has("tex.w") ? parseVocab(params.get("tex.w"), WEAVE_BLENDS) : null;
  if (weaveBlend !== null) {
    const freqB = freqParts.length === 2 ? `${freqParts[1]} ${freqParts[0]}` : freqA;
    L(3, `<feTurbulence type="${type1}" baseFrequency="${freqB}" numOctaves="${oct1}" seed="${Number(seed1) + 1}" result="noise2"/>`);
    L(3, `<feBlend in="noise1" in2="noise2" mode="${weaveBlend}" result="noiseWeave"/>`);
    cur = "noiseWeave";
  }
  if (params.has("tex.p")) {
    L(3, `<feTurbulence type="fractalNoise" baseFrequency="${singleNumber(params, "tex.tb3.baseFrequency", "tex.tb3.baseFrequency")}" numOctaves="${intOrDefault(params, "tex.tb3.numOctaves", "tex.tb3.numOctaves")}" seed="${Number(seed1) + 2}" result="fiberRaw"/>`);
    L(3, `<feGaussianBlur in="fiberRaw" stdDeviation="${singleNumber(params, "tex.gb1.stdDeviation", "tex.gb1.stdDeviation")}" result="fiberSoft"/>`);
  }
  if (params.has("tex.d")) {
    L(3, `<feTurbulence type="turbulence" baseFrequency="${singleNumber(params, "tex.tb4.baseFrequency", "tex.tb4.baseFrequency")}" numOctaves="${intOrDefault(params, "tex.tb4.numOctaves", "tex.tb4.numOctaves")}" seed="${Number(seed1) + 3}" result="dispMap"/>`);
    L(3, `<feDisplacementMap in="${cur}" in2="dispMap" scale="${singleNumber(params, "tex.dm1.scale", "tex.dm1.scale")}" xChannelSelector="R" yChannelSelector="G" result="noiseWarp"/>`);
    cur = "noiseWarp";
  }
  const lightSel = params.has("tex.light") ? parseVocab(params.get("tex.light"), LIGHT_SELECTORS) : null;
  if (lightSel === "diffuse" || lightSel === "specular") {
    const el = lightSel === "diffuse" ? "dl1" : "sl1";
    const tag = lightSel === "diffuse" ? "feDiffuseLighting" : "feSpecularLighting";
    const color = colorOrDefault(params, `tex.${el}.lighting-color`, `tex.${el}.lighting-color`);
    const surf = singleNumber(params, `tex.${el}.surfaceScale`, `tex.${el}.surfaceScale`);
    const az = intOrDefault(params, `tex.${el}.azimuth`, `tex.${el}.azimuth`);
    const el2 = intOrDefault(params, `tex.${el}.elevation`, `tex.${el}.elevation`);
    const open = lightSel === "diffuse" ? `<${tag} in="${cur}" lighting-color="${color}" diffuseConstant="1" surfaceScale="${surf}" result="lit">` : `<${tag} in="${cur}" lighting-color="${color}" specularConstant="1" specularExponent="${singleNumber(params, `tex.${el}.specularExponent`, `tex.${el}.specularExponent`)}" surfaceScale="${surf}" result="lit">`;
    L(3, open);
    L(4, `<feDistantLight azimuth="${az}" elevation="${el2}"/>`);
    L(3, `</${tag}>`);
    cur = "lit";
  }
  const tintSel = params.has("tex.tint") ? parseVocab(params.get("tex.tint"), TINT_SELECTORS) : null;
  if (tintSel === "matrix") {
    L(3, `<feColorMatrix in="${cur}" type="matrix" values="${matrixOrZeros(params, "tex.cm1.values")}" result="colored"/>`);
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
  if (params.has("tex.p")) {
    L(3, `<feColorMatrix in="fiberSoft" type="matrix" values="${matrixOrZeros(params, "tex.cm2.values")}" result="fiberMask"/>`);
    L(3, `<feBlend in="${cur}" in2="fiberMask" mode="multiply" result="coloredFiber"/>`);
    cur = "coloredFiber";
  }
  const blend3 = parseVocab(params.get("tex.bl3.mode"), COMPOSITE_BLENDS) ?? TEX_DEFAULTS["tex.bl3.mode"];
  L(3, `<feBlend in="SourceGraphic" in2="${cur}" mode="${blend3}"/>`);
  L(2, `</filter>`);
  L(1, `</defs>`);
  L(1, `<rect width="100%" height="100%" fill="${colorOrDefault(params, "tex.rc1.fill", "tex.rc1.fill")}"/>`);
  const opacity = singleNumber(params, "tex.rc2.opacity", "tex.rc2.opacity");
  L(1, `<rect width="100%" height="100%" fill="${colorOrDefault(params, "tex.rc2.fill", "tex.rc2.fill")}" filter="url(#fp-filter)" opacity="${opacity}"/>`);
  L(0, `</svg>`);
  return lines.join("\n");
}
function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}
function float01ToHexByte(f) {
  return Math.round(Math.min(1, Math.max(0, f)) * 255).toString(16).padStart(2, "0");
}
function matrix20(params, key) {
  if (!params.has(key)) return null;
  const nums = parseNumberList(params.get(key), {
    minLength: 20,
    maxLength: 20
  });
  return nums;
}
function inferTintMode(nums) {
  if (nums === null) return null;
  const identity = [
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    0
  ].every((v, i) => approx(nums[i], v));
  const alpha = nums.slice(15, 20);
  const rgbConstant = [
    0,
    1,
    2
  ].every((row) => nums.slice(row * 5, row * 5 + 4).every((v) => approx(v, 0)));
  const color = `#${float01ToHexByte(nums[4])}${float01ToHexByte(nums[9])}${float01ToHexByte(nums[14])}`;
  if (identity && approx(alpha[0], 0) && approx(alpha[1], 0) && approx(alpha[2], 0)) {
    return {
      mode: "alpha",
      grainAlpha: alpha[3]
    };
  }
  if (!rgbConstant) return null;
  const [s0, s1, s2, s3, bi] = alpha;
  if (approx(s1, 0) && approx(s2, 0) && approx(s3, 0)) {
    return {
      mode: "stainMottle",
      color,
      alphaSlope: s0,
      alphaBias: bi
    };
  }
  if (approx(s0, s1) && approx(s1, s2) && approx(s3, 0)) {
    return {
      mode: "stainSpots",
      color,
      alphaSlope: s0,
      alphaBias: bi
    };
  }
  if (approx(s0, 0) && approx(s1, 0) && approx(s2, 0)) {
    return {
      mode: "stainHaze",
      color,
      grainAlpha: s3
    };
  }
  return null;
}
function singleFloat(params, key) {
  if (!params.has(key)) return null;
  const nums = parseNumberList(params.get(key), {
    minLength: 1,
    maxLength: 1
  });
  return nums === null ? null : nums[0];
}
function decodeTextureToState(params) {
  const st = deepClone(DEFAULTS);
  st.light.mode = "none";
  const type = params.has("tex.tb1.type") ? parseVocab(params.get("tex.tb1.type"), NOISE_TYPES) : null;
  if (type !== null) st.noise.type = type;
  if (params.has("tex.tb1.baseFrequency")) {
    const nums = parseNumberList(params.get("tex.tb1.baseFrequency"), {
      minLength: 1,
      maxLength: 2
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
  const oct1 = params.has("tex.tb1.numOctaves") ? parseInteger(params.get("tex.tb1.numOctaves")) : null;
  if (oct1 !== null) st.noise.octaves = oct1;
  const seed1 = params.has("tex.tb1.seed") ? parseInteger(params.get("tex.tb1.seed")) : null;
  if (seed1 !== null) st.noise.seed = seed1;
  const weaveBlend = params.has("tex.w") ? parseVocab(params.get("tex.w"), WEAVE_BLENDS) : null;
  if (weaveBlend !== null) {
    st.weave.enabled = true;
    st.weave.blend = weaveBlend;
  }
  if (params.has("tex.p")) {
    st.pulp.enabled = true;
    const ff = singleFloat(params, "tex.tb3.baseFrequency");
    if (ff !== null) st.pulp.fiberFreq = ff;
    const fo = params.has("tex.tb3.numOctaves") ? parseInteger(params.get("tex.tb3.numOctaves")) : null;
    if (fo !== null) st.pulp.fiberOctaves = fo;
    const blur = singleFloat(params, "tex.gb1.stdDeviation");
    if (blur !== null) st.pulp.blur = blur;
    const cm2 = matrix20(params, "tex.cm2.values");
    if (cm2 !== null) st.pulp.fiberAlpha = cm2[18];
  }
  if (params.has("tex.d")) {
    st.distort.enabled = true;
    const freq = singleFloat(params, "tex.tb4.baseFrequency");
    if (freq !== null) st.distort.freq = freq;
    const oct = params.has("tex.tb4.numOctaves") ? parseInteger(params.get("tex.tb4.numOctaves")) : null;
    if (oct !== null) st.distort.octaves = oct;
    const scale = singleFloat(params, "tex.dm1.scale");
    if (scale !== null) st.distort.scale = scale;
  }
  const lightSel = params.has("tex.light") ? parseVocab(params.get("tex.light"), LIGHT_SELECTORS) : null;
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
    const hex = params.has(`tex.${el}.lighting-color`) ? stripHash(params.get(`tex.${el}.lighting-color`)) : null;
    if (hex !== null) st.light.color = addHash(hex);
  }
  const tintSel = params.has("tex.tint") ? parseVocab(params.get("tex.tint"), TINT_SELECTORS) : null;
  if (tintSel === "table") {
    st.tint.mode = "table";
    if (params.has("tex.ct1.tableValues")) {
      const nums = parseNumberList(params.get("tex.ct1.tableValues"), {
        minLength: 1,
        maxLength: 64
      });
      if (nums !== null && nums.length >= 2) st.tint.levels = nums.length;
    }
  } else if (tintSel === "matrix") {
    const inferred = inferTintMode(matrix20(params, "tex.cm1.values"));
    if (inferred === null) {
      st.tint.mode = "stainMottle";
    } else {
      st.tint.mode = inferred.mode;
      if (inferred.color !== void 0) st.tint.color = inferred.color;
      if (inferred.alphaSlope !== void 0) {
        st.tint.alphaSlope = inferred.alphaSlope;
      }
      if (inferred.alphaBias !== void 0) {
        st.tint.alphaBias = inferred.alphaBias;
      }
      if (inferred.grainAlpha !== void 0) {
        st.tint.grainAlpha = inferred.grainAlpha;
      }
    }
  }
  const blend3 = params.has("tex.bl3.mode") ? parseVocab(params.get("tex.bl3.mode"), COMPOSITE_BLENDS) : null;
  if (blend3 !== null) st.composite.blend = blend3;
  const rc1 = params.has("tex.rc1.fill") ? stripHash(params.get("tex.rc1.fill")) : null;
  if (rc1 !== null) st.base.fillColor = addHash(rc1);
  const rc2 = params.has("tex.rc2.fill") ? stripHash(params.get("tex.rc2.fill")) : null;
  if (rc2 !== null) st.base.highlightColor = addHash(rc2);
  const opacity = singleFloat(params, "tex.rc2.opacity");
  if (opacity !== null) st.composite.finalOpacity = opacity;
  if (params.has("tex.sv1.viewBox")) {
    const size = parseViewBox(params.get("tex.sv1.viewBox"));
    if (size !== null) st.canvas.size = size;
  }
  return st;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/constants.ts
var BASIC_DATA_KEYS = [
  "bits",
  "version",
  "title",
  "desc",
  "metadata"
];
var COMPRESSION_FLAGS = {
  uncompressed: "~",
  URLCompressor: "0",
  deflateRaw: "1"
};
var ENCODING_METHOD_FLAGS = {
  bruteforce53: "0",
  bigint64: "1",
  swap63: "2",
  four16: "3"
};
var REVERSE_COMPRESSION = Object.fromEntries(Object.entries(COMPRESSION_FLAGS).map(([name, flag]) => [
  flag,
  name
]));
var REVERSE_ENCODING = Object.fromEntries(Object.entries(ENCODING_METHOD_FLAGS).map(([name, flag]) => [
  flag,
  name
]));
function encodingMethodOf(flag) {
  return REVERSE_ENCODING[flag];
}
var TAB_SPACE = "    ";
var VIEWBOX_START_X = 0;
var VIEWBOX_START_Y = 0;

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/compression.ts
var textDecoder;
function decoder() {
  if (!textDecoder) textDecoder = new TextDecoder();
  return textDecoder;
}
async function runThrough(data, transform) {
  const result = new Response(transform.readable).arrayBuffer();
  const writer = transform.writable.getWriter();
  await writer.write(data);
  await writer.close();
  return await result;
}
async function decompressFromBase64(input, method) {
  const bytes = Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
  const buffer = await runThrough(bytes, new DecompressionStream(method));
  return decoder().decode(buffer);
}
async function decompressFromEncodedURIComponent(input, method) {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return await decompressFromBase64(base64, method);
}

// deno:https://jsr.io/@tksh/url-compressor/1.1.1/src/constants.ts
var SYMBOL_NUM = [
  258,
  258,
  130,
  99
];
var DIC = [
  256,
  256,
  128,
  97
];
var EOF = [
  257,
  257,
  129,
  98
];
var DICTIONARY_SIZE = 2048;
var TOTAL_OFFSET = 0.25;
var MATCH_LIMIT = 1e3;
var MODE3_ENCODE_TABLE = (() => {
  const result = [];
  let cnt = 0;
  for (let i = 0; i < 128; i++) {
    if (i < 32 && i !== 9 && i !== 10 || i === 127) {
      result.push(null);
    } else {
      result.push(cnt++);
    }
  }
  return result;
})();
var MODE3_DECODE_TABLE = (() => {
  const result = [];
  for (let i = 0; i < MODE3_ENCODE_TABLE.length; i++) {
    if (MODE3_ENCODE_TABLE[i] !== null) {
      result.push(i);
    }
  }
  return result;
})();
var BASE64_URL_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
var BASE64_URL_REVERSE_TABLE = (() => {
  const result = /* @__PURE__ */ new Map();
  for (let i = 0; i < BASE64_URL_TABLE.length; i++) {
    result.set(BASE64_URL_TABLE[i], i);
  }
  return result;
})();

// deno:https://jsr.io/@tksh/url-compressor/1.1.1/src/utf8.ts
function decodeUtf8(str) {
  if (typeof str !== "string") {
    return null;
  }
  let utf16str = "";
  for (let i = 0, len = str.length; i < len; i++) {
    const c0 = str.charCodeAt(i);
    if (c0 <= 127) {
      utf16str += String.fromCharCode(c0);
    } else if (c0 >= 194 && c0 <= 223) {
      if (i + 1 >= len) {
        return null;
      }
      const c1 = str.charCodeAt(++i);
      utf16str += String.fromCharCode((c0 & 31) << 6 | c1 & 63);
    } else if (c0 >= 224 && c0 <= 239) {
      if (i + 2 >= len) {
        return null;
      }
      const c1 = str.charCodeAt(++i);
      const c2 = str.charCodeAt(++i);
      utf16str += String.fromCharCode((c0 & 15) << 12 | (c1 & 63) << 6 | c2 & 63);
    } else if (c0 >= 240 && c0 <= 244) {
      if (i + 3 >= len) {
        return null;
      }
      const c1 = str.charCodeAt(++i);
      const c2 = str.charCodeAt(++i);
      const c3 = str.charCodeAt(++i);
      utf16str += String.fromCharCode(55296 | ((c0 & 7) << 8 | (c1 & 63) << 2 | c2 >>> 4 & 3) - 64, 56320 | (c2 & 15) << 6 | c3 & 63);
    } else {
      return null;
    }
  }
  return utf16str;
}

// deno:https://jsr.io/@tksh/url-compressor/1.1.1/src/huffman.ts
function getHuffmanTree(array, symbolNum) {
  const symbolSortTable = [];
  for (let i = 0; i < symbolNum; i++) {
    symbolSortTable.push(null);
    let j = i;
    while (j > 0 && symbolSortTable[j - 1].count < array[i]) {
      symbolSortTable[j] = symbolSortTable[j - 1];
      j--;
    }
    symbolSortTable[j] = {
      count: array[i],
      symbol: i,
      left: null,
      right: null
    };
  }
  while (symbolSortTable.length > 1) {
    const newObj = {
      count: symbolSortTable[symbolSortTable.length - 2].count + symbolSortTable[symbolSortTable.length - 1].count,
      symbol: -1,
      left: symbolSortTable[symbolSortTable.length - 2],
      right: symbolSortTable[symbolSortTable.length - 1]
    };
    symbolSortTable.pop();
    let i = symbolSortTable.length - 1;
    while (i > 0 && symbolSortTable[i - 1].count < newObj.count) {
      symbolSortTable[i] = symbolSortTable[i - 1];
      i--;
    }
    symbolSortTable[i] = newObj;
  }
  return symbolSortTable[0];
}

// deno:https://jsr.io/@tksh/url-compressor/1.1.1/src/utils.ts
function getRequiredBits(n) {
  let m = 1;
  let bits = 0;
  while (n >= m) {
    m <<= 1;
    bits++;
  }
  return bits;
}

// deno:https://jsr.io/@tksh/url-compressor/1.1.1/src/expand.ts
function expand(str, decode64 = true) {
  if (typeof str !== "string" || str.length === 0) {
    return null;
  }
  const codeBits = decode64 ? 6 : 8;
  const len = str.length;
  const codeBuf = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    let code2;
    if (decode64) {
      code2 = BASE64_URL_REVERSE_TABLE.get(str[i]);
      if (code2 === void 0) {
        return null;
      }
    } else {
      code2 = str.charCodeAt(i);
      if (code2 >= 256) {
        return null;
      }
    }
    codeBuf[i] = code2;
  }
  let bytePos = 0;
  let bitPos = 0;
  let code = codeBuf[0];
  function readBit() {
    const bit = code >> codeBits - bitPos - 1 & 1;
    if (++bitPos === codeBits) {
      bitPos = 0;
      bytePos++;
      if (bytePos < len) {
        code = codeBuf[bytePos];
      }
    }
    return bit;
  }
  let mode = readBit();
  mode = (mode << 1) + readBit();
  const _symbolNum = SYMBOL_NUM[mode];
  const _DIC = DIC[mode];
  const _EOF = EOF[mode];
  const symbolTotalTable = [];
  for (let i = 0; i < _symbolNum; i++) {
    symbolTotalTable.push(TOTAL_OFFSET);
  }
  let expandedStr = "";
  let tree = getHuffmanTree(symbolTotalTable, _symbolNum);
  let node = tree;
  let symbolCnt = 0;
  let index = 0;
  function decodeInt() {
    let w = 0;
    let decodedNum = 0;
    do {
      if (bytePos >= codeBuf.length) {
        return -1;
      }
      w = readBit();
      if (bytePos >= codeBuf.length) {
        return -1;
      }
      w = (w << 1) + readBit();
      if (w < 3) {
        decodedNum = decodedNum * 3 + w + 1;
      }
    } while (w < 3);
    return decodedNum;
  }
  while (bytePos < len) {
    node = readBit() ? node.right : node.left;
    if (node.symbol >= 0) {
      if (node.symbol === _EOF) {
        break;
      } else if (node.symbol === _DIC) {
        const decoded = decodeInt();
        if (decoded < 0) {
          return null;
        }
        const matchLen = decoded + 3;
        if (matchLen > MATCH_LIMIT) {
          return null;
        }
        let offset = 0;
        const bits = getRequiredBits(Math.min(index - 1, DICTIONARY_SIZE - 1));
        for (let i = 0; i < bits; i++) {
          if (bytePos >= len) {
            return null;
          }
          offset = (offset << 1) + readBit();
        }
        if (offset >= index) {
          return null;
        }
        for (let i = 0; i < matchLen; i++) {
          expandedStr += expandedStr[index - offset - 1 + i];
        }
        index += matchLen;
      } else {
        expandedStr += String.fromCharCode(node.symbol);
        index++;
      }
      symbolTotalTable[node.symbol]++;
      symbolCnt++;
      if (symbolCnt < 256 || symbolCnt % 8 === 0) {
        tree = getHuffmanTree(symbolTotalTable, _symbolNum);
      }
      node = tree;
    }
  }
  if (mode === 0) {
    expandedStr = decodeUtf8(expandedStr);
    if (expandedStr === null) {
      return null;
    }
  } else if (mode === 3) {
    let str2 = "";
    for (let len2 = expandedStr.length, i = 0; i < len2; i++) {
      str2 += String.fromCharCode(MODE3_DECODE_TABLE[expandedStr.charCodeAt(i)]);
    }
    expandedStr = str2;
  }
  return expandedStr;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/flags.ts
async function tryDecompress(flagged) {
  if (flagged.startsWith(COMPRESSION_FLAGS.uncompressed)) {
    return flagged.slice(1);
  }
  if (flagged.startsWith(COMPRESSION_FLAGS.URLCompressor)) {
    const decoded = expand(flagged.slice(1));
    if (decoded === null) {
      throw new Error("tryDecompress: URLCompressor failed to decode");
    }
    return decoded;
  }
  if (flagged.startsWith(COMPRESSION_FLAGS.deflateRaw)) {
    return await decompressFromEncodedURIComponent(flagged.slice(1), "deflate-raw");
  }
  throw new Error(`tryDecompress: unknown compression flag in ${JSON.stringify(flagged.slice(0, 8))}`);
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/base-n/chars.ts
var LOWER_START = 97;
var UPPER_START = 65;
function getBase53Characters() {
  let result = "_";
  for (let i = 0; i < 26; i++) result += String.fromCharCode(LOWER_START + i);
  for (let i = 0; i < 26; i++) result += String.fromCharCode(UPPER_START + i);
  return result;
}
function getBase64UrlCharacters() {
  let result = "";
  for (let i = 0; i < 26; i++) result += String.fromCharCode(UPPER_START + i);
  for (let i = 0; i < 26; i++) result += String.fromCharCode(LOWER_START + i);
  for (let i = 0; i < 10; i++) result += String(i);
  result += "-_";
  return result;
}
function getFour16CharsSets() {
  let p1 = "";
  for (let i = 0; i < 16; i++) p1 += String.fromCharCode(LOWER_START + i);
  let n1 = "";
  for (let i = 0; i < 16; i++) n1 += String.fromCharCode(UPPER_START + i);
  let p2 = "";
  for (let i = 0; i < 10; i++) p2 += String.fromCharCode(LOWER_START + 16 + i);
  for (let i = 0; i < 6; i++) p2 += String(i);
  let n2 = "";
  for (let i = 0; i < 10; i++) n2 += String.fromCharCode(UPPER_START + 16 + i);
  for (let i = 6; i < 10; i++) n2 += String(i);
  n2 += "-_";
  return {
    p1,
    n1,
    p2,
    n2
  };
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/base-n/base52.ts
var ALPHABET52 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function base52Dec(str) {
  const base = ALPHABET52.length;
  let decoded = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === void 0) throw new Error("base52Dec: unreachable index");
    const index = ALPHABET52.indexOf(ch);
    if (index === -1) {
      throw new Error(`base52Dec: invalid character ${JSON.stringify(ch)}`);
    }
    decoded += index * Math.pow(base, str.length - i - 1);
  }
  return decoded;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/base-n/base53.ts
var ALPHABET53 = getBase53Characters();
function base53Dec(str) {
  const base = ALPHABET53.length;
  let decoded = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === void 0) throw new Error("base53Dec: unreachable index");
    const index = ALPHABET53.indexOf(ch);
    if (index === -1) {
      throw new Error(`base53Dec: invalid character ${JSON.stringify(ch)}`);
    }
    decoded += index * Math.pow(base, str.length - i - 1);
  }
  return decoded;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/base-n/base64url.ts
var ALPHABET64URL = getBase64UrlCharacters();
function base64UrlDec(str) {
  const base = BigInt(ALPHABET64URL.length);
  let num = 0n;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === void 0) throw new Error("base64UrlDec: unreachable index");
    const index = ALPHABET64URL.indexOf(ch);
    if (index === -1) throw new Error("Invalid character");
    num = num * base + BigInt(index);
  }
  return num;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/color/hex.ts
function tryDeleteHash(hexStr) {
  return hexStr.startsWith("#") ? hexStr.slice(1) : hexStr;
}
function doubled(hex) {
  return hex.split("").map((char) => char.repeat(2)).join("");
}
function hexExpandToSix(hex) {
  if (!hex) throw new Error("hexExpandToSix: empty input");
  if (hex.length === 6) return hex;
  if (hex.length === 3) return doubled(hex);
  throw new Error(`hexExpandToSix: invalid length ${hex.length}`);
}
function hexExpandToTen(hex) {
  if (hex.length === 10) return hex;
  if (hex.length === 6) return hex + "ffff";
  if (hex.length === 3 || hex.length === 5) {
    const expanded = doubled(hex);
    return expanded.length === 6 ? expanded + "ffff" : expanded;
  }
  if (hex.length === 1) return hex.repeat(6) + "ffff";
  throw new Error(`hexExpandToTen: invalid length ${hex.length}`);
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/color/rgb.ts
function normalizedFromHex(hex) {
  const normalized = parseInt(hex, 16) / 255;
  if (!Number.isFinite(normalized)) {
    throw new Error(`normalizedFromHex: invalid hex ${JSON.stringify(hex)}`);
  }
  return Number(normalized.toFixed(2));
}
function hexToUint8(twoDigitsHex) {
  if (!/^[0-9A-Fa-f]{2}$/.test(twoDigitsHex)) {
    throw new Error(`hexToUint8: invalid hex ${JSON.stringify(twoDigitsHex)}`);
  }
  return parseInt(twoDigitsHex, 16);
}
function hexToRgbArr(threeOrSixDigitsHex) {
  const six = hexExpandToSix(tryDeleteHash(threeOrSixDigitsHex));
  if (!/^[0-9A-Fa-f]{6}$/.test(six)) {
    throw new Error(`hexToRgbArr: invalid hex ${JSON.stringify(threeOrSixDigitsHex)}`);
  }
  return [
    hexToUint8(six.substring(0, 2)),
    hexToUint8(six.substring(2, 4)),
    hexToUint8(six.substring(4, 6))
  ];
}
function rgbStringify(rgbArr) {
  return `rgb(${[
    ...rgbArr
  ].join(" ")})`;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/color/opacity.ts
function addDecimalToZeroAndOne(num) {
  if (num === 0 || num === 1) return num.toFixed(1);
  return num.toString();
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/basic-data/basic_data.ts
async function getBasicDataFromUrlParams(params) {
  const result = {
    bits: ""
  };
  let bitsSeen = false;
  for (const key of BASIC_DATA_KEYS) {
    if (!params.has(key)) continue;
    const raw = params.get(key);
    if (raw === null) continue;
    if (raw === "") {
      throw new Error(`getBasicDataFromUrlParams: empty value for ${key}`);
    }
    const value = await tryDecompress(raw);
    if (key === "bits") {
      result.bits = value;
      bitsSeen = true;
    } else if (key === "version") {
      result.version = value;
    } else if (key === "title") {
      result.title = value;
    } else if (key === "desc") {
      result.desc = value;
    } else {
      result.metadata = value;
    }
  }
  if (!bitsSeen) throw new Error("getBasicDataFromUrlParams: bits is required");
  return result;
}
function resolveUintN(bits) {
  if (bits === "") throw new Error("resolveUintN: empty bits");
  const uintN = Number(bits);
  if (!Number.isInteger(uintN) || uintN < 0) {
    throw new Error(`resolveUintN: invalid bits ${JSON.stringify(bits)}`);
  }
  return uintN;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/group-colors/group_colors.ts
function decodeGroupColors(tenDigitsHex) {
  if (tenDigitsHex.length !== 10) {
    throw new Error(`decodeGroupColors: expected 10 hex digits, got ${tenDigitsHex.length}`);
  }
  const gStrokeHex = "#" + tenDigitsHex.slice(0, 6);
  const gStrokeRgbArr = hexToRgbArr(gStrokeHex);
  const gStrokeRgbStr = rgbStringify(gStrokeRgbArr);
  const gOpacityUint8 = hexToUint8(tenDigitsHex.slice(6, 8));
  const gOpacityFloat = normalizedFromHex(tenDigitsHex.slice(6, 8));
  const gOpacity = addDecimalToZeroAndOne(gOpacityFloat);
  const gStrokeOpacityUint8 = hexToUint8(tenDigitsHex.slice(8));
  const gStrokeOpacityFloat = normalizedFromHex(tenDigitsHex.slice(8));
  const gStrokeOpacity = addDecimalToZeroAndOne(gStrokeOpacityFloat);
  return {
    gStrokeHex,
    gStrokeRgbArr,
    gStrokeRgbStr,
    gOpacityUint8,
    gOpacityFloat,
    gOpacity,
    gStrokeOpacityUint8,
    gStrokeOpacityFloat,
    gStrokeOpacity
  };
}

// deno:https://jsr.io/@std/collections/1.4.0/running_reduce.ts
function runningReduce(array, reducer, initialValue) {
  let currentResult = initialValue;
  return array.map((el, currentIndex) => currentResult = reducer(currentResult, el, currentIndex));
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/widths-counts/widths_counts.ts
function decodeWidthsAndCounts(encodedStr) {
  const parts = encodedStr.match(/\d+|[_a-zA-Z]+/g);
  if (parts === null) throw new Error("decodeWidthsAndCounts: empty input");
  if (parts.length % 2 !== 0) {
    throw new Error(`decodeWidthsAndCounts: odd segment count in ${JSON.stringify(encodedStr)}`);
  }
  const widths = [];
  const counts = [];
  for (let i = 0; i < parts.length; i += 2) {
    const width = parts[i];
    const count = parts[i + 1];
    if (width === void 0 || count === void 0) {
      throw new Error("decodeWidthsAndCounts: unreachable index");
    }
    widths.push(Number(width));
    counts.push(base53Dec(count));
  }
  const add = (acc, cur) => acc + cur;
  const firstlineIndices = [
    1,
    ...runningReduce(counts, add, 1)
  ];
  firstlineIndices.pop();
  const lastlineIndices = runningReduce(counts, add, 0);
  return {
    firstlineIndices,
    lastlineIndices,
    widths,
    counts
  };
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/bruteforce53/alphabets.ts
var LOWER_START2 = 97;
var UPPER_START2 = 65;
function getAlphabets52() {
  let result = "";
  for (let i = 0; i < 26; i++) result += String.fromCharCode(LOWER_START2 + i);
  for (let i = 0; i < 26; i++) result += String.fromCharCode(UPPER_START2 + i);
  return result;
}
function getAlphabetsForCodebook(codebookSize) {
  if (codebookSize === 0) return "";
  return getAlphabets52().slice(-codebookSize);
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/bruteforce53/shift.ts
function calculateMinimumPossibleDiffValueFromUintN(uintN) {
  const maximumRelativeDValue = 2 ** uintN - 1;
  const minimumRelativeDValue = 0 - maximumRelativeDValue;
  return minimumRelativeDValue - maximumRelativeDValue;
}
function subtractToRestoreOriginalAfterDecode(num, uintN) {
  return num - Math.abs(calculateMinimumPossibleDiffValueFromUintN(uintN));
}
function getHalfOfBaseXRange(baseX) {
  return Math.trunc(baseX ** 2 / 2);
}
function getNumToShift(baseX) {
  const half = getHalfOfBaseXRange(baseX);
  return {
    forBefore0: half,
    forAfter9: half - 10
  };
}
function subtractNumAfterDecode(num, baseX) {
  const shift = getNumToShift(baseX);
  const half = getHalfOfBaseXRange(baseX);
  if (shift.forBefore0 + (0 - half) <= num && num <= shift.forBefore0 + -1) {
    return num - shift.forBefore0;
  }
  if (shift.forAfter9 + 10 <= num && num <= shift.forAfter9 + half + 9) {
    return num - shift.forAfter9;
  }
  return void 0;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/bruteforce53/base_x.ts
function baseXDec(str, baseX) {
  const alphabet = getAlphabets52().substring(0, baseX);
  const base = alphabet.length;
  let decoded = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === void 0) throw new Error("baseXDec: unreachable index");
    const index = alphabet.indexOf(ch);
    if (index === -1) {
      throw new Error(`baseXDec: invalid character ${JSON.stringify(ch)}`);
    }
    decoded += index * Math.pow(base, str.length - i - 1);
  }
  const restored = subtractNumAfterDecode(decoded, baseX);
  if (restored === void 0) {
    throw new Error(`baseXDec: ${JSON.stringify(str)} out of base${baseX} range`);
  }
  return restored;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/bruteforce53/freq_diff.ts
function base52DecodeForFreqDiff(chunk2, uintN) {
  return subtractToRestoreOriginalAfterDecode(base52Dec(chunk2), uintN);
}
function decodeFreqDiff(diffStr, uintN) {
  if (!diffStr) return [];
  const chunks = [];
  let i = 0;
  while (i < diffStr.length) {
    const ch = diffStr[i];
    if (ch === void 0) throw new Error("decodeFreqDiff: unreachable index");
    if (ch === "_") {
      let underscores = 0;
      while (diffStr[i] === "_" && i < diffStr.length) {
        underscores++;
        i++;
      }
      chunks.push(diffStr.slice(i, i + underscores + 2));
      i += underscores + 2;
    } else {
      chunks.push(diffStr.slice(i, i + 2));
      i += 2;
    }
  }
  return chunks.map((chunk2) => base52DecodeForFreqDiff(chunk2, uintN));
}

// deno:https://jsr.io/@std/collections/1.4.0/zip.ts
function zip(...iterables) {
  const arrayCount = iterables.length;
  if (arrayCount === 0) return [];
  const arrays = iterables.map((it) => Array.isArray(it) ? it : Array.from(it));
  let minLength = arrays[0].length;
  for (let i = 1; i < arrayCount; ++i) {
    const len = arrays[i].length;
    if (len < minLength) minLength = len;
  }
  const result = new Array(minLength);
  if (arrayCount === 2) {
    const a = arrays[0];
    const b = arrays[1];
    for (let i = 0; i < minLength; ++i) {
      result[i] = [
        a[i],
        b[i]
      ];
    }
    return result;
  }
  for (let i = 0; i < minLength; ++i) {
    const tuple = new Array(arrayCount);
    for (let j = 0; j < arrayCount; ++j) {
      tuple[j] = arrays[j][i];
    }
    result[i] = tuple;
  }
  return result;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/bruteforce53/codebook.ts
function getActualCodebookSize(maxCodebookSize, freqDiffArr) {
  return freqDiffArr.length >= maxCodebookSize ? maxCodebookSize : freqDiffArr.length;
}
function createCodebookToDec(freqDiffArr, actualCodebookSize) {
  const letters = [
    ...getAlphabetsForCodebook(actualCodebookSize)
  ];
  if (letters.length !== freqDiffArr.length) {
    throw new Error("createCodebookToDec: codebook length mismatch");
  }
  return new Map(zip(letters, freqDiffArr));
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/bruteforce53/diff.ts
function decodeDiff(diffStr, codebook, baseX) {
  const codebookChars = new Set(codebook.keys());
  const decoded = [];
  let i = 0;
  while (i < diffStr.length) {
    const ch = diffStr[i];
    if (ch === void 0) throw new Error("decodeDiff: unreachable index");
    if (codebookChars.has(ch)) {
      const value = codebook.get(ch);
      if (value === void 0) throw new Error("decodeDiff: codebook miss");
      decoded.push(value);
      i++;
    } else if (/^[0-9]$/.test(ch)) {
      decoded.push(parseInt(ch, 10));
      i++;
    } else if (ch === "_") {
      let underscores = 0;
      while (diffStr[i] === "_" && i < diffStr.length) {
        underscores++;
        i++;
      }
      const payloadLength = underscores % 2 === 1 ? Math.floor(underscores / 2) + 2 : underscores / 2 + 1;
      const payload = diffStr.slice(i, i + payloadLength);
      decoded.push(underscores % 2 === 1 ? base52Dec(payload) : -base52Dec(payload));
      i += payloadLength;
    } else {
      decoded.push(baseXDec(diffStr.slice(i, i + 2), baseX));
      i += 2;
    }
  }
  return decoded;
}
function diffToRel(diffArray) {
  const original = [];
  diffArray.forEach((diff, index) => {
    const value = typeof diff === "number" ? diff : parseInt(diff, 10);
    if (!Number.isFinite(value)) {
      throw new Error(`diffToRel: invalid diff ${JSON.stringify(diff)}`);
    }
    original.push(index === 0 ? value : original[index - 1] + value);
  });
  return original;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/bruteforce53/bruteforce53.ts
var COORDS = [
  "x1",
  "y1",
  "x2",
  "y2"
];
function bruteforce53Dec(encodedDvalsStr, uintN) {
  const first = encodedDvalsStr[0];
  if (first === void 0) throw new Error("bruteforce53Dec: empty input");
  const baseX = base53Dec(first);
  const maxCodebookSize = 52 - baseX;
  const parts = encodedDvalsStr.slice(1).split("-");
  const freqByCoords = [];
  const diffByCoords = [];
  parts.forEach((part, index) => {
    (index % 2 === 0 ? freqByCoords : diffByCoords).push(part);
  });
  if (freqByCoords.length !== 4 || diffByCoords.length !== 4) {
    throw new Error("bruteforce53Dec: expected four coordinates");
  }
  return COORDS.map((_, i) => {
    const freqStr = freqByCoords[i];
    const diffStr = diffByCoords[i];
    const freqValues = decodeFreqDiff(freqStr, uintN);
    const actualSize = getActualCodebookSize(maxCodebookSize, freqValues);
    const codebook = createCodebookToDec(freqValues, actualSize);
    return decodeDiff(diffStr, codebook, baseX);
  });
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/bigint64/bigint64.ts
function getDigitsPerChunk(uintN) {
  return String(2 ** uintN - 1).length;
}
function findNearestMultipleOfFourX(number, multiple) {
  return Math.ceil(number / (multiple * 4)) * (multiple * 4);
}
function recoverOriginalZeroPadding(bigintAsStr, digitsPerChunk) {
  const paddedLength = findNearestMultipleOfFourX(bigintAsStr.length, digitsPerChunk);
  return bigintAsStr.length === paddedLength ? bigintAsStr : bigintAsStr.padStart(paddedLength, "0");
}
function bigint64Dec(encodedDvalsStr, uintN) {
  const digits = getDigitsPerChunk(uintN);
  const padded = recoverOriginalZeroPadding(String(base64UrlDec(encodedDvalsStr)), digits);
  if (padded.length % 4 !== 0) {
    throw new Error("bigint64Dec: padded length not divisible by four");
  }
  const quarter = padded.length / 4;
  if (quarter % digits !== 0) {
    throw new Error("bigint64Dec: coordinate length not a multiple of digits per chunk");
  }
  const quad = [
    [],
    [],
    [],
    []
  ];
  for (let c = 0; c < 4; c++) {
    const part = padded.substring(quarter * c, quarter * (c + 1));
    const target = quad[c];
    if (target === void 0) throw new Error("bigint64Dec: unreachable index");
    for (let k = 0; k < part.length; k += digits) {
      const piece = part.substring(k, k + digits);
      const value = Number(piece);
      if (!Number.isInteger(value)) {
        throw new Error(`bigint64Dec: invalid chunk ${JSON.stringify(piece)}`);
      }
      target.push(value);
    }
  }
  return quad;
}
function absToRel(absoluteDvals, widthsAndCounts) {
  const firstline = new Set(widthsAndCounts.firstlineIndices.map((n) => n - 1));
  const [x1Arr, y1Arr, x2Arr, y2Arr] = absoluteDvals;
  const flat = [];
  let prevX2 = 0;
  let prevY2 = 0;
  const count = x1Arr?.length ?? 0;
  for (let i = 0; i < count; i++) {
    const x1 = x1Arr?.[i];
    const y1 = y1Arr?.[i];
    const x2 = x2Arr?.[i];
    const y2 = y2Arr?.[i];
    if (x1 === void 0 || y1 === void 0 || x2 === void 0 || y2 === void 0) {
      throw new Error("absToRel: ragged coordinate arrays");
    }
    if (firstline.has(i)) {
      flat.push(x1, y1, x2 - x1, y2 - y1);
    } else {
      flat.push(x1 - prevX2, y1 - prevY2, x2 - x1, y2 - y1);
    }
    prevX2 = x2;
    prevY2 = y2;
  }
  const quad = [
    [],
    [],
    [],
    []
  ];
  for (let i = 0; i < flat.length / 4; i++) {
    for (let c = 0; c < 4; c++) {
      const value = flat[i * 4 + c];
      const target = quad[c];
      if (value === void 0 || target === void 0) {
        throw new Error("absToRel: unreachable index");
      }
      target.push(value);
    }
  }
  return quad;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/swap63/swap63.ts
var MIN = -31;
var MAX = 31;
function get63Numbers() {
  const numbers = [];
  for (let i = MIN; i <= MAX; i++) numbers.push(i);
  return numbers;
}
function get63Characters() {
  const chars = [];
  for (let i = 0; i < 10; i++) chars.push(String(i));
  for (let i = 97; i <= 122; i++) chars.push(String.fromCharCode(i));
  for (let i = 65; i <= 90; i++) chars.push(String.fromCharCode(i));
  chars.push("_");
  return chars;
}
function createCodebook(keys, values) {
  if (keys.length !== values.length) {
    throw new Error("createCodebook: length mismatch");
  }
  return new Map(zip(keys, values));
}
function swap63Dec(encodedDvalsStr) {
  const toNum = createCodebook(get63Characters(), get63Numbers());
  const partLength = Math.ceil(encodedDvalsStr.length / 4);
  const quad = [
    [],
    [],
    [],
    []
  ];
  for (let c = 0; c < 4; c++) {
    const part = encodedDvalsStr.slice(c * partLength, (c + 1) * partLength);
    const target = quad[c];
    if (target === void 0) throw new Error("swap63Dec: unreachable index");
    for (const ch of part) {
      const value = toNum.get(ch);
      if (value === void 0) {
        throw new Error(`swap63Dec: invalid character ${JSON.stringify(ch)}`);
      }
      target.push(value);
    }
  }
  return quad;
}

// deno:https://jsr.io/@std/collections/1.4.0/chunk.ts
function chunk(iterable, size) {
  if (size <= 0 || !Number.isInteger(size)) {
    throw new RangeError(`Expected size to be an integer greater than 0 but found ${size}`);
  }
  const result = [];
  if (Array.isArray(iterable)) {
    let index = 0;
    while (index < iterable.length) {
      result.push(iterable.slice(index, index + size));
      index += size;
    }
    return result;
  }
  let chunk2 = [];
  for (const item of iterable) {
    chunk2.push(item);
    if (chunk2.length === size) {
      result.push(chunk2);
      chunk2 = [];
    }
  }
  if (chunk2.length > 0) {
    result.push(chunk2);
  }
  return result;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/four16/four16.ts
function customBase16Dec(symbol, charsSet) {
  let decoded = 0;
  for (let i = 0; i < symbol.length; i++) {
    const ch = symbol[i];
    if (ch === void 0) throw new Error("customBase16Dec: unreachable index");
    const index = charsSet.indexOf(ch);
    if (index === -1) {
      throw new Error(`customBase16Dec: invalid character ${JSON.stringify(ch)}`);
    }
    decoded += index * Math.pow(16, symbol.length - i - 1);
  }
  return decoded;
}
function decodeFourBase16Coords(str) {
  const sets = getFour16CharsSets();
  const values = [];
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (ch === void 0) {
      throw new Error("decodeFourBase16Coords: unreachable index");
    }
    if (sets.p1.includes(ch)) {
      values.push(customBase16Dec(ch, sets.p1));
      i++;
    } else if (sets.n1.includes(ch)) {
      values.push("-" + customBase16Dec(ch, sets.n1));
      i++;
    } else if (sets.p2.includes(ch)) {
      const pair = str.slice(i, i + 2);
      if (pair.length !== 2) {
        throw new Error("decodeFourBase16Coords: truncated pair");
      }
      values.push(customBase16Dec(pair, sets.p2));
      i += 2;
    } else if (sets.n2.includes(ch)) {
      const pair = str.slice(i, i + 2);
      if (pair.length !== 2) {
        throw new Error("decodeFourBase16Coords: truncated pair");
      }
      values.push("-" + customBase16Dec(pair, sets.n2));
      i += 2;
    } else {
      throw new Error(`decodeFourBase16Coords: invalid character ${JSON.stringify(ch)}`);
    }
  }
  return values;
}
function four16Dec(encodedDvalsStr, uintN) {
  const flat = decodeFourBase16Coords(encodedDvalsStr);
  if (flat.length % 4 !== 0) {
    throw new Error("four16Dec: value count not divisible by four");
  }
  const parts = chunk(flat, flat.length / 4);
  const quad = [
    [],
    [],
    [],
    []
  ];
  for (let c = 0; c < 4; c++) {
    const part = parts[c];
    const target = quad[c];
    if (part === void 0 || target === void 0) {
      throw new Error("four16Dec: unreachable index");
    }
    const numbers = part.map((v) => typeof v === "number" ? v : parseInt(v, 10));
    if (numbers.some((n) => !Number.isFinite(n))) {
      throw new Error("four16Dec: invalid value");
    }
    target.push(...uintN <= 7 ? diffToRel(numbers) : numbers);
  }
  return quad;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/size-data/size_data.ts
function calculateCanvasSize(d) {
  const [x1a, x1b] = [
    d.x1[0],
    d.x1[1]
  ];
  const [y1a, y1b] = [
    d.y1[0],
    d.y1[1]
  ];
  const [x2a] = [
    d.x2[0]
  ];
  const [y2a] = [
    d.y2[0]
  ];
  if (d.x1.length === 2 && x1a !== void 0 && x1b !== void 0 && y1a !== void 0 && y1b !== void 0 && x2a !== void 0 && y2a !== void 0) {
    if (x1a === x2a) return {
      width: x1a + x1b,
      height: y1a + y2a
    };
    if (y1a === y2a) return {
      width: y1a + y1b,
      height: x1a + x2a
    };
  }
  if (d.x1.length === 1 && x1a !== void 0 && y1a !== void 0 && x2a !== void 0 && y2a !== void 0) {
    if (x1a === x2a) return {
      width: y1a + y2a,
      height: x1a + x2a
    };
    if (y1a === y2a) return {
      width: x1a + x2a,
      height: y1a + y2a
    };
  }
  throw new Error("calculateCanvasSize: invalid background coordinates");
}
function sizeDataDec(groupZero) {
  const { width, height } = calculateCanvasSize(groupZero.absDvalsObj);
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error("sizeDataDec: non-integer canvas size");
  }
  return {
    viewbox: `${VIEWBOX_START_X} ${VIEWBOX_START_Y} ${width} ${height}`,
    width,
    height
  };
}
function relToAbs(relativeDvals, widthsAndCounts) {
  const [x1Rel, y1Rel, x2Rel, y2Rel] = relativeDvals;
  const firstline = new Set(widthsAndCounts.firstlineIndices.map((n) => n - 1));
  const lines = [];
  const count = x1Rel?.length ?? 0;
  for (let i = 0; i < count; i++) {
    const rx1 = x1Rel?.[i];
    const ry1 = y1Rel?.[i];
    const rx2 = x2Rel?.[i];
    const ry2 = y2Rel?.[i];
    if (rx1 === void 0 || ry1 === void 0 || rx2 === void 0 || ry2 === void 0) {
      throw new Error("relToAbs: ragged coordinate arrays");
    }
    if (firstline.has(i)) {
      lines.push([
        rx1,
        ry1,
        rx1 + rx2,
        ry1 + ry2
      ]);
    } else {
      const prev = lines[i - 1];
      if (prev === void 0) {
        throw new Error("relToAbs: missing previous line");
      }
      const x1 = rx1 + prev[2];
      const y1 = ry1 + prev[3];
      lines.push([
        x1,
        y1,
        rx2 + x1,
        ry2 + y1
      ]);
    }
  }
  const quad = [
    [],
    [],
    [],
    []
  ];
  for (const [x1, y1, x2, y2] of lines) {
    quad[0].push(x1);
    quad[1].push(y1);
    quad[2].push(x2);
    quad[3].push(y2);
  }
  return quad;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/svg/svg.ts
function isPresent(value) {
  return value !== void 0 && value !== "";
}
function generateSvg(decoded, opts) {
  const before = generateTagsBeforeStrokes(decoded.basicData, decoded.sizeData);
  const after = generateTagsAfterStrokes();
  const opens = generateGTagOpenByGroups(decoded.linesData);
  const closes = generateGTagCloseByGroups(decoded.linesData);
  const paths = opts.pathMode === "relativeMerged" ? generateRelPathTags(decoded.linesData) : generateAbsPathTags(decoded.linesData);
  const strokes = [];
  for (const gId of decoded.linesData.keys()) {
    const open = opens.get(gId);
    const path = paths.get(gId);
    const close = closes.get(gId);
    if (open === void 0 || path === void 0 || close === void 0) {
      throw new Error(`generateSvg: missing tags for group ${gId}`);
    }
    strokes.push(open, path, close);
  }
  return [
    ...before,
    ...strokes,
    ...after
  ].join("\n");
}
function generateRelPathTags(linesData) {
  const byGroup = /* @__PURE__ */ new Map();
  for (const [gId, group] of linesData) {
    const { widths, firstlineIndices, lastlineIndices } = group.widthsAndCounts;
    const tags = [];
    for (let w = 0; w < widths.length; w++) {
      const width = widths[w];
      const first = (firstlineIndices[w] ?? NaN) - 1;
      const last = (lastlineIndices[w] ?? NaN) - 1;
      if (width === void 0 || !Number.isInteger(first) || !Number.isInteger(last)) {
        throw new Error(`generateSvg: bad width run ${w} in group ${gId}`);
      }
      let dval = "";
      for (let i = first; i <= last; i++) {
        dval += `m ${group.relDvalsObj.x1[i]} ${group.relDvalsObj.y1[i]} ${group.relDvalsObj.x2[i]} ${group.relDvalsObj.y2[i]}`;
      }
      tags.push(`${TAB_SPACE.repeat(3)}<path stroke-width="${width}" d="${dval}" />`);
    }
    byGroup.set(gId, tags.join("\n"));
  }
  return byGroup;
}
function generateAbsPathTags(linesData) {
  const byGroup = /* @__PURE__ */ new Map();
  for (const [gId, group] of linesData) {
    const { widths, firstlineIndices, lastlineIndices } = group.widthsAndCounts;
    const tags = [];
    for (let w = 0; w < widths.length; w++) {
      const width = widths[w];
      const first = (firstlineIndices[w] ?? NaN) - 1;
      const last = (lastlineIndices[w] ?? NaN) - 1;
      if (width === void 0 || !Number.isInteger(first) || !Number.isInteger(last)) {
        throw new Error(`generateSvg: bad width run ${w} in group ${gId}`);
      }
      const lines = [
        `${TAB_SPACE.repeat(3)}<g stroke-width="${width}">`
      ];
      for (let i = first; i <= last; i++) {
        lines.push(`${TAB_SPACE.repeat(4)}<path d="M ${group.absDvalsObj.x1[i]} ${group.absDvalsObj.y1[i]} L ${group.absDvalsObj.x2[i]} ${group.absDvalsObj.y2[i]}" />`);
      }
      lines.push(`${TAB_SPACE.repeat(3)}</g>`);
      tags.push(lines.join("\n"));
    }
    byGroup.set(gId, tags.join("\n"));
  }
  return byGroup;
}
function generateTagsBeforeStrokes(basicData, sizeData) {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sizeData.viewbox}" shape-rendering="crispEdges">`;
  const optional = [
    {
      tag: "title",
      content: basicData.title
    },
    {
      tag: "desc",
      content: basicData.desc
    },
    {
      tag: "metadata",
      content: indentMetadata(basicData.metadata)
    }
  ];
  const tags = optional.filter((entry) => isPresent(entry.content)).map(({ tag, content }) => `${TAB_SPACE}<${tag}>${content}</${tag}>`);
  const defs = [
    `${TAB_SPACE}<defs>`,
    `${TAB_SPACE.repeat(2)}<clipPath id="shape-to-trim">`,
    `${TAB_SPACE.repeat(3)}<rect width="100%" height="100%" />`,
    `${TAB_SPACE.repeat(2)}</clipPath>`,
    `${TAB_SPACE}</defs>`
  ].join("\n");
  return [
    open,
    ...tags,
    defs,
    `${TAB_SPACE}<g clip-path="url(#shape-to-trim)">`
  ];
}
function indentMetadata(metadata) {
  if (!isPresent(metadata)) return void 0;
  const indented = metadata.split("\n").map((line) => `${TAB_SPACE.repeat(2)}${line}`);
  return `
${indented.join("\n")}
${TAB_SPACE}`;
}
function generateTagsAfterStrokes() {
  return [
    `${TAB_SPACE}</g>`,
    `</svg>`
  ];
}
function generateGTagOpenByGroups(linesData) {
  const byGroup = /* @__PURE__ */ new Map();
  for (const [gId, group] of linesData) {
    const colors = group.groupColors;
    byGroup.set(gId, `${TAB_SPACE.repeat(2)}<g id="${gId}" stroke="${colors.gStrokeRgbStr}" opacity="${colors.gOpacity}" stroke-opacity="${colors.gStrokeOpacity}">`);
  }
  return byGroup;
}
function generateGTagCloseByGroups(linesData) {
  const byGroup = /* @__PURE__ */ new Map();
  for (const [gId] of linesData) byGroup.set(gId, `${TAB_SPACE.repeat(2)}</g>`);
  return byGroup;
}

// deno:https://jsr.io/@tksh/stln-codec/0.1.3/src/decode.ts
function toQuad(rows, what) {
  if (rows.length !== 4) throw new Error(`${what}: expected four coordinates`);
  const [x1, y1, x2, y2] = rows;
  if (x1 === void 0 || y1 === void 0 || x2 === void 0 || y2 === void 0) {
    throw new Error(`${what}: unreachable index`);
  }
  return [
    x1,
    y1,
    x2,
    y2
  ];
}
function rowsOf(quad) {
  return {
    x1: quad[0],
    y1: quad[1],
    x2: quad[2],
    y2: quad[3]
  };
}
async function decodeUrlParams(search) {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : new URLSearchParams(search.toString());
  const basicData = await getBasicDataFromUrlParams(params);
  const uintN = resolveUintN(basicData.bits);
  const basicKeys = new Set(BASIC_DATA_KEYS);
  const lineEntries = [];
  for (const [key, value] of params) {
    if (!basicKeys.has(key)) lineEntries.push([
      key,
      value
    ]);
  }
  const linesData = /* @__PURE__ */ new Map();
  for (let gId = 0; gId < lineEntries.length; gId++) {
    const entry = lineEntries[gId];
    if (entry === void 0) {
      throw new Error("decodeUrlParams: unreachable index");
    }
    const [colorKey, rawValue] = entry;
    const groupColors = decodeGroupColors(hexExpandToTen(colorKey));
    const payload = await tryDecompress(rawValue);
    const flag = payload[0];
    if (flag === void 0) {
      throw new Error(`decodeUrlParams: empty payload for group ${gId}`);
    }
    const method = encodingMethodOf(flag);
    if (method === void 0) {
      throw new Error(`decodeUrlParams: unknown encoding flag ${JSON.stringify(flag)}`);
    }
    const separator = payload.indexOf("-", 1);
    if (separator === -1) {
      throw new Error(`decodeUrlParams: no widths separator for group ${gId}`);
    }
    const widthsAndCounts = decodeWidthsAndCounts(payload.slice(1, separator));
    const encodedDvals = payload.slice(separator + 1);
    let rel;
    let abs;
    switch (method) {
      case "bruteforce53": {
        const diffs = toQuad(bruteforce53Dec(encodedDvals, uintN), `group ${gId}`);
        rel = toQuad(diffs.map(diffToRel), `group ${gId}`);
        abs = relToAbs(rel, widthsAndCounts);
        break;
      }
      case "bigint64": {
        abs = bigint64Dec(encodedDvals, uintN);
        rel = absToRel(abs, widthsAndCounts);
        break;
      }
      case "swap63": {
        rel = swap63Dec(encodedDvals);
        abs = relToAbs(rel, widthsAndCounts);
        break;
      }
      case "four16": {
        rel = four16Dec(encodedDvals, uintN);
        abs = relToAbs(rel, widthsAndCounts);
        break;
      }
    }
    linesData.set(gId, {
      groupColors,
      encodingMethodFlag: flag,
      widthsAndCounts,
      encodedDvals,
      relDvalsObj: rowsOf(rel),
      absDvalsObj: rowsOf(abs)
    });
  }
  const background = linesData.get(0);
  if (background === void 0) {
    throw new Error("decodeUrlParams: missing background group");
  }
  return {
    basicData,
    linesData,
    sizeData: sizeDataDec(background)
  };
}

// src/stln/composite.ts
var STLN_PATH_MODE = "relativeMerged";
function stlnQuery(query) {
  const out = new URLSearchParams();
  for (const [key, value] of query) {
    if (!key.startsWith("tex.") && !key.startsWith("cmp.")) {
      out.append(key, value);
    }
  }
  return out;
}
async function decodeIllustration(query, opts = {}) {
  const data = await decodeUrlParams(stlnQuery(query));
  return illustrationSvg(data, {
    ignoreBg: opts.ignoreBg ?? false
  });
}
function withExplicitSize(svg, w, h) {
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open) return svg;
  const tag = open[0].replace(/\s+\bwidth="[^"]*"/, "").replace(/\s+\bheight="[^"]*"/, "").replace(/<svg\b/, `<svg width="${w}" height="${h}"`);
  return svg.slice(0, open.index) + tag + svg.slice(open.index + open[0].length);
}
function coverRect(srcW, srcH, bw, bh) {
  const scale = Math.max(bw / srcW, bh / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return {
    dx: (bw - dw) / 2,
    dy: (bh - dh) / 2,
    dw,
    dh
  };
}
var CMP_ORDER_TOP_TEXTURE = "tex-over-art";
var CMP_ORDER_TOP_ART = "art-over-tex";
var CMP_ORDERS = [
  CMP_ORDER_TOP_TEXTURE,
  CMP_ORDER_TOP_ART
];
var CMP_BLENDS = [
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
  "luminosity"
];
var DEFAULT_CMP = {
  order: CMP_ORDER_TOP_TEXTURE,
  mode: "multiply",
  opacity: 1,
  ignoreBg: false
};
function parseCmpSettings(query) {
  const orderRaw = query.get("cmp.order");
  const order = orderRaw === CMP_ORDER_TOP_ART ? CMP_ORDER_TOP_ART : CMP_ORDER_TOP_TEXTURE;
  const modeRaw = query.get("cmp.mode");
  const mode = CMP_BLENDS.includes(modeRaw ?? "") ? modeRaw : DEFAULT_CMP.mode;
  const opacityRaw = query.get("cmp.opacity");
  const opacityNum = opacityRaw === null || opacityRaw.trim() === "" ? NaN : Number(opacityRaw);
  const opacity = Number.isFinite(opacityNum) ? Math.min(1, Math.max(0, opacityNum)) : DEFAULT_CMP.opacity;
  return {
    order,
    mode,
    opacity,
    ignoreBg: query.get("cmp.ignoreBg") === "1"
  };
}
function withoutBackgroundGroup(data) {
  const linesData = new Map(data.linesData);
  linesData.delete(0);
  return {
    ...data,
    linesData
  };
}
function illustrationSvg(data, opts) {
  const kept = opts.ignoreBg ? withoutBackgroundGroup(data) : data;
  return {
    svg: generateSvg(kept, {
      pathMode: STLN_PATH_MODE
    }),
    viewBox: data.sizeData.viewbox,
    width: data.sizeData.width,
    height: data.sizeData.height
  };
}
function paintLayers(ctx, bottom, top, cmp2, bw, bh) {
  ctx.clearRect(0, 0, bw, bh);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const b = coverRect(bottom.width, bottom.height, bw, bh);
  ctx.drawImage(bottom.img, b.dx, b.dy, b.dw, b.dh);
  ctx.globalCompositeOperation = cmp2.mode;
  ctx.globalAlpha = cmp2.opacity;
  const t = coverRect(top.width, top.height, bw, bh);
  ctx.drawImage(top.img, t.dx, t.dy, t.dw, t.dh);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
var DEFAULT_RASTER = {
  w: 1024,
  h: 1024,
  dpr: 2
};
function parseRasterSettings(query) {
  const dim = (key, fallback) => {
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
    dpr: Number.isFinite(dprNum) ? Math.min(4, Math.max(1, dprNum)) : DEFAULT_RASTER.dpr
  };
}
function bitmapSize(r) {
  return {
    bw: Math.round(r.w * r.dpr),
    bh: Math.round(r.h * r.dpr)
  };
}
var CMP_KEY_ORDER = [
  "cmp.order",
  "cmp.mode",
  "cmp.opacity",
  "cmp.ignoreBg",
  "cmp.w",
  "cmp.h",
  "cmp.dpr"
];
function encodeCmpSettings(cmp2, raster2) {
  const params = new URLSearchParams();
  if (cmp2.order !== DEFAULT_CMP.order) params.set("cmp.order", cmp2.order);
  if (cmp2.mode !== DEFAULT_CMP.mode) params.set("cmp.mode", cmp2.mode);
  if (cmp2.opacity !== DEFAULT_CMP.opacity) {
    params.set("cmp.opacity", String(cmp2.opacity));
  }
  if (cmp2.ignoreBg) params.set("cmp.ignoreBg", "1");
  if (raster2.w !== DEFAULT_RASTER.w) params.set("cmp.w", String(raster2.w));
  if (raster2.h !== DEFAULT_RASTER.h) params.set("cmp.h", String(raster2.h));
  if (raster2.dpr !== DEFAULT_RASTER.dpr) {
    params.set("cmp.dpr", String(raster2.dpr));
  }
  const ordered = new URLSearchParams();
  for (const key of CMP_KEY_ORDER) {
    const v = params.get(key);
    if (v !== null) ordered.set(key, v);
  }
  return ordered;
}
function texQuery(query) {
  const out = new URLSearchParams();
  for (const [key, value] of query) {
    if (key.startsWith("tex.")) out.append(key, value);
  }
  return out;
}
function buildShareQuery(current, cmpParams) {
  const out = new URLSearchParams();
  for (const [key, value] of current) {
    if (!key.startsWith("tex.") && !key.startsWith("cmp.")) {
      out.append(key, value);
    }
  }
  for (const [key, value] of texQuery(current)) out.append(key, value);
  for (const [key, value] of cmpParams) out.append(key, value);
  return out;
}

// src/stln/main.ts
var lang = "en";
var UI = {
  pageTitle: {
    en: "Paper Grain Lab \u2014 Straightlines Composite",
    ja: "Paper Grain Lab \u2014 Straightlines \u5408\u6210"
  },
  backLink: {
    en: "\u2190 Pure texture lab",
    ja: "\u2190 \u30C6\u30AF\u30B9\u30C1\u30E3\u5358\u4F53\u30E9\u30DC"
  },
  statusTitle: {
    en: "Status",
    ja: "\u72B6\u614B"
  },
  previewTitle: {
    en: "Composite preview",
    ja: "\u5408\u6210\u30D7\u30EC\u30D3\u30E5\u30FC"
  },
  previewNote: {
    en: "Texture composited on top by default (multiply). Change it below.",
    ja: "\u65E2\u5B9A\u3067\u306F\u30C6\u30AF\u30B9\u30C1\u30E3\u3092\u4E0A\u304B\u3089\u5408\u6210\u3057\u307E\u3059\uFF08multiply\uFF09\u3002\u4EE5\u4E0B\u3067\u5909\u66F4\u3067\u304D\u307E\u3059\u3002"
  },
  settingsTitle: {
    en: "Composite settings",
    ja: "\u5408\u6210\u8A2D\u5B9A"
  },
  settingsNote: {
    en: "Order, mode, opacity, and background apply immediately.",
    ja: "\u9806\u5E8F\u30FB\u30E2\u30FC\u30C9\u30FB\u4E0D\u900F\u660E\u5EA6\u30FB\u80CC\u666F\u306F\u5373\u6642\u53CD\u6620\u3055\u308C\u307E\u3059\u3002"
  },
  orderLabel: {
    en: "Layer order",
    ja: "\u91CD\u306D\u9806"
  },
  orderTexOverArt: {
    en: "Texture on top (paper grain over art)",
    ja: "\u30C6\u30AF\u30B9\u30C1\u30E3\u3092\u4E0A\uFF08\u753B\u306B\u7D19\u76EE\u3092\u91CD\u306D\u308B\uFF09"
  },
  orderArtOverTex: {
    en: "Art on top",
    ja: "\u753B\u3092\u4E0A"
  },
  modeLabel: {
    en: "Blend mode (top layer)",
    ja: "\u5408\u6210\u30E2\u30FC\u30C9\uFF08\u4E0A\u306E\u5C64\uFF09"
  },
  opacityLabel: {
    en: "Top layer opacity",
    ja: "\u4E0A\u306E\u5C64\u306E\u4E0D\u900F\u660E\u5EA6"
  },
  ignoreBgLabel: {
    en: "Ignore illustration background (layer 0)",
    ja: "\u30A4\u30E9\u30B9\u30C8\u306E\u80CC\u666F\u3092\u7121\u8996\u3059\u308B\uFF08layer 0\uFF09"
  },
  rasterWLabel: {
    en: "Output width (px)",
    ja: "\u51FA\u529B\u5E45\uFF08px\uFF09"
  },
  rasterHLabel: {
    en: "Output height (px)",
    ja: "\u51FA\u529B\u9AD8\u3055\uFF08px\uFF09"
  },
  rasterDprLabel: {
    en: "Pixel ratio",
    ja: "\u30D4\u30AF\u30BB\u30EB\u6BD4"
  },
  exportBtn: {
    en: "Download PNG",
    ja: "PNG\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9"
  },
  exportFailed: {
    en: "PNG export failed.",
    ja: "PNG \u306E\u66F8\u304D\u51FA\u3057\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002"
  },
  shareTitle: {
    en: "Share",
    ja: "\u5171\u6709"
  },
  shareNote: {
    en: "Copy a URL that reproduces this composite (illustration + texture + settings).",
    ja: "\u3053\u306E\u5408\u6210\u3092\u518D\u73FE\u3059\u308B URL\uFF08\u30A4\u30E9\u30B9\u30C8\uFF0B\u30C6\u30AF\u30B9\u30C1\u30E3\uFF0B\u8A2D\u5B9A\uFF09\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3059\u3002"
  },
  shareLinkBtn: {
    en: "Copy link",
    ja: "\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC"
  },
  copySuccess: {
    en: "Copied",
    ja: "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F"
  },
  copyFailed: {
    en: "Copy failed",
    ja: "\u30B3\u30D4\u30FC\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F"
  },
  footerNote: {
    en: "Composite lab: paper texture over Straightlines illustration via Canvas.",
    ja: "\u5408\u6210\u30E9\u30DC: \u7D19\u30C6\u30AF\u30B9\u30C1\u30E3\u3092 Straightlines \u30A4\u30E9\u30B9\u30C8\u306B Canvas \u5408\u6210\u3057\u307E\u3059\u3002"
  },
  illustrationFound: {
    en: "Illustration parameters detected.",
    ja: "\u30A4\u30E9\u30B9\u30C8\u306E\u30D1\u30E9\u30E1\u30FC\u30BF\u3092\u691C\u51FA\u3057\u307E\u3057\u305F\u3002"
  },
  illustrationMissing: {
    en: "No illustration parameters \u2014 add a Straightlines share query to preview compositing.",
    ja: "\u30A4\u30E9\u30B9\u30C8\u306E\u30D1\u30E9\u30E1\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093 \u2014 \u5408\u6210\u30D7\u30EC\u30D3\u30E5\u30FC\u306B\u306F Straightlines \u306E\u5171\u6709\u30AF\u30A8\u30EA\u3092\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
  }
};
function T(pair) {
  return pair[lang];
}
function stlnParamsPresent(query) {
  return query.has("bits");
}
function textureSummary(query) {
  const st = decodeTextureToState(query);
  const stages = [
    st.weave.enabled ? "weave" : null,
    st.pulp.enabled ? "pulp" : null,
    st.distort.enabled ? "distort" : null
  ].filter((s) => s !== null);
  const lines = generateSVG(deepClone(st)).split("\n").length;
  const active = stages.length > 0 ? stages.join(", ") : "base only";
  return {
    en: `Texture: light ${st.light.mode}, tint ${st.tint.mode}, stages [${active}], canvas ${st.canvas.size}px, ${lines} SVG lines.`,
    ja: `\u30C6\u30AF\u30B9\u30C1\u30E3: \u30E9\u30A4\u30C8 ${st.light.mode}\u3001\u7740\u8272 ${st.tint.mode}\u3001\u30B9\u30C6\u30FC\u30B8 [${active}]\u3001\u30AD\u30E3\u30F3\u30D0\u30B9 ${st.canvas.size}px\u3001SVG ${lines} \u884C\u3002`
  };
}
function applyI18n() {
  document.documentElement.lang = lang;
  document.title = T(UI.pageTitle);
  const set = (selector, text) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = text;
    });
  };
  set("[data-i18n-status-title]", T(UI.statusTitle));
  set("[data-i18n-preview-title]", T(UI.previewTitle));
  set("[data-i18n-preview-note]", T(UI.previewNote));
  set("[data-i18n-settings-title]", T(UI.settingsTitle));
  set("[data-i18n-settings-note]", T(UI.settingsNote));
  set("[data-i18n-share-title]", T(UI.shareTitle));
  set("[data-i18n-share-note]", T(UI.shareNote));
  const back = document.getElementById("backLink");
  if (back) back.textContent = T(UI.backLink);
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) exportBtn.textContent = T(UI.exportBtn);
  const footer = document.getElementById("footerNote");
  if (footer) footer.textContent = T(UI.footerNote);
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
}
function renderStatus(query) {
  const box = document.getElementById("stlnStatus");
  if (!box) return;
  box.innerHTML = "";
  const illustration = document.createElement("p");
  illustration.textContent = stlnParamsPresent(query) ? T(UI.illustrationFound) : T(UI.illustrationMissing);
  const texture = document.createElement("p");
  texture.textContent = T(textureSummary(query));
  box.appendChild(illustration);
  box.appendChild(texture);
}
var paintGen = 0;
var cmp = {
  ...DEFAULT_CMP
};
var raster = {
  ...DEFAULT_RASTER
};
function showError(message, detail) {
  const box = document.getElementById("stlnError");
  if (!box) return;
  box.textContent = detail ? `${T(message)}
${detail}` : T(message);
  box.hidden = false;
}
function hideError() {
  const box = document.getElementById("stlnError");
  if (!box) return;
  box.textContent = "";
  box.hidden = true;
}
function loadImage(svg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([
      svg
    ], {
      type: "image/svg+xml"
    }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("illustration failed to rasterize"));
    };
    img.src = url;
  });
}
var RASTERIZE_FAILED = {
  en: "Could not render the composite (invalid parameters or rasterization failure).",
  ja: "\u5408\u6210\u3092\u63CF\u753B\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08\u30D1\u30E9\u30E1\u30FC\u30BF\u4E0D\u6B63\u307E\u305F\u306F\u30E9\u30B9\u30BF\u30E9\u30A4\u30BA\u5931\u6557\uFF09\u3002"
};
async function paintComposite(query) {
  const canvas = document.getElementById("stlnCanvas");
  if (!canvas) return;
  const gen = ++paintGen;
  const settings = {
    ...cmp
  };
  const rasterSnapshot = {
    ...raster
  };
  hideError();
  if (!stlnParamsPresent(query)) {
    canvas.hidden = true;
    return;
  }
  try {
    const [art, texSvg] = await Promise.all([
      decodeIllustration(query, {
        ignoreBg: settings.ignoreBg
      }),
      Promise.resolve(decodeTextureToSvg(query))
    ]);
    if (gen !== paintGen) return;
    const { bw, bh } = bitmapSize(rasterSnapshot);
    const [artImg, texImg] = await Promise.all([
      loadImage(withExplicitSize(art.svg, bw, bh)),
      loadImage(withExplicitSize(texSvg, bw, bh))
    ]);
    if (gen !== paintGen) return;
    canvas.width = bw;
    canvas.height = bh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    const artLayer = {
      img: artImg,
      width: art.width,
      height: art.height
    };
    const texSize = textureBitmapSize(query);
    const texLayer = {
      img: texImg,
      width: texSize,
      height: texSize
    };
    if (settings.order === "tex-over-art") {
      paintLayers(ctx, artLayer, texLayer, settings, bw, bh);
    } else {
      paintLayers(ctx, texLayer, artLayer, settings, bw, bh);
    }
    canvas.hidden = false;
  } catch (err) {
    if (gen !== paintGen) return;
    canvas.hidden = true;
    showError(RASTERIZE_FAILED, err instanceof Error ? err.message : String(err));
  }
}
function textureBitmapSize(query) {
  const raw = query.get("tex.sv1.viewBox");
  return (raw !== null ? parseViewBox(raw) : null) ?? DEFAULTS.canvas.size;
}
function repaint() {
  paintComposite(new URLSearchParams(location.search));
}
function labeledRow(label) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  wrap.appendChild(labelEl);
  return {
    wrap,
    labelEl
  };
}
function buildCmpControls() {
  const box = document.getElementById("cmpControls");
  if (!box) return;
  box.innerHTML = "";
  const order = labeledRow(T(UI.orderLabel));
  const orderSel = document.createElement("select");
  for (const value of CMP_ORDERS) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value === "tex-over-art" ? T(UI.orderTexOverArt) : T(UI.orderArtOverTex);
    orderSel.appendChild(opt);
  }
  orderSel.value = cmp.order;
  orderSel.addEventListener("change", () => {
    cmp.order = orderSel.value === "art-over-tex" ? "art-over-tex" : "tex-over-art";
    repaint();
  });
  order.wrap.appendChild(orderSel);
  box.appendChild(order.wrap);
  const mode = labeledRow(T(UI.modeLabel));
  const modeSel = document.createElement("select");
  for (const value of CMP_BLENDS) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    modeSel.appendChild(opt);
  }
  modeSel.value = cmp.mode;
  modeSel.addEventListener("change", () => {
    cmp.mode = CMP_BLENDS.includes(modeSel.value) ? modeSel.value : DEFAULT_CMP.mode;
    repaint();
  });
  mode.wrap.appendChild(modeSel);
  box.appendChild(mode.wrap);
  const opacity = labeledRow(`${T(UI.opacityLabel)} (${cmp.opacity.toFixed(2)})`);
  const opacityRange = document.createElement("input");
  opacityRange.type = "range";
  opacityRange.min = "0";
  opacityRange.max = "1";
  opacityRange.step = "0.05";
  opacityRange.value = String(cmp.opacity);
  opacityRange.addEventListener("input", () => {
    const v = Number(opacityRange.value);
    cmp.opacity = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_CMP.opacity;
    opacity.labelEl.textContent = `${T(UI.opacityLabel)} (${cmp.opacity.toFixed(2)})`;
    repaint();
  });
  opacity.wrap.appendChild(opacityRange);
  box.appendChild(opacity.wrap);
  const bgWrap = document.createElement("div");
  bgWrap.className = "field checkline";
  const bgCheck = document.createElement("input");
  bgCheck.type = "checkbox";
  bgCheck.checked = cmp.ignoreBg;
  bgCheck.addEventListener("change", () => {
    cmp.ignoreBg = bgCheck.checked;
    repaint();
  });
  const bgLabel = document.createElement("label");
  bgLabel.textContent = T(UI.ignoreBgLabel);
  bgWrap.appendChild(bgCheck);
  bgWrap.appendChild(bgLabel);
  box.appendChild(bgWrap);
}
function rasterNumberRow(box, label, key, min, max, step) {
  const row = labeledRow(`${label} (${raster[key]})`);
  const input = document.createElement("input");
  input.type = "number";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = String(raster[key]);
  input.addEventListener("change", () => {
    const parsed = parseRasterSettings(new URLSearchParams(`${key === "w" ? "cmp.w" : key === "h" ? "cmp.h" : "cmp.dpr"}=${input.value}`));
    raster[key] = parsed[key];
    input.value = String(raster[key]);
    row.labelEl.textContent = `${label} (${raster[key]})`;
    repaint();
  });
  row.wrap.appendChild(input);
  box.appendChild(row.wrap);
}
function buildRasterControls() {
  const box = document.getElementById("rasterControls");
  if (!box) return;
  box.innerHTML = "";
  rasterNumberRow(box, T(UI.rasterWLabel), "w", "64", "4096", "64");
  rasterNumberRow(box, T(UI.rasterHLabel), "h", "64", "4096", "64");
  rasterNumberRow(box, T(UI.rasterDprLabel), "dpr", "1", "4", "0.5");
}
function exportPNG() {
  const canvas = document.getElementById("stlnCanvas");
  if (!canvas || canvas.hidden) return;
  canvas.toBlob((blob) => {
    if (!blob) {
      showError(UI.exportFailed);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paper-grain-composite.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }, "image/png");
}
function shareURL() {
  const query = buildShareQuery(new URLSearchParams(location.search), encodeCmpSettings(cmp, raster));
  const base = `${location.origin}${location.pathname}`;
  const str = query.toString();
  return str ? `${base}?${str}` : base;
}
function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
function buildShareRow() {
  const box = document.getElementById("shareRow");
  if (!box) return;
  box.innerHTML = "";
  const btn = document.createElement("button");
  btn.textContent = T(UI.shareLinkBtn);
  btn.addEventListener("click", () => {
    copyText(shareURL()).then((ok) => {
      const old = btn.textContent;
      btn.textContent = ok ? T(UI.copySuccess) : T(UI.copyFailed);
      setTimeout(() => {
        btn.textContent = T(UI.shareLinkBtn);
      }, 1400);
      void old;
    });
  });
  box.appendChild(btn);
}
function init() {
  applyI18n();
  const query = new URLSearchParams(location.search);
  cmp = parseCmpSettings(query);
  raster = parseRasterSettings(query);
  renderStatus(query);
  buildCmpControls();
  buildRasterControls();
  buildShareRow();
  paintComposite(query);
  document.getElementById("exportBtn")?.addEventListener("click", exportPNG);
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.lang;
      if (next === "en" || next === "ja") {
        lang = next;
        applyI18n();
        renderStatus(new URLSearchParams(location.search));
        buildCmpControls();
        buildRasterControls();
        buildShareRow();
      }
    });
  });
}
init();
