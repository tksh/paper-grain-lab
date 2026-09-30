/* tex.* codec round-trip suite (docs/10, docs/60 Milestone A6).
 * Run: deno task test
 */
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import * as core from "../src/js/texture-core.js";
import * as tex from "../src/js/tex-codec.js";

const clone = (s: unknown) => core.deepClone(s);

/** State battery covering every generator branch (docs/10 section 2 slots). */
function battery(): Record<string, ReturnType<typeof core.deepClone>> {
  const base = () => clone(core.DEFAULTS) as typeof core.DEFAULTS;
  const out: Record<string, typeof core.DEFAULTS> = { defaults: base() };
  const cases: Record<string, object> = {
    weave: { weave: { enabled: true, blend: "darken" } },
    weaveAniso: {
      noise: { anisotropic: true, freqX: 0.1, freqY: 0.7 },
      weave: { enabled: true, blend: "screen" },
    },
    pulpAlpha: {
      pulp: {
        enabled: true,
        fiberFreq: 0.3,
        fiberOctaves: 4,
        blur: 0.5,
        fiberAlpha: 0.9,
      },
      tint: { mode: "alpha", grainAlpha: 0.33 },
    },
    distort: { distort: { enabled: true, freq: 0.09, octaves: 3, scale: 77 } },
    specular: { light: { mode: "specular", specExp: 55, color: "#aabbcc" } },
    lightNone: { light: { mode: "none" } },
    allOn: {
      noise: {
        type: "turbulence",
        anisotropic: true,
        freqX: 0.12,
        freqY: 0.66,
        octaves: 5,
        seed: 42,
      },
      weave: { enabled: true, blend: "overlay" },
      pulp: {
        enabled: true,
        fiberFreq: 0.25,
        fiberOctaves: 2,
        blur: 3.5,
        fiberAlpha: 0.15,
      },
      distort: { enabled: true },
      light: {
        mode: "diffuse",
        surfaceScale: 4.2,
        azimuth: 200,
        elevation: 33,
        color: "#123456",
      },
      tint: {
        mode: "stainMottle",
        color: "#654321",
        alphaSlope: 2.5,
        alphaBias: -2.5,
      },
      composite: { blend: "darken", finalOpacity: 0.15 },
      base: { fillColor: "#abcdef", highlightColor: "#fedcba" },
      canvas: { size: 480 },
    },
  };
  for (const [k, v] of Object.entries(cases)) {
    const st = base();
    core.deepMerge(st, v);
    out[k] = st;
  }
  for (
    const m of ["stainMottle", "stainSpots", "stainHaze", "table"] as const
  ) {
    const t = base();
    core.deepMerge(t, {
      light: { mode: "none" },
      tint: {
        mode: m,
        color: "#102030",
        alphaSlope: -1.5,
        alphaBias: 0.5,
        levels: 8,
        grainAlpha: 0.75,
      },
    });
    out[`tint-${m}`] = t;
  }
  return out;
}

Deno.test("key table covers the spec defaults without drift", () => {
  const specDefaulted = [
    "tex.tb1.type",
    "tex.tb1.baseFrequency",
    "tex.tb1.numOctaves",
    "tex.tb1.seed",
    "tex.tb3.baseFrequency",
    "tex.tb3.numOctaves",
    "tex.gb1.stdDeviation",
    "tex.tb4.baseFrequency",
    "tex.tb4.numOctaves",
    "tex.dm1.scale",
    "tex.dl1.surfaceScale",
    "tex.dl1.azimuth",
    "tex.dl1.elevation",
    "tex.dl1.lighting-color",
    "tex.sl1.surfaceScale",
    "tex.sl1.specularExponent",
    "tex.sl1.azimuth",
    "tex.sl1.elevation",
    "tex.sl1.lighting-color",
    "tex.bl2.mode",
    "tex.bl3.mode",
    "tex.rc1.fill",
    "tex.rc2.fill",
    "tex.rc2.opacity",
    "tex.sv1.viewBox",
  ];
  for (const k of specDefaulted) assert(k in tex.TEX_DEFAULTS, `missing ${k}`);
  for (
    const k of [
      "tex.w",
      "tex.p",
      "tex.d",
      "tex.light",
      "tex.tint",
      "tex.cm1.values",
      "tex.ct1.tableValues",
      "tex.cm2.values",
    ]
  ) assert(!(k in tex.TEX_DEFAULTS), `unexpected default ${k}`);

  const d = core.DEFAULTS;
  const derived: Record<string, string> = {
    "tex.tb1.type": d.noise.type,
    "tex.tb1.baseFrequency": tex.formatFrequency(
      d.noise.freqX,
      d.noise.freqY,
      d.noise.anisotropic,
    ),
    "tex.tb1.numOctaves": String(d.noise.octaves),
    "tex.tb1.seed": String(d.noise.seed),
    "tex.tb3.baseFrequency": core.fmt(d.pulp.fiberFreq),
    "tex.tb3.numOctaves": String(d.pulp.fiberOctaves),
    "tex.gb1.stdDeviation": core.fmt(d.pulp.blur),
    "tex.tb4.baseFrequency": core.fmt(d.distort.freq),
    "tex.tb4.numOctaves": String(d.distort.octaves),
    "tex.dm1.scale": core.fmt(d.distort.scale),
    "tex.dl1.surfaceScale": core.fmt(d.light.surfaceScale),
    "tex.dl1.azimuth": String(d.light.azimuth),
    "tex.dl1.elevation": String(d.light.elevation),
    "tex.dl1.lighting-color": tex.stripHash(d.light.color)!,
    "tex.sl1.surfaceScale": core.fmt(d.light.surfaceScale),
    "tex.sl1.specularExponent": String(d.light.specExp),
    "tex.sl1.azimuth": String(d.light.azimuth),
    "tex.sl1.elevation": String(d.light.elevation),
    "tex.sl1.lighting-color": tex.stripHash(d.light.color)!,
    "tex.bl2.mode": "multiply",
    "tex.bl3.mode": d.composite.blend,
    "tex.rc1.fill": tex.stripHash(d.base.fillColor)!,
    "tex.rc2.fill": tex.stripHash(d.base.highlightColor)!,
    "tex.rc2.opacity": core.fmt(d.composite.finalOpacity),
    "tex.sv1.viewBox": tex.formatViewBox(d.canvas.size),
  };
  for (const [k, v] of Object.entries(derived)) {
    assertEquals(
      (tex.TEX_DEFAULTS as Record<string, string>)[k],
      v,
      `drift ${k}`,
    );
  }
});

Deno.test("scalar codecs accept and reject correctly", () => {
  assertEquals(tex.parseNumberList("0.05_0.4"), [0.05, 0.4]);
  assertEquals(tex.parseNumberList("0.05,0.4"), null);
  assertEquals(tex.parseNumberList("0.05 0.4"), null);
  assertEquals(tex.formatNumberList([0.05, 0.4]), "0.05_0.4");
  assertEquals(tex.parseNumberList(""), null);
  assertEquals(tex.parseNumberList("a,b"), null);
  assertEquals(tex.stripHash("#FFFFFF"), "ffffff");
  assertEquals(tex.stripHash("#abc"), "aabbcc");
  assertEquals(tex.stripHash("xyz"), null);
  assertEquals(tex.parseViewBox("0_0_300_300"), 300);
  assertEquals(tex.parseViewBox("0,0,300,300"), null);
  assertEquals(tex.parseViewBox("0_0_300_400"), null);
  assertEquals(tex.formatViewBox(300), "0_0_300_300");
  assertEquals(tex.parseInteger("3"), 3);
  assertEquals(tex.parseInteger("3.5"), null);
  assertEquals(tex.parseVocab("screen", tex.WEAVE_BLENDS), "screen");
  assertEquals(tex.parseVocab("bogus", tex.WEAVE_BLENDS), null);
  assert(tex.isTexKey("tex.tb1.type") && !tex.isTexKey("bits"));
});

Deno.test("encode goldens and key hygiene", () => {
  assertEquals(
    tex.encodeTextureState(clone(core.DEFAULTS)).toString(),
    "tex.light=diffuse",
  );

  const canson = clone(core.DEFAULTS);
  core.deepMerge(canson, {
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
  });
  assertEquals(
    tex.encodeTextureState(canson).toString(),
    "tex.light=diffuse&tex.dl1.elevation=50&tex.rc2.opacity=0.95",
  );

  for (const m of ["alpha", "stainMottle", "stainSpots", "stainHaze"]) {
    const st = clone(core.DEFAULTS);
    Object.assign(st.tint, {
      mode: m,
      color: "#594026",
      alphaSlope: 1,
      alphaBias: 0,
      grainAlpha: 0.2,
    });
    const p = tex.encodeTextureState(st);
    assertEquals(p.get("tex.tint"), "matrix");
    assertEquals(p.get("tex.cm1.values")!.split("_").length, 20);
  }
  const table = clone(core.DEFAULTS);
  table.tint.mode = "table";
  table.tint.levels = 5;
  const pt = tex.encodeTextureState(table);
  assertEquals(pt.get("tex.tint"), "table");
  assertEquals(pt.get("tex.ct1.tableValues"), "0_1_0_1_0");

  const p = tex.encodeTextureState(battery().allOn);
  const keys = [...p.keys()];
  assert(keys.every((k) => tex.TEX_KEY_ORDER.includes(k)), "known keys only");
  assert(keys.every((k) => k.startsWith("tex.")), "namespaced keys only");
  assert(!keys.includes("tex.bl2.mode"), "bl2 never written");
  assertEquals(
    keys,
    tex.TEX_KEY_ORDER.filter((k) => keys.includes(k)),
    "canonical order",
  );
  assert(
    !p.toString().includes("#") && !p.toString().includes(" "),
    "URL-safe",
  );
});

Deno.test("decode-render(encode(state)) === generateSVG(state)", () => {
  for (const [name, st] of Object.entries(battery())) {
    const params = tex.encodeTextureState(clone(st));
    assertEquals(
      tex.decodeTextureToSvg(params),
      core.generateSVG(clone(st)),
      name,
    );
  }
});

Deno.test("decode is lenient: garbage renders, unknown keys ignored", () => {
  const bad = new URLSearchParams(
    "tex.tb1.baseFrequency=abc&tex.tb1.seed=1.5x&tex.w=bogus&tex.light=weird" +
      "&tex.tint=nope&tex.cm1.values=1,2,oops&tex.p=1&tex.d=0&tex.foo=1&bits=~5",
  );
  const out = tex.decodeTextureToSvg(bad);
  assertStringIncludes(out, "<svg");
  assert(!out.includes("bogus") && !out.includes("weird"), "invalid dropped");
  assertStringIncludes(
    tex.decodeTextureToSvg(new URLSearchParams()),
    'viewBox="0 0 300 300"',
  );
});

Deno.test("decode-restore is an encode fixpoint and renders identically", () => {
  for (const [name, st] of Object.entries(battery())) {
    const q1 = tex.encodeTextureState(clone(st)).toString();
    const restored = tex.decodeTextureToState(new URLSearchParams(q1));
    const q2 = tex.encodeTextureState(restored).toString();
    assertEquals(q2, q1, `fixpoint ${name}`);
    assertEquals(
      tex.decodeTextureToSvg(new URLSearchParams(q2)),
      core.generateSVG(clone(st)),
      `render ${name}`,
    );
  }
});

Deno.test("tint family inference recovers every mode", () => {
  const cases: Record<string, typeof core.DEFAULTS> = {
    alpha: battery().pulpAlpha,
    stainMottle: battery()["tint-stainMottle"],
    stainSpots: battery()["tint-stainSpots"],
    stainHaze: battery()["tint-stainHaze"],
    table: battery()["tint-table"],
  };
  for (const [mode, st] of Object.entries(cases)) {
    const restored = tex.decodeTextureToState(
      tex.encodeTextureState(clone(st)),
    );
    assertEquals(restored.tint.mode, mode, `inference ${mode}`);
  }
});

Deno.test("empty query means all stages off; malformed falls back", () => {
  const allOff = clone(core.DEFAULTS);
  allOff.light.mode = "none";
  assertEquals(tex.decodeTextureToState(new URLSearchParams()), allOff);
  assertEquals(tex.encodeTextureState(allOff).toString(), "");
  const bad = tex.decodeTextureToState(
    new URLSearchParams(
      "tex.tb1.baseFrequency=abc&tex.w=bogus&tex.p=1&tex.sv1.viewBox=1,2",
    ),
  );
  assertEquals(bad.weave.enabled, false);
  assertEquals(bad.pulp.enabled, true);
  assertEquals(bad.canvas.size, 300);
});
