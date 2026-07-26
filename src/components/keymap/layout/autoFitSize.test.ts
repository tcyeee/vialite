import { describe, expect, it } from "vitest";
import { fitZoom, MAX_AUTO_FIT_ZOOM } from "./autoFitSize.ts";

describe("fitZoom", () => {
  const natural = 1000;

  it("scales the board down to the width available", () => {
    expect(fitZoom(natural, 500)).toBe(0.5);
    expect(fitZoom(natural, 250)).toBe(0.25);
  });

  it("shrinks without a floor so a narrow viewport still shows a whole board", () => {
    expect(fitZoom(natural, 10)).toBe(0.01);
    expect(fitZoom(natural, 1)).toBe(0.001);
  });

  it("never enlarges past the l level, however much room there is", () => {
    expect(fitZoom(natural, natural)).toBe(MAX_AUTO_FIT_ZOOM);
    expect(fitZoom(natural, natural * 10)).toBe(MAX_AUTO_FIT_ZOOM);
  });

  it("falls back to the cap for an unmeasured board or container", () => {
    expect(fitZoom(0, 500)).toBe(MAX_AUTO_FIT_ZOOM);
    expect(fitZoom(natural, 0)).toBe(MAX_AUTO_FIT_ZOOM);
    expect(fitZoom(Number.NaN, 500)).toBe(MAX_AUTO_FIT_ZOOM);
  });
});
