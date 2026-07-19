// Pure geometry pipeline for rendering a keyboard, mirroring vial-gui's
// KeyboardWidget.place_widgets():
//   1. keys tagged with a layout option are only visible when that option is
//      selected, and each option variant is shifted so its bounding-box
//      top-left aligns with variant 0's top-left;
//   2. everything is then normalized so the visible content starts at (0, 0)
//      (rotated clusters can otherwise produce negative coordinates).
// All coordinates are in KLE units.

import type { PhysicalEncoder, PhysicalKey } from "../../protocol/keyboard.ts";

export interface PlacedKey {
  key: PhysicalKey;
  shiftX: number;
  shiftY: number;
}

export interface PlacedEncoder {
  encoder: PhysicalEncoder;
  shiftX: number;
  shiftY: number;
}

export interface PlacedLayout {
  keys: PlacedKey[];
  encoders: PlacedEncoder[];
  /** Bounding box of the visible, normalized layout. */
  width: number;
  height: number;
}

type Pt = [number, number];

export function rotatePoint(px: number, py: number, angleDeg: number, rx: number, ry: number): Pt {
  if (!angleDeg) {
    return [px, py];
  }
  const t = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const dx = px - rx;
  const dy = py - ry;
  return [rx + dx * cos - dy * sin, ry + dx * sin + dy * cos];
}

function rectCorners(x: number, y: number, w: number, h: number, angle: number, rx: number, ry: number): Pt[] {
  const pts: Pt[] = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];
  return pts.map(([px, py]) => rotatePoint(px, py, angle, rx, ry));
}

export function hasSecondRect(key: PhysicalKey): boolean {
  return key.x2 !== 0 || key.y2 !== 0 || key.width2 !== key.width || key.height2 !== key.height;
}

/** Rotated corner points of a key/encoder (both rectangles for ISO-Enter-style keys). */
function shapeCorners(s: PhysicalKey | PhysicalEncoder): Pt[] {
  const pts = rectCorners(s.x, s.y, s.width, s.height, s.rotationAngle, s.rotationX, s.rotationY);
  if ("x2" in s && hasSecondRect(s)) {
    pts.push(
      ...rectCorners(s.x + s.x2, s.y + s.y2, s.width2, s.height2, s.rotationAngle, s.rotationX, s.rotationY),
    );
  }
  return pts;
}

/**
 * Footprint polygons of a placed key/encoder — its rotated corner points, as
 * one closed polygon per rectangle (ISO-Enter-style caps yield two). Unlike
 * {@link shapeCorners} the points come back grouped per rectangle and already
 * shifted into the placed layout's space, which is what the case-outline
 * clustering in `caseOutline.ts` consumes. `offsetX`/`offsetY` re-center the
 * result (the 3D view works around the board's midpoint, the 2D view doesn't).
 */
export function footprintsOf(
  s: PhysicalKey | PhysicalEncoder,
  shiftX: number,
  shiftY: number,
  offsetX = 0,
  offsetY = 0,
): Pt[][] {
  const rect = (x: number, y: number, w: number, h: number): Pt[] =>
    (
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ] as Pt[]
    ).map(([cx, cy]) => {
      const [px, py] = rotatePoint(cx, cy, s.rotationAngle, s.rotationX, s.rotationY);
      return [px + shiftX - offsetX, py + shiftY - offsetY] as Pt;
    });

  const out = [rect(s.x, s.y, s.width, s.height)];
  if ("x2" in s && hasSecondRect(s)) {
    out.push(rect(s.x + s.x2, s.y + s.y2, s.width2, s.height2));
  }
  return out;
}

export function placeLayout(
  keys: PhysicalKey[],
  encoders: PhysicalEncoder[],
  choices: number[],
): PlacedLayout {
  const all: (PhysicalKey | PhysicalEncoder)[] = [...keys, ...encoders];

  // Top-left of each (layoutIndex, layoutOption) group's bounding box.
  const groupMinX = new Map<string, number>();
  const groupMinY = new Map<string, number>();
  for (const s of all) {
    if (s.layoutIndex === -1) {
      continue;
    }
    const group = `${s.layoutIndex},${s.layoutOption}`;
    for (const [px, py] of shapeCorners(s)) {
      groupMinX.set(group, Math.min(groupMinX.get(group) ?? Infinity, px));
      groupMinY.set(group, Math.min(groupMinY.get(group) ?? Infinity, py));
    }
  }

  const isVisible = (s: PhysicalKey | PhysicalEncoder): boolean =>
    s.layoutIndex === -1 || (choices[s.layoutIndex] ?? 0) === s.layoutOption;

  // Shift each selected variant so it occupies the same spot as variant 0.
  const optionShift = (s: PhysicalKey | PhysicalEncoder): Pt => {
    if (s.layoutIndex === -1) {
      return [0, 0];
    }
    const cur = `${s.layoutIndex},${s.layoutOption}`;
    const base = `${s.layoutIndex},0`;
    return [
      -((groupMinX.get(cur) ?? 0) - (groupMinX.get(base) ?? groupMinX.get(cur) ?? 0)),
      -((groupMinY.get(cur) ?? 0) - (groupMinY.get(base) ?? groupMinY.get(cur) ?? 0)),
    ];
  };

  const visKeys = keys.filter(isVisible);
  const visEncoders = encoders.filter(isVisible);

  // Normalize so the visible content's top-left sits at (0, 0); decals are
  // decorative and excluded from the bounding box (as in vial-gui).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of [...visKeys, ...visEncoders]) {
    if ("decal" in s && s.decal) {
      continue;
    }
    const [sx, sy] = optionShift(s);
    for (const [px, py] of shapeCorners(s)) {
      minX = Math.min(minX, px + sx);
      minY = Math.min(minY, py + sy);
      maxX = Math.max(maxX, px + sx);
      maxY = Math.max(maxY, py + sy);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = minY = maxX = maxY = 0;
  }

  const place = <T extends PhysicalKey | PhysicalEncoder>(s: T) => {
    const [sx, sy] = optionShift(s);
    return { shiftX: sx - minX, shiftY: sy - minY };
  };

  return {
    keys: visKeys.map((key) => ({ key, ...place(key) })),
    encoders: visEncoders.map((encoder) => ({ encoder, ...place(encoder) })),
    width: maxX - minX,
    height: maxY - minY,
  };
}
