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
  DEFAULT_KEYCAP_WIDTH,
  DEFAULT_PLATE_COLOR,
  FONT_POSITIONS,
  FONT_SIZES,
  SPACING_LEVELS,
  type FontPosition,
  type FontSize,
  type PreviewSize,
  type SpacingLevel,
} from "../components/keymap/KeyboardLayoutPreview.tsx";

const SIZE_KEY = "vialite-color-preview-size";
const SPACING_KEY = "vialite-color-key-spacing";
const KEYCAP_WIDTH_KEY = "vialite-color-keycap-width";
const CASE_RADIUS_KEY = "vialite-color-case-radius";
const CASE_THICKNESS_KEY = "vialite-color-case-thickness";
const CASE_COLOR_KEY = "vialite-color-case-color";
const PLATE_COLOR_KEY = "vialite-color-plate-color";
const KEYCAP_BORDER_KEY = "vialite-color-keycap-border";
const DEPTH_KEY = "vialite-color-depth";
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
  size: PreviewSize;
  spacing: SpacingLevel;
  keycapWidth: SpacingLevel;
  caseRadius: SpacingLevel;
  caseThickness: number;
  caseColor: string;
  plateColor: string;
  keycapBorder: boolean;
  /** Draw the highlight/shadow 3D shading on keycaps, case, and plate (立体感). */
  depth: boolean;
  fontSize: FontSize;
  fontColor: string;
  fontPosition: FontPosition;
  setSize: (value: PreviewSize) => void;
  setSpacing: (value: SpacingLevel) => void;
  setKeycapWidth: (value: SpacingLevel) => void;
  setCaseRadius: (value: SpacingLevel) => void;
  setCaseThickness: (value: number) => void;
  setCaseColor: (value: string) => void;
  setPlateColor: (value: string) => void;
  setKeycapBorder: (value: boolean) => void;
  setDepth: (value: boolean) => void;
  setFontSize: (value: FontSize) => void;
  setFontColor: (value: string) => void;
  setFontPosition: (value: FontPosition) => void;
}

const PreviewAppearanceContext = createContext<PreviewAppearanceValue | null>(null);

export function PreviewAppearanceProvider({ children }: { children: ReactNode }) {
  const [size, setSizeState] = useState<PreviewSize>(readStoredSize);
  const [spacing, setSpacingState] = useState<SpacingLevel>(() =>
    readStoredLevel(SPACING_KEY, DEFAULT_KEY_SPACING),
  );
  const [keycapWidth, setKeycapWidthState] = useState<SpacingLevel>(() =>
    readStoredLevel(KEYCAP_WIDTH_KEY, DEFAULT_KEYCAP_WIDTH),
  );
  const [caseRadius, setCaseRadiusState] = useState<SpacingLevel>(() =>
    readStoredLevel(CASE_RADIUS_KEY, DEFAULT_CASE_RADIUS),
  );
  const [caseThickness, setCaseThicknessState] = useState(() =>
    readStoredNumber(CASE_THICKNESS_KEY, DEFAULT_CASE_THICKNESS),
  );
  const [caseColor, setCaseColorState] = useState(() =>
    readStoredString(CASE_COLOR_KEY, DEFAULT_CASE_COLOR),
  );
  const [plateColor, setPlateColorState] = useState(() =>
    readStoredString(PLATE_COLOR_KEY, DEFAULT_PLATE_COLOR),
  );
  const [keycapBorder, setKeycapBorderState] = useState(() =>
    readStoredBoolean(KEYCAP_BORDER_KEY, false),
  );
  const [depth, setDepthState] = useState(() => readStoredBoolean(DEPTH_KEY, true));
  const [fontSize, setFontSizeState] = useState<FontSize>(readStoredFontSize);
  const [fontColor, setFontColorState] = useState(() =>
    readStoredString(FONT_COLOR_KEY, DEFAULT_FONT_COLOR),
  );
  const [fontPosition, setFontPositionState] =
    useState<FontPosition>(readStoredFontPosition);

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
  const setDepth = useCallback((value: boolean) => {
    setDepthState(value);
    store(DEPTH_KEY, String(value));
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
      size,
      spacing,
      keycapWidth,
      caseRadius,
      caseThickness,
      caseColor,
      plateColor,
      keycapBorder,
      depth,
      fontSize,
      fontColor,
      fontPosition,
      setSize,
      setSpacing,
      setKeycapWidth,
      setCaseRadius,
      setCaseThickness,
      setCaseColor,
      setPlateColor,
      setKeycapBorder,
      setDepth,
      setFontSize,
      setFontColor,
      setFontPosition,
    }),
    [
      size,
      spacing,
      keycapWidth,
      caseRadius,
      caseThickness,
      caseColor,
      plateColor,
      keycapBorder,
      depth,
      fontSize,
      fontColor,
      fontPosition,
      setSize,
      setSpacing,
      setKeycapWidth,
      setCaseRadius,
      setCaseThickness,
      setCaseColor,
      setPlateColor,
      setKeycapBorder,
      setDepth,
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
