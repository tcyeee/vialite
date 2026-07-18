import { describe, expect, it } from "vitest";
import { buildModCombo, deserialize, keyBehavior, label, serialize } from "./keycodes.ts";

const combo = (
  parts: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; gui: boolean; side: "L" | "R" }>,
  tap: string,
) => buildModCombo({ ctrl: false, shift: false, alt: false, gui: false, side: "L", ...parts }, tap);

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

  describe("buildModCombo (fire-together masked modifiers)", () => {
    it("builds single and named-combo forms that stay fire-together", () => {
      expect(combo({ ctrl: true }, "KC_A")).toBe("LCTL(KC_A)");
      expect(combo({ shift: true }, "KC_A")).toBe("LSFT(KC_A)");
      expect(combo({ ctrl: true, shift: true }, "KC_A")).toBe("C_S(KC_A)");
      expect(combo({ ctrl: true, alt: true }, "KC_A")).toBe("LCA(KC_A)");
      expect(combo({ ctrl: true, shift: true, alt: true, gui: true }, "KC_A")).toBe("HYPR(KC_A)");
      expect(combo({ shift: true, side: "R" }, "KC_A")).toBe("RSFT(KC_A)");
      for (const c of ["LCTL(KC_A)", "C_S(KC_A)", "HYPR(KC_A)", "RSFT(KC_A)"]) {
        expect(keyBehavior(c).kind).toBe("modCombo");
      }
    });

    it("collapses to the plain tap when no modifier is selected", () => {
      expect(combo({}, "KC_A")).toBe("KC_A");
    });

    it("returns a non-composite code for masks with no fire-together name", () => {
      // Right-side Ctrl+Shift has no canonical masked form: callers must reject
      // it by checking keyBehavior(...).kind !== "modCombo".
      const built = combo({ ctrl: true, shift: true, side: "R" }, "KC_A");
      expect(keyBehavior(built).kind).not.toBe("modCombo");
    });
  });
});
