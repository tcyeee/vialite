// Ported (MVP subset) from vial-gui's protocol/keyboard_comm.py::Keyboard.
// Only what's needed for "view layers + remap a single key" is implemented;
// macros, tap dance, combos, key overrides, RGB, QMK settings, unlock/RESET,
// and multi-layout-option handling are intentionally left out for now.

import pkg from "xz-decompress";
import * as C from "./constants.ts";
import { deserialize as kleDeserialize, type KleData, type KleKeyboard } from "./kleSerial.ts";
import { deserialize as kcDeserialize, serialize as kcSerialize } from "./keycodes.ts";
import { HidTransport, ProtocolError } from "./transport.ts";

const { XzReadableStream } = pkg;

export interface PhysicalKey {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhysicalEncoder {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VialDefinition {
  matrix: { rows: number; cols: number };
  layouts: { keymap: KleData };
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

  /** `${layer},${row},${col}` -> qmk_id string */
  private layout = new Map<string, string>();
  /** `${layer},${index},${direction}` -> qmk_id string (direction: 0 = CW, 1 = CCW) */
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

    const kb: KleKeyboard = kleDeserialize(definition.layouts.keymap);
    this.keys = [];
    this.encoders = [];

    for (const key of kb.keys) {
      if (key.labels[4] === "e") {
        const idx = Number((key.labels[0] ?? "0,0").split(",")[0]);
        this.encoders.push({ index: idx, x: key.x, y: key.y, width: key.width, height: key.height });
      } else if (!key.decal && key.labels[0] && key.labels[0].includes(",")) {
        // Decals are purely decorative (logos, labels) — they carry no matrix
        // position, so treating one as a key would alias it onto (0, 0).
        const [row, col] = key.labels[0].split(",").map(Number);
        this.keys.push({ row, col, x: key.x, y: key.y, width: key.width, height: key.height });
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

    for (let layer = 0; layer < this.layers; layer++) {
      for (const encoder of this.encoders) {
        const cmd = new Uint8Array([
          C.CMD_VIA_VIAL_PREFIX,
          C.CMD_VIAL_GET_ENCODER,
          layer,
          encoder.index,
        ]);
        const data = await this.transport.send(cmd, 20);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.encoderLayout.set(`${layer},${encoder.index},0`, kcSerialize(view.getUint16(0, false)));
        this.encoderLayout.set(`${layer},${encoder.index},1`, kcSerialize(view.getUint16(2, false)));
      }
    }
  }
}
