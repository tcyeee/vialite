// Derives keyboard-case outlines from the physical key footprints instead of
// from the layout's overall bounding box.
//
// A single axis-aligned bounding rectangle is wrong for two common shapes:
// split boards (one box spanning both halves leaves a large empty middle) and
// rotated clusters like Alice (the box is much larger than the key area). So
// footprints are first grouped into spatially connected clusters — a split
// board yields two — and each cluster gets its own convex hull, offset outward
// by a margin with rounded corners (a Minkowski sum with a disc).
//
// Convex hulls fill in concave notches: an ergonomic board's thumb cluster gap
// gets covered rather than followed. That is acceptable for now because real
// cases are mostly convex; the upgrade path is to rasterize footprints onto an
// occupancy grid and trace contours with marching squares, which would keep the
// clustering below and only replace the hull step.
//
// All coordinates are in KLE units, in the same placed/normalized space that
// layoutGeometry.placeLayout() produces.

export type Pt = [number, number];

/** Footprints whose padded bounding boxes overlap belong to the same case. */
export const CLUSTER_GAP = 0.8;

function boundsOf(pts: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** Cross product of (o->a) x (o->b); > 0 means a counter-clockwise turn. */
function cross(o: Pt, a: Pt, b: Pt): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
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

/**
 * Andrew's monotone chain. Returns the hull in counter-clockwise order, which
 * {@link offsetOutline} relies on to know which way is outward.
 */
export function convexHull(points: Pt[]): Pt[] {
  if (points.length < 3) {
    return [...points];
  }
  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  const build = (source: Pt[]): Pt[] => {
    const chain: Pt[] = [];
    for (const p of source) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0) {
        chain.pop();
      }
      chain.push(p);
    }
    chain.pop();
    return chain;
  };

  const hull = [...build(pts), ...build([...pts].reverse())];
  if (hull.length < 3) {
    return hull;
  }
  return signedArea(hull) < 0 ? hull.reverse() : hull;
}

/**
 * Expands a convex, counter-clockwise polygon outward by `margin`, replacing
 * each corner with an arc so the resulting case has rounded corners rather than
 * spikes. Degenerate inputs (fewer than three points, e.g. a one-key board)
 * fall back to a rounded rectangle around the bounding box.
 */
export function offsetOutline(hull: Pt[], margin: number, arcSegments = 4): Pt[] {
  // A single key or a row of exactly-collinear keys has no polygon to offset.
  // Sampling a disc around each point and re-hulling gives the same Minkowski
  // sum the arc path below produces: a circle for one point, a stadium for two.
  if (hull.length < 3) {
    if (hull.length === 0) {
      return [];
    }
    const steps = Math.max(8, arcSegments * 4);
    const samples: Pt[] = [];
    for (const [px, py] of hull) {
      for (let s = 0; s < steps; s++) {
        const a = (Math.PI * 2 * s) / steps;
        samples.push([px + Math.cos(a) * margin, py + Math.sin(a) * margin]);
      }
    }
    return convexHull(samples);
  }

  // Outward normal of edge p->q on a CCW polygon is the direction rotated -90deg.
  const normals: Pt[] = hull.map((p, i) => {
    const q = hull[(i + 1) % hull.length];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    return [dy / len, -dx / len];
  });

  const out: Pt[] = [];
  for (let i = 0; i < hull.length; i++) {
    const [px, py] = hull[i];
    // Normals of the edges meeting at this vertex: incoming, then outgoing.
    const nIn = normals[(i - 1 + hull.length) % hull.length];
    const nOut = normals[i];
    const a0 = Math.atan2(nIn[1], nIn[0]);
    const a1 = Math.atan2(nOut[1], nOut[0]);
    // On a convex CCW polygon the outward normal always turns counter-clockwise.
    let sweep = a1 - a0;
    while (sweep < 0) {
      sweep += Math.PI * 2;
    }
    const steps = Math.max(1, Math.ceil((sweep / (Math.PI / 2)) * arcSegments));
    for (let s = 0; s <= steps; s++) {
      const a = a0 + (sweep * s) / steps;
      out.push([px + Math.cos(a) * margin, py + Math.sin(a) * margin]);
    }
  }
  return out;
}

/**
 * Serializes a closed polygon as an SVG path (`M … L … Z`) for the DOM
 * renderer. Coordinates are rounded to 0.01 to keep the attribute short —
 * outlines are authored in px there, so this is far below a device pixel.
 * Returns `""` for an empty polygon, which SVG renders as nothing.
 */
export function outlinePath(points: Pt[]): string {
  if (points.length === 0) {
    return "";
  }
  const n = (v: number) => Math.round(v * 100) / 100;
  return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`).join(" ")} Z`;
}

/**
 * Groups footprints into spatially connected clusters and returns one convex
 * hull per cluster. Connectivity is union-find over padded bounding-box
 * overlap: keys that tile against each other always merge, while a split
 * board's halves stay apart as long as the gap between them exceeds
 * {@link CLUSTER_GAP}.
 */
export function clusterHulls(footprints: Pt[][], gap = CLUSTER_GAP): Pt[][] {
  const shapes = footprints.filter((f) => f.length > 0);
  if (shapes.length === 0) {
    return [];
  }
  const boxes = shapes.map(boundsOf);

  const parent = shapes.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[rb] = ra;
    }
  };

  // Each box is padded by half the gap, so two boxes merge when the empty space
  // between them is smaller than `gap`.
  const pad = gap / 2;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlaps =
        a.minX - pad <= b.maxX + pad &&
        b.minX - pad <= a.maxX + pad &&
        a.minY - pad <= b.maxY + pad &&
        b.minY - pad <= a.maxY + pad;
      if (overlaps) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, Pt[]>();
  shapes.forEach((shape, i) => {
    const root = find(i);
    const bucket = groups.get(root);
    if (bucket) {
      bucket.push(...shape);
    } else {
      groups.set(root, [...shape]);
    }
  });

  return [...groups.values()].map((pts) => convexHull(pts));
}
