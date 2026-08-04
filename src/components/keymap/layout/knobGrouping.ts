// Groups the flat encoder-direction list coming out of `placeLayout` into
// physical knobs, so the UI can present "one knob with several functions"
// instead of the protocol's "one entry per rotation direction".
//
// Why this exists at all: `vial.json` has no notion of a knob. Each rotation
// direction is its own KLE key (`labels[4] === "e"`, `labels[0] = "index,dir"`,
// see `keyboard.ts`'s reloadLayout), and vial-gui just draws each one as an
// ordinary widget. Boards that want the knob to *look* like a knob therefore
// stack both directions on the exact same coordinates — at which point the two
// absolutely-positioned elements overlap and only the last-painted one is
// clickable, making the other direction unreachable. Detecting that stack and
// drawing a single knob widget is what fixes it.
//
// Deliberately non-destructive and kept out of `src/protocol/`: grouping is a
// presentation concern. The protocol still addresses each direction separately
// (`getEncoder`/`setEncoder`), `.vil` export/import is untouched, and consumers
// that don't care can keep reading `PlacedLayout.encoders` as before.

import { useMemo } from "react";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import {
  hasSecondRect,
  placeLayout,
  type PlacedEncoder,
  type PlacedKey,
  type PlacedLayout,
} from "./layoutGeometry.ts";

/** Two rotation directions of one encoder that occupy the same spot on the board. */
export interface KnobGroup {
  /** Encoder index, as addressed by `Keyboard.getEncoder`/`setEncoder`. */
  index: number;
  ccw: PlacedEncoder;
  cw: PlacedEncoder;
  /**
   * The knob's push switch, when the board wires one into the key matrix. It is
   * an ordinary key as far as the protocol is concerned (`getKey`/`setKey` at its
   * row/col) — the encoder commands carry no press at all. Absent when the switch
   * isn't in the matrix, isn't declared in `vial.json`, or is drawn somewhere the
   * pairing below can't safely attribute to this knob.
   */
  press?: PlacedKey;
}

export interface KnobGrouping {
  /** Merged knobs — render each as one widget covering both directions. */
  knobs: KnobGroup[];
  /**
   * Directions that weren't merged (drawn side by side, or an encoder that only
   * declares one direction). Render these exactly as before.
   */
  loose: PlacedEncoder[];
  /**
   * Caps now drawn as part of a knob. Every board surface must skip these in its
   * normal cap loop: leaving one in would show the same function twice — once as
   * the knob's press row and again as a square peeking out from behind the round
   * knob — which is precisely the seam this grouping exists to hide.
   */
  pressKeys: Set<PlacedKey>;
}

/**
 * KLE coordinates come from JSON literals and the shifts from sums of them, so
 * two shapes authored at "the same place" agree to well within this. Anything
 * genuinely drawn side by side differs by ≥ 1 key unit, nowhere near it.
 */
const EPS = 1e-6;

/** A placed shape reduced to the rectangle it actually occupies on the board. */
function footprint(shape: PlacedEncoder | PlacedKey) {
  const s = "encoder" in shape ? shape.encoder : shape.key;
  return [
    s.x + shape.shiftX,
    s.y + shape.shiftY,
    s.width,
    s.height,
    s.rotationAngle,
    s.rotationX,
    s.rotationY,
  ];
}

/** Whether two placed shapes land on the same rectangle after placement. */
function sameFootprint(a: PlacedEncoder | PlacedKey, b: PlacedEncoder | PlacedKey): boolean {
  const fa = footprint(a);
  const fb = footprint(b);
  return fa.every((v, i) => Math.abs(v - fb[i]) < EPS);
}

/**
 * Splits placed encoder directions into merged knobs and leftovers. Only
 * directions of the *same* encoder index that land on the *same* footprint are
 * merged: a board that draws its two directions as two separate caps keeps
 * showing two caps, because merging them there would misrepresent the physical
 * layout (the widget would silently cover a 2u span).
 *
 * Conservative by construction — an encoder that can't be paired falls through
 * to `loose` and renders exactly as it did before this module existed.
 */
export function groupKnobs(encoders: PlacedEncoder[], keys: PlacedKey[] = []): KnobGrouping {
  const byIndex = new Map<number, PlacedEncoder[]>();
  for (const placed of encoders) {
    const list = byIndex.get(placed.encoder.index);
    if (list) {
      list.push(placed);
    } else {
      byIndex.set(placed.encoder.index, [placed]);
    }
  }

  const knobs: KnobGroup[] = [];
  const loose: PlacedEncoder[] = [];
  // Sorted by index so the rendered order is stable across reloads (Map
  // iteration order follows insertion, which follows the KLE authoring order).
  for (const [index, list] of [...byIndex].sort((a, b) => a[0] - b[0])) {
    const paired = new Set<PlacedEncoder>();
    for (const ccw of list) {
      if (ccw.encoder.direction !== 0 || paired.has(ccw)) {
        continue;
      }
      const cw = list.find(
        (other) => other.encoder.direction === 1 && !paired.has(other) && sameFootprint(ccw, other),
      );
      if (!cw) {
        continue;
      }
      paired.add(ccw);
      paired.add(cw);
      knobs.push({ index, ccw, cw });
    }
    loose.push(...list.filter((placed) => !paired.has(placed)));
  }

  // Attribute a push switch to each knob. `vial.json` states no relationship
  // between an encoder and the matrix key wired to its switch, so this has to be
  // inferred from geometry — and the inference is deliberately as strict as it
  // can be: the cap must occupy *exactly* the knob's rectangle. Boards that wire
  // the switch into the matrix draw it right there in the knob's cell, so the
  // strict test costs nothing real, while anything looser risks swallowing a
  // neighbouring cap — a false positive hides a key the user can still press,
  // which is far worse than a knob that simply shows no press function.
  const pressKeys = new Set<PlacedKey>();
  for (const knob of knobs) {
    const press = keys.find(
      (placed) =>
        !placed.key.decal &&
        // An ISO-Enter-style cap has a second rectangle sticking out of the
        // knob's circle; whatever it is, it isn't a push switch.
        !hasSecondRect(placed.key) &&
        !pressKeys.has(placed) &&
        sameFootprint(knob.ccw, placed),
    );
    if (press) {
      knob.press = press;
      pressKeys.add(press);
    }
  }

  return { knobs, loose, pressKeys };
}

export type KnobLayout = KnobGrouping & { placed: PlacedLayout };

const EMPTY_LAYOUT: KnobLayout = {
  placed: { keys: [], encoders: [], width: 0, height: 0 },
  knobs: [],
  loose: [],
  pressKeys: new Set(),
};

/** {@link groupKnobs} over a keyboard's full placed layout. */
export function knobLayout(keyboard: Keyboard | null): KnobLayout {
  if (!keyboard) {
    return EMPTY_LAYOUT;
  }
  const placed = placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices);
  return { placed, ...groupKnobs(placed.encoders, placed.keys) };
}

/**
 * Memoized {@link knobLayout} for the board surfaces (interactive editor, colour
 * preview, matrix tester) and App's panel routing, so they all group knobs the
 * same way from one implementation. `layoutOptions` is the only geometry input
 * that changes after load — `Keyboard` mutates in place otherwise. Accepts null
 * so App can call it before a keyboard is connected.
 */
export function useKnobLayout(keyboard: Keyboard | null): KnobLayout {
  return useMemo(() => knobLayout(keyboard), [keyboard, keyboard?.layoutOptions]);
}
