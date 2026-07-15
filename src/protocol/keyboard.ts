// Ported (MVP subset) from vial-gui's protocol/keyboard_comm.py::Keyboard.
// Only what's needed for "view layers + remap keys/encoders + layout options"
// is implemented; macros, tap dance, combos, key overrides, RGB, QMK settings,
// and unlock/RESET are intentionally left out for now.

import pkg from "xz-decompress";
import * as C from "./constants.ts";
import { deserialize as kleDeserialize, type KleData, type KleKeyboard } from "./kleSerial.ts";
import { deserialize as kcDeserialize, serialize as kcSerialize, setKeycodeVersion } from "./keycodes.ts";
import { HidTransport, ProtocolError } from "./transport.ts";

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
    if (!this.layoutLabels) {
      return;
    }
    const options = packLayoutOptions(choices, this.layoutLabels);
    if (this.layoutOptions === -1 || this.layoutOptions === options) {
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
    this.vialProtocol = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true);
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
    this.layoutLabels = definition.layouts.labels ?? null;

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

    if (this.layoutLabels) {
      const data = await this.transport.send(
        new Uint8Array([C.CMD_VIA_GET_KEYBOARD_VALUE, C.VIA_LAYOUT_OPTIONS]),
        20,
      );
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      this.layoutOptions = view.getUint32(2, false);
    }
  }
}
