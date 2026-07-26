import { describe, expect, it } from "vitest";
import { shouldInterceptNavigation } from "./usePageNavigation.ts";

describe("shouldInterceptNavigation", () => {
  it("intercepts leaving the advanced page for another page while changes are pending", () => {
    expect(shouldInterceptNavigation("advanced", "keymap", 1)).toBe(true);
  });

  it("does not intercept navigating from advanced to advanced, even with changes pending", () => {
    expect(shouldInterceptNavigation("advanced", "advanced", 1)).toBe(false);
  });

  it("does not intercept leaving the advanced page when nothing is pending", () => {
    expect(shouldInterceptNavigation("advanced", "keymap", 0)).toBe(false);
  });

  it("does not intercept navigation that doesn't start from the advanced page", () => {
    expect(shouldInterceptNavigation("newHome", "keymap", 5)).toBe(false);
  });
});
