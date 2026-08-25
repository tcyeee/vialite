// Ported from vial-gui's macro/macro_action.py + protocol/macro.py: the byte
// encoding of VIA/Vial macros (SendString-style action sequences) and the
// NUL-separated multi-macro buffer format. Protocol version gates the wire
// format: vial protocol < VIAL_PROTOCOL_ADVANCED_MACROS ("v1") has no prefix
// byte, no extended (>255) keycodes, and no delay actions; >= 2 ("v2") wraps
// every action in an SS_QMK_PREFIX byte and adds those.

import { VIAL_PROTOCOL_ADVANCED_MACROS } from "./constants.ts";
import { deserialize as kcDeserialize, serialize as kcSerialize } from "./keycodes.ts";

const SS_QMK_PREFIX = 1;
const SS_TAP_CODE = 1;
const SS_DOWN_CODE = 2;
const SS_UP_CODE = 3;
const SS_DELAY_CODE = 4;
const VIAL_MACRO_EXT_TAP = 5;
const VIAL_MACRO_EXT_DOWN = 6;
const VIAL_MACRO_EXT_UP = 7;

/** Largest delay (ms) the two-byte SS_DELAY_CODE encoding can represent without the high byte
 *  overflowing its Uint8Array slot (which would wrap to 0 — the buffer's own NUL separator). */
export const MAX_MACRO_DELAY_MS = 65024;

export type MacroAction =
  | { kind: "text"; text: string }
  | { kind: "tap" | "down" | "up"; keycodes: string[] }
  | { kind: "delay"; ms: number };

function basicCode(kind: "tap" | "down" | "up"): number {
  return kind === "tap" ? SS_TAP_CODE : kind === "down" ? SS_DOWN_CODE : SS_UP_CODE;
}

function extCode(kind: "tap" | "down" | "up"): number {
  return kind === "tap" ? VIAL_MACRO_EXT_TAP : kind === "down" ? VIAL_MACRO_EXT_DOWN : VIAL_MACRO_EXT_UP;
}

function serializeAction(action: MacroAction, vialProtocol: number): number[] {
  if (action.kind === "text") {
    return Array.from(new TextEncoder().encode(action.text));
  }
  if (action.kind === "delay") {
    if (vialProtocol < VIAL_PROTOCOL_ADVANCED_MACROS) {
      throw new Error("delay actions require vial protocol >= 2");
    }
    const delay = action.ms;
    if (delay < 0 || delay > MAX_MACRO_DELAY_MS) {
      throw new Error(`delay must be between 0 and ${MAX_MACRO_DELAY_MS}ms, got ${delay}`);
    }
    return [SS_QMK_PREFIX, SS_DELAY_CODE, (delay % 255) + 1, Math.floor(delay / 255) + 1];
  }
  const out: number[] = [];
  for (const qmkId of action.keycodes) {
    const kc = kcDeserialize(qmkId);
    const extended = kc >= 256;
    if (vialProtocol >= VIAL_PROTOCOL_ADVANCED_MACROS) {
      out.push(SS_QMK_PREFIX);
    }
    out.push(extended ? extCode(action.kind) : basicCode(action.kind));
    if (!extended) {
      out.push(kc);
    } else {
      // Mirrors QMK's decode_keycode() encoding trick for the 0xFF00 range.
      const encoded = kc % 256 === 0 ? (0xff00 | (kc >> 8)) : kc;
      out.push(encoded & 0xff, (encoded >> 8) & 0xff);
    }
  }
  return out;
}

export function serializeMacro(actions: MacroAction[], vialProtocol: number): Uint8Array<ArrayBuffer> {
  const bytes: number[] = [];
  for (const action of actions) {
    bytes.push(...serializeAction(action, vialProtocol));
  }
  return new Uint8Array(bytes);
}

/** Joins per-slot macros with NUL separators, including a trailing one (mirrors macros_serialize). */
export function serializeMacros(macros: MacroAction[][], vialProtocol: number): Uint8Array<ArrayBuffer> {
  const parts = macros.map((m) => serializeMacro(m, vialProtocol));
  const total = parts.reduce((sum, p) => sum + p.length + 1, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
    out[offset] = 0;
    offset += 1;
  }
  return out;
}

type SeqEntry =
  | { t: "text"; text: string }
  | { t: "seq"; code: number; keycodes: number[] }
  | { t: "delay"; delay: number };

function pushChar(sequence: SeqEntry[], byte: number): void {
  const last = sequence[sequence.length - 1];
  const ch = String.fromCharCode(byte);
  if (last && last.t === "text") {
    last.text += ch;
  } else {
    sequence.push({ t: "text", text: ch });
  }
}

function pushKeycode(sequence: SeqEntry[], code: number, kc: number): void {
  const last = sequence[sequence.length - 1];
  if (last && last.t === "seq" && last.code === code) {
    last.keycodes.push(kc);
  } else {
    sequence.push({ t: "seq", code, keycodes: [kc] });
  }
}

function finalizeSequence(sequence: SeqEntry[]): MacroAction[] {
  const out: MacroAction[] = [];
  for (const s of sequence) {
    if (s.t === "text") {
      out.push({ kind: "text", text: s.text });
    } else if (s.t === "delay") {
      out.push({ kind: "delay", ms: s.delay });
    } else {
      const kind = s.code === SS_TAP_CODE ? "tap" : s.code === SS_DOWN_CODE ? "down" : "up";
      out.push({ kind, keycodes: s.keycodes.map((kc) => kcSerialize(kc)) });
    }
  }
  return out;
}

function deserializeMacroV1(data: Uint8Array): MacroAction[] {
  const sequence: SeqEntry[] = [];
  let i = 0;
  while (i < data.length) {
    const b = data[i];
    if (b === SS_TAP_CODE || b === SS_DOWN_CODE || b === SS_UP_CODE) {
      if (i + 1 >= data.length) break;
      pushKeycode(sequence, b, data[i + 1]);
      i += 2;
    } else {
      pushChar(sequence, b);
      i += 1;
    }
  }
  return finalizeSequence(sequence);
}

const EXT_TO_BASIC: Record<number, number> = {
  [VIAL_MACRO_EXT_TAP]: SS_TAP_CODE,
  [VIAL_MACRO_EXT_DOWN]: SS_DOWN_CODE,
  [VIAL_MACRO_EXT_UP]: SS_UP_CODE,
};

function deserializeMacroV2(data: Uint8Array): MacroAction[] {
  const sequence: SeqEntry[] = [];
  let i = 0;
  while (i < data.length) {
    const b = data[i];
    if (b !== SS_QMK_PREFIX) {
      pushChar(sequence, b);
      i += 1;
      continue;
    }
    if (i + 1 >= data.length) break;
    const act = data[i + 1];
    if (act === SS_TAP_CODE || act === SS_DOWN_CODE || act === SS_UP_CODE) {
      if (i + 2 >= data.length) break;
      pushKeycode(sequence, act, data[i + 2]);
      i += 3;
    } else if (act in EXT_TO_BASIC) {
      if (i + 3 >= data.length) break;
      let kc = data[i + 2] | (data[i + 3] << 8);
      // Inverse of the 0xFF00 encoding trick applied in serializeAction.
      if (kc > 0xff00) {
        kc = (kc & 0xff) << 8;
      }
      pushKeycode(sequence, EXT_TO_BASIC[act], kc);
      i += 4;
    } else if (act === SS_DELAY_CODE) {
      if (i + 3 >= data.length) break;
      const delay = data[i + 2] - 1 + (data[i + 3] - 1) * 255;
      sequence.push({ t: "delay", delay });
      i += 4;
    } else {
      // Malformed — skip the prefix + action byte and hope for the best (matches vial-gui).
      i += 2;
    }
  }
  return finalizeSequence(sequence);
}

export function deserializeMacro(data: Uint8Array, vialProtocol: number): MacroAction[] {
  return vialProtocol >= VIAL_PROTOCOL_ADVANCED_MACROS ? deserializeMacroV2(data) : deserializeMacroV1(data);
}

function splitByNul(data: Uint8Array): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) {
      parts.push(data.subarray(start, i));
      start = i + 1;
    }
  }
  parts.push(data.subarray(start));
  return parts;
}

/** Splits a raw macro buffer into `macroCount` per-slot action lists (mirrors macros_deserialize). */
export function deserializeMacros(data: Uint8Array, macroCount: number, vialProtocol: number): MacroAction[][] {
  const parts = splitByNul(data);
  while (parts.length < macroCount) {
    parts.push(new Uint8Array());
  }
  return parts.slice(0, macroCount).map((p) => deserializeMacro(p, vialProtocol));
}
