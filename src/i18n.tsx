// Lightweight zh/en UI localization: a static dictionary, a `t()` formatter
// with `{param}` interpolation, and a React context. Keycap labels (Enter,
// LShift, ...) deliberately stay English, matching vial-gui.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

const STORAGE_KEY = "vialite-lang";

const MESSAGES = {
  // App
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
  deviceConnected: { en: "Connected to {name}", zh: "已连接:{name}" },
  deviceDisconnected: { en: "Disconnected", zh: "已断开连接" },
  keyboardLayoutTitle: { en: "Keyboard Layout", zh: "键盘布局" },
  layoutOptionsTitle: { en: "Layout options", zh: "布局选项" },
  generalSettingsTitle: { en: "General", zh: "通用设置" },
  magicSettingsTitle: { en: "Magic", zh: "Magic" },
  magicSwapCapsLockControl: { en: "Swap Caps Lock and Left Control", zh: "交换 Caps Lock 与左 Control" },
  magicCapsLockAsControl: { en: "Treat Caps Lock as Control", zh: "将 Caps Lock 作为 Control 使用" },
  magicSwapLaltLgui: { en: "Swap Left Alt and GUI", zh: "交换左 Alt 与 GUI" },
  magicSwapRaltRgui: { en: "Swap Right Alt and GUI", zh: "交换右 Alt 与 GUI" },
  magicDisableGui: { en: "Disable the GUI keys", zh: "禁用 GUI 键" },
  magicSwapGraveEsc: { en: "Swap ` and Escape", zh: "交换 ` 与 Escape" },
  magicSwapBackslashBackspace: { en: "Swap \\ and Backspace", zh: "交换 \\ 与 Backspace" },
  magicNkro: { en: "Enable N-key rollover", zh: "启用 N 键无冲(NKRO)" },
  magicSwapLctlLgui: { en: "Swap Left Control and GUI", zh: "交换左 Control 与 GUI" },
  magicSwapRctlRgui: { en: "Swap Right Control and GUI", zh: "交换右 Control 与 GUI" },
  graveEscapeSettingsTitle: { en: "Grave Escape", zh: "反引号转义 (Grave Escape)" },
  graveEscapeAlt: { en: "Always send Escape if Alt is pressed", zh: "按住 Alt 时始终发送 Escape" },
  graveEscapeControl: { en: "Always send Escape if Control is pressed", zh: "按住 Control 时始终发送 Escape" },
  graveEscapeGui: { en: "Always send Escape if GUI is pressed", zh: "按住 GUI 时始终发送 Escape" },
  graveEscapeShift: { en: "Always send Escape if Shift is pressed", zh: "按住 Shift 时始终发送 Escape" },
  tapHoldSettingsTitle: { en: "Tap-Hold", zh: "轻触与长按 (Tap-Hold)" },
  tapHoldTappingTerm: { en: "Tapping Term", zh: "轻触判定时长 (Tapping Term)" },
  tapHoldPermissiveHold: { en: "Permissive Hold", zh: "宽松长按 (Permissive Hold)" },
  tapHoldIgnoreModTapInterrupt: { en: "Ignore Mod Tap Interrupt", zh: "忽略 Mod-Tap 打断" },
  tapHoldTappingForceHold: { en: "Tapping Force Hold", zh: "强制长按 (Tapping Force Hold)" },
  tapHoldRetroTapping: { en: "Retro Tapping", zh: "回溯轻触 (Retro Tapping)" },
  tapHoldHoldOnOtherKeyPress: { en: "Hold On Other Key Press", zh: "按下其他键时判定为长按" },
  tapHoldQuickTapTerm: { en: "Quick Tap Term", zh: "连续轻触判定时长 (Quick Tap Term)" },
  tapHoldTapCodeDelay: { en: "Tap Code Delay", zh: "按键延迟 (Tap Code Delay)" },
  tapHoldTapHoldCapsDelay: { en: "Tap Hold Caps Delay", zh: "Caps Lock 长按延迟" },
  tapHoldTappingToggle: { en: "Tapping Toggle", zh: "连按切换次数 (Tapping Toggle)" },
  tapHoldChordalHold: { en: "Chordal Hold", zh: "同手长按判定 (Chordal Hold)" },
  tapHoldFlowTap: { en: "Flow Tap", zh: "连续输入时快速轻触 (Flow Tap)" },
  comboSettingsTitle: { en: "Combo", zh: "组合键 (Combo)" },
  comboTermMs: { en: "Time out period for combos", zh: "组合键超时时间" },
  oneShotSettingsTitle: { en: "One Shot Keys", zh: "单次触发键 (One Shot Keys)" },
  oneShotTapToggle: {
    en: "Tapping this number of times holds the key until tapped once again",
    zh: "连续轻触该次数后锁定按键,再次轻触解除",
  },
  oneShotTimeoutMs: { en: "Time (in ms) before the one shot key is released", zh: "单次触发键自动释放时间(毫秒)" },
  mouseKeySettingsTitle: { en: "Mouse Keys", zh: "鼠标按键 (Mouse Keys)" },
  mouseKeyDelay: {
    en: "Delay between pressing a movement key and cursor movement",
    zh: "按下移动键到光标开始移动的延迟",
  },
  mouseKeyInterval: { en: "Time between cursor movements in milliseconds", zh: "光标每次移动的间隔时间(毫秒)" },
  mouseKeyStepSize: { en: "Step size", zh: "移动步长" },
  mouseKeyMaxSpeed: { en: "Maximum cursor speed at which acceleration stops", zh: "光标加速停止时的最大速度" },
  mouseKeyTimeToMax: { en: "Time until maximum cursor speed is reached", zh: "达到最大光标速度所需时间" },
  mouseKeyWheelDelay: {
    en: "Delay between pressing a wheel key and wheel movement",
    zh: "按下滚轮键到滚轮开始滚动的延迟",
  },
  mouseKeyWheelInterval: { en: "Time between wheel movements", zh: "滚轮每次滚动的间隔时间" },
  mouseKeyWheelMaxSpeed: { en: "Maximum number of scroll steps per scroll action", zh: "每次滚动的最大步数" },
  mouseKeyWheelTimeToMax: { en: "Time until maximum scroll speed is reached", zh: "达到最大滚动速度所需时间" },
  unitMs: { en: "ms", zh: "毫秒" },
  unitPx: { en: "px", zh: "像素" },
  unitSteps: { en: "steps", zh: "步" },
  unitTaps: { en: "taps", zh: "次" },
  resetAllSettings: { en: "Reset all settings", zh: "重置所有设置" },
  resetAllSettingsConfirm: {
    en: "Revert every setting on this page back to when this keyboard connected?",
    zh: "确定要将本页面的所有设置撤销回连接时的状态吗?",
  },
  languageTitle: { en: "Language", zh: "语言" },
  themeTitle: { en: "Appearance", zh: "外观" },
  themeLight: { en: "Light", zh: "浅色" },
  themeDark: { en: "Dark", zh: "深色" },
  exportLayoutDesc: { en: "Save the current keymap to a .vil file", zh: "将当前配置保存为 .vil 文件" },
  importLayoutDesc: { en: "Load a keymap from a .vil file", zh: "从 .vil 文件加载配置" },

  // Sidebar
  navHome: { en: "Home", zh: "主页" },
  navMatrixTest: { en: "Matrix Test", zh: "矩阵测试" },
  navMacro: { en: "Macro", zh: "宏配置" },
  navTapDance: { en: "Tap Dance", zh: "点击舞步" },
  navCombo: { en: "Combo", zh: "组合键" },
  navAdvanced: { en: "QMK Settings", zh: "QMK 设置" },
  comingSoon: { en: "Coming soon", zh: "即将推出" },
  resizeSidebar: { en: "Resize sidebar", zh: "拖动调整侧边栏宽度" },

  // Shared
  save: { en: "Save", zh: "保存" },
  revert: { en: "Revert", zh: "撤销更改" },
  edit: { en: "Edit", zh: "编辑" },
  delete: { en: "Delete", zh: "删除" },
  done: { en: "Done", zh: "完成" },

  // MacroPanel
  macroNone: {
    en: "This keyboard doesn't support macros.",
    zh: "这把键盘不支持宏。",
  },
  macroEmpty: { en: "No actions yet — add one below.", zh: "还没有任何动作,在下方添加一个。" },
  macroHint: {
    en: "Assign M{n} to a key in the keymap to trigger this macro.",
    zh: "在按键映射中把某个键位设为 M{n},即可触发这个宏。",
  },
  macroAddText: { en: "+ Text", zh: "+ 文本" },
  macroAddTap: { en: "+ Tap", zh: "+ 点按" },
  macroAddDown: { en: "+ Down", zh: "+ 按下" },
  macroAddUp: { en: "+ Up", zh: "+ 松开" },
  macroAddDelay: { en: "+ Delay", zh: "+ 延时" },
  macroActionText: { en: "Text", zh: "文本" },
  macroActionDelay: { en: "Delay", zh: "延时" },
  macroActionTap: { en: "Tap", zh: "点按" },
  macroActionDown: { en: "Down", zh: "按下" },
  macroActionUp: { en: "Up", zh: "松开" },
  macroMemoryUsed: { en: "Memory used: {used}/{total} bytes", zh: "已用内存:{used}/{total} 字节" },
  macroSaving: { en: "Saving…", zh: "保存中…" },

  // TapDancePanel
  tapDanceNone: {
    en: "This keyboard doesn't support tap dance.",
    zh: "这把键盘不支持点击舞步。",
  },
  tapDanceUsed: { en: "Tap dances used: {used}/{total}", zh: "已用点击舞步:{used}/{total}" },
  tapDanceOnTap: { en: "On tap", zh: "单击" },
  tapDanceOnHold: { en: "On hold", zh: "长按" },
  tapDanceOnDoubleTap: { en: "On double tap", zh: "双击" },
  tapDanceOnTapHold: { en: "On tap + hold", zh: "单击后长按" },
  tapDanceTappingTerm: { en: "Tapping term", zh: "点击判定时长" },
  tapDanceHint: {
    en: "Use TD(n) in the keymap to trigger tap dance n.",
    zh: "在按键映射中使用 TD(n) 来触发对应编号的点击舞步。",
  },
  tapDanceTermMs: { en: "{ms} ms", zh: "{ms} 毫秒" },
  msUnit: { en: "ms", zh: "毫秒" },
  tapDanceDeleteConfirm: {
    en: "Delete this tap dance? This clears all its actions.",
    zh: "确定要删除这个点击舞步吗?这会清空它的所有动作。",
  },
  tapDanceAdd: { en: "Add tap dance", zh: "添加点击舞步" },
  tapDanceEmpty: { en: "No tap dances configured yet.", zh: "还没有配置任何点击舞步。" },
  tapDanceFull: {
    en: "All tap dance slots are in use.",
    zh: "点击舞步槽位已全部用完。",
  },

  // ComboPanel
  comboNone: {
    en: "This keyboard doesn't support combos.",
    zh: "这把键盘不支持组合键。",
  },
  comboUsed: { en: "Combos used: {used}/{total}", zh: "已用组合键:{used}/{total}" },
  comboLegend: { en: "Combo {n}", zh: "组合键 {n}" },
  comboKeyN: { en: "Key {n}", zh: "按键 {n}" },
  comboOutput: { en: "Output key", zh: "输出按键" },
  comboHint: {
    en: "Press all input keys together to trigger the output key.",
    zh: "同时按下所有输入按键,即可触发输出按键。",
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
  toggleLanguage: { en: "Switch language", zh: "切换语言" },
  toggleTheme: { en: "Toggle theme", zh: "切换主题" },

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
