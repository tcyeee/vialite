// WebHID transport, replacing vial-gui's util.py::hid_send + hidproxy.py.
//
// Report-ID convention verified against the previous WASM build's glue code
// (src/index.html / src/worker.js in git history): the device uses report ID 0,
// and `device.sendReport(0, payload)` / `event.data` (32 bytes) carry the raw
// VIA/Vial message with no extra report-ID byte inside the payload itself.

import { MSG_LEN, VIAL_USAGE, VIAL_USAGE_PAGE } from "./constants.ts";

export class ProtocolError extends Error {}

interface PendingRead {
  resolve: (data: Uint8Array<ArrayBuffer>) => void;
}

export class HidTransport {
  private readonly device: HIDDevice;
  private pending: PendingRead[] = [];

  private constructor(device: HIDDevice) {
    this.device = device;
    this.device.addEventListener("inputreport", this.handleInputReport);
  }

  static async requestDevice(): Promise<HidTransport> {
    if (!("hid" in navigator)) {
      throw new ProtocolError("This browser does not support WebHID");
    }

    const devices = await navigator.hid.requestDevice({
      filters: [{ usagePage: VIAL_USAGE_PAGE, usage: VIAL_USAGE }],
    });
    const device = devices[0];
    if (!device) {
      throw new ProtocolError("No device selected");
    }
    if (!device.opened) {
      await device.open();
    }
    return new HidTransport(device);
  }

  get productName(): string {
    return this.device.productName;
  }

  get vendorId(): number {
    return this.device.vendorId;
  }

  get productId(): number {
    return this.device.productId;
  }

  async close(): Promise<void> {
    this.device.removeEventListener("inputreport", this.handleInputReport);
    if (this.device.opened) {
      await this.device.close();
    }
  }

  private handleInputReport = (event: HIDInputReportEvent) => {
    const data = new Uint8Array(event.data.buffer as ArrayBuffer, event.data.byteOffset, event.data.byteLength);
    const waiter = this.pending.shift();
    waiter?.resolve(data);
  };

  /**
   * Sends a command and waits for the matching reply, retrying on timeout.
   * Mirrors vial-gui's `hid_send`: pad to MSG_LEN, write, read with a
   * per-attempt timeout, retry up to `retries` times.
   */
  async send(cmd: Uint8Array<ArrayBuffer>, retries = 20, timeoutMs = 500): Promise<Uint8Array<ArrayBuffer>> {
    if (cmd.length > MSG_LEN) {
      throw new ProtocolError("message must be less than 32 bytes");
    }
    const msg = new Uint8Array(MSG_LEN);
    msg.set(cmd);

    for (let attempt = 0; attempt < retries; attempt++) {
      if (attempt > 0) {
        await sleep(500);
      }
      const data = await this.sendOnce(msg, timeoutMs);
      if (data) {
        return data;
      }
    }

    throw new ProtocolError("failed to communicate with the device");
  }

  private sendOnce(msg: Uint8Array<ArrayBuffer>, timeoutMs: number): Promise<Uint8Array<ArrayBuffer> | null> {
    return new Promise((resolve) => {
      const waiter: PendingRead = {
        resolve: (data) => {
          clearTimeout(timer);
          resolve(data);
        },
      };
      const timer = setTimeout(() => {
        const idx = this.pending.indexOf(waiter);
        if (idx >= 0) {
          this.pending.splice(idx, 1);
        }
        resolve(null);
      }, timeoutMs);

      this.pending.push(waiter);
      this.device.sendReport(0, msg).catch(() => {
        clearTimeout(timer);
        const idx = this.pending.indexOf(waiter);
        if (idx >= 0) {
          this.pending.splice(idx, 1);
        }
        resolve(null);
      });
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
