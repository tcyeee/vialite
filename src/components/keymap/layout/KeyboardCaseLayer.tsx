// Case/plate background for the 2D board, for layouts a rectangle can't
// describe.
//
// The default rendering is a plain nested pair of divs: `.keyboard-case` (the
// bezel) wrapping `.keyboard-layout` (the plate), both axis-aligned rounded
// rectangles sized to the layout's bounding box. That is correct — and cheap,
// and carries all the CSS bevel/shadow work — for staggered and ortholinear
// boards, which is what nearly every user has.
//
// It is wrong for two shapes:
//   - split boards, where one box spans both halves and paints the empty gap
//     between them in the case colour;
//   - rotated clusters (Alice, ergo boards), where the axis-aligned box is much
//     larger than the key area and leaves a fat bezel on all four sides.
//
// For those, {@link useCaseShape} returns per-cluster outlines (hull + rounded
// offset, from caseOutline.ts) and {@link KeyboardCaseOutline} paints them as an
// SVG layer behind the caps, while the two divs go transparent. Regular layouts
// get `null` back and keep the original div rendering untouched, so the common
// case cannot regress.
//
// Why SVG rather than `clip-path` on the existing divs: the case's 3D look is
// entirely box-shadow — an inset warm highlight plus two outer drop shadows.
// `clip-path` removes the outer shadows outright (they fall outside the clip)
// and leaves the inset ones tracing the invisible *rectangle* edges rather than
// the outline, so a clipped case would read flat and mis-lit. SVG keeps the
// shadow: a CSS `filter: drop-shadow()` on the layer follows the painted alpha,
// so it hugs each cluster's real silhouette — a split board gets two shadows.
// The bevel is redrawn as strokes clipped to the outlines (see index.css).

import { useId, useMemo } from "react";
import { clusterHulls, offsetOutline, outlinePath, type Pt } from "./caseOutline.ts";
import { footprintsOf, type PlacedLayout } from "./layoutGeometry.ts";

/** Steps per 90° of corner arc. Higher than the 3D default: these are seen flat-on. */
const ARC_SEGMENTS = 6;

export interface CaseShape {
  /** Outer size of the case box in px, matching the div rendering it replaces. */
  width: number;
  height: number;
  clusters: {
    /** Bezel outline; empty when the case is switched off (thickness 0). */
    casePath: string;
    /** Plate outline the keycaps sit on. */
    platePath: string;
  }[];
}

interface Params {
  placed: PlacedLayout;
  /** Per-unit advance in px. */
  PITCH: number;
  /** Margin between the plate's edge and the outermost caps, in px (independent of the inter-key gap). */
  plateMargin: number;
  /** Case bezel thickness in px. */
  caseThickness: number;
  /** Whether the bezel is drawn at all. */
  showCase: boolean;
}

/**
 * Returns per-cluster case/plate outlines, or `null` when the layout is a plain
 * single rectangle-shaped block and the CSS div rendering should be kept.
 *
 * Margins are chosen to reproduce the div rendering exactly on a regular board:
 * there the plate extends one `plateMargin` past the outermost cap edges and the
 * case one `caseThickness` past the plate, so the outlines are the hull offset by
 * `plateMargin` and `plateMargin + caseThickness`. The corner radius is therefore
 * the offset distance rather than the 外壳圆角 setting — an offset outline's
 * corners are arcs of exactly the offset (it's a Minkowski sum with a disc), and
 * the setting has no meaning on a shape that isn't a rectangle.
 */
export function useCaseShape({ placed, PITCH, plateMargin, caseThickness, showCase }: Params): CaseShape | null {
  return useMemo(() => {
    const footprints: Pt[][] = [];
    for (const { key, shiftX, shiftY } of placed.keys) {
      if (key.decal) {
        continue;
      }
      footprints.push(...footprintsOf(key, shiftX, shiftY));
    }
    for (const { encoder, shiftX, shiftY } of placed.encoders) {
      footprints.push(...footprintsOf(encoder, shiftX, shiftY));
    }

    // A single unrotated cluster is exactly the bounding box the divs already
    // draw, so hand it back to them — same pixels, none of the SVG machinery.
    const rotated =
      placed.keys.some(({ key }) => key.rotationAngle) ||
      placed.encoders.some(({ encoder }) => encoder.rotationAngle);
    const hulls = clusterHulls(footprints);
    if (hulls.length <= 1 && !rotated) {
      return null;
    }

    // Hulls arrive in KLE units; the SVG is in px relative to the case box's
    // top-left, so scale by the pitch and shift past the plate margin and bezel.
    const origin = plateMargin + caseThickness;
    const toPx = (hull: Pt[]): Pt[] =>
      hull.map(([x, y]) => [x * PITCH + origin, y * PITCH + origin] as Pt);

    // The hull is translated by `origin` (line 101) and then offset outward by
    // that same `origin` for the case path, so the drawn extent gains `origin`
    // on *both* sides — `2 * origin`, not `origin` alone.
    return {
      width: placed.width * PITCH + 2 * origin,
      height: placed.height * PITCH + 2 * origin,
      clusters: hulls.map((hull) => {
        const px = toPx(hull);
        return {
          casePath: showCase ? outlinePath(offsetOutline(px, origin, ARC_SEGMENTS)) : "",
          platePath: outlinePath(offsetOutline(px, plateMargin, ARC_SEGMENTS)),
        };
      }),
    };
  }, [placed, PITCH, plateMargin, caseThickness, showCase]);
}

/**
 * Paints a {@link CaseShape} as an absolutely-positioned SVG layer filling the
 * `.keyboard-case` box. Rendered before `.keyboard-layout` in the DOM so the
 * caps paint on top of it.
 *
 * `depth` (立体感) adds the drop shadows and the two bevel strokes; with it off
 * the layer is flat fills, matching what the div rendering does without
 * `.keyboard-case-shaded` / `.keyboard-layout-shaded`. `wireframe` (线稿) keeps
 * the plate stroke-only like every other layer, but fills the case with a
 * translucent tint of `caseColor` plus a crisp outer edge in `lineColor` (the
 * same uniform line color the plate/keycaps use) — matching the div
 * rendering's case treatment for that style (see the comment on
 * `.keyboard-case`'s inline `background`/`border` in KeyboardLayoutEditor.tsx).
 */
export function KeyboardCaseOutline({
  shape,
  caseColor,
  plateColor,
  lineColor,
  depth,
  wireframe,
}: {
  shape: CaseShape;
  caseColor: string;
  plateColor: string;
  /** Wireframe-only: the case's outer-edge stroke color (uniform line color, not `caseColor`). */
  lineColor?: string;
  depth: boolean;
  wireframe?: boolean;
}) {
  // Clip ids must be unique per mounted board — two previews can share a page.
  const uid = useId();
  return (
    <svg
      className={"keyboard-case-outline" + (depth ? " keyboard-case-outline-shaded" : "")}
      width={shape.width}
      height={shape.height}
      viewBox={`0 0 ${shape.width} ${shape.height}`}
      aria-hidden="true"
    >
      {depth && (
        <defs>
          {shape.clusters.map((c, i) => (
            <clipPath key={i} id={`${uid}-case-${i}`}>
              <path d={c.casePath || c.platePath} />
            </clipPath>
          ))}
          {shape.clusters.map((c, i) => (
            <clipPath key={i} id={`${uid}-plate-${i}`}>
              <path d={c.platePath} />
            </clipPath>
          ))}
        </defs>
      )}
      {/* Wireframe's tint has to be the donut between casePath and platePath
          (via evenodd), not a plain casePath fill: casePath's own shape covers
          the plate's area too (it's the same hull, just offset further out),
          and platePath renders with no fill in this style — a plain fill here
          would show straight through it, tinting the whole board instead of
          just the case ring. Matches the div rendering's inset-shadow-ring
          trick in KeyboardLayoutEditor.tsx. */}
      {wireframe &&
        shape.clusters.map(
          (c, i) =>
            c.casePath && (
              <path
                key={`ring-${i}`}
                d={`${c.casePath} ${c.platePath}`}
                fillRule="evenodd"
                fill={`color-mix(in srgb, ${caseColor} 25%, transparent)`}
              />
            ),
        )}
      {shape.clusters.map(
        (c, i) =>
          c.casePath && (
            <path
              key={i}
              d={c.casePath}
              fill={wireframe ? "none" : caseColor}
              stroke={wireframe ? lineColor : undefined}
              strokeWidth={wireframe ? 1.5 : undefined}
            />
          ),
      )}
      {/* Bezel rim highlight: a stroke centred on the outline, clipped to it, so
          only the inner half survives — the SVG equivalent of an inset shadow. */}
      {depth &&
        shape.clusters.map(
          (c, i) =>
            c.casePath && (
              <path
                key={i}
                className="keyboard-case-outline-rim"
                d={c.casePath}
                clipPath={`url(#${uid}-case-${i})`}
              />
            ),
        )}
      {shape.clusters.map((c, i) => (
        <path
          key={i}
          d={c.platePath}
          fill={wireframe ? "none" : plateColor}
          stroke={wireframe ? plateColor : undefined}
          strokeWidth={wireframe ? 1.5 : undefined}
        />
      ))}
      {/* Plate groove, pairing with `.keyboard-layout-shaded`'s inset shadow. */}
      {depth &&
        shape.clusters.map((c, i) => (
          <path
            key={i}
            className="keyboard-case-outline-groove"
            d={c.platePath}
            clipPath={`url(#${uid}-plate-${i})`}
          />
        ))}
    </svg>
  );
}
