// Lightweight zh/en UI localization: a static dictionary, a `t()` formatter
// with `{param}` interpolation, and a React context. Keycap labels (Enter,
// LShift, ...) deliberately stay English, matching vial-gui.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "zh";

const STORAGE_KEY = "vialite-lang";

const MESSAGES = {
  // SEO — document <title> and meta description, swapped per language at runtime.
  seoTitle: {
    en: "Vialite — Web Configurator for Vial Keyboards (WebHID, no install)",
    zh: "Vialite — Vial 键盘在线配置器（WebHID，免安装）",
  },
  seoDescription: {
    en: "Configure your Vial-protocol keyboard right in the browser over WebHID — remap keys, layers, macros, tap dance, combos, RGB, and QMK settings. No Qt, no WebAssembly, no driver install. Works in Chrome and Edge.",
    zh: "在浏览器中通过 WebHID 直接配置 Vial 协议键盘：改键、分层、宏、Tap Dance、组合键、RGB 灯光与 QMK 高级设置。无需 Qt、无需 WebAssembly、无需安装驱动，支持 Chrome 与 Edge。",
  },
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
  // Connect failures. Keyed by ProtocolErrorCode (see transport.ts) and mapped
  // in App.tsx's describeConnectError — the protocol layer is framework-agnostic
  // and can't translate its own messages.
  errWebhidUnsupported: {
    en: "This browser does not support WebHID. Use Chrome or Edge.",
    zh: "此浏览器不支持 WebHID,请使用 Chrome 或 Edge。",
  },
  errNoDeviceSelected: {
    en: "No device selected.",
    zh: "未选择设备。",
  },
  errDeviceDisconnected: {
    en: "The keyboard was disconnected during the operation.",
    zh: "操作过程中键盘已断开连接。",
  },
  errCommFailed: {
    en: "Failed to communicate with the keyboard. Unplug it, plug it back in, and try again.",
    zh: "与键盘通信失败。请拔下键盘重新插入后再试。",
  },
  errViaOnlyKeyboard: {
    en: "This keyboard does not support the Vial protocol — it looks like a VIA-only board. Vialite only works with keyboards running Vial firmware.",
    zh: "该键盘不支持 Vial 协议,看起来是仅支持 VIA 的键盘。Vialite 仅支持刷入 Vial 固件的键盘。",
  },
  errUnsupportedProtocol: {
    en: "Unsupported protocol version (VIA {via}, Vial {vial}). This keyboard's firmware is not compatible with Vialite.",
    zh: "不支持的协议版本(VIA {via}、Vial {vial})。该键盘固件与 Vialite 不兼容。",
  },
  errMalformedDefinition: {
    en: "The keyboard reported a malformed layout definition (vial.json). Its firmware may be broken.",
    zh: "键盘返回的布局定义(vial.json)格式有误,固件可能存在问题。",
  },
  errConnectFailed: {
    en: "Failed to connect: {error}",
    zh: "连接失败:{error}",
  },
  keyboardLayoutTitle: { en: "Keyboard Layout", zh: "键盘布局" },
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
  // Help tooltips, sourced from the official QMK documentation linked by
  // https://get.vial.today/manual/qmk-settings.html
  magicSwapCapsLockControlHelp: {
    en: "Exchanges the Caps Lock and Left Control keys.",
    zh: "交换 Caps Lock 与左 Control 两个键的功能。",
  },
  magicCapsLockAsControlHelp: {
    en: "Makes the Caps Lock key act as an additional Control key.",
    zh: "让 Caps Lock 键作为额外的 Control 键使用。",
  },
  magicSwapLaltLguiHelp: {
    en: "Exchanges the left Alt and left GUI (Win/Cmd) keys.",
    zh: "交换左 Alt 与左 GUI(Win/Cmd)键。",
  },
  magicSwapRaltRguiHelp: {
    en: "Exchanges the right Alt and right GUI (Win/Cmd) keys.",
    zh: "交换右 Alt 与右 GUI(Win/Cmd)键。",
  },
  magicDisableGuiHelp: {
    en: "Disables all GUI (Win/Cmd) keys — handy to avoid accidental presses while gaming.",
    zh: "禁用所有 GUI(Win/Cmd)键,常用于游戏时防止误触。",
  },
  magicSwapGraveEscHelp: {
    en: "Exchanges the ` (grave) and Escape keys.",
    zh: "交换 `(反引号)与 Escape 键。",
  },
  magicSwapBackslashBackspaceHelp: {
    en: "Exchanges the \\ (backslash) and Backspace keys.",
    zh: "交换 \\(反斜杠)与 Backspace 键。",
  },
  magicNkroHelp: {
    en: "Enables N-key rollover, so every pressed key registers at once without ghosting.",
    zh: "启用 N 键无冲(NKRO),可同时识别所有按下的按键,避免冲突丢键。",
  },
  magicSwapLctlLguiHelp: {
    en: "Exchanges the left Control and left GUI (Win/Cmd) keys.",
    zh: "交换左 Control 与左 GUI(Win/Cmd)键。",
  },
  magicSwapRctlRguiHelp: {
    en: "Exchanges the right Control and right GUI (Win/Cmd) keys.",
    zh: "交换右 Control 与右 GUI(Win/Cmd)键。",
  },
  graveEscapeAltHelp: {
    en: "When this Grave Escape key is pressed while Alt is held, always send Escape instead of `.",
    zh: "按住 Alt 时按下反引号转义键,始终发送 Escape 而不是 `。",
  },
  graveEscapeControlHelp: {
    en: "When this Grave Escape key is pressed while Control is held, always send Escape instead of `.",
    zh: "按住 Control 时按下反引号转义键,始终发送 Escape 而不是 `。",
  },
  graveEscapeGuiHelp: {
    en: "When this Grave Escape key is pressed while GUI (Win/Cmd) is held, always send Escape instead of `.",
    zh: "按住 GUI(Win/Cmd)时按下反引号转义键,始终发送 Escape 而不是 `。",
  },
  graveEscapeShiftHelp: {
    en: "When this Grave Escape key is pressed while Shift is held, always send Escape instead of ~.",
    zh: "按住 Shift 时按下反引号转义键,始终发送 Escape 而不是 ~。",
  },
  tapHoldTappingTermHelp: {
    en: "How long (ms) a dual-role key must be held before it counts as a hold rather than a tap. QMK default is 200 ms.",
    zh: "双功能键需按住多久(毫秒)才判定为长按而非轻触。QMK 默认 200 毫秒。",
  },
  tapHoldPermissiveHoldHelp: {
    en: "If another key is tapped (fully pressed and released) while a dual-role key is held, trigger its hold action immediately even before the tapping term elapses. Helps fast typists.",
    zh: "在按住双功能键期间,若完整地轻触了另一个键,即使还没到判定时长也立即触发长按动作。适合打字较快的用户。",
  },
  tapHoldIgnoreModTapInterruptHelp: {
    en: "For mod-tap keys, don't treat another key being pressed as a hold — wait out the tapping term instead, so quick key rolls stay taps.",
    zh: "对 Mod-Tap 键,不因按下其他键就判定为长按,而是等待判定时长结束,使快速连击仍视为轻触。",
  },
  tapHoldTappingForceHoldHelp: {
    en: "After tapping a dual-role key and then quickly holding it again, perform the hold action instead of repeating the tap.",
    zh: "轻触双功能键后立刻再次按住时,执行长按动作而不是重复轻触。",
  },
  tapHoldRetroTappingHelp: {
    en: "If a dual-role key is held past the tapping term but no other key was pressed, still send the tap keycode when released.",
    zh: "若双功能键按住超过判定时长,但期间没有按下其他键,松开时仍发送轻触键码。",
  },
  tapHoldHoldOnOtherKeyPressHelp: {
    en: "Trigger the hold action as soon as any other key is pressed while the dual-role key is held (fires earlier than Permissive Hold).",
    zh: "在按住双功能键期间,只要按下其他任意键就立即触发长按动作(比宽松长按更早)。",
  },
  tapHoldQuickTapTermHelp: {
    en: "Within this time (ms) after a tap, holding the key again repeats the tap; hold longer to get the hold action. Set to 0 to disable tap repeat.",
    zh: "轻触后在此时间(毫秒)内再次按住会重复轻触;超过则触发长按。设为 0 可禁用连续轻触重复。",
  },
  tapHoldTapCodeDelayHelp: {
    en: "Delay (ms) between press and release when a key sends a tap code, for hosts that miss very fast keypresses.",
    zh: "发送 tap code 时按下与松开之间的延迟(毫秒),用于兼容会漏掉过快按键的主机。",
  },
  tapHoldTapHoldCapsDelayHelp: {
    en: "Extra delay (ms) used specifically for the Caps Lock key, which some operating systems need in order to register it reliably.",
    zh: "专门用于 Caps Lock 键的额外延迟(毫秒),部分操作系统需要更长延迟才能可靠识别。",
  },
  tapHoldTappingToggleHelp: {
    en: "Number of taps required to toggle a layer or key on for tap-toggle keys (e.g. TT).",
    zh: "连按切换类按键(如 TT)需要连续轻触的次数即可锁定开启。",
  },
  tapHoldChordalHoldHelp: {
    en: "Applies an opposite-hands rule: same-hand combinations settle as taps, while opposite-hand combinations may settle as holds.",
    zh: "采用左右手规则:同一只手的组合判定为轻触,不同手的组合才可能判定为长按。",
  },
  tapHoldFlowTapHelp: {
    en: "Temporarily disables hold behaviour during fast continuous typing, so keys pressed in quick succession count as taps.",
    zh: "在快速连续打字时暂时禁用长按判定,使紧密相连的按键都视为轻触。",
  },
  comboTermMsHelp: {
    en: "The time window (ms) within which all of a combo's keys must be pressed to trigger it. QMK default is 50 ms.",
    zh: "组合键的所有按键必须在此时间窗口(毫秒)内全部按下才会触发。QMK 默认 50 毫秒。",
  },
  oneShotTapToggleHelp: {
    en: "Tapping a one-shot key this many times in a row locks it on until you tap it once more.",
    zh: "连续轻触单次触发键达到此次数会将其锁定,直到再次轻触解除。",
  },
  oneShotTimeoutMsHelp: {
    en: "How long (ms) a one-shot key stays active waiting for the next key before it is released automatically.",
    zh: "单次触发键在等待下一个按键时保持激活的时长(毫秒),超时后自动释放。",
  },
  mouseKeyDelayHelp: {
    en: "Delay (ms) between pressing a movement key and the cursor starting to move.",
    zh: "按下移动键到光标开始移动之间的延迟(毫秒)。",
  },
  mouseKeyIntervalHelp: {
    en: "Time (ms) between each cursor movement update — smaller values move the cursor more smoothly.",
    zh: "光标每次移动更新之间的间隔时间(毫秒),数值越小移动越平滑。",
  },
  mouseKeyStepSizeHelp: {
    en: "How many pixels the cursor moves on each update (step size).",
    zh: "光标每次更新移动的像素数(移动步长)。",
  },
  mouseKeyMaxSpeedHelp: {
    en: "The maximum cursor speed at which acceleration stops.",
    zh: "光标加速停止时可达到的最大速度。",
  },
  mouseKeyTimeToMaxHelp: {
    en: "Time (ms) taken to accelerate from start up to the maximum cursor speed.",
    zh: "从开始移动加速到最大光标速度所需的时间(毫秒)。",
  },
  mouseKeyWheelDelayHelp: {
    en: "Delay (ms) between pressing a wheel key and the wheel starting to scroll.",
    zh: "按下滚轮键到滚轮开始滚动之间的延迟(毫秒)。",
  },
  mouseKeyWheelIntervalHelp: {
    en: "Time (ms) between each scroll wheel movement.",
    zh: "滚轮每次滚动之间的间隔时间(毫秒)。",
  },
  mouseKeyWheelMaxSpeedHelp: {
    en: "The maximum number of scroll steps per scroll action.",
    zh: "每次滚动动作的最大滚动步数。",
  },
  mouseKeyWheelTimeToMaxHelp: {
    en: "Time (ms) taken to accelerate up to the maximum scroll speed.",
    zh: "加速到最大滚动速度所需的时间(毫秒)。",
  },
  unitMs: { en: "ms", zh: "毫秒" },
  unitPx: { en: "px", zh: "像素" },
  unitSteps: { en: "steps", zh: "步" },
  unitTaps: { en: "taps", zh: "次" },
  resetAllSettings: { en: "Reset all QMK settings", zh: "重置所有QMK设置" },
  resetAllSettingsConfirm: {
    en: "Revert every setting on this page back to when this keyboard connected?",
    zh: "确定要将本页面的所有设置撤销回连接时的状态吗?",
  },
  qmkConfirmChanges: { en: "Confirm changes", zh: "确认修改" },
  qmkConfirmModalTitle: { en: "Apply changes to keyboard?", zh: "确认写入键盘?" },
  qmkConfirmModalHint: {
    en: "The following settings will be written to the keyboard:",
    zh: "以下设置将被写入键盘:",
  },
  qmkConfirmApply: { en: "Confirm & write", zh: "确认写入" },
  qmkValueOn: { en: "On", zh: "开" },
  qmkValueOff: { en: "Off", zh: "关" },
  qmkLeaveTitle: { en: "Leave with unsaved changes?", zh: "有未保存的修改,确定离开吗?" },
  qmkLeaveHint: {
    en: "Some QMK settings haven't been written to the keyboard yet.",
    zh: "部分 QMK 设置还没有写入键盘。",
  },
  qmkLeaveSave: { en: "Save & leave", zh: "保存并离开" },
  qmkLeaveDiscard: { en: "Discard & leave", zh: "放弃修改并离开" },
  languageTitle: { en: "Language", zh: "语言" },
  themeTitle: { en: "Appearance", zh: "外观" },
  themeLight: { en: "Light", zh: "浅色" },
  themeDark: { en: "Dark", zh: "深色" },
  siteAboutIntro: {
    en: "A native web configurator for Vial-protocol keyboards — talking to the keyboard directly over WebHID, with no Qt, no WebAssembly, and no driver install.",
    zh: "面向 Vial 协议键盘的原生网页配置器 —— 通过 WebHID 直接与键盘通信,无需 Qt、无需 WebAssembly、无需安装驱动。",
  },
  siteAboutGithub: { en: "GitHub", zh: "GitHub 项目" },
  siteAboutDiscord: { en: "Discord", zh: "Discord 社区" },
  siteGeneralTitle: { en: "General", zh: "通用" },
  siteDiagnosticsTitle: { en: "Diagnostics", zh: "诊断" },
  debugLogTitle: { en: "Debug logging", zh: "调试日志" },
  debugLogDesc: {
    en: "Print detailed connection logs to the browser console",
    zh: "在浏览器控制台输出详细的连接日志",
  },
  debugLogHint: {
    en: "Leave this off unless you're troubleshooting. When reporting a connection problem, switch it on, retry, then open the browser console (F12) and share what it prints.",
    zh: "除非在排查问题,否则请保持关闭。反馈连接故障时,请先打开此开关并重试,然后按 F12 打开浏览器控制台,把输出的内容一并提供。",
  },
  siteDangerTitle: { en: "Danger Zone", zh: "危险操作" },
  clearCacheTitle: { en: "Clear site cache", zh: "清空网站缓存" },
  clearCacheDesc: {
    en: "Reset all locally stored preferences",
    zh: "重置本地存储的所有偏好设置",
  },
  clearCacheButton: { en: "Clear cache", zh: "清空缓存" },
  clearCacheConfirmTitle: { en: "Clear site cache?", zh: "确定清空网站缓存?" },
  clearCacheConfirmHint: {
    en: "This will erase your saved keyboard style settings (colors, keycap appearance, layout preferences). This cannot be undone.",
    zh: "此操作会清除已保存的键盘样式信息(配色、键帽外观、布局偏好等),且无法撤销。",
  },
  clearCacheConfirm: { en: "Clear cache", zh: "确认清空" },
  languageDesc: { en: "Interface language", zh: "界面语言" },
  themeDesc: { en: "Light or dark theme", zh: "浅色或深色主题" },
  keyDisplayTitle: { en: "Modifier key style", zh: "修饰键类型" },
  keyDisplayDesc: {
    en: "How OS-specific modifier keys are labelled",
    zh: "系统相关修饰键的显示方式",
  },
  keyDisplayMacos: { en: "macOS", zh: "macOS" },
  keyDisplayWindows: { en: "Windows", zh: "Windows" },
  siteColorDesc: {
    en: "The layout read from the connected keyboard",
    zh: "从已连接键盘读取到的配列",
  },
  colorDisplayNote: {
    en: "Color settings only affect the on-screen preview and are not written to the keyboard.",
    zh: "颜色配置仅调整显示效果，不会存入键盘。",
  },
  colorSaveCurrentLayer: { en: "Save current layer", zh: "保存当前层图片" },
  colorSaveAllLayers: { en: "Save all layers", zh: "保存所有层图片" },
  colorSaving: { en: "Saving…", zh: "保存中…" },
  colorLayoutTitle: { en: "Layout options", zh: "布局选项" },
  colorAppearanceTitle: { en: "Appearance", zh: "外观" },
  colorSizeSectionTitle: { en: "Overall", zh: "整体配置" },
  colorFontSectionTitle: { en: "Keyboard font", zh: "键盘字体" },
  colorKeycapSectionTitle: { en: "Keycap", zh: "键帽" },
  colorCaseSectionTitle: { en: "Case & plate", zh: "键盘外壳与定位板" },
  displaySizeTitle: { en: "Display size", zh: "显示尺寸" },
  displaySizeSmaller: { en: "Smaller", zh: "缩小" },
  displaySizeLarger: { en: "Larger", zh: "放大" },
  keySpacingTitle: { en: "Keycap spacing", zh: "键帽间距" },
  keycapWidthTitle: { en: "Keycap width", zh: "键帽宽度" },
  caseRadiusTitle: { en: "Case corner radius", zh: "外壳圆角" },
  caseThicknessTitle: { en: "Case thickness", zh: "外壳厚度" },
  caseColorTitle: { en: "Case color", zh: "外壳颜色" },
  plateColorTitle: { en: "Plate color", zh: "定位板颜色" },
  depthTitle: { en: "3D depth", zh: "立体感" },
  depthDesc: {
    en: "Show highlights and shadows on the keycaps and case",
    zh: "为键帽和外壳显示高光与阴影",
  },
  keycapBorderTitle: { en: "Keycap border", zh: "键帽边框" },
  keycapBorderDesc: {
    en: "Draw a thin outline around each keycap",
    zh: "在每个键帽周围绘制细边框",
  },
  fontSizeTitle: { en: "Font size", zh: "字体大小" },
  fontColorTitle: { en: "Font color", zh: "字体颜色" },
  fontPositionTitle: { en: "Font position", zh: "字体位置" },
  fontPositionTopLeft: { en: "Top left", zh: "左上角" },
  fontPositionCenter: { en: "Center", zh: "居中" },
  fontPositionCenterBottom: { en: "Center bottom", zh: "居中靠下" },
  exportLayoutDesc: { en: "Save the current keymap to a .vil file", zh: "将当前配置保存为 .vil 文件" },
  importLayoutDesc: { en: "Load a keymap from a .vil file", zh: "从 .vil 文件加载配置" },

  // Sidebar
  navHome: { en: "Keyboard Layout", zh: "键盘布局" },
  navMatrixTest: { en: "Keyboard Test", zh: "键盘测试" },
  navMacro: { en: "Macros", zh: "宏配置" },
  navTapDance: { en: "Tap Dance", zh: "Tap Dance" },
  navCombo: { en: "Combos", zh: "Combos" },
  navKeyboardColor: { en: "Personalization", zh: "个性化" },
  navAdvanced: { en: "QMK Settings", zh: "QMK 设置" },
  navSiteSettings: { en: "Website Settings", zh: "网站设置" },
  navImportExport: { en: "Import / Export", zh: "导入导出" },
  comingSoon: { en: "Coming soon", zh: "即将推出" },
  resizeSidebar: { en: "Resize sidebar", zh: "拖动调整侧边栏宽度" },
  collapseSidebar: { en: "Collapse sidebar", zh: "收起侧边栏" },
  expandSidebar: { en: "Expand sidebar", zh: "展开侧边栏" },
  openMenu: { en: "Open menu", zh: "打开菜单" },
  closeMenu: { en: "Close menu", zh: "关闭菜单" },

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
    en: "Each macro has its own number — M0, M1, M2, and so on. Assign a key in the keymap to the matching number (e.g. M0 for the first macro), and pressing it triggers that macro.",
    zh: "每个宏都有自己的编号:M0、M1、M2……。在按键映射中把某个键位设为对应的编号(例如第一个宏是 M0),按下它就会触发那个宏。",
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
  macroMemoryTitle: { en: "Usage", zh: "使用量" },
  macroMemoryUsed: { en: "Memory used: {used}/{total} bytes", zh: "已用内存:{used}/{total} 字节" },
  macroMemoryHelp: {
    en: "All macros share one block of on-keyboard memory. This bar shows how much of it your current macros use — saving is blocked once it's full.",
    zh: "所有宏共用键盘上的一块存储空间。这个进度条表示当前所有宏占用了多少;一旦占满就无法再保存。",
  },
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
  tapDanceUsedHelp: {
    en: "This bar shows how many tap dance slots are in use out of the total this keyboard provides.",
    zh: "这个进度条表示已使用的点击舞步槽位数占键盘可用总数的比例。",
  },
  tapDanceTermMs: { en: "{ms} ms", zh: "{ms} 毫秒" },
  msUnit: { en: "ms", zh: "毫秒" },
  tapDanceDeleteConfirm: {
    en: "Delete this tap dance? This clears all its actions.",
    zh: "确定要删除这个点击舞步吗?这会清空它的所有动作。",
  },
  tapDanceAssigned: { en: "In use", zh: "已使用" },
  tapDanceUnassigned: { en: "Not in use", zh: "未使用" },
  tapDanceAssignedHelp: {
    en: "TD({n}) is placed on a key in the keymap.",
    zh: "TD({n}) 已被放置到按键映射中。",
  },
  tapDanceUnassignedHelp: {
    en: "TD({n}) is configured but not yet placed on any key.",
    zh: "TD({n}) 已配置,但还没有放置到任何按键上。",
  },
  tapDanceAdd: { en: "Add tap dance", zh: "添加 Tap Dance" },
  tapDanceRenumber: { en: "Change slot number", zh: "更换槽位编号" },
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
  comboUsedHelp: {
    en: "This bar shows how many combo slots are in use out of the total this keyboard provides.",
    zh: "这个进度条表示已使用的组合键槽位数占键盘可用总数的比例。",
  },
  comboDeleteConfirm: {
    en: "Delete this combo?",
    zh: "确定删除这个组合键吗?",
  },
  comboActive: { en: "Active", zh: "已生效" },
  comboAdd: { en: "Add combo", zh: "添加 Combo" },
  comboRenumber: { en: "Change slot number", zh: "更换槽位编号" },
  comboEmpty: { en: "No combos configured yet.", zh: "还没有配置任何组合键。" },
  comboFull: {
    en: "All combo slots are already in use.",
    zh: "所有组合键槽位都已被使用。",
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

  // Quick config
  quickConfigTitle: { en: "Quick Config", zh: "快捷配置" },
  quickConfigHint: { en: "Select a key above, then click a key below to assign it.", zh: "先在上方选中一个键位,再点击下方键盘为其赋值。" },
  quickConfigNoSelection: { en: "No key selected", zh: "未选中键位" },
  selectKeyFirst: { en: "Please select the key you want to change", zh: "请选中需要修改的按键" },
  advancedPicker: { en: "Advanced…", zh: "高级…" },

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
  anyKeycodeHeading: { en: "Any Keycode", zh: "任意键码" },
  groupConfigSettings: { en: "Config Settings", zh: "配置设置" },
  autoAdvance: { en: "Auto-select next", zh: "自动选取下一个" },
  autoAdvanceHelp: {
    en: "When on, assigning a key automatically selects the next key so you can configure them in sequence.",
    zh: "开启后,设置完成一个按键会自动选中下一个按键,便于连续配置。",
  },
  pickInnerKey: { en: "{template} — now pick the inner key", zh: "{template}——请继续选择内部按键" },
  cancel: { en: "Cancel", zh: "取消" },
  cannotNest: {
    en: "{qmkId} cannot be nested inside {template}; pick a basic key",
    zh: "{qmkId} 不能嵌套进 {template},请选择基础键",
  },
  noKeyMapping: { en: 'no keycode mapping for "{code}"', zh: "没有与 “{code}” 对应的键码" },
  noMatch: { en: "No keycodes match “{query}”.", zh: "没有匹配 “{query}” 的键码。" },

  // Basic-category "clear" keys (KC_NO / KC_TRNS) — two different kinds of clear
  clearNoLabel: { en: "Clear", zh: "清空按键" },
  clearNoTitle: {
    en: "KC_NO — key does nothing (no function on any layer)",
    zh: "KC_NO — 清空为空键,该位置无任何功能",
  },
  clearTransLabel: { en: "Transparent", zh: "设置为穿透" },
  clearTransTitle: {
    en: "KC_TRNS — transparent: falls through to the same key on a lower layer",
    zh: "KC_TRNS — 透明清空,沿用下层同一位置的按键",
  },

  // Keycode categories (keys must mirror KEYCODE_CATEGORIES names in keycodes.ts)
  categoryBasic: { en: "Basic Keys", zh: "基础按键" },
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
  categoryFnMediaMouse: { en: "Function", zh: "功能按键" },
  categoryLighting: { en: "Lighting", zh: "灯光" },
  categoryCustom: { en: "Custom", zh: "自定义" },
  categoryKeyboardFunction: { en: "Keyboard Function", zh: "键盘功能" },
  categoryKeyboardConfig: { en: "Keyboard Config", zh: "键盘配置" },
  categoryOther: { en: "Other", zh: "其他" },

  // Category-level function descriptions shown in the cascade selector's info panel.
  cascadeDescIso: {
    en: "Extra keys for ISO/JIS layouts and international input (non-US symbols, Kana, etc.).",
    zh: "ISO/JIS 布局及国际输入所需的额外按键（非美式符号、假名等）。",
  },
  cascadeDescLayers: {
    en: "Switch, toggle, or momentarily activate keymap layers.",
    zh: "切换、锁定或临时激活键盘层。",
  },
  cascadeDescQuantum: {
    en: "QMK advanced keys: one-shot mods, held modifiers, and mod-tap / layer-tap combinations.",
    zh: "QMK 高级按键:一次性修饰键、组合修饰键、按住/点击双功能等。",
  },
  cascadeDescMedia: {
    en: "Media playback, volume, brightness, and system control keys.",
    zh: "媒体播放、音量、亮度与系统控制按键。",
  },
  cascadeDescMouse: {
    en: "Move the pointer, click mouse buttons, and scroll the wheel from the keyboard.",
    zh: "用键盘移动指针、点击鼠标按键和滚动滚轮。",
  },
  cascadeDescLighting: {
    en: "Control backlight and RGB lighting: brightness, hue, effects, and modes.",
    zh: "控制背光与 RGB 灯光:亮度、色相、灯效与模式。",
  },
  cascadeDescCustom: {
    en: "Keyboard-specific custom keycodes defined by this device's firmware.",
    zh: "本键盘固件定义的专属自定义键码。",
  },
  // Macro / tap-dance preview inside the cascade selector's info panel.
  cascadeMacroContents: { en: "Macro contents", zh: "宏内容" },
  cascadeTapDanceActions: { en: "Tap dance actions", zh: "多击动作" },
  cascadeNotConfigured: { en: "Not configured yet.", zh: "尚未配置。" },

  // Per-key help for the Lighting keys in the "Keyboard Function" tab.
  lightBlTogg: { en: "Toggle single-color backlight on/off.", zh: "开关单色背光。" },
  lightBlStep: { en: "Cycle through backlight brightness levels.", zh: "循环切换背光亮度档位。" },
  lightBlBrtg: { en: "Toggle the backlight breathing effect.", zh: "开关背光呼吸效果。" },
  lightBlOn: { en: "Turn the backlight on.", zh: "打开背光。" },
  lightBlOff: { en: "Turn the backlight off.", zh: "关闭背光。" },
  lightBlInc: { en: "Increase backlight brightness.", zh: "增加背光亮度。" },
  lightBlDec: { en: "Decrease backlight brightness.", zh: "降低背光亮度。" },
  lightRgbTog: { en: "Toggle RGB lighting on/off.", zh: "开关 RGB 灯光。" },
  lightRgbMod: { en: "Switch to the next RGB effect.", zh: "切换到下一个 RGB 灯效。" },
  lightRgbRmod: { en: "Switch to the previous RGB effect.", zh: "切换到上一个 RGB 灯效。" },
  lightRgbHui: { en: "Increase hue (shift color).", zh: "增加色相（改变颜色）。" },
  lightRgbHud: { en: "Decrease hue (shift color).", zh: "减少色相（改变颜色）。" },
  lightRgbSai: { en: "Increase color saturation.", zh: "增加饱和度。" },
  lightRgbSad: { en: "Decrease color saturation.", zh: "降低饱和度。" },
  lightRgbVai: { en: "Increase RGB brightness.", zh: "增加 RGB 亮度。" },
  lightRgbVad: { en: "Decrease RGB brightness.", zh: "降低 RGB 亮度。" },
  lightRgbSpi: { en: "Increase effect animation speed.", zh: "加快灯效动画速度。" },
  lightRgbSpd: { en: "Decrease effect animation speed.", zh: "减慢灯效动画速度。" },
  lightRgbMP: { en: "Solid single-color mode (no animation).", zh: "纯色模式（无动画）。" },
  lightRgbMB: { en: "Breathing effect.", zh: "呼吸灯效。" },
  lightRgbMR: { en: "Rainbow gradient effect.", zh: "彩虹渐变灯效。" },
  lightRgbMSw: { en: "Swirl effect.", zh: "漩涡灯效。" },
  lightRgbMSn: { en: "Snake effect.", zh: "蛇形灯效。" },
  lightRgbMK: { en: "Knight (scanning) effect.", zh: "骑士扫描灯效。" },
  lightRgbMX: { en: "Christmas effect.", zh: "圣诞灯效。" },
  lightRgbMG: { en: "Static gradient effect.", zh: "静态渐变灯效。" },
  lightRgbMT: { en: "RGB test effect (cycles all LEDs).", zh: "RGB 测试灯效（逐个点亮所有灯）。" },

  // Per-key help for the Media keys (shown as a hover tooltip on the expanded
  // Media card, and in the cascade selector's info panel).
  mediaVolu: { en: "Volume up.", zh: "增大音量。" },
  mediaVold: { en: "Volume down.", zh: "减小音量。" },
  mediaMute: { en: "Mute / unmute audio.", zh: "静音 / 取消静音。" },
  mediaMply: { en: "Play or pause media.", zh: "播放 / 暂停。" },
  mediaMstp: { en: "Stop media playback.", zh: "停止播放。" },
  mediaMprv: { en: "Previous track.", zh: "上一曲。" },
  mediaMnxt: { en: "Next track.", zh: "下一曲。" },
  mediaMrwd: { en: "Rewind.", zh: "快退。" },
  mediaMffd: { en: "Fast forward.", zh: "快进。" },
  mediaEjct: { en: "Eject media.", zh: "弹出媒体。" },
  mediaBriu: { en: "Increase screen brightness.", zh: "增加屏幕亮度。" },
  mediaBrid: { en: "Decrease screen brightness.", zh: "降低屏幕亮度。" },
  mediaPwr: { en: "System power.", zh: "系统电源（关机）。" },
  mediaSlep: { en: "Put the system to sleep.", zh: "系统睡眠。" },
  mediaWake: { en: "Wake the system.", zh: "唤醒系统。" },
  mediaCalc: { en: "Open the calculator.", zh: "打开计算器。" },
  mediaMail: { en: "Open the mail client.", zh: "打开邮件客户端。" },
  mediaMsel: { en: "Open the media player.", zh: "打开媒体播放器。" },
  mediaMycm: { en: "Open the file explorer (My Computer).", zh: "打开“我的电脑”/文件管理器。" },
  mediaWsch: { en: "Web search.", zh: "网页搜索。" },
  mediaWhom: { en: "Open the browser home page.", zh: "打开浏览器主页。" },
  mediaWbak: { en: "Browser: go back.", zh: "浏览器后退。" },
  mediaWfwd: { en: "Browser: go forward.", zh: "浏览器前进。" },
  mediaWstp: { en: "Stop loading the page.", zh: "停止加载网页。" },
  mediaWref: { en: "Refresh the page.", zh: "刷新网页。" },
  mediaWfav: { en: "Open browser favorites.", zh: "打开浏览器收藏夹。" },
  mediaExec: { en: "Execute key.", zh: "执行键。" },
  mediaHelp: { en: "Help key.", zh: "帮助键。" },
  mediaSlct: { en: "Select key.", zh: "选择键。" },
  mediaStop: { en: "Stop key.", zh: "停止键。" },
  mediaAgin: { en: "Again / redo.", zh: "重做 / 再次。" },
  mediaUndo: { en: "Undo.", zh: "撤销。" },
  mediaCut: { en: "Cut.", zh: "剪切。" },
  mediaCopy: { en: "Copy.", zh: "复制。" },
  mediaPste: { en: "Paste.", zh: "粘贴。" },
  mediaFind: { en: "Find.", zh: "查找。" },
  categoryTapDance: { en: "Tap Dance", zh: "Tap Dance" },
  categoryMacrosTapDance: { en: "Combo Keys", zh: "组合按键" },

  // Basic-category sub-groups (cascade selector middle column)
  groupBasicLetters: { en: "Letters", zh: "字母" },
  groupBasicNumbers: { en: "Numbers", zh: "数字" },
  groupBasicSymbols: { en: "Symbols", zh: "符号" },
  groupBasicFKeys: { en: "F-keys", zh: "F 功能键" },
  groupBasicEditing: { en: "Editing", zh: "编辑/导航" },
  groupBasicMods: { en: "Modifiers", zh: "修饰键" },
  groupBasicBoard: { en: "Basic Keys", zh: "基础按键" },

  // Special-keys section below the simulated keyboard (clear / transparent / any)
  specialKeys: { en: "Special Keys", zh: "特殊按键" },
  specialClear: { en: "Clear", zh: "清空按键" },
  specialTransparent: { en: "Transparent", zh: "穿透按键" },
  specialAny: { en: "Any Key", zh: "任意按键" },

  // Sub-groups within the "Function" tab
  groupFnKeys: { en: "F13~F24", zh: "F13~F24" },
  groupMouse: { en: "Mouse", zh: "鼠标按键" },
  groupMedia: { en: "Media", zh: "媒体按键" },
  groupLayerKeys: { en: "Layer", zh: "层按键" },

  // The expanded 层按键 card: pick a layer-switch type, then a target layer number.
  layerPickType: { en: "Layer Type", zh: "层类型" },
  layerPickNum: { en: "Layer Number", zh: "层编号" },
  layerPickNumHint: { en: "Pick a type first", zh: "请先选择层类型" },

  // Section labels within the expanded Mouse card (cross-shaped clusters + rest)
  groupMouseMove: { en: "Move", zh: "移动" },
  groupMouseWheel: { en: "Wheel", zh: "滚轮" },
  groupMouseButtons: { en: "Buttons", zh: "按键" },
  groupMouseSpeed: { en: "Speed", zh: "速度" },

  // Sub-groups within the merged "Macros / Tap Dance" tab
  groupMacros: { en: "Macros", zh: "宏" },
  groupTapDance: { en: "Tap Dance", zh: "Tap Dance" },
  groupMultiFunction: { en: "Key Overlay", zh: "按键叠加" },
  multiFuncModified: {
    en: "Modifier",
    zh: "修饰键",
  },
  multiFuncTapHold: {
    en: "Hold for layer or modifier",
    zh: "长按激活层或者修饰键",
  },
  multiFuncIntro: {
    en: "Add functions on top of a base key",
    zh: "为基础按键叠加功能",
  },
  detailSettings: { en: "Detailed settings", zh: "详细设置" },

  // Combo-keys tab: the two expandable category cards
  comboCardReveal: { en: "Click to reveal", zh: "点击展开" },
  comboCardCount: { en: "{n} available", zh: "共 {n} 个" },
  comboCardUsed: { en: "Total ({used}/{total})", zh: "共计 ({used}/{total}) 个" },
  comboCardEmpty: { en: "None on this device", zh: "此设备暂无" },
  comboSlotConfigured: { en: "Already configured", zh: "已配置" },
  layerCardCommon: { en: "Common", zh: "常用" },
  comboCardEdit: { en: "Edit", zh: "编辑" },
  // The third, non-expandable Combo card in the "Macros / Tap Dance" tab.
  groupCombo: { en: "Combo", zh: "Combo" },
  comboCardInfoHint: { en: "Applied automatically", zh: "创建后自动生效" },
  comboAutoApply: {
    en: "Combos take effect automatically once created — no key binding needed.",
    zh: "combo 创建完自动生效，无需绑定按键",
  },

  // Sub-groups within the "Layers" tab (one per layer-switch function)
  groupLayerMO: { en: "MO · Momentary", zh: "MO · 临时层" },
  groupLayerTG: { en: "TG · Toggle", zh: "TG · 切换层" },
  groupLayerTT: { en: "TT · Tap-Toggle", zh: "TT · 点触切换" },
  groupLayerOSL: { en: "OSL · One-Shot", zh: "OSL · 单次层" },
  groupLayerTO: { en: "TO · Activate", zh: "TO · 激活层" },
  groupLayerDF: { en: "DF · Default", zh: "DF · 默认层" },
  groupLayerOther: { en: "Other", zh: "其他" },

  // Hover help for each "Layers" sub-group
  groupLayerMOHelp: {
    en: "Activates the target layer only while the key is held down; releasing returns to the previous layer.",
    zh: "按住时临时激活目标层，松开后立即回到原来的层。",
  },
  groupLayerTGHelp: {
    en: "Toggles the target layer on or off with each tap; the layer stays active until you toggle it off.",
    zh: "每次点按在开/关之间切换目标层，激活后会保持，直到再次切换关闭。",
  },
  groupLayerTTHelp: {
    en: "Acts like MO when held, but tapping it repeatedly toggles the layer on like TG.",
    zh: "按住时表现为 MO（临时层），连续点按则像 TG 一样把层锁定开启。",
  },
  groupLayerOSLHelp: {
    en: "Activates the target layer for the next single key press only, then returns automatically.",
    zh: "只对下一次按键激活目标层，按完一个键后自动返回。",
  },
  groupLayerTOHelp: {
    en: "Switches to the target layer and keeps it active, turning off other layers above the base.",
    zh: "切换到目标层并保持激活，同时关闭基础层之上的其他层。",
  },
  groupLayerDFHelp: {
    en: "Sets the target layer as the new default (base) layer that stays active by default.",
    zh: "将目标层设为新的默认（基础）层，默认保持激活。",
  },
  groupLayerOtherHelp: {
    en: "Other layer-switching keycodes that don't fit the categories above.",
    zh: "不属于上述分类的其他层切换键码。",
  },

  // Sub-groups within the "Quantum" tab
  groupQuantumOSM: { en: "One-Shot Mods", zh: "单次修饰键" },
  groupQuantumMods: { en: "Modifiers", zh: "修饰键" },
  groupQuantumModTap: { en: "Mod-Tap", zh: "修饰 / 点触" },
  groupQuantumLayerTap: { en: "Layer-Tap", zh: "层 / 点触" },
  groupQuantumOther: { en: "Other", zh: "其他" },
  groupQuantumMisc: { en: "Miscellaneous", zh: "其他键码" },
  // Heading for the catch-all card in the 其他 column (One-Shot Mods + misc
  // Quantum + leftover Layer fn keys). Named "更多 / More" rather than "其他"
  // to read as an overflow bucket, not a sibling of the 其他 category itself.
  cardMore: { en: "More", zh: "更多" },

  // Hover help for each "Quantum" sub-group
  groupQuantumOSMHelp: {
    en: "Tap to apply the modifier to the next single key press only, so you don't have to hold it down.",
    zh: "点按后只对下一次按键生效对应修饰键，无需一直按住。",
  },
  groupQuantumModsHelp: {
    en: "Applies one or more modifiers (Ctrl/Shift/Alt/GUI) to another basic keycode.",
    zh: "为某个基础键码叠加一个或多个修饰键（Ctrl/Shift/Alt/GUI）。",
  },
  groupQuantumModTapHelp: {
    en: "Acts as a modifier when held and sends the basic keycode when tapped.",
    zh: "按住时作为修饰键，点按时发送基础键码。",
  },
  groupQuantumLayerTapHelp: {
    en: "Activates the target layer when held and sends the basic keycode when tapped.",
    zh: "按住时激活目标层，点按时发送基础键码。",
  },
  groupQuantumOtherHelp: {
    en: "Other Quantum keycodes that don't fit the categories above.",
    zh: "不属于上述分类的其他 Quantum 键码。",
  },

  // QuantumCards composer (Modifiers / Mod-Tap / Layer-Tap)
  quantumCardConfigure: { en: "Click to configure", zh: "点击配置" },
  quantumPickMods: { en: "① Modifiers", zh: "① 选择修饰键" },
  quantumPickLayer: { en: "① Target layer", zh: "① 选择目标层" },
  quantumPickBasic: { en: "② Basic key", zh: "② 选择普通按键" },
  quantumSideLeft: { en: "Left", zh: "左" },
  quantumSideRight: { en: "Right", zh: "右" },
  quantumLayerN: { en: "L{n}", zh: "层 {n}" },
  quantumPreview: { en: "Preview", zh: "预览" },
  quantumApply: { en: "Apply to key", zh: "应用到按键" },
  quantumComboMissing: {
    en: "No keycode exists for this modifier combination — pick a different one.",
    zh: "该修饰键组合没有对应的键码,请更换组合。",
  },
  quantumNeedMod: { en: "Select at least one modifier.", zh: "请至少选择一个修饰键。" },
  quantumNeedLayer: { en: "Select a target layer.", zh: "请选择目标层。" },
  quantumNeedBasic: { en: "Pick a basic key below.", zh: "请在下方选择一个普通按键。" },

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

  // Key info hover card
  keyInfoCode: { en: "Code", zh: "编码" },
  keyInfoTap: { en: "Tap", zh: "点击" },
  keyInfoHold: { en: "Hold", zh: "长按" },
  keyInfoCombo: { en: "Together", zh: "同时" },
  keyInfoLayerAction: { en: "Switch to layer {layer}", zh: "切换到层 {layer}" },
  keyInfoComboHint: {
    en: "Fires the modifier and key on a single press.",
    zh: "单次按下会同时触发修饰键与按键。",
  },
  keyInfoModTapHint: {
    en: "Tap for the key, hold for the modifier.",
    zh: "轻点触发按键,长按触发修饰键。",
  },
  keyInfoLayerTapHint: {
    en: "Tap for the key, hold to switch layer.",
    zh: "轻点触发按键,长按切换层。",
  },

  // Dual-role hold editor (shown when a cap's hold band is selected)
  holdEditorTitle: { en: "Hold action", zh: "长按动作" },
  holdEditorTapKeeps: { en: "Tap stays: {key}", zh: "点按保持:{key}" },
  holdEditorModeNone: { en: "None", zh: "无" },
  holdEditorModifiers: { en: "Modifiers", zh: "修饰键" },
  holdEditorSide: { en: "Side", zh: "左右" },
  holdEditorSideLeft: { en: "Left", zh: "左" },
  holdEditorSideRight: { en: "Right", zh: "右" },
  holdEditorLayer: { en: "Layer", zh: "层" },
  holdEditorNoModsHint: {
    en: "No modifier selected — clearing all removes the hold and the cap becomes a plain key.",
    zh: "未选择修饰键——全部取消将移除长按,按键变为普通键。",
  },
  // Fire-together (masked-modifier) editor: the dashed-band cards.
  holdComboTitle: { en: "Combined modifiers", zh: "组合修饰键" },
  holdComboIntro: {
    en: "A single press fires the tap key together with the checked modifiers.",
    zh: "单次按下会让点按键与勾选的修饰键同时触发。",
  },
  holdComboUnsupported: {
    en: "This modifier combination has no fire-together form on this side.",
    zh: "该修饰键组合在此侧没有「同时触发」形式。",
  },
  holdModUnsupported: {
    en: "This modifier combination has no matching keycode.",
    zh: "该修饰键组合没有对应的键码。",
  },
  holdSelectAtLeastOne: {
    en: "Select at least one modifier — the key is cleared when you leave.",
    zh: "至少选择一个修饰键——离开此界面后按键将被清空。",
  },
  holdClearKey: { en: "Clear key", zh: "清空按键" },
} as const satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof MESSAGES;

export function detectLang(): Lang {
  // An explicit ?lang= wins so the SEO hreflang variants (?lang=en / ?lang=zh)
  // deliver the advertised language to crawlers and shared links.
  try {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (param === "en" || param === "zh") {
      return param;
    }
  } catch {
    // No URL / params available — fall through.
  }
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

function setMetaContent(selector: string, content: string): void {
  const el = document.head.querySelector(selector);
  if (el) {
    el.setAttribute("content", content);
  }
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

  // Keep SEO-relevant document metadata in sync with the active language. This
  // is a client-rendered SPA on a single URL, so the crawler-visible title,
  // description, <html lang>, and og:locale must be updated at runtime rather
  // than baked statically into index.html.
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = MESSAGES.seoTitle[lang];
    setMetaContent("meta[name='description']", MESSAGES.seoDescription[lang]);
    setMetaContent("meta[property='og:title']", MESSAGES.seoTitle[lang]);
    setMetaContent("meta[property='og:description']", MESSAGES.seoDescription[lang]);
    setMetaContent("meta[property='og:locale']", lang === "zh" ? "zh_CN" : "en_US");
    setMetaContent("meta[name='twitter:title']", MESSAGES.seoTitle[lang]);
    setMetaContent("meta[name='twitter:description']", MESSAGES.seoDescription[lang]);
  }, [lang]);

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
