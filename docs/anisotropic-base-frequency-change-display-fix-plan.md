# Plan: Correct directional `baseFrequency` change display

## Scope

Fix the “Additional adjustment parameters” metadata panel and make the
Frequency Y control unavailable while directionality is off. The SVG generator
already emits the correct `feTurbulence baseFrequency` value when directionality
is enabled; this plan does not change the rendered SVG or preset data.

## Cause

`generateSVG()` derives the rendered noise frequency as one logical SVG
attribute:

- directionality off: `fmt(noise.freqX)`
- directionality on: `fmt(noise.freqX) + " " + fmt(noise.freqY)`

In contrast, `getChangedParameters()` tracks controls as independent state
paths. `noise.freqX` and `noise.freqY` have `anno` metadata and are therefore
individually added to `paramMap`, but `noise.anisotropic` has no annotation.
When only that checkbox changes, the generic comparison detects a changed path
but cannot find `paramMap["noise.anisotropic"]`, so it adds no display item.

After a Y-slider adjustment, generic tracking adds only
`noise.freqY` and displays its scalar value. This is still incorrect because
the rendered SVG attribute is the combined X/Y value. On uncheck, the generic
path comparison can also leave a Y-only item even though Y is no longer part
of the emitted `baseFrequency` attribute.

The change-tracking feature was introduced in commit `005b3ff`; this logical
attribute relationship was not represented in its `paramMap` or its special
case handling (which currently covers section enablement and mode controls).

## Implementation plan

1. In `src/js/app.js`, add a small helper near `fmt()` or the change-tracking
   functions that returns the *effective rendered* noise `baseFrequency` for
   a supplied state. It must use the same branch and `fmt()` formatting as
   `generateSVG()` so the metadata value exactly matches the SVG string.

2. In `getChangedParameters()`, before the generic recursive `compare()`:

   - calculate the initial and current effective noise `baseFrequency`;
   - mark `noise.anisotropic`, `noise.freqX`, and `noise.freqY` as handled so
     the generic comparison cannot create separate or stale rows;
   - if the effective strings differ, add exactly one section-1 change item
     for `feTurbulence` / `baseFrequency`, with the current effective string
     as `newValue` and the normal `feTurbulence` badge/color metadata;
   - if the effective strings are equal, add no frequency row.

3. Leave the generic comparisons for all unrelated fields unchanged. Keep the
   existing section-number sort so the synthesized noise row remains in the
   same position as other section-1 changes.

4. Optionally replace the duplicated frequency construction in
   `generateSVG()` with the same helper after verifying that doing so preserves
   both `noise1` and the weave’s intentionally swapped `noise2` behavior.
   This is a consistency refactor only; do not alter the output format.

5. In the parameter-control synchronization path, set the Frequency Y range
   input’s `disabled` property from `!state.noise.anisotropic` and toggle a
   disabled field class. Invoke that synchronization both after loading state
   and after the directionality checkbox changes. Add a muted style for the
   disabled field so the label/value and native disabled slider are visibly
   grayed out.

## Acceptance checks

Load an original whose initial noise state has directionality off and matching
X/Y values (for example, Canson Paper), then verify the metadata panel and
SVG source after each step:

| Action | Expected additional-item result | Expected `noise1` SVG value |
|---|---|---|
| Enable directionality only | `1 feTurbulence baseFrequency 0.05 0.05` | `baseFrequency="0.05 0.05"` |
| With directionality on, set Y to `0.75` | one (not two) row: `1 feTurbulence baseFrequency 0.05 0.75` | `baseFrequency="0.05 0.75"` |
| With directionality on, change X too | one row containing current X and Y, space-separated | matching two-value attribute |
| Enable directionality, change only Y, then disable it | no `baseFrequency` row | original single X value (`0.05`) |
| Change X to `0.75`, then disable directionality | one row: `1 feTurbulence baseFrequency 0.75` | `baseFrequency="0.75"` |
| Restore X and leave directionality off | the `baseFrequency` row disappears | original single value |

Also smoke-test a preset initially using directionality (Woven Fiber, Artisan
Japanese Washi, or Bark Paper): changing either X/Y while it is enabled must
remain a single combined row, and disabling it must show the resulting
single-X value if it differs from that preset’s initial rendered attribute.

Finally, verify Frequency Y is both disabled and visually muted on every
non-directional preset, becomes enabled as soon as directionality is checked,
and returns to the muted disabled state when it is unchecked.
