import { describe, expect, it } from "vitest";
import { deserialize, type KleData } from "./kleSerial.ts";

describe("kleSerial deserialize", () => {
  it("lays out a plain grid row by row", () => {
    const data: KleData = [
      ["0,0", "0,1", "0,2"],
      ["1,0", "1,1"],
    ];
    const { keys } = deserialize(data);
    expect(keys).toHaveLength(5);
    expect(keys.map((k) => [k.x, k.y])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ]);
    for (const key of keys) {
      expect(key.width).toBe(1);
      expect(key.height).toBe(1);
    }
  });

  it("skips a leading metadata object without consuming a row", () => {
    const data: KleData = [{ name: "Test board" }, ["0,0"]];
    const { keys } = deserialize(data);
    expect(keys).toHaveLength(1);
    expect(keys[0].y).toBe(0);
  });

  it("applies x/y offsets and w/h sizes, resetting size after each key", () => {
    // Realistic 60% bottom-row fragment: 1.25u mods and a 6.25u spacebar.
    const data: KleData = [
      [{ y: 0.5, x: 0.25 }, "0,0", { w: 1.25 }, "0,1", { w: 6.25 }, "0,2", "0,3"],
    ];
    const { keys } = deserialize(data);
    expect(keys[0]).toMatchObject({ x: 0.25, y: 0.5, width: 1 });
    expect(keys[1]).toMatchObject({ x: 1.25, y: 0.5, width: 1.25 });
    expect(keys[2]).toMatchObject({ x: 2.5, y: 0.5, width: 6.25 });
    // Size resets to 1u after the wide key.
    expect(keys[3]).toMatchObject({ x: 8.75, y: 0.5, width: 1, height: 1 });
  });

  it("carries rotation cluster origin and angle onto keys", () => {
    const data: KleData = [
      [{ r: 15, rx: 3, ry: 2 }, "0,0", "0,1"],
      ["1,0"],
    ];
    const { keys } = deserialize(data);
    expect(keys[0]).toMatchObject({ x: 3, y: 2, rotationAngle: 15, rotationX: 3, rotationY: 2 });
    expect(keys[1]).toMatchObject({ x: 4, y: 2, rotationAngle: 15 });
    // Next row starts back at the cluster origin x, one unit down.
    expect(keys[2]).toMatchObject({ x: 3, y: 3, rotationAngle: 15 });
  });

  it("parses oversized second rectangles (ISO enter style)", () => {
    const data: KleData = [[{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, "0,0", "0,1"]];
    const { keys } = deserialize(data);
    expect(keys[0]).toMatchObject({ width: 1.25, height: 2, width2: 1.5, height2: 1, x2: -0.25 });
    // Plain keys fall back to width2/height2 == width/height.
    expect(keys[1]).toMatchObject({ width: 1, height: 1, width2: 1, height2: 1, x2: 0 });
  });

  it("marks decal keys and resets the flag for the following key", () => {
    const data: KleData = [[{ d: true }, "logo", "0,0"]];
    const { keys } = deserialize(data);
    expect(keys[0].decal).toBe(true);
    expect(keys[1].decal).toBe(false);
  });

  it("reorders labels so layout options land at index 8 (default align)", () => {
    // VIA/Vial convention: "row,col\n\n\noption,choice".
    const data: KleData = [["0,0\n\n\n1,1"]];
    const { keys } = deserialize(data);
    expect(keys[0].labels[0]).toBe("0,0");
    expect(keys[0].labels[8]).toBe("1,1");
  });

  it("reorders labels per the active align property", () => {
    const data: KleData = [[{ a: 0 }, "TL\nBL"]];
    const { keys } = deserialize(data);
    // align 0: raw index 0 -> 0, raw index 1 -> 6.
    expect(keys[0].labels[0]).toBe("TL");
    expect(keys[0].labels[6]).toBe("BL");
  });

  it("exposes Vial encoder markers at label index 4", () => {
    // Vial marks encoders with "e" in the center-front label (raw index 9).
    const data: KleData = [["0,0\n\n\n\n\n\n\n\n\ne", "1,0"]];
    const { keys } = deserialize(data);
    expect(keys[0].labels[4]).toBe("e");
    expect(keys[0].labels[0]).toBe("0,0");
    expect(keys[1].labels[4]).toBeNull();
  });
});
