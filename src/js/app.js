/* Shared texture core (imported - reused by /stln/, never forked). */
import {
  DEFAULTS,
  deepClone,
  deepMerge,
  generateSVG,
} from "./texture-core.js";
import { decodeTextureToState, encodeTextureState } from "./tex-codec.js";
import { highlightSVG } from "./highlight.js";
import { ORIGINALS, SECTIONS, findBasePreset, resolveOriginal } from "./texture-data.js";
import {
  STATIC_SECTION_TOKENS,
  bindParamInputs,
  buildOriginalRow as buildOriginalRowEl,
  buildSectionDom,
  changedSectionNumbers,
  dotsHTML,
  getChangedParameters,
  renderChangeList,
  resetSectionState,
  sectionTokens,
  setControlsFromState,
} from "./params-ui.js";

(function(){
  "use strict";

  /* ---------- language state (English is the default) ---------- */
  let lang = "en";
  function T(pair){ return pair[lang]; }

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
    linkBtn: { ja:"リンクをコピー", en:"Copy link" },
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
    resetSectionBtn: {
      ja:"このセクションの変更をプリセットの値に戻す",
      en:"Reset this section's changes back to the preset values"
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

  /* ---------- working state (defaults live in texture-core.js) ---------- */
  let state = deepClone(DEFAULTS);

  /* ---------- SVG generator: imported from texture-core.js ---------- */

  /* ---------- element color map and token order: imported from texture-core.js ---------- */

  /* ---------- section tokens and dots: imported from params-ui.js ---------- */

  /* ---------- sections, presets, originals: imported from texture-data.js ---------- */

  /* ---------- render ---------- */
  const swatchWrap = document.getElementById("swatchWrap");
  const codeOut = document.getElementById("codeOut");
  let sectionDotEls = {};

  function render(){
    const svgString = generateSVG(state);
    swatchWrap.innerHTML = svgString;
    // Highlighted view only: spans carry no text of their own, so the copy
    // path (codeOut.textContent) still yields the exact generator output.
    codeOut.innerHTML = highlightSVG(svgString);
    Object.keys(sectionDotEls).forEach(key=>{
      const active = new Set(sectionTokens(key, state));
      sectionDotEls[key].innerHTML = dotsHTML(STATIC_SECTION_TOKENS[key], active);
    });
  }

  /* ---------- 7 minimum presets (simplified) ---------- */

  /* ---------- Original presets ---------- */

  /* ---------- parameter form spec ---------- */

  /* ---------- annotation badges: rendered by params-ui.js ---------- */

  /* ---------- per-section reset button (icon lives in params-ui.js) ---------- */
  function resetSection(sectionKey){
    resetSectionState(state, initialState, sectionKey);
    setControlsFromState(document, state);
    refreshMetaPanel();
    render();
  }

  function updateSectionResetButtons(changes){
    const nums = changedSectionNumbers(changes);
    document.querySelectorAll("#paramsRail .sec-reset").forEach(btn=>{
      btn.hidden = !nums.has(Number(btn.dataset.sectionNumber));
    });
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
      const det = buildSectionDom(section, {
        T,
        dotsRegistry: sectionDotEls,
        open: !!sectionOpenState[section.key],
        resetTitle: T(UI.resetSectionBtn),
        onReset: resetSection,
      });
      card.appendChild(det);
    });

    bindParamInputs(document, { getState: ()=>state, onChange: ()=>{ refreshMetaPanel(); render(); } });
    setControlsFromState(document, state);
  }

  /* ---------- control sync helpers: imported from params-ui.js ---------- */

  /* ---------- control sync and input binding: imported from params-ui.js ---------- */

  /* ---------- original list ---------- */
  const originalList = document.getElementById("originalList");
  const metaName = document.getElementById("metaName");
  const metaBody = document.getElementById("metaBody");

  let currentSelection = { type:"original", item:ORIGINALS[0] };
  let initialState = deepClone(state); // Track initial state when preset is loaded

  /* ---------- change tracking: imported from params-ui.js ---------- */

  function refreshMetaPanel(){
    const sel = currentSelection;
    const changes = getChangedParameters(state, initialState, SECTIONS, T);
    updateSectionResetButtons(changes); // keep reset icons in sync with the same change data
    renderChangeList(metaName, metaBody, {
      title: T(sel.item.label),
      changes,
      emptyText: T(UI.metaBodyOriginal),
      headingText: T(UI.additionalAdjustmentsTitle),
      disabledText: T(UI.disabledText),
    });
  }

  function loadOriginal(r){
    state = resolveOriginal(r);
    initialState = deepClone(state); // Save initial state
    currentSelection = { type:"original", item:r };
    setControlsFromState(document, state);
    refreshMetaPanel();
    render();
  }

  function buildOriginalList(){
    originalList.innerHTML = "";
    ORIGINALS.forEach((r)=> buildOriginalRowEl(originalList, r, { T, loadLabel: T(UI.loadBtn), onLoad: loadOriginal }));
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
    try { ok = document.execCommand("copy"); } catch{ ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyText(text){
    if (navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text).then(()=>true).catch(()=>fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
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
    copyText(text).then((ok)=>{
      flash(ok ? T(UI.copySuccess) : T(UI.copyFail));
    });
  });

  /* ---------- share link (tex.* round-trip; other namespaces ignored) ---------- */
  function shareURL(){
    const query = encodeTextureState(state).toString();
    const base = `${location.origin}${location.pathname}`;
    return query ? `${base}?${query}` : base;
  }

  function hasTextureParams(){
    try {
      for (const key of new URLSearchParams(location.search).keys()){
        if (key.startsWith("tex.")) return true;
      }
    } catch { /* malformed query string: treat as no params */ }
    return false;
  }

  document.getElementById("linkBtn").addEventListener("click", ()=>{
    const btn = document.getElementById("linkBtn");
    const flash = (label)=>{
      const old = btn.textContent;
      btn.textContent = label;
      setTimeout(()=>{ btn.textContent = T(UI.linkBtn); }, 1400);
      void old;
    };
    copyText(shareURL()).then((ok)=>{
      flash(ok ? T(UI.copySuccess) : T(UI.copyFail));
    });
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
  const basePreset = findBasePreset(firstOriginal);
  state = deepClone(DEFAULTS);
  deepMerge(state, basePreset.state);
  deepMerge(state, firstOriginal.state);
  initialState = deepClone(state); // Set initial state after first load
  if (hasTextureParams()){
    // Shared texture link: restore sliders from tex.* params (bare stln and
    // cmp.* keys are ignored on the pure page) and rebase the tracker on it.
    state = decodeTextureToState(new URLSearchParams(location.search));
    initialState = deepClone(state);
  }
  currentSelection = { type:"original", item:firstOriginal };
  setControlsFromState(document, state);
  refreshMetaPanel();
  render();
})();
