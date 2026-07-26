// The vial.json served by MockHidTransport (src/protocol/demo/mockHidTransport.ts) when the
// user enters 功能预览 (feature preview) from the connect screen. A single made-up 65%-ish
// board — QWERTY block, one rotary encoder, a layout-options group, VialRGB lighting — chosen
// to exercise as much of the real UI as possible rather than to model any real product.
//
// Physical geometry is authored as raw Keyboard Layout Editor rows (same shape kleSerial.ts
// parses), with vial-gui's convention of hiding metadata in specific label lines: label line 0
// is always "row,col"; line 3 (if present) is "layoutIndex,layoutOption" for a layout-options-
// gated key; line 9 (if present) is the literal "e" marking one rotation direction of an
// encoder, itself addressed by "index,direction" on line 0. See kleSerial.ts's LABEL_MAP for
// why lines 0/3/9 land in that order — this file never touches KLE's alignment ("a") property,
// so those line indices stay fixed at the "center front" (default) mapping.
//
// Node can run this file directly (see scripts/genDemoDefinition.mjs, which xz-compresses its
// output), and Vite imports it unmodified into the browser build — kept dependency-free (no
// imports from the rest of src/) so both environments can load it identically.

type KleRowItem = string | Record<string, unknown>;
type KleData = (KleRowItem[] | Record<string, unknown>)[];

/** Encodes a key's matrix address onto KLE label line 0. */
function pos(row: number, col: number): string {
  return `${row},${col}`;
}

/** Same as {@link pos}, plus the layout-options group/choice this key belongs to (label line 3). */
function posOpt(row: number, col: number, layoutIndex: number, layoutOption: number): string {
  return [pos(row, col), "", "", `${layoutIndex},${layoutOption}`].join("\n");
}

/** One rotation direction of encoder `index` (label line 0 = "index,direction", line 9 = "e"). */
function encoderPos(index: number, direction: 0 | 1): string {
  return [`${index},${direction}`, "", "", "", "", "", "", "", "", "e"].join("\n");
}

// prettier-ignore
const KEYMAP: KleData = [
  // Row 0: Esc, 1-0, -, =, Backspace(2u) | gap | Del | gap | encoder (both directions, same spot)
  [
    pos(0, 0), pos(0, 1), pos(0, 2), pos(0, 3), pos(0, 4), pos(0, 5), pos(0, 6), pos(0, 7),
    pos(0, 8), pos(0, 9), pos(0, 10), pos(0, 11), pos(0, 12),
    { w: 2 }, pos(0, 13),
    { x: 0.25 }, pos(0, 14),
    { x: 0.5 }, encoderPos(0, 0),
    { x: -1 }, encoderPos(0, 1),
  ],
  // Row 1: Tab(1.5u), Q-P, [, ], \(1.5u) | gap | PgUp
  [
    { w: 1.5 }, pos(1, 0),
    pos(1, 1), pos(1, 2), pos(1, 3), pos(1, 4), pos(1, 5), pos(1, 6), pos(1, 7), pos(1, 8), pos(1, 9), pos(1, 10),
    pos(1, 11), pos(1, 12),
    { w: 1.5 }, pos(1, 13),
    { x: 0.25 }, pos(1, 14),
  ],
  // Row 2: Caps(1.75u), A-L, ;, ', Enter(2.25u) | gap | PgDn
  [
    { w: 1.75 }, pos(2, 0),
    pos(2, 1), pos(2, 2), pos(2, 3), pos(2, 4), pos(2, 5), pos(2, 6), pos(2, 7), pos(2, 8), pos(2, 9),
    pos(2, 10), pos(2, 11),
    { w: 2.25 }, pos(2, 12),
    { x: 0.25 }, pos(2, 13),
  ],
  // Row 3: LShift(2.25u), Z-/, RShift(1.75u) | gap | Up
  [
    { w: 2.25 }, pos(3, 0),
    pos(3, 1), pos(3, 2), pos(3, 3), pos(3, 4), pos(3, 5), pos(3, 6), pos(3, 7), pos(3, 8), pos(3, 9), pos(3, 10),
    { w: 1.75 }, pos(3, 11),
    { x: 0.25 }, pos(3, 12),
  ],
  // Row 4: LCtrl, [LGui|Fn layout-option key], LAlt, Space(6.25u), RAlt, Fn(MO1), RCtrl | gap | Left, Down, Right
  [
    { w: 1.25 }, pos(4, 0),
    { w: 1.25 }, posOpt(4, 1, 0, 0),
    { w: 1.25, x: -1.25 }, posOpt(4, 2, 0, 1),
    { w: 1.25 }, pos(4, 3),
    { w: 6.25 }, pos(4, 4),
    { w: 1.25 }, pos(4, 5),
    { w: 1.25 }, pos(4, 6),
    { w: 1.25 }, pos(4, 7),
    { x: 0.25 }, pos(4, 8), pos(4, 9), pos(4, 10),
  ],
];

export const DEMO_MATRIX = { rows: 5, cols: 15 };

/** vial.json `layouts.labels`: one boolean-ish group choosing the bottom-left key's legend. */
export const DEMO_LAYOUT_LABELS = [["Bottom-left key", "LGui", "Fn"]];

export interface DemoVialDefinition {
  matrix: typeof DEMO_MATRIX;
  layouts: { keymap: KleData; labels: typeof DEMO_LAYOUT_LABELS };
  lighting: string;
}

export const DEMO_DEFINITION: DemoVialDefinition = {
  matrix: DEMO_MATRIX,
  layouts: { keymap: KEYMAP, labels: DEMO_LAYOUT_LABELS },
  lighting: "vialrgb",
};
