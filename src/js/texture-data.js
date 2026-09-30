/* Shared texture data: sections, presets, and originals.
 *
 * Pure data with bilingual UI strings (product content). No DOM, no state.
 * Imported by the pure lab page (src/js/app.js) and the composite lab
 * (src/stln/). The single source of truth — never fork it.
 * See docs/00-overview.md.
 */
import { deepClone, deepMerge, DEFAULTS } from "./texture-core.js";

export const PRESETS = [
  {
    key: "canson",
    label: { ja: "1. ラフグレイン", en: "1. Rough Grain" },
    sub: {
      ja: "Canson / 基本の紙目（拡散反射のみ）",
      en: "Canson / basic paper grain (diffuse lighting only)",
    },
    state: {
      noise: {
        type: "fractalNoise",
        freqX: 0.05,
        freqY: 0.05,
        anisotropic: false,
        octaves: 3,
        seed: 2,
      },
      light: {
        mode: "diffuse",
        surfaceScale: 2,
        azimuth: 60,
        elevation: 50,
        color: "#ffffff",
      },
      tint: { mode: "none" },
      composite: { blend: "multiply", finalOpacity: 0.95 },
      base: { fillColor: "#f6f3eb", highlightColor: "#faf8f4" },
    },
  },
  {
    key: "watercolor",
    label: { ja: "2. モットルド・ウォッシュ", en: "2. Mottled Wash" },
    sub: {
      ja: "Watercolor / 低周波ノイズ＋強い凹凸",
      en: "Watercolor / low-frequency noise + strong relief",
    },
    state: {
      noise: {
        type: "fractalNoise",
        freqX: 0.03,
        freqY: 0.03,
        anisotropic: false,
        octaves: 4,
        seed: 11,
      },
      light: {
        mode: "diffuse",
        surfaceScale: 3.5,
        azimuth: 120,
        elevation: 40,
        color: "#ffffff",
      },
      tint: { mode: "none" },
      composite: { blend: "multiply", finalOpacity: 0.85 },
      base: { fillColor: "#fcfaf2", highlightColor: "#f6f3e8" },
    },
  },
  {
    key: "tinted",
    label: { ja: "3. 着色ステイン", en: "3. Tinted Stain" },
    sub: {
      ja:
        "Kraft / 連続ムラ染み（ライティング無し・単一チャンネルの滑らかな濃淡）",
      en:
        "Kraft / continuous mottled stain (no lighting — smooth single-channel shading)",
    },
    state: {
      noise: {
        type: "fractalNoise",
        freqX: 0.02,
        freqY: 0.02,
        anisotropic: false,
        octaves: 4,
        seed: 7,
      },
      light: { mode: "none" },
      tint: {
        mode: "stainMottle",
        color: "#594026",
        alphaSlope: 1,
        alphaBias: 0,
      },
      composite: { blend: "multiply", finalOpacity: 0.4 },
      base: { fillColor: "#bc9c74", highlightColor: "#c9ab85" },
    },
  },
  {
    key: "velvet",
    label: { ja: "4. ナップ（起毛）", en: "4. Napped Pile" },
    sub: {
      ja: "Velvet / Suede / 微細ノイズ＋低い凹凸",
      en: "Velvet / Suede / fine noise + shallow relief",
    },
    state: {
      noise: {
        type: "fractalNoise",
        freqX: 0.45,
        freqY: 0.45,
        anisotropic: false,
        octaves: 2,
        seed: 10,
      },
      light: {
        mode: "diffuse",
        surfaceScale: 0.4,
        azimuth: 90,
        elevation: 75,
        color: "#ffffff",
      },
      tint: { mode: "none" },
      composite: { blend: "multiply", finalOpacity: 0.9 },
      base: { fillColor: "#e5e0d8", highlightColor: "#e8e4dc" },
    },
  },
  {
    key: "glossy",
    label: { ja: "5. 光沢／フロスト", en: "5. Gloss / Frost" },
    sub: {
      ja: "Tracing / Glassine / 鏡面反射＋screen合成",
      en: "Tracing / Glassine / specular lighting + screen blend",
    },
    state: {
      noise: {
        type: "fractalNoise",
        freqX: 0.015,
        freqY: 0.015,
        anisotropic: false,
        octaves: 3,
        seed: 17,
      },
      light: {
        mode: "specular",
        surfaceScale: 0.8,
        azimuth: 225,
        elevation: 65,
        specExp: 20,
        color: "#ffffff",
      },
      tint: { mode: "none" },
      composite: { blend: "screen", finalOpacity: 0.6 },
      base: { fillColor: "#f1f3f5", highlightColor: "#f8fafc" },
    },
  },
  {
    key: "woven",
    label: { ja: "6. 織り目繊維", en: "6. Woven Fiber" },
    sub: {
      ja: "Linen / Canvas / 直交ノイズの重ね合わせ",
      en: "Linen / Canvas / crossed-noise overlay",
    },
    state: {
      noise: {
        type: "fractalNoise",
        freqX: 0.05,
        freqY: 0.95,
        anisotropic: true,
        octaves: 2,
        seed: 4,
      },
      weave: { enabled: true, blend: "multiply" },
      light: {
        mode: "diffuse",
        surfaceScale: 1,
        azimuth: 45,
        elevation: 65,
        color: "#ffffff",
      },
      tint: { mode: "none" },
      composite: { blend: "multiply", finalOpacity: 0.9 },
      base: { fillColor: "#f9f6f0", highlightColor: "#f9f6f0" },
    },
  },
  {
    key: "pulp",
    label: { ja: "7. 重層パルプ繊維", en: "7. Layered Pulp Fiber" },
    sub: {
      ja:
        "Rice / Hemp / 微粒ノイズ＋ぼかし繊維層（ライティング無し・淡いアルファ濃淡を二重に重ねる）",
      en:
        "Rice / Hemp / fine grain noise + blurred fiber layer (no lighting — two faint alpha-mask layers stacked)",
    },
    state: {
      noise: {
        type: "fractalNoise",
        freqX: 0.4,
        freqY: 0.4,
        anisotropic: false,
        octaves: 3,
        seed: 18,
      },
      pulp: {
        enabled: true,
        fiberFreq: 0.08,
        fiberOctaves: 2,
        blur: 1.5,
        fiberAlpha: 0.25,
      },
      light: { mode: "none" },
      tint: { mode: "alpha", grainAlpha: 0.15 },
      composite: { blend: "multiply", finalOpacity: 1 },
      base: { fillColor: "#f2e9dc", highlightColor: "#f2e9dc" },
    },
  },
];

export const ORIGINALS = [
  {
    no: "01",
    label: { ja: "キャンソン紙", en: "Canson Paper" },
    base: "canson",
    state: {},
  },
  {
    no: "02",
    label: { ja: "コットンラグ紙", en: "Cotton Rag Paper" },
    base: "canson",
    state: {
      noise: { freqX: 0.08, freqY: 0.08, octaves: 4, seed: 20 },
      light: { surfaceScale: 0.9, azimuth: 240, elevation: 60 },
      composite: { finalOpacity: 0.9 },
      base: { fillColor: "#faf9f5", highlightColor: "#fefdfa" },
    },
  },
  {
    no: "03",
    label: { ja: "吸水ウォーターカラー紙", en: "Absorbent Watercolor Paper" },
    base: "watercolor",
    state: {},
  },
  {
    no: "04",
    label: { ja: "クラフト紙", en: "Kraft Paper" },
    base: "tinted",
    state: {},
  },
  {
    no: "05",
    label: { ja: "再生新聞紙", en: "Recycled Newsprint" },
    base: "tinted",
    state: {
      noise: { freqX: 0.18, freqY: 0.18, octaves: 2, seed: 5 },
      light: { mode: "none" },
      tint: { mode: "stainHaze", color: "#1a1a1a", grainAlpha: 0.12 },
      composite: { finalOpacity: 1 },
      base: { fillColor: "#dcdad4", highlightColor: "#e2e0da" },
    },
  },
  {
    no: "06",
    label: { ja: "マットベルベット紙", en: "Matte Velvet Paper" },
    base: "velvet",
    state: {},
  },
  {
    no: "07",
    label: { ja: "ピーチスエード紙", en: "Peach Suede Paper" },
    base: "velvet",
    state: {
      noise: { freqX: 0.5, freqY: 0.5, octaves: 3, seed: 40 },
      light: { surfaceScale: 0.3, azimuth: 180, elevation: 80 },
      base: { fillColor: "#dcc8b0", highlightColor: "#e3cfb9" },
    },
  },
  {
    no: "08",
    label: { ja: "蝋引きパーチメント紙", en: "Waxy Parchment Paper" },
    base: "glossy",
    state: {
      noise: { freqX: 0.02, freqY: 0.02, octaves: 3, seed: 31 },
      light: { surfaceScale: 0.8, specExp: 18, azimuth: 225, elevation: 65 },
      composite: { finalOpacity: 0.45 },
      base: { fillColor: "#ebdcb2", highlightColor: "#f2e9cb" },
    },
  },
  {
    no: "09",
    label: {
      ja: "フロステッド・トレーシングペーパー",
      en: "Frosted Tracing Paper",
    },
    base: "glossy",
    state: {
      noise: { freqX: 0.3, freqY: 0.3, octaves: 3, seed: 13 },
      light: { surfaceScale: 0.5, specExp: 40, azimuth: 135, elevation: 80 },
      composite: { finalOpacity: 0.5 },
      base: { fillColor: "#eef2f6", highlightColor: "#ffffff" },
    },
  },
  {
    no: "10",
    label: { ja: "フレーク米紙", en: "Flaky Rice Paper" },
    base: "pulp",
    state: {},
  },
  {
    no: "11",
    label: { ja: "和紙", en: "Artisan Japanese Washi" },
    base: "woven",
    state: {
      noise: {
        freqX: 0.015,
        freqY: 0.005,
        anisotropic: true,
        octaves: 4,
        seed: 11,
      },
      weave: { enabled: true, blend: "screen" },
      light: { mode: "none" },
      tint: {
        mode: "stainSpots",
        color: "#4d4733",
        alphaSlope: 1,
        alphaBias: -1.3,
      },
      composite: { blend: "multiply", finalOpacity: 0.85 },
      base: { fillColor: "#f3efe3", highlightColor: "#faf6ec" },
    },
  },
  {
    no: "12",
    label: { ja: "樹皮紙", en: "Bark Paper" },
    base: "tinted",
    state: {
      noise: {
        freqX: 0.6,
        freqY: 0.4,
        anisotropic: true,
        octaves: 3,
        seed: 26,
      },
      light: { mode: "none" },
      tint: {
        mode: "stainSpots",
        color: "#332619",
        alphaSlope: 1,
        alphaBias: -1.1,
      },
      distort: { enabled: true, freq: 0.08, octaves: 1, scale: 25 },
      composite: { blend: "multiply", finalOpacity: 0.75 },
      base: { fillColor: "#d1be9d", highlightColor: "#dccab0" },
    },
  },
];

export const SECTIONS = [
  {
    key: "noise",
    title: { ja: "1. ノイズ生成", en: "1. Noise Generation" },
    desc: {
      ja:
        "紙の繊維構造のもとになるランダムパターン。すべてのプリセットの土台。このカテゴリは feTurbulence 単体を使います。",
      en:
        "The random pattern underlying the paper's fiber structure — the foundation of every preset. This category uses feTurbulence alone.",
    },
    fields: [
      {
        bind: "noise.type",
        label: { ja: "ノイズ種別", en: "Noise type" },
        type: "select",
        options: [
          ["fractalNoise", {
            ja: "fractalNoise（柔らかい）",
            en: "fractalNoise (soft)",
          }],
          ["turbulence", {
            ja: "turbulence（硬い）",
            en: "turbulence (harsh)",
          }],
        ],
        anno: { chain: ["feTurbulence"], attr: "type" },
      },
      {
        bind: "noise.freqX",
        label: { ja: "周波数 X", en: "Frequency X" },
        type: "range",
        min: 0.002,
        max: 0.9,
        step: 0.001,
        anno: { chain: ["feTurbulence"], attr: "baseFrequency" },
      },
      {
        bind: "noise.anisotropic",
        label: {
          ja: "X/Yの周波数を独立させる（方向性）",
          en: "Make X/Y frequency independent (directionality)",
        },
        type: "checkbox",
      },
      {
        bind: "noise.freqY",
        label: { ja: "周波数 Y", en: "Frequency Y" },
        type: "range",
        min: 0.002,
        max: 0.9,
        step: 0.001,
        anno: { chain: ["feTurbulence"], attr: "baseFrequency" },
      },
      {
        bind: "noise.octaves",
        label: { ja: "オクターブ数", en: "Octaves" },
        type: "range",
        min: 1,
        max: 8,
        step: 1,
        anno: { chain: ["feTurbulence"], attr: "numOctaves" },
      },
      {
        bind: "noise.seed",
        label: { ja: "シード", en: "Seed" },
        type: "range",
        min: 0,
        max: 100,
        step: 1,
        anno: { chain: ["feTurbulence"], attr: "seed" },
      },
    ],
  },
  {
    key: "weave",
    title: { ja: "2. 織り目ブレンド", en: "2. Weave Blend" },
    desc: {
      ja:
        "直交する2つのノイズを重ねて布目・リネン調の方向性を作る（参考[1]の p-lin / p-canevas と同系統の手法）。feTurbulence と feBlend の2要素を使いますが、2本目の feTurbulence は「1. ノイズ生成」の周波数X/Yを入れ替えた値・同じオクターブ数を自動的に再利用する仕様のため（経糸と緯糸は同じ繊維が直交しているだけ、という構造を再現するため）、ここで独立操作できるのは feBlend の合成モードのみです。2本目のノイズ自体を調整したい場合は「1. ノイズ生成」で「X/Yの周波数を独立させる」をONにして周波数X/Yを変更してください。",
      en:
        `Overlays two perpendicular noise fields to create directional woven/linen-like texture (the same family of technique as Reference [1]'s p-lin / p-canevas). Uses two elements, feTurbulence and feBlend — but the second feTurbulence automatically reuses "1. Noise Generation"'s frequency with X and Y swapped, plus the same octave count (this reproduces the idea that warp and weft are the same fiber, just crossed at a right angle), so the only thing independently adjustable here is feBlend's blend mode. To adjust the second noise field itself, turn on "Make X/Y frequency independent" in "1. Noise Generation" and change the X/Y frequency there.`,
    },
    fields: [
      {
        bind: "weave.enabled",
        label: { ja: "有効化", en: "Enable" },
        type: "checkbox",
      },
      {
        bind: "weave.blend",
        label: { ja: "合成モード", en: "Blend mode" },
        type: "select",
        options: [
          ["multiply", { ja: "multiply", en: "multiply" }],
          ["overlay", { ja: "overlay", en: "overlay" }],
          ["screen", { ja: "screen", en: "screen" }],
          ["darken", { ja: "darken", en: "darken" }],
        ],
        anno: { chain: ["feBlend"], attr: "mode" },
      },
    ],
  },
  {
    key: "pulp",
    title: { ja: "3. パルプ繊維レイヤー", en: "3. Pulp Fiber Layer" },
    desc: {
      ja:
        "細かい紙粉ノイズに、ぼかした太い繊維ノイズを重ねる（米紙・麻紙向け、参考[1]の p-riz の考え方）。feTurbulence / feGaussianBlur / feColorMatrix / feBlend の4要素を使います。",
      en:
        "Layers a coarser, blurred fiber-noise field over fine paper-dust noise (for rice paper / hemp paper, following the idea behind Reference [1]'s p-riz). Uses four elements: feTurbulence / feGaussianBlur / feColorMatrix / feBlend.",
    },
    fields: [
      {
        bind: "pulp.enabled",
        label: { ja: "有効化", en: "Enable" },
        type: "checkbox",
      },
      {
        bind: "pulp.fiberFreq",
        label: { ja: "繊維の粗さ", en: "Fiber coarseness" },
        type: "range",
        min: 0.01,
        max: 0.5,
        step: 0.005,
        anno: { chain: ["feTurbulence"], attr: "baseFrequency" },
      },
      {
        bind: "pulp.fiberOctaves",
        label: { ja: "繊維オクターブ", en: "Fiber octaves" },
        type: "range",
        min: 1,
        max: 5,
        step: 1,
        anno: { chain: ["feTurbulence"], attr: "numOctaves" },
      },
      {
        bind: "pulp.blur",
        label: { ja: "ぼかし量", en: "Blur amount" },
        type: "range",
        min: 0,
        max: 6,
        step: 0.1,
        anno: { chain: ["feGaussianBlur"], attr: "stdDeviation" },
      },
      {
        bind: "pulp.fiberAlpha",
        label: { ja: "繊維の濃さ", en: "Fiber density" },
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        anno: { chain: ["feColorMatrix"], attr: "values" },
      },
    ],
  },
  {
    key: "distort",
    title: { ja: "4. 歪み", en: "4. Distortion" },
    desc: {
      ja:
        "別のノイズでパターン自体を歪ませる（参考[2]の「torn edges」手法。樹皮紙やデコボコの縁の表現に）。feTurbulence と feDisplacementMap の2要素を使います。",
      en:
        `Warps the pattern itself using a separate noise field (Reference [2]'s "torn edges" technique — useful for bark paper or ragged, uneven edges). Uses two elements, feTurbulence and feDisplacementMap.`,
    },
    fields: [
      {
        bind: "distort.enabled",
        label: { ja: "有効化", en: "Enable" },
        type: "checkbox",
      },
      {
        bind: "distort.freq",
        label: { ja: "歪みノイズの周波数", en: "Distortion noise frequency" },
        type: "range",
        min: 0.002,
        max: 0.1,
        step: 0.001,
        anno: { chain: ["feTurbulence"], attr: "baseFrequency" },
      },
      {
        bind: "distort.octaves",
        label: { ja: "歪みオクターブ", en: "Distortion octaves" },
        type: "range",
        min: 1,
        max: 5,
        step: 1,
        anno: { chain: ["feTurbulence"], attr: "numOctaves" },
      },
      {
        bind: "distort.scale",
        label: { ja: "歪み量", en: "Distortion amount" },
        type: "range",
        min: 0,
        max: 80,
        step: 1,
        anno: { chain: ["feDisplacementMap"], attr: "scale" },
      },
    ],
  },
  {
    key: "light",
    title: {
      ja: "5. ライティング（凹凸表現）",
      en: "5. Lighting (Surface Relief)",
    },
    desc: {
      ja:
        "ノイズを高さ情報として扱い、仮想光源で陰影をつける（参考[3]の roughpaper 手法そのもの）。feDiffuseLighting / feSpecularLighting とその子要素 feDistantLight を使います。",
      en:
        "Treats the noise as height data and shades it with a virtual light source (exactly Reference [3]'s rough-paper technique). Uses feDiffuseLighting / feSpecularLighting and their child element feDistantLight.",
    },
    fields: [
      {
        bind: "light.mode",
        label: { ja: "モード", en: "Mode" },
        type: "select",
        options: [
          ["diffuse", { ja: "拡散反射（マット）", en: "Diffuse (matte)" }],
          ["specular", { ja: "鏡面反射（光沢）", en: "Specular (glossy)" }],
          ["none", { ja: "なし", en: "None" }],
        ],
        anno: { chain: ["feDiffuseLighting/feSpecularLighting"], attr: "mode" },
      },
      {
        bind: "light.surfaceScale",
        label: { ja: "凹凸の高さ", en: "Relief height" },
        type: "range",
        min: 0.1,
        max: 6,
        step: 0.1,
        anno: {
          chain: ["feDiffuseLighting/feSpecularLighting"],
          attr: "surfaceScale",
        },
      },
      {
        bind: "light.azimuth",
        label: { ja: "光源の方位角", en: "Light azimuth" },
        type: "range",
        min: 0,
        max: 360,
        step: 1,
        anno: {
          chain: ["feDiffuseLighting/feSpecularLighting", "feDistantLight"],
          attr: "azimuth",
        },
      },
      {
        bind: "light.elevation",
        label: { ja: "光源の高度", en: "Light elevation" },
        type: "range",
        min: 5,
        max: 90,
        step: 1,
        anno: {
          chain: ["feDiffuseLighting/feSpecularLighting", "feDistantLight"],
          attr: "elevation",
        },
      },
      {
        bind: "light.specExp",
        label: {
          ja: "光沢の鋭さ（鏡面反射時）",
          en: "Highlight sharpness (specular only)",
        },
        type: "range",
        min: 1,
        max: 60,
        step: 1,
        anno: { chain: ["feSpecularLighting"], attr: "specularExponent" },
      },
      {
        bind: "light.color",
        label: { ja: "光の色", en: "Light color" },
        type: "color",
        anno: {
          chain: ["feDiffuseLighting/feSpecularLighting"],
          attr: "lighting-color",
        },
      },
    ],
  },
  {
    key: "tint",
    title: { ja: "6. 着色／シミ", en: "6. Tinting / Staining" },
    desc: {
      ja:
        "陰影マップに色相を与えたり、しきい値で斑点・繊維の濃淡を作る。feColorMatrix と feComponentTransfer(+feFuncR/G/B) のいずれかを使います。",
      en:
        "Adds hue to the shading map, or uses a threshold to create spots and fiber-density variation. Uses either feColorMatrix or feComponentTransfer (+feFuncR/G/B).",
    },
    fields: [
      {
        bind: "tint.mode",
        label: { ja: "モード", en: "Mode" },
        type: "select",
        options: [
          ["none", {
            ja: "なし（グレー階調のまま）",
            en: "None (stay grayscale)",
          }],
          ["alpha", {
            ja: "アルファ濃淡（繊維の粒立ち・米紙系）",
            en: "Alpha grain (fibrous speckle — rice-paper family)",
          }],
          ["stainMottle", {
            ja: "連続ムラ染み（クラフト紙型）",
            en: "Continuous mottle (Kraft-paper type)",
          }],
          ["stainSpots", {
            ja: "斑点・シミ（フォクシング型）",
            en: "Spots / stains (foxing type)",
          }],
          ["stainHaze", {
            ja: "淡い全体ムラ（新聞紙型）",
            en: "Faint overall haze (newsprint type)",
          }],
          ["table", {
            ja: "階調テーブル（粒状感・革目系）",
            en: "Tone table (grainy — leather-grain family)",
          }],
        ],
      },
      {
        bind: "tint.grainAlpha",
        label: {
          ja: "粒／ムラの濃さ（アルファ濃淡・淡いムラモード）",
          en: "Grain / haze density (alpha & faint-haze modes)",
        },
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        anno: { chain: ["feColorMatrix"], attr: "values" },
      },
      {
        bind: "tint.color",
        label: { ja: "着色", en: "Tint color" },
        type: "color",
        anno: { chain: ["feColorMatrix"], attr: "values" },
      },
      {
        bind: "tint.alphaSlope",
        label: {
          ja: "ムラ・斑点の出方（傾き）",
          en: "Mottle/spot response (slope)",
        },
        type: "range",
        min: -3,
        max: 3,
        step: 0.1,
        anno: { chain: ["feColorMatrix"], attr: "values" },
      },
      {
        bind: "tint.alphaBias",
        label: { ja: "ムラ・斑点のしきい値", en: "Mottle/spot threshold" },
        type: "range",
        min: -3,
        max: 1,
        step: 0.1,
        anno: { chain: ["feColorMatrix"], attr: "values" },
      },
      {
        bind: "tint.levels",
        label: { ja: "階調テーブルの段数", en: "Tone-table steps" },
        type: "range",
        min: 2,
        max: 9,
        step: 1,
        anno: {
          chain: ["feComponentTransfer", "feFuncR/feFuncG/feFuncB"],
          attr: "tableValues",
        },
      },
    ],
  },
  {
    key: "composite",
    title: {
      ja: "7. 合成／台紙の色",
      en: "7. Compositing / Backing Sheet Color",
    },
    desc: {
      ja:
        "生成したテクスチャを台紙の色（SourceGraphic）と合成する最終段。feBlend と、台紙となる rect 要素を使います。",
      en:
        "The final stage: blends the generated texture with the backing sheet's own color (SourceGraphic). Uses feBlend and the rect elements that make up the backing sheet.",
    },
    fields: [
      {
        bind: "composite.blend",
        label: { ja: "合成モード", en: "Blend mode" },
        type: "select",
        options: [
          ["multiply", { ja: "multiply", en: "multiply" }],
          ["screen", { ja: "screen", en: "screen" }],
          ["overlay", { ja: "overlay", en: "overlay" }],
          ["normal", { ja: "normal", en: "normal" }],
          ["darken", { ja: "darken", en: "darken" }],
          ["soft-light", { ja: "soft-light", en: "soft-light" }],
        ],
        anno: { chain: ["feBlend"], attr: "mode" },
      },
      {
        bind: "composite.finalOpacity",
        label: { ja: "テクスチャ層の不透明度", en: "Texture layer opacity" },
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        anno: { chain: ["rect"], attr: "opacity" },
      },
      {
        bind: "base.fillColor",
        label: { ja: "台紙の色（下地）", en: "Backing color (base layer)" },
        type: "color",
        anno: { chain: ["rect"], attr: "fill" },
      },
      {
        bind: "base.highlightColor",
        label: {
          ja: "台紙の色（テクスチャ層）",
          en: "Backing color (texture layer)",
        },
        type: "color",
        anno: { chain: ["rect"], attr: "fill" },
      },
    ],
  },
  {
    key: "canvas",
    title: { ja: "キャンバス", en: "Canvas" },
    desc: {
      ja:
        "プレビューSVGの内部座標サイズ。svg 要素の viewBox を直接操作します。",
      en:
        "The internal coordinate size of the preview SVG. Directly controls the svg element's viewBox.",
    },
    fields: [
      {
        bind: "canvas.size",
        label: { ja: "viewBoxサイズ", en: "viewBox size" },
        type: "range",
        min: 120,
        max: 600,
        step: 10,
        anno: { chain: ["svg"], attr: "viewBox" },
      },
    ],
  },
];

export function findBasePreset(r) {
  return PRESETS.find((p) => p.key === r.base);
}

/* Fully resolved texture state for an original (defaults + base preset + item). */
export function resolveOriginal(r) {
  return deepMerge(
    deepMerge(deepClone(DEFAULTS), findBasePreset(r).state),
    r.state,
  );
}
