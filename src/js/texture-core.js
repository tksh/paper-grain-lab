/* Shared texture core for paper-grain-lab.
 *
 * Pure functions and data with no DOM dependency. Imported by the pure lab
 * page (src/js/app.js), reused as-is by the composite lab (src/stln/) and by
 * Deno tests. Never fork this logic — fix it here.
 * See docs/00-overview.md and docs/10-texture-url-spec.md.
 */

export function fmt(n) {
  n = Number(n);
  if (Number.isNaN(n)) return "0";
  return parseFloat(n.toFixed(4)).toString();
}

export function noiseBaseFrequency(st) {
  return st.noise.anisotropic
    ? `${fmt(st.noise.freqX)} ${fmt(st.noise.freqY)}`
    : fmt(st.noise.freqX);
}

export function hexToRgb01(hex) {
  hex = (hex || "#000000").replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const num = parseInt(hex, 16) || 0;
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

export function getPath(obj, path) {
  return path.split(".").reduce((o, k) => o[k], obj);
}

export function setPath(obj, path, val) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = val;
}

export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function deepMerge(target, src) {
  for (const k in src) {
    if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
      if (!target[k]) target[k] = {};
      deepMerge(target[k], src[k]);
    } else {
      target[k] = src[k];
    }
  }
  return target;
}

/* ---------- default state ---------- */
export const DEFAULTS = {
  noise: {
    type: "fractalNoise",
    freqX: 0.05,
    freqY: 0.05,
    anisotropic: false,
    octaves: 3,
    seed: 2,
  },
  weave: { enabled: false, blend: "multiply" },
  pulp: {
    enabled: false,
    fiberFreq: 0.08,
    fiberOctaves: 2,
    blur: 1.5,
    fiberAlpha: 0.35,
  },
  distort: { enabled: false, freq: 0.01, octaves: 2, scale: 20 },
  light: {
    mode: "diffuse",
    surfaceScale: 2,
    azimuth: 60,
    elevation: 55,
    specExp: 12,
    color: "#ffffff",
  },
  tint: {
    mode: "none",
    color: "#3a2a18",
    alphaSlope: 1,
    alphaBias: -1.5,
    levels: 5,
    grainAlpha: 0.2,
  },
  composite: { blend: "multiply", finalOpacity: 0.9 },
  base: { fillColor: "#f6f3eb", highlightColor: "#faf8f4" },
  canvas: { size: 300 },
};

/* ---------- SVG generator ---------- */
export function generateSVG(st) {
  const lines = [];
  const L = (ind, s) => lines.push("  ".repeat(ind) + s);
  const size = st.canvas.size;

  L(
    0,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">`,
  );
  L(1, `<defs>`);
  L(2, `<filter id="fp-filter" x="-20%" y="-20%" width="140%" height="140%">`);

  let cur = "noise1";
  const freqA = noiseBaseFrequency(st);
  L(
    3,
    `<feTurbulence type="${st.noise.type}" baseFrequency="${freqA}" numOctaves="${st.noise.octaves}" seed="${st.noise.seed}" result="noise1"/>`,
  );

  if (st.weave.enabled) {
    const freqB = st.noise.anisotropic
      ? `${fmt(st.noise.freqY)} ${fmt(st.noise.freqX)}`
      : fmt(st.noise.freqX);
    L(
      3,
      `<feTurbulence type="${st.noise.type}" baseFrequency="${freqB}" numOctaves="${st.noise.octaves}" seed="${
        st.noise.seed + 1
      }" result="noise2"/>`,
    );
    L(
      3,
      `<feBlend in="noise1" in2="noise2" mode="${st.weave.blend}" result="noiseWeave"/>`,
    );
    cur = "noiseWeave";
  }

  if (st.pulp.enabled) {
    L(
      3,
      `<feTurbulence type="fractalNoise" baseFrequency="${
        fmt(st.pulp.fiberFreq)
      }" numOctaves="${st.pulp.fiberOctaves}" seed="${
        st.noise.seed + 2
      }" result="fiberRaw"/>`,
    );
    L(
      3,
      `<feGaussianBlur in="fiberRaw" stdDeviation="${
        fmt(st.pulp.blur)
      }" result="fiberSoft"/>`,
    );
  }

  if (st.distort.enabled) {
    L(
      3,
      `<feTurbulence type="turbulence" baseFrequency="${
        fmt(st.distort.freq)
      }" numOctaves="${st.distort.octaves}" seed="${
        st.noise.seed + 3
      }" result="dispMap"/>`,
    );
    L(
      3,
      `<feDisplacementMap in="${cur}" in2="dispMap" scale="${st.distort.scale}" xChannelSelector="R" yChannelSelector="G" result="noiseWarp"/>`,
    );
    cur = "noiseWarp";
  }

  if (st.light.mode === "diffuse") {
    L(
      3,
      `<feDiffuseLighting in="${cur}" lighting-color="${st.light.color}" diffuseConstant="1" surfaceScale="${
        fmt(st.light.surfaceScale)
      }" result="lit">`,
    );
    L(
      4,
      `<feDistantLight azimuth="${st.light.azimuth}" elevation="${st.light.elevation}"/>`,
    );
    L(3, `</feDiffuseLighting>`);
    cur = "lit";
  } else if (st.light.mode === "specular") {
    L(
      3,
      `<feSpecularLighting in="${cur}" lighting-color="${st.light.color}" specularConstant="1" specularExponent="${st.light.specExp}" surfaceScale="${
        fmt(st.light.surfaceScale)
      }" result="lit">`,
    );
    L(
      4,
      `<feDistantLight azimuth="${st.light.azimuth}" elevation="${st.light.elevation}"/>`,
    );
    L(3, `</feSpecularLighting>`);
    cur = "lit";
  }

  if (st.tint.mode === "alpha") {
    L(
      3,
      `<feColorMatrix in="${cur}" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${
        fmt(st.tint.grainAlpha)
      } 0" result="colored"/>`,
    );
    cur = "colored";
  } else if (st.tint.mode === "stainMottle") {
    const { r, g, b } = hexToRgb01(st.tint.color);
    const s = fmt(st.tint.alphaSlope), bi = fmt(st.tint.alphaBias);
    L(
      3,
      `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${
        fmt(r)
      }  0 0 0 0 ${fmt(g)}  0 0 0 0 ${
        fmt(b)
      }  ${s} 0 0 0 ${bi}" result="colored"/>`,
    );
    cur = "colored";
  } else if (st.tint.mode === "stainSpots") {
    const { r, g, b } = hexToRgb01(st.tint.color);
    const s = fmt(st.tint.alphaSlope), bi = fmt(st.tint.alphaBias);
    L(
      3,
      `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${
        fmt(r)
      }  0 0 0 0 ${fmt(g)}  0 0 0 0 ${
        fmt(b)
      }  ${s} ${s} ${s} 0 ${bi}" result="colored"/>`,
    );
    cur = "colored";
  } else if (st.tint.mode === "stainHaze") {
    const { r, g, b } = hexToRgb01(st.tint.color);
    L(
      3,
      `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${
        fmt(r)
      }  0 0 0 0 ${fmt(g)}  0 0 0 0 ${fmt(b)}  0 0 0 ${
        fmt(st.tint.grainAlpha)
      } 0" result="colored"/>`,
    );
    cur = "colored";
  } else if (st.tint.mode === "table") {
    const table = Array.from({ length: st.tint.levels }, (_, i) => i % 2).join(
      " ",
    );
    L(3, `<feComponentTransfer in="${cur}" result="colored">`);
    L(4, `<feFuncR type="table" tableValues="${table}"/>`);
    L(4, `<feFuncG type="table" tableValues="${table}"/>`);
    L(4, `<feFuncB type="table" tableValues="${table}"/>`);
    L(3, `</feComponentTransfer>`);
    cur = "colored";
  }

  if (st.pulp.enabled) {
    const a = fmt(st.pulp.fiberAlpha);
    L(
      3,
      `<feColorMatrix in="fiberSoft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${a} 0" result="fiberMask"/>`,
    );
    L(
      3,
      `<feBlend in="${cur}" in2="fiberMask" mode="multiply" result="coloredFiber"/>`,
    );
    cur = "coloredFiber";
  }

  L(
    3,
    `<feBlend in="SourceGraphic" in2="${cur}" mode="${st.composite.blend}"/>`,
  );
  L(2, `</filter>`);
  L(1, `</defs>`);
  L(1, `<rect width="100%" height="100%" fill="${st.base.fillColor}"/>`);
  L(
    1,
    `<rect width="100%" height="100%" fill="${st.base.highlightColor}" filter="url(#fp-filter)" opacity="${
      fmt(st.composite.finalOpacity)
    }"/>`,
  );
  L(0, `</svg>`);
  return lines.join("\n");
}

/* ---------- element color map ---------- */
export const ELEMENT_COLORS = {
  "feTurbulence": "#cfe8da",
  "feBlend": "#e3d6f0",
  "feGaussianBlur": "#f3ddbc",
  "feDisplacementMap": "#f2d1cf",
  "feDiffuseLighting/feSpecularLighting": "#cfe0f2",
  "feSpecularLighting": "#c9eeee",
  "feDistantLight": "#eee6c2",
  "feColorMatrix": "#f0d6e6",
  "feComponentTransfer": "#d8d8f2",
  "feFuncR/feFuncG/feFuncB": "#ecdcc0",
  "rect": "#e2e2e2",
  "svg": "#dfe1e6",
};

export const TOKEN_ORDER = [
  "feTurbulence",
  "feBlend",
  "feGaussianBlur",
  "feDisplacementMap",
  "feDiffuseLighting/feSpecularLighting",
  "feDistantLight",
  "feSpecularLighting",
  "feColorMatrix",
  "feComponentTransfer",
  "feFuncR/feFuncG/feFuncB",
  "rect",
  "svg",
];
