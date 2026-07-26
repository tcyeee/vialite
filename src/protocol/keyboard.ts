// Ported (MVP subset) from vial-gui's protocol/keyboard_comm.py::Keyboard.
// Covers layers, keymap/encoder remapping, layout options, macros, tap dance,
// combos, QMK settings, the unlock/matrix-tester flow, and VialRGB lighting.
// Key overrides, alt-repeat key, and the legacy VIA lighting backends
// (qmk_backlight / qmk_rgblight) are intentionally left out for now.

import pkg from "xz-decompress";
import { debugLog, isDebugEnabled } from "../debug.ts";
import * as C from "./constants.ts";
import { deserialize as kleDeserialize, type KleData, type KleKeyboard } from "./kleSerial.ts";
import {
  deserialize as kcDeserialize,
  serialize as kcSerialize,
  setCustomKeycodes,
  setKeycodeVersion,
  setTapDanceCount,
  type CustomKeycode,
} from "./keycodes.ts";
import { deserializeMacros, serializeMacros, type MacroAction } from "./macro.ts";
import { HidTransport, ProtocolError } from "./transport.ts";
import { normalizeVilKeycode, type ParsedVilFile, type VilRestoreReport, type VilSnapshot } from "./vilFile.ts";

export type { MacroAction };

export interface TapDanceEntry {
  onTap: string;
  onHold: string;
  onDoubleTap: string;
  onTapHold: string;
  /** Milliseconds. */
  tappingTerm: number;
}

export interface ComboEntry {
  keys: [string, string, string, string];
  output: string;
}

const { XzReadableStream } = pkg;

/**
 * qsid + byte width of the QMK Settings groups vialite has UI for, from
 * vial-gui's `qmk_settings.json` (src/main/resources/base/qmk_settings.json).
 * Not device-provided — the schema is a static resource shipped with the
 * GUI, only the qsid->value mapping is queried from the keyboard. Other
 * upstream tabs (Auto Shift, ...) have no UI yet and are simply never
 * queried.
 */
export const QMK_SETTINGS_QSID_MAGIC = 21;
export const QMK_SETTINGS_QSID_GRAVE_ESCAPE = 1;
export const QMK_SETTINGS_QSID_TAPPING_TERM = 7;
export const QMK_SETTINGS_QSID_TAP_HOLD_FLAGS = 8;
export const QMK_SETTINGS_QSID_TAP_CODE_DELAY = 18;
export const QMK_SETTINGS_QSID_TAP_HOLD_CAPS_DELAY = 19;
export const QMK_SETTINGS_QSID_TAPPING_TOGGLE = 20;
export const QMK_SETTINGS_QSID_PERMISSIVE_HOLD = 22;
export const QMK_SETTINGS_QSID_HOLD_ON_OTHER_KEY_PRESS = 23;
export const QMK_SETTINGS_QSID_RETRO_TAPPING = 24;
export const QMK_SETTINGS_QSID_QUICK_TAP_TERM = 25;
export const QMK_SETTINGS_QSID_CHORDAL_HOLD = 26;
export const QMK_SETTINGS_QSID_FLOW_TAP = 27;
export const QMK_SETTINGS_QSID_COMBO_TERM = 2;
export const QMK_SETTINGS_QSID_ONESHOT_TAP_TOGGLE = 5;
export const QMK_SETTINGS_QSID_ONESHOT_TIMEOUT = 6;
export const QMK_SETTINGS_QSID_MOUSEKEY_DELAY = 9;
export const QMK_SETTINGS_QSID_MOUSEKEY_INTERVAL = 10;
export const QMK_SETTINGS_QSID_MOUSEKEY_STEP_SIZE = 11;
export const QMK_SETTINGS_QSID_MOUSEKEY_MAX_SPEED = 12;
export const QMK_SETTINGS_QSID_MOUSEKEY_TIME_TO_MAX = 13;
export const QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_DELAY = 14;
export const QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_INTERVAL = 15;
export const QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_MAX_SPEED = 16;
export const QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_TIME_TO_MAX = 17;
const QMK_SETTINGS_WIDTH: Record<number, number> = {
  [QMK_SETTINGS_QSID_MAGIC]: 4,
  [QMK_SETTINGS_QSID_GRAVE_ESCAPE]: 1,
  [QMK_SETTINGS_QSID_TAPPING_TERM]: 2,
  [QMK_SETTINGS_QSID_TAP_HOLD_FLAGS]: 1,
  [QMK_SETTINGS_QSID_TAP_CODE_DELAY]: 2,
  [QMK_SETTINGS_QSID_TAP_HOLD_CAPS_DELAY]: 2,
  [QMK_SETTINGS_QSID_TAPPING_TOGGLE]: 1,
  [QMK_SETTINGS_QSID_PERMISSIVE_HOLD]: 1,
  [QMK_SETTINGS_QSID_HOLD_ON_OTHER_KEY_PRESS]: 1,
  [QMK_SETTINGS_QSID_RETRO_TAPPING]: 1,
  [QMK_SETTINGS_QSID_QUICK_TAP_TERM]: 2,
  [QMK_SETTINGS_QSID_CHORDAL_HOLD]: 1,
  [QMK_SETTINGS_QSID_FLOW_TAP]: 2,
  [QMK_SETTINGS_QSID_COMBO_TERM]: 2,
  [QMK_SETTINGS_QSID_ONESHOT_TAP_TOGGLE]: 1,
  [QMK_SETTINGS_QSID_ONESHOT_TIMEOUT]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_DELAY]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_INTERVAL]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_STEP_SIZE]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_MAX_SPEED]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_TIME_TO_MAX]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_DELAY]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_INTERVAL]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_MAX_SPEED]: 2,
  [QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_TIME_TO_MAX]: 2,
};

/** Geometry shared by keys and encoders, in KLE units. */
interface PhysicalShape {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, around (rotationX, rotationY). */
  rotationAngle: number;
  rotationX: number;
  rotationY: number;
  /** Which layout option this key belongs to; -1 = always present. */
  layoutIndex: number;
  layoutOption: number;
}

export interface PhysicalKey extends PhysicalShape {
  row: number;
  col: number;
  /** Secondary rectangle (ISO Enter etc.), relative to (x, y) in KLE units. */
  x2: number;
  y2: number;
  width2: number;
  height2: number;
  decal: boolean;
}

/**
 * One rotation direction of one encoder — vial.json declares each direction
 * as its own KLE key ("idx,dir" in labels[0], "e" in labels[4]).
 */
export interface PhysicalEncoder extends PhysicalShape {
  index: number;
  /** 0 = counterclockwise, 1 = clockwise (matches vial-gui's EncoderWidget). */
  direction: 0 | 1;
}

/** A layout-options entry: a bare string is a boolean toggle, an array is [label, ...choices]. */
export type LayoutLabel = string | string[];

interface VialDefinition {
  matrix: { rows: number; cols: number };
  layouts: { keymap: KleData; labels?: LayoutLabel[] };
  customKeycodes?: CustomKeycode[];
  /** "none" | "qmk_backlight" | "qmk_rgblight" | "qmk_backlight_rgblight" | "vialrgb". */
  lighting?: string;
}

/** Number of bits a layout-options entry occupies in the packed u32 (mirrors vial-gui's LayoutEditor). */
function layoutBitWidth(item: LayoutLabel): number {
  if (typeof item === "string") {
    return 1;
  }
  const numChoices = item.length - 1;
  return numChoices <= 1 ? 0 : 32 - Math.clz32(numChoices - 1);
}

/**
 * Splits the packed layout-options u32 into one choice per label entry.
 * VIA packs the first label into the most significant bits, so unpack in
 * reverse, consuming from the LSB end (mirrors vial-gui LayoutEditor.unpack).
 */
export function unpackLayoutOptions(value: number, labels: LayoutLabel[]): number[] {
  const choices = new Array<number>(labels.length).fill(0);
  for (let i = labels.length - 1; i >= 0; i--) {
    const width = layoutBitWidth(labels[i]);
    choices[i] = value & ((1 << width) - 1);
    value >>>= width;
  }
  return choices;
}

/** Inverse of {@link unpackLayoutOptions}. */
export function packLayoutOptions(choices: number[], labels: LayoutLabel[]): number {
  let value = 0;
  for (let i = 0; i < labels.length; i++) {
    const width = layoutBitWidth(labels[i]);
    value = ((value << width) | (choices[i] & ((1 << width) - 1))) >>> 0;
  }
  return value;
}

function tapDanceEqual(a: TapDanceEntry | undefined, b: TapDanceEntry): boolean {
  return (
    !!a &&
    a.onTap === b.onTap &&
    a.onHold === b.onHold &&
    a.onDoubleTap === b.onDoubleTap &&
    a.onTapHold === b.onTapHold &&
    a.tappingTerm === b.tappingTerm
  );
}

/** Rounds and clamps a UI-supplied value into the 0-255 range the protocol uses. */
function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function comboEqual(a: ComboEntry | undefined, b: ComboEntry): boolean {
  return !!a && a.output === b.output && a.keys.every((k, i) => k === b.keys[i]);
}

function concatUint8Arrays(chunks: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function decompressXz(data: Uint8Array<ArrayBuffer>): Promise<string> {
  // Read the decompressed stream directly instead of wrapping it in a
  // `Response` and calling `.text()`: when XzReadableStream errors mid-stream,
  // reading it through a Response surfaces an opaque `TypeError: Failed to
  // fetch` (Chrome maps an errored fetch-body stream to that), hiding the real
  // decompression error. A manual reader lets the underlying error propagate.
  const stream = new Blob([data]).stream();
  const reader = new XzReadableStream(stream).getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return new TextDecoder().decode(out);
}

/**
 * Whether the device on the other end actually speaks Vial, as opposed to just
 * exposing the raw-HID interface VIA and Vial share (see
 * `HidTransport.hasVialInterface`, which can't tell the two apart).
 *
 * A VIA-only board answers the Vial-specific CMD_VIAL_GET_KEYBOARD_ID with an
 * unsupported-command reply (0xff filler), so its protocol reads back well
 * outside the supported range. The accept condition is deliberately identical
 * to `checkProtocolVersion`'s, so this can never reject a keyboard that
 * `reload()` would have gone on to accept.
 *
 * Kept to a single round trip with few retries: this runs against candidate
 * devices that may not answer at all, so it must not stall the connect flow.
 */
export async function probeVial(transport: HidTransport): Promise<boolean> {
  try {
    const data = await transport.send(
      new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_GET_KEYBOARD_ID]),
      3,
    );
    const vialProtocol = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true);
    return C.SUPPORTED_VIAL_PROTOCOL.includes(vialProtocol);
  } catch {
    return false;
  }
}

export class Keyboard {
  private readonly transport: HidTransport;

  viaProtocol = -1;
  vialProtocol = -1;
  /** 64-bit keyboard id from CMD_VIAL_GET_KEYBOARD_ID; identifies the model in .vil files. */
  uid = -1n;
  rows = 0;
  cols = 0;
  layers = 0;

  keys: PhysicalKey[] = [];
  encoders: PhysicalEncoder[] = [];

  /** From vial.json `layouts.labels`; null when the board has no layout options. */
  layoutLabels: LayoutLabel[] | null = null;
  /** Packed layout-options value as reported by the device (-1 = none/unknown). */
  layoutOptions = -1;

  /**
   * vial.json's `lighting` field — which lighting backend the firmware was built
   * with. Only "vialrgb" (QMK's rgb_matrix, driven by Vial's own commands) has a
   * UI here; the two legacy VIA backends ("qmk_backlight", "qmk_rgblight") are
   * recognized but not implemented.
   */
  lighting = "none";
  /** VialRGB protocol version from VIALRGB_GET_INFO; only 1 exists so far. */
  rgbVersion = 0;
  /** Brightness ceiling the firmware reports — the value slider's max. */
  rgbMaxBrightness = 255;
  /** Effect ids this firmware actually compiled in (VIALRGB_GET_SUPPORTED). */
  rgbSupportedEffects = new Set<number>();
  rgbMode = 0;
  rgbSpeed = 0;
  /** Current [hue, saturation, value], each 0-255. `value` doubles as brightness. */
  rgbHsv: [number, number, number] = [0, 0, 0];

  tapDanceCount = 0;
  comboCount = 0;
  tapDanceEntries: TapDanceEntry[] = [];
  comboEntries: ComboEntry[] = [];

  macroCount = 0;
  macroMemory = 0;
  /** Raw NUL-separated macro buffer, normalized to exactly `macroCount` slots. */
  private macroBuffer = new Uint8Array();

  /**
   * Raw bitfield values for known QMK Settings qsids (see QMK_SETTINGS_WIDTH),
   * keyed by qsid. A qsid is absent when the device doesn't expose it (older
   * vial-qmk build, or that qmk_settings.json group disabled at compile time).
   */
  private qmkSettings = new Map<number, number>();

  /**
   * Snapshot of `layoutOptions`/`qmkSettings` as first read after connecting,
   * used by `resetLayoutOptions`/`resetQmkSettings`. There's no firmware
   * primitive to reset a single qsid (or layout options) to its factory
   * default — `CMD_VIAL_QMK_SETTINGS_RESET` resets *all* qsids at once with
   * no way to scope it — so "reset" here means "revert to how it was when
   * this keyboard connected", not "restore factory defaults".
   */
  private layoutOptionsBaseline = -1;
  private qmkSettingsBaseline = new Map<number, number>();
  private settingsBaselineCaptured = false;

  /** `${layer},${row},${col}` -> qmk_id string */
  private layout = new Map<string, string>();
  /** `${layer},${index},${direction}` -> qmk_id string (direction: 0 = CCW, 1 = CW) */
  private encoderLayout = new Map<string, string>();

  private listeners = new Set<() => void>();
  /**
   * Bumped by {@link notify} after every state-mutating write. The value itself is
   * meaningless — it exists only as a `useSyncExternalStore` snapshot for the React
   * binding in `src/hooks/useKeyboardRevision.ts`, since this class mutates its
   * fields in place rather than replacing them.
   */
  revision = 0;

  /** Registers a listener to be called after any write lands; returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.revision++;
    for (const listener of this.listeners) listener();
  }

  constructor(transport: HidTransport) {
    this.transport = transport;
  }

  async reload(): Promise<void> {
    debugLog("[vialite] Keyboard.reload() start");
    // Runs one reload step, logging its name, timing, and any error so a
    // connection failure points at the exact stage (and protocol version) that
    // broke instead of surfacing only the final exception message.
    const step = async (name: string, fn: () => Promise<void>): Promise<void> => {
      const t0 = performance.now();
      try {
        await fn();
        debugLog(`[vialite]   ✓ ${name} (${(performance.now() - t0).toFixed(0)}ms)`);
      } catch (err) {
        console.error(`[vialite]   ✗ ${name} failed after ${(performance.now() - t0).toFixed(0)}ms:`, err);
        throw err;
      }
    };

    try {
      await step("reloadLayout", () => this.reloadLayout());
      debugLog(
        "[vialite]   device info:",
        JSON.stringify({
          viaProtocol: this.viaProtocol,
          vialProtocol: this.vialProtocol,
          uid: this.uid.toString(),
          rows: this.rows,
          cols: this.cols,
          keys: this.keys.length,
          encoders: this.encoders.length,
          hasLayoutLabels: !!this.layoutLabels,
        }),
      );
      await step("reloadLayers", () => this.reloadLayers());
      debugLog(`[vialite]   layers: ${this.layers}`);
      await step("reloadKeymap", () => this.reloadKeymap());
      await step("reloadLayoutOptions", () => this.reloadLayoutOptions());
      await step("reloadDynamic", () => this.reloadDynamic());
      debugLog(`[vialite]   tapDanceCount: ${this.tapDanceCount}, comboCount: ${this.comboCount}`);
      await step("reloadMacros", () => this.reloadMacros());
      debugLog(`[vialite]   macroCount: ${this.macroCount}, macroMemory: ${this.macroMemory}`);
      await step("reloadQmkSettings", () => this.reloadQmkSettings());
      // Deliberately non-fatal, unlike every step above: lighting is a side
      // feature, and a board that misbehaves on the VialRGB commands (or reports
      // an RGB protocol version we don't know) should still connect — it just
      // won't get the RGB page.
      try {
        await step("reloadRgb", () => this.reloadRgb());
        debugLog(
          `[vialite]   lighting: ${this.lighting}, rgbEffects: ${this.rgbSupportedEffects.size}, rgbMode: ${this.rgbMode}`,
        );
      } catch (err) {
        console.error("[vialite]   RGB unavailable, continuing without it:", err);
        this.rgbSupportedEffects.clear();
      }
    } catch (err) {
      console.error("[vialite] Keyboard.reload() aborted:", err);
      throw err;
    }

    if (!this.settingsBaselineCaptured) {
      this.layoutOptionsBaseline = this.layoutOptions;
      this.qmkSettingsBaseline = new Map(this.qmkSettings);
      this.settingsBaselineCaptured = true;
    }
    this.notify();
    debugLog("[vialite] Keyboard.reload() done");
  }

  /** Parsed per-slot macro action lists, decoded from the raw device buffer. */
  get macros(): MacroAction[][] {
    return deserializeMacros(this.macroBuffer, this.macroCount, this.vialProtocol);
  }

  getKey(layer: number, row: number, col: number): string {
    return this.layout.get(`${layer},${row},${col}`) ?? "KC_NO";
  }

  getEncoder(layer: number, index: number, direction: 0 | 1): string {
    return this.encoderLayout.get(`${layer},${index},${direction}`) ?? "KC_NO";
  }

  /**
   * Whether a layer holds any real binding — i.e. any key or encoder that isn't
   * an empty slot (`KC_NO`) or a pass-through (`KC_TRNS`). Used to flag which
   * layers the user has actually configured. Layer 0 normally has a full keymap
   * and so always counts as configured.
   */
  isLayerConfigured(layer: number): boolean {
    const prefix = `${layer},`;
    for (const [k, code] of this.layout) {
      if (k.startsWith(prefix) && code !== "KC_NO" && code !== "KC_TRNS") return true;
    }
    for (const [k, code] of this.encoderLayout) {
      if (k.startsWith(prefix) && code !== "KC_NO" && code !== "KC_TRNS") return true;
    }
    return false;
  }

  /**
   * Whether a keycode is bound to at least one key or encoder direction across
   * every layer. Used to flag whether a tap-dance slot (TD(n)) is actually
   * reachable from the keymap, versus configured but never placed on a key.
   */
  isKeycodeAssigned(qmkId: string): boolean {
    for (const code of this.layout.values()) {
      if (code === qmkId) return true;
    }
    for (const code of this.encoderLayout.values()) {
      if (code === qmkId) return true;
    }
    return false;
  }

  async setKey(layer: number, row: number, col: number, qmkId: string): Promise<void> {
    const key = `${layer},${row},${col}`;
    if (this.layout.get(key) === qmkId) {
      return;
    }
    const cmd = new Uint8Array(6);
    const view = new DataView(cmd.buffer);
    cmd[0] = C.CMD_VIA_SET_KEYCODE;
    cmd[1] = layer;
    cmd[2] = row;
    cmd[3] = col;
    view.setUint16(4, kcDeserialize(qmkId), false);
    await this.transport.send(cmd, 20);
    this.layout.set(key, qmkId);
    this.notify();
  }

  async setEncoder(layer: number, index: number, direction: 0 | 1, qmkId: string): Promise<void> {
    const key = `${layer},${index},${direction}`;
    if (this.encoderLayout.get(key) === qmkId) return;
    const cmd = new Uint8Array(7);
    const view = new DataView(cmd.buffer);
    cmd[0] = C.CMD_VIA_VIAL_PREFIX;
    cmd[1] = C.CMD_VIAL_SET_ENCODER;
    cmd[2] = layer;
    cmd[3] = index;
    cmd[4] = direction;
    view.setUint16(5, kcDeserialize(qmkId), false);
    await this.transport.send(cmd, 20);
    this.encoderLayout.set(key, qmkId);
    this.notify();
  }

  async setTapDance(idx: number, entry: TapDanceEntry): Promise<void> {
    if (tapDanceEqual(this.tapDanceEntries[idx], entry)) {
      return;
    }
    const cmd = new Uint8Array(14);
    const view = new DataView(cmd.buffer);
    cmd[0] = C.CMD_VIA_VIAL_PREFIX;
    cmd[1] = C.CMD_VIAL_DYNAMIC_ENTRY_OP;
    cmd[2] = C.DYNAMIC_VIAL_TAP_DANCE_SET;
    cmd[3] = idx;
    // Dynamic-entry payloads are little-endian (struct.pack("<HHHHH", ...) upstream),
    // unlike the big-endian CMD_VIA_SET_KEYCODE/CMD_VIAL_SET_ENCODER keycode fields above.
    view.setUint16(4, kcDeserialize(entry.onTap), true);
    view.setUint16(6, kcDeserialize(entry.onHold), true);
    view.setUint16(8, kcDeserialize(entry.onDoubleTap), true);
    view.setUint16(10, kcDeserialize(entry.onTapHold), true);
    view.setUint16(12, entry.tappingTerm, true);
    await this.transport.send(cmd, 20);
    this.tapDanceEntries[idx] = entry;
    this.notify();
  }

  async setCombo(idx: number, entry: ComboEntry): Promise<void> {
    if (comboEqual(this.comboEntries[idx], entry)) {
      return;
    }
    const cmd = new Uint8Array(14);
    const view = new DataView(cmd.buffer);
    cmd[0] = C.CMD_VIA_VIAL_PREFIX;
    cmd[1] = C.CMD_VIAL_DYNAMIC_ENTRY_OP;
    cmd[2] = C.DYNAMIC_VIAL_COMBO_SET;
    cmd[3] = idx;
    view.setUint16(4, kcDeserialize(entry.keys[0]), true);
    view.setUint16(6, kcDeserialize(entry.keys[1]), true);
    view.setUint16(8, kcDeserialize(entry.keys[2]), true);
    view.setUint16(10, kcDeserialize(entry.keys[3]), true);
    view.setUint16(12, kcDeserialize(entry.output), true);
    await this.transport.send(cmd, 20);
    this.comboEntries[idx] = entry;
    this.notify();
  }

  /**
   * Writes the full macro buffer (all slots at once, mirrors vial-gui's
   * MacroRecorder.on_save -> set_macro). Callers are responsible for
   * unlocking the keyboard first (see UnlockDialog) — the firmware ignores
   * writes to the macro buffer while locked.
   */
  async saveMacros(macros: MacroAction[][]): Promise<void> {
    if (macros.length !== this.macroCount) {
      throw new ProtocolError(`expected ${this.macroCount} macros, got ${macros.length}`);
    }
    const data = serializeMacros(macros, this.vialProtocol);
    if (data.length > this.macroMemory) {
      throw new ProtocolError(`macro data too big: got ${data.length} bytes, max ${this.macroMemory}`);
    }
    for (let offset = 0; offset < data.length; offset += C.BUFFER_FETCH_CHUNK) {
      const chunk = data.subarray(offset, Math.min(offset + C.BUFFER_FETCH_CHUNK, data.length));
      const cmd = new Uint8Array(4 + chunk.length);
      const view = new DataView(cmd.buffer);
      cmd[0] = C.CMD_VIA_MACRO_SET_BUFFER;
      view.setUint16(1, offset, false);
      cmd[3] = chunk.length;
      cmd.set(chunk, 4);
      await this.transport.send(cmd, 20);
    }
    this.macroBuffer = data;
    this.notify();
  }

  /** Per-label layout choices decoded from the device's packed options value. */
  get layoutChoices(): number[] {
    if (!this.layoutLabels || this.layoutOptions < 0) {
      return [];
    }
    return unpackLayoutOptions(this.layoutOptions, this.layoutLabels);
  }

  async setLayoutOptions(choices: number[]): Promise<void> {
    if (!this.layoutLabels || this.layoutOptions === -1) {
      return;
    }
    await this.writeLayoutOptions(packLayoutOptions(choices, this.layoutLabels));
  }

  /** Reverts layout options to how they were when this keyboard connected (see `layoutOptionsBaseline`). */
  async resetLayoutOptions(): Promise<void> {
    if (this.layoutOptionsBaseline === -1) {
      return;
    }
    await this.writeLayoutOptions(this.layoutOptionsBaseline);
  }

  private async writeLayoutOptions(options: number): Promise<void> {
    if (this.layoutOptions === options) {
      return;
    }
    const cmd = new Uint8Array(6);
    const view = new DataView(cmd.buffer);
    cmd[0] = C.CMD_VIA_SET_KEYBOARD_VALUE;
    cmd[1] = C.VIA_LAYOUT_OPTIONS;
    view.setUint32(2, options, false);
    await this.transport.send(cmd, 20);
    this.layoutOptions = options;
    this.notify();
  }

  private async reloadViaProtocol(): Promise<void> {
    const data = await this.transport.send(new Uint8Array([C.CMD_VIA_GET_PROTOCOL_VERSION]), 20);
    this.viaProtocol = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(1, false);
  }

  private checkProtocolVersion(): void {
    if (
      C.SUPPORTED_VIA_PROTOCOL.includes(this.viaProtocol) &&
      C.SUPPORTED_VIAL_PROTOCOL.includes(this.vialProtocol)
    ) {
      return;
    }
    // A VIA-only board answers the Vial-specific CMD_VIAL_GET_KEYBOARD_ID with
    // an unsupported-command reply (0xff filler), so it reads back as a huge
    // vial protocol with a zero uid. Such a device still passes
    // hasVialInterface() — VIA and Vial share the same raw-HID usage page — so
    // this is the first point in a full reload where the two can be told apart.
    if (!C.SUPPORTED_VIAL_PROTOCOL.includes(this.vialProtocol) && this.uid === 0n) {
      throw new ProtocolError(
        `This keyboard does not support the Vial protocol — it looks like a VIA-only board ` +
          `(via=${this.viaProtocol}, vial=${this.vialProtocol}). Vial firmware is required.`,
        "viaOnlyKeyboard",
      );
    }
    throw new ProtocolError(
      `Unsupported protocol version (via=${this.viaProtocol}, vial=${this.vialProtocol})`,
      "unsupportedProtocol",
      { via: this.viaProtocol, vial: this.vialProtocol },
    );
  }

  private async reloadLayout(): Promise<void> {
    await this.reloadViaProtocol();

    let data = await this.transport.send(
      new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_GET_KEYBOARD_ID]),
      20,
    );
    const idView = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.vialProtocol = idView.getUint32(0, true);
    this.uid = idView.getBigUint64(4, true);
    setKeycodeVersion(this.vialProtocol);

    debugLog(`[vialite]   protocol: via=${this.viaProtocol}, vial=${this.vialProtocol}, uid=${this.uid}`);

    // Validate before fetching the definition, not after: a non-Vial board
    // returns garbage for CMD_VIAL_GET_SIZE/GET_DEFINITION, so decompressing it
    // first would fail with an opaque xz error that hides the real cause.
    this.checkProtocolVersion();

    data = await this.transport.send(new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_GET_SIZE]), 20);
    let size = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true);
    const compressedSize = size;
    debugLog(`[vialite]   vial.json compressed size: ${size} bytes`);

    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let block = 0;
    while (size > 0) {
      const cmd = new Uint8Array(6);
      const view = new DataView(cmd.buffer);
      cmd[0] = C.CMD_VIA_VIAL_PREFIX;
      cmd[1] = C.CMD_VIAL_GET_DEFINITION;
      view.setUint32(2, block, true);

      let chunk = await this.transport.send(cmd, 20);
      if (size < C.MSG_LEN) {
        chunk = chunk.slice(0, size);
      }
      chunks.push(chunk);
      block += 1;
      size -= C.MSG_LEN;
    }

    const compressed = concatUint8Arrays(chunks);
    const magic = Array.from(compressed.slice(0, 6))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    debugLog(
      `[vialite]   vial.json xz magic bytes: ${magic} (expected: fd 37 7a 58 5a 00), actualBytes=${compressed.length}`,
    );

    let json: string;
    try {
      json = await decompressXz(compressed);
    } catch (err) {
      console.error(
        `[vialite]   xz decompress of vial.json failed (compressedSize=${compressedSize}, blocks=${block}):`,
        err,
      );
      throw err;
    }
    let definition: VialDefinition;
    try {
      definition = JSON.parse(json) as VialDefinition;
    } catch (err) {
      // The decompressed text can be tens of KB — only dump it when debugging.
      console.error("[vialite]   vial.json JSON.parse failed:", err);
      if (isDebugEnabled()) {
        console.error("[vialite]   raw vial.json text:", json);
      }
      throw err;
    }

    this.rows = definition.matrix.rows;
    this.cols = definition.matrix.cols;
    this.lighting = definition.lighting ?? "none";
    this.layoutLabels = definition.layouts.labels?.length ? definition.layouts.labels : null;
    // Register this device's custom keycodes (Bluetooth switches, etc.) so the
    // picker can list them and label() can name their USER0n slots.
    setCustomKeycodes(definition.customKeycodes ?? []);

    const kb: KleKeyboard = kleDeserialize(definition.layouts.keymap);
    this.keys = [];
    this.encoders = [];

    for (const key of kb.keys) {
      // Bottom-right KLE label ("index,option") assigns the key to a layout option.
      let layoutIndex = -1;
      let layoutOption = -1;
      if (key.labels[8] && key.labels[8].includes(",")) {
        [layoutIndex, layoutOption] = key.labels[8].split(",").map(Number);
      }
      const shape: PhysicalShape = {
        x: key.x,
        y: key.y,
        width: key.width,
        height: key.height,
        rotationAngle: key.rotationAngle,
        rotationX: key.rotationX,
        rotationY: key.rotationY,
        layoutIndex,
        layoutOption,
      };

      if (key.labels[4] === "e") {
        // Each encoder direction is its own KLE key: labels[0] = "index,direction".
        const [idx, dir] = (key.labels[0] ?? "0,0").split(",").map(Number);
        this.encoders.push({ ...shape, index: idx, direction: dir === 1 ? 1 : 0 });
      } else if (!key.decal && key.labels[0] && key.labels[0].includes(",")) {
        // Decals are purely decorative (logos, labels) — they carry no matrix
        // position, so treating one as a key would alias it onto (0, 0).
        const [row, col] = key.labels[0].split(",").map(Number);
        this.keys.push({
          ...shape,
          row,
          col,
          x2: key.x2,
          y2: key.y2,
          width2: key.width2,
          height2: key.height2,
          decal: key.decal,
        });
      }
    }
  }

  private async reloadLayers(): Promise<void> {
    const data = await this.transport.send(new Uint8Array([C.CMD_VIA_GET_LAYER_COUNT]), 20);
    this.layers = data[1];
  }

  private async reloadKeymap(): Promise<void> {
    const size = this.layers * this.rows * this.cols * 2;
    const keymap = new Uint8Array(size);

    for (let offset = 0; offset < size; offset += C.BUFFER_FETCH_CHUNK) {
      const sz = Math.min(size - offset, C.BUFFER_FETCH_CHUNK);
      const cmd = new Uint8Array(4);
      const view = new DataView(cmd.buffer);
      cmd[0] = C.CMD_VIA_KEYMAP_GET_BUFFER;
      view.setUint16(1, offset, false);
      cmd[3] = sz;

      const data = await this.transport.send(cmd, 20);
      keymap.set(data.slice(4, 4 + sz), offset);
    }

    const keymapView = new DataView(keymap.buffer);
    const rowCols = new Set(this.keys.map((k) => `${k.row},${k.col}`));

    for (let layer = 0; layer < this.layers; layer++) {
      for (const rowCol of rowCols) {
        const [row, col] = rowCol.split(",").map(Number);
        if (row >= this.rows || col >= this.cols) {
          throw new ProtocolError(
            `malformed vial.json: key references ${row},${col} but matrix declares rows=${this.rows} cols=${this.cols}`,
            "malformedDefinition",
          );
        }
        const offset = layer * this.rows * this.cols * 2 + row * this.cols * 2 + col * 2;
        const code = kcSerialize(keymapView.getUint16(offset, false));
        this.layout.set(`${layer},${row},${col}`, code);
      }
    }

    const encoderIndices = new Set(this.encoders.map((e) => e.index));
    for (let layer = 0; layer < this.layers; layer++) {
      for (const index of encoderIndices) {
        const cmd = new Uint8Array([
          C.CMD_VIA_VIAL_PREFIX,
          C.CMD_VIAL_GET_ENCODER,
          layer,
          index,
        ]);
        const data = await this.transport.send(cmd, 20);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.encoderLayout.set(`${layer},${index},0`, kcSerialize(view.getUint16(0, false)));
        this.encoderLayout.set(`${layer},${index},1`, kcSerialize(view.getUint16(2, false)));
      }
    }
  }

  /** Mirrors vial-gui: layout options are only defined when the board declares layout labels. */
  private async reloadLayoutOptions(): Promise<void> {
    if (!this.layoutLabels) {
      this.layoutOptions = -1;
      return;
    }
    const data = await this.transport.send(
      new Uint8Array([C.CMD_VIA_GET_KEYBOARD_VALUE, C.VIA_LAYOUT_OPTIONS]),
      20,
    );
    this.layoutOptions = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(2, false);
  }

  /** Tap dance / combo counts + entries (vial-gui's protocol/dynamic.py + tap_dance.py/combo.py). */
  private async reloadDynamic(): Promise<void> {
    if (this.vialProtocol < C.VIAL_PROTOCOL_DYNAMIC) {
      this.tapDanceCount = 0;
      this.comboCount = 0;
      this.tapDanceEntries = [];
      this.comboEntries = [];
      setTapDanceCount(0);
      return;
    }
    const data = await this.transport.send(
      new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_DYNAMIC_ENTRY_OP, C.DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES]),
      20,
    );
    this.tapDanceCount = data[0];
    this.comboCount = data[1];
    setTapDanceCount(this.tapDanceCount);

    this.tapDanceEntries = [];
    for (let i = 0; i < this.tapDanceCount; i++) {
      const [onTap, onHold, onDoubleTap, onTapHold, tappingTerm] = await this.fetchDynamicEntry(
        C.DYNAMIC_VIAL_TAP_DANCE_GET,
        i,
        5,
      );
      this.tapDanceEntries.push({
        onTap: kcSerialize(onTap),
        onHold: kcSerialize(onHold),
        onDoubleTap: kcSerialize(onDoubleTap),
        onTapHold: kcSerialize(onTapHold),
        tappingTerm,
      });
    }

    this.comboEntries = [];
    for (let i = 0; i < this.comboCount; i++) {
      const [k1, k2, k3, k4, out] = await this.fetchDynamicEntry(C.DYNAMIC_VIAL_COMBO_GET, i, 5);
      this.comboEntries.push({
        keys: [kcSerialize(k1), kcSerialize(k2), kcSerialize(k3), kcSerialize(k4)],
        output: kcSerialize(out),
      });
    }
  }

  /** Fetches one CMD_VIAL_DYNAMIC_ENTRY_OP entry as `fields` little-endian uint16s (mirrors _retrieve_dynamic_entries). */
  private async fetchDynamicEntry(subcmd: number, idx: number, fields: number): Promise<number[]> {
    const data = await this.transport.send(
      new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_DYNAMIC_ENTRY_OP, subcmd, idx]),
      20,
    );
    if (data[0] !== 0) {
      throw new ProtocolError(`failed retrieving dynamic entry (cmd=${subcmd}, idx=${idx})`);
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const out: number[] = [];
    for (let f = 0; f < fields; f++) {
      out.push(view.getUint16(1 + f * 2, true));
    }
    return out;
  }

  /** Macro count/memory size + the raw macro buffer (vial-gui's protocol/macro.py reload_macros). */
  private async reloadMacros(): Promise<void> {
    const countData = await this.transport.send(new Uint8Array([C.CMD_VIA_MACRO_GET_COUNT]), 20);
    this.macroCount = countData[1];

    const sizeData = await this.transport.send(new Uint8Array([C.CMD_VIA_MACRO_GET_BUFFER_SIZE]), 20);
    this.macroMemory = new DataView(sizeData.buffer, sizeData.byteOffset, sizeData.byteLength).getUint16(1, false);

    if (this.macroMemory === 0 || this.macroCount === 0) {
      this.macroBuffer = new Uint8Array();
      return;
    }

    const raw = new Uint8Array(this.macroMemory);
    for (let offset = 0; offset < this.macroMemory; offset += C.BUFFER_FETCH_CHUNK) {
      const sz = Math.min(C.BUFFER_FETCH_CHUNK, this.macroMemory - offset);
      const cmd = new Uint8Array(4);
      const view = new DataView(cmd.buffer);
      cmd[0] = C.CMD_VIA_MACRO_GET_BUFFER;
      view.setUint16(1, offset, false);
      cmd[3] = sz;
      const data = await this.transport.send(cmd, 20);
      raw.set(data.slice(4, 4 + sz), offset);
    }

    // Normalize to exactly macroCount NUL-separated slots, same as vial-gui's
    // reload_macros_late split/pad/truncate/rejoin.
    this.macroBuffer = serializeMacros(deserializeMacros(raw, this.macroCount, this.vialProtocol), this.vialProtocol);
  }

  /**
   * Fetches every known QMK Settings qsid (see QMK_SETTINGS_WIDTH), ported
   * from vial-gui's `reload_settings` in keyboard_comm.py +
   * editor/qmk_settings.py. Groups with no vialite UI yet are simply not in
   * that table, so they're never queried.
   *
   * The QUERY is paginated: each round trip returns up to 16 little-endian
   * uint16 qsids starting at `cur`, terminated by 0xffff.
   */
  private async reloadQmkSettings(): Promise<void> {
    this.qmkSettings.clear();
    if (this.vialProtocol < C.VIAL_PROTOCOL_QMK_SETTINGS) {
      return;
    }

    const supported = new Set<number>();
    let cur = 0;
    while (cur !== 0xffff) {
      const cmd = new Uint8Array(4);
      const view = new DataView(cmd.buffer);
      cmd[0] = C.CMD_VIA_VIAL_PREFIX;
      cmd[1] = C.CMD_VIAL_QMK_SETTINGS_QUERY;
      view.setUint16(2, cur, true);
      const data = await this.transport.send(cmd, 20);
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      for (let i = 0; i + 1 < data.length; i += 2) {
        const qsid = dv.getUint16(i, true);
        cur = Math.max(cur, qsid);
        if (qsid !== 0xffff) {
          supported.add(qsid);
        }
      }
    }

    for (const [qsidStr, width] of Object.entries(QMK_SETTINGS_WIDTH)) {
      const qsid = Number(qsidStr);
      if (!supported.has(qsid)) {
        continue;
      }
      const cmd = new Uint8Array(4);
      const view = new DataView(cmd.buffer);
      cmd[0] = C.CMD_VIA_VIAL_PREFIX;
      cmd[1] = C.CMD_VIAL_QMK_SETTINGS_GET;
      view.setUint16(2, qsid, true);
      const data = await this.transport.send(cmd, 20);
      if (data[0] === 0) {
        let value = 0;
        for (let b = 0; b < width; b++) {
          value |= data[1 + b] << (8 * b);
        }
        this.qmkSettings.set(qsid, value >>> 0);
      }
    }
  }

  /**
   * Whether this board speaks VialRGB (QMK rgb_matrix) *and* answered the
   * handshake — the gate for showing the RGB page. `lighting` alone isn't
   * enough: `reloadRgb` leaves the effect set empty when the handshake failed
   * or reported an RGB protocol version we don't understand.
   */
  get supportsVialRgb(): boolean {
    return this.lighting === "vialrgb" && this.rgbSupportedEffects.size > 0;
  }

  /**
   * VialRGB state: protocol info, the effect ids this firmware compiled in, and
   * the currently active mode/speed/HSV. Ported from vial-gui's
   * `reload_persistent_rgb` + the `lighting_vialrgb` half of `reload_rgb`.
   *
   * The two legacy VIA backends (qmk_backlight / qmk_rgblight) are skipped
   * entirely — recognized in `lighting`, but with no UI to feed.
   */
  private async reloadRgb(): Promise<void> {
    this.rgbSupportedEffects.clear();
    if (this.lighting !== "vialrgb") {
      return;
    }

    const info = await this.transport.send(
      new Uint8Array([C.CMD_VIA_LIGHTING_GET_VALUE, C.VIALRGB_GET_INFO]),
      20,
    );
    // VIA lighting commands echo the two command bytes back, so the payload
    // starts at byte 2 (vial-gui slices the reply with `[2:]` for the same reason).
    this.rgbVersion = info[2] | (info[3] << 8);
    if (this.rgbVersion !== 1) {
      throw new ProtocolError(`unsupported VialRGB protocol version ${this.rgbVersion}`);
    }
    this.rgbMaxBrightness = info[4];

    // Effect ids come back 15-per-packet, ascending, terminated by 0xffff; each
    // round asks for ids above the highest seen so far. Effect 0 (Disable) is
    // always available and isn't necessarily enumerated. The round cap is ours,
    // not upstream's: a firmware that never sends the 0xffff terminator would
    // otherwise spin here forever, which in a browser tab means a hung page.
    const effects = new Set<number>([0]);
    let maxEffect = 0;
    for (let round = 0; maxEffect < 0xffff && round < 64; round++) {
      const cmd = new Uint8Array(4);
      cmd[0] = C.CMD_VIA_LIGHTING_GET_VALUE;
      cmd[1] = C.VIALRGB_GET_SUPPORTED;
      new DataView(cmd.buffer).setUint16(2, maxEffect, true);
      const data = await this.transport.send(cmd, 20);
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const before = maxEffect;
      for (let i = 2; i + 1 < data.length; i += 2) {
        const value = dv.getUint16(i, true);
        if (value !== 0xffff) {
          effects.add(value);
        }
        maxEffect = Math.max(maxEffect, value);
      }
      if (maxEffect === before) {
        // No new ids and no terminator — the device isn't advancing; stop rather
        // than re-request the same window.
        break;
      }
    }
    this.rgbSupportedEffects = effects;

    const mode = await this.transport.send(
      new Uint8Array([C.CMD_VIA_LIGHTING_GET_VALUE, C.VIALRGB_GET_MODE]),
      20,
    );
    this.rgbMode = new DataView(mode.buffer, mode.byteOffset, mode.byteLength).getUint16(2, true);
    this.rgbSpeed = mode[4];
    this.rgbHsv = [mode[5], mode[6], mode[7]];
  }

  /**
   * Pushes the whole mode/speed/HSV tuple at once — VIALRGB_SET_MODE has no
   * per-field variant, so every setter below rewrites all of it (as vial-gui's
   * `_vialrgb_set_mode` does).
   */
  private async writeRgbMode(): Promise<void> {
    const cmd = new Uint8Array(8);
    cmd[0] = C.CMD_VIA_LIGHTING_SET_VALUE;
    cmd[1] = C.VIALRGB_SET_MODE;
    new DataView(cmd.buffer).setUint16(2, this.rgbMode, true);
    cmd[4] = this.rgbSpeed;
    cmd[5] = this.rgbHsv[0];
    cmd[6] = this.rgbHsv[1];
    cmd[7] = this.rgbHsv[2];
    await this.transport.send(cmd, 20);
  }

  async setRgbMode(mode: number): Promise<void> {
    if (this.rgbMode === mode) {
      return;
    }
    this.rgbMode = mode;
    this.notify();
    await this.writeRgbMode();
  }

  async setRgbSpeed(speed: number): Promise<void> {
    const next = clampByte(speed);
    if (this.rgbSpeed === next) {
      return;
    }
    this.rgbSpeed = next;
    this.notify();
    await this.writeRgbMode();
  }

  /** Brightness is HSV's `value`, capped at the firmware-reported maximum. */
  async setRgbBrightness(value: number): Promise<void> {
    const next = Math.min(this.rgbMaxBrightness, clampByte(value));
    if (this.rgbHsv[2] === next) {
      return;
    }
    this.rgbHsv = [this.rgbHsv[0], this.rgbHsv[1], next];
    this.notify();
    await this.writeRgbMode();
  }

  /** Hue/saturation only — brightness stays on its own slider. Both 0-255. */
  async setRgbColor(hue: number, sat: number): Promise<void> {
    const h = clampByte(hue);
    const s = clampByte(sat);
    if (this.rgbHsv[0] === h && this.rgbHsv[1] === s) {
      return;
    }
    this.rgbHsv = [h, s, this.rgbHsv[2]];
    this.notify();
    await this.writeRgbMode();
  }

  /**
   * Commits the live lighting state to EEPROM. VIALRGB_SET_MODE only changes it
   * in RAM, so without this the board reverts to its stored settings on the next
   * power cycle — hence the explicit Save button, same as vial-gui.
   */
  async saveRgb(): Promise<void> {
    await this.transport.send(new Uint8Array([C.CMD_VIA_LIGHTING_SAVE]), 20);
  }

  /** Whether the connected keyboard exposes the given QMK Settings qsid at all. */
  supportsQmkSetting(qsid: number): boolean {
    return this.qmkSettings.has(qsid);
  }

  getQmkSettingBit(qsid: number, bit: number): boolean {
    const value = this.qmkSettings.get(qsid);
    return value !== undefined && (value & (1 << bit)) !== 0;
  }

  async setQmkSettingBit(qsid: number, bit: number, value: boolean): Promise<void> {
    const current = this.qmkSettings.get(qsid);
    if (current === undefined) {
      return;
    }
    const next = value ? current | (1 << bit) : current & ~(1 << bit);
    await this.writeQmkSetting(qsid, next);
  }

  /** Raw (non-bitfield) value of an integer qsid, e.g. Tapping Term. */
  getQmkSettingValue(qsid: number): number | undefined {
    return this.qmkSettings.get(qsid);
  }

  async setQmkSettingValue(qsid: number, value: number): Promise<void> {
    if (!this.qmkSettings.has(qsid)) {
      return;
    }
    await this.writeQmkSetting(qsid, value);
  }

  /**
   * Reverts every known qsid to its connect-time baseline. Not a firmware
   * factory-reset — see `qmkSettingsBaseline` doc comment.
   */
  async resetQmkSettings(): Promise<void> {
    for (const [qsid, baseline] of this.qmkSettingsBaseline) {
      await this.writeQmkSetting(qsid, baseline);
    }
  }

  private async writeQmkSetting(qsid: number, next: number): Promise<void> {
    const current = this.qmkSettings.get(qsid);
    if (current === undefined || current === next) {
      return;
    }
    const width = QMK_SETTINGS_WIDTH[qsid];
    const cmd = new Uint8Array(4 + width);
    const view = new DataView(cmd.buffer);
    cmd[0] = C.CMD_VIA_VIAL_PREFIX;
    cmd[1] = C.CMD_VIAL_QMK_SETTINGS_SET;
    view.setUint16(2, qsid, true);
    for (let b = 0; b < width; b++) {
      cmd[4 + b] = (next >>> (8 * b)) & 0xff;
    }
    const data = await this.transport.send(cmd, 20);
    if (data[0] !== 0) {
      throw new ProtocolError(`failed to write QMK setting (qsid=${qsid})`);
    }
    this.qmkSettings.set(qsid, next >>> 0);
    this.notify();
  }

  /** Highest encoder index + 1, matching vial-gui's encoder_count. */
  get encoderCount(): number {
    return this.encoders.reduce((max, e) => Math.max(max, e.index + 1), 0);
  }

  /** Snapshot of the current keymap in vial-gui .vil structure (see vilFile.ts). */
  saveLayout(): VilSnapshot {
    const layout: (string | -1)[][][] = [];
    for (let l = 0; l < this.layers; l++) {
      const layer: (string | -1)[][] = [];
      for (let r = 0; r < this.rows; r++) {
        const row: (string | -1)[] = [];
        for (let c = 0; c < this.cols; c++) {
          row.push(this.layout.get(`${l},${r},${c}`) ?? -1);
        }
        layer.push(row);
      }
      layout.push(layer);
    }

    const encoderLayout: [string | -1, string | -1][][] = [];
    const count = this.encoderCount;
    for (let l = 0; l < this.layers; l++) {
      const layer: [string | -1, string | -1][] = [];
      for (let e = 0; e < count; e++) {
        layer.push([
          this.encoderLayout.get(`${l},${e},0`) ?? -1,
          this.encoderLayout.get(`${l},${e},1`) ?? -1,
        ]);
      }
      encoderLayout.push(layer);
    }

    return {
      uid: this.uid,
      viaProtocol: this.viaProtocol,
      vialProtocol: this.vialProtocol,
      layoutOptions: this.layoutOptions,
      layout,
      encoderLayout,
    };
  }

  /**
   * Writes a parsed .vil file to the device. Like vial-gui's restore_layout,
   * only positions that exist on this keyboard are written, and only when they
   * differ from the current assignment. Unsupported .vil content (macros, tap
   * dance, ...) is not applied; keycodes this build can't resolve are skipped
   * and reported.
   */
  async restoreLayout(file: ParsedVilFile): Promise<VilRestoreReport> {
    const unknown = new Set<string>();
    let written = 0;

    // Like vial-gui, a .vil restore includes the board's layout options.
    if (file.layoutOptions >= 0 && this.layoutLabels && this.layoutOptions !== -1) {
      await this.writeLayoutOptions(file.layoutOptions);
    }

    for (let l = 0; l < file.layout.length; l++) {
      const layer = file.layout[l];
      for (let r = 0; r < layer.length; r++) {
        const row = layer[r];
        for (let c = 0; c < row.length; c++) {
          const qmkId = normalizeVilKeycode(row[c], unknown);
          if (qmkId === null || !this.layout.has(`${l},${r},${c}`)) {
            continue;
          }
          if (this.layout.get(`${l},${r},${c}`) !== qmkId) {
            await this.setKey(l, r, c, qmkId);
            written++;
          }
        }
      }
    }

    for (let l = 0; l < file.encoderLayout.length; l++) {
      const layer = file.encoderLayout[l];
      for (let e = 0; e < layer.length; e++) {
        const pair = layer[e];
        if (!Array.isArray(pair)) {
          continue;
        }
        for (const dir of [0, 1] as const) {
          const qmkId = normalizeVilKeycode(pair[dir], unknown);
          if (qmkId === null || !this.encoderLayout.has(`${l},${e},${dir}`)) {
            continue;
          }
          if (this.encoderLayout.get(`${l},${e},${dir}`) !== qmkId) {
            await this.setEncoder(l, e, dir, qmkId);
            written++;
          }
        }
      }
    }

    return { written, unknownKeycodes: [...unknown] };
  }

  // --- Unlock & matrix tester (ported from keyboard_comm.py get_unlock_status /
  // unlock_start / unlock_poll / lock / matrix_poll and editor/matrix_test.py) ---

  /**
   * Whether the matrix tester can work on this keyboard: needs Vial protocol 3+
   * and the whole matrix state must fit in one 32-byte report (vial-gui uses
   * the conservative `(cols // 8 + 1) * rows <= 28` check; mirror it).
   */
  get supportsMatrixTester(): boolean {
    return (
      this.vialProtocol >= C.VIAL_PROTOCOL_MATRIX_TESTER &&
      (Math.floor(this.cols / 8) + 1) * this.rows <= C.BUFFER_FETCH_CHUNK
    );
  }

  async getUnlockStatus(retries = 20): Promise<UnlockStatus> {
    const data = await this.transport.send(
      new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_GET_UNLOCK_STATUS]),
      retries,
    );
    // data[0] = unlocked, data[1] = unlock in progress, then up to 15 row/col
    // pairs of the keys to hold, 255 meaning "no key in this slot".
    const keys: { row: number; col: number }[] = [];
    for (let i = 0; i < 15; i++) {
      const row = data[2 + i * 2];
      const col = data[3 + i * 2];
      if (row !== 255 && col !== 255) {
        keys.push({ row, col });
      }
    }
    return { unlocked: data[0] === 1, inProgress: data[1] === 1, keys };
  }

  async unlockStart(): Promise<void> {
    await this.transport.send(new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_UNLOCK_START]), 20);
  }

  /** data[0] = unlocked flag, data[2] = remaining unlock counter (counts down to 0). */
  async unlockPoll(): Promise<{ unlocked: boolean; counter: number }> {
    const data = await this.transport.send(new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_UNLOCK_POLL]), 20);
    return { unlocked: data[0] === 1, counter: data[2] };
  }

  async lock(): Promise<void> {
    await this.transport.send(new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_LOCK]), 20);
  }

  /**
   * Polls the switch matrix state (requires the keyboard to be unlocked).
   * Returns the set of currently pressed positions as "row,col" strings.
   */
  async getMatrixState(): Promise<Set<string>> {
    const data = await this.transport.send(
      new Uint8Array([C.CMD_VIA_GET_KEYBOARD_VALUE, C.VIA_SWITCH_MATRIX_STATE]),
      3,
    );
    // Reply: 2 header bytes, then ceil(cols / 8) bytes per row; within a row
    // the *last* byte holds cols 0-7, bit index = col % 8.
    const rowSize = Math.ceil(this.cols / 8);
    const pressed = new Set<string>();
    for (let row = 0; row < this.rows; row++) {
      const rowStart = 2 + row * rowSize;
      for (let col = 0; col < this.cols; col++) {
        const byte = data[rowStart + rowSize - 1 - Math.floor(col / 8)];
        if ((byte >> col % 8) & 1) {
          pressed.add(`${row},${col}`);
        }
      }
    }
    return pressed;
  }
}

export interface UnlockStatus {
  unlocked: boolean;
  inProgress: boolean;
  /** Keys the user has to hold down to unlock the keyboard. */
  keys: { row: number; col: number }[];
}
