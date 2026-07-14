// WebHID transport, replacing vial-gui's util.py::hid_send + hidproxy.py.
//
// Report-ID convention verified against the previous WASM build's glue code
// (src/index.html / src/worker.js in git history): the device uses report ID 0,
// and `device.sendReport(0, payload)` / `event.data` (32 bytes) carry the raw
// VIA/Vial message with no extra report-ID byte inside the payload itself.

import { MSG_LEN, VIAL_USAGE, VIAL_USAGE_PAGE } from "./constants.ts";

export class ProtocolError extends Error {}

interface PendingRead {
  /** Sequence number of the outgoing report this waiter expects a reply to. */
  expectSeq: number;
  resolve: (data: Uint8Array<ArrayBuffer> | null) => void;
}

export class HidTransport {
  private readonly device: HIDDevice;
  private waiter: PendingRead | null = null;
  // The device answers each report exactly once, in order, so reply N belongs
  // to report N. Tracking both counters lets us discard replies to reports
  // whose waiter already timed out, instead of delivering them to a later
  // command (which would leave every subsequent response off by one).
  private sentCount = 0;
  private recvCount = 0;
  // Serializes send() callers so only one command is in flight at a time.
  private sendChain: Promise<unknown> = Promise.resolve();
  private disconnected = false;

  /** Called once when the underlying device is unplugged. */
  onDisconnect: (() => void) | null = null;

  private constructor(device: HIDDevice) {
    this.device = device;
    this.device.addEventListener("inputreport", this.handleInputReport);
    navigator.hid.addEventListener("disconnect", this.handleHidDisconnect);
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
    return HidTransport.fromDevice(device);
  }

  /** Wraps an already-authorized device (e.g. from navigator.hid.getDevices()). */
  static async fromDevice(device: HIDDevice): Promise<HidTransport> {
    if (!device.opened) {
      await device.open();
    }
    return new HidTransport(device);
  }

  /** True if the device exposes the Vial raw-HID usage this transport needs. */
  static isVialDevice(device: HIDDevice): boolean {
    return device.collections.some((c) => c.usagePage === VIAL_USAGE_PAGE && c.usage === VIAL_USAGE);
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
    navigator.hid.removeEventListener("disconnect", this.handleHidDisconnect);
    this.onDisconnect = null;
    this.disconnected = true;
    this.failPending();
    if (this.device.opened) {
      await this.device.close();
    }
  }

  private handleHidDisconnect = (event: HIDConnectionEvent) => {
    if (event.device !== this.device) {
      return;
    }
    this.disconnected = true;
    this.failPending();
    navigator.hid.removeEventListener("disconnect", this.handleHidDisconnect);
    this.onDisconnect?.();
  };

  /** Fails the in-flight read (if any) so callers stop waiting immediately. */
  private failPending(): void {
    const waiter = this.waiter;
    this.waiter = null;
    waiter?.resolve(null);
  }

  private handleInputReport = (event: HIDInputReportEvent) => {
    const data = new Uint8Array(event.data.buffer as ArrayBuffer, event.data.byteOffset, event.data.byteLength);
    this.recvCount += 1;
    const waiter = this.waiter;
    if (waiter && this.recvCount === waiter.expectSeq) {
      this.waiter = null;
      waiter.resolve(data);
    }
    // Otherwise this is a late reply to a report whose waiter already timed
    // out — drop it so it can't be mistaken for the next command's reply.
  };

  /**
   * Sends a command and waits for the matching reply, retrying on timeout.
   * Mirrors vial-gui's `hid_send`: pad to MSG_LEN, write, read with a
   * per-attempt timeout, retry up to `retries` times. Calls are serialized;
   * only one command is ever in flight at a time.
   */
  async send(cmd: Uint8Array<ArrayBuffer>, retries = 5, timeoutMs = 500): Promise<Uint8Array<ArrayBuffer>> {
    if (cmd.length > MSG_LEN) {
      throw new ProtocolError("message must be less than 32 bytes");
    }
    const msg = new Uint8Array(MSG_LEN);
    msg.set(cmd);

    const run = this.sendChain.then(() => this.sendSerialized(msg, retries, timeoutMs));
    // Keep the chain alive even when this send fails.
    this.sendChain = run.catch(() => {});
    return run;
  }

  private async sendSerialized(
    msg: Uint8Array<ArrayBuffer>,
    retries: number,
    timeoutMs: number,
  ): Promise<Uint8Array<ArrayBuffer>> {
    for (let attempt = 0; attempt < retries; attempt++) {
      if (this.disconnected) {
        throw new ProtocolError("device disconnected");
      }
      if (attempt > 0) {
        await sleep(500);
      }
      // If a previous report's reply is still outstanding, give it a short
      // drain window so it gets discarded here rather than crossing with the
      // next report (the sequence check would drop it anyway, but draining
      // avoids burning a retry on a crossed reply).
      if (this.recvCount < this.sentCount) {
        await sleep(200);
      }
      const data = await this.sendOnce(msg, timeoutMs);
      if (data) {
        return data;
      }
    }

    if (this.disconnected) {
      throw new ProtocolError("device disconnected");
    }
    throw new ProtocolError("failed to communicate with the device");
  }

  private sendOnce(msg: Uint8Array<ArrayBuffer>, timeoutMs: number): Promise<Uint8Array<ArrayBuffer> | null> {
    return new Promise((resolve) => {
      const waiter: PendingRead = {
        expectSeq: this.sentCount + 1,
        resolve: (data) => {
          clearTimeout(timer);
          resolve(data);
        },
      };
      const timer = setTimeout(() => {
        if (this.waiter === waiter) {
          this.waiter = null;
        }
        resolve(null);
      }, timeoutMs);

      this.waiter = waiter;
      this.sentCount += 1;
      this.device.sendReport(0, msg).catch(() => {
        // The report never reached the device, so no reply will come for it.
        this.sentCount -= 1;
        if (this.waiter === waiter) {
          this.waiter = null;
        }
        waiter.resolve(null);
      });
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
