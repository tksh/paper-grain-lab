(function(){
  "use strict";
  const NS = "http://www.w3.org/2000/svg";

  /* ---------- language state ---------- */
  let lang = "ja";
  function T(pair){ return pair[lang]; }

  /* ---------- helpers ---------- */
  function fmt(n){
    n = Number(n);
    if (Number.isNaN(n)) return "0";
    return parseFloat(n.toFixed(4)).toString();
  }
  function hexToRgb01(hex){
    hex = (hex || "#000000").replace("#","");
    if (hex.length === 3) hex = hex.split("").map(c=>c+c).join("");
    const num = parseInt(hex, 16) || 0;
    return { r: ((num>>16)&255)/255, g: ((num>>8)&255)/255, b: (num&255)/255 };
  }
  function getPath(obj, path){ return path.split(".").reduce((o,k)=>o[k], obj); }
  function setPath(obj, path, val){
    const keys = path.split(".");
    let o = obj;
    for (let i=0;i<keys.length-1;i++) o = o[keys[i]];
    o[keys[keys.length-1]] = val;
  }
  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
  function deepMerge(target, src){
    for (const k in src){
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])){
        if (!target[k]) target[k] = {};
        deepMerge(target[k], src[k]);
      } else {
        target[k] = src[k];
      }
    }
    return target;
  }

  /* ---------- UI strings ---------- */
  const UI = {
    pageTitle: {
      ja: "Paper Grain Lab — SVGフィルターによる紙質感シミュレーター",
      en: "Paper Grain Lab — An SVG-Filter Paper Texture Simulator"
    },
    originalsTitle: { ja:"オリジナルプリセット", en:"Original Presets" },
    paramsTitle: { ja:"詳細パラメータ", en:"Detailed Parameters" },
    paramsDesc: {
      ja:"各処理段をここで細かく調整できます。プリセットを読み込んだ直後の状態から、自由に微調整してください。項目名の横のドットはそのカテゴリが使いうるSVGフィルター要素を常に示し、現在オフ・未使用のものは薄く表示されます（閉じていても分かります）。",
      en:`Fine-tune every processing stage here. Start from whatever a preset just loaded, then adjust freely. The dots next to each category name always show which SVG filter elements that category can use — the ones currently off or unused are dimmed — so you can tell at a glance even while the section is collapsed.`
    },
    codeHeadLabel: { ja:"SVGソースコード（実際に描画されている内容そのもの）", en:"SVG Source Code (exactly what's rendered above)" },
    copyBtn: { ja:"コピー", en:"Copy" },
    copySuccess: { ja:"コピーしました", en:"Copied" },
    copyFail: { ja:"コピーできませんでした", en:"Copy failed" },
    loadBtn: { ja:"読み込む", en:"Load" },
    metaBodyOriginal: {
      ja:"パラメータは調整されていません",
      en:`No parameters adjusted`
    },
    additionalAdjustmentsTitle: {
      ja:"追加の調整項目:",
      en:`Additional adjustment parameters:`
    },
    disabledText: {
      ja:"Disabled",
      en:"Disabled"
    },
    footerNote: {
      ja: `参考: [1] <a href="https://codepen.io/ol-ivier/pen/raWowqp" target="_blank" rel="noopener noreferrer">Paper Textures — Pure SVG &amp; CSS</a>（41種のfeTurbulence/feColorMatrix等を使った紙質感コレクション）／ [2] <a href="https://codepen.io/imhalid/pen/WbeEomq" target="_blank" rel="noopener noreferrer">Paper Texture Background</a>（feTurbulence→feDiffuseLighting→feDisplacementMapで「破れた縁」を作る手法）／ [3] <a href="https://codepen.io/mpldesign/pen/DexRwL" target="_blank" rel="noopener noreferrer">Simplified Rough Paper Texture</a>（feTurbulence→feDiffuseLightingのみの最小構成）。本ラボはこれら3手法を「ノイズ生成 → 織り目/繊維の重ね合わせ → 歪み → ライティング → 色付け → 合成」という単一のパイプラインに統合し、CSSを介さず純粋なSVGフィルターだけで表現しています。`,
      en: `References: [1] <a href="https://codepen.io/ol-ivier/pen/raWowqp" target="_blank" rel="noopener noreferrer">Paper Textures — Pure SVG &amp; CSS</a> (a collection of 41 paper textures built with feTurbulence, feColorMatrix, and more) / [2] <a href="https://codepen.io/imhalid/pen/WbeEomq" target="_blank" rel="noopener noreferrer">Paper Texture Background</a> (a "torn edges" technique via feTurbulence → feDiffuseLighting → feDisplacementMap) / [3] <a href="https://codepen.io/mpldesign/pen/DexRwL" target="_blank" rel="noopener noreferrer">Simplified Rough Paper Texture</a> (a minimal feTurbulence → feDiffuseLighting setup). This lab unifies all three techniques into a single pipeline — noise generation → weave/fiber layering → distortion → lighting → tinting → compositing — expressed entirely in pure SVG filters, with no CSS involved.`
    }
  };

  function applyStaticI18n(){
    document.documentElement.lang = lang;
    document.title = T(UI.pageTitle);
    document.querySelectorAll("[data-i18n]").forEach(el=>{
      const key = el.dataset.i18n;
      const val = UI[key];
      if (!val) return;
      if (el.dataset.i18nHtml === "1") el.innerHTML = T(val);
      else el.textContent = T(val);
    });
    document.querySelectorAll(".lang-btn").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  }

  /* ---------- default state ---------- */
  const DEFAULTS = {
    noise: { type:"fractalNoise", freqX:0.05, freqY:0.05, anisotropic:false, octaves:3, seed:2 },
    weave: { enabled:false, blend:"multiply" },
    pulp:  { enabled:false, fiberFreq:0.08, fiberOctaves:2, blur:1.5, fiberAlpha:0.35 },
    distort: { enabled:false, freq:0.01, octaves:2, scale:20 },
    light: { mode:"diffuse", surfaceScale:2, azimuth:60, elevation:55, specExp:12, color:"#ffffff" },
    tint:  { mode:"none", color:"#3a2a18", alphaSlope:1, alphaBias:-1.5, levels:5, grainAlpha:0.2 },
    composite: { blend:"multiply", finalOpacity:0.9 },
    base:  { fillColor:"#f6f3eb", highlightColor:"#faf8f4" },
    canvas: { size:300 }
  };
  let state = deepClone(DEFAULTS);

  /* ---------- SVG generator ---------- */
  function generateSVG(st){
    const lines = [];
    const L = (ind, s) => lines.push("  ".repeat(ind) + s);
    const size = st.canvas.size;

    L(0, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">`);
    L(1, `<defs>`);
    L(2, `<filter id="fp-filter" x="-20%" y="-20%" width="140%" height="140%">`);

    let cur = "noise1";
    const freqA = st.noise.anisotropic ? `${fmt(st.noise.freqX)} ${fmt(st.noise.freqY)}` : fmt(st.noise.freqX);
    L(3, `<feTurbulence type="${st.noise.type}" baseFrequency="${freqA}" numOctaves="${st.noise.octaves}" seed="${st.noise.seed}" result="noise1"/>`);

    if (st.weave.enabled){
      const freqB = st.noise.anisotropic ? `${fmt(st.noise.freqY)} ${fmt(st.noise.freqX)}` : fmt(st.noise.freqX);
      L(3, `<feTurbulence type="${st.noise.type}" baseFrequency="${freqB}" numOctaves="${st.noise.octaves}" seed="${st.noise.seed+1}" result="noise2"/>`);
      L(3, `<feBlend in="noise1" in2="noise2" mode="${st.weave.blend}" result="noiseWeave"/>`);
      cur = "noiseWeave";
    }

    if (st.pulp.enabled){
      L(3, `<feTurbulence type="fractalNoise" baseFrequency="${fmt(st.pulp.fiberFreq)}" numOctaves="${st.pulp.fiberOctaves}" seed="${st.noise.seed+2}" result="fiberRaw"/>`);
      L(3, `<feGaussianBlur in="fiberRaw" stdDeviation="${fmt(st.pulp.blur)}" result="fiberSoft"/>`);
    }

    if (st.distort.enabled){
      L(3, `<feTurbulence type="turbulence" baseFrequency="${fmt(st.distort.freq)}" numOctaves="${st.distort.octaves}" seed="${st.noise.seed+3}" result="dispMap"/>`);
      L(3, `<feDisplacementMap in="${cur}" in2="dispMap" scale="${st.distort.scale}" xChannelSelector="R" yChannelSelector="G" result="noiseWarp"/>`);
      cur = "noiseWarp";
    }

    if (st.light.mode === "diffuse"){
      L(3, `<feDiffuseLighting in="${cur}" lighting-color="${st.light.color}" diffuseConstant="1" surfaceScale="${fmt(st.light.surfaceScale)}" result="lit">`);
      L(4, `<feDistantLight azimuth="${st.light.azimuth}" elevation="${st.light.elevation}"/>`);
      L(3, `</feDiffuseLighting>`);
      cur = "lit";
    } else if (st.light.mode === "specular"){
      L(3, `<feSpecularLighting in="${cur}" lighting-color="${st.light.color}" specularConstant="1" specularExponent="${st.light.specExp}" surfaceScale="${fmt(st.light.surfaceScale)}" result="lit">`);
      L(4, `<feDistantLight azimuth="${st.light.azimuth}" elevation="${st.light.elevation}"/>`);
      L(3, `</feSpecularLighting>`);
      cur = "lit";
    }

    if (st.tint.mode === "alpha"){
      L(3, `<feColorMatrix in="${cur}" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${fmt(st.tint.grainAlpha)} 0" result="colored"/>`);
      cur = "colored";
    } else if (st.tint.mode === "stainMottle"){
      const {r,g,b} = hexToRgb01(st.tint.color);
      const s = fmt(st.tint.alphaSlope), bi = fmt(st.tint.alphaBias);
      L(3, `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${fmt(r)}  0 0 0 0 ${fmt(g)}  0 0 0 0 ${fmt(b)}  ${s} 0 0 0 ${bi}" result="colored"/>`);
      cur = "colored";
    } else if (st.tint.mode === "stainSpots"){
      const {r,g,b} = hexToRgb01(st.tint.color);
      const s = fmt(st.tint.alphaSlope), bi = fmt(st.tint.alphaBias);
      L(3, `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${fmt(r)}  0 0 0 0 ${fmt(g)}  0 0 0 0 ${fmt(b)}  ${s} ${s} ${s} 0 ${bi}" result="colored"/>`);
      cur = "colored";
    } else if (st.tint.mode === "stainHaze"){
      const {r,g,b} = hexToRgb01(st.tint.color);
      L(3, `<feColorMatrix in="${cur}" type="matrix" values="0 0 0 0 ${fmt(r)}  0 0 0 0 ${fmt(g)}  0 0 0 0 ${fmt(b)}  0 0 0 ${fmt(st.tint.grainAlpha)} 0" result="colored"/>`);
      cur = "colored";
    } else if (st.tint.mode === "table"){
      const table = Array.from({length: st.tint.levels}, (_,i)=> i%2).join(" ");
      L(3, `<feComponentTransfer in="${cur}" result="colored">`);
      L(4, `<feFuncR type="table" tableValues="${table}"/>`);
      L(4, `<feFuncG type="table" tableValues="${table}"/>`);
      L(4, `<feFuncB type="table" tableValues="${table}"/>`);
      L(3, `</feComponentTransfer>`);
      cur = "colored";
    }

    if (st.pulp.enabled){
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

  /* ---------- element color map ---------- */
  const ELEMENT_COLORS = {
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
    "svg": "#dfe1e6"
  };

  const TOKEN_ORDER = [
    "feTurbulence","feBlend","feGaussianBlur","feDisplacementMap",
    "feDiffuseLighting/feSpecularLighting","feDistantLight","feSpecularLighting",
    "feColorMatrix","feComponentTransfer","feFuncR/feFuncG/feFuncB",
    "rect","svg"
  ];

  function sectionTokens(key, st){
    const set = new Set();
    switch(key){
      case "noise": set.add("feTurbulence"); break;
      case "weave": if (st.weave.enabled){ set.add("feTurbulence"); set.add("feBlend"); } break;
      case "pulp": if (st.pulp.enabled){ set.add("feTurbulence"); set.add("feGaussianBlur"); set.add("feColorMatrix"); set.add("feBlend"); } break;
      case "distort": if (st.distort.enabled){ set.add("feTurbulence"); set.add("feDisplacementMap"); } break;
      case "light":
        if (st.light.mode === "diffuse"){ set.add("feDiffuseLighting/feSpecularLighting"); set.add("feDistantLight"); }
        else if (st.light.mode === "specular"){ set.add("feDiffuseLighting/feSpecularLighting"); set.add("feDistantLight"); set.add("feSpecularLighting"); }
        break;
      case "tint":
        if (st.tint.mode === "table"){ set.add("feComponentTransfer"); set.add("feFuncR/feFuncG/feFuncB"); }
        else if (st.tint.mode && st.tint.mode !== "none"){ set.add("feColorMatrix"); }
        break;
      case "composite": set.add("feBlend"); set.add("rect"); break;
      case "canvas": set.add("svg"); break;
    }
    return TOKEN_ORDER.filter(t=>set.has(t));
  }

  const STATIC_SECTION_TOKENS = {
    noise: ["feTurbulence"],
    weave: ["feTurbulence","feBlend"],
    pulp: ["feTurbulence","feGaussianBlur","feColorMatrix","feBlend"],
    distort: ["feTurbulence","feDisplacementMap"],
    light: ["feDiffuseLighting/feSpecularLighting","feDistantLight","feSpecularLighting"],
    tint: ["feColorMatrix","feComponentTransfer","feFuncR/feFuncG/feFuncB"],
    composite: ["feBlend","rect"],
    canvas: ["svg"]
  };

  function allTokens(st){
    const set = new Set();
    ["noise","weave","pulp","distort","light","tint","composite","canvas"].forEach(key=>{
      sectionTokens(key, st).forEach(t=>set.add(t));
    });
    return TOKEN_ORDER.filter(t=>set.has(t));
  }

  function dotsHTML(tokens, activeSet){
    return tokens.map(t=>{
      const dim = activeSet && !activeSet.has(t);
      return `<span class="fdot${dim ? " dim" : ""}" style="background:${ELEMENT_COLORS[t]}" title="${t}"></span>`;
    }).join("");
  }

  /* ---------- render ---------- */
  const swatchWrap = document.getElementById("swatchWrap");
  const codeOut = document.getElementById("codeOut");
  let sectionDotEls = {};

  function render(){
    const svgString = generateSVG(state);
    swatchWrap.innerHTML = svgString;
    codeOut.textContent = svgString;
    Object.keys(sectionDotEls).forEach(key=>{
      const active = new Set(sectionTokens(key, state));
      sectionDotEls[key].innerHTML = dotsHTML(STATIC_SECTION_TOKENS[key], active);
    });
  }

  /* ---------- 7 minimum presets (simplified) ---------- */
  const PRESETS = [
    { key:"canson",
      label:{ ja:"1. ラフグレイン", en:"1. Rough Grain" },
      sub:{ ja:"Canson / 基本の紙目（拡散反射のみ）", en:"Canson / basic paper grain (diffuse lighting only)" },
      state:{
        noise:{type:"fractalNoise",freqX:0.05,freqY:0.05,anisotropic:false,octaves:3,seed:2},
        light:{mode:"diffuse",surfaceScale:2,azimuth:60,elevation:50,color:"#ffffff"},
        tint:{mode:"none"}, composite:{blend:"multiply",finalOpacity:0.95},
        base:{fillColor:"#f6f3eb",highlightColor:"#faf8f4"}
      }},
    { key:"watercolor",
      label:{ ja:"2. モットルド・ウォッシュ", en:"2. Mottled Wash" },
      sub:{ ja:"Watercolor / 低周波ノイズ＋強い凹凸", en:"Watercolor / low-frequency noise + strong relief" },
      state:{
        noise:{type:"fractalNoise",freqX:0.03,freqY:0.03,anisotropic:false,octaves:4,seed:11},
        light:{mode:"diffuse",surfaceScale:3.5,azimuth:120,elevation:40,color:"#ffffff"},
        tint:{mode:"none"}, composite:{blend:"multiply",finalOpacity:0.85},
        base:{fillColor:"#fcfaf2",highlightColor:"#f6f3e8"}
      }},
    { key:"tinted",
      label:{ ja:"3. 着色ステイン", en:"3. Tinted Stain" },
      sub:{ ja:"Kraft / 連続ムラ染み（ライティング無し・単一チャンネルの滑らかな濃淡）", en:"Kraft / continuous mottled stain (no lighting — smooth single-channel shading)" },
      state:{
        noise:{type:"fractalNoise",freqX:0.02,freqY:0.02,anisotropic:false,octaves:4,seed:7},
        light:{mode:"none"},
        tint:{mode:"stainMottle",color:"#594026",alphaSlope:1,alphaBias:0},
        composite:{blend:"multiply",finalOpacity:0.4},
        base:{fillColor:"#bc9c74",highlightColor:"#c9ab85"}
      }},
    { key:"velvet",
      label:{ ja:"4. ナップ（起毛）", en:"4. Napped Pile" },
      sub:{ ja:"Velvet / Suede / 微細ノイズ＋低い凹凸", en:"Velvet / Suede / fine noise + shallow relief" },
      state:{
        noise:{type:"fractalNoise",freqX:0.45,freqY:0.45,anisotropic:false,octaves:2,seed:10},
        light:{mode:"diffuse",surfaceScale:0.4,azimuth:90,elevation:75,color:"#ffffff"},
        tint:{mode:"none"}, composite:{blend:"multiply",finalOpacity:0.9},
        base:{fillColor:"#e5e0d8",highlightColor:"#e8e4dc"}
      }},
    { key:"glossy",
      label:{ ja:"5. 光沢／フロスト", en:"5. Gloss / Frost" },
      sub:{ ja:"Tracing / Glassine / 鏡面反射＋screen合成", en:"Tracing / Glassine / specular lighting + screen blend" },
      state:{
        noise:{type:"fractalNoise",freqX:0.015,freqY:0.015,anisotropic:false,octaves:3,seed:17},
        light:{mode:"specular",surfaceScale:0.8,azimuth:225,elevation:65,specExp:20,color:"#ffffff"},
        tint:{mode:"none"}, composite:{blend:"screen",finalOpacity:0.6},
        base:{fillColor:"#f1f3f5",highlightColor:"#f8fafc"}
      }},
    { key:"woven",
      label:{ ja:"6. 織り目繊維", en:"6. Woven Fiber" },
      sub:{ ja:"Linen / Canvas / 直交ノイズの重ね合わせ", en:"Linen / Canvas / crossed-noise overlay" },
      state:{
        noise:{type:"fractalNoise",freqX:0.05,freqY:0.95,anisotropic:true,octaves:2,seed:4},
        weave:{enabled:true,blend:"multiply"},
        light:{mode:"diffuse",surfaceScale:1,azimuth:45,elevation:65,color:"#ffffff"},
        tint:{mode:"none"}, composite:{blend:"multiply",finalOpacity:0.9},
        base:{fillColor:"#f9f6f0",highlightColor:"#f9f6f0"}
      }},
    { key:"pulp",
      label:{ ja:"7. 重層パルプ繊維", en:"7. Layered Pulp Fiber" },
      sub:{ ja:"Rice / Hemp / 微粒ノイズ＋ぼかし繊維層（ライティング無し・淡いアルファ濃淡を二重に重ねる）", en:"Rice / Hemp / fine grain noise + blurred fiber layer (no lighting — two faint alpha-mask layers stacked)" },
      state:{
        noise:{type:"fractalNoise",freqX:0.4,freqY:0.4,anisotropic:false,octaves:3,seed:18},
        pulp:{enabled:true,fiberFreq:0.08,fiberOctaves:2,blur:1.5,fiberAlpha:0.25},
        light:{mode:"none"}, tint:{mode:"alpha",grainAlpha:0.15},
        composite:{blend:"multiply",finalOpacity:1},
        base:{fillColor:"#f2e9dc",highlightColor:"#f2e9dc"}
      }}
  ];

  /* ---------- Original presets ---------- */
  const ORIGINALS = [
    { no:"01", label:{ ja:"キャンソン紙", en:"Canson Paper" }, base:"canson", state:{} },
    { no:"02", label:{ ja:"コットンラグ紙", en:"Cotton Rag Paper" }, base:"canson", state:{
      noise:{freqX:0.08,freqY:0.08,octaves:4,seed:20},
      light:{surfaceScale:0.9,azimuth:240,elevation:60},
      composite:{finalOpacity:0.9},
      base:{fillColor:"#faf9f5",highlightColor:"#fefdfa"}
    }},
    { no:"03", label:{ ja:"吸水ウォーターカラー紙", en:"Absorbent Watercolor Paper" }, base:"watercolor", state:{} },
    { no:"04", label:{ ja:"クラフト紙", en:"Kraft Paper" }, base:"tinted", state:{} },
    { no:"05", label:{ ja:"再生新聞紙", en:"Recycled Newsprint" }, base:"tinted", state:{
      noise:{freqX:0.18,freqY:0.18,octaves:2,seed:5},
      light:{mode:"none"},
      tint:{mode:"stainHaze",color:"#1a1a1a",grainAlpha:0.12},
      composite:{finalOpacity:1},
      base:{fillColor:"#dcdad4",highlightColor:"#e2e0da"}
    }},
    { no:"06", label:{ ja:"マットベルベット紙", en:"Matte Velvet Paper" }, base:"velvet", state:{} },
    { no:"07", label:{ ja:"ピーチスエード紙", en:"Peach Suede Paper" }, base:"velvet", state:{
      noise:{freqX:0.5,freqY:0.5,octaves:3,seed:40},
      light:{surfaceScale:0.3,azimuth:180,elevation:80},
      base:{fillColor:"#dcc8b0",highlightColor:"#e3cfb9"}
    }},
    { no:"08", label:{ ja:"蝋引きパーチメント紙", en:"Waxy Parchment Paper" }, base:"glossy", state:{
      noise:{freqX:0.02,freqY:0.02,octaves:3,seed:31},
      light:{surfaceScale:0.8,specExp:18,azimuth:225,elevation:65},
      composite:{finalOpacity:0.45},
      base:{fillColor:"#ebdcb2",highlightColor:"#f2e9cb"}
    }},
    { no:"09", label:{ ja:"フロステッド・トレーシングペーパー", en:"Frosted Tracing Paper" }, base:"glossy", state:{
      noise:{freqX:0.3,freqY:0.3,octaves:3,seed:13},
      light:{surfaceScale:0.5,specExp:40,azimuth:135,elevation:80},
      composite:{finalOpacity:0.5},
      base:{fillColor:"#eef2f6",highlightColor:"#ffffff"}
    }},
    { no:"10", label:{ ja:"フレーク米紙", en:"Flaky Rice Paper" }, base:"pulp", state:{} },
    { no:"11", label:{ ja:"和紙", en:"Artisan Japanese Washi" }, base:"woven", state:{
      noise:{freqX:0.015,freqY:0.005,anisotropic:true,octaves:4,seed:11},
      weave:{enabled:true,blend:"screen"},
      light:{mode:"none"},
      tint:{mode:"stainSpots",color:"#4d4733",alphaSlope:1,alphaBias:-1.3},
      composite:{blend:"multiply",finalOpacity:0.85},
      base:{fillColor:"#f3efe3",highlightColor:"#faf6ec"}
    }},
    { no:"12", label:{ ja:"樹皮紙", en:"Bark Paper" }, base:"tinted", state:{
      noise:{freqX:0.6,freqY:0.4,anisotropic:true,octaves:3,seed:26},
      light:{mode:"none"},
      tint:{mode:"stainSpots",color:"#332619",alphaSlope:1,alphaBias:-1.1},
      distort:{enabled:true,freq:0.08,octaves:1,scale:25},
      composite:{blend:"multiply",finalOpacity:0.75},
      base:{fillColor:"#d1be9d",highlightColor:"#dccab0"}
    }}
  ];

  /* ---------- parameter form spec ---------- */
  const SECTIONS = [
    { key:"noise",
      title:{ ja:"1. ノイズ生成", en:"1. Noise Generation" },
      desc:{ ja:"紙の繊維構造のもとになるランダムパターン。すべてのプリセットの土台。このカテゴリは feTurbulence 単体を使います。",
             en:"The random pattern underlying the paper's fiber structure — the foundation of every preset. This category uses feTurbulence alone." },
      fields:[
        { bind:"noise.type", label:{ja:"ノイズ種別",en:"Noise type"}, type:"select", options:[
            ["fractalNoise", {ja:"fractalNoise（柔らかい）", en:"fractalNoise (soft)"}],
            ["turbulence", {ja:"turbulence（硬い）", en:"turbulence (harsh)"}]
          ], anno:{ chain:["feTurbulence"], attr:"type" } },
        { bind:"noise.freqX", label:{ja:"周波数 X",en:"Frequency X"}, type:"range", min:0.002, max:0.9, step:0.001, anno:{ chain:["feTurbulence"], attr:"baseFrequency" } },
        { bind:"noise.anisotropic", label:{ja:"X/Yの周波数を独立させる（方向性）",en:"Make X/Y frequency independent (directionality)"}, type:"checkbox" },
        { bind:"noise.freqY", label:{ja:"周波数 Y",en:"Frequency Y"}, type:"range", min:0.002, max:0.9, step:0.001, anno:{ chain:["feTurbulence"], attr:"baseFrequency" } },
        { bind:"noise.octaves", label:{ja:"オクターブ数",en:"Octaves"}, type:"range", min:1, max:8, step:1, anno:{ chain:["feTurbulence"], attr:"numOctaves" } },
        { bind:"noise.seed", label:{ja:"シード",en:"Seed"}, type:"range", min:0, max:100, step:1, anno:{ chain:["feTurbulence"], attr:"seed" } }
      ]},
    { key:"weave",
      title:{ ja:"2. 織り目ブレンド（交差タービュランス）", en:"2. Weave Blend (crossed turbulence)" },
      desc:{ ja:"直交する2つのノイズを重ねて布目・リネン調の方向性を作る（参考[1]の p-lin / p-canevas と同系統の手法）。feTurbulence と feBlend の2要素を使いますが、2本目の feTurbulence は「1. ノイズ生成」の周波数X/Yを入れ替えた値・同じオクターブ数を自動的に再利用する仕様のため（経糸と緯糸は同じ繊維が直交しているだけ、という構造を再現するため）、ここで独立操作できるのは feBlend の合成モードのみです。2本目のノイズ自体を調整したい場合は「1. ノイズ生成」で「X/Yの周波数を独立させる」をONにして周波数X/Yを変更してください。",
             en:`Overlays two perpendicular noise fields to create directional woven/linen-like texture (the same family of technique as Reference [1]'s p-lin / p-canevas). Uses two elements, feTurbulence and feBlend — but the second feTurbulence automatically reuses "1. Noise Generation"'s frequency with X and Y swapped, plus the same octave count (this reproduces the idea that warp and weft are the same fiber, just crossed at a right angle), so the only thing independently adjustable here is feBlend's blend mode. To adjust the second noise field itself, turn on "Make X/Y frequency independent" in "1. Noise Generation" and change the X/Y frequency there.` },
      fields:[
        { bind:"weave.enabled", label:{ja:"有効化",en:"Enable"}, type:"checkbox" },
        { bind:"weave.blend", label:{ja:"合成モード",en:"Blend mode"}, type:"select", options:[
            ["multiply", {ja:"multiply", en:"multiply"}],
            ["overlay", {ja:"overlay", en:"overlay"}],
            ["screen", {ja:"screen", en:"screen"}],
            ["darken", {ja:"darken", en:"darken"}]
          ], anno:{ chain:["feBlend"], attr:"mode" } }
      ]},
    { key:"pulp",
      title:{ ja:"3. パルプ繊維レイヤー（2層ノイズ＋ぼかし）", en:"3. Pulp Fiber Layer (two-layer noise + blur)" },
      desc:{ ja:"細かい紙粉ノイズに、ぼかした太い繊維ノイズを重ねる（米紙・麻紙向け、参考[1]の p-riz の考え方）。feTurbulence / feGaussianBlur / feColorMatrix / feBlend の4要素を使います。",
             en:"Layers a coarser, blurred fiber-noise field over fine paper-dust noise (for rice paper / hemp paper, following the idea behind Reference [1]'s p-riz). Uses four elements: feTurbulence / feGaussianBlur / feColorMatrix / feBlend." },
      fields:[
        { bind:"pulp.enabled", label:{ja:"有効化",en:"Enable"}, type:"checkbox" },
        { bind:"pulp.fiberFreq", label:{ja:"繊維の粗さ",en:"Fiber coarseness"}, type:"range", min:0.01, max:0.5, step:0.005, anno:{ chain:["feTurbulence"], attr:"baseFrequency" } },
        { bind:"pulp.fiberOctaves", label:{ja:"繊維オクターブ",en:"Fiber octaves"}, type:"range", min:1, max:5, step:1, anno:{ chain:["feTurbulence"], attr:"numOctaves" } },
        { bind:"pulp.blur", label:{ja:"ぼかし量",en:"Blur amount"}, type:"range", min:0, max:6, step:0.1, anno:{ chain:["feGaussianBlur"], attr:"stdDeviation" } },
        { bind:"pulp.fiberAlpha", label:{ja:"繊維の濃さ",en:"Fiber density"}, type:"range", min:0, max:1, step:0.05, anno:{ chain:["feColorMatrix"], attr:"values" } }
      ]},
    { key:"distort",
      title:{ ja:"4. 歪み／破れ表現", en:"4. Distortion / Tearing" },
      desc:{ ja:"別のノイズでパターン自体を歪ませる（参考[2]の「torn edges」手法。樹皮紙やデコボコの縁の表現に）。feTurbulence と feDisplacementMap の2要素を使います。",
             en:`Warps the pattern itself using a separate noise field (Reference [2]'s "torn edges" technique — useful for bark paper or ragged, uneven edges). Uses two elements, feTurbulence and feDisplacementMap.` },
      fields:[
        { bind:"distort.enabled", label:{ja:"有効化",en:"Enable"}, type:"checkbox" },
        { bind:"distort.freq", label:{ja:"歪みノイズの周波数",en:"Distortion noise frequency"}, type:"range", min:0.002, max:0.1, step:0.001, anno:{ chain:["feTurbulence"], attr:"baseFrequency" } },
        { bind:"distort.octaves", label:{ja:"歪みオクターブ",en:"Distortion octaves"}, type:"range", min:1, max:5, step:1, anno:{ chain:["feTurbulence"], attr:"numOctaves" } },
        { bind:"distort.scale", label:{ja:"歪み量",en:"Distortion amount"}, type:"range", min:0, max:80, step:1, anno:{ chain:["feDisplacementMap"], attr:"scale" } }
      ]},
    { key:"light",
      title:{ ja:"5. ライティング（凹凸表現）", en:"5. Lighting (surface relief)" },
      desc:{ ja:"ノイズを高さ情報として扱い、仮想光源で陰影をつける（参考[3]の roughpaper 手法そのもの）。feDiffuseLighting / feSpecularLighting とその子要素 feDistantLight を使います。",
             en:"Treats the noise as height data and shades it with a virtual light source (exactly Reference [3]'s rough-paper technique). Uses feDiffuseLighting / feSpecularLighting and their child element feDistantLight." },
      fields:[
        { bind:"light.mode", label:{ja:"モード",en:"Mode"}, type:"select", options:[
            ["diffuse", {ja:"拡散反射（マット）", en:"Diffuse (matte)"}],
            ["specular", {ja:"鏡面反射（光沢）", en:"Specular (glossy)"}],
            ["none", {ja:"なし", en:"None"}]
          ], anno:{ chain:["feDiffuseLighting/feSpecularLighting"], attr:"mode" } },
        { bind:"light.surfaceScale", label:{ja:"凹凸の高さ",en:"Relief height"}, type:"range", min:0.1, max:6, step:0.1, anno:{ chain:["feDiffuseLighting/feSpecularLighting"], attr:"surfaceScale" } },
        { bind:"light.azimuth", label:{ja:"光源の方位角",en:"Light azimuth"}, type:"range", min:0, max:360, step:1, anno:{ chain:["feDiffuseLighting/feSpecularLighting","feDistantLight"], attr:"azimuth" } },
        { bind:"light.elevation", label:{ja:"光源の高度",en:"Light elevation"}, type:"range", min:5, max:90, step:1, anno:{ chain:["feDiffuseLighting/feSpecularLighting","feDistantLight"], attr:"elevation" } },
        { bind:"light.specExp", label:{ja:"光沢の鋭さ（鏡面反射時）",en:"Highlight sharpness (specular only)"}, type:"range", min:1, max:60, step:1, anno:{ chain:["feSpecularLighting"], attr:"specularExponent" } },
        { bind:"light.color", label:{ja:"光の色",en:"Light color"}, type:"color", anno:{ chain:["feDiffuseLighting/feSpecularLighting"], attr:"lighting-color" } }
      ]},
    { key:"tint",
      title:{ ja:"6. 色付け／シミ表現", en:"6. Tinting / Staining" },
      desc:{ ja:"陰影マップに色相を与えたり、しきい値で斑点・繊維の濃淡を作る。feColorMatrix と feComponentTransfer(+feFuncR/G/B) のいずれかを使います。",
             en:"Adds hue to the shading map, or uses a threshold to create spots and fiber-density variation. Uses either feColorMatrix or feComponentTransfer (+feFuncR/G/B)." },
      fields:[
        { bind:"tint.mode", label:{ja:"モード",en:"Mode"}, type:"select", options:[
            ["none", {ja:"なし（グレー階調のまま）", en:"None (stay grayscale)"}],
            ["alpha", {ja:"アルファ濃淡（繊維の粒立ち・米紙系）", en:"Alpha grain (fibrous speckle — rice-paper family)"}],
            ["stainMottle", {ja:"連続ムラ染み（クラフト紙型）", en:"Continuous mottle (Kraft-paper type)"}],
            ["stainSpots", {ja:"斑点・シミ（フォクシング型）", en:"Spots / stains (foxing type)"}],
            ["stainHaze", {ja:"淡い全体ムラ（新聞紙型）", en:"Faint overall haze (newsprint type)"}],
            ["table", {ja:"階調テーブル（粒状感・革目系）", en:"Tone table (grainy — leather-grain family)"}]
          ] },
        { bind:"tint.grainAlpha", label:{ja:"粒／ムラの濃さ（アルファ濃淡・淡いムラモード）",en:"Grain / haze density (alpha & faint-haze modes)"}, type:"range", min:0, max:1, step:0.01, anno:{ chain:["feColorMatrix"], attr:"values" } },
        { bind:"tint.color", label:{ja:"着色",en:"Tint color"}, type:"color", anno:{ chain:["feColorMatrix"], attr:"values" } },
        { bind:"tint.alphaSlope", label:{ja:"ムラ・斑点の出方（傾き）",en:"Mottle/spot response (slope)"}, type:"range", min:-3, max:3, step:0.1, anno:{ chain:["feColorMatrix"], attr:"values" } },
        { bind:"tint.alphaBias", label:{ja:"ムラ・斑点のしきい値",en:"Mottle/spot threshold"}, type:"range", min:-3, max:1, step:0.1, anno:{ chain:["feColorMatrix"], attr:"values" } },
        { bind:"tint.levels", label:{ja:"階調テーブルの段数",en:"Tone-table steps"}, type:"range", min:2, max:9, step:1, anno:{ chain:["feComponentTransfer","feFuncR/feFuncG/feFuncB"], attr:"tableValues" } }
      ]},
    { key:"composite",
      title:{ ja:"7. 合成／台紙の色", en:"7. Compositing / Backing Sheet Color" },
      desc:{ ja:"生成したテクスチャを台紙の色（SourceGraphic）と合成する最終段。feBlend と、台紙となる rect 要素を使います。",
             en:"The final stage: blends the generated texture with the backing sheet's own color (SourceGraphic). Uses feBlend and the rect elements that make up the backing sheet." },
      fields:[
        { bind:"composite.blend", label:{ja:"合成モード",en:"Blend mode"}, type:"select", options:[
            ["multiply", {ja:"multiply", en:"multiply"}],
            ["screen", {ja:"screen", en:"screen"}],
            ["overlay", {ja:"overlay", en:"overlay"}],
            ["normal", {ja:"normal", en:"normal"}],
            ["darken", {ja:"darken", en:"darken"}],
            ["soft-light", {ja:"soft-light", en:"soft-light"}]
          ], anno:{ chain:["feBlend"], attr:"mode" } },
        { bind:"composite.finalOpacity", label:{ja:"テクスチャ層の不透明度",en:"Texture layer opacity"}, type:"range", min:0, max:1, step:0.05, anno:{ chain:["rect"], attr:"opacity" } },
        { bind:"base.fillColor", label:{ja:"台紙の色（下地）",en:"Backing color (base layer)"}, type:"color", anno:{ chain:["rect"], attr:"fill" } },
        { bind:"base.highlightColor", label:{ja:"台紙の色（テクスチャ層）",en:"Backing color (texture layer)"}, type:"color", anno:{ chain:["rect"], attr:"fill" } }
      ]},
    { key:"canvas",
      title:{ ja:"キャンバス", en:"Canvas" },
      desc:{ ja:"プレビューSVGの内部座標サイズ。svg 要素の viewBox を直接操作します。",
             en:"The internal coordinate size of the preview SVG. Directly controls the svg element's viewBox." },
      fields:[
        { bind:"canvas.size", label:{ja:"viewBoxサイズ",en:"viewBox size"}, type:"range", min:120, max:600, step:10, anno:{ chain:["svg"], attr:"viewBox" } }
      ]}
  ];

  function annoHTML(anno){
    if (!anno) return "";
    const parts = [];
    (anno.chain || []).forEach(name=>{
      const color = ELEMENT_COLORS[name] || "#888";
      parts.push(`<span class="badge" style="background:${color}">${name}</span>`);
    });
    parts.push(`<span class="anno-attr">${anno.attr}</span>`);
    return parts.join('<span class="anno-sep">›</span>');
  }

  /* ---------- build param UI ---------- */
  const paramsRail = document.getElementById("paramsRail");
  let sectionOpenState = null;

  function buildParamsUI(){
    if (sectionOpenState === null){
      sectionOpenState = {};
      SECTIONS.forEach((s,i)=>{ sectionOpenState[s.key] = (i===0 || i===4); });
    } else {
      document.querySelectorAll("#paramsRail details.section").forEach(d=>{
        sectionOpenState[d.dataset.key] = d.open;
      });
    }

    paramsRail.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h2>${T(UI.paramsTitle)}</h2><p class="sub">${T(UI.paramsDesc)}</p>`;
    paramsRail.appendChild(card);

    sectionDotEls = {};

    SECTIONS.forEach(section=>{
      const det = document.createElement("details");
      det.className = "section";
      det.dataset.key = section.key;
      det.open = !!sectionOpenState[section.key];
      const summary = document.createElement("summary");
      const titleRow = document.createElement("span");
      titleRow.className = "sec-title-row";
      const titleText = document.createElement("span");
      titleText.textContent = T(section.title);
      const dots = document.createElement("span");
      dots.className = "fdots";
      sectionDotEls[section.key] = dots;
      titleRow.appendChild(titleText);
      titleRow.appendChild(dots);
      summary.appendChild(titleRow);
      det.appendChild(summary);
      const body = document.createElement("div");
      body.className = "body";
      const descEl = document.createElement("p");
      descEl.className = "desc";
      descEl.textContent = T(section.desc);
      body.appendChild(descEl);

      section.fields.forEach(f=>{
        const wrap = document.createElement("div");
        if (f.type === "checkbox"){
          wrap.className = "field checkline";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.dataset.bind = f.bind;
          const label = document.createElement("label");
          label.textContent = T(f.label);
          wrap.appendChild(input);
          wrap.appendChild(label);
        } else {
          wrap.className = "field";
          const label = document.createElement("label");
          const titleRow2 = document.createElement("div");
          titleRow2.className = "ftitle-row";
          const span = document.createElement("span");
          span.textContent = T(f.label);
          const vspan = document.createElement("span");
          vspan.className = "v";
          vspan.dataset.valuefor = f.bind;
          titleRow2.appendChild(span);
          if (f.type === "range") titleRow2.appendChild(vspan);
          label.appendChild(titleRow2);
          if (f.anno){
            const annoRow = document.createElement("div");
            annoRow.className = "fanno-row";
            annoRow.innerHTML = annoHTML(f.anno);
            label.appendChild(annoRow);
          }
          wrap.appendChild(label);

          let input;
          if (f.type === "select"){
            input = document.createElement("select");
            f.options.forEach(([val,labelPair])=>{
              const opt = document.createElement("option");
              opt.value = val; opt.textContent = T(labelPair);
              input.appendChild(opt);
            });
          } else if (f.type === "color"){
            input = document.createElement("input");
            input.type = "color";
          } else {
            input = document.createElement("input");
            input.type = "range";
            input.min = f.min; input.max = f.max; input.step = f.step;
          }
          input.dataset.bind = f.bind;
          wrap.appendChild(input);
        }
        body.appendChild(wrap);
      });

      det.appendChild(body);
      card.appendChild(det);
    });

    bindInputs();
    setControlsFromState();
  }

  function syncDisplay(input){
    if (input.type === "range"){
      const span = document.querySelector(`[data-valuefor="${input.dataset.bind}"]`);
      if (span) span.textContent = input.value;
    }
  }

  function setControlsFromState(){
    document.querySelectorAll("[data-bind]").forEach(input=>{
      const v = getPath(state, input.dataset.bind);
      if (input.type === "checkbox") input.checked = !!v;
      else input.value = v;
      syncDisplay(input);
    });
  }

  function bindInputs(){
    document.querySelectorAll("[data-bind]").forEach(input=>{
      input.addEventListener("input", ()=>{
        const path = input.dataset.bind;
        let val;
        if (input.type === "checkbox") val = input.checked;
        else if (input.type === "range") val = parseFloat(input.value);
        else val = input.value;
        setPath(state, path, val);
        syncDisplay(input);
        refreshMetaPanel(); // Update changed parameters display
        render();
      });
    });
  }

  /* ---------- original list ---------- */
  const originalList = document.getElementById("originalList");
  const metaName = document.getElementById("metaName");
  const metaBody = document.getElementById("metaBody");

  let currentSelection = { type:"original", item:ORIGINALS[0] };
  let initialState = deepClone(state); // Track initial state when preset is loaded

  function getChangedParameters(currentState, initial){
    if (!initial) return [];
    const changes = [];
    
    // Build section number map first
    const sectionNumberMap = {};
    SECTIONS.forEach((section, index) => {
      const titleMatch = section.title.ja.match(/^(\d+)\./);
      sectionNumberMap[section.key] = titleMatch ? parseInt(titleMatch[1]) : index + 1;
    });
    
    // Create a mapping of bind paths to display info
    const paramMap = {};
    const sectionFieldMap = {}; // Map section keys to their fields
    
    SECTIONS.forEach((section, index) => {
      sectionFieldMap[section.key] = section.fields;
      section.fields.forEach(field => {
        if (field.anno) {
          const filterChain = field.anno.chain;
          // Get colors for each filter in the chain
          const filterColors = filterChain.map(filter => ELEMENT_COLORS[filter] || "#888");
          paramMap[field.bind] = {
            filter: filterChain.join(" → "),
            filterColors: filterColors,
            attr: field.anno.attr,
            label: T(field.label),
            sectionKey: section.key,
            sectionNumber: sectionNumberMap[section.key]
          };
        }
      });
    });
    
    // Check for enabled/disabled sections
    const enabledSections = ["weave", "pulp", "distort"];
    // Key attributes to show when section status changes
    const keyAttributes = {
      weave: ["weave.blend"],
      pulp: ["pulp.fiberFreq", "pulp.fiberOctaves", "pulp.blur"],
      distort: ["distort.freq", "distort.octaves", "distort.scale"]
    };
    
    // Track which paths we've already handled via section enable/disable
    const handledPaths = new Set();
    
    enabledSections.forEach(sectionKey => {
      const wasEnabled = getPath(initial, `${sectionKey}.enabled`);
      const isEnabled = getPath(currentState, `${sectionKey}.enabled`);
      
      if (wasEnabled !== isEnabled) {
        // Section enable/disable changed - show key attributes
        const keyAttrs = keyAttributes[sectionKey] || [];
        keyAttrs.forEach(attrPath => {
          const info = paramMap[attrPath];
          if (info) {
            handledPaths.add(attrPath);
            changes.push({
              path: attrPath,
              filter: info.filter,
              filterColors: info.filterColors,
              attr: info.attr,
              label: info.label,
              sectionNumber: info.sectionNumber,
              oldValue: wasEnabled ? getPath(initial, attrPath) : undefined,
              newValue: isEnabled ? getPath(currentState, attrPath) : "Disabled",
              isDisabled: !isEnabled
            });
          }
        });
      }
    });
    
    // Check for mode changes in light and tint sections
    const modeChanges = [
      { path: "light.mode", filter: "feDiffuseLighting/feSpecularLighting", attr: "mode", sectionKey: "light" },
      { path: "tint.mode", filter: "feColorMatrix", attr: "mode", sectionKey: "tint" }
    ];
    
    modeChanges.forEach(({ path, filter, attr, sectionKey }) => {
      const oldMode = getPath(initial, path);
      const newMode = getPath(currentState, path);
      if (oldMode !== newMode) {
        handledPaths.add(path);
        const sectionNumber = sectionNumberMap[sectionKey] || 1;
        
        changes.push({
          path: path,
          filter: filter,
          filterColors: [ELEMENT_COLORS[filter] || "#888"],
          attr: attr,
          label: path,
          sectionNumber: sectionNumber,
          oldValue: oldMode,
          newValue: newMode,
          isDisabled: newMode === "none"
        });
      }
    });
    
    // Compare current state with initial state for other changes
    function compare(obj1, obj2, path){
      for (const key in obj1){
        const currentPath = path ? `${path}.${key}` : key;
        const val1 = obj1[key];
        const val2 = obj2[key];
        
        // Skip enabled fields and already handled paths
        if (currentPath.endsWith(".enabled")) continue;
        if (handledPaths.has(currentPath)) continue;
        
        if (val1 && typeof val1 === "object" && !Array.isArray(val1)){
          if (val2 && typeof val2 === "object" && !Array.isArray(val2)){
            compare(val1, val2, currentPath);
          }
        } else if (val1 !== val2){
          const info = paramMap[currentPath];
          if (info){
            changes.push({
              path: currentPath,
              filter: info.filter,
              filterColors: info.filterColors,
              attr: info.attr,
              label: info.label,
              sectionNumber: info.sectionNumber,
              oldValue: val2,
              newValue: val1
            });
          }
        }
      }
    }
    
    compare(currentState, initial, "");
    
    // Sort changes by section number to match SVG filter pipeline order
    changes.sort((a, b) => {
      const numA = a.sectionNumber || 999;
      const numB = b.sectionNumber || 999;
      return numA - numB;
    });
    
    return changes;
  }

  function refreshMetaPanel(){
    const sel = currentSelection;
    metaName.textContent = T(sel.item.label);
    
    const changes = getChangedParameters(state, initialState);
    if (changes.length === 0){
      metaBody.textContent = T(UI.metaBodyOriginal);
    } else {
      metaBody.innerHTML = "";
      
      // Add heading
      const heading = document.createElement("div");
      heading.className = "change-heading";
      heading.textContent = T(UI.additionalAdjustmentsTitle);
      metaBody.appendChild(heading);
      
      // Add change list
      const changeList = document.createElement("div");
      changeList.className = "change-list";
      
      changes.forEach(change => {
        const item = document.createElement("div");
        item.className = "change-item";
        
        // Create colored badges for each filter in the chain
        const filterNames = change.filter.split(" → ");
        const filterBadges = filterNames.map((filterName, i) => {
          const color = change.filterColors[i] || "#888";
          return `<span class="change-filter-badge" style="background:${color}">${filterName}</span>`;
        }).join('<span class="change-sep">›</span>');
        
        // Use "Disabled" text for disabled sections
        const displayValue = change.isDisabled ? T(UI.disabledText) : change.newValue;
        const valueClass = change.isDisabled ? "change-value-disabled" : "change-value";
        
        item.innerHTML = `
          <span class="change-section-number">${change.sectionNumber}</span>
          <div class="change-filters">${filterBadges}</div>
          <span class="change-attr">${change.attr}</span>
          <span class="${valueClass}">${displayValue}</span>
        `;
        changeList.appendChild(item);
      });
      
      metaBody.appendChild(changeList);
    }
  }

  function loadOriginal(r){
    const basePreset = PRESETS.find(p=>p.key===r.base);
    state = deepClone(DEFAULTS);
    deepMerge(state, basePreset.state);
    deepMerge(state, r.state);
    initialState = deepClone(state); // Save initial state
    currentSelection = { type:"original", item:r };
    setControlsFromState();
    refreshMetaPanel();
    render();
  }

  function buildOriginalRow(container, r){
    const row = document.createElement("div");
    row.className = "recipe-row";
    const basePreset = PRESETS.find(p=>p.key===r.base);
    const resolved = deepMerge(deepMerge(deepClone(DEFAULTS), basePreset.state), r.state);
    const dots = dotsHTML(allTokens(resolved));
    row.innerHTML = `<span class="no">${r.no}</span><span class="name">${T(r.label)}<span class="fdots">${dots}</span></span>`;
    const btn = document.createElement("button");
    btn.textContent = T(UI.loadBtn);
    btn.addEventListener("click", ()=> loadOriginal(r));
    row.appendChild(btn);
    container.appendChild(row);
  }

  function buildOriginalList(){
    originalList.innerHTML = "";
    ORIGINALS.forEach(r=> buildOriginalRow(originalList, r));
  }

  /* ---------- copy button ---------- */
  function fallbackCopy(text){
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.left = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch(e){ ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  document.getElementById("copyBtn").addEventListener("click", ()=>{
    const text = codeOut.textContent;
    const btn = document.getElementById("copyBtn");
    const flash = (label)=>{
      const old = btn.textContent;
      btn.textContent = label;
      setTimeout(()=>{ btn.textContent = T(UI.copyBtn); }, 1400);
      void old;
    };

    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>{
        flash(T(UI.copySuccess));
      }).catch(()=>{
        flash(fallbackCopy(text) ? T(UI.copySuccess) : T(UI.copyFail));
      });
    } else {
      flash(fallbackCopy(text) ? T(UI.copySuccess) : T(UI.copyFail));
    }
  });

  /* ---------- language switch ---------- */
  function setLang(newLang){
    if (newLang === lang) return;
    lang = newLang;
    applyStaticI18n();
    buildOriginalList();
    buildParamsUI();
    refreshMetaPanel();
    render();
  }

  document.querySelectorAll(".lang-btn").forEach(btn=>{
    btn.addEventListener("click", ()=> setLang(btn.dataset.lang));
  });

  /* ---------- init ---------- */
  applyStaticI18n();
  buildOriginalList();
  buildParamsUI();
  // Initialize with first preset but don't set initialState yet
  const firstOriginal = ORIGINALS[0];
  const basePreset = PRESETS.find(p=>p.key===firstOriginal.base);
  state = deepClone(DEFAULTS);
  deepMerge(state, basePreset.state);
  deepMerge(state, firstOriginal.state);
  initialState = deepClone(state); // Set initial state after first load
  currentSelection = { type:"original", item:firstOriginal };
  setControlsFromState();
  refreshMetaPanel();
  render();
})();