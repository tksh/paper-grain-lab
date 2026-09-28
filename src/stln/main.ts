/* Composite lab entry (/stln/).
 *
 * Phase 1 (this file): page bootstrap + status from the shared texture core.
 * Illustration decoding and canvas compositing land in C2-C5. Bilingual UI
 * (English default). No CDN: third-party modules resolve via deno.jsonc
 * imports and ship through `deno task bundle:stln`.
 * See docs/00-overview.md and docs/30-integration-spec.md.
 */
import { decodeTextureToState } from "../js/tex-codec.js";
import { deepClone, generateSVG } from "../js/texture-core.js";
import {
  coverDest,
  decodeIllustration,
  PREVIEW_SIZE,
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
    en: "Illustration preview. Texture compositing arrives in C3.",
    ja: "イラストのプレビュー。テクスチャ合成は C3 で対応します。",
  },
  settingsTitle: { en: "Composite settings", ja: "合成設定" },
  settingsNote: {
    en: "Order, blend mode, and opacity controls arrive in C3.",
    ja: "順序・合成モード・不透明度の設定は C3 で対応します。",
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

/* ---------- illustration rasterization (C2) ---------- */

let paintGen = 0;

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
    "Could not render the illustration (invalid parameters or rasterization failure).",
  ja:
    "イラストを描画できませんでした（パラメータ不正またはラスタライズ失敗）。",
};

async function paintIllustration(query: URLSearchParams): Promise<void> {
  const canvas = document.getElementById("stlnCanvas") as
    | HTMLCanvasElement
    | null;
  if (!canvas) return;
  const gen = ++paintGen;
  hideError();
  if (!stlnParamsPresent(query)) {
    canvas.hidden = true;
    return;
  }
  try {
    const art = await decodeIllustration(query);
    if (gen !== paintGen) return; // stale generation
    const img = await loadImage(
      withExplicitSize(art.svg, PREVIEW_SIZE, PREVIEW_SIZE),
    );
    if (gen !== paintGen) return; // stale generation
    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    const { dx, dy, dw, dh } = coverDest(art.width, art.height, PREVIEW_SIZE);
    ctx.drawImage(img, dx, dy, dw, dh);
    canvas.hidden = false;
  } catch {
    if (gen !== paintGen) return;
    canvas.hidden = true;
    showError(RASTERIZE_FAILED);
  }
}

function init(): void {
  applyI18n();
  const query = new URLSearchParams(location.search);
  renderStatus(query);
  paintIllustration(query);
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = (btn as HTMLElement).dataset.lang;
      if (next === "en" || next === "ja") {
        lang = next;
        applyI18n();
        renderStatus(new URLSearchParams(location.search));
      }
    });
  });
}

init();
