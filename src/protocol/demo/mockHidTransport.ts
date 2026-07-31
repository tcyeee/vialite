// A fake Vial keyboard firmware, standing in for a real HidTransport when the user enters
// 功能预览 (feature preview) from the connect screen — see useConnectionTransition.ts's
// handleConnectDemo. Answers the exact same wire protocol constants.ts/keyboard.ts define, so
// the real (unmodified) `Keyboard` class drives it exactly as it would a physical board: every
// panel that only talks to `Keyboard`'s public API works without knowing it's a fake.
//
// State (keymap, encoders, tap dance/combo, macros, QMK settings, VialRGB) starts from
// demoData.ts and is mutated in place by write commands, mirroring real firmware RAM — a
// reload (page refresh) starts fresh, same as power-cycling a board that never got its
// EEPROM save committed. The unlock and matrix-tester commands additionally *simulate*
// physical interaction the browser can't provide: UNLOCK_START auto-completes the unlock
// countdown, and the matrix-state poll plays back a short scripted "typing" sequence once
// unlocked, instead of requiring real key presses.

import * as C from "../constants.ts";
import { deserialize as kcDeserialize } from "../keycodes.ts";
import { Keyboard, packLayoutOptions, QMK_SETTINGS_WIDTH } from "../keyboard.ts";
import { serializeMacros } from "../macro.ts";
import type { ProtocolError, Transport } from "../transport.ts";
import { DEMO_LAYOUT_LABELS } from "./demoDefinition.ts";
import { DEMO_DEFINITION_XZ_BASE64 } from "./demoDefinitionCompressed.data.ts";
import {
  DEMO_COMBOS,
  DEMO_ENCODER,
  DEMO_LAYERS,
  DEMO_LAYER_COUNT,
  DEMO_MACROS,
  DEMO_MACRO_MEMORY,
  DEMO_PRODUCT_ID,
  DEMO_PRODUCT_NAME,
  DEMO_QMK_SETTINGS,
  DEMO_RGB,
  DEMO_TAP_DANCE,
  DEMO_UID,
  DEMO_VENDOR_ID,
  DEMO_VIAL_PROTOCOL,
  DEMO_VIA_PROTOCOL,
} from "./demoData.ts";

const MATRIX = { rows: 5, cols: 15 };

/** The (row,col) pair the on-screen unlock dialog tells the user to "hold" — LShift + RShift. */
const DEMO_UNLOCK_KEYS = [
  { row: 3, col: 0 },
  { row: 3, col: 11 },
];
const UNLOCK_STEPS = 4;

/** Matrix-tester playback: positions "typed" in sequence once unlocked (A S D, V, J K L). */
const MATRIX_DEMO_SEQUENCE: [number, number][] = [
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 4],
  [2, 7],
  [2, 8],
  [2, 9],
];
const MATRIX_DEMO_HOLD_MS = 350;
const MATRIX_DEMO_GAP_MS = 150;

interface TapDanceRaw {
  onTap: number;
  onHold: number;
  onDoubleTap: number;
  onTapHold: number;
  tappingTerm: number;
}

interface ComboRaw {
  keys: [number, number, number, number];
  output: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class MockHidTransport implements Transport {
  onDisconnect: (() => void) | null = null;
  // The fake firmware answers every command, so the link can never die under it — the field
  // exists only to satisfy Transport.
  onFatal: ((err: ProtocolError) => void) | null = null;
  readonly productName = DEMO_PRODUCT_NAME;
  readonly vendorId = DEMO_VENDOR_ID;
  readonly productId = DEMO_PRODUCT_ID;

  private readonly compressedDefinition = base64ToBytes(DEMO_DEFINITION_XZ_BASE64);

  // Populated lazily by ensureFirmwareState() — deferred until after the real Keyboard class
  // has read vialProtocol off CMD_VIAL_GET_KEYBOARD_ID and called setKeycodeVersion(), so
  // kcDeserialize() below resolves the same (v5 vs v6) numeric values a real board would.
  private firmwareReady = false;
  private keymap = new Uint16Array(DEMO_LAYER_COUNT * MATRIX.rows * MATRIX.cols);
  private readonly encoderMap = new Map<string, number>();
  private layoutOptions = 0;
  private tapDance: TapDanceRaw[] = [];
  private combos: ComboRaw[] = [];
  private macroBuffer = new Uint8Array(DEMO_MACRO_MEMORY);

  private readonly qmkSettings = new Map<number, number>(
    Object.entries(DEMO_QMK_SETTINGS).map(([k, v]): [number, number] => [Number(k), v]),
  );

  private rgbMode: number = DEMO_RGB.mode;
  private rgbSpeed: number = DEMO_RGB.speed;
  private rgbHsv: [number, number, number] = [...DEMO_RGB.hsv];

  private unlocked = false;
  private unlockInProgress = false;
  private unlockCounter = 0;
  private matrixDemoStart: number | null = null;

  private ensureFirmwareState(): void {
    if (this.firmwareReady) return;
    this.firmwareReady = true;

    for (let layer = 0; layer < DEMO_LAYER_COUNT; layer++) {
      const layerMap = DEMO_LAYERS[layer];
      for (let row = 0; row < MATRIX.rows; row++) {
        for (let col = 0; col < MATRIX.cols; col++) {
          const qmkId = layerMap[`${row},${col}`] ?? (layer === 0 ? "KC_NO" : "KC_TRNS");
          this.keymap[layer * MATRIX.rows * MATRIX.cols + row * MATRIX.cols + col] = safeDeserialize(qmkId);
        }
      }
      for (const direction of [0, 1] as const) {
        const qmkId = DEMO_ENCODER[`${layer},${direction}`] ?? "KC_TRNS";
        this.encoderMap.set(`${layer},${direction}`, safeDeserialize(qmkId));
      }
    }

    this.tapDance = DEMO_TAP_DANCE.map((e) => ({
      onTap: safeDeserialize(e.onTap),
      onHold: safeDeserialize(e.onHold),
      onDoubleTap: safeDeserialize(e.onDoubleTap),
      onTapHold: safeDeserialize(e.onTapHold),
      tappingTerm: e.tappingTerm,
    }));
    this.combos = DEMO_COMBOS.map((e) => ({
      keys: e.keys.map(safeDeserialize) as [number, number, number, number],
      output: safeDeserialize(e.output),
    }));

    this.macroBuffer.set(serializeMacros(DEMO_MACROS, DEMO_VIAL_PROTOCOL));
    this.layoutOptions = packLayoutOptions([0], DEMO_LAYOUT_LABELS);
  }

  async send(cmd: Uint8Array<ArrayBuffer>, _retries = 5, _timeoutMs = 500): Promise<Uint8Array<ArrayBuffer>> {
    void _retries;
    void _timeoutMs;
    // A believable-but-brisk stand-in for real HID round-trip latency, so loading states
    // (the connect handshake, per-field saves) still read as genuine rather than instant.
    await delay(6 + Math.random() * 10);
    const resp = new Uint8Array(C.MSG_LEN) as Uint8Array<ArrayBuffer>;
    this.dispatch(cmd, resp);
    return resp;
  }

  async close(): Promise<void> {
    this.onDisconnect = null;
    this.onFatal = null;
  }

  private dispatch(cmd: Uint8Array<ArrayBuffer>, resp: Uint8Array<ArrayBuffer>): void {
    const view = new DataView(resp.buffer, resp.byteOffset, resp.byteLength);
    const cv = new DataView(cmd.buffer, cmd.byteOffset, cmd.byteLength);

    if (cmd[0] === C.CMD_VIA_GET_PROTOCOL_VERSION) {
      view.setUint16(1, DEMO_VIA_PROTOCOL, false);
      return;
    }

    if (cmd[0] === C.CMD_VIA_VIAL_PREFIX) {
      this.dispatchVial(cmd, cv, resp, view);
      return;
    }

    switch (cmd[0]) {
      case C.CMD_VIA_GET_KEYBOARD_VALUE: {
        if (cmd[1] === C.VIA_LAYOUT_OPTIONS) {
          this.ensureFirmwareState();
          view.setUint32(2, this.layoutOptions, false);
        } else if (cmd[1] === C.VIA_SWITCH_MATRIX_STATE) {
          this.writeMatrixState(resp);
        }
        return;
      }
      case C.CMD_VIA_SET_KEYBOARD_VALUE: {
        if (cmd[1] === C.VIA_LAYOUT_OPTIONS) {
          this.ensureFirmwareState();
          this.layoutOptions = cv.getUint32(2, false);
        }
        return;
      }
      case C.CMD_VIA_SET_KEYCODE: {
        this.ensureFirmwareState();
        const [layer, row, col] = [cmd[1], cmd[2], cmd[3]];
        const code = cv.getUint16(4, false);
        this.keymap[layer * MATRIX.rows * MATRIX.cols + row * MATRIX.cols + col] = code;
        return;
      }
      case C.CMD_VIA_LIGHTING_SET_VALUE: {
        if (cmd[1] === C.VIALRGB_SET_MODE) {
          this.rgbMode = cv.getUint16(2, true);
          this.rgbSpeed = cmd[4];
          this.rgbHsv = [cmd[5], cmd[6], cmd[7]];
        }
        return;
      }
      case C.CMD_VIA_LIGHTING_GET_VALUE: {
        if (cmd[1] === C.VIALRGB_GET_INFO) {
          view.setUint16(2, 1, true); // VialRGB protocol version 1, the only one this app understands
          resp[4] = DEMO_RGB.maxBrightness;
        } else if (cmd[1] === C.VIALRGB_GET_SUPPORTED) {
          const from = cv.getUint16(2, true);
          const remaining = [...DEMO_RGB.supportedEffects].filter((e) => e > from).sort((a, b) => a - b);
          let i = 0;
          for (; i < 15 && i < remaining.length; i++) view.setUint16(2 + i * 2, remaining[i], true);
          for (; i < 15; i++) view.setUint16(2 + i * 2, 0xffff, true);
        } else if (cmd[1] === C.VIALRGB_GET_MODE) {
          view.setUint16(2, this.rgbMode, true);
          resp[4] = this.rgbSpeed;
          resp[5] = this.rgbHsv[0];
          resp[6] = this.rgbHsv[1];
          resp[7] = this.rgbHsv[2];
        }
        return;
      }
      case C.CMD_VIA_LIGHTING_SAVE:
        return; // RAM already is the source of truth for this session; nothing to commit.
      case C.CMD_VIA_MACRO_GET_COUNT:
        resp[1] = DEMO_MACROS.length;
        return;
      case C.CMD_VIA_MACRO_GET_BUFFER_SIZE:
        view.setUint16(1, DEMO_MACRO_MEMORY, false);
        return;
      case C.CMD_VIA_MACRO_GET_BUFFER: {
        this.ensureFirmwareState();
        const offset = cv.getUint16(1, false);
        const sz = cmd[3];
        resp.set(this.macroBuffer.subarray(offset, offset + sz), 4);
        return;
      }
      case C.CMD_VIA_MACRO_SET_BUFFER: {
        this.ensureFirmwareState();
        const offset = cv.getUint16(1, false);
        const sz = cmd[3];
        this.macroBuffer.set(cmd.subarray(4, 4 + sz), offset);
        return;
      }
      case C.CMD_VIA_GET_LAYER_COUNT:
        resp[1] = DEMO_LAYER_COUNT;
        return;
      case C.CMD_VIA_KEYMAP_GET_BUFFER: {
        this.ensureFirmwareState();
        const offset = cv.getUint16(1, false);
        const sz = cmd[3];
        for (let i = 0; i < sz; i += 2) {
          const code = this.keymap[(offset + i) / 2] ?? 0;
          resp[4 + i] = (code >> 8) & 0xff;
          resp[4 + i + 1] = code & 0xff;
        }
        return;
      }
      default:
        return;
    }
  }

  private dispatchVial(
    cmd: Uint8Array<ArrayBuffer>,
    cv: DataView,
    resp: Uint8Array<ArrayBuffer>,
    view: DataView,
  ): void {
    switch (cmd[1]) {
      case C.CMD_VIAL_GET_KEYBOARD_ID:
        view.setUint32(0, DEMO_VIAL_PROTOCOL, true);
        view.setBigUint64(4, DEMO_UID, true);
        return;
      case C.CMD_VIAL_GET_SIZE:
        view.setUint32(0, this.compressedDefinition.length, true);
        return;
      case C.CMD_VIAL_GET_DEFINITION: {
        const block = cv.getUint32(2, true);
        const offset = block * C.MSG_LEN;
        resp.set(this.compressedDefinition.subarray(offset, offset + C.MSG_LEN), 0);
        return;
      }
      case C.CMD_VIAL_GET_ENCODER: {
        this.ensureFirmwareState();
        const layer = cmd[2];
        view.setUint16(0, this.encoderMap.get(`${layer},0`) ?? 0, false);
        view.setUint16(2, this.encoderMap.get(`${layer},1`) ?? 0, false);
        return;
      }
      case C.CMD_VIAL_SET_ENCODER: {
        this.ensureFirmwareState();
        const [layer, direction] = [cmd[2], cmd[4]];
        this.encoderMap.set(`${layer},${direction}`, cv.getUint16(5, false));
        return;
      }
      case C.CMD_VIAL_GET_UNLOCK_STATUS: {
        resp[0] = this.unlocked ? 1 : 0;
        resp[1] = this.unlockInProgress ? 1 : 0;
        for (let i = 0; i < 15; i++) {
          const key = DEMO_UNLOCK_KEYS[i];
          resp[2 + i * 2] = key ? key.row : 255;
          resp[3 + i * 2] = key ? key.col : 255;
        }
        return;
      }
      case C.CMD_VIAL_UNLOCK_START:
        this.unlocked = false;
        this.unlockInProgress = true;
        this.unlockCounter = UNLOCK_STEPS;
        return;
      case C.CMD_VIAL_UNLOCK_POLL: {
        if (this.unlockInProgress) {
          this.unlockCounter = Math.max(0, this.unlockCounter - 1);
          if (this.unlockCounter === 0) {
            this.unlocked = true;
            this.unlockInProgress = false;
          }
        }
        resp[0] = this.unlocked ? 1 : 0;
        resp[2] = this.unlockCounter;
        return;
      }
      case C.CMD_VIAL_LOCK:
        this.unlocked = false;
        this.unlockInProgress = false;
        this.matrixDemoStart = null;
        return;
      case C.CMD_VIAL_QMK_SETTINGS_QUERY: {
        this.ensureFirmwareState();
        const from = cv.getUint16(2, true);
        const remaining = [...this.qmkSettings.keys()].filter((q) => q > from).sort((a, b) => a - b);
        let i = 0;
        for (; i < 16 && i < remaining.length; i++) view.setUint16(i * 2, remaining[i], true);
        for (; i < 16; i++) view.setUint16(i * 2, 0xffff, true);
        return;
      }
      case C.CMD_VIAL_QMK_SETTINGS_GET: {
        this.ensureFirmwareState();
        const qsid = cv.getUint16(2, true);
        const value = this.qmkSettings.get(qsid);
        if (value === undefined) {
          resp[0] = 1;
          return;
        }
        resp[0] = 0;
        const width = QMK_SETTINGS_WIDTH[qsid];
        for (let b = 0; b < width; b++) resp[1 + b] = (value >>> (8 * b)) & 0xff;
        return;
      }
      case C.CMD_VIAL_QMK_SETTINGS_SET: {
        this.ensureFirmwareState();
        const qsid = cv.getUint16(2, true);
        if (!this.qmkSettings.has(qsid)) {
          resp[0] = 1;
          return;
        }
        const width = QMK_SETTINGS_WIDTH[qsid];
        let value = 0;
        for (let b = 0; b < width; b++) value |= cmd[4 + b] << (8 * b);
        this.qmkSettings.set(qsid, value >>> 0);
        resp[0] = 0;
        return;
      }
      case C.CMD_VIAL_QMK_SETTINGS_RESET:
        resp[0] = 0;
        return;
      case C.CMD_VIAL_DYNAMIC_ENTRY_OP:
        this.dispatchDynamicEntry(cmd, cv, resp, view);
        return;
      default:
        return;
    }
  }

  private dispatchDynamicEntry(
    cmd: Uint8Array<ArrayBuffer>,
    cv: DataView,
    resp: Uint8Array<ArrayBuffer>,
    view: DataView,
  ): void {
    switch (cmd[2]) {
      case C.DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES:
        resp[0] = this.tapDance.length;
        resp[1] = this.combos.length;
        return;
      case C.DYNAMIC_VIAL_TAP_DANCE_GET: {
        this.ensureFirmwareState();
        const entry = this.tapDance[cmd[3]];
        resp[0] = entry ? 0 : 1;
        if (entry) {
          view.setUint16(1, entry.onTap, true);
          view.setUint16(3, entry.onHold, true);
          view.setUint16(5, entry.onDoubleTap, true);
          view.setUint16(7, entry.onTapHold, true);
          view.setUint16(9, entry.tappingTerm, true);
        }
        return;
      }
      case C.DYNAMIC_VIAL_TAP_DANCE_SET: {
        this.ensureFirmwareState();
        this.tapDance[cmd[3]] = {
          onTap: cv.getUint16(4, true),
          onHold: cv.getUint16(6, true),
          onDoubleTap: cv.getUint16(8, true),
          onTapHold: cv.getUint16(10, true),
          tappingTerm: cv.getUint16(12, true),
        };
        resp[0] = 0;
        return;
      }
      case C.DYNAMIC_VIAL_COMBO_GET: {
        this.ensureFirmwareState();
        const entry = this.combos[cmd[3]];
        resp[0] = entry ? 0 : 1;
        if (entry) {
          view.setUint16(1, entry.keys[0], true);
          view.setUint16(3, entry.keys[1], true);
          view.setUint16(5, entry.keys[2], true);
          view.setUint16(7, entry.keys[3], true);
          view.setUint16(9, entry.output, true);
        }
        return;
      }
      case C.DYNAMIC_VIAL_COMBO_SET: {
        this.ensureFirmwareState();
        this.combos[cmd[3]] = {
          keys: [cv.getUint16(4, true), cv.getUint16(6, true), cv.getUint16(8, true), cv.getUint16(10, true)],
          output: cv.getUint16(12, true),
        };
        resp[0] = 0;
        return;
      }
      default:
        // Key overrides / alt-repeat key: no UI reads these (see CLAUDE.md's known-gaps note),
        // so they're never actually requested — left unhandled rather than faked.
        return;
    }
  }

  private writeMatrixState(resp: Uint8Array<ArrayBuffer>): void {
    const rowSize = Math.ceil(MATRIX.cols / 8);
    const pressed = this.demoPressedPositions();
    for (const posKey of pressed) {
      const [row, col] = posKey.split(",").map(Number);
      const byteIndex = 2 + row * rowSize + rowSize - 1 - Math.floor(col / 8);
      resp[byteIndex] |= 1 << col % 8;
    }
  }

  /** Once unlocked, cycles a short "someone is typing" sequence for the matrix tester to display. */
  private demoPressedPositions(): Set<string> {
    if (!this.unlocked) return new Set();
    if (this.matrixDemoStart === null) this.matrixDemoStart = Date.now();
    const stepMs = MATRIX_DEMO_HOLD_MS + MATRIX_DEMO_GAP_MS;
    const elapsed = Date.now() - this.matrixDemoStart;
    const cycle = elapsed % (stepMs * MATRIX_DEMO_SEQUENCE.length);
    const stepIndex = Math.floor(cycle / stepMs);
    const withinStep = cycle % stepMs;
    if (withinStep >= MATRIX_DEMO_HOLD_MS) return new Set();
    const [row, col] = MATRIX_DEMO_SEQUENCE[stepIndex];
    return new Set([`${row},${col}`]);
  }
}

/** Demo data only ever names keycodes this build resolves; a throw here would be our own bug. */
function safeDeserialize(qmkId: string): number {
  try {
    return kcDeserialize(qmkId);
  } catch (err) {
    throw new Error(`[vialite demo] unresolvable keycode "${qmkId}" in demo data: ${String(err)}`);
  }
}

/** Builds a fresh preview-mode `Keyboard` backed by MockHidTransport — see useConnectionTransition.ts. */
export async function connectDemoKeyboard(): Promise<{ transport: MockHidTransport; keyboard: Keyboard }> {
  const transport = new MockHidTransport();
  const keyboard = new Keyboard(transport);
  await keyboard.reload();
  return { transport, keyboard };
}
