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
    en: "Canvas compositing arrives in C2. Texture status already works.",
    ja: "\u30AD\u30E3\u30F3\u30D0\u30B9\u5408\u6210\u306F C2 \u3067\u5BFE\u5FDC\u3057\u307E\u3059\u3002\u30C6\u30AF\u30B9\u30C1\u30E3\u306E\u72B6\u614B\u8868\u793A\u306F\u52D5\u4F5C\u3057\u307E\u3059\u3002"
  },
  settingsTitle: {
    en: "Composite settings",
    ja: "\u5408\u6210\u8A2D\u5B9A"
  },
  settingsNote: {
    en: "Order, blend mode, and opacity controls arrive in C3.",
    ja: "\u9806\u5E8F\u30FB\u5408\u6210\u30E2\u30FC\u30C9\u30FB\u4E0D\u900F\u660E\u5EA6\u306E\u8A2D\u5B9A\u306F C3 \u3067\u5BFE\u5FDC\u3057\u307E\u3059\u3002"
  },
  shareTitle: {
    en: "Share",
    ja: "\u5171\u6709"
  },
  shareNote: {
    en: "Combined share links arrive in C5.",
    ja: "\u7D71\u5408\u5171\u6709\u30EA\u30F3\u30AF\u306F C5 \u3067\u5BFE\u5FDC\u3057\u307E\u3059\u3002"
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
function init() {
  applyI18n();
  const query = new URLSearchParams(location.search);
  renderStatus(query);
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.lang;
      if (next === "en" || next === "ja") {
        lang = next;
        applyI18n();
        renderStatus(new URLSearchParams(location.search));
      }
    });
  });
}
init();
