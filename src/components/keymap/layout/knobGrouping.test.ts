import { describe, expect, it } from "vitest";
import type { PhysicalEncoder, PhysicalKey } from "../../../protocol/keyboard.ts";
import type { PlacedEncoder, PlacedKey } from "./layoutGeometry.ts";
import { groupKnobs } from "./knobGrouping.ts";

/** One placed rotation direction; defaults are a plain 1u shape at the origin. */
function placed(
  index: number,
  direction: 0 | 1,
  overrides: Partial<PhysicalEncoder> & { shiftX?: number; shiftY?: number } = {},
): PlacedEncoder {
  const { shiftX = 0, shiftY = 0, ...shape } = overrides;
  const encoder: PhysicalEncoder = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotationAngle: 0,
    rotationX: 0,
    rotationY: 0,
    layoutIndex: -1,
    layoutOption: -1,
    index,
    direction,
    ...shape,
  };
  return { encoder, shiftX, shiftY };
}

/** One placed cap; defaults match `placed()` so the two coincide by default. */
function cap(
  row: number,
  col: number,
  overrides: Partial<PhysicalKey> & { shiftX?: number; shiftY?: number } = {},
): PlacedKey {
  const { shiftX = 0, shiftY = 0, ...shape } = overrides;
  const key: PhysicalKey = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotationAngle: 0,
    rotationX: 0,
    rotationY: 0,
    layoutIndex: -1,
    layoutOption: -1,
    row,
    col,
    x2: 0,
    y2: 0,
    width2: 1,
    height2: 1,
    decal: false,
    ...shape,
  };
  return { key, shiftX, shiftY };
}

/** A knob's two directions stacked at `x`, the shape every press test starts from. */
function stackedKnob(x: number): PlacedEncoder[] {
  return [placed(0, 0, { x }), placed(0, 1, { x })];
}

describe("groupKnobs", () => {
  it("merges two directions stacked on the same spot", () => {
    const ccw = placed(0, 0, { x: 15.25 });
    const cw = placed(0, 1, { x: 15.25 });
    const { knobs, loose } = groupKnobs([ccw, cw]);
    expect(loose).toEqual([]);
    expect(knobs).toHaveLength(1);
    expect(knobs[0].index).toBe(0);
    expect(knobs[0].ccw).toBe(ccw);
    expect(knobs[0].cw).toBe(cw);
  });

  it("leaves side-by-side directions alone", () => {
    // Merging these would misrepresent the board: the widget would silently
    // cover a 2u span the designer drew as two separate caps.
    const encoders = [placed(0, 0, { x: 5 }), placed(0, 1, { x: 6 })];
    const { knobs, loose } = groupKnobs(encoders);
    expect(knobs).toEqual([]);
    expect(loose).toEqual(encoders);
  });

  it("does not merge directions of different encoders that overlap", () => {
    const encoders = [placed(0, 0), placed(1, 1)];
    const { knobs, loose } = groupKnobs(encoders);
    expect(knobs).toEqual([]);
    expect(loose).toEqual(encoders);
  });

  it("compares position after placement, not raw KLE coordinates", () => {
    // Same final spot, reached from different raw x via the layout-option shift.
    const { knobs } = groupKnobs([
      placed(0, 0, { x: 3 }),
      placed(0, 1, { x: 5, shiftX: -2 }),
    ]);
    expect(knobs).toHaveLength(1);
  });

  it("keeps a rotated direction apart from an unrotated one at the same x/y", () => {
    const encoders = [placed(0, 0), placed(0, 1, { rotationAngle: 30, rotationX: 2 })];
    const { knobs, loose } = groupKnobs(encoders);
    expect(knobs).toEqual([]);
    expect(loose).toEqual(encoders);
  });

  it("leaves an encoder that declares only one direction loose", () => {
    const only = placed(2, 1);
    const { knobs, loose } = groupKnobs([only]);
    expect(knobs).toEqual([]);
    expect(loose).toEqual([only]);
  });

  it("claims a cap drawn in the knob's own cell as the press key", () => {
    const press = cap(2, 14, { x: 15.25 });
    const { knobs, pressKeys } = groupKnobs(stackedKnob(15.25), [cap(0, 0), press]);
    expect(knobs[0].press).toBe(press);
    expect(pressKeys.has(press)).toBe(true);
  });

  it("leaves a neighbouring cap alone", () => {
    // The whole point of the strict test: swallowing an adjacent key would hide
    // a cap the user can still physically press.
    const neighbour = cap(0, 14, { x: 14.25 });
    const { knobs, pressKeys } = groupKnobs(stackedKnob(15.25), [neighbour]);
    expect(knobs[0].press).toBeUndefined();
    expect(pressKeys.size).toBe(0);
  });

  it("ignores decals and multi-rect caps sitting on the knob", () => {
    const decal = cap(0, 0, { decal: true });
    const isoEnter = cap(2, 12, { width2: 1.5, x2: -0.25 });
    const { knobs, pressKeys } = groupKnobs(stackedKnob(0), [decal, isoEnter]);
    expect(knobs[0].press).toBeUndefined();
    expect(pressKeys.size).toBe(0);
  });

  it("gives a cap to at most one knob", () => {
    // Two knobs can't both be sitting on the same cap in a real layout, but the
    // pairing must not hand the same cap out twice if one ever does.
    const shared = cap(2, 14);
    const { knobs, pressKeys } = groupKnobs(
      [placed(0, 0), placed(0, 1), placed(1, 0), placed(1, 1)],
      [shared],
    );
    expect(knobs.filter((k) => k.press !== undefined)).toHaveLength(1);
    expect(pressKeys.size).toBe(1);
  });

  it("reports no press key when the board has none", () => {
    const { knobs, pressKeys } = groupKnobs(stackedKnob(0), []);
    expect(knobs[0].press).toBeUndefined();
    expect(pressKeys.size).toBe(0);
  });

  it("pairs each knob independently and orders them by index", () => {
    const encoders = [
      placed(1, 1, { x: 8 }),
      placed(0, 0, { x: 2 }),
      placed(1, 0, { x: 8 }),
      placed(0, 1, { x: 2 }),
    ];
    const { knobs, loose } = groupKnobs(encoders);
    expect(loose).toEqual([]);
    expect(knobs.map((k) => k.index)).toEqual([0, 1]);
  });
});
