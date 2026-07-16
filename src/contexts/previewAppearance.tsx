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
  DEFAULT_KEY_SPACING,
  DEFAULT_KEYCAP_WIDTH,
  DEFAULT_PLATE_COLOR,
  SPACING_LEVELS,
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

const SIZES: PreviewSize[] = ["s", "m", "l", "xl"];

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
  setSize: (value: PreviewSize) => void;
  setSpacing: (value: SpacingLevel) => void;
  setKeycapWidth: (value: SpacingLevel) => void;
  setCaseRadius: (value: SpacingLevel) => void;
  setCaseThickness: (value: number) => void;
  setCaseColor: (value: string) => void;
  setPlateColor: (value: string) => void;
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

  const value = useMemo(
    () => ({
      size,
      spacing,
      keycapWidth,
      caseRadius,
      caseThickness,
      caseColor,
      plateColor,
      setSize,
      setSpacing,
      setKeycapWidth,
      setCaseRadius,
      setCaseThickness,
      setCaseColor,
      setPlateColor,
    }),
    [
      size,
      spacing,
      keycapWidth,
      caseRadius,
      caseThickness,
      caseColor,
      plateColor,
      setSize,
      setSpacing,
      setKeycapWidth,
      setCaseRadius,
      setCaseThickness,
      setCaseColor,
      setPlateColor,
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
