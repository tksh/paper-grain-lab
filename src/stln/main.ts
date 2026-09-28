/* Composite lab entry (/stln/).
 *
 * Phase 1 (this file): page bootstrap + status from the shared texture core.
 * Illustration decoding and canvas compositing land in C2-C5. Bilingual UI
 * (English default). No CDN: third-party modules resolve via deno.jsonc
 * imports and ship through `deno task bundle:stln`.
 * See docs/00-overview.md and docs/30-integration-spec.md.
 */
import {
  decodeTextureToState,
  decodeTextureToSvg,
  parseViewBox,
} from "../js/tex-codec.js";
import { deepClone, DEFAULTS, generateSVG } from "../js/texture-core.js";
import {
  bitmapSize,
  CMP_BLENDS,
  CMP_ORDERS,
  type CompositeSettings,
  decodeIllustration,
  DEFAULT_CMP,
  DEFAULT_RASTER,
  paintLayers,
  parseCmpSettings,
  parseRasterSettings,
  type RasterSettings,
  withExplicitSize,
} from "./composite.ts";

type Lang = "en" | "ja";
type Text = Record<Lang, string>;

let lang: Lang = "en";

const UI: Record<string, Text> = {
  pageTitle: {
    en: "Paper Grain Lab — Straightlines Composite",
    ja: "Paper Grain Lab — Straightlines 合成",
  },
  backLink: {
    en: "← Pure texture lab",
    ja: "← テクスチャ単体ラボ",
  },
  statusTitle: { en: "Status", ja: "状態" },
  previewTitle: { en: "Composite preview", ja: "合成プレビュー" },
  previewNote: {
    en: "Texture composited on top by default (multiply). Change it below.",
    ja:
      "既定ではテクスチャを上から合成します（multiply）。以下で変更できます。",
  },
  settingsTitle: { en: "Composite settings", ja: "合成設定" },
  settingsNote: {
    en: "Order, mode, opacity, and background apply immediately.",
    ja: "順序・モード・不透明度・背景は即時反映されます。",
  },
  orderLabel: { en: "Layer order", ja: "重ね順" },
  orderTexOverArt: {
    en: "Texture on top (paper grain over art)",
    ja: "テクスチャを上（画に紙目を重ねる）",
  },
  orderArtOverTex: { en: "Art on top", ja: "画を上" },
  modeLabel: { en: "Blend mode (top layer)", ja: "合成モード（上の層）" },
  opacityLabel: { en: "Top layer opacity", ja: "上の層の不透明度" },
  ignoreBgLabel: {
    en: "Ignore illustration background (layer 0)",
    ja: "イラストの背景を無視する（layer 0）",
  },
  rasterWLabel: { en: "Output width (px)", ja: "出力幅（px）" },
  rasterHLabel: { en: "Output height (px)", ja: "出力高さ（px）" },
  rasterDprLabel: { en: "Pixel ratio", ja: "ピクセル比" },
  exportBtn: { en: "Download PNG", ja: "PNGをダウンロード" },
  exportFailed: {
    en: "PNG export failed.",
    ja: "PNG の書き出しに失敗しました。",
  },
  shareTitle: { en: "Share", ja: "共有" },
  shareNote: {
    en: "Combined share links arrive in C5.",
    ja: "統合共有リンクは C5 で対応します。",
  },
  footerNote: {
    en:
      "Composite lab: paper texture over Straightlines illustration via Canvas.",
    ja: "合成ラボ: 紙テクスチャを Straightlines イラストに Canvas 合成します。",
  },
  illustrationFound: {
    en: "Illustration parameters detected.",
    ja: "イラストのパラメータを検出しました。",
  },
  illustrationMissing: {
    en:
      "No illustration parameters — add a Straightlines share query to preview compositing.",
    ja:
      "イラストのパラメータがありません — 合成プレビューには Straightlines の共有クエリを追加してください。",
  },
};

function T(pair: Text): string {
  return pair[lang];
}

/* stln-codec requires `bits`, so its presence marks an illustration query.
 * C2 replaces this heuristic with a real decode. */
function stlnParamsPresent(query: URLSearchParams): boolean {
  return query.has("bits");
}

function textureSummary(query: URLSearchParams): Text {
  const st = decodeTextureToState(query);
  const stages = [
    st.weave.enabled ? "weave" : null,
    st.pulp.enabled ? "pulp" : null,
    st.distort.enabled ? "distort" : null,
  ].filter((s): s is string => s !== null);
  const lines = generateSVG(deepClone(st)).split("\n").length;
  const active = stages.length > 0 ? stages.join(", ") : "base only";
  return {
    en: `Texture: light ${st.light.mode}, tint ${st.tint.mode}, ` +
      `stages [${active}], canvas ${st.canvas.size}px, ${lines} SVG lines.`,
    ja: `テクスチャ: ライト ${st.light.mode}、着色 ${st.tint.mode}、` +
      `ステージ [${active}]、キャンバス ${st.canvas.size}px、SVG ${lines} 行。`,
  };
}

function applyI18n(): void {
  document.documentElement.lang = lang;
  document.title = T(UI.pageTitle);
  const set = (selector: string, text: string): void => {
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
    btn.classList.toggle(
      "active",
      (btn as HTMLElement).dataset.lang === lang,
    );
  });
}

function renderStatus(query: URLSearchParams): void {
  const box = document.getElementById("stlnStatus");
  if (!box) return;
  box.innerHTML = "";
  const illustration = document.createElement("p");
  illustration.textContent = stlnParamsPresent(query)
    ? T(UI.illustrationFound)
    : T(UI.illustrationMissing);
  const texture = document.createElement("p");
  texture.textContent = T(textureSummary(query));
  box.appendChild(illustration);
  box.appendChild(texture);
}

/* ---------- canvas composite (C3; raster size arrives in C4) ---------- */

let paintGen = 0;
let cmp: CompositeSettings = { ...DEFAULT_CMP };
let raster: RasterSettings = { ...DEFAULT_RASTER };

function showError(message: Text): void {
  const box = document.getElementById("stlnError");
  if (!box) return;
  box.textContent = T(message);
  box.hidden = false;
}

function hideError(): void {
  const box = document.getElementById("stlnError");
  if (!box) return;
  box.textContent = "";
  box.hidden = true;
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
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

const RASTERIZE_FAILED: Text = {
  en:
    "Could not render the composite (invalid parameters or rasterization failure).",
  ja: "合成を描画できませんでした（パラメータ不正またはラスタライズ失敗）。",
};

async function paintComposite(query: URLSearchParams): Promise<void> {
  const canvas = document.getElementById("stlnCanvas") as
    | HTMLCanvasElement
    | null;
  if (!canvas) return;
  const gen = ++paintGen;
  const settings = { ...cmp };
  const rasterSnapshot = { ...raster };
  hideError();
  if (!stlnParamsPresent(query)) {
    canvas.hidden = true;
    return;
  }
  try {
    const [art, texSvg] = await Promise.all([
      decodeIllustration(query, { ignoreBg: settings.ignoreBg }),
      Promise.resolve(decodeTextureToSvg(query)),
    ]);
    if (gen !== paintGen) return; // stale generation
    const { bw, bh } = bitmapSize(rasterSnapshot);
    const [artImg, texImg] = await Promise.all([
      loadImage(withExplicitSize(art.svg, bw, bh)),
      loadImage(withExplicitSize(texSvg, bw, bh)),
    ]);
    if (gen !== paintGen) return; // stale generation
    canvas.width = bw;
    canvas.height = bh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    const artLayer = { img: artImg, width: art.width, height: art.height };
    // Texture viewBox is always square (tex.sv1); reuse its decoded size.
    const texSize = textureBitmapSize(query);
    const texLayer = { img: texImg, width: texSize, height: texSize };
    if (settings.order === "tex-over-art") {
      paintLayers(ctx, artLayer, texLayer, settings, bw, bh);
    } else {
      paintLayers(ctx, texLayer, artLayer, settings, bw, bh);
    }
    canvas.hidden = false;
  } catch {
    if (gen !== paintGen) return;
    canvas.hidden = true;
    showError(RASTERIZE_FAILED);
  }
}

/* Texture bitmap aspect comes from tex.sv1.viewBox (always square). */
function textureBitmapSize(query: URLSearchParams): number {
  const raw = query.get("tex.sv1.viewBox");
  return (raw !== null ? parseViewBox(raw) : null) ?? DEFAULTS.canvas.size;
}

/* ---------- composite controls (C3) ---------- */

function repaint(): void {
  paintComposite(new URLSearchParams(location.search));
}

function labeledRow(
  label: string,
): { wrap: HTMLElement; labelEl: HTMLLabelElement } {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  wrap.appendChild(labelEl);
  return { wrap, labelEl };
}

function buildCmpControls(): void {
  const box = document.getElementById("cmpControls");
  if (!box) return;
  box.innerHTML = "";

  const order = labeledRow(T(UI.orderLabel));
  const orderSel = document.createElement("select");
  for (const value of CMP_ORDERS) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value === "tex-over-art"
      ? T(UI.orderTexOverArt)
      : T(UI.orderArtOverTex);
    orderSel.appendChild(opt);
  }
  orderSel.value = cmp.order;
  orderSel.addEventListener("change", () => {
    cmp.order = orderSel.value === "art-over-tex"
      ? "art-over-tex"
      : "tex-over-art";
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
    cmp.mode = (CMP_BLENDS as readonly string[]).includes(modeSel.value)
      ? (modeSel.value as typeof cmp.mode)
      : DEFAULT_CMP.mode;
    repaint();
  });
  mode.wrap.appendChild(modeSel);
  box.appendChild(mode.wrap);

  const opacity = labeledRow(
    `${T(UI.opacityLabel)} (${cmp.opacity.toFixed(2)})`,
  );
  const opacityRange = document.createElement("input");
  opacityRange.type = "range";
  opacityRange.min = "0";
  opacityRange.max = "1";
  opacityRange.step = "0.05";
  opacityRange.value = String(cmp.opacity);
  opacityRange.addEventListener("input", () => {
    const v = Number(opacityRange.value);
    cmp.opacity = Number.isFinite(v)
      ? Math.min(1, Math.max(0, v))
      : DEFAULT_CMP.opacity;
    opacity.labelEl.textContent = `${T(UI.opacityLabel)} (${
      cmp.opacity.toFixed(2)
    })`;
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

/* ---------- raster controls and PNG export (C4) ---------- */

function rasterNumberRow(
  box: HTMLElement,
  label: string,
  key: "w" | "h" | "dpr",
  min: string,
  max: string,
  step: string,
): void {
  const row = labeledRow(`${label} (${raster[key]})`);
  const input = document.createElement("input");
  input.type = "number";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = String(raster[key]);
  input.addEventListener("change", () => {
    const parsed = parseRasterSettings(
      new URLSearchParams(
        `${
          key === "w" ? "cmp.w" : key === "h" ? "cmp.h" : "cmp.dpr"
        }=${input.value}`,
      ),
    );
    raster[key] = parsed[key];
    input.value = String(raster[key]);
    row.labelEl.textContent = `${label} (${raster[key]})`;
    repaint();
  });
  row.wrap.appendChild(input);
  box.appendChild(row.wrap);
}

function buildRasterControls(): void {
  const box = document.getElementById("rasterControls");
  if (!box) return;
  box.innerHTML = "";
  rasterNumberRow(box, T(UI.rasterWLabel), "w", "64", "4096", "64");
  rasterNumberRow(box, T(UI.rasterHLabel), "h", "64", "4096", "64");
  rasterNumberRow(box, T(UI.rasterDprLabel), "dpr", "1", "4", "0.5");
}

function exportPNG(): void {
  const canvas = document.getElementById("stlnCanvas") as
    | HTMLCanvasElement
    | null;
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function init(): void {
  applyI18n();
  const query = new URLSearchParams(location.search);
  cmp = parseCmpSettings(query);
  raster = parseRasterSettings(query);
  renderStatus(query);
  buildCmpControls();
  buildRasterControls();
  paintComposite(query);
  document.getElementById("exportBtn")?.addEventListener("click", exportPNG);
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = (btn as HTMLElement).dataset.lang;
      if (next === "en" || next === "ja") {
        lang = next;
        applyI18n();
        renderStatus(new URLSearchParams(location.search));
        buildCmpControls();
        buildRasterControls();
      }
    });
  });
}

init();
