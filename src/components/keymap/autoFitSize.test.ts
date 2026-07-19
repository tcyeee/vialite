import { describe, expect, it } from "vitest";
import { pickFitSize } from "./autoFitSize.ts";
import { PREVIEW_ZOOM } from "./KeyboardLayoutPreview.tsx";

describe("pickFitSize", () => {
  const natural = 1000;

  it("picks the largest level that fits", () => {
    // Ample room: the biggest level fits.
    expect(pickFitSize(natural, 5000)).toBe("xl");
    // Just enough for 1× (m), but not l.
    expect(pickFitSize(natural, natural * PREVIEW_ZOOM.m)).toBe("m");
    // Between s and m.
    expect(pickFitSize(natural, natural * PREVIEW_ZOOM.m - 1)).toBe("s");
  });

  it("floors at xs when even the smallest level overflows", () => {
    expect(pickFitSize(natural, natural * PREVIEW_ZOOM.xs - 1)).toBe("xs");
    expect(pickFitSize(natural, 1)).toBe("xs");
  });

  it("treats an exact fit as fitting (<=)", () => {
    expect(pickFitSize(natural, natural * PREVIEW_ZOOM.xl)).toBe("xl");
    expect(pickFitSize(natural, natural * PREVIEW_ZOOM.s)).toBe("s");
  });
});
