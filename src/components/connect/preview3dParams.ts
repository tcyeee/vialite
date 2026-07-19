// Tunable constants for the 3D preview, lifted out of KeyboardLayout3D so the
// Beta page can expose them as live controls. vial.json carries no case height,
// keycap profile or tilt, so every proportion here is a chosen default rather
// than a measurement — they exist to be dialled in by eye against real boards.
//
// Controls are labelled with their source constant name (CAP_HEIGHT, …) rather
// than a translated phrase: this is a debugging surface, and the point is to
// find a value and paste it back into the code.

import type { MessageKey } from "../../contexts/i18n.tsx";

export interface Preview3DParams {
  // Keycap
  capHeight: number;
  capTaper: number;
  capRadius: number;
  gap: number;
  capInset: number;
  legendFill: number;
  // Case
  plateMargin: number;
  caseHeight: number;
  bezelTop: number;
  bezelInner: number;
  plateBevel: number;
  clusterGap: number;
  // Lighting
  ambientIntensity: number;
  keyLightIntensity: number;
  fillLightIntensity: number;
  // Colours
  capColor: string;
  plateColor: string;
  shellColor: string;
  legendColor: string;
}

export const DEFAULT_PREVIEW_3D_PARAMS: Preview3DParams = {
  capHeight: 0.35,
  capTaper: 0.88,
  capRadius: 0.045,
  gap: 0.06,
  capInset: 0.08,
  legendFill: 0.86,
  plateMargin: 0.4,
  caseHeight: 0.5,
  bezelTop: 0.09,
  bezelInner: 0.06,
  plateBevel: 0.02,
  clusterGap: 0.8,
  ambientIntensity: 0.9,
  keyLightIntensity: 1.35,
  fillLightIntensity: 0.35,
  capColor: "#f2f2f2",
  plateColor: "#2b2b2b",
  shellColor: "#1c1c1c",
  legendColor: "#1b1c17",
};

type NumericKey = {
  [K in keyof Preview3DParams]: Preview3DParams[K] extends number ? K : never;
}[keyof Preview3DParams];

type ColorKey = {
  [K in keyof Preview3DParams]: Preview3DParams[K] extends string ? K : never;
}[keyof Preview3DParams];

export interface SliderSpec {
  key: NumericKey;
  /** Name of the constant in KeyboardLayout3D.tsx this drives. */
  constant: string;
  min: number;
  max: number;
  step: number;
  /** Short note on what moving it does, shown as the row's title attribute. */
  hint: string;
}

export interface ColorSpec {
  key: ColorKey;
  constant: string;
}

export interface ParamGroup {
  titleKey: MessageKey;
  sliders: SliderSpec[];
  colors: ColorSpec[];
}

export const PREVIEW_3D_GROUPS: ParamGroup[] = [
  {
    titleKey: "preview3dGroupCap",
    sliders: [
      { key: "capHeight", constant: "CAP_HEIGHT", min: 0.1, max: 1, step: 0.01, hint: "键帽高度" },
      { key: "capTaper", constant: "CAP_TAPER", min: 0.5, max: 1, step: 0.01, hint: "顶面收缩比例，1 = 不收缩" },
      { key: "capRadius", constant: "CAP_RADIUS", min: 0, max: 0.15, step: 0.005, hint: "键帽圆角" },
      { key: "gap", constant: "GAP", min: 0, max: 0.3, step: 0.01, hint: "相邻键帽之间的缝隙" },
      { key: "capInset", constant: "CAP_INSET", min: 0, max: 0.4, step: 0.01, hint: "键帽底面到板面的距离" },
      { key: "legendFill", constant: "LEGEND_FILL", min: 0.3, max: 1, step: 0.02, hint: "字符占键帽短边的比例" },
    ],
    colors: [
      { key: "capColor", constant: "CAP_COLOR" },
      { key: "legendColor", constant: "LEGEND_COLOR" },
    ],
  },
  {
    titleKey: "preview3dGroupCase",
    sliders: [
      { key: "plateMargin", constant: "PLATE_MARGIN", min: 0, max: 1.5, step: 0.05, hint: "外壳外轮廓相对键区的外扩量" },
      { key: "caseHeight", constant: "CASE_HEIGHT", min: 0.05, max: 2, step: 0.05, hint: "壳体从板面往下的高度" },
      { key: "bezelTop", constant: "BEZEL_TOP", min: -0.2, max: 0.5, step: 0.01, hint: "边框顶面高度；大于 0 才能遮住键帽底面" },
      { key: "bezelInner", constant: "BEZEL_INNER", min: 0, max: 0.5, step: 0.01, hint: "边框内沿与键区的间隙" },
      { key: "plateBevel", constant: "PLATE_BEVEL", min: 0, max: 0.08, step: 0.005, hint: "挤出时的倒角" },
      { key: "clusterGap", constant: "CLUSTER_GAP", min: 0.2, max: 4, step: 0.1, hint: "分簇阈值：间距大于此值的键区拆成独立外壳" },
    ],
    colors: [
      { key: "plateColor", constant: "PLATE_COLOR" },
      { key: "shellColor", constant: "SHELL_COLOR" },
    ],
  },
  {
    titleKey: "preview3dGroupLight",
    sliders: [
      { key: "ambientIntensity", constant: "环境光", min: 0, max: 3, step: 0.05, hint: "HemisphereLight" },
      { key: "keyLightIntensity", constant: "主光", min: 0, max: 3, step: 0.05, hint: "投射阴影的平行光" },
      { key: "fillLightIntensity", constant: "补光", min: 0, max: 2, step: 0.05, hint: "反向补光，压暗侧的死黑" },
    ],
    colors: [],
  },
];

const STORAGE_KEY = "vialite-preview3d-params";

/** Reads persisted params, dropping anything that no longer type-checks against the defaults. */
export function loadPreview3DParams(): Preview3DParams {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREVIEW_3D_PARAMS;
    }
    const stored = JSON.parse(raw) as Partial<Preview3DParams>;
    const merged = { ...DEFAULT_PREVIEW_3D_PARAMS };
    for (const key of Object.keys(DEFAULT_PREVIEW_3D_PARAMS) as (keyof Preview3DParams)[]) {
      const value = stored[key];
      if (typeof value === typeof DEFAULT_PREVIEW_3D_PARAMS[key]) {
        // Both sides are known to share a type here; the cast is only needed
        // because TS can't correlate the union across the indexed access.
        (merged as Record<string, unknown>)[key] = value;
      }
    }
    return merged;
  } catch {
    return DEFAULT_PREVIEW_3D_PARAMS;
  }
}

export function savePreview3DParams(params: Preview3DParams) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Non-persistent is fine.
  }
}

/** Renders the current values as the constant declarations to paste back into the source. */
export function formatAsConstants(params: Preview3DParams): string {
  const lines: string[] = [];
  for (const group of PREVIEW_3D_GROUPS) {
    for (const { key, constant } of group.sliders) {
      if (/^[A-Z_]+$/.test(constant)) {
        lines.push(`const ${constant} = ${params[key]};`);
      }
    }
    for (const { key, constant } of group.colors) {
      const value = params[key];
      lines.push(
        constant === "LEGEND_COLOR"
          ? `const ${constant} = "${value}";`
          : `const ${constant} = 0x${value.replace("#", "")};`,
      );
    }
  }
  return lines.join("\n");
}
