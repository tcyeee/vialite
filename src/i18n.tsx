// Lightweight zh/en UI localization: a static dictionary, a `t()` formatter
// with `{param}` interpolation, and a React context. Keycap labels (Enter,
// LShift, ...) deliberately stay English, matching vial-gui.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

const STORAGE_KEY = "vialite-lang";

const MESSAGES = {
  // App
  keymapTab: { en: "Keymap", zh: "键位" },
  matrixTestTab: { en: "Matrix test", zh: "矩阵测试" },
  view2d: { en: "2D", zh: "2D 平面" },
  view3d: { en: "3D", zh: "3D 预览" },
  exportLayout: { en: "Export layout", zh: "导出配置" },
  importLayout: { en: "Import layout", zh: "导入配置" },
  importing: { en: "Importing…", zh: "导入中…" },
  importWritten: { en: "Imported: {n} assignment(s) written.", zh: "导入完成:写入 {n} 个键位。" },
  importSkippedKeycodes: { en: "Skipped unsupported keycodes: {list}.", zh: "跳过不支持的键码:{list}。" },
  importSkippedFeatures: {
    en: "File contains {list} — not supported yet, not applied.",
    zh: "文件还包含 {list},暂不支持,未写入。",
  },
  importFailed: { en: "Import failed: {error}", zh: "导入失败:{error}" },
  importUidMismatch: {
    en: "Saved keymap belongs to a different keyboard, are you sure you want to continue?",
    zh: "这份配置属于另一把键盘,确定要继续导入吗?",
  },
  writeKeyFailed: { en: "Failed to write key: {error}", zh: "写入键值失败:{error}" },
  keyboardDisconnected: {
    en: "Keyboard disconnected — plug it back in and reconnect.",
    zh: "键盘已断开——重新插入后再连接。",
  },

  // DeviceConnect
  connecting: { en: "Connecting…", zh: "连接中…" },
  connectedTo: { en: "Connected: {name}", zh: "已连接:{name}" },
  disconnect: { en: "Disconnect", zh: "断开连接" },

  // WaitingForConnection
  waitingTitle: { en: "Waiting for connection", zh: "等待连接" },
  waitingSubtitle: {
    en: "Click the button below to start detecting your keyboard.",
    zh: "请点击下方按钮开始检测。",
  },
  detectDevice: { en: "Detect device", zh: "检测设备" },

  // LayerTabs
  layerN: { en: "Layer {n}", zh: "层 {n}" },

  // KeycodePicker
  searchPlaceholder: { en: "Search keycodes…", zh: "搜索键码…" },
  assignByKeypress: { en: "Assign by keypress", zh: "按键直接赋值" },
  listening: { en: "Listening… (Esc to stop)", zh: "监听中…(按 Esc 停止)" },
  listenTooltip: {
    en: "Press a key on your active keyboard to assign it",
    zh: "按下手边键盘上的按键,直接赋值给选中的键位",
  },
  anyKeyPlaceholder: {
    en: "Any key: e.g. LT(2,KC_A), LCTL(KC_C), 0x5c00",
    zh: "任意键码:如 LT(2,KC_A)、LCTL(KC_C)、0x5c00",
  },
  set: { en: "Set", zh: "设置" },
  pickInnerKey: { en: "{template} — now pick the inner key", zh: "{template}——请继续选择内部按键" },
  cancel: { en: "Cancel", zh: "取消" },
  cannotNest: {
    en: "{qmkId} cannot be nested inside {template}; pick a basic key",
    zh: "{qmkId} 不能嵌套进 {template},请选择基础键",
  },
  noKeyMapping: { en: 'no keycode mapping for "{code}"', zh: "没有与 “{code}” 对应的键码" },
  noMatch: { en: "No keycodes match “{query}”.", zh: "没有匹配 “{query}” 的键码。" },

  // Keycode categories (keys must mirror KEYCODE_CATEGORIES names in keycodes.ts)
  categoryBasic: { en: "Basic", zh: "基础" },
  categoryNumpad: { en: "Numpad", zh: "小键盘" },
  categoryNavigation: { en: "Navigation", zh: "导航" },
  categoryShifted: { en: "Shifted", zh: "上档符号" },
  categoryIso: { en: "ISO/International", zh: "ISO/国际" },
  categoryFn: { en: "Fn keys", zh: "Fn 键" },
  categoryLayers: { en: "Layers", zh: "层切换" },
  categoryQuantum: { en: "Quantum", zh: "Quantum" },
  categoryMacros: { en: "Macros", zh: "宏" },
  categoryMedia: { en: "Media", zh: "媒体" },
  categoryMouse: { en: "Mouse", zh: "鼠标" },
  categoryLighting: { en: "Lighting", zh: "灯光" },

  // MatrixTester
  matrixStopped: { en: "Matrix test stopped: {error}", zh: "矩阵测试已停止:{error}" },
  checkingLock: { en: "Checking keyboard lock state…", zh: "正在检查键盘锁定状态…" },
  mustUnlock: {
    en: "The keyboard must be unlocked before its switch matrix can be tested.",
    zh: "需要先解锁键盘,才能进行矩阵测试。",
  },
  unlock: { en: "Unlock", zh: "解锁" },
  matrixInstructions: {
    en: "Press every key on the keyboard; keys light up while held and stay marked once they have registered.",
    zh: "逐个按下键盘上的每个按键:按住时高亮,成功触发过的按键会保持标记。",
  },
  reset: { en: "Reset", zh: "重置" },

  // UnlockDialog
  unlockTitle: { en: "Unlock keyboard", zh: "解锁键盘" },
  unlockWarning: {
    en: "In order to proceed, the keyboard must be set into unlocked mode. You should only perform this operation on computers that you trust.",
    zh: "继续操作前需要将键盘设为解锁模式。请只在你信任的电脑上执行此操作。",
  },
  unlockHold: {
    en: "Press and hold the highlighted keys until the progress bar fills up:",
    zh: "按住高亮显示的按键,直到进度条充满:",
  },
} as const satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof MESSAGES;

export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "zh") {
      return stored;
    }
  } catch {
    // Storage may be unavailable (private mode etc.) — fall through.
  }
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-persistent is fine.
    }
  }, []);

  const t = useCallback<Translate>((key, params) => format(MESSAGES[key][lang], params), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}
