/* Shared parameter-pane machinery for the texture sections.
 *
 * DOM builders and state helpers used by both the pure lab page
 * (src/js/app.js) and the composite lab (src/stln/). Section/preset data
 * comes from texture-data.js; colors and token order from texture-core.js.
 * Page-specific behavior (what happens after a change) is injected through
 * callbacks — this module never assumes which page it runs on.
 * See docs/00-overview.md.
 */
import {
  deepClone,
  ELEMENT_COLORS,
  getPath,
  noiseBaseFrequency,
  setPath,
  TOKEN_ORDER,
} from "./texture-core.js";
import { resolveOriginal } from "./texture-data.js";

export function sectionTokens(key, st) {
  const set = new Set();
  switch (key) {
    case "noise":
      set.add("feTurbulence");
      break;
    case "weave":
      if (st.weave.enabled) {
        set.add("feTurbulence");
        set.add("feBlend");
      }
      break;
    case "pulp":
      if (st.pulp.enabled) {
        set.add("feTurbulence");
        set.add("feGaussianBlur");
        set.add("feColorMatrix");
        set.add("feBlend");
      }
      break;
    case "distort":
      if (st.distort.enabled) {
        set.add("feTurbulence");
        set.add("feDisplacementMap");
      }
      break;
    case "light":
      if (st.light.mode === "diffuse") {
        set.add("feDiffuseLighting/feSpecularLighting");
        set.add("feDistantLight");
      } else if (st.light.mode === "specular") {
        set.add("feDiffuseLighting/feSpecularLighting");
        set.add("feDistantLight");
        set.add("feSpecularLighting");
      }
      break;
    case "tint":
      if (st.tint.mode === "table") {
        set.add("feComponentTransfer");
        set.add("feFuncR/feFuncG/feFuncB");
      } else if (st.tint.mode && st.tint.mode !== "none") {
        set.add("feColorMatrix");
      }
      break;
    case "composite":
      set.add("feBlend");
      set.add("rect");
      break;
    case "canvas":
      set.add("svg");
      break;
  }
  return TOKEN_ORDER.filter((t) => set.has(t));
}

export const STATIC_SECTION_TOKENS = {
  noise: ["feTurbulence"],
  weave: ["feTurbulence", "feBlend"],
  pulp: ["feTurbulence", "feGaussianBlur", "feColorMatrix", "feBlend"],
  distort: ["feTurbulence", "feDisplacementMap"],
  light: [
    "feDiffuseLighting/feSpecularLighting",
    "feDistantLight",
    "feSpecularLighting",
  ],
  tint: ["feColorMatrix", "feComponentTransfer", "feFuncR/feFuncG/feFuncB"],
  composite: ["feBlend", "rect"],
  canvas: ["svg"],
};

export function allTokens(st) {
  const set = new Set();
  [
    "noise",
    "weave",
    "pulp",
    "distort",
    "light",
    "tint",
    "composite",
    "canvas",
  ].forEach((key) => {
    sectionTokens(key, st).forEach((t) => set.add(t));
  });
  return TOKEN_ORDER.filter((t) => set.has(t));
}

export function dotsHTML(tokens, activeSet) {
  return tokens.map((t) => {
    const dim = activeSet && !activeSet.has(t);
    return `<span class="fdot${dim ? " dim" : ""}" style="background:${
      ELEMENT_COLORS[t]
    }" title="${t}"></span>`;
  }).join("");
}

export const RESET_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<polyline points="23 4 23 10 17 10"></polyline>' +
  '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>' +
  "</svg>";

export function annoHTML(anno) {
  if (!anno) return "";
  const parts = [];
  (anno.chain || []).forEach((name) => {
    const color = ELEMENT_COLORS[name] || "#888";
    parts.push(
      `<span class="badge" style="background:${color}">${name}</span>`,
    );
  });
  parts.push(`<span class="anno-attr">${anno.attr}</span>`);
  return parts.join('<span class="anno-sep">›</span>');
}

/* Number after "N." in titles like "2. Weave Blend"; unnumbered sections
 * (Canvas) fall back to position. Drives reset buttons and change sorting. */
export function sectionNumberOf(titleJa, fallback) {
  const m = titleJa.match(/^(\d+)\./);
  return m ? parseInt(m[1]) : fallback;
}

/* ---------- control state sync (same gray-out UX on every page) ---------- */

export function syncDisplay(root, input) {
  if (input.type === "range") {
    const span = root.querySelector(`[data-valuefor="${input.dataset.bind}"]`);
    if (span) span.textContent = input.value;
  }
}

export function setFieldDisabled(root, bind, disabled) {
  const input = root.querySelector(`[data-bind="${bind}"]`);
  if (!input) return;
  input.disabled = disabled;
  const field = input.closest(".field");
  if (field) field.classList.toggle("is-disabled", disabled);
}

export function syncConditionalControls(root, state) {
  // Same UX pattern as Frequency Y: gray out whatever the current
  // toggle / mode selection leaves unused.
  setFieldDisabled(root, "noise.freqY", !state.noise.anisotropic);

  // "Enable" toggles: gray out everything else in the section while off.
  setFieldDisabled(root, "weave.blend", !state.weave.enabled);
  ["pulp.fiberFreq", "pulp.fiberOctaves", "pulp.blur", "pulp.fiberAlpha"]
    .forEach(
      (b) => setFieldDisabled(root, b, !state.pulp.enabled),
    );
  ["distort.freq", "distort.octaves", "distort.scale"].forEach((b) =>
    setFieldDisabled(root, b, !state.distort.enabled)
  );

  // Light mode: "none" uses no lighting params, "diffuse" uses all
  // except highlight sharpness, "specular" uses all.
  const lightOff = state.light.mode === "none";
  setFieldDisabled(root, "light.surfaceScale", lightOff);
  setFieldDisabled(root, "light.azimuth", lightOff);
  setFieldDisabled(root, "light.elevation", lightOff);
  setFieldDisabled(root, "light.color", lightOff);
  setFieldDisabled(
    root,
    "light.specExp",
    lightOff || state.light.mode !== "specular",
  );

  // Tint mode: only the params the selected mode reads stay enabled.
  // (mapping mirrors generateSVG: alpha->grainAlpha;
  // stainMottle/stainSpots->color+slope+bias;
  // stainHaze->color+grainAlpha; table->levels; none->nothing)
  const tintMode = state.tint.mode;
  setFieldDisabled(
    root,
    "tint.grainAlpha",
    !(tintMode === "alpha" || tintMode === "stainHaze"),
  );
  setFieldDisabled(
    root,
    "tint.color",
    !(tintMode === "stainMottle" || tintMode === "stainSpots" ||
      tintMode === "stainHaze"),
  );
  setFieldDisabled(
    root,
    "tint.alphaSlope",
    !(tintMode === "stainMottle" || tintMode === "stainSpots"),
  );
  setFieldDisabled(
    root,
    "tint.alphaBias",
    !(tintMode === "stainMottle" || tintMode === "stainSpots"),
  );
  setFieldDisabled(root, "tint.levels", tintMode !== "table");
}

export function setControlsFromState(root, state) {
  root.querySelectorAll("[data-bind]").forEach((input) => {
    const v = getPath(state, input.dataset.bind);
    if (input.type === "checkbox") input.checked = !!v;
    else input.value = v;
    syncDisplay(root, input);
  });
  syncConditionalControls(root, state);
}

export function bindParamInputs(root, hooks) {
  // hooks: { getState(), onChange(path) }. State object identity may change
  // (preset loads replace it), so always read through getState().
  root.querySelectorAll("[data-bind]").forEach((input) => {
    input.addEventListener("input", () => {
      const path = input.dataset.bind;
      let val;
      if (input.type === "checkbox") val = input.checked;
      else if (input.type === "range") val = parseFloat(input.value);
      else val = input.value;
      setPath(hooks.getState(), path, val);
      syncDisplay(root, input);
      syncConditionalControls(root, hooks.getState());
      hooks.onChange(path);
    });
  });
}

/* ---------- section DOM (identical structure on every page) ---------- */

export function buildSectionDom(section, ctx) {
  // ctx: { T(pair), dotsRegistry, open, resetTitle, onReset(key) | null }
  const det = document.createElement("details");
  det.className = "section";
  det.dataset.key = section.key;
  det.open = !!ctx.open;
  const summary = document.createElement("summary");
  const titleRow = document.createElement("span");
  titleRow.className = "sec-title-row";
  const titleText = document.createElement("span");
  titleText.textContent = ctx.T(section.title);
  const dots = document.createElement("span");
  dots.className = "fdots";
  ctx.dotsRegistry[section.key] = dots;
  titleRow.appendChild(titleText);
  titleRow.appendChild(dots);
  summary.appendChild(titleRow);
  // Reset button: only for the numbered sections 1-7 (the unnumbered
  // Canvas section has no preset-backed title number).
  const numMatch = section.title.ja.match(/^(\d+)\./);
  if (numMatch && ctx.onReset) {
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "sec-reset";
    resetBtn.dataset.sectionNumber = numMatch[1];
    resetBtn.title = ctx.resetTitle;
    resetBtn.setAttribute("aria-label", ctx.resetTitle);
    resetBtn.innerHTML = RESET_ICON_SVG;
    resetBtn.hidden = true;
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault(); // don't toggle the details open/closed
      e.stopPropagation();
      ctx.onReset(section.key);
    });
    summary.appendChild(resetBtn);
  }
  det.appendChild(summary);
  const body = document.createElement("div");
  body.className = "body";
  const descEl = document.createElement("p");
  descEl.className = "desc";
  descEl.textContent = ctx.T(section.desc);
  body.appendChild(descEl);

  section.fields.forEach((f) => {
    const wrap = document.createElement("div");
    if (f.type === "checkbox") {
      wrap.className = "field checkline";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.bind = f.bind;
      const label = document.createElement("label");
      label.textContent = ctx.T(f.label);
      wrap.appendChild(input);
      wrap.appendChild(label);
    } else {
      wrap.className = "field";
      const label = document.createElement("label");
      const titleRow2 = document.createElement("div");
      titleRow2.className = "ftitle-row";
      const span = document.createElement("span");
      span.textContent = ctx.T(f.label);
      const vspan = document.createElement("span");
      vspan.className = "v";
      vspan.dataset.valuefor = f.bind;
      titleRow2.appendChild(span);
      if (f.type === "range") titleRow2.appendChild(vspan);
      label.appendChild(titleRow2);
      if (f.anno) {
        const annoRow = document.createElement("div");
        annoRow.className = "fanno-row";
        annoRow.innerHTML = annoHTML(f.anno);
        label.appendChild(annoRow);
      }
      wrap.appendChild(label);

      let input;
      if (f.type === "select") {
        input = document.createElement("select");
        f.options.forEach(([val, labelPair]) => {
          const opt = document.createElement("option");
          opt.value = val;
          opt.textContent = ctx.T(labelPair);
          input.appendChild(opt);
        });
      } else if (f.type === "color") {
        input = document.createElement("input");
        input.type = "color";
      } else {
        input = document.createElement("input");
        input.type = "range";
        input.min = f.min;
        input.max = f.max;
        input.step = f.step;
      }
      input.dataset.bind = f.bind;
      wrap.appendChild(input);
    }
    body.appendChild(wrap);
  });

  det.appendChild(body);
  return det;
}

/* ---------- change tracking (pure) ---------- */

export function getChangedParameters(currentState, initial, sections, T) {
  if (!initial) return [];
  const changes = [];

  // Build section number map first
  const sectionNumberMap = {};
  sections.forEach((section, index) => {
    sectionNumberMap[section.key] = sectionNumberOf(
      section.title.ja,
      index + 1,
    );
  });

  // Create a mapping of bind paths to display info
  const paramMap = {};

  sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.anno) {
        const filterChain = field.anno.chain;
        // Get colors for each filter in the chain
        const filterColors = filterChain.map((filter) =>
          ELEMENT_COLORS[filter] || "#888"
        );
        paramMap[field.bind] = {
          filter: filterChain.join(" → "),
          filterColors: filterColors,
          attr: field.anno.attr,
          label: T(field.label),
          sectionKey: section.key,
          sectionNumber: sectionNumberMap[section.key],
        };
      }
    });
  });

  // Check for enabled/disabled sections
  const enabledSections = ["weave", "pulp", "distort"];
  // Key attributes to show when section status changes
  const keyAttributes = {
    weave: ["weave.blend"],
    pulp: [
      "pulp.fiberFreq",
      "pulp.fiberOctaves",
      "pulp.blur",
      "pulp.fiberAlpha",
    ],
    distort: ["distort.freq", "distort.octaves", "distort.scale"],
  };

  // Track paths that have specialized display handling.
  const handledPaths = new Set();

  // noise.freqX, noise.freqY, and noise.anisotropic together produce one
  // SVG attribute, so track their effective rendered value as one change.
  const initialNoiseFrequency = noiseBaseFrequency(initial);
  const currentNoiseFrequency = noiseBaseFrequency(currentState);
  ["noise.anisotropic", "noise.freqX", "noise.freqY"].forEach((path) => {
    handledPaths.add(path);
  });
  if (currentNoiseFrequency !== initialNoiseFrequency) {
    changes.push({
      path: "noise.baseFrequency",
      filter: "feTurbulence",
      filterColors: [ELEMENT_COLORS.feTurbulence],
      attr: "baseFrequency",
      label: "baseFrequency",
      sectionNumber: sectionNumberMap.noise,
      oldValue: initialNoiseFrequency,
      newValue: currentNoiseFrequency,
    });
  }

  enabledSections.forEach((sectionKey) => {
    const wasEnabled = getPath(initial, `${sectionKey}.enabled`);
    const isEnabled = getPath(currentState, `${sectionKey}.enabled`);

    if (wasEnabled !== isEnabled) {
      // Section enable/disable changed - show key attributes
      const keyAttrs = keyAttributes[sectionKey] || [];
      keyAttrs.forEach((attrPath) => {
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
            isDisabled: !isEnabled,
          });
        }
      });
    }
  });

  // Check for mode changes in light and tint sections
  const modeChanges = [
    {
      path: "light.mode",
      filter: "feDiffuseLighting/feSpecularLighting",
      attr: "mode",
      sectionKey: "light",
    },
    {
      path: "tint.mode",
      filter: "feColorMatrix",
      attr: "mode",
      sectionKey: "tint",
    },
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
        isDisabled: newMode === "none",
      });
    }
  });

  // Compare current state with initial state for other changes
  function compare(obj1, obj2, path) {
    for (const key in obj1) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1[key];
      const val2 = obj2[key];

      // Skip enabled fields and already handled paths
      if (currentPath.endsWith(".enabled")) continue;
      if (handledPaths.has(currentPath)) continue;

      if (val1 && typeof val1 === "object" && !Array.isArray(val1)) {
        if (val2 && typeof val2 === "object" && !Array.isArray(val2)) {
          compare(val1, val2, currentPath);
        }
      } else if (val1 !== val2) {
        const info = paramMap[currentPath];
        if (info) {
          changes.push({
            path: currentPath,
            filter: info.filter,
            filterColors: info.filterColors,
            attr: info.attr,
            label: info.label,
            sectionNumber: info.sectionNumber,
            oldValue: val2,
            newValue: val1,
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

export function changedSectionNumbers(changes) {
  return new Set(changes.map((c) => c.sectionNumber).filter((n) => n != null));
}

export function resetSectionState(state, initialState, sectionKey) {
  state[sectionKey] = deepClone(initialState[sectionKey]);
}

/* ---------- originals list + change list rendering ---------- */

export function buildOriginalRow(container, r, ctx) {
  // ctx: { T(pair), loadLabel, onLoad(r) }
  const row = document.createElement("div");
  row.className = "recipe-row";
  const resolved = resolveOriginal(r);
  const dots = dotsHTML(allTokens(resolved));
  row.innerHTML = `<span class="no">${r.no}</span><span class="name">${
    ctx.T(r.label)
  }<span class="fdots">${dots}</span></span>`;
  const btn = document.createElement("button");
  btn.textContent = ctx.loadLabel;
  btn.addEventListener("click", () => ctx.onLoad(r));
  row.appendChild(btn);
  container.appendChild(row);
}

export function renderChangeList(metaName, metaBody, ctx) {
  // ctx: { title, changes, emptyText, headingText, disabledText }
  metaName.textContent = ctx.title;
  if (ctx.changes.length === 0) {
    metaBody.textContent = ctx.emptyText;
  } else {
    metaBody.innerHTML = "";

    // Add heading
    const heading = document.createElement("div");
    heading.className = "change-heading";
    heading.textContent = ctx.headingText;
    metaBody.appendChild(heading);

    // Add change list
    const changeList = document.createElement("div");
    changeList.className = "change-list";

    ctx.changes.forEach((change) => {
      const item = document.createElement("div");
      item.className = "change-item";

      // Create colored badges for each filter in the chain
      const filterNames = change.filter.split(" → ");
      const filterBadges = filterNames.map((filterName, i) => {
        const color = change.filterColors[i] || "#888";
        return `<span class="change-filter-badge" style="background:${color}">${filterName}</span>`;
      }).join('<span class="change-sep">›</span>');

      // Use "Disabled" text for disabled sections
      const displayValue = change.isDisabled
        ? ctx.disabledText
        : change.newValue;
      const valueClass = change.isDisabled
        ? "change-value-disabled"
        : "change-value";

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
