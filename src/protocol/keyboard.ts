// Ported (MVP subset) from vial-gui's protocol/keyboard_comm.py::Keyboard.
// Only what's needed for "view layers + remap keys/encoders + layout options"
// is implemented; macros, tap dance, combos, key overrides, RGB, QMK settings,
// and unlock/RESET are intentionally left out for now.

import pkg from "xz-decompress";
import * as C from "./constants.ts";
import { deserialize as kleDeserialize, type KleData, type KleKeyboard } from "./kleSerial.ts";
import { deserialize as kcDeserialize, serialize as kcSerialize, setKeycodeVersion } from "./keycodes.ts";
import { HidTransport, ProtocolError } from "./transport.ts";
import { normalizeVilKeycode, type ParsedVilFile, type VilRestoreReport, type VilSnapshot } from "./vilFile.ts";

const { XzReadableStream } = pkg;

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
  const stream = new Blob([data]).stream();
  const response = new Response(new XzReadableStream(stream));
  return response.text();
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

  /** `${layer},${row},${col}` -> qmk_id string */
  private layout = new Map<string, string>();
  /** `${layer},${index},${direction}` -> qmk_id string (direction: 0 = CCW, 1 = CW) */
  private encoderLayout = new Map<string, string>();

  constructor(transport: HidTransport) {
    this.transport = transport;
  }

  async reload(): Promise<void> {
    await this.reloadLayout();
    await this.reloadLayers();
    await this.reloadKeymap();
    await this.reloadLayoutOptions();
  }

  getKey(layer: number, row: number, col: number): string {
    return this.layout.get(`${layer},${row},${col}`) ?? "KC_NO";
  }

  getEncoder(layer: number, index: number, direction: 0 | 1): string {
    return this.encoderLayout.get(`${layer},${index},${direction}`) ?? "KC_NO";
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
  }

  private async reloadViaProtocol(): Promise<void> {
    const data = await this.transport.send(new Uint8Array([C.CMD_VIA_GET_PROTOCOL_VERSION]), 20);
    this.viaProtocol = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(1, false);
  }

  private checkProtocolVersion(): void {
    if (
      !C.SUPPORTED_VIA_PROTOCOL.includes(this.viaProtocol) ||
      !C.SUPPORTED_VIAL_PROTOCOL.includes(this.vialProtocol)
    ) {
      throw new ProtocolError(
        `Unsupported protocol version (via=${this.viaProtocol}, vial=${this.vialProtocol})`,
      );
    }
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

    data = await this.transport.send(new Uint8Array([C.CMD_VIA_VIAL_PREFIX, C.CMD_VIAL_GET_SIZE]), 20);
    let size = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true);

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

    const json = await decompressXz(concatUint8Arrays(chunks));
    const definition = JSON.parse(json) as VialDefinition;

    this.checkProtocolVersion();

    this.rows = definition.matrix.rows;
    this.cols = definition.matrix.cols;
    this.layoutLabels = definition.layouts.labels?.length ? definition.layouts.labels : null;

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
