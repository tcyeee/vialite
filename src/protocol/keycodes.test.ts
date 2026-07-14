import { describe, expect, it } from "vitest";
import { deserialize, label, serialize } from "./keycodes.ts";

describe("keycodes", () => {
  it("round-trips well-known basic keycodes", () => {
    for (const qmkId of ["KC_NO", "KC_TRNS", "KC_A", "KC_Z", "KC_1", "KC_ENTER", "KC_SPACE", "KC_F12", "KC_LCTRL", "KC_RGUI"]) {
      expect(serialize(deserialize(qmkId))).toBe(qmkId);
    }
  });

  it("maps basic keycodes to their USB HID usage IDs", () => {
    expect(deserialize("KC_NO")).toBe(0x00);
    expect(deserialize("KC_TRNS")).toBe(0x01);
    expect(deserialize("KC_A")).toBe(0x04);
    expect(deserialize("KC_ENTER")).toBe(0x28);
    expect(deserialize("KC_LCTRL")).toBe(0xe0);
  });

  it("passes raw hex identifiers through deserialize", () => {
    expect(deserialize("0x1234")).toBe(0x1234);
    expect(deserialize("0x7c00")).toBe(0x7c00);
  });

  it("serializes codes outside the table as raw hex identifiers", () => {
    const unknown = serialize(0x7777);
    expect(unknown).toMatch(/^0x[0-9a-f]+$/);
    expect(deserialize(unknown)).toBe(0x7777);
  });

  it("labels known ids and falls back to the id itself", () => {
    expect(label("KC_ENTER")).toBe("Enter");
    expect(label("0x7777")).toBe("0x7777");
  });
});
