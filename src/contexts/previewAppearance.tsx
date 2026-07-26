// Shared source of truth for the keyboard preview's physical appearance —
// display size, key spacing, keycap width, case (外壳) radius/thickness/color and
// plate (定位板) color. Lifted out of KeyboardColorPanel so the same settings the
// user tunes on the 键盘配色 page also drive the interactive board on the main
// keymap page (both read this context). Each value persists to localStorage,
// scoped per connected keyboard (see `uid` below) so two different boards — or
// a real board and 功能预览's simulated one — never see each other's settings.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_CASE_COLOR,
  DEFAULT_CASE_RADIUS,
  DEFAULT_CASE_THICKNESS,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_POSITION,
  DEFAULT_FONT_SIZE,
  DEFAULT_KEY_SPACING,
  DEFAULT_KEYCAP_RADIUS,
  DEFAULT_KEYCAP_WIDTH,
  DEFAULT_PLATE_COLOR,
  DEFAULT_PREVIEW_STYLE,
  DEFAULT_WIREFRAME_LINE_COLOR,
  FONT_POSITIONS,
  FONT_SIZES,
  KEYCAP_RADIUS_LEVELS,
  PREVIEW_STYLES,
  SPACING_LEVELS,
  type FontPosition,
  type FontSize,
  type KeycapRadiusLevel,
  type PreviewSize,
  type PreviewStyle,
  type SpacingLevel,
} from "../components/keymap/layout/KeyboardLayoutPreview.tsx";

const SIZE_KEY = "vialite-color-preview-size";
const AUTO_FIT_KEY = "vialite-color-preview-autofit";
const SPACING_KEY = "vialite-color-key-spacing";
const KEYCAP_WIDTH_KEY = "vialite-color-keycap-width";
const CASE_RADIUS_KEY = "vialite-color-case-radius";
const KEYCAP_RADIUS_KEY = "vialite-color-keycap-radius";
const CASE_THICKNESS_KEY = "vialite-color-case-thickness";
const CASE_COLOR_KEY = "vialite-color-case-color";
const PLATE_COLOR_KEY = "vialite-color-plate-color";
const WIREFRAME_LINE_COLOR_KEY = "vialite-color-wireframe-line-color";
const KEYCAP_BORDER_KEY = "vialite-color-keycap-border";
const STYLE_KEY = "vialite-color-style";
const FONT_SIZE_KEY = "vialite-color-font-size";
const FONT_COLOR_KEY = "vialite-color-font-color";
const FONT_POSITION_KEY = "vialite-color-font-position";
const KEYCAP_PALETTE_KEY = "vialite-color-keycap-palette";
const KEYCAP_COLORS_KEY = "vialite-color-keycap-colors";

const SIZES: PreviewSize[] = ["xs", "s", "m", "l", "xl"];

/**
 * Namespaces a base storage key by the connected keyboard's `uid` (see
 * `Keyboard.uid` in protocol/keyboard.ts — a stable 64-bit id from
 * CMD_VIAL_GET_KEYBOARD_ID, populated before `PreviewAppearanceProvider` ever
 * mounts). Without this, every board sharing this browser — including
 * 功能预览's simulated keyboard, which has its own fixed uid — would read and
 * overwrite the same global appearance/paint settings.
 */
export function keyFor(base: string, uid: bigint): string {
  return `${base}::${uid.toString()}`;
}

function readStoredFontSize(key: string): FontSize {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw && (FONT_SIZES as string[]).includes(raw)) {
      return raw as FontSize;
    }
  } catch {
    // Fall through to default.
  }
  return DEFAULT_FONT_SIZE;
}

function readStoredFontPosition(key: string): FontPosition {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw && (FONT_POSITIONS as string[]).includes(raw)) {
      return raw as FontPosition;
    }
  } catch {
    // Fall through to default.
  }
  return DEFAULT_FONT_POSITION;
}

function readStoredStyle(key: string): PreviewStyle {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw && (PREVIEW_STYLES as string[]).includes(raw)) {
      return raw as PreviewStyle;
    }
  } catch {
    // Fall through to default.
  }
  return DEFAULT_PREVIEW_STYLE;
}

function readStoredLevel(key: string, fallback: SpacingLevel): SpacingLevel {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw && (SPACING_LEVELS as string[]).includes(raw)) {
      return raw as SpacingLevel;
    }
  } catch {
    // Fall through to default.
  }
  return fallback;
}

function readStoredKeycapRadius(key: string): KeycapRadiusLevel {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw && (KEYCAP_RADIUS_LEVELS as string[]).includes(raw)) {
      return raw as KeycapRadiusLevel;
    }
  } catch {
    // Fall through to default.
  }
  return DEFAULT_KEYCAP_RADIUS;
}

function readStoredSize(key: string): PreviewSize {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw && (SIZES as string[]).includes(raw)) {
      return raw as PreviewSize;
    }
  } catch {
    // Fall through to default.
  }
  return "m";
}

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // Fall through to default.
  }
  return fallback;
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    // Fall through to default.
  }
  return fallback;
}

function readStoredString(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Non-persistent is fine.
  }
}

function readStoredJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // Fall through to default.
  }
  return fallback;
}

function storeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-persistent is fine.
  }
}

/** One user-defined keycap color, referenced by id from {@link PreviewAppearanceValue.keycapColors} so editing it retroactively recolors every key using it — see 键帽上色 on the 键盘配色 page. */
export interface KeycapPaletteColor {
  id: string;
  hex: string;
}

interface PreviewAppearanceValue {
  /**
   * When on (the default), the preview ignores {@link size} and continuously
   * scales itself to the width available in its container — see
   * `useAutoFitZoom`. {@link size} is only consulted once this is off, which is
   * why the 个性化 page hides the 预览区域缩放 slider while it's on.
   */
  autoFit: boolean;
  size: PreviewSize;
  spacing: SpacingLevel;
  keycapWidth: SpacingLevel;
  caseRadius: SpacingLevel;
  keycapRadius: KeycapRadiusLevel;
  caseThickness: number;
  caseColor: string;
  plateColor: string;
  /** Wireframe (线稿) style outline color — see {@link DEFAULT_WIREFRAME_LINE_COLOR}. Code-level config only, no settings-panel UI yet (wireframe style itself isn't reachable there). */
  wireframeLineColor: string;
  keycapBorder: boolean;
  /** Board rendering style (立体感/风格) — see {@link PreviewStyle}. */
  style: PreviewStyle;
  fontSize: FontSize;
  fontColor: string;
  fontPosition: FontPosition;
  /** User-defined keycap colors (键帽上色 palette) — see {@link KeycapPaletteColor}. */
  keycapPalette: KeycapPaletteColor[];
  /** Per-key paint assignments: `"row,col"` → a {@link keycapPalette} entry's `id`. */
  keycapColors: Record<string, string>;
  setAutoFit: (value: boolean) => void;
  setSize: (value: PreviewSize) => void;
  setSpacing: (value: SpacingLevel) => void;
  setKeycapWidth: (value: SpacingLevel) => void;
  setCaseRadius: (value: SpacingLevel) => void;
  setKeycapRadius: (value: KeycapRadiusLevel) => void;
  setCaseThickness: (value: number) => void;
  setCaseColor: (value: string) => void;
  setPlateColor: (value: string) => void;
  setWireframeLineColor: (value: string) => void;
  setKeycapBorder: (value: boolean) => void;
  setStyle: (value: PreviewStyle) => void;
  setFontSize: (value: FontSize) => void;
  setFontColor: (value: string) => void;
  setFontPosition: (value: FontPosition) => void;
  /** Adds a new palette color and returns its id, so the caller can select it as the active brush immediately. */
  addKeycapColor: (hex: string) => string;
  /** Rewrites a palette entry's hex in place — every key already painted with this id updates too. */
  updateKeycapColor: (id: string, hex: string) => void;
  /** Removes a palette entry and clears any key assignments pointing at it (they revert to the default cap color). */
  removeKeycapColor: (id: string) => void;
  /** Paints (or, with `id: null`, erases) one key's color assignment. */
  paintKeycap: (row: number, col: number, id: string | null) => void;
  /**
   * Switches which device's settings this provider reads/writes — call with
   * `keyboard.uid` once a keyboard connects (App.tsx does this in an effect),
   * and with {@link NO_DEVICE} on disconnect. Every field above is fully
   * replaced with that device's stored values (or defaults, if it's never been
   * seen before); nothing here is shared or merged across devices.
   */
  setActiveDevice: (uid: bigint) => void;
}

const PreviewAppearanceContext = createContext<PreviewAppearanceValue | null>(null);

/**
 * Sentinel `uid` for "no keyboard connected yet" — matches `Keyboard`'s own
 * `uid = -1n` default (protocol/keyboard.ts), so this never collides with a
 * real device's id (from CMD_VIAL_GET_KEYBOARD_ID) or 功能预览's fixed demo uid.
 */
export const NO_DEVICE = -1n;

/**
 * Mounted once near the app root (see main.tsx), a single instance for the
 * whole session — it must NOT remount on every connect/disconnect, since it
 * wraps `<App/>` itself (see {@link useAutoFitZoom}'s top-level hook call,
 * which runs whether or not a keyboard is connected and so needs this context
 * always present) and `<App/>` owns the actual WebHID connection; tearing
 * this provider down would tear down the connection with it.
 *
 * Instead, switching the active device (via `setActiveDevice`, which App.tsx
 * calls in an effect whenever `keyboard` changes) is handled by a plain
 * `useEffect` below that re-reads every field from localStorage under the new
 * device's namespaced keys (see {@link keyFor}) and overwrites the in-memory
 * state to match — the same end result a remount would give, without ever
 * unmounting `children`.
 */
export function PreviewAppearanceProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<bigint>(NO_DEVICE);
  const [autoFit, setAutoFitState] = useState(true);
  const [size, setSizeState] = useState<PreviewSize>("m");
  const [spacing, setSpacingState] = useState<SpacingLevel>(DEFAULT_KEY_SPACING);
  // Keycap width is no longer user-configurable — fixed at the default (xl) so
  // the preview reads consistently. Any stale localStorage value is ignored.
  const [keycapWidth, setKeycapWidthState] = useState<SpacingLevel>(DEFAULT_KEYCAP_WIDTH);
  const [caseRadius, setCaseRadiusState] = useState<SpacingLevel>(DEFAULT_CASE_RADIUS);
  const [keycapRadius, setKeycapRadiusState] = useState<KeycapRadiusLevel>(DEFAULT_KEYCAP_RADIUS);
  const [caseThickness, setCaseThicknessState] = useState(DEFAULT_CASE_THICKNESS);
  const [caseColor, setCaseColorState] = useState(DEFAULT_CASE_COLOR);
  const [plateColor, setPlateColorState] = useState(DEFAULT_PLATE_COLOR);
  const [wireframeLineColor, setWireframeLineColorState] = useState(DEFAULT_WIREFRAME_LINE_COLOR);
  // Keycap border is no longer user-configurable — always off. Any stale
  // localStorage value is ignored.
  const [keycapBorder, setKeycapBorderState] = useState(false);
  const [style, setStyleState] = useState<PreviewStyle>(DEFAULT_PREVIEW_STYLE);
  const [fontSize, setFontSizeState] = useState<FontSize>(DEFAULT_FONT_SIZE);
  const [fontColor, setFontColorState] = useState(DEFAULT_FONT_COLOR);
  const [fontPosition, setFontPositionState] = useState<FontPosition>(DEFAULT_FONT_POSITION);
  const [keycapPalette, setKeycapPaletteState] = useState<KeycapPaletteColor[]>([]);
  const [keycapColors, setKeycapColorsState] = useState<Record<string, string>>({});

  // Runs on mount and every time the active device changes (never on a plain
  // re-render otherwise, since `uid` is the only dependency) — reloads every
  // field from that device's own namespaced storage, discarding whatever the
  // previously active device's values were.
  useEffect(() => {
    setAutoFitState(readStoredBoolean(keyFor(AUTO_FIT_KEY, uid), true));
    setSizeState(readStoredSize(keyFor(SIZE_KEY, uid)));
    setSpacingState(readStoredLevel(keyFor(SPACING_KEY, uid), DEFAULT_KEY_SPACING));
    setCaseRadiusState(readStoredLevel(keyFor(CASE_RADIUS_KEY, uid), DEFAULT_CASE_RADIUS));
    setKeycapRadiusState(readStoredKeycapRadius(keyFor(KEYCAP_RADIUS_KEY, uid)));
    setCaseThicknessState(readStoredNumber(keyFor(CASE_THICKNESS_KEY, uid), DEFAULT_CASE_THICKNESS));
    setCaseColorState(readStoredString(keyFor(CASE_COLOR_KEY, uid), DEFAULT_CASE_COLOR));
    setPlateColorState(readStoredString(keyFor(PLATE_COLOR_KEY, uid), DEFAULT_PLATE_COLOR));
    setWireframeLineColorState(
      readStoredString(keyFor(WIREFRAME_LINE_COLOR_KEY, uid), DEFAULT_WIREFRAME_LINE_COLOR),
    );
    setStyleState(readStoredStyle(keyFor(STYLE_KEY, uid)));
    setFontSizeState(readStoredFontSize(keyFor(FONT_SIZE_KEY, uid)));
    setFontColorState(readStoredString(keyFor(FONT_COLOR_KEY, uid), DEFAULT_FONT_COLOR));
    setFontPositionState(readStoredFontPosition(keyFor(FONT_POSITION_KEY, uid)));
    setKeycapPaletteState(readStoredJSON(keyFor(KEYCAP_PALETTE_KEY, uid), []));
    setKeycapColorsState(readStoredJSON(keyFor(KEYCAP_COLORS_KEY, uid), {}));
    // keycapWidth/keycapBorder are intentionally excluded — they're no longer
    // user-configurable (see the useState calls above) and always stay at
    // their fixed default regardless of which device is active.
  }, [uid]);

  const setActiveDevice = setUid;

  const setAutoFit = useCallback(
    (value: boolean) => {
      setAutoFitState(value);
      store(keyFor(AUTO_FIT_KEY, uid), String(value));
    },
    [uid],
  );
  const setSize = useCallback(
    (value: PreviewSize) => {
      setSizeState(value);
      store(keyFor(SIZE_KEY, uid), value);
    },
    [uid],
  );
  const setSpacing = useCallback(
    (value: SpacingLevel) => {
      setSpacingState(value);
      store(keyFor(SPACING_KEY, uid), value);
    },
    [uid],
  );
  const setKeycapWidth = useCallback(
    (value: SpacingLevel) => {
      setKeycapWidthState(value);
      store(keyFor(KEYCAP_WIDTH_KEY, uid), value);
    },
    [uid],
  );
  const setCaseRadius = useCallback(
    (value: SpacingLevel) => {
      setCaseRadiusState(value);
      store(keyFor(CASE_RADIUS_KEY, uid), value);
    },
    [uid],
  );
  const setKeycapRadius = useCallback(
    (value: KeycapRadiusLevel) => {
      setKeycapRadiusState(value);
      store(keyFor(KEYCAP_RADIUS_KEY, uid), value);
    },
    [uid],
  );
  const setCaseThickness = useCallback(
    (value: number) => {
      setCaseThicknessState(value);
      store(keyFor(CASE_THICKNESS_KEY, uid), String(value));
    },
    [uid],
  );
  const setCaseColor = useCallback(
    (value: string) => {
      setCaseColorState(value);
      store(keyFor(CASE_COLOR_KEY, uid), value);
    },
    [uid],
  );
  const setPlateColor = useCallback(
    (value: string) => {
      setPlateColorState(value);
      store(keyFor(PLATE_COLOR_KEY, uid), value);
    },
    [uid],
  );
  const setWireframeLineColor = useCallback(
    (value: string) => {
      setWireframeLineColorState(value);
      store(keyFor(WIREFRAME_LINE_COLOR_KEY, uid), value);
    },
    [uid],
  );
  const setKeycapBorder = useCallback(
    (value: boolean) => {
      setKeycapBorderState(value);
      store(keyFor(KEYCAP_BORDER_KEY, uid), String(value));
    },
    [uid],
  );
  const setStyle = useCallback(
    (value: PreviewStyle) => {
      setStyleState(value);
      store(keyFor(STYLE_KEY, uid), value);
    },
    [uid],
  );
  const setFontSize = useCallback(
    (value: FontSize) => {
      setFontSizeState(value);
      store(keyFor(FONT_SIZE_KEY, uid), value);
    },
    [uid],
  );
  const setFontColor = useCallback(
    (value: string) => {
      setFontColorState(value);
      store(keyFor(FONT_COLOR_KEY, uid), value);
    },
    [uid],
  );
  const setFontPosition = useCallback(
    (value: FontPosition) => {
      setFontPositionState(value);
      store(keyFor(FONT_POSITION_KEY, uid), value);
    },
    [uid],
  );
  const addKeycapColor = useCallback(
    (hex: string): string => {
      const id = crypto.randomUUID();
      setKeycapPaletteState((prev) => {
        const next = [...prev, { id, hex }];
        storeJSON(keyFor(KEYCAP_PALETTE_KEY, uid), next);
        return next;
      });
      return id;
    },
    [uid],
  );
  const updateKeycapColor = useCallback(
    (id: string, hex: string) => {
      setKeycapPaletteState((prev) => {
        const next = prev.map((c) => (c.id === id ? { id, hex } : c));
        storeJSON(keyFor(KEYCAP_PALETTE_KEY, uid), next);
        return next;
      });
    },
    [uid],
  );
  const removeKeycapColor = useCallback(
    (id: string) => {
      setKeycapPaletteState((prev) => {
        const next = prev.filter((c) => c.id !== id);
        storeJSON(keyFor(KEYCAP_PALETTE_KEY, uid), next);
        return next;
      });
      setKeycapColorsState((prev) => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => v !== id));
        storeJSON(keyFor(KEYCAP_COLORS_KEY, uid), next);
        return next;
      });
    },
    [uid],
  );
  const paintKeycap = useCallback(
    (row: number, col: number, id: string | null) => {
      setKeycapColorsState((prev) => {
        const key = `${row},${col}`;
        const next = { ...prev };
        if (id === null) {
          delete next[key];
        } else {
          next[key] = id;
        }
        storeJSON(keyFor(KEYCAP_COLORS_KEY, uid), next);
        return next;
      });
    },
    [uid],
  );

  const value = useMemo(
    () => ({
      autoFit,
      size,
      spacing,
      keycapWidth,
      caseRadius,
      keycapRadius,
      caseThickness,
      caseColor,
      plateColor,
      wireframeLineColor,
      keycapBorder,
      style,
      fontSize,
      fontColor,
      fontPosition,
      keycapPalette,
      keycapColors,
      setAutoFit,
      setSize,
      setSpacing,
      setKeycapWidth,
      setCaseRadius,
      setKeycapRadius,
      setCaseThickness,
      setCaseColor,
      setPlateColor,
      setWireframeLineColor,
      setKeycapBorder,
      setStyle,
      setFontSize,
      setFontColor,
      setFontPosition,
      addKeycapColor,
      updateKeycapColor,
      removeKeycapColor,
      paintKeycap,
      setActiveDevice,
    }),
    [
      autoFit,
      size,
      spacing,
      keycapWidth,
      caseRadius,
      keycapRadius,
      caseThickness,
      caseColor,
      plateColor,
      wireframeLineColor,
      keycapBorder,
      style,
      fontSize,
      fontColor,
      fontPosition,
      keycapPalette,
      keycapColors,
      setAutoFit,
      setSize,
      setSpacing,
      setKeycapWidth,
      setCaseRadius,
      setKeycapRadius,
      setCaseThickness,
      setCaseColor,
      setPlateColor,
      setWireframeLineColor,
      setKeycapBorder,
      setStyle,
      setFontSize,
      setFontColor,
      setFontPosition,
      addKeycapColor,
      updateKeycapColor,
      removeKeycapColor,
      paintKeycap,
      setActiveDevice,
    ],
  );

  return (
    <PreviewAppearanceContext.Provider value={value}>
      {children}
    </PreviewAppearanceContext.Provider>
  );
}

export function usePreviewAppearance(): PreviewAppearanceValue {
  const ctx = useContext(PreviewAppearanceContext);
  if (!ctx) {
    throw new Error("usePreviewAppearance must be used inside <PreviewAppearanceProvider>");
  }
  return ctx;
}
