/* Composite lab tests: settings, raster math, share links (docs/20, docs/30,
 * docs/60 Milestone C6). Run: deno task test
 */
import { assert, assertEquals } from "@std/assert";
import {
  bitmapSize,
  buildShareQuery,
  CMP_BLENDS,
  coverDest,
  coverRect,
  decodeIllustration,
  DEFAULT_CMP,
  DEFAULT_RASTER,
  encodeCmpSettings,
  illustrationSvg,
  paintLayers,
  parseCmpSettings,
  parseRasterSettings,
  stlnQuery,
  texQuery,
  withExplicitSize,
  withoutBackgroundGroup,
} from "../src/stln/composite.ts";
import { decodeUrlParams } from "@tksh/stln-codec";

/* Real showcase query (pfpg 202412_001, 31x31). Production data, used to
 * prove upstream decode + background filtering end to end. */
const SHOWCASE =
  "bits=~5&title=~202412_001&B=~231b-Kwv0vv__&999CF=098JSYvv2djHK9D5wP2bgcJqicJVDDi8uH65VZhKUkldzRzQMVOv8pk-AkTZ6cQxmf-GoKS1xBuAqG1UFpcRsODG_HW4kdbDtetXDCz7Wgtdl4o4K90Egb2uPQqAgjFRWFJPhQ4USyllHlUk3hRDvWXjhH9maBTYXNfiAXHp8TkBmfip6iwxPW&3=099yKYnqK1ZdV3dkGDgf5wBg8YVLaaOLLrq5VBvge1dNHxLhOJxtnFWLtUU2cKzbxeOmiUpcMvRNgIMBFAaljykZMZu9uXH7b2ZBuKDVshBICAJr2lyCipJ7BMsfvkUJo8U9pXuCh&DDDDD199FF=09_ZGCdWFpNgx-ug1nNdWywHE9Cw6BvgkVsRmPNPUroh9edMWvoeebLOAtfC7s2tdXeyd1_bFzBYMBgW_xiENuCPO_mWMalraeKO7PD24HU8&DDDDE966FF=09_Zq1iJek2Ya6uZRp_OAvSJE_fSoWY_deAHZbxJNG_XXy0xDXMLHFdDm&0=09_elogQ_NGU5ygFWdDaXCGHlF7Vg2MFl1AxypSIHTYREJTwxYm8b6DEa8sTSwkx_xJmY1oimHSeYwaFihIb-&66666C99FF=09_SEpdWf5jZ1K8AhNCWiLZTV6K_jJ1czHSU-rPVDycxrDoIkOhQAvAUNw1MDllCdt0_AzVl98_4VvYKEaAivwGy3NF4kq9DfEff3CgGVwoER2rgI0Ha9F6HHa3g3wCwC4AZMDIvzAEzCDzao2Rxw4-a_bcdNX7ZMGx4c87S-mHVzmGZPuDoqS9EejEejIxnrJ96jCW";

Deno.test("cmp settings parse with per-key fallback and clamping", () => {
  assertEquals(parseCmpSettings(new URLSearchParams("")), DEFAULT_CMP);
  assertEquals(
    parseCmpSettings(
      new URLSearchParams(
        "cmp.order=art-over-tex&cmp.mode=screen&cmp.opacity=0.5&cmp.ignoreBg=1",
      ),
    ),
    { order: "art-over-tex", mode: "screen", opacity: 0.5, ignoreBg: true },
  );
  assertEquals(
    parseCmpSettings(
      new URLSearchParams(
        "cmp.order=bogus&cmp.mode=bogus&cmp.opacity=abc&cmp.ignoreBg=yes",
      ),
    ),
    DEFAULT_CMP,
  );
  assertEquals(
    parseCmpSettings(new URLSearchParams("cmp.opacity=")).opacity,
    1,
  );
  assertEquals(
    parseCmpSettings(new URLSearchParams("cmp.opacity=2")).opacity,
    1,
  );
  assertEquals(
    parseCmpSettings(new URLSearchParams("cmp.opacity=-3")).opacity,
    0,
  );
  assertEquals(CMP_BLENDS.length, 16);
});

Deno.test("raster settings parse and bitmap math", () => {
  assertEquals(parseRasterSettings(new URLSearchParams("")), DEFAULT_RASTER);
  assertEquals(
    parseRasterSettings(new URLSearchParams("cmp.w=512&cmp.h=256&cmp.dpr=1")),
    { w: 512, h: 256, dpr: 1 },
  );
  assertEquals(
    parseRasterSettings(new URLSearchParams("cmp.w=0&cmp.h=-5&cmp.dpr=abc")),
    DEFAULT_RASTER,
  );
  assertEquals(parseRasterSettings(new URLSearchParams("cmp.dpr=9")).dpr, 4);
  assertEquals(parseRasterSettings(new URLSearchParams("cmp.w=512.5")).w, 1024);
  assertEquals(bitmapSize({ w: 512, h: 256, dpr: 2 }), { bw: 1024, bh: 512 });
});

Deno.test("cover geometry fills and centers", () => {
  assertEquals(coverDest(31, 31, 1024), { dx: 0, dy: 0, dw: 1024, dh: 1024 });
  assertEquals(coverRect(62, 31, 512, 256), { dx: 0, dy: 0, dw: 512, dh: 256 });
  // 2:1 source into a square bitmap overflows horizontally, centered.
  const r = coverRect(62, 31, 512, 512);
  assertEquals(r.dw, 1024);
  assertEquals(r.dh, 512);
  assertEquals(r.dx, -256);
  assertEquals(r.dy, 0);
});

Deno.test("explicit SVG dimensions insert and replace deterministically", () => {
  assertEquals(
    withExplicitSize('<svg xmlns="x" viewBox="0 0 31 31">', 100, 200),
    '<svg width="100" height="200" xmlns="x" viewBox="0 0 31 31">',
  );
  assertEquals(
    withExplicitSize(
      '<svg width="5" height="6" viewBox="0 0 31 31">',
      100,
      200,
    ),
    '<svg width="100" height="200" viewBox="0 0 31 31">',
  );
  assertEquals(withExplicitSize("no svg here", 1, 2), "no svg here");
});

Deno.test("background group filtering keeps sizeData", () => {
  const data = {
    basicData: {},
    linesData: new Map([[0, { a: 0 }], [1, { a: 1 }]]),
    sizeData: { viewbox: "0 0 31 31", width: 31, height: 31 },
  };
  // deno-lint-ignore no-explicit-any
  const out = withoutBackgroundGroup(data as any);
  assert(!out.linesData.has(0) && out.linesData.size === 1);
  assertEquals(out.sizeData.viewbox, "0 0 31 31");
  assertEquals(data.linesData.size, 2);
});

Deno.test("paintLayers orders, blends, and resets state", () => {
  const calls: unknown[][] = [];
  const state = { op: "source-over", alpha: 1 };
  const ctx = {
    clearRect: (...a: unknown[]) => calls.push(["clear", ...a]),
    drawImage: (img: unknown, ...rest: unknown[]) =>
      calls.push(["draw", img === bottom.img ? "B" : "T", ...rest]),
    set globalCompositeOperation(v: string) {
      state.op = v;
      calls.push(["op", v]);
    },
    set globalAlpha(v: number) {
      state.alpha = v;
      calls.push(["alpha", v]);
    },
  };
  const bottom = { img: {}, width: 100, height: 100 };
  const top = { img: {}, width: 100, height: 100 };
  paintLayers(
    ctx as unknown as CanvasRenderingContext2D,
    bottom as unknown as {
      img: HTMLImageElement;
      width: number;
      height: number;
    },
    top as unknown as { img: HTMLImageElement; width: number; height: number },
    { order: "tex-over-art", mode: "screen", opacity: 0.5, ignoreBg: false },
    200,
    200,
  );
  const draws = calls.filter((c) => c[0] === "draw");
  assertEquals(draws[0][1], "B");
  assertEquals(draws[1][1], "T");
  assertEquals(draws[0].slice(2), [0, 0, 200, 200]);
  assertEquals(
    calls.filter((c) => c[0] === "op").map((c) => c[1]),
    ["source-over", "screen", "source-over"],
  );
  assertEquals(
    calls.filter((c) => c[0] === "alpha").map((c) => c[1]),
    [1, 0.5, 1],
  );
});

Deno.test("cmp encoding omits defaults in canonical order", () => {
  assertEquals(
    encodeCmpSettings({ ...DEFAULT_CMP }, { ...DEFAULT_RASTER }).toString(),
    "",
  );
  assertEquals(
    encodeCmpSettings(
      { order: "art-over-tex", mode: "screen", opacity: 0.5, ignoreBg: true },
      { w: 512, h: 256, dpr: 1 },
    ).toString(),
    "cmp.order=art-over-tex&cmp.mode=screen&cmp.opacity=0.5&cmp.ignoreBg=1&cmp.w=512&cmp.h=256&cmp.dpr=1",
  );
  assertEquals(
    encodeCmpSettings({ ...DEFAULT_CMP, opacity: 0.25 }, { ...DEFAULT_RASTER })
      .toString(),
    "cmp.opacity=0.25",
  );
});

Deno.test("query partition keeps namespaces apart", () => {
  const q = new URLSearchParams("bits=~5&tex.tb1.seed=9&cmp.w=1&mystery=1");
  assertEquals(stlnQuery(q).toString(), "bits=%7E5&mystery=1");
  assertEquals(texQuery(q).toString(), "tex.tb1.seed=9");
  const combined = buildShareQuery(
    new URLSearchParams("cmp.opacity=0.9&bits=~5&tex.tb1.seed=9&cmp.w=1"),
    new URLSearchParams("cmp.opacity=0.5"),
  );
  assertEquals(
    combined.toString(),
    "bits=%7E5&tex.tb1.seed=9&cmp.opacity=0.5",
  );
});

Deno.test("showcase illustration decodes; ignoreBg keeps viewBox", async () => {
  const art = await decodeIllustration(new URLSearchParams(SHOWCASE));
  assertEquals(art.viewBox, "0 0 31 31");
  assertEquals((art.svg.match(/<g id="/g) ?? []).length, 7);
  const data = await decodeUrlParams(stlnQuery(new URLSearchParams(SHOWCASE)));
  const stripped = illustrationSvg({
    ...data,
    linesData: new Map(data.linesData),
  }, { ignoreBg: true });
  assert(!stripped.svg.includes('<g id="0"'), "group 0 dropped");
  assert(stripped.svg.includes('viewBox="0 0 31 31"'), "viewBox kept");
  assert(stripped.svg.includes('<g id="1"'), "other groups kept");
  const kept = illustrationSvg(data, { ignoreBg: false });
  assert(kept.svg.includes('<g id="0"'), "group 0 kept by default");
});
