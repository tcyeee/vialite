// Shared source of truth for the keyboard preview's physical appearance —
// display size, key spacing, keycap width, case (外壳) radius/thickness/color and
// plate (定位板) color. Lifted out of KeyboardColorPanel so the same settings the
// user tunes on the 键盘配色 page also drive the interactive board on the main
// keymap page (both read this context). Each value persists to localStorage.

import {
  createContext,
  useCallback,
  useContext,
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
} from "../components/keymap/KeyboardLayoutPreview.tsx";

const SIZE_KEY = "vialite-color-preview-size";
const AUTO_FIT_KEY = "vialite-color-preview-autofit";
const SPACING_KEY = "vialite-color-key-spacing";
const KEYCAP_WIDTH_KEY = "vialite-color-keycap-width";
const CASE_RADIUS_KEY = "vialite-color-case-radius";
const KEYCAP_RADIUS_KEY = "vialite-color-keycap-radius";
const CASE_THICKNESS_KEY = "vialite-color-case-thickness";
const CASE_COLOR_KEY = "vialite-color-case-color";
const PLATE_COLOR_KEY = "vialite-color-plate-color";
const KEYCAP_BORDER_KEY = "vialite-color-keycap-border";
const STYLE_KEY = "vialite-color-style";
const FONT_SIZE_KEY = "vialite-color-font-size";
const FONT_COLOR_KEY = "vialite-color-font-color";
const FONT_POSITION_KEY = "vialite-color-font-position";

const SIZES: PreviewSize[] = ["xs", "s", "m", "l", "xl"];

function readStoredFontSize(): FontSize {
  try {
    const raw = window.localStorage.getItem(FONT_SIZE_KEY);
    if (raw && (FONT_SIZES as string[]).includes(raw)) {
      return raw as FontSize;
    }
  } catch {
    // Fall through to default.
  }
  return DEFAULT_FONT_SIZE;
}

function readStoredFontPosition(): FontPosition {
  try {
    const raw = window.localStorage.getItem(FONT_POSITION_KEY);
    if (raw && (FONT_POSITIONS as string[]).includes(raw)) {
      return raw as FontPosition;
    }
  } catch {
    // Fall through to default.
  }
  return DEFAULT_FONT_POSITION;
}

function readStoredStyle(): PreviewStyle {
  try {
    const raw = window.localStorage.getItem(STYLE_KEY);
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

function readStoredKeycapRadius(): KeycapRadiusLevel {
  try {
    const raw = window.localStorage.getItem(KEYCAP_RADIUS_KEY);
    if (raw && (KEYCAP_RADIUS_LEVELS as string[]).includes(raw)) {
      return raw as KeycapRadiusLevel;
    }
  } catch {
    // Fall through to default.
  }
  return DEFAULT_KEYCAP_RADIUS;
}

function readStoredSize(): PreviewSize {
  try {
    const raw = window.localStorage.getItem(SIZE_KEY);
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
  keycapBorder: boolean;
  /** Board rendering style (立体感/风格) — see {@link PreviewStyle}. */
  style: PreviewStyle;
  fontSize: FontSize;
  fontColor: string;
  fontPosition: FontPosition;
  setAutoFit: (value: boolean) => void;
  setSize: (value: PreviewSize) => void;
  setSpacing: (value: SpacingLevel) => void;
  setKeycapWidth: (value: SpacingLevel) => void;
  setCaseRadius: (value: SpacingLevel) => void;
  setKeycapRadius: (value: KeycapRadiusLevel) => void;
  setCaseThickness: (value: number) => void;
  setCaseColor: (value: string) => void;
  setPlateColor: (value: string) => void;
  setKeycapBorder: (value: boolean) => void;
  setStyle: (value: PreviewStyle) => void;
  setFontSize: (value: FontSize) => void;
  setFontColor: (value: string) => void;
  setFontPosition: (value: FontPosition) => void;
}

const PreviewAppearanceContext = createContext<PreviewAppearanceValue | null>(null);

export function PreviewAppearanceProvider({ children }: { children: ReactNode }) {
  const [autoFit, setAutoFitState] = useState(() => readStoredBoolean(AUTO_FIT_KEY, true));
  const [size, setSizeState] = useState<PreviewSize>(readStoredSize);
  const [spacing, setSpacingState] = useState<SpacingLevel>(() =>
    readStoredLevel(SPACING_KEY, DEFAULT_KEY_SPACING),
  );
  // Keycap width is no longer user-configurable — fixed at the default (xl) so
  // the preview reads consistently. Any stale localStorage value is ignored.
  const [keycapWidth, setKeycapWidthState] = useState<SpacingLevel>(DEFAULT_KEYCAP_WIDTH);
  const [caseRadius, setCaseRadiusState] = useState<SpacingLevel>(() =>
    readStoredLevel(CASE_RADIUS_KEY, DEFAULT_CASE_RADIUS),
  );
  const [keycapRadius, setKeycapRadiusState] =
    useState<KeycapRadiusLevel>(readStoredKeycapRadius);
  const [caseThickness, setCaseThicknessState] = useState(() =>
    readStoredNumber(CASE_THICKNESS_KEY, DEFAULT_CASE_THICKNESS),
  );
  const [caseColor, setCaseColorState] = useState(() =>
    readStoredString(CASE_COLOR_KEY, DEFAULT_CASE_COLOR),
  );
  const [plateColor, setPlateColorState] = useState(() =>
    readStoredString(PLATE_COLOR_KEY, DEFAULT_PLATE_COLOR),
  );
  // Keycap border is no longer user-configurable — always off. Any stale
  // localStorage value is ignored.
  const [keycapBorder, setKeycapBorderState] = useState(false);
  const [style, setStyleState] = useState<PreviewStyle>(readStoredStyle);
  const [fontSize, setFontSizeState] = useState<FontSize>(readStoredFontSize);
  const [fontColor, setFontColorState] = useState(() =>
    readStoredString(FONT_COLOR_KEY, DEFAULT_FONT_COLOR),
  );
  const [fontPosition, setFontPositionState] =
    useState<FontPosition>(readStoredFontPosition);

  const setAutoFit = useCallback((value: boolean) => {
    setAutoFitState(value);
    store(AUTO_FIT_KEY, String(value));
  }, []);
  const setSize = useCallback((value: PreviewSize) => {
    setSizeState(value);
    store(SIZE_KEY, value);
  }, []);
  const setSpacing = useCallback((value: SpacingLevel) => {
    setSpacingState(value);
    store(SPACING_KEY, value);
  }, []);
  const setKeycapWidth = useCallback((value: SpacingLevel) => {
    setKeycapWidthState(value);
    store(KEYCAP_WIDTH_KEY, value);
  }, []);
  const setCaseRadius = useCallback((value: SpacingLevel) => {
    setCaseRadiusState(value);
    store(CASE_RADIUS_KEY, value);
  }, []);
  const setKeycapRadius = useCallback((value: KeycapRadiusLevel) => {
    setKeycapRadiusState(value);
    store(KEYCAP_RADIUS_KEY, value);
  }, []);
  const setCaseThickness = useCallback((value: number) => {
    setCaseThicknessState(value);
    store(CASE_THICKNESS_KEY, String(value));
  }, []);
  const setCaseColor = useCallback((value: string) => {
    setCaseColorState(value);
    store(CASE_COLOR_KEY, value);
  }, []);
  const setPlateColor = useCallback((value: string) => {
    setPlateColorState(value);
    store(PLATE_COLOR_KEY, value);
  }, []);
  const setKeycapBorder = useCallback((value: boolean) => {
    setKeycapBorderState(value);
    store(KEYCAP_BORDER_KEY, String(value));
  }, []);
  const setStyle = useCallback((value: PreviewStyle) => {
    setStyleState(value);
    store(STYLE_KEY, value);
  }, []);
  const setFontSize = useCallback((value: FontSize) => {
    setFontSizeState(value);
    store(FONT_SIZE_KEY, value);
  }, []);
  const setFontColor = useCallback((value: string) => {
    setFontColorState(value);
    store(FONT_COLOR_KEY, value);
  }, []);
  const setFontPosition = useCallback((value: FontPosition) => {
    setFontPositionState(value);
    store(FONT_POSITION_KEY, value);
  }, []);

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
      keycapBorder,
      style,
      fontSize,
      fontColor,
      fontPosition,
      setAutoFit,
      setSize,
      setSpacing,
      setKeycapWidth,
      setCaseRadius,
      setKeycapRadius,
      setCaseThickness,
      setCaseColor,
      setPlateColor,
      setKeycapBorder,
      setStyle,
      setFontSize,
      setFontColor,
      setFontPosition,
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
      keycapBorder,
      style,
      fontSize,
      fontColor,
      fontPosition,
      setAutoFit,
      setSize,
      setSpacing,
      setKeycapWidth,
      setCaseRadius,
      setKeycapRadius,
      setCaseThickness,
      setCaseColor,
      setPlateColor,
      setKeycapBorder,
      setStyle,
      setFontSize,
      setFontColor,
      setFontPosition,
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
