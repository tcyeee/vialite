import { describe, expect, it } from "vitest";
import { clusterHulls, convexHull, offsetOutline, outlinePath, type Pt } from "./caseOutline.ts";

/** Axis-aligned 1x1 footprint with its top-left corner at (x, y). */
function unitKey(x: number, y: number): Pt[] {
  return [
    [x, y],
    [x + 1, y],
    [x + 1, y + 1],
    [x, y + 1],
  ];
}

function bounds(pts: Pt[]) {
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

function signedArea(poly: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

describe("convexHull", () => {
  it("drops interior points and keeps the four corners of a square", () => {
    const hull = convexHull([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [1, 1],
      [0.5, 1.5],
    ]);
    expect(hull).toHaveLength(4);
    expect(bounds(hull)).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 2 });
  });

  it("returns counter-clockwise winding, which offsetOutline depends on", () => {
    const hull = convexHull([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
    expect(signedArea(hull)).toBeGreaterThan(0);
  });

  it("passes through degenerate inputs untouched", () => {
    expect(convexHull([[1, 1]])).toEqual([[1, 1]]);
    expect(convexHull([])).toEqual([]);
  });
});

describe("offsetOutline", () => {
  it("expands the polygon by exactly the margin on every side", () => {
    const square: Pt[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    const out = offsetOutline(square, 0.5);
    expect(bounds(out)).toEqual({ minX: -0.5, minY: -0.5, maxX: 2.5, maxY: 2.5 });
  });

  it("rounds corners rather than emitting spikes", () => {
    const square: Pt[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    const out = offsetOutline(square, 0.5, 4);
    // Every point sits at most `margin` away from the source square.
    for (const [x, y] of out) {
      const dx = Math.max(0 - x, x - 2, 0);
      const dy = Math.max(0 - y, y - 2, 0);
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
    // Arcs mean far more vertices than the four corners.
    expect(out.length).toBeGreaterThan(4);
  });

  it("turns a single-key layout into a disc", () => {
    const out = offsetOutline([[1, 1]], 0.5);
    expect(out.length).toBeGreaterThan(4);
    const b = bounds(out);
    expect(b.minX).toBeCloseTo(0.5);
    expect(b.minY).toBeCloseTo(0.5);
    expect(b.maxX).toBeCloseTo(1.5);
    expect(b.maxY).toBeCloseTo(1.5);
  });

  it("turns a collinear run into a stadium", () => {
    const out = offsetOutline(
      [
        [0, 0],
        [4, 0],
      ],
      0.5,
    );
    const b = bounds(out);
    expect(b.minX).toBeCloseTo(-0.5);
    expect(b.maxX).toBeCloseTo(4.5);
    expect(b.minY).toBeCloseTo(-0.5);
    expect(b.maxY).toBeCloseTo(0.5);
  });
});

describe("clusterHulls", () => {
  it("merges keys that tile against each other into one hull", () => {
    const hulls = clusterHulls([unitKey(0, 0), unitKey(1, 0), unitKey(2, 0)]);
    expect(hulls).toHaveLength(1);
    expect(bounds(hulls[0])).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 1 });
  });

  it("keeps a split board's halves as separate cases", () => {
    const hulls = clusterHulls([unitKey(0, 0), unitKey(1, 0), unitKey(6, 0), unitKey(7, 0)]);
    expect(hulls).toHaveLength(2);
    const sorted = hulls.sort((a, b) => bounds(a).minX - bounds(b).minX);
    expect(bounds(sorted[0])).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 1 });
    expect(bounds(sorted[1])).toEqual({ minX: 6, minY: 0, maxX: 8, maxY: 1 });
  });

  it("merges halves whose gap is under CLUSTER_GAP", () => {
    // 0.5u apart — below the 0.8u threshold, so this reads as one case.
    expect(clusterHulls([unitKey(0, 0), unitKey(1.5, 0)])).toHaveLength(1);
  });

  it("returns nothing for an empty layout", () => {
    expect(clusterHulls([])).toEqual([]);
  });
});

describe("outlinePath", () => {
  it("emits a closed SVG path", () => {
    expect(outlinePath([[0, 0], [2, 0], [2, 1]])).toBe("M0 0 L2 0 L2 1 Z");
  });

  it("rounds coordinates to 0.01", () => {
    expect(outlinePath([[1.23456, -0.00049], [10, 2.005]])).toBe("M1.23 0 L10 2.01 Z");
  });

  it("returns an empty string for an empty polygon", () => {
    expect(outlinePath([])).toBe("");
  });

  it("round-trips an offset outline into a path with one command per vertex", () => {
    const outline = offsetOutline(convexHull(unitKey(0, 0)), 0.25);
    const d = outlinePath(outline);
    expect(d.match(/[ML]/g)).toHaveLength(outline.length);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
  });
});
