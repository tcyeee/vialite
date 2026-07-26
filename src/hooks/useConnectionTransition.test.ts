import { describe, expect, it } from "vitest";
import { describeConnectError } from "./useConnectionTransition.ts";
import { ProtocolError } from "../protocol/transport.ts";

describe("describeConnectError", () => {
  it("maps a coded ProtocolError to its i18n key and forwards its params", () => {
    const err = new ProtocolError("board is VIA-only", "viaOnlyKeyboard", { via: 9, vial: 6 });
    expect(describeConnectError(err)).toEqual({
      key: "errViaOnlyKeyboard",
      params: { via: 9, vial: 6 },
    });
  });

  it("maps every coded ProtocolErrorCode without params", () => {
    const err = new ProtocolError("device stopped responding", "commFailed");
    expect(describeConnectError(err)).toEqual({ key: "errCommFailed", params: undefined });
  });

  it("falls back to errConnectFailed for a ProtocolError with no code", () => {
    const err = new ProtocolError("unexpected shape");
    expect(describeConnectError(err)).toEqual({
      key: "errConnectFailed",
      params: { error: "unexpected shape" },
    });
  });

  it("falls back to errConnectFailed for a plain Error, surfacing its message", () => {
    const err = new Error("boom");
    expect(describeConnectError(err)).toEqual({
      key: "errConnectFailed",
      params: { error: "boom" },
    });
  });

  it("falls back to errConnectFailed for a non-Error thrown value, stringifying it", () => {
    expect(describeConnectError("some string throw")).toEqual({
      key: "errConnectFailed",
      params: { error: "some string throw" },
    });
  });
});
