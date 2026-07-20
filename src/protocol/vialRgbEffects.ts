// VialRGB effect id -> name, ported from vial-gui's editor/rgb_configurator.py
// (VIALRGB_EFFECTS). The ids are QMK's rgb_matrix effect order and are part of
// the wire protocol, so this table must stay in sync with upstream's — a
// firmware reports which of these ids it compiled in via VIALRGB_GET_SUPPORTED,
// and anything it reports that isn't listed here has no name to show.
//
// Unlike keycap labels (kept English to match vial-gui), these are prose shown
// in a dropdown, so they're translated. They live here rather than in i18n.tsx
// because they're one dense table tied to the protocol, not scattered UI copy.

export interface VialRgbEffect {
  id: number;
  en: string;
  zh: string;
}

export const VIALRGB_EFFECTS: VialRgbEffect[] = [
  { id: 0, en: "Disable", zh: "关闭" },
  { id: 1, en: "Direct Control", zh: "直接控制" },
  { id: 2, en: "Solid Color", zh: "纯色常亮" },
  { id: 3, en: "Alphas Mods", zh: "字母/修饰键双色" },
  { id: 4, en: "Gradient Up Down", zh: "上下渐变" },
  { id: 5, en: "Gradient Left Right", zh: "左右渐变" },
  { id: 6, en: "Breathing", zh: "呼吸" },
  { id: 7, en: "Band Sat", zh: "光带(饱和度)" },
  { id: 8, en: "Band Val", zh: "光带(亮度)" },
  { id: 9, en: "Band Pinwheel Sat", zh: "风车光带(饱和度)" },
  { id: 10, en: "Band Pinwheel Val", zh: "风车光带(亮度)" },
  { id: 11, en: "Band Spiral Sat", zh: "螺旋光带(饱和度)" },
  { id: 12, en: "Band Spiral Val", zh: "螺旋光带(亮度)" },
  { id: 13, en: "Cycle All", zh: "全键盘循环" },
  { id: 14, en: "Cycle Left Right", zh: "左右循环" },
  { id: 15, en: "Cycle Up Down", zh: "上下循环" },
  { id: 16, en: "Rainbow Moving Chevron", zh: "彩虹箭头流动" },
  { id: 17, en: "Cycle Out In", zh: "由外向内循环" },
  { id: 18, en: "Cycle Out In Dual", zh: "由外向内循环(双色)" },
  { id: 19, en: "Cycle Pinwheel", zh: "风车循环" },
  { id: 20, en: "Cycle Spiral", zh: "螺旋循环" },
  { id: 21, en: "Dual Beacon", zh: "双灯塔" },
  { id: 22, en: "Rainbow Beacon", zh: "彩虹灯塔" },
  { id: 23, en: "Rainbow Pinwheels", zh: "彩虹风车" },
  { id: 24, en: "Raindrops", zh: "雨滴" },
  { id: 25, en: "Jellybean Raindrops", zh: "彩色雨滴" },
  { id: 26, en: "Hue Breathing", zh: "色相呼吸" },
  { id: 27, en: "Hue Pendulum", zh: "色相摆动" },
  { id: 28, en: "Hue Wave", zh: "色相波浪" },
  { id: 29, en: "Typing Heatmap", zh: "打字热力图" },
  { id: 30, en: "Digital Rain", zh: "数字雨" },
  { id: 31, en: "Solid Reactive Simple", zh: "按键响应(简单)" },
  { id: 32, en: "Solid Reactive", zh: "按键响应" },
  { id: 33, en: "Solid Reactive Wide", zh: "按键响应(扩散)" },
  { id: 34, en: "Solid Reactive Multiwide", zh: "按键响应(多点扩散)" },
  { id: 35, en: "Solid Reactive Cross", zh: "按键响应(十字)" },
  { id: 36, en: "Solid Reactive Multicross", zh: "按键响应(多点十字)" },
  { id: 37, en: "Solid Reactive Nexus", zh: "按键响应(交汇)" },
  { id: 38, en: "Solid Reactive Multinexus", zh: "按键响应(多点交汇)" },
  { id: 39, en: "Splash", zh: "水波" },
  { id: 40, en: "Multisplash", zh: "多点水波" },
  { id: 41, en: "Solid Splash", zh: "纯色水波" },
  { id: 42, en: "Solid Multisplash", zh: "纯色多点水波" },
  { id: 43, en: "Pixel Rain", zh: "像素雨" },
  { id: 44, en: "Pixel Fractal", zh: "像素分形" },
];

/**
 * Effects whose color comes from the animation itself, so the hue/saturation
 * picker has no visible effect on them. Mirrors QMK's rgb_matrix: the "cycle" /
 * "rainbow" / "hue" families sweep the whole hue wheel, and effect 0 is off.
 * Used only to explain the greyed-out color row — never to block a write.
 */
export const RGB_EFFECTS_IGNORING_COLOR = new Set([
  0, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 25, 26, 27, 28, 29, 30,
]);

const BY_ID = new Map(VIALRGB_EFFECTS.map((e) => [e.id, e]));

/** Display name for an effect id, falling back to a bare id for unknown effects. */
export function rgbEffectName(id: number, lang: "en" | "zh"): string {
  const effect = BY_ID.get(id);
  return effect ? effect[lang] : `Effect ${id}`;
}
