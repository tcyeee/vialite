import type { MessageKey } from "../../contexts/i18n.tsx";

type PageMode =
  | "keymap"
  | "matrix"
  | "macro"
  | "tapdance"
  | "combo"
  | "rgb"
  | "color"
  | "advanced"
  | "preview3d";

export type NavKind =
  | "home"
  | "matrixTest"
  | "macro"
  | "tapDance"
  | "combo"
  | "rgb"
  | "keyboardColor"
  | "advanced"
  | "preview3d";

/** Canonical nav entries, driving NewHomePage's menu (there is no left sidebar anymore). */
export const NAV_ITEMS: { kind: NavKind; mode: PageMode; labelKey: MessageKey; icon: string; beta?: boolean }[] = [
  { kind: "home", mode: "keymap", labelKey: "navHome", icon: "mdi:home-outline" },
  { kind: "keyboardColor", mode: "color", labelKey: "navKeyboardColor", icon: "mdi:palette-outline" },
  { kind: "macro", mode: "macro", labelKey: "navMacro", icon: "mdi:script-text-outline" },
  { kind: "tapDance", mode: "tapdance", labelKey: "navTapDance", icon: "mdi:animation" },
  { kind: "combo", mode: "combo", labelKey: "navCombo", icon: "mdi:vector-combine" },
  { kind: "rgb", mode: "rgb", labelKey: "navRgb", icon: "mdi:led-strip-variant", beta: true },
  { kind: "matrixTest", mode: "matrix", labelKey: "navMatrixTest", icon: "mdi:view-grid-outline" },
  { kind: "advanced", mode: "advanced", labelKey: "navAdvanced", icon: "mdi:tune-variant" },
  { kind: "preview3d", mode: "preview3d", labelKey: "navPreview3d", icon: "mdi:cube-outline", beta: true },
];
