import { afterEach, describe, expect, it, vi } from "vitest";
import { HidTransport, isLinkFatal, ProtocolError } from "./transport.ts";
import { MSG_LEN } from "./constants.ts";

/**
 * A minimal stand-in for a WebHID device. `autoReply` mirrors a normal board (every report is
 * answered once); turning it off models the failure this suite is about — a device that stays
 * enumerated but stops answering.
 */
class FakeDevice {
  // Read (eagerly, for the debug log) by fromDevice.
  readonly productName = "Fake Board";
  readonly vendorId = 0x1234;
  readonly productId = 0x5678;
  readonly collections: HIDCollectionInfo[] = [];
  opened = true;
  autoReply = true;
  sent = 0;
  private listeners: ((event: HIDInputReportEvent) => void)[] = [];

  addEventListener(_type: string, fn: (event: HIDInputReportEvent) => void) {
    this.listeners.push(fn);
  }

  removeEventListener(_type: string, fn: (event: HIDInputReportEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }

  async open() {}
  async close() {}

  async sendReport(_reportId: number, _data: Uint8Array) {
    this.sent += 1;
    if (this.autoReply) {
      this.reply();
    }
  }

  /** Delivers an input report, exactly as the browser would. */
  reply(marker = 0) {
    const bytes = new Uint8Array(MSG_LEN);
    bytes[0] = marker;
    const event = { data: new DataView(bytes.buffer) } as HIDInputReportEvent;
    for (const l of [...this.listeners]) {
      l(event);
    }
  }

  get asDevice(): HIDDevice {
    return this as unknown as HIDDevice;
  }
}

function stubNavigator() {
  vi.stubGlobal("navigator", { hid: { addEventListener() {}, removeEventListener() {} } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HidTransport reply-sequence tracking", () => {
  it("recovers from a reply arriving with no command waiting for it", async () => {
    stubNavigator();
    const device = new FakeDevice();
    const transport = await HidTransport.fromDevice(device.asDevice);

    await transport.send(new Uint8Array([1]), 1, 50);
    // An unsolicited report — nothing asked for this one, so it pushes the received count past
    // the sent count. Before the resync, that offset was permanent: every later reply failed
    // the sequence check and only a page reload (a fresh transport) ever worked again.
    device.reply();

    await expect(transport.send(new Uint8Array([2]), 1, 50)).resolves.toBeInstanceOf(Uint8Array);
  });

  it("still discards a late reply whose command already timed out", async () => {
    stubNavigator();
    const device = new FakeDevice();
    device.autoReply = false;
    const transport = await HidTransport.fromDevice(device.asDevice);

    // One report goes out and times out; its reply lands afterwards, by which point the next
    // command is already waiting — and must not be handed that stale answer.
    const first = transport.send(new Uint8Array([1]), 1, 20);
    await expect(first).rejects.toThrow(ProtocolError);

    expect(device.sent).toBe(1);
  });
});

describe("HidTransport link death", () => {
  it("reports a device that stopped answering as fatal, exactly once", async () => {
    stubNavigator();
    const device = new FakeDevice();
    device.autoReply = false;
    const transport = await HidTransport.fromDevice(device.asDevice);

    const onFatal = vi.fn();
    transport.onFatal = onFatal;

    const err = await transport.send(new Uint8Array([1]), 1, 20).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProtocolError);
    expect((err as ProtocolError).code).toBe("commFailed");
    expect(isLinkFatal(err)).toBe(true);
    expect(onFatal).toHaveBeenCalledTimes(1);

    // Dead is dead: later commands fail immediately rather than burning another round of
    // retries against a device that isn't listening, and the UI is told only once.
    const sentBefore = device.sent;
    const second = await transport.send(new Uint8Array([2]), 1, 20).catch((e: unknown) => e);
    expect((second as ProtocolError).code).toBe("deviceDisconnected");
    expect(device.sent).toBe(sentBefore);
    expect(onFatal).toHaveBeenCalledTimes(1);
  });

  it("leaves onFatal unfired when the device was simply unplugged", async () => {
    let hidDisconnectHandler: ((event: HIDConnectionEvent) => void) | undefined;
    vi.stubGlobal("navigator", {
      hid: {
        addEventListener(_type: string, fn: (event: HIDConnectionEvent) => void) {
          hidDisconnectHandler = fn;
        },
        removeEventListener() {},
      },
    });
    const device = new FakeDevice();
    device.autoReply = false;
    const transport = await HidTransport.fromDevice(device.asDevice);

    const onFatal = vi.fn();
    const onDisconnect = vi.fn();
    transport.onFatal = onFatal;
    transport.onDisconnect = onDisconnect;

    hidDisconnectHandler?.({ device: device.asDevice } as HIDConnectionEvent);

    expect(onDisconnect).toHaveBeenCalledTimes(1);
    // The unplug is the whole story — the UI must not also be told the link died on its own.
    expect(onFatal).not.toHaveBeenCalled();

    const err = await transport.send(new Uint8Array([1]), 1, 20).catch((e: unknown) => e);
    expect((err as ProtocolError).code).toBe("deviceDisconnected");
    expect(onFatal).not.toHaveBeenCalled();
  });
});

describe("isLinkFatal", () => {
  it("is true only for the two terminal protocol codes", () => {
    expect(isLinkFatal(new ProtocolError("x", "commFailed"))).toBe(true);
    expect(isLinkFatal(new ProtocolError("x", "deviceDisconnected"))).toBe(true);
    expect(isLinkFatal(new ProtocolError("x", "malformedDefinition"))).toBe(false);
    expect(isLinkFatal(new ProtocolError("x"))).toBe(false);
    expect(isLinkFatal(new Error("boom"))).toBe(false);
  });
});
