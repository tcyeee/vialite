// WebHID transport, replacing vial-gui's util.py::hid_send + hidproxy.py.
//
// Report-ID convention verified against the previous WASM build's glue code
// (src/index.html / src/worker.js in git history): the device uses report ID 0,
// and `device.sendReport(0, payload)` / `event.data` (32 bytes) carry the raw
// VIA/Vial message with no extra report-ID byte inside the payload itself.

import { debugLog } from "../debug.ts";
import { MSG_LEN, VIAL_USAGE, VIAL_USAGE_PAGE } from "./constants.ts";

/**
 * Stable identifier for a protocol failure the UI is expected to explain in the
 * user's language. `src/protocol/` is framework-agnostic and can't reach the
 * i18n dictionary itself, so the Error keeps an English `message` (technical
 * detail, for the console) and carries a code the UI maps to a translated
 * string — see `describeConnectError` in App.tsx.
 */
export type ProtocolErrorCode =
  | "webhidUnsupported"
  | "noDeviceSelected"
  | "deviceDisconnected"
  | "commFailed"
  | "viaOnlyKeyboard"
  | "unsupportedProtocol"
  | "malformedDefinition";

export class ProtocolError extends Error {
  readonly code?: ProtocolErrorCode;
  /** Interpolation params for the translated message (e.g. protocol versions). */
  readonly params?: Record<string, string | number>;

  constructor(message: string, code?: ProtocolErrorCode, params?: Record<string, string | number>) {
    super(message);
    this.code = code;
    this.params = params;
  }
}

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
      throw new ProtocolError("This browser does not support WebHID", "webhidUnsupported");
    }

    const devices = await navigator.hid.requestDevice({
      filters: [{ usagePage: VIAL_USAGE_PAGE, usage: VIAL_USAGE }],
    });
    const device = devices[0];
    if (!device) {
      throw new ProtocolError("No device selected", "noDeviceSelected");
    }
    return HidTransport.fromDevice(device);
  }

  /** Wraps an already-authorized device (e.g. from navigator.hid.getDevices()). */
  static async fromDevice(device: HIDDevice): Promise<HidTransport> {
    debugLog(
      "[vialite] opening device:",
      JSON.stringify({
        productName: device.productName,
        vendorId: `0x${device.vendorId.toString(16).padStart(4, "0")}`,
        productId: `0x${device.productId.toString(16).padStart(4, "0")}`,
        alreadyOpened: device.opened,
        hasVialInterface: HidTransport.hasVialInterface(device),
        collections: device.collections.map((c) => ({
          usagePage: c.usagePage,
          usage: c.usage,
        })),
      }),
    );
    if (!device.opened) {
      try {
        await device.open();
      } catch (err) {
        console.error("[vialite] device.open() failed:", err);
        throw err;
      }
    }
    debugLog("[vialite] device opened successfully");
    return new HidTransport(device);
  }

  /**
   * True if the device exposes the raw-HID usage this transport needs.
   *
   * A necessary precondition, not proof the board speaks Vial: VIA and Vial
   * share the same usage page/usage, and nothing else in the HID descriptor
   * distinguishes them, so a VIA-only board passes this too. Telling them apart
   * requires actually handshaking — see `probeVial` in keyboard.ts.
   */
  static hasVialInterface(device: HIDDevice): boolean {
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
        throw new ProtocolError("device disconnected", "deviceDisconnected");
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
      throw new ProtocolError("device disconnected", "deviceDisconnected");
    }
    throw new ProtocolError("failed to communicate with the device", "commFailed");
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
