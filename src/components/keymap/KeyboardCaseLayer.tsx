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
  /** Gap between caps in px — also the plate's margin around the outermost caps. */
  inset: number;
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
 * there the plate extends one `inset` past the outermost cap edges and the case
 * one `caseThickness` past the plate, so the outlines are the hull offset by
 * `inset` and `inset + caseThickness`. The corner radius is therefore the offset
 * distance rather than the 外壳圆角 setting — an offset outline's corners are
 * arcs of exactly the offset (it's a Minkowski sum with a disc), and the setting
 * has no meaning on a shape that isn't a rectangle.
 */
export function useCaseShape({ placed, PITCH, inset, caseThickness, showCase }: Params): CaseShape | null {
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
    const origin = inset + caseThickness;
    const toPx = (hull: Pt[]): Pt[] =>
      hull.map(([x, y]) => [x * PITCH + origin, y * PITCH + origin] as Pt);

    return {
      width: placed.width * PITCH + inset + caseThickness * 2,
      height: placed.height * PITCH + inset + caseThickness * 2,
      clusters: hulls.map((hull) => {
        const px = toPx(hull);
        return {
          casePath: showCase ? outlinePath(offsetOutline(px, origin, ARC_SEGMENTS)) : "",
          platePath: outlinePath(offsetOutline(px, inset, ARC_SEGMENTS)),
        };
      }),
    };
  }, [placed, PITCH, inset, caseThickness, showCase]);
}

/**
 * Paints a {@link CaseShape} as an absolutely-positioned SVG layer filling the
 * `.keyboard-case` box. Rendered before `.keyboard-layout` in the DOM so the
 * caps paint on top of it.
 *
 * `depth` (立体感) adds the drop shadows and the two bevel strokes; with it off
 * the layer is flat fills, matching what the div rendering does without
 * `.keyboard-case-shaded` / `.keyboard-layout-shaded`.
 */
export function KeyboardCaseOutline({
  shape,
  caseColor,
  plateColor,
  depth,
}: {
  shape: CaseShape;
  caseColor: string;
  plateColor: string;
  depth: boolean;
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
      {shape.clusters.map((c, i) => c.casePath && <path key={i} d={c.casePath} fill={caseColor} />)}
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
        <path key={i} d={c.platePath} fill={plateColor} />
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
