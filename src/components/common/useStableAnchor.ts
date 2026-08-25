import { useMemo } from "react";

/**
 * Stabilizes a `{x, y}` anchor's object identity across unrelated re-renders. Shared by
 * KeyboardLayoutEditor and KeyboardLayoutPreview's right-click menus: `menu` itself only changes
 * on an actual right-click, but every render would otherwise rebuild `{x, y}` as a fresh object,
 * and the cascade selector treats a changed anchor reference as "reopen fresh", collapsing the
 * user's mid-drill-down back to the top level. Memoized on the coordinates themselves, so it's
 * only rebuilt when they actually move.
 */
export function useStableAnchor(menu: { x: number; y: number } | null): { x: number; y: number } | null {
  return useMemo(() => (menu ? { x: menu.x, y: menu.y } : null), [menu?.x, menu?.y]);
}
