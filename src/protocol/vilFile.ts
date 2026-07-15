// Serialization of vial-gui's .vil layout file format (see keyboard_comm.py's
// save_layout/restore_layout upstream). A .vil is plain JSON:
//
//   {
//     "version": 1,
//     "uid": <u64 integer>,                        // keyboard id from CMD_VIAL_GET_KEYBOARD_ID
//     "layout": [layer][row][col],                 // qmk_id string, or -1 for positions
//                                                  // absent from the physical keymap
//     "encoder_layout": [layer][encoder] = [cw, ccw],
//     "layout_options": <int>,                     // -1 when the board has no layout options
//     "via_protocol": <int>, "vial_protocol": <int>,
//     "tap_dance": [...], "combo": [...], "key_override": [...],
//     "alt_repeat_key": [...], "settings": {...}   // features Vialite doesn't support yet
//   }
//
// Two deliberate deviations from a byte-identical vial-gui export:
// - "macro" is omitted. vial-gui's restore_macros() skips a missing field but
//   treats an empty list as "erase all macros on the keyboard", so omitting it
//   is the only safe placeholder.
// - The uid can exceed Number.MAX_SAFE_INTEGER, so it is emitted/parsed as a
//   BigInt via raw-text handling rather than JSON.parse/stringify.

import { deserialize as kcDeserialize, serialize as kcSerialize } from "./keycodes.ts";

/** Data snapshot handed over by Keyboard.saveLayout(). */
export interface VilSnapshot {
  uid: bigint;
  viaProtocol: number;
  vialProtocol: number;
  layoutOptions: number;
  /** [layer][row][col] -> qmk_id, or -1 where the matrix position has no key. */
  layout: (string | -1)[][][];
  /** [layer][encoderIndex] -> [cw, ccw] qmk_ids, -1 for absent encoder slots. */
  encoderLayout: [string | -1, string | -1][][];
}

export interface VilRestoreReport {
  /** Number of key/encoder assignments actually written to the device. */
  written: number;
  /** qmk_ids from the file that this build couldn't resolve (skipped). */
  unknownKeycodes: string[];
}

export interface ParsedVilFile {
  /** null when the file has no parseable uid. */
  uid: bigint | null;
  /** [layer][row][col] entries; string qmk_id or legacy integer keycode or -1. */
  layout: unknown[][][];
  /** [layer][encoderIndex] -> [cw, ccw]. */
  encoderLayout: unknown[][][];
  /** Human-readable names of unsupported features the file carries real data for. */
  skippedFeatures: string[];
}

const UID_SENTINEL = "@@VIALITE_UID@@";

export function serializeVil(s: VilSnapshot): string {
  const data: Record<string, unknown> = {
    version: 1,
    uid: UID_SENTINEL,
    layout: s.layout,
    encoder_layout: s.encoderLayout,
    layout_options: s.layoutOptions,
    // "macro" intentionally omitted, see header comment.
    vial_protocol: s.vialProtocol,
    via_protocol: s.viaProtocol,
    tap_dance: [],
    combo: [],
    key_override: [],
    alt_repeat_key: [],
    settings: {},
  };
  return JSON.stringify(data).replace(`"${UID_SENTINEL}"`, s.uid.toString());
}

export function parseVil(text: string): ParsedVilFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Not a valid .vil file: malformed JSON");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Not a valid .vil file: expected a JSON object");
  }
  const obj = data as Record<string, unknown>;

  if (!isNestedArray(obj.layout, 3)) {
    throw new Error('Not a valid .vil file: missing or malformed "layout"');
  }
  const layout = obj.layout as unknown[][][];

  // encoder_layout is [] for boards without encoders; tolerate a missing field too.
  let encoderLayout: unknown[][][] = [];
  if (obj.encoder_layout !== undefined) {
    if (!isNestedArray(obj.encoder_layout, 1)) {
      throw new Error('Not a valid .vil file: malformed "encoder_layout"');
    }
    encoderLayout = obj.encoder_layout as unknown[][][];
  }

  // vial-gui writes the uid as a bare integer that can exceed 2^53, so pull it
  // from the raw text instead of trusting the (possibly rounded) parsed number.
  let uid: bigint | null = null;
  const uidMatch = /"uid"\s*:\s*(-?\d+)/.exec(text);
  if (uidMatch) {
    uid = BigInt(uidMatch[1]);
  }

  return { uid, layout, encoderLayout, skippedFeatures: detectSkippedFeatures(obj) };
}

/**
 * Converts one .vil layout entry to a qmk_id usable with Keyboard.setKey().
 * Accepts qmk_id strings, "0x.." fallbacks, and legacy integer keycodes
 * (mirroring vial-gui's Keycode.serialize(Keycode.deserialize(code)) round
 * trip). Returns null for -1 placeholders; records identifiers this MVP's
 * keycode table cannot resolve into `unknown` and returns null for those too.
 */
export function normalizeVilKeycode(entry: unknown, unknown: Set<string>): string | null {
  if (typeof entry === "number") {
    if (!Number.isInteger(entry) || entry < 0) {
      return null; // -1 placeholder (or garbage)
    }
    return kcSerialize(entry);
  }
  if (typeof entry === "string") {
    const code = kcDeserialize(entry);
    if (code === 0 && entry !== "KC_NO" && !/^0x0+$/i.test(entry)) {
      unknown.add(entry);
      return null;
    }
    return kcSerialize(code);
  }
  return null;
}

function isNestedArray(value: unknown, depth: number): boolean {
  if (!Array.isArray(value)) {
    return false;
  }
  if (depth <= 1) {
    return true;
  }
  return value.every((v) => isNestedArray(v, depth - 1));
}

/**
 * Reports unsupported features only when the file carries non-default data for
 * them — vial-gui exports e.g. a full tap_dance array of KC_NO entries even on
 * boards that never used tap dance, and flagging those would be pure noise.
 */
function detectSkippedFeatures(obj: Record<string, unknown>): string[] {
  const skipped: string[] = [];

  const macro = obj.macro;
  if (Array.isArray(macro) && macro.some((m) => Array.isArray(m) && m.length > 0)) {
    skipped.push("macros");
  }

  const hasRealKeycode = (entry: unknown): boolean =>
    Array.isArray(entry) && entry.some((v) => typeof v === "string" && v !== "KC_NO");
  if (Array.isArray(obj.tap_dance) && obj.tap_dance.some(hasRealKeycode)) {
    skipped.push("tap dance");
  }
  if (Array.isArray(obj.combo) && obj.combo.some(hasRealKeycode)) {
    skipped.push("combos");
  }

  // For key overrides / alt repeat keys, "configured" means the enabled bit is
  // set in the options bitmask (bit 7 and bit 3 respectively, per vial-gui).
  const enabledBitSet = (entry: unknown, bit: number): boolean =>
    typeof entry === "object" &&
    entry !== null &&
    typeof (entry as Record<string, unknown>).options === "number" &&
    ((entry as Record<string, number>).options & bit) !== 0;
  if (Array.isArray(obj.key_override) && obj.key_override.some((e) => enabledBitSet(e, 1 << 7))) {
    skipped.push("key overrides");
  }
  if (Array.isArray(obj.alt_repeat_key) && obj.alt_repeat_key.some((e) => enabledBitSet(e, 1 << 3))) {
    skipped.push("alt repeat keys");
  }

  if (typeof obj.settings === "object" && obj.settings !== null && Object.keys(obj.settings).length > 0) {
    skipped.push("QMK settings");
  }

  return skipped;
}
