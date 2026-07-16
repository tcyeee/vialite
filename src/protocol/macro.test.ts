import { describe, expect, it } from "vitest";
import { VIAL_PROTOCOL_ADVANCED_MACROS } from "./constants.ts";
import { deserialize as kcDeserialize } from "./keycodes.ts";
import {
  deserializeMacro,
  deserializeMacros,
  serializeMacro,
  serializeMacros,
  type MacroAction,
} from "./macro.ts";

const V1 = VIAL_PROTOCOL_ADVANCED_MACROS - 1;
const V2 = VIAL_PROTOCOL_ADVANCED_MACROS;

describe("macro action serialization", () => {
  it("round-trips text/tap/down/up actions on v1 (no QMK prefix, no delay)", () => {
    const actions: MacroAction[] = [
      { kind: "text", text: "hello" },
      { kind: "tap", keycodes: ["KC_A"] },
      { kind: "down", keycodes: ["KC_LSHIFT"] },
      { kind: "up", keycodes: ["KC_LSHIFT"] },
    ];
    const data = serializeMacro(actions, V1);
    expect(deserializeMacro(data, V1)).toEqual(actions);
  });

  it("merges consecutive same-kind single-keycode actions into one multi-keycode action", () => {
    const actions: MacroAction[] = [
      { kind: "down", keycodes: ["KC_LCTRL"] },
      { kind: "down", keycodes: ["KC_LSHIFT"] },
    ];
    const data = serializeMacro(actions, V2);
    expect(deserializeMacro(data, V2)).toEqual([{ kind: "down", keycodes: ["KC_LCTRL", "KC_LSHIFT"] }]);
  });

  it("round-trips delay actions on v2 only", () => {
    const actions: MacroAction[] = [{ kind: "delay", ms: 500 }];
    const data = serializeMacro(actions, V2);
    expect(deserializeMacro(data, V2)).toEqual(actions);
    expect(() => serializeMacro(actions, V1)).toThrow();
  });

  it("round-trips extended (>=256) keycodes on v2, including the 0xFF00 encoding trick", () => {
    // Compare by resolved numeric value, not the qmk_id string — serialize()
    // may return a table name (e.g. "LALT(KC_NO)") for a code that happens to
    // be well-known, instead of echoing the raw hex identifier back.
    for (const raw of ["0x0400", "0x0401", "0x1234"]) {
      const data = serializeMacro([{ kind: "tap", keycodes: [raw] }], V2);
      const [action] = deserializeMacro(data, V2);
      expect(action.kind).toBe("tap");
      expect(action.kind === "tap" && kcDeserialize(action.keycodes[0])).toBe(kcDeserialize(raw));
    }
  });

  it("interleaves text and keycode actions without losing boundaries", () => {
    const actions: MacroAction[] = [
      { kind: "text", text: "go " },
      { kind: "tap", keycodes: ["KC_ENTER"] },
      { kind: "text", text: " done" },
    ];
    const data = serializeMacro(actions, V2);
    expect(deserializeMacro(data, V2)).toEqual(actions);
  });
});

describe("multi-macro buffer", () => {
  it("joins and splits macros with NUL separators, padding/truncating to macroCount", () => {
    const macros: MacroAction[][] = [
      [{ kind: "text", text: "a" }],
      [{ kind: "tap", keycodes: ["KC_B"] }],
    ];
    const data = serializeMacros(macros, V2);
    // a\x00 + (QMK_PREFIX,TAP,'B')\x00 = 2 + 4 = 6 bytes
    expect(Array.from(data.subarray(0, 2))).toEqual([0x61, 0x00]);

    expect(deserializeMacros(data, 2, V2)).toEqual(macros);
    // Fewer slots than macroCount pads with empty macros.
    expect(deserializeMacros(data, 3, V2)).toEqual([...macros, []]);
    // More slots than macroCount truncates.
    expect(deserializeMacros(data, 1, V2)).toEqual([macros[0]]);
  });
});
