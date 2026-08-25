// Lightweight en/zh/ja/fr UI localization: a static dictionary, a `t()` formatter
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

export type Lang = "en" | "zh" | "ja" | "fr";

const STORAGE_KEY = "vialite-lang";

const MESSAGES = {
  // SEO — document <title> and meta description, swapped per language at runtime.
  seoTitle: {
    en: "Vialite — Web Configurator for Vial Keyboards (WebHID, no install)",
    zh: "Vialite — Vial 键盘在线配置器（WebHID，免安装）",
    ja: "Vialite — Vial キーボード用ウェブコンフィギュレーター（WebHID、インストール不要）",
    fr: "Vialite — Configurateur Web pour claviers Vial (WebHID, sans installation)",
  },
  seoDescription: {
    en: "Configure your Vial-protocol keyboard right in the browser over WebHID — remap keys, layers, macros, tap dance, combos, RGB, and QMK settings. No Qt, no WebAssembly, no driver install. Works in Chrome and Edge.",
    zh: "在浏览器中通过 WebHID 直接配置 Vial 协议键盘：改键、分层、宏、Tap Dance、组合键、RGB 灯光与 QMK 高级设置。无需 Qt、无需 WebAssembly、无需安装驱动，支持 Chrome 与 Edge。",
    ja: "WebHID を使ってブラウザから直接 Vial プロトコル対応キーボードを設定できます。キー割り当て、レイヤー、マクロ、Tap Dance、コンボ、RGB、QMK 設定に対応。Qt も WebAssembly もドライバーのインストールも不要。Chrome と Edge で動作します。",
    fr: "Configurez votre clavier au protocole Vial directement dans le navigateur via WebHID — remappage des touches, calques, macros, Tap Dance, combos, RGB et réglages QMK. Sans Qt, sans WebAssembly, sans pilote à installer. Fonctionne sur Chrome et Edge.",
  },
  // App
  exportLayout: { en: "Export layout", zh: "导出配置", ja: "レイアウトをエクスポート", fr: "Exporter la configuration" },
  importLayout: { en: "Import layout", zh: "导入配置", ja: "レイアウトをインポート", fr: "Importer la configuration" },
  importing: { en: "Importing…", zh: "导入中…", ja: "インポート中…", fr: "Importation…" },
  importWritten: {
    en: "Imported: {n} assignment(s) written.",
    zh: "导入完成:写入 {n} 个键位。",
    ja: "インポート完了:{n} 件のキー割り当てを書き込みました。",
    fr: "Import terminé : {n} assignation(s) écrite(s).",
  },
  importSkippedKeycodes: {
    en: "Skipped unsupported keycodes: {list}.",
    zh: "跳过不支持的键码:{list}。",
    ja: "非対応のキーコードをスキップしました:{list}。",
    fr: "Codes de touche non pris en charge ignorés : {list}.",
  },
  importSkippedFeatures: {
    en: "File contains {list} — not supported yet, not applied.",
    zh: "文件还包含 {list},暂不支持,未写入。",
    ja: "ファイルには {list} が含まれていますが、まだ対応していないため適用されませんでした。",
    fr: "Le fichier contient {list} — non pris en charge pour l'instant, non appliqué.",
  },
  importFailed: {
    en: "Import failed: {error}",
    zh: "导入失败:{error}",
    ja: "インポートに失敗しました:{error}",
    fr: "Échec de l'import : {error}",
  },
  importUidMismatch: {
    en: "Saved keymap belongs to a different keyboard, are you sure you want to continue?",
    zh: "这份配置属于另一把键盘,确定要继续导入吗?",
    ja: "保存されたキーマップは別のキーボード用です。続行してもよろしいですか?",
    fr: "Cette configuration enregistrée appartient à un autre clavier. Voulez-vous vraiment continuer ?",
  },
  // Generic write failure, for panels with no wording of their own — see hooks/useWriteError.ts.
  writeFailed: {
    en: "Failed to write to the keyboard: {error}",
    zh: "写入键盘失败:{error}",
    ja: "キーボードへの書き込みに失敗しました:{error}",
    fr: "Échec de l'écriture sur le clavier : {error}",
  },
  writeKeyFailed: {
    en: "Failed to write key: {error}",
    zh: "写入键值失败:{error}",
    ja: "キーの書き込みに失敗しました:{error}",
    fr: "Échec de l'écriture de la touche : {error}",
  },
  keyModifiedSuccess: {
    en: "Saved",
    zh: "修改成功",
    ja: "保存しました",
    fr: "Enregistré",
  },
  keyboardDisconnected: {
    en: "Keyboard disconnected — plug it back in and reconnect.",
    zh: "键盘已断开——重新插入后再连接。",
    ja: "キーボードが切断されました——再度接続してください。",
    fr: "Clavier déconnecté — rebranchez-le puis reconnectez-vous.",
  },
  deviceConnected: {
    en: "Connected to {name}",
    zh: "已连接:{name}",
    ja: "{name} に接続しました",
    fr: "Connecté à {name}",
  },
  deviceDisconnected: {
    en: "Disconnected",
    zh: "已断开连接",
    ja: "切断されました",
    fr: "Déconnecté",
  },
  // Connect failures. Keyed by ProtocolErrorCode (see transport.ts) and mapped
  // in App.tsx's describeConnectError — the protocol layer is framework-agnostic
  // and can't translate its own messages.
  errWebhidUnsupported: {
    en: "This browser does not support WebHID. Use Chrome or Edge.",
    zh: "此浏览器不支持 WebHID,请使用 Chrome 或 Edge。",
    ja: "このブラウザは WebHID に対応していません。Chrome または Edge をご利用ください。",
    fr: "Ce navigateur ne prend pas en charge WebHID. Utilisez Chrome ou Edge.",
  },
  errNoDeviceSelected: {
    en: "No device selected.",
    zh: "未选择设备。",
    ja: "デバイスが選択されていません。",
    fr: "Aucun périphérique sélectionné.",
  },
  errDeviceDisconnected: {
    en: "The keyboard was disconnected during the operation.",
    zh: "操作过程中键盘已断开连接。",
    ja: "操作中にキーボードが切断されました。",
    fr: "Le clavier a été déconnecté pendant l'opération.",
  },
  errReconnectNotFound: {
    en: "Couldn't find that keyboard. Make sure it's plugged in, or try Detect device instead.",
    zh: "未找到该键盘,请确认已插入,或改用「检测设备」。",
    ja: "そのキーボードが見つかりませんでした。接続されているか確認するか、「デバイスを検出」をお試しください。",
    fr: "Ce clavier est introuvable. Vérifiez qu'il est bien branché, ou utilisez plutôt « Détecter le périphérique ».",
  },
  errCommFailed: {
    en: "Failed to communicate with the keyboard. Unplug it, plug it back in, and try again.",
    zh: "与键盘通信失败。请拔下键盘重新插入后再试。",
    ja: "キーボードとの通信に失敗しました。一度取り外して再度接続し、もう一度お試しください。",
    fr: "Échec de la communication avec le clavier. Débranchez-le, rebranchez-le, puis réessayez.",
  },
  errViaOnlyKeyboard: {
    en: "This keyboard does not support the Vial protocol — it looks like a VIA-only board. Vialite only works with keyboards running Vial firmware.",
    zh: "该键盘不支持 Vial 协议,看起来是仅支持 VIA 的键盘。Vialite 仅支持刷入 Vial 固件的键盘。",
    ja: "このキーボードは Vial プロトコルに対応していません——VIA のみに対応した基板のようです。Vialite は Vial ファームウェアを搭載したキーボードでのみ動作します。",
    fr: "Ce clavier ne prend pas en charge le protocole Vial — il semble s'agir d'une carte compatible VIA uniquement. Vialite ne fonctionne qu'avec des claviers exécutant un firmware Vial.",
  },
  errUnsupportedProtocol: {
    en: "Unsupported protocol version (VIA {via}, Vial {vial}). This keyboard's firmware is not compatible with Vialite.",
    zh: "不支持的协议版本(VIA {via}、Vial {vial})。该键盘固件与 Vialite 不兼容。",
    ja: "非対応のプロトコルバージョンです(VIA {via}、Vial {vial})。このキーボードのファームウェアは Vialite と互換性がありません。",
    fr: "Version de protocole non prise en charge (VIA {via}, Vial {vial}). Le firmware de ce clavier n'est pas compatible avec Vialite.",
  },
  errMalformedDefinition: {
    en: "The keyboard reported a malformed layout definition (vial.json). Its firmware may be broken.",
    zh: "键盘返回的布局定义(vial.json)格式有误,固件可能存在问题。",
    ja: "キーボードから不正なレイアウト定義(vial.json)が返されました。ファームウェアが破損している可能性があります。",
    fr: "Le clavier a renvoyé une définition de disposition invalide (vial.json). Son firmware est peut-être corrompu.",
  },
  errConnectFailed: {
    en: "Failed to connect: {error}",
    zh: "连接失败:{error}",
    ja: "接続に失敗しました:{error}",
    fr: "Échec de la connexion : {error}",
  },
  keyboardLayoutTitle: { en: "Keyboard Config", zh: "键盘配置", ja: "キーボード設定", fr: "Configuration du clavier" },
  keyboardLayoutSubtitle: {
    en: "Click a key to reassign it, or switch layers above.",
    zh: "点击键位即可重新分配功能,或在上方切换层。",
    ja: "キーをクリックして再割り当てするか、上部でレイヤーを切り替えてください。",
    fr: "Cliquez sur une touche pour la réassigner, ou changez de calque ci-dessus.",
  },
  magicSettingsTitle: { en: "Magic", zh: "Magic", ja: "Magic", fr: "Magic" },
  magicSwapCapsLockControl: {
    en: "Swap Caps Lock and Left Control",
    zh: "交换 Caps Lock 与左 Control",
    ja: "Caps Lock と左 Control を入れ替え",
    fr: "Échanger Verr. Maj. et Ctrl gauche",
  },
  magicCapsLockAsControl: {
    en: "Treat Caps Lock as Control",
    zh: "将 Caps Lock 作为 Control 使用",
    ja: "Caps Lock を Control として使用",
    fr: "Utiliser Verr. Maj. comme Ctrl",
  },
  magicSwapLaltLgui: {
    en: "Swap Left Alt and GUI",
    zh: "交换左 Alt 与 GUI",
    ja: "左 Alt と GUI を入れ替え",
    fr: "Échanger Alt gauche et GUI",
  },
  magicSwapRaltRgui: {
    en: "Swap Right Alt and GUI",
    zh: "交换右 Alt 与 GUI",
    ja: "右 Alt と GUI を入れ替え",
    fr: "Échanger Alt droit et GUI",
  },
  magicDisableGui: {
    en: "Disable the GUI keys",
    zh: "禁用 GUI 键",
    ja: "GUI キーを無効化",
    fr: "Désactiver les touches GUI",
  },
  magicSwapGraveEsc: {
    en: "Swap ` and Escape",
    zh: "交换 ` 与 Escape",
    ja: "` と Escape を入れ替え",
    fr: "Échanger ` et Échap",
  },
  magicSwapBackslashBackspace: {
    en: "Swap \\ and Backspace",
    zh: "交换 \\ 与 Backspace",
    ja: "\\ と Backspace を入れ替え",
    fr: "Échanger \\ et Retour arrière",
  },
  magicNkro: {
    en: "Enable N-key rollover",
    zh: "启用 N 键无冲(NKRO)",
    ja: "Nキーロールオーバー(NKRO)を有効化",
    fr: "Activer l'anti-ghosting (NKRO)",
  },
  magicSwapLctlLgui: {
    en: "Swap Left Control and GUI",
    zh: "交换左 Control 与 GUI",
    ja: "左 Control と GUI を入れ替え",
    fr: "Échanger Ctrl gauche et GUI",
  },
  magicSwapRctlRgui: {
    en: "Swap Right Control and GUI",
    zh: "交换右 Control 与 GUI",
    ja: "右 Control と GUI を入れ替え",
    fr: "Échanger Ctrl droit et GUI",
  },
  graveEscapeSettingsTitle: {
    en: "Grave Escape",
    zh: "反引号转义 (Grave Escape)",
    ja: "バッククォート・エスケープ (Grave Escape)",
    fr: "Échappement Grave (Grave Escape)",
  },
  graveEscapeAlt: {
    en: "Always send Escape if Alt is pressed",
    zh: "按住 Alt 时始终发送 Escape",
    ja: "Alt が押されている場合は常に Escape を送信",
    fr: "Toujours envoyer Échap si Alt est enfoncé",
  },
  graveEscapeControl: {
    en: "Always send Escape if Control is pressed",
    zh: "按住 Control 时始终发送 Escape",
    ja: "Control が押されている場合は常に Escape を送信",
    fr: "Toujours envoyer Échap si Ctrl est enfoncé",
  },
  graveEscapeGui: {
    en: "Always send Escape if GUI is pressed",
    zh: "按住 GUI 时始终发送 Escape",
    ja: "GUI が押されている場合は常に Escape を送信",
    fr: "Toujours envoyer Échap si GUI est enfoncé",
  },
  graveEscapeShift: {
    en: "Always send Escape if Shift is pressed",
    zh: "按住 Shift 时始终发送 Escape",
    ja: "Shift が押されている場合は常に Escape を送信",
    fr: "Toujours envoyer Échap si Maj est enfoncé",
  },
  tapHoldSettingsTitle: {
    en: "Tap-Hold",
    zh: "轻触与长按 (Tap-Hold)",
    ja: "タップ&ホールド (Tap-Hold)",
    fr: "Appui-maintien (Tap-Hold)",
  },
  tapHoldTappingTerm: {
    en: "Tapping Term",
    zh: "轻触判定时长 (Tapping Term)",
    ja: "タップ判定時間 (Tapping Term)",
    fr: "Délai de frappe (Tapping Term)",
  },
  tapHoldPermissiveHold: {
    en: "Permissive Hold",
    zh: "宽松长按 (Permissive Hold)",
    ja: "パーミッシブホールド (Permissive Hold)",
    fr: "Maintien permissif (Permissive Hold)",
  },
  tapHoldIgnoreModTapInterrupt: {
    en: "Ignore Mod Tap Interrupt",
    zh: "忽略 Mod-Tap 打断",
    ja: "Mod-Tap の割り込みを無視",
    fr: "Ignorer l'interruption Mod-Tap",
  },
  tapHoldTappingForceHold: {
    en: "Tapping Force Hold",
    zh: "强制长按 (Tapping Force Hold)",
    ja: "強制ホールド (Tapping Force Hold)",
    fr: "Forcer le maintien (Tapping Force Hold)",
  },
  tapHoldRetroTapping: {
    en: "Retro Tapping",
    zh: "回溯轻触 (Retro Tapping)",
    ja: "レトロタッピング (Retro Tapping)",
    fr: "Frappe rétroactive (Retro Tapping)",
  },
  tapHoldHoldOnOtherKeyPress: {
    en: "Hold On Other Key Press",
    zh: "按下其他键时判定为长按",
    ja: "他のキー押下時にホールドと判定",
    fr: "Maintien si une autre touche est pressée",
  },
  tapHoldQuickTapTerm: {
    en: "Quick Tap Term",
    zh: "连续轻触判定时长 (Quick Tap Term)",
    ja: "クイックタップ判定時間 (Quick Tap Term)",
    fr: "Délai de frappe rapide (Quick Tap Term)",
  },
  tapHoldTapCodeDelay: {
    en: "Tap Code Delay",
    zh: "按键延迟 (Tap Code Delay)",
    ja: "タップコード遅延 (Tap Code Delay)",
    fr: "Délai du code de frappe (Tap Code Delay)",
  },
  tapHoldTapHoldCapsDelay: {
    en: "Tap Hold Caps Delay",
    zh: "Caps Lock 长按延迟",
    ja: "Caps Lock ホールド遅延",
    fr: "Délai de maintien pour Verr. Maj.",
  },
  tapHoldTappingToggle: {
    en: "Tapping Toggle",
    zh: "连按切换次数 (Tapping Toggle)",
    ja: "タップトグル回数 (Tapping Toggle)",
    fr: "Nombre de frappes pour basculer (Tapping Toggle)",
  },
  tapHoldChordalHold: {
    en: "Chordal Hold",
    zh: "同手长按判定 (Chordal Hold)",
    ja: "コーダルホールド (Chordal Hold)",
    fr: "Maintien accordé (Chordal Hold)",
  },
  tapHoldFlowTap: {
    en: "Flow Tap",
    zh: "连续输入时快速轻触 (Flow Tap)",
    ja: "フロータップ (Flow Tap)",
    fr: "Frappe fluide (Flow Tap)",
  },
  comboSettingsTitle: { en: "Combo", zh: "组合键 (Combo)", ja: "コンボ (Combo)", fr: "Combo" },
  comboTermMs: {
    en: "Time out period for combos",
    zh: "组合键超时时间",
    ja: "コンボのタイムアウト時間",
    fr: "Délai d'expiration des combos",
  },
  oneShotSettingsTitle: {
    en: "One Shot Keys",
    zh: "单次触发键 (One Shot Keys)",
    ja: "ワンショットキー (One Shot Keys)",
    fr: "Touches à usage unique (One Shot Keys)",
  },
  oneShotTapToggle: {
    en: "Tapping this number of times holds the key until tapped once again",
    zh: "连续轻触该次数后锁定按键,再次轻触解除",
    ja: "この回数だけタップすると、再度タップするまでキーがロックされます",
    fr: "Taper ce nombre de fois verrouille la touche jusqu'à une nouvelle frappe",
  },
  oneShotTimeoutMs: {
    en: "Time (in ms) before the one shot key is released",
    zh: "单次触发键自动释放时间(毫秒)",
    ja: "ワンショットキーが自動解除されるまでの時間(ミリ秒)",
    fr: "Délai (en ms) avant le relâchement automatique de la touche à usage unique",
  },
  mouseKeySettingsTitle: {
    en: "Mouse Keys",
    zh: "鼠标按键 (Mouse Keys)",
    ja: "マウスキー (Mouse Keys)",
    fr: "Touches souris (Mouse Keys)",
  },
  mouseKeyDelay: {
    en: "Delay between pressing a movement key and cursor movement",
    zh: "按下移动键到光标开始移动的延迟",
    ja: "移動キーを押してからカーソルが動き出すまでの遅延",
    fr: "Délai entre l'appui sur une touche de déplacement et le mouvement du curseur",
  },
  mouseKeyInterval: {
    en: "Time between cursor movements in milliseconds",
    zh: "光标每次移动的间隔时间(毫秒)",
    ja: "カーソル移動の間隔時間(ミリ秒)",
    fr: "Intervalle entre les mouvements du curseur (en ms)",
  },
  mouseKeyStepSize: { en: "Step size", zh: "移动步长", ja: "移動幅", fr: "Pas de déplacement" },
  mouseKeyMaxSpeed: {
    en: "Maximum cursor speed at which acceleration stops",
    zh: "光标加速停止时的最大速度",
    ja: "加速が止まる最大カーソル速度",
    fr: "Vitesse maximale du curseur à laquelle l'accélération s'arrête",
  },
  mouseKeyTimeToMax: {
    en: "Time until maximum cursor speed is reached",
    zh: "达到最大光标速度所需时间",
    ja: "最大カーソル速度に達するまでの時間",
    fr: "Temps pour atteindre la vitesse maximale du curseur",
  },
  mouseKeyWheelDelay: {
    en: "Delay between pressing a wheel key and wheel movement",
    zh: "按下滚轮键到滚轮开始滚动的延迟",
    ja: "ホイールキーを押してからホイールが動き出すまでの遅延",
    fr: "Délai entre l'appui sur une touche de molette et le mouvement de la molette",
  },
  mouseKeyWheelInterval: {
    en: "Time between wheel movements",
    zh: "滚轮每次滚动的间隔时间",
    ja: "ホイール移動の間隔時間",
    fr: "Intervalle entre les mouvements de la molette",
  },
  mouseKeyWheelMaxSpeed: {
    en: "Maximum number of scroll steps per scroll action",
    zh: "每次滚动的最大步数",
    ja: "1 回のスクロール動作あたりの最大スクロールステップ数",
    fr: "Nombre maximal de pas de défilement par action",
  },
  mouseKeyWheelTimeToMax: {
    en: "Time until maximum scroll speed is reached",
    zh: "达到最大滚动速度所需时间",
    ja: "最大スクロール速度に達するまでの時間",
    fr: "Temps pour atteindre la vitesse de défilement maximale",
  },
  // Help tooltips, sourced from the official QMK documentation linked by
  // https://get.vial.today/manual/qmk-settings.html
  magicSwapCapsLockControlHelp: {
    en: "Exchanges the Caps Lock and Left Control keys.",
    zh: "交换 Caps Lock 与左 Control 两个键的功能。",
    ja: "Caps Lock キーと左 Control キーの機能を入れ替えます。",
    fr: "Échange les fonctions des touches Verr. Maj. et Ctrl gauche.",
  },
  magicCapsLockAsControlHelp: {
    en: "Makes the Caps Lock key act as an additional Control key.",
    zh: "让 Caps Lock 键作为额外的 Control 键使用。",
    ja: "Caps Lock キーを追加の Control キーとして機能させます。",
    fr: "Fait fonctionner la touche Verr. Maj. comme une touche Ctrl supplémentaire.",
  },
  magicSwapLaltLguiHelp: {
    en: "Exchanges the left Alt and left GUI (Win/Cmd) keys.",
    zh: "交换左 Alt 与左 GUI(Win/Cmd)键。",
    ja: "左 Alt キーと左 GUI(Win/Cmd)キーを入れ替えます。",
    fr: "Échange les touches Alt gauche et GUI gauche (Win/Cmd).",
  },
  magicSwapRaltRguiHelp: {
    en: "Exchanges the right Alt and right GUI (Win/Cmd) keys.",
    zh: "交换右 Alt 与右 GUI(Win/Cmd)键。",
    ja: "右 Alt キーと右 GUI(Win/Cmd)キーを入れ替えます。",
    fr: "Échange les touches Alt droit et GUI droit (Win/Cmd).",
  },
  magicDisableGuiHelp: {
    en: "Disables all GUI (Win/Cmd) keys — handy to avoid accidental presses while gaming.",
    zh: "禁用所有 GUI(Win/Cmd)键,常用于游戏时防止误触。",
    ja: "すべての GUI(Win/Cmd)キーを無効化します——ゲーム中の誤操作防止に便利です。",
    fr: "Désactive toutes les touches GUI (Win/Cmd) — pratique pour éviter les appuis accidentels en jeu.",
  },
  magicSwapGraveEscHelp: {
    en: "Exchanges the ` (grave) and Escape keys.",
    zh: "交换 `(反引号)与 Escape 键。",
    ja: "`(バッククォート)キーと Escape キーを入れ替えます。",
    fr: "Échange les touches ` (accent grave) et Échap.",
  },
  magicSwapBackslashBackspaceHelp: {
    en: "Exchanges the \\ (backslash) and Backspace keys.",
    zh: "交换 \\(反斜杠)与 Backspace 键。",
    ja: "\\(バックスラッシュ)キーと Backspace キーを入れ替えます。",
    fr: "Échange les touches \\ (barre oblique inverse) et Retour arrière.",
  },
  magicNkroHelp: {
    en: "Enables N-key rollover, so every pressed key registers at once without ghosting.",
    zh: "启用 N 键无冲(NKRO),可同时识别所有按下的按键,避免冲突丢键。",
    ja: "Nキーロールオーバー(NKRO)を有効化し、押したキーがゴースティングなくすべて認識されるようにします。",
    fr: "Active l'anti-ghosting (NKRO) : toutes les touches enfoncées sont détectées simultanément, sans perte.",
  },
  magicSwapLctlLguiHelp: {
    en: "Exchanges the left Control and left GUI (Win/Cmd) keys.",
    zh: "交换左 Control 与左 GUI(Win/Cmd)键。",
    ja: "左 Control キーと左 GUI(Win/Cmd)キーを入れ替えます。",
    fr: "Échange les touches Ctrl gauche et GUI gauche (Win/Cmd).",
  },
  magicSwapRctlRguiHelp: {
    en: "Exchanges the right Control and right GUI (Win/Cmd) keys.",
    zh: "交换右 Control 与右 GUI(Win/Cmd)键。",
    ja: "右 Control キーと右 GUI(Win/Cmd)キーを入れ替えます。",
    fr: "Échange les touches Ctrl droit et GUI droit (Win/Cmd).",
  },
  graveEscapeAltHelp: {
    en: "When this Grave Escape key is pressed while Alt is held, always send Escape instead of `.",
    zh: "按住 Alt 时按下反引号转义键,始终发送 Escape 而不是 `。",
    ja: "Alt を押しながらこの Grave Escape キーを押すと、常に ` の代わりに Escape を送信します。",
    fr: "Lorsque cette touche Grave Escape est pressée pendant que Alt est maintenu, envoie toujours Échap au lieu de `.",
  },
  graveEscapeControlHelp: {
    en: "When this Grave Escape key is pressed while Control is held, always send Escape instead of `.",
    zh: "按住 Control 时按下反引号转义键,始终发送 Escape 而不是 `。",
    ja: "Control を押しながらこの Grave Escape キーを押すと、常に ` の代わりに Escape を送信します。",
    fr: "Lorsque cette touche Grave Escape est pressée pendant que Ctrl est maintenu, envoie toujours Échap au lieu de `.",
  },
  graveEscapeGuiHelp: {
    en: "When this Grave Escape key is pressed while GUI (Win/Cmd) is held, always send Escape instead of `.",
    zh: "按住 GUI(Win/Cmd)时按下反引号转义键,始终发送 Escape 而不是 `。",
    ja: "GUI(Win/Cmd)を押しながらこの Grave Escape キーを押すと、常に ` の代わりに Escape を送信します。",
    fr: "Lorsque cette touche Grave Escape est pressée pendant que GUI (Win/Cmd) est maintenu, envoie toujours Échap au lieu de `.",
  },
  graveEscapeShiftHelp: {
    en: "When this Grave Escape key is pressed while Shift is held, always send Escape instead of ~.",
    zh: "按住 Shift 时按下反引号转义键,始终发送 Escape 而不是 ~。",
    ja: "Shift を押しながらこの Grave Escape キーを押すと、常に ~ の代わりに Escape を送信します。",
    fr: "Lorsque cette touche Grave Escape est pressée pendant que Maj est maintenu, envoie toujours Échap au lieu de ~.",
  },
  tapHoldTappingTermHelp: {
    en: "How long (ms) a dual-role key must be held before it counts as a hold rather than a tap. QMK default is 200 ms.",
    zh: "双功能键需按住多久(毫秒)才判定为长按而非轻触。QMK 默认 200 毫秒。",
    ja: "デュアルロールキーをどれだけの時間(ミリ秒)押し続けるとタップではなくホールドと判定されるか。QMK のデフォルトは 200 ミリ秒です。",
    fr: "Durée (en ms) pendant laquelle une touche à double rôle doit être maintenue pour être considérée comme un maintien plutôt qu'une frappe. La valeur par défaut de QMK est 200 ms.",
  },
  tapHoldPermissiveHoldHelp: {
    en: "If another key is tapped (fully pressed and released) while a dual-role key is held, trigger its hold action immediately even before the tapping term elapses. Helps fast typists.",
    zh: "在按住双功能键期间,若完整地轻触了另一个键,即使还没到判定时长也立即触发长按动作。适合打字较快的用户。",
    ja: "デュアルロールキーを押している間に別のキーがタップ(完全に押して離す)されると、タップ判定時間が経過する前でも即座にホールド動作を発動します。タイピングの速いユーザーに有効です。",
    fr: "Si une autre touche est frappée (pressée puis relâchée) pendant qu'une touche à double rôle est maintenue, déclenche immédiatement son action de maintien, même avant la fin du délai de frappe. Utile pour les dactylographes rapides.",
  },
  tapHoldIgnoreModTapInterruptHelp: {
    en: "For mod-tap keys, don't treat another key being pressed as a hold — wait out the tapping term instead, so quick key rolls stay taps.",
    zh: "对 Mod-Tap 键,不因按下其他键就判定为长按,而是等待判定时长结束,使快速连击仍视为轻触。",
    ja: "Mod-Tap キーにおいて、他のキーが押されてもホールドとは判定せず、タップ判定時間が経過するまで待つことで、素早いキーの連続入力もタップとして扱われるようにします。",
    fr: "Pour les touches Mod-Tap, ne considère pas l'appui d'une autre touche comme un maintien — attend plutôt la fin du délai de frappe, afin que les enchaînements rapides restent des frappes.",
  },
  tapHoldTappingForceHoldHelp: {
    en: "After tapping a dual-role key and then quickly holding it again, perform the hold action instead of repeating the tap.",
    zh: "轻触双功能键后立刻再次按住时,执行长按动作而不是重复轻触。",
    ja: "デュアルロールキーをタップした直後にすぐ再び押し続けた場合、タップを繰り返すのではなくホールド動作を実行します。",
    fr: "Après avoir tapé une touche à double rôle puis l'avoir de nouveau maintenue rapidement, exécute l'action de maintien au lieu de répéter la frappe.",
  },
  tapHoldRetroTappingHelp: {
    en: "If a dual-role key is held past the tapping term but no other key was pressed, still send the tap keycode when released.",
    zh: "若双功能键按住超过判定时长,但期间没有按下其他键,松开时仍发送轻触键码。",
    ja: "デュアルロールキーがタップ判定時間を超えて押されても、その間に他のキーが押されなければ、離したときにタップのキーコードを送信します。",
    fr: "Si une touche à double rôle est maintenue au-delà du délai de frappe mais qu'aucune autre touche n'a été pressée, envoie tout de même le code de frappe au relâchement.",
  },
  tapHoldHoldOnOtherKeyPressHelp: {
    en: "Trigger the hold action as soon as any other key is pressed while the dual-role key is held (fires earlier than Permissive Hold).",
    zh: "在按住双功能键期间,只要按下其他任意键就立即触发长按动作(比宽松长按更早)。",
    ja: "デュアルロールキーを押している間に他のキーが押された瞬間にホールド動作を発動します(Permissive Hold より早く発火します)。",
    fr: "Déclenche l'action de maintien dès qu'une autre touche est pressée pendant que la touche à double rôle est maintenue (se déclenche plus tôt que Permissive Hold).",
  },
  tapHoldQuickTapTermHelp: {
    en: "Within this time (ms) after a tap, holding the key again repeats the tap; hold longer to get the hold action. Set to 0 to disable tap repeat.",
    zh: "轻触后在此时间(毫秒)内再次按住会重复轻触;超过则触发长按。设为 0 可禁用连续轻触重复。",
    ja: "タップ後この時間(ミリ秒)以内に再度キーを押し続けるとタップが繰り返されます。それより長く押すとホールド動作になります。0 に設定するとタップの繰り返しを無効化します。",
    fr: "Dans ce délai (en ms) après une frappe, maintenir de nouveau la touche répète la frappe ; la maintenir plus longtemps déclenche l'action de maintien. Réglez sur 0 pour désactiver la répétition de frappe.",
  },
  tapHoldTapCodeDelayHelp: {
    en: "Delay (ms) between press and release when a key sends a tap code, for hosts that miss very fast keypresses.",
    zh: "发送 tap code 时按下与松开之间的延迟(毫秒),用于兼容会漏掉过快按键的主机。",
    ja: "キーがタップコードを送信する際の押下と解放の間の遅延(ミリ秒)。非常に速いキー入力を認識できないホスト向けです。",
    fr: "Délai (en ms) entre l'appui et le relâchement lorsqu'une touche envoie un code de frappe, pour les hôtes qui ratent les frappes très rapides.",
  },
  tapHoldTapHoldCapsDelayHelp: {
    en: "Extra delay (ms) used specifically for the Caps Lock key, which some operating systems need in order to register it reliably.",
    zh: "专门用于 Caps Lock 键的额外延迟(毫秒),部分操作系统需要更长延迟才能可靠识别。",
    ja: "Caps Lock キー専用の追加遅延(ミリ秒)。一部の OS では確実に認識させるためにより長い遅延が必要です。",
    fr: "Délai supplémentaire (en ms) spécifique à la touche Verr. Maj., nécessaire sur certains systèmes d'exploitation pour une détection fiable.",
  },
  tapHoldTappingToggleHelp: {
    en: "Number of taps required to toggle a layer or key on for tap-toggle keys (e.g. TT).",
    zh: "连按切换类按键(如 TT)需要连续轻触的次数即可锁定开启。",
    ja: "TT などのタップトグルキーでレイヤーやキーをオンに切り替えるために必要なタップ回数。",
    fr: "Nombre de frappes nécessaires pour activer un calque ou une touche pour les touches tap-toggle (ex. TT).",
  },
  tapHoldChordalHoldHelp: {
    en: "Applies an opposite-hands rule: same-hand combinations settle as taps, while opposite-hand combinations may settle as holds.",
    zh: "采用左右手规则:同一只手的组合判定为轻触,不同手的组合才可能判定为长按。",
    ja: "左右の手のルールを適用します:同じ手の組み合わせはタップと判定され、異なる手の組み合わせはホールドと判定される場合があります。",
    fr: "Applique une règle de mains opposées : les combinaisons de la même main sont traitées comme des frappes, celles de mains opposées peuvent être traitées comme des maintiens.",
  },
  tapHoldFlowTapHelp: {
    en: "Temporarily disables hold behaviour during fast continuous typing, so keys pressed in quick succession count as taps.",
    zh: "在快速连续打字时暂时禁用长按判定,使紧密相连的按键都视为轻触。",
    ja: "高速で連続してタイピングしている間は一時的にホールド動作を無効化し、素早く連続して押されたキーがタップとして扱われるようにします。",
    fr: "Désactive temporairement le comportement de maintien pendant une frappe rapide et continue, afin que les touches pressées en succession rapide comptent comme des frappes.",
  },
  comboTermMsHelp: {
    en: "The time window (ms) within which all of a combo's keys must be pressed to trigger it. QMK default is 50 ms.",
    zh: "组合键的所有按键必须在此时间窗口(毫秒)内全部按下才会触发。QMK 默认 50 毫秒。",
    ja: "コンボを発動させるために、すべてのキーを押す必要がある時間の幅(ミリ秒)。QMK のデフォルトは 50 ミリ秒です。",
    fr: "Fenêtre de temps (en ms) pendant laquelle toutes les touches d'un combo doivent être pressées pour le déclencher. La valeur par défaut de QMK est 50 ms.",
  },
  oneShotTapToggleHelp: {
    en: "Tapping a one-shot key this many times in a row locks it on until you tap it once more.",
    zh: "连续轻触单次触发键达到此次数会将其锁定,直到再次轻触解除。",
    ja: "ワンショットキーをこの回数連続してタップすると、もう一度タップするまでオンにロックされます。",
    fr: "Taper une touche à usage unique ce nombre de fois d'affilée la verrouille active jusqu'à une nouvelle frappe.",
  },
  oneShotTimeoutMsHelp: {
    en: "How long (ms) a one-shot key stays active waiting for the next key before it is released automatically.",
    zh: "单次触发键在等待下一个按键时保持激活的时长(毫秒),超时后自动释放。",
    ja: "ワンショットキーが次のキー入力を待つ間、有効な状態を保つ時間(ミリ秒)。この時間を過ぎると自動的に解除されます。",
    fr: "Durée (en ms) pendant laquelle une touche à usage unique reste active en attendant la touche suivante avant d'être relâchée automatiquement.",
  },
  mouseKeyDelayHelp: {
    en: "Delay (ms) between pressing a movement key and the cursor starting to move.",
    zh: "按下移动键到光标开始移动之间的延迟(毫秒)。",
    ja: "移動キーを押してからカーソルが動き始めるまでの遅延(ミリ秒)。",
    fr: "Délai (en ms) entre l'appui sur une touche de déplacement et le début du mouvement du curseur.",
  },
  mouseKeyIntervalHelp: {
    en: "Time (ms) between each cursor movement update — smaller values move the cursor more smoothly.",
    zh: "光标每次移动更新之间的间隔时间(毫秒),数值越小移动越平滑。",
    ja: "カーソル移動が更新される間隔(ミリ秒)——値が小さいほど滑らかに移動します。",
    fr: "Temps (en ms) entre chaque mise à jour du mouvement du curseur — des valeurs plus petites rendent le déplacement plus fluide.",
  },
  mouseKeyStepSizeHelp: {
    en: "How many pixels the cursor moves on each update (step size).",
    zh: "光标每次更新移动的像素数(移动步长)。",
    ja: "1 回の更新でカーソルが移動するピクセル数(移動幅)。",
    fr: "Nombre de pixels parcourus par le curseur à chaque mise à jour (pas de déplacement).",
  },
  mouseKeyMaxSpeedHelp: {
    en: "The maximum cursor speed at which acceleration stops.",
    zh: "光标加速停止时可达到的最大速度。",
    ja: "加速が停止する最大カーソル速度。",
    fr: "Vitesse maximale du curseur à laquelle l'accélération s'arrête.",
  },
  mouseKeyTimeToMaxHelp: {
    en: "Time (ms) taken to accelerate from start up to the maximum cursor speed.",
    zh: "从开始移动加速到最大光标速度所需的时间(毫秒)。",
    ja: "開始から最大カーソル速度まで加速するのにかかる時間(ミリ秒)。",
    fr: "Temps (en ms) pour accélérer du démarrage jusqu'à la vitesse maximale du curseur.",
  },
  mouseKeyWheelDelayHelp: {
    en: "Delay (ms) between pressing a wheel key and the wheel starting to scroll.",
    zh: "按下滚轮键到滚轮开始滚动之间的延迟(毫秒)。",
    ja: "ホイールキーを押してからホイールがスクロールし始めるまでの遅延(ミリ秒)。",
    fr: "Délai (en ms) entre l'appui sur une touche de molette et le début du défilement.",
  },
  mouseKeyWheelIntervalHelp: {
    en: "Time (ms) between each scroll wheel movement.",
    zh: "滚轮每次滚动之间的间隔时间(毫秒)。",
    ja: "ホイールのスクロール動作ごとの間隔時間(ミリ秒)。",
    fr: "Temps (en ms) entre chaque mouvement de la molette.",
  },
  mouseKeyWheelMaxSpeedHelp: {
    en: "The maximum number of scroll steps per scroll action.",
    zh: "每次滚动动作的最大滚动步数。",
    ja: "1 回のスクロール動作あたりの最大スクロールステップ数。",
    fr: "Nombre maximal de pas de défilement par action de défilement.",
  },
  mouseKeyWheelTimeToMaxHelp: {
    en: "Time (ms) taken to accelerate up to the maximum scroll speed.",
    zh: "加速到最大滚动速度所需的时间(毫秒)。",
    ja: "最大スクロール速度まで加速するのにかかる時間(ミリ秒)。",
    fr: "Temps (en ms) pour accélérer jusqu'à la vitesse de défilement maximale.",
  },
  unitMs: { en: "ms", zh: "毫秒", ja: "ミリ秒", fr: "ms" },
  unitPx: { en: "px", zh: "像素", ja: "ピクセル", fr: "px" },
  unitSteps: { en: "steps", zh: "步", ja: "ステップ", fr: "pas" },
  unitTaps: { en: "taps", zh: "次", ja: "回", fr: "frappes" },
  // Short form for the sidebar button; `resetAllSettings` stays the (descriptive) dialog title.
  resetAllShort: { en: "Reset all", zh: "全部重置", ja: "すべてリセット", fr: "Tout réinitialiser" },
  resetAllSettings: {
    en: "Reset all QMK settings",
    zh: "重置所有QMK设置",
    ja: "すべての QMK 設定をリセット",
    fr: "Réinitialiser tous les réglages QMK",
  },
  resetAllSettingsConfirm: {
    en: "Revert every setting on this page back to when this keyboard connected?",
    zh: "确定要将本页面的所有设置撤销回连接时的状态吗?",
    ja: "このページのすべての設定を、キーボード接続時の状態に戻しますか?",
    fr: "Rétablir tous les réglages de cette page à l'état de la connexion du clavier ?",
  },
  qmkConfirmChanges: { en: "Confirm changes", zh: "确认修改", ja: "変更を確認", fr: "Confirmer les modifications" },
  qmkConfirmModalTitle: {
    en: "Apply changes to keyboard?",
    zh: "确认写入键盘?",
    ja: "キーボードに変更を適用しますか?",
    fr: "Appliquer les modifications au clavier ?",
  },
  qmkConfirmModalHint: {
    en: "The following settings will be written to the keyboard:",
    zh: "以下设置将被写入键盘:",
    ja: "以下の設定がキーボードに書き込まれます:",
    fr: "Les réglages suivants seront écrits sur le clavier :",
  },
  qmkConfirmApply: { en: "Confirm & write", zh: "确认写入", ja: "確認して書き込む", fr: "Confirmer et écrire" },
  qmkValueOn: { en: "On", zh: "开", ja: "オン", fr: "Activé" },
  qmkValueOff: { en: "Off", zh: "关", ja: "オフ", fr: "Désactivé" },
  qmkLeaveTitle: {
    en: "Leave with unsaved changes?",
    zh: "有未保存的修改,确定离开吗?",
    ja: "未保存の変更がありますが、移動しますか?",
    fr: "Quitter avec des modifications non enregistrées ?",
  },
  qmkLeaveHint: {
    en: "Some QMK settings haven't been written to the keyboard yet.",
    zh: "部分 QMK 设置还没有写入键盘。",
    ja: "一部の QMK 設定がまだキーボードに書き込まれていません。",
    fr: "Certains réglages QMK n'ont pas encore été écrits sur le clavier.",
  },
  qmkLeaveSave: { en: "Save & leave", zh: "保存并离开", ja: "保存して移動", fr: "Enregistrer et quitter" },
  qmkLeaveDiscard: { en: "Discard & leave", zh: "放弃修改并离开", ja: "破棄して移動", fr: "Ignorer et quitter" },
  languageTitle: { en: "Language", zh: "语言", ja: "言語", fr: "Langue" },
  themeTitle: { en: "Appearance", zh: "外观", ja: "外観", fr: "Apparence" },
  themeLight: { en: "Light", zh: "浅色", ja: "ライト", fr: "Clair" },
  themeDark: { en: "Dark", zh: "深色", ja: "ダーク", fr: "Sombre" },
  siteAboutIntro: {
    en: "A native web configurator for Vial-protocol keyboards — talking to the keyboard directly over WebHID, with no Qt, no WebAssembly, and no driver install.",
    zh: "面向 Vial 协议键盘的原生网页配置器 —— 通过 WebHID 直接与键盘通信,无需 Qt、无需 WebAssembly、无需安装驱动。",
    ja: "Vial プロトコル対応キーボード向けのネイティブなウェブコンフィギュレーターです——WebHID を通じてキーボードと直接通信し、Qt も WebAssembly もドライバーのインストールも不要です。",
    fr: "Un configurateur web natif pour les claviers au protocole Vial — communiquant directement avec le clavier via WebHID, sans Qt, sans WebAssembly et sans pilote à installer.",
  },
  siteAboutGithub: { en: "GitHub", zh: "GitHub 项目", ja: "GitHub", fr: "GitHub" },
  siteAboutDiscord: { en: "Discord", zh: "Discord 社区", ja: "Discord", fr: "Discord" },
  siteThanksDesc: {
    en: "Thanks to everyone who takes part in this project — it is better because of you.",
    zh: "感谢每一位参与项目的朋友,正是因为你们,项目才变得更好。",
    ja: "このプロジェクトに参加してくださったすべての方々に感謝します——皆さんのおかげでより良いものになっています。",
    fr: "Merci à toutes les personnes qui participent à ce projet — il est meilleur grâce à vous.",
  },
  siteGeneralTitle: { en: "General", zh: "通用", ja: "一般", fr: "Général" },
  siteDiagnosticsTitle: { en: "Diagnostics", zh: "诊断", ja: "診断", fr: "Diagnostics" },
  debugLogTitle: { en: "Debug logging", zh: "调试日志", ja: "デバッグログ", fr: "Journalisation de débogage" },
  debugLogDesc: {
    en: "Print detailed connection logs to the browser console",
    zh: "在浏览器控制台输出详细的连接日志",
    ja: "詳細な接続ログをブラウザのコンソールに出力します",
    fr: "Affiche des journaux de connexion détaillés dans la console du navigateur",
  },
  debugLogHint: {
    en: "Leave this off unless you're troubleshooting. When reporting a connection problem, switch it on, retry, then open the browser console (F12) and share what it prints.",
    zh: "除非在排查问题,否则请保持关闭。反馈连接故障时,请先打开此开关并重试,然后按 F12 打开浏览器控制台,把输出的内容一并提供。",
    ja: "トラブルシューティング時以外はオフのままにしてください。接続の問題を報告する際は、これをオンにして再試行し、ブラウザのコンソール(F12)を開いて出力内容を共有してください。",
    fr: "Laissez ceci désactivé sauf en cas de dépannage. Pour signaler un problème de connexion, activez-le, réessayez, puis ouvrez la console du navigateur (F12) et partagez ce qui s'affiche.",
  },
  siteDangerTitle: { en: "Danger Zone", zh: "危险操作", ja: "危険な操作", fr: "Zone de danger" },
  clearCacheTitle: { en: "Clear site cache", zh: "清空网站缓存", ja: "サイトキャッシュを削除", fr: "Vider le cache du site" },
  clearCacheDesc: {
    en: "Reset all locally stored preferences",
    zh: "重置本地存储的所有偏好设置",
    ja: "ローカルに保存されたすべての設定をリセットします",
    fr: "Réinitialise toutes les préférences stockées localement",
  },
  clearCacheButton: { en: "Clear cache", zh: "清空缓存", ja: "キャッシュを削除", fr: "Vider le cache" },
  clearCacheConfirmTitle: {
    en: "Clear site cache?",
    zh: "确定清空网站缓存?",
    ja: "サイトキャッシュを削除しますか?",
    fr: "Vider le cache du site ?",
  },
  clearCacheConfirmHint: {
    en: "This will erase your saved keyboard style settings (colors, keycap appearance, layout preferences). This cannot be undone.",
    zh: "此操作会清除已保存的键盘样式信息(配色、键帽外观、布局偏好等),且无法撤销。",
    ja: "保存されたキーボードのスタイル設定(配色、キーキャップの外観、レイアウトの好み)が消去されます。この操作は取り消せません。",
    fr: "Ceci effacera vos réglages de style de clavier enregistrés (couleurs, apparence des touches, préférences de disposition). Cette action est irréversible.",
  },
  clearCacheConfirm: { en: "Clear cache", zh: "确认清空", ja: "キャッシュを削除", fr: "Vider le cache" },
  languageDesc: { en: "Interface language", zh: "界面语言", ja: "インターフェースの言語", fr: "Langue de l'interface" },
  themeDesc: { en: "Light or dark theme", zh: "浅色或深色主题", ja: "ライトテーマまたはダークテーマ", fr: "Thème clair ou sombre" },
  keyDisplayTitle: { en: "Modifier key style", zh: "修饰键类型", ja: "修飾キーの表示スタイル", fr: "Style des touches de modification" },
  keyDisplayDesc: {
    en: "How OS-specific modifier keys are labelled",
    zh: "系统相关修饰键的显示方式",
    ja: "OS 固有の修飾キーの表示方法",
    fr: "Comment les touches de modification spécifiques à l'OS sont libellées",
  },
  keyDisplayMacos: { en: "macOS", zh: "macOS", ja: "macOS", fr: "macOS" },
  keyDisplayWindows: { en: "Windows", zh: "Windows", ja: "Windows", fr: "Windows" },
  siteColorDesc: {
    en: "The layout read from the connected keyboard",
    zh: "从已连接键盘读取到的配列",
    ja: "接続されたキーボードから読み取ったレイアウト",
    fr: "La disposition lue depuis le clavier connecté",
  },
  colorDisplayNote: {
    en: "Color settings only affect the on-screen preview and are not written to the keyboard.",
    zh: "颜色配置仅调整显示效果，不会存入键盘。",
    ja: "カラー設定は画面上のプレビューにのみ影響し、キーボードには書き込まれません。",
    fr: "Les réglages de couleur n'affectent que l'aperçu à l'écran et ne sont pas écrits sur le clavier.",
  },
  colorSaveCurrentLayer: { en: "Save current layer", zh: "保存当前层图片", ja: "現在のレイヤーを保存", fr: "Enregistrer le calque actuel" },
  colorSaveAllLayers: { en: "Save all layers", zh: "保存所有层图片", ja: "すべてのレイヤーを保存", fr: "Enregistrer tous les calques" },
  colorSaving: { en: "Saving…", zh: "保存中…", ja: "保存中…", fr: "Enregistrement…" },
  exportCurrentLayerImage: {
    en: "Export current layer",
    zh: "导出当前层图片",
    ja: "現在のレイヤーを書き出し",
    fr: "Exporter le calque actuel",
  },
  exportAllLayersImage: {
    en: "Export all layers",
    zh: "导出所有层图片",
    ja: "すべてのレイヤーを書き出し",
    fr: "Exporter tous les calques",
  },
  personalizationSettings: {
    en: "Personalization settings",
    zh: "个性化配置",
    ja: "パーソナライズ設定",
    fr: "Réglages de personnalisation",
  },
  colorKeyConfig: {
    en: "Key configuration",
    zh: "键盘按键配置",
    ja: "キー設定",
    fr: "Configuration des touches",
  },
  colorEditKeymap: { en: "Configure key layout", zh: "配置按键布局", ja: "キーレイアウトを設定", fr: "Configurer la disposition des touches" },
  colorLayoutTitle: { en: "Layout options", zh: "布局选项", ja: "レイアウトオプション", fr: "Options de disposition" },
  fullscreenPreviewTitle: { en: "Fullscreen preview", zh: "全屏预览", ja: "全画面プレビュー", fr: "Aperçu plein écran" },
  fullscreenPreviewDesc: {
    en: "Open a fullscreen configuration page with an enlarged keyboard preview and all appearance settings.",
    zh: "打开全屏配置页，放大展示键盘预览并集中全部外观设置。",
    ja: "拡大されたキーボードプレビューとすべての外観設定を含む全画面の設定ページを開きます。",
    fr: "Ouvre une page de configuration plein écran avec un aperçu agrandi du clavier et tous les réglages d'apparence.",
  },
  fullscreenPreviewButton: { en: "Enter fullscreen", zh: "进入全屏", ja: "全画面表示にする", fr: "Passer en plein écran" },
  fullscreenPreviewExit: { en: "Exit fullscreen preview", zh: "退出全屏预览", ja: "全画面プレビューを終了", fr: "Quitter l'aperçu plein écran" },
  fullscreenPreviewPullExit: { en: "Keep scrolling to exit", zh: "继续下滑退出", ja: "スクロールを続けると終了します", fr: "Continuez à faire défiler pour quitter" },
  colorAppearanceTitle: { en: "Appearance", zh: "外观", ja: "外観", fr: "Apparence" },
  colorSizeSectionTitle: { en: "Overall", zh: "整体配置", ja: "全体設定", fr: "Ensemble" },
  colorFontSectionTitle: { en: "Keyboard font", zh: "键盘字体", ja: "キーボードフォント", fr: "Police du clavier" },
  colorKeycapSectionTitle: { en: "Keycap", zh: "键帽", ja: "キーキャップ", fr: "Touche (keycap)" },
  colorCaseSectionTitle: { en: "Case & plate", zh: "键盘外壳与定位板", ja: "ケース & プレート", fr: "Boîtier et plaque" },
  previewAutoFitTitle: { en: "Auto-fit preview", zh: "预览区域自适应大小", ja: "プレビューを自動調整", fr: "Ajustement automatique de l'aperçu" },
  previewAutoFitDesc: {
    en: "Scale the keyboard to fit the window; turn off to set the scale yourself.",
    zh: "键盘随窗口宽度自动缩放;关闭后可手动设置缩放比例。",
    ja: "ウィンドウに合わせてキーボードのサイズを自動調整します;オフにすると自分で拡大率を設定できます。",
    fr: "Redimensionne le clavier pour l'ajuster à la fenêtre ; désactivez pour définir vous-même l'échelle.",
  },
  displaySizeTitle: { en: "Preview scale", zh: "预览区域缩放", ja: "プレビューの拡大率", fr: "Échelle de l'aperçu" },
  displaySizeSmaller: { en: "Smaller", zh: "缩小", ja: "縮小", fr: "Réduire" },
  displaySizeLarger: { en: "Larger", zh: "放大", ja: "拡大", fr: "Agrandir" },
  keySpacingTitle: { en: "Keycap spacing", zh: "键帽间距", ja: "キーキャップの間隔", fr: "Espacement des touches" },
  keycapWidthTitle: { en: "Keycap width", zh: "键帽宽度", ja: "キーキャップの幅", fr: "Largeur des touches" },
  keycapRadiusTitle: { en: "Keycap corner radius", zh: "键帽圆角", ja: "キーキャップの角丸", fr: "Rayon des coins des touches" },
  keycapColorTitle: { en: "Keycap coloring", zh: "键帽上色", ja: "キーキャップの配色", fr: "Coloration des touches" },
  keycapColorButton: { en: "Paint", zh: "上色", ja: "色を塗る", fr: "Peindre" },
  keycapColorNone: { en: "None yet", zh: "暂无", ja: "まだありません", fr: "Aucune pour l'instant" },
  keycapColorManagerTitle: { en: "Color management", zh: "颜色管理", ja: "カラー管理", fr: "Gestion des couleurs" },
  keycapColorManagerHint: {
    en: "Pick a color below, then click keycaps on the board above to paint them.",
    zh: "选择颜色后,点击上方键盘的按键即可上色。",
    ja: "下から色を選び、上のキーボードのキーキャップをクリックして色を塗ってください。",
    fr: "Choisissez une couleur ci-dessous, puis cliquez sur les touches du clavier ci-dessus pour les peindre.",
  },
  keycapColorAdd: { en: "Add color", zh: "新增颜色", ja: "色を追加", fr: "Ajouter une couleur" },
  keycapColorEraser: { en: "Eraser", zh: "橡皮擦", ja: "消しゴム", fr: "Gomme" },
  caseRadiusTitle: { en: "Case corner radius", zh: "外壳圆角", ja: "ケースの角丸", fr: "Rayon des coins du boîtier" },
  caseThicknessTitle: { en: "Case thickness", zh: "外壳厚度", ja: "ケースの厚み", fr: "Épaisseur du boîtier" },
  caseColorTitle: { en: "Case color", zh: "外壳颜色", ja: "ケースの色", fr: "Couleur du boîtier" },
  plateColorTitle: { en: "Plate color", zh: "定位板颜色", ja: "プレートの色", fr: "Couleur de la plaque" },
  depthTitle: { en: "3D depth", zh: "立体感", ja: "立体感", fr: "Profondeur 3D" },
  depthDesc: {
    en: "Show highlights and shadows on the keycaps and case",
    zh: "为键帽和外壳显示高光与阴影",
    ja: "キーキャップとケースにハイライトと影を表示します",
    fr: "Affiche des reflets et des ombres sur les touches et le boîtier",
  },
  keycapBorderTitle: { en: "Keycap border", zh: "键帽边框", ja: "キーキャップの枠線", fr: "Bordure des touches" },
  keycapBorderDesc: {
    en: "Draw a thin outline around each keycap",
    zh: "在每个键帽周围绘制细边框",
    ja: "各キーキャップの周りに細い輪郭線を描画します",
    fr: "Dessine un fin contour autour de chaque touche",
  },
  fontSizeTitle: { en: "Font size", zh: "字体大小", ja: "フォントサイズ", fr: "Taille de police" },
  fontColorTitle: { en: "Font color", zh: "字体颜色", ja: "フォントの色", fr: "Couleur de police" },
  fontPositionTitle: { en: "Font position", zh: "字体位置", ja: "フォントの位置", fr: "Position de la police" },
  fontPositionTopLeft: { en: "Top left", zh: "左上角", ja: "左上", fr: "En haut à gauche" },
  fontPositionCenter: { en: "Center", zh: "居中", ja: "中央", fr: "Centre" },
  fontPositionCenterBottom: { en: "Center bottom", zh: "居中靠下", ja: "中央下", fr: "Centre bas" },
  mediaResetTitle: {
    en: "Icon key beautify (no wrap)",
    zh: "部分按键使用图标重置且取消换行",
    ja: "アイコン表示による整形(折り返しなし)",
    fr: "Amélioration des icônes de touches (sans retour à la ligne)",
  },
  mediaResetDesc: {
    en: "Show media keys as initials, Home/End/PgUp/PgDown as icons, and mouse/wheel keys with a pointer glyph",
    zh: "将媒体按键显示为缩写,翻页、Home、End 显示为图标,鼠标/滚轮按键显示为图标",
    ja: "メディアキーを頭文字で、Home/End/PgUp/PgDown をアイコンで、マウス/ホイールキーをポインターの記号で表示します",
    fr: "Affiche les touches multimédia sous forme d'initiales, Home/End/PgUp/PgDown sous forme d'icônes, et les touches souris/molette avec un symbole de pointeur",
  },
  exportLayoutDesc: {
    en: "Save the current keymap to a .vil file",
    zh: "将当前配置保存为 .vil 文件",
    ja: "現在のキーマップを .vil ファイルとして保存",
    fr: "Enregistrer la configuration actuelle dans un fichier .vil",
  },
  importLayoutDesc: {
    en: "Load a keymap from a .vil file",
    zh: "从 .vil 文件加载配置",
    ja: ".vil ファイルからキーマップを読み込む",
    fr: "Charger une configuration depuis un fichier .vil",
  },

  // Nav
  navHome: { en: "Keyboard Config", zh: "键盘配置", ja: "キーボード設定", fr: "Configuration du clavier" },
  navMatrixTest: { en: "Keyboard Test", zh: "键盘测试", ja: "キーボードテスト", fr: "Test du clavier" },
  navMacro: { en: "Macros", zh: "宏配置", ja: "マクロ", fr: "Macros" },
  navTapDance: { en: "Tap Dance", zh: "Tap Dance", ja: "Tap Dance", fr: "Tap Dance" },
  navCombo: { en: "Combos", zh: "Combos", ja: "コンボ", fr: "Combos" },
  navRgb: { en: "RGB Lighting", zh: "RGB 配置", ja: "RGB 設定", fr: "Éclairage RGB" },
  navKeyboardColor: { en: "Personalization", zh: "个性化", ja: "パーソナライズ", fr: "Personnalisation" },
  navAdvanced: { en: "QMK Settings", zh: "QMK 设置", ja: "QMK 設定", fr: "Réglages QMK" },
  navPreview3d: { en: "3D Preview", zh: "3D 预览", ja: "3D プレビュー", fr: "Aperçu 3D" },
  preview3dHint: {
    en: "Renders the connected keyboard's layout in 3D from its vial.json geometry. Drag to orbit, scroll to zoom, click a key to select it.",
    zh: "根据设备 vial.json 中的布局几何实时生成 3D 键盘。拖拽旋转视角,滚轮缩放,点击键帽可选中。",
    ja: "接続されたキーボードの vial.json の形状データから 3D でレイアウトを描画します。ドラッグで視点を回転、スクロールでズーム、キーをクリックして選択できます。",
    fr: "Affiche en 3D la disposition du clavier connecté à partir de la géométrie de son vial.json. Faites glisser pour orbiter, défilez pour zoomer, cliquez sur une touche pour la sélectionner.",
  },
  preview3dParams: { en: "Debug parameters", zh: "调试参数", ja: "デバッグパラメーター", fr: "Paramètres de débogage" },
  preview3dParamsHint: {
    en: "Live-tunable constants for this preview. Values persist locally; use Copy as code to paste them back into KeyboardLayout3D.tsx.",
    zh: "本页渲染用的常量，可实时调节。数值保存在本地；调好后用「复制为代码」粘回 KeyboardLayout3D.tsx。",
    ja: "このプレビュー用にリアルタイムで調整できる定数です。値はローカルに保存されます;「コードとしてコピー」を使って KeyboardLayout3D.tsx に貼り戻してください。",
    fr: "Constantes ajustables en direct pour cet aperçu. Les valeurs sont conservées localement ; utilisez « Copier en tant que code » pour les recoller dans KeyboardLayout3D.tsx.",
  },
  preview3dGroupCap: { en: "Keycap", zh: "键帽", ja: "キーキャップ", fr: "Touche" },
  preview3dGroupCase: { en: "Case", zh: "外壳", ja: "ケース", fr: "Boîtier" },
  preview3dGroupLight: { en: "Lighting", zh: "灯光", ja: "ライティング", fr: "Éclairage" },
  preview3dReset: { en: "Reset", zh: "恢复默认", ja: "リセット", fr: "Réinitialiser" },
  preview3dCopy: { en: "Copy as code", zh: "复制为代码", ja: "コードとしてコピー", fr: "Copier en tant que code" },
  preview3dCopied: { en: "Copied", zh: "已复制", ja: "コピーしました", fr: "Copié" },
  navNewHome: { en: "New Home", zh: "新版首页", ja: "新しいホーム", fr: "Nouvel accueil" },
  navExitNewHome: { en: "Exit New Home", zh: "退出新版首页", ja: "新しいホームを終了", fr: "Quitter le nouvel accueil" },
  navBackToNewHome: { en: "Back to New Home", zh: "返回新版首页", ja: "新しいホームに戻る", fr: "Retour au nouvel accueil" },
  navBackToKeymap: { en: "Back to key config", zh: "返回按键配置", ja: "キー設定に戻る", fr: "Retour à la config des touches" },
  navExitSiteConfig: { en: "Exit Website Settings", zh: "退出网站配置", ja: "サイト設定を終了", fr: "Quitter les réglages du site" },
  navSiteInfo: { en: "About", zh: "网站信息", ja: "このサイトについて", fr: "À propos" },
  comingSoon: { en: "Coming soon", zh: "即将推出", ja: "近日公開", fr: "Bientôt disponible" },

  // Shared
  save: { en: "Save", zh: "保存", ja: "保存", fr: "Enregistrer" },
  revert: { en: "Revert", zh: "撤销更改", ja: "元に戻す", fr: "Annuler" },
  edit: { en: "Edit", zh: "编辑", ja: "編集", fr: "Modifier" },
  delete: { en: "Delete", zh: "删除", ja: "削除", fr: "Supprimer" },
  done: { en: "Done", zh: "完成", ja: "完了", fr: "Terminé" },

  // MacroPanel
  macroNone: {
    en: "This keyboard doesn't support macros.",
    zh: "这把键盘不支持宏。",
    ja: "このキーボードはマクロに対応していません。",
    fr: "Ce clavier ne prend pas en charge les macros.",
  },
  macroEmpty: {
    en: "No actions yet — add one below.",
    zh: "还没有任何动作,在下方添加一个。",
    ja: "まだアクションがありません——下から追加してください。",
    fr: "Aucune action pour l'instant — ajoutez-en une ci-dessous.",
  },
  macroHint: {
    en: "Each macro has its own number — M0, M1, M2, and so on. Assign a key in the keymap to the matching number (e.g. M0 for the first macro), and pressing it triggers that macro.",
    zh: "每个宏都有自己的编号:M0、M1、M2……。在按键映射中把某个键位设为对应的编号(例如第一个宏是 M0),按下它就会触发那个宏。",
    ja: "各マクロには固有の番号があります——M0、M1、M2……。キーマップ内のキーを対応する番号(例:最初のマクロなら M0)に割り当てると、そのキーを押すことでマクロが発動します。",
    fr: "Chaque macro possède son propre numéro — M0, M1, M2, etc. Assignez une touche de la configuration au numéro correspondant (par ex. M0 pour la première macro) ; appuyer dessus déclenche cette macro.",
  },
  macroAddText: { en: "+ Text", zh: "+ 文本", ja: "+ テキスト", fr: "+ Texte" },
  macroAddTap: { en: "+ Tap", zh: "+ 点按", ja: "+ タップ", fr: "+ Frappe" },
  macroAddDown: { en: "+ Down", zh: "+ 按下", ja: "+ 押下", fr: "+ Appui" },
  macroAddUp: { en: "+ Up", zh: "+ 松开", ja: "+ 解放", fr: "+ Relâchement" },
  macroAddDelay: { en: "+ Delay", zh: "+ 延时", ja: "+ 遅延", fr: "+ Délai" },
  macroActionText: { en: "Text", zh: "文本", ja: "テキスト", fr: "Texte" },
  macroActionDelay: { en: "Delay", zh: "延时", ja: "遅延", fr: "Délai" },
  macroActionTap: { en: "Tap", zh: "点按", ja: "タップ", fr: "Frappe" },
  macroActionDown: { en: "Down", zh: "按下", ja: "押下", fr: "Appui" },
  macroActionUp: { en: "Up", zh: "松开", ja: "解放", fr: "Relâchement" },
  macroSlots: { en: "Macro slots", zh: "宏槽位", ja: "マクロスロット", fr: "Emplacements de macros" },
  macroShowUsedSlots: { en: "Show used only", zh: "只看已用", ja: "使用中のみ表示", fr: "Afficher seulement les utilisés" },
  macroShowAllSlots: { en: "Show all slots", zh: "显示全部", ja: "すべてのスロットを表示", fr: "Afficher tous les emplacements" },
  macroMemoryTitle: { en: "Usage", zh: "使用量", ja: "使用量", fr: "Utilisation" },
  macroMemoryUsed: {
    en: "Memory used: {used}/{total} bytes",
    zh: "已用内存:{used}/{total} 字节",
    ja: "使用メモリ:{used}/{total} バイト",
    fr: "Mémoire utilisée : {used}/{total} octets",
  },
  macroMemoryHelp: {
    en: "All macros share one block of on-keyboard memory. This bar shows how much of it your current macros use — saving is blocked once it's full.",
    zh: "所有宏共用键盘上的一块存储空间。这个进度条表示当前所有宏占用了多少;一旦占满就无法再保存。",
    ja: "すべてのマクロはキーボード上の 1 つのメモリブロックを共有します。このバーは現在のマクロがどれだけ使用しているかを示します——満杯になると保存できなくなります。",
    fr: "Toutes les macros partagent un même bloc de mémoire sur le clavier. Cette barre indique la part utilisée par vos macros actuelles — l'enregistrement est bloqué une fois pleine.",
  },
  macroSaving: { en: "Saving…", zh: "保存中…", ja: "保存中…", fr: "Enregistrement…" },

  // TapDancePanel
  tapDanceNone: {
    en: "This keyboard doesn't support tap dance.",
    zh: "这把键盘不支持点击舞步。",
    ja: "このキーボードは Tap Dance に対応していません。",
    fr: "Ce clavier ne prend pas en charge le Tap Dance.",
  },
  tapDanceUsed: {
    en: "Tap dances used: {used}/{total}",
    zh: "已用点击舞步:{used}/{total}",
    ja: "使用中の Tap Dance:{used}/{total}",
    fr: "Tap Dance utilisés : {used}/{total}",
  },
  tapDanceOnTap: { en: "On tap", zh: "单击", ja: "タップ時", fr: "Sur frappe" },
  tapDanceOnHold: { en: "On hold", zh: "长按", ja: "ホールド時", fr: "Sur maintien" },
  tapDanceOnDoubleTap: { en: "On double tap", zh: "双击", ja: "ダブルタップ時", fr: "Sur double frappe" },
  tapDanceOnTapHold: { en: "On tap + hold", zh: "单击后长按", ja: "タップ後ホールド時", fr: "Sur frappe puis maintien" },
  tapDanceTappingTerm: { en: "Tapping term", zh: "点击判定时长", ja: "タップ判定時間", fr: "Délai de frappe" },
  tapDanceHint: {
    en: "Use TD(n) in the keymap to trigger tap dance n.",
    zh: "在按键映射中使用 TD(n) 来触发对应编号的点击舞步。",
    ja: "キーマップで TD(n) を使うと、対応する番号の Tap Dance を発動できます。",
    fr: "Utilisez TD(n) dans la configuration pour déclencher le Tap Dance n.",
  },
  tapDanceUsedHelp: {
    en: "This bar shows how many tap dance slots are in use out of the total this keyboard provides.",
    zh: "这个进度条表示已使用的点击舞步槽位数占键盘可用总数的比例。",
    ja: "このバーは、このキーボードが提供する Tap Dance スロットの総数のうち、現在使用中の数を示します。",
    fr: "Cette barre indique le nombre d'emplacements Tap Dance utilisés sur le total disponible sur ce clavier.",
  },
  tapDanceTermMs: { en: "{ms} ms", zh: "{ms} 毫秒", ja: "{ms} ミリ秒", fr: "{ms} ms" },
  msUnit: { en: "ms", zh: "毫秒", ja: "ミリ秒", fr: "ms" },
  tapDanceDeleteConfirm: {
    en: "Delete this tap dance? This clears all its actions.",
    zh: "确定要删除这个点击舞步吗?这会清空它的所有动作。",
    ja: "この Tap Dance を削除しますか?すべてのアクションが消去されます。",
    fr: "Supprimer ce Tap Dance ? Toutes ses actions seront effacées.",
  },
  // Shown when a renumber's write to the new slot lands but clearing the old slot then fails,
  // leaving the entry duplicated on the device until it's cleared manually or the page reloads.
  tapDanceMoveDuplicated: {
    en: "Slot {from} still holds a copy — the move to slot {to} succeeded but clearing the old slot failed",
    zh: "槽位 {from} 仍保留着一份——移动到槽位 {to} 已成功,但清空原槽位失败了",
    ja: "スロット {from} にはまだコピーが残っています——スロット {to} への移動は成功しましたが、元のスロットのクリアに失敗しました",
    fr: "L'emplacement {from} contient toujours une copie — le déplacement vers l'emplacement {to} a réussi, mais l'effacement de l'ancien emplacement a échoué",
  },
  tapDanceAssigned: { en: "In use", zh: "已使用", ja: "使用中", fr: "Utilisé" },
  tapDanceUnassigned: { en: "Not in use", zh: "未使用", ja: "未使用", fr: "Non utilisé" },
  tapDanceAssignedHelp: {
    en: "TD({n}) is placed on a key in the keymap.",
    zh: "TD({n}) 已被放置到按键映射中。",
    ja: "TD({n}) はキーマップ内のキーに配置されています。",
    fr: "TD({n}) est placé sur une touche de la configuration.",
  },
  tapDanceUnassignedHelp: {
    en: "TD({n}) is configured but not yet placed on any key.",
    zh: "TD({n}) 已配置,但还没有放置到任何按键上。",
    ja: "TD({n}) は設定済みですが、まだどのキーにも配置されていません。",
    fr: "TD({n}) est configuré mais n'est encore placé sur aucune touche.",
  },
  tapDanceAdd: { en: "Add tap dance", zh: "添加 Tap Dance", ja: "Tap Dance を追加", fr: "Ajouter un Tap Dance" },
  tapDanceRenumber: { en: "Change slot number", zh: "更换槽位编号", ja: "スロット番号を変更", fr: "Changer le numéro d'emplacement" },
  tapDanceColSlot: { en: "Slot", zh: "槽位", ja: "スロット", fr: "Emplacement" },
  tapDanceColStatus: { en: "Status", zh: "状态", ja: "状態", fr: "État" },
  tapDanceColActions: { en: "Actions", zh: "操作", ja: "操作", fr: "Actions" },
  tapDanceEmpty: { en: "No tap dances configured yet.", zh: "还没有配置任何点击舞步。", ja: "まだ Tap Dance が設定されていません。", fr: "Aucun Tap Dance configuré pour l'instant." },
  tapDanceFull: {
    en: "All tap dance slots are in use.",
    zh: "点击舞步槽位已全部用完。",
    ja: "すべての Tap Dance スロットが使用中です。",
    fr: "Tous les emplacements Tap Dance sont utilisés.",
  },

  // ComboPanel
  comboNone: {
    en: "This keyboard doesn't support combos.",
    zh: "这把键盘不支持组合键。",
    ja: "このキーボードはコンボに対応していません。",
    fr: "Ce clavier ne prend pas en charge les combos.",
  },
  comboUsed: {
    en: "Combos used: {used}/{total}",
    zh: "已用组合键:{used}/{total}",
    ja: "使用中のコンボ:{used}/{total}",
    fr: "Combos utilisés : {used}/{total}",
  },
  comboLegend: { en: "Combo {n}", zh: "组合键 {n}", ja: "コンボ {n}", fr: "Combo {n}" },
  // ComboPanel table headers
  comboColSlot: { en: "Slot", zh: "槽位", ja: "スロット", fr: "Emplacement" },
  comboColTriggers: { en: "Trigger keys", zh: "触发按键", ja: "トリガーキー", fr: "Touches de déclenchement" },
  comboColActions: { en: "Actions", zh: "操作", ja: "操作", fr: "Actions" },
  comboKeyN: { en: "Key {n}", zh: "按键 {n}", ja: "キー {n}", fr: "Touche {n}" },
  comboOutput: { en: "Output key", zh: "输出按键", ja: "出力キー", fr: "Touche de sortie" },
  comboHint: {
    en: "Press all input keys together to trigger the output key.",
    zh: "同时按下所有输入按键,即可触发输出按键。",
    ja: "すべての入力キーを同時に押すと、出力キーが発動します。",
    fr: "Appuyez simultanément sur toutes les touches d'entrée pour déclencher la touche de sortie.",
  },
  // RGB (VialRGB / QMK rgb_matrix)
  rgbHint: {
    en: "Lighting settings apply to the whole board: one effect plus a shared color, brightness, and speed. Vial's protocol has no per-key color command, so per-key lighting isn't available here.",
    zh: "灯光设置对整块键盘生效:一个效果,加上共用的颜色、亮度与速度。Vial 协议没有逐键配色的指令,所以这里不支持单键灯光。",
    ja: "ライティング設定は基板全体に適用されます:1 つのエフェクトと共有の色・明るさ・速度です。Vial プロトコルにはキーごとの色指定コマンドがないため、ここではキーごとのライティングは利用できません。",
    fr: "Les réglages d'éclairage s'appliquent à l'ensemble du clavier : un effet ainsi qu'une couleur, une luminosité et une vitesse partagées. Le protocole Vial ne dispose pas de commande de couleur par touche, l'éclairage par touche n'est donc pas disponible ici.",
  },
  rgbUnsupported: {
    en: "This keyboard's firmware wasn't built with VialRGB lighting. The settings below are shown for reference only and can't be changed.",
    zh: "这块键盘的固件没有启用 VialRGB 灯光。下方设置仅供参考,无法修改。",
    ja: "このキーボードのファームウェアは VialRGB ライティングでビルドされていません。以下の設定は参考として表示されているだけで、変更できません。",
    fr: "Le firmware de ce clavier n'a pas été compilé avec l'éclairage VialRGB. Les réglages ci-dessous sont affichés à titre indicatif uniquement et ne peuvent pas être modifiés.",
  },
  qmkSettingsUnsupported: {
    en: "This keyboard's firmware doesn't expose QMK Settings — common on boards whose vendor ships a compiled Vial-compatible firmware without configuring (or publishing) any QMK Settings. This page isn't available on this keyboard.",
    zh: "这块键盘的固件没有开放 QMK 设置——常见于厂商只提供编译好的 Vial 兼容固件,而未在固件里配置(或公开)QMK 设置的情况。此页面在这块键盘上不可用。",
    ja: "このキーボードのファームウェアは QMK 設定を公開していません。ベンダーが Vial 対応のコンパイル済みファームウェアのみを配布し、QMK 設定を構成(または公開)していない場合によく見られます。このキーボードではこのページを利用できません。",
    fr: "Le firmware de ce clavier n'expose pas les réglages QMK — un cas fréquent lorsque le fabricant ne fournit qu'un firmware compilé compatible Vial, sans configurer (ni publier) de réglages QMK. Cette page n'est pas disponible sur ce clavier.",
  },
  qmkTocTitle: { en: "Sections", zh: "设置目录", ja: "目次", fr: "Sections" },
  rgbEffect: { en: "Effect", zh: "灯光效果", ja: "エフェクト", fr: "Effet" },
  rgbEffectDesc: {
    en: "{n} effect(s) available on this keyboard",
    zh: "这块键盘可用 {n} 种效果",
    ja: "このキーボードで利用可能なエフェクト:{n} 種類",
    fr: "{n} effet(s) disponible(s) sur ce clavier",
  },
  rgbColor: { en: "Color", zh: "颜色", ja: "色", fr: "Couleur" },
  rgbColorIgnoredHelp: {
    en: "This effect cycles through colors on its own, so the color setting has no visible effect on it.",
    zh: "该效果会自行循环变换颜色,所以这里的颜色设置对它不起作用。",
    ja: "このエフェクトは自動的に色を循環させるため、色の設定はここでは反映されません。",
    fr: "Cet effet fait défiler les couleurs par lui-même, le réglage de couleur n'a donc aucun effet visible sur lui.",
  },
  rgbBrightness: { en: "Brightness", zh: "亮度", ja: "明るさ", fr: "Luminosité" },
  rgbSpeed: { en: "Speed", zh: "速度", ja: "速度", fr: "Vitesse" },
  rgbSave: { en: "Save to keyboard", zh: "保存到键盘", ja: "キーボードに保存", fr: "Enregistrer sur le clavier" },
  rgbSaving: { en: "Saving…", zh: "保存中…", ja: "保存中…", fr: "Enregistrement…" },
  rgbSaved: {
    en: "Lighting settings saved to the keyboard.",
    zh: "灯光设置已保存到键盘。",
    ja: "ライティング設定をキーボードに保存しました。",
    fr: "Réglages d'éclairage enregistrés sur le clavier.",
  },
  rgbSaveHint: {
    en: "Changes apply instantly but are lost on replug until you save them.",
    zh: "改动会立即生效,但在保存之前,重新插拔键盘就会丢失。",
    ja: "変更はすぐに反映されますが、保存するまでは抜き差しすると失われます。",
    fr: "Les modifications s'appliquent instantanément mais sont perdues au débranchement tant qu'elles ne sont pas enregistrées.",
  },
  rgbWriteFailed: {
    en: "Failed to write lighting settings: {error}",
    zh: "写入灯光设置失败:{error}",
    ja: "ライティング設定の書き込みに失敗しました:{error}",
    fr: "Échec de l'écriture des réglages d'éclairage : {error}",
  },
  comboUsedHelp: {
    en: "This bar shows how many combo slots are in use out of the total this keyboard provides.",
    zh: "这个进度条表示已使用的组合键槽位数占键盘可用总数的比例。",
    ja: "このバーは、このキーボードが提供するコンボスロットの総数のうち、現在使用中の数を示します。",
    fr: "Cette barre indique le nombre d'emplacements de combo utilisés sur le total disponible sur ce clavier.",
  },
  comboDeleteConfirm: {
    en: "Delete this combo?",
    zh: "确定删除这个组合键吗?",
    ja: "このコンボを削除しますか?",
    fr: "Supprimer ce combo ?",
  },
  // Shown when a renumber's write to the new slot lands but clearing the old slot then fails,
  // leaving the entry duplicated on the device until it's cleared manually or the page reloads.
  comboMoveDuplicated: {
    en: "Slot {from} still holds a copy — the move to slot {to} succeeded but clearing the old slot failed",
    zh: "槽位 {from} 仍保留着一份——移动到槽位 {to} 已成功,但清空原槽位失败了",
    ja: "スロット {from} にはまだコピーが残っています——スロット {to} への移動は成功しましたが、元のスロットのクリアに失敗しました",
    fr: "L'emplacement {from} contient toujours une copie — le déplacement vers l'emplacement {to} a réussi, mais l'effacement de l'ancien emplacement a échoué",
  },
  comboActive: { en: "Active", zh: "已生效", ja: "有効", fr: "Actif" },
  comboAdd: { en: "Add combo", zh: "添加 Combo", ja: "コンボを追加", fr: "Ajouter un combo" },
  comboRenumber: { en: "Change slot number", zh: "更换槽位编号", ja: "スロット番号を変更", fr: "Changer le numéro d'emplacement" },
  comboEmpty: { en: "No combos configured yet.", zh: "还没有配置任何组合键。", ja: "まだコンボが設定されていません。", fr: "Aucun combo configuré pour l'instant." },
  comboFull: {
    en: "All combo slots are already in use.",
    zh: "所有组合键槽位都已被使用。",
    ja: "すべてのコンボスロットがすでに使用されています。",
    fr: "Tous les emplacements de combo sont déjà utilisés.",
  },
  fieldModUnsupported: {
    en: "This modifier combination has no fire-together form.",
    zh: "该修饰键组合没有「同时触发」形式。",
    ja: "この修飾キーの組み合わせには「同時発火」形式がありません。",
    fr: "Cette combinaison de modificateurs n'a pas de forme de déclenchement simultané.",
  },
  fieldInvalidKeycode: {
    en: "One of the keys is an incomplete modifier combo — pick a regular key to complete it before saving.",
    zh: "存在未完成的组合按键——请先为修饰键组合选择一个普通按键,再保存。",
    ja: "いずれかのキーが未完成の修飾キー組み合わせです——保存する前に通常のキーを選択して完成させてください。",
    fr: "L'une des touches est un combo de modificateurs incomplet — choisissez une touche normale pour le compléter avant d'enregistrer.",
  },
  fieldAddModifier: { en: "Add modifier", zh: "添加修饰键", ja: "修飾キーを追加", fr: "Ajouter un modificateur" },
  fieldAddRegularKey: { en: "Add", zh: "添加", ja: "追加", fr: "Ajouter" },
  fieldRemoveModifier: { en: "Remove modifier", zh: "移除修饰键", ja: "修飾キーを削除", fr: "Retirer le modificateur" },
  fieldRemoveHold: { en: "Remove hold action", zh: "移除长按功能", ja: "長押し動作を削除", fr: "Retirer l'action de maintien" },
  fieldConfirm: { en: "Confirm", zh: "确认", ja: "確認", fr: "Confirmer" },
  fieldConfirmClean: { en: "No changes", zh: "无改动", ja: "変更なし", fr: "Aucune modification" },

  // DeviceConnect
  connecting: { en: "Connecting…", zh: "连接中…", ja: "接続中…", fr: "Connexion…" },
  connectedTo: { en: "Connected: {name}", zh: "已连接:{name}", ja: "接続済み:{name}", fr: "Connecté : {name}" },
  disconnect: { en: "Disconnect", zh: "断开连接", ja: "切断", fr: "Déconnecter" },

  // WaitingForConnection
  waitingTitle: { en: "Waiting for connection", zh: "等待连接", ja: "接続待ち", fr: "En attente de connexion" },
  waitingSubtitle: {
    en: "Click the button below to start detecting your keyboard.",
    zh: "请点击下方按钮开始检测。",
    ja: "下のボタンをクリックしてキーボードの検出を開始してください。",
    fr: "Cliquez sur le bouton ci-dessous pour commencer à détecter votre clavier.",
  },
  detectDevice: { en: "Detect device", zh: "检测设备", ja: "デバイスを検出", fr: "Détecter le périphérique" },
  previewMode: { en: "Feature preview", zh: "功能预览", ja: "機能プレビュー", fr: "Aperçu des fonctionnalités" },
  reconnectSaved: { en: "Reconnect {name}", zh: "重新连接 {name}", ja: "{name} に再接続", fr: "Reconnecter {name}" },
  toggleLanguage: { en: "Switch language", zh: "切换语言", ja: "言語を切り替え", fr: "Changer de langue" },
  toggleTheme: { en: "Toggle theme", zh: "切换主题", ja: "テーマを切り替え", fr: "Changer de thème" },
  browserUnsupportedTitle: { en: "Browser not supported", zh: "浏览器不支持", ja: "対応していないブラウザです", fr: "Navigateur non pris en charge" },
  browserUnsupportedDesc: {
    en: "Your browser doesn't support WebHID, which Vialite needs to talk to your keyboard. Please use Chrome, Edge, or Opera on desktop — Firefox and Safari don't support WebHID.",
    zh: "当前浏览器不支持 WebHID,Vialite 需要它才能与键盘通信。请在桌面端使用 Chrome、Edge 或 Opera —— Firefox 和 Safari 目前不支持 WebHID。",
    ja: "お使いのブラウザは、Vialite がキーボードと通信するために必要な WebHID に対応していません。デスクトップ版の Chrome、Edge、Opera をご利用ください——Firefox と Safari は WebHID に対応していません。",
    fr: "Votre navigateur ne prend pas en charge WebHID, dont Vialite a besoin pour communiquer avec votre clavier. Veuillez utiliser Chrome, Edge ou Opera sur ordinateur — Firefox et Safari ne prennent pas en charge WebHID.",
  },
  browserInsecureTitle: { en: "Insecure connection", zh: "不安全的连接", ja: "安全でない接続", fr: "Connexion non sécurisée" },
  browserInsecureDesc: {
    en: "This page was loaded over plain HTTP. WebHID only works over HTTPS (or on localhost) — please reopen the site via an https:// address.",
    zh: "当前页面通过不安全的连接(HTTP)加载。WebHID 仅在 HTTPS 页面(或 localhost)上可用,请改用 https:// 地址重新访问。",
    ja: "このページは非暗号化の HTTP で読み込まれました。WebHID は HTTPS(または localhost)でのみ動作します——https:// のアドレスでサイトを開き直してください。",
    fr: "Cette page a été chargée en HTTP non sécurisé. WebHID ne fonctionne que via HTTPS (ou sur localhost) — veuillez rouvrir le site via une adresse https://.",
  },
  browserInappTitle: { en: "Open in a real browser", zh: "请在浏览器中打开", ja: "実際のブラウザで開いてください", fr: "Ouvrir dans un vrai navigateur" },
  browserInappDesc: {
    en: "App built-in browsers (WeChat, QQ, …) can't connect to a keyboard. Copy this page's link and open it in desktop Chrome, Edge, or Opera.",
    zh: "微信、QQ 等 App 的内置浏览器无法连接键盘。请复制本页链接,用电脑版 Chrome、Edge 或 Opera 打开。",
    ja: "アプリ内蔵ブラウザ(WeChat、QQ など)はキーボードに接続できません。このページのリンクをコピーし、デスクトップ版の Chrome、Edge、Opera で開いてください。",
    fr: "Les navigateurs intégrés aux applications (WeChat, QQ, …) ne peuvent pas se connecter à un clavier. Copiez le lien de cette page et ouvrez-le dans Chrome, Edge ou Opera sur ordinateur.",
  },
  // Shown on the connect screen alongside the debug-log toggle when something
  // has gone wrong, pointing at how the toggle helps.
  connectDebugPrompt: {
    en: "Ran into a problem? Turn on debug logging, retry, then open the browser console (F12) and share what it prints.",
    zh: "遇到问题?打开调试日志后重试,然后按 F12 打开浏览器控制台,把输出的内容一并反馈。",
    ja: "問題が発生しましたか?デバッグログをオンにして再試行し、ブラウザのコンソール(F12)を開いて出力内容を共有してください。",
    fr: "Un problème est survenu ? Activez la journalisation de débogage, réessayez, puis ouvrez la console du navigateur (F12) et partagez ce qui s'affiche.",
  },
  // Diagnostics panel in the bottom-right corner, shown only when the connect
  // screen is reporting a problem, to help triage bug reports.
  diagTitle: { en: "Diagnostics", zh: "排查信息", ja: "診断情報", fr: "Diagnostics" },
  diagBrowser: { en: "Browser", zh: "浏览器", ja: "ブラウザ", fr: "Navigateur" },
  diagBuild: { en: "Build", zh: "构建时间", ja: "ビルド", fr: "Build" },
  diagUa: { en: "UA", zh: "UA", ja: "UA", fr: "UA" },
  diagCopy: { en: "Copy", zh: "复制", ja: "コピー", fr: "Copier" },
  diagCopied: { en: "Copied", zh: "已复制", ja: "コピーしました", fr: "Copié" },

  // LayerTabs
  layerN: { en: "Layer {n}", zh: "层 {n}", ja: "レイヤー {n}", fr: "Calque {n}" },
  layers: { en: "Layers", zh: "层", ja: "レイヤー", fr: "Calques" },
  layerShowUsed: { en: "Show used only", zh: "只看已用", ja: "使用中のみ表示", fr: "Afficher seulement les utilisés" },
  layerShowAll: { en: "Show all layers", zh: "显示全部", ja: "すべてのレイヤーを表示", fr: "Afficher tous les calques" },

  // 配置区域
  // 未选中按键时点配置区域里的键码,弹这句提示(不再置灰拦截点击)。
  selectKeyFirst: {
    en: "Please select the key you want to configure",
    zh: "请选择需要配置的按键",
    ja: "設定したいキーを選択してください",
    fr: "Veuillez sélectionner la touche à configurer",
  },
  advancedPicker: { en: "Advanced…", zh: "高级…", ja: "詳細設定…", fr: "Avancé…" },

  // KeycodePicker
  searchPlaceholder: { en: "Search keycodes…", zh: "搜索键码…", ja: "キーコードを検索…", fr: "Rechercher des codes de touche…" },
  assignByKeypress: { en: "Assign by keypress", zh: "按键直接赋值", ja: "キー入力で割り当て", fr: "Assigner par frappe de touche" },
  listening: { en: "Listening… (Esc to stop)", zh: "监听中…(按 Esc 停止)", ja: "検出中…(Esc で停止)", fr: "Écoute en cours… (Échap pour arrêter)" },
  listenTooltip: {
    en: "Press a key on your active keyboard to assign it",
    zh: "按下手边键盘上的按键,直接赋值给选中的键位",
    ja: "お使いのキーボードでキーを押すと、選択中のキーに割り当てられます",
    fr: "Appuyez sur une touche de votre clavier actif pour l'assigner",
  },
  anyKeyPlaceholder: {
    en: "Any key: e.g. LT(2,KC_A), LCTL(KC_C), 0x5c00",
    zh: "任意键码:如 LT(2,KC_A)、LCTL(KC_C)、0x5c00",
    ja: "任意のキー:例 LT(2,KC_A)、LCTL(KC_C)、0x5c00",
    fr: "N'importe quelle touche : ex. LT(2,KC_A), LCTL(KC_C), 0x5c00",
  },
  set: { en: "Set", zh: "设置", ja: "設定", fr: "Définir" },
  anyKeycodeHeading: { en: "Any Keycode", zh: "任意键码", ja: "任意のキーコード", fr: "N'importe quel code" },
  groupConfigSettings: { en: "Config", zh: "配置", ja: "設定", fr: "Config" },
  configKeyboardColor: {
    en: "Configure Keyboard Color",
    zh: "配置键盘颜色",
    ja: "キーボードの配色を設定",
    fr: "Configurer la couleur du clavier",
  },
  autoAdvance: { en: "Auto-select next", zh: "自动选取下一个", ja: "次を自動選択", fr: "Sélection automatique suivante" },
  autoAdvanceHelp: {
    en: "When on, assigning a key automatically selects the next key so you can configure them in sequence.",
    zh: "开启后,设置完成一个按键会自动选中下一个按键,便于连续配置。",
    ja: "オンにすると、キーを割り当てた後に自動的に次のキーが選択され、連続して設定できます。",
    fr: "Lorsque activé, assigner une touche sélectionne automatiquement la suivante, pour les configurer en séquence.",
  },
  sectionSpecialKeys: { en: "Special Keys Area", zh: "特殊按键区域", ja: "特殊キーエリア", fr: "Zone des touches spéciales" },
  pickInnerKey: {
    en: "{template} — now pick the inner key",
    zh: "{template}——请继续选择内部按键",
    ja: "{template} ——続けて内部のキーを選択してください",
    fr: "{template} — choisissez maintenant la touche interne",
  },
  cancel: { en: "Cancel", zh: "取消", ja: "キャンセル", fr: "Annuler" },
  cannotNest: {
    en: "{qmkId} cannot be nested inside {template}; pick a basic key",
    zh: "{qmkId} 不能嵌套进 {template},请选择基础键",
    ja: "{qmkId} は {template} の内部にネストできません;基本キーを選択してください",
    fr: "{qmkId} ne peut pas être imbriqué dans {template} ; choisissez une touche de base",
  },
  noKeyMapping: {
    en: 'no keycode mapping for "{code}"',
    zh: "没有与 “{code}” 对应的键码",
    ja: "「{code}」に対応するキーコードがありません",
    fr: "aucun code de touche pour « {code} »",
  },
  noMatch: {
    en: "No keycodes match “{query}”.",
    zh: "没有匹配 “{query}” 的键码。",
    ja: "「{query}」に一致するキーコードがありません。",
    fr: "Aucun code de touche ne correspond à « {query} ».",
  },

  // Basic-category "clear" keys (KC_NO / KC_TRNS) — two different kinds of clear
  clearNoLabel: { en: "Clear", zh: "清空按键", ja: "クリア", fr: "Effacer" },
  clearNoTitle: {
    en: "KC_NO — key does nothing (no function on any layer)",
    zh: "KC_NO — 清空为空键,该位置无任何功能",
    ja: "KC_NO — 何も機能しないキー(どのレイヤーでも機能なし)",
    fr: "KC_NO — la touche ne fait rien (aucune fonction sur aucun calque)",
  },
  clearTransLabel: { en: "Transparent", zh: "设置为穿透", ja: "透過", fr: "Transparent" },
  clearTransTitle: {
    en: "KC_TRNS — transparent: falls through to the same key on a lower layer",
    zh: "KC_TRNS — 透明清空,沿用下层同一位置的按键",
    ja: "KC_TRNS — 透過:下位レイヤーの同じ位置のキーがそのまま使われます",
    fr: "KC_TRNS — transparent : reprend la même touche du calque inférieur",
  },

  // Keycode categories (keys must mirror KEYCODE_CATEGORIES names in keycodes.ts)
  categoryBasic: { en: "Basic Keys", zh: "基础按键", ja: "基本キー", fr: "Touches de base" },
  categoryNumpad: { en: "Numpad", zh: "小键盘", ja: "テンキー", fr: "Pavé numérique" },
  categoryNavigation: { en: "Navigation", zh: "导航", ja: "ナビゲーション", fr: "Navigation" },
  categoryShifted: { en: "Shifted", zh: "上档符号", ja: "シフト記号", fr: "Symboles majuscules" },
  categoryIso: { en: "ISO/International", zh: "ISO/国际", ja: "ISO/国際", fr: "ISO/International" },
  categoryFn: { en: "Fn keys", zh: "Fn 键", ja: "Fn キー", fr: "Touches Fn" },
  categoryLayers: { en: "Layers", zh: "层切换", ja: "レイヤー切り替え", fr: "Calques" },
  categoryQuantum: { en: "Quantum", zh: "Quantum", ja: "Quantum", fr: "Quantum" },
  categoryMacros: { en: "Macros", zh: "宏", ja: "マクロ", fr: "Macros" },
  categoryMedia: { en: "Media", zh: "媒体", ja: "メディア", fr: "Média" },
  categoryMouse: { en: "Mouse", zh: "鼠标", ja: "マウス", fr: "Souris" },
  categoryFnMediaMouse: { en: "Function", zh: "功能按键", ja: "ファンクション", fr: "Fonction" },
  categoryLighting: { en: "Lighting", zh: "灯光", ja: "ライティング", fr: "Éclairage" },
  categoryCustom: { en: "Custom", zh: "自定义", ja: "カスタム", fr: "Personnalisé" },
  categoryKeyboardFunction: { en: "Keyboard Function", zh: "键盘功能", ja: "キーボード機能", fr: "Fonctions du clavier" },
  categoryKeyboardConfig: { en: "Keyboard Config", zh: "键盘配置", ja: "キーボード設定", fr: "Configuration du clavier" },
  categoryOther: { en: "Other", zh: "其他", ja: "その他", fr: "Autre" },

  // KeycodeCascadeSelector top-level heading/placeholder, and CascadeInfoPanel
  // field labels — previously hardcoded per-language literals in those two
  // components, now routed through MESSAGES so ja/fr pick them up too.
  cascadeSelectorHeading: {
    en: "Keycode Selector (cascade)",
    zh: "按键选择器（级联）",
    ja: "キーコードセレクター(階層選択)",
    fr: "Sélecteur de code de touche (en cascade)",
  },
  cascadeSelectorPlaceholder: {
    en: "Pick a keycode",
    zh: "选择按键",
    ja: "キーコードを選択",
    fr: "Choisir un code de touche",
  },
  // 复制 / 粘贴 actions pinned above 清空/穿透 in the right-click menu, plus the
  // toast confirming a copy (see hooks/useKeycodeClipboard.ts).
  cascadeCopy: { en: "Copy", zh: "复制", ja: "コピー", fr: "Copier" },
  cascadePaste: { en: "Paste", zh: "粘贴", ja: "貼り付け", fr: "Coller" },
  cascadeCopied: {
    en: "Copied {key}",
    zh: "已复制 {key}",
    ja: "{key} をコピーしました",
    fr: "{key} copié",
  },
  cascadeKeycodeLabel: { en: "Keycode", zh: "按键编码", ja: "キーコード", fr: "Code de touche" },
  cascadeDescriptionLabel: { en: "Description", zh: "按键说明", ja: "説明", fr: "Description" },
  cascadeCategoryLabel: { en: "Category", zh: "分类说明", ja: "カテゴリ", fr: "Catégorie" },
  // Sub-column item label for layer groups in the cascade selector (e.g. "第 3 层" / "Layer 3").
  cascadeSubLayerN: { en: "Layer {n}", zh: "第 {n} 层", ja: "レイヤー {n}", fr: "Calque {n}" },

  // Category-level function descriptions shown in the cascade selector's info panel.
  cascadeDescIso: {
    en: "Extra keys for ISO/JIS layouts and international input (non-US symbols, Kana, etc.).",
    zh: "ISO/JIS 布局及国际输入所需的额外按键（非美式符号、假名等）。",
    ja: "ISO/JIS レイアウトや国際入力(非 US 記号、かな入力など)のための追加キー。",
    fr: "Touches supplémentaires pour les dispositions ISO/JIS et la saisie internationale (symboles non américains, kana, etc.).",
  },
  cascadeDescLayers: {
    en: "Switch, toggle, or momentarily activate keymap layers.",
    zh: "切换、锁定或临时激活键盘层。",
    ja: "キーマップレイヤーを切り替え、トグル、または一時的に有効化します。",
    fr: "Change, bascule ou active momentanément les calques de la configuration.",
  },
  cascadeDescQuantum: {
    en: "QMK advanced keys: one-shot mods, held modifiers, and mod-tap / layer-tap combinations.",
    zh: "QMK 高级按键:一次性修饰键、组合修饰键、按住/点击双功能等。",
    ja: "QMK の高度なキー:ワンショット修飾キー、保持型修飾キー、Mod-Tap / Layer-Tap の組み合わせ。",
    fr: "Touches avancées QMK : modificateurs à usage unique, modificateurs maintenus, et combinaisons Mod-Tap / Layer-Tap.",
  },
  cascadeDescMedia: {
    en: "Media playback, volume, brightness, and system control keys.",
    zh: "媒体播放、音量、亮度与系统控制按键。",
    ja: "メディア再生、音量、輝度、システム制御用のキー。",
    fr: "Touches de lecture multimédia, volume, luminosité et contrôle système.",
  },
  cascadeDescMouse: {
    en: "Move the pointer, click mouse buttons, and scroll the wheel from the keyboard.",
    zh: "用键盘移动指针、点击鼠标按键和滚动滚轮。",
    ja: "キーボードからポインターの移動、マウスボタンのクリック、ホイールのスクロールを行います。",
    fr: "Déplacez le pointeur, cliquez sur les boutons de la souris et faites défiler la molette depuis le clavier.",
  },
  cascadeDescLighting: {
    en: "Control backlight and RGB lighting: brightness, hue, effects, and modes.",
    zh: "控制背光与 RGB 灯光:亮度、色相、灯效与模式。",
    ja: "バックライトと RGB ライティングを制御します:輝度、色相、エフェクト、モード。",
    fr: "Contrôlez le rétroéclairage et l'éclairage RGB : luminosité, teinte, effets et modes.",
  },
  cascadeDescCustom: {
    en: "Keyboard-specific custom keycodes defined by this device's firmware.",
    zh: "本键盘固件定义的专属自定义键码。",
    ja: "このデバイスのファームウェアで定義された、キーボード固有のカスタムキーコード。",
    fr: "Codes de touche personnalisés spécifiques à ce clavier, définis par son firmware.",
  },
  // Macro / tap-dance preview inside the cascade selector's info panel.
  cascadeMacroContents: { en: "Macro contents", zh: "宏内容", ja: "マクロの内容", fr: "Contenu de la macro" },
  cascadeTapDanceActions: { en: "Tap dance actions", zh: "多击动作", ja: "Tap Dance のアクション", fr: "Actions du Tap Dance" },
  cascadeNotConfigured: { en: "Not configured yet.", zh: "尚未配置。", ja: "まだ設定されていません。", fr: "Pas encore configuré." },

  // Per-key help for the Lighting keys in the "Keyboard Function" tab.
  lightBlTogg: { en: "Toggle single-color backlight on/off.", zh: "开关单色背光。", ja: "単色バックライトのオン/オフを切り替えます。", fr: "Active ou désactive le rétroéclairage monochrome." },
  lightBlStep: { en: "Cycle through backlight brightness levels.", zh: "循环切换背光亮度档位。", ja: "バックライトの明るさレベルを順に切り替えます。", fr: "Fait défiler les niveaux de luminosité du rétroéclairage." },
  lightBlBrtg: { en: "Toggle the backlight breathing effect.", zh: "开关背光呼吸效果。", ja: "バックライトの呼吸(ブリージング)エフェクトを切り替えます。", fr: "Active ou désactive l'effet de respiration du rétroéclairage." },
  lightBlOn: { en: "Turn the backlight on.", zh: "打开背光。", ja: "バックライトをオンにします。", fr: "Allume le rétroéclairage." },
  lightBlOff: { en: "Turn the backlight off.", zh: "关闭背光。", ja: "バックライトをオフにします。", fr: "Éteint le rétroéclairage." },
  lightBlInc: { en: "Increase backlight brightness.", zh: "增加背光亮度。", ja: "バックライトの明るさを上げます。", fr: "Augmente la luminosité du rétroéclairage." },
  lightBlDec: { en: "Decrease backlight brightness.", zh: "降低背光亮度。", ja: "バックライトの明るさを下げます。", fr: "Diminue la luminosité du rétroéclairage." },
  lightRgbTog: { en: "Toggle RGB lighting on/off.", zh: "开关 RGB 灯光。", ja: "RGB ライティングのオン/オフを切り替えます。", fr: "Active ou désactive l'éclairage RGB." },
  lightRgbMod: { en: "Switch to the next RGB effect.", zh: "切换到下一个 RGB 灯效。", ja: "次の RGB エフェクトに切り替えます。", fr: "Passe à l'effet RGB suivant." },
  lightRgbRmod: { en: "Switch to the previous RGB effect.", zh: "切换到上一个 RGB 灯效。", ja: "前の RGB エフェクトに切り替えます。", fr: "Passe à l'effet RGB précédent." },
  lightRgbHui: { en: "Increase hue (shift color).", zh: "增加色相（改变颜色）。", ja: "色相を上げます(色を変化させます)。", fr: "Augmente la teinte (change la couleur)." },
  lightRgbHud: { en: "Decrease hue (shift color).", zh: "减少色相（改变颜色）。", ja: "色相を下げます(色を変化させます)。", fr: "Diminue la teinte (change la couleur)." },
  lightRgbSai: { en: "Increase color saturation.", zh: "增加饱和度。", ja: "彩度を上げます。", fr: "Augmente la saturation des couleurs." },
  lightRgbSad: { en: "Decrease color saturation.", zh: "降低饱和度。", ja: "彩度を下げます。", fr: "Diminue la saturation des couleurs." },
  lightRgbVai: { en: "Increase RGB brightness.", zh: "增加 RGB 亮度。", ja: "RGB の明るさを上げます。", fr: "Augmente la luminosité RGB." },
  lightRgbVad: { en: "Decrease RGB brightness.", zh: "降低 RGB 亮度。", ja: "RGB の明るさを下げます。", fr: "Diminue la luminosité RGB." },
  lightRgbSpi: { en: "Increase effect animation speed.", zh: "加快灯效动画速度。", ja: "エフェクトのアニメーション速度を上げます。", fr: "Augmente la vitesse d'animation de l'effet." },
  lightRgbSpd: { en: "Decrease effect animation speed.", zh: "减慢灯效动画速度。", ja: "エフェクトのアニメーション速度を下げます。", fr: "Diminue la vitesse d'animation de l'effet." },
  lightRgbMP: { en: "Solid single-color mode (no animation).", zh: "纯色模式（无动画）。", ja: "単色の点灯モード(アニメーションなし)。", fr: "Mode couleur unie fixe (sans animation)." },
  lightRgbMB: { en: "Breathing effect.", zh: "呼吸灯效。", ja: "呼吸(ブリージング)エフェクト。", fr: "Effet de respiration." },
  lightRgbMR: { en: "Rainbow gradient effect.", zh: "彩虹渐变灯效。", ja: "虹色グラデーションエフェクト。", fr: "Effet de dégradé arc-en-ciel." },
  lightRgbMSw: { en: "Swirl effect.", zh: "漩涡灯效。", ja: "渦巻きエフェクト。", fr: "Effet tourbillon." },
  lightRgbMSn: { en: "Snake effect.", zh: "蛇形灯效。", ja: "スネークエフェクト。", fr: "Effet serpent." },
  lightRgbMK: { en: "Knight (scanning) effect.", zh: "骑士扫描灯效。", ja: "ナイト(走査)エフェクト。", fr: "Effet chevalier (balayage)." },
  lightRgbMX: { en: "Christmas effect.", zh: "圣诞灯效。", ja: "クリスマスエフェクト。", fr: "Effet de Noël." },
  lightRgbMG: { en: "Static gradient effect.", zh: "静态渐变灯效。", ja: "静的グラデーションエフェクト。", fr: "Effet de dégradé statique." },
  lightRgbMT: { en: "RGB test effect (cycles all LEDs).", zh: "RGB 测试灯效（逐个点亮所有灯）。", ja: "RGB テストエフェクト(すべての LED を順に点灯)。", fr: "Effet de test RGB (fait défiler toutes les LED)." },

  // Per-key help for the Media keys (shown as a hover tooltip on the expanded
  // Media card, and in the cascade selector's info panel).
  mediaVolu: { en: "Volume up.", zh: "增大音量。", ja: "音量を上げる。", fr: "Augmenter le volume." },
  mediaVold: { en: "Volume down.", zh: "减小音量。", ja: "音量を下げる。", fr: "Diminuer le volume." },
  mediaMute: { en: "Mute / unmute audio.", zh: "静音 / 取消静音。", ja: "ミュート/解除。", fr: "Couper / rétablir le son." },
  mediaMply: { en: "Play or pause media.", zh: "播放 / 暂停。", ja: "再生/一時停止。", fr: "Lire ou mettre en pause." },
  mediaMstp: { en: "Stop media playback.", zh: "停止播放。", ja: "再生を停止。", fr: "Arrêter la lecture." },
  mediaMprv: { en: "Previous track.", zh: "上一曲。", ja: "前のトラック。", fr: "Piste précédente." },
  mediaMnxt: { en: "Next track.", zh: "下一曲。", ja: "次のトラック。", fr: "Piste suivante." },
  mediaMrwd: { en: "Rewind.", zh: "快退。", ja: "早戻し。", fr: "Retour rapide." },
  mediaMffd: { en: "Fast forward.", zh: "快进。", ja: "早送り。", fr: "Avance rapide." },
  mediaEjct: { en: "Eject media.", zh: "弹出媒体。", ja: "メディアを取り出す。", fr: "Éjecter le média." },
  mediaBriu: { en: "Increase screen brightness.", zh: "增加屏幕亮度。", ja: "画面の明るさを上げる。", fr: "Augmenter la luminosité de l'écran." },
  mediaBrid: { en: "Decrease screen brightness.", zh: "降低屏幕亮度。", ja: "画面の明るさを下げる。", fr: "Diminuer la luminosité de l'écran." },
  mediaPwr: { en: "System power.", zh: "系统电源（关机）。", ja: "システム電源(シャットダウン)。", fr: "Alimentation système." },
  mediaSlep: { en: "Put the system to sleep.", zh: "系统睡眠。", ja: "システムをスリープさせる。", fr: "Mettre le système en veille." },
  mediaWake: { en: "Wake the system.", zh: "唤醒系统。", ja: "システムを起動する。", fr: "Réveiller le système." },
  mediaCalc: { en: "Open the calculator.", zh: "打开计算器。", ja: "電卓を開く。", fr: "Ouvrir la calculatrice." },
  mediaMail: { en: "Open the mail client.", zh: "打开邮件客户端。", ja: "メールクライアントを開く。", fr: "Ouvrir le client de messagerie." },
  mediaMsel: { en: "Open the media player.", zh: "打开媒体播放器。", ja: "メディアプレーヤーを開く。", fr: "Ouvrir le lecteur multimédia." },
  mediaMycm: { en: "Open the file explorer (My Computer).", zh: "打开“我的电脑”/文件管理器。", ja: "ファイルエクスプローラー(マイコンピューター)を開く。", fr: "Ouvrir l'explorateur de fichiers (Poste de travail)." },
  mediaWsch: { en: "Web search.", zh: "网页搜索。", ja: "ウェブ検索。", fr: "Recherche web." },
  mediaWhom: { en: "Open the browser home page.", zh: "打开浏览器主页。", ja: "ブラウザのホームページを開く。", fr: "Ouvrir la page d'accueil du navigateur." },
  mediaWbak: { en: "Browser: go back.", zh: "浏览器后退。", ja: "ブラウザ:戻る。", fr: "Navigateur : page précédente." },
  mediaWfwd: { en: "Browser: go forward.", zh: "浏览器前进。", ja: "ブラウザ:進む。", fr: "Navigateur : page suivante." },
  mediaWstp: { en: "Stop loading the page.", zh: "停止加载网页。", ja: "ページの読み込みを停止。", fr: "Arrêter le chargement de la page." },
  mediaWref: { en: "Refresh the page.", zh: "刷新网页。", ja: "ページを更新。", fr: "Actualiser la page." },
  mediaWfav: { en: "Open browser favorites.", zh: "打开浏览器收藏夹。", ja: "ブラウザのお気に入りを開く。", fr: "Ouvrir les favoris du navigateur." },
  mediaExec: { en: "Execute key.", zh: "执行键。", ja: "実行キー。", fr: "Touche d'exécution." },
  mediaHelp: { en: "Help key.", zh: "帮助键。", ja: "ヘルプキー。", fr: "Touche d'aide." },
  mediaSlct: { en: "Select key.", zh: "选择键。", ja: "選択キー。", fr: "Touche de sélection." },
  mediaStop: { en: "Stop key.", zh: "停止键。", ja: "停止キー。", fr: "Touche d'arrêt." },
  mediaAgin: { en: "Again / redo.", zh: "重做 / 再次。", ja: "再実行。", fr: "Refaire / répéter." },
  mediaUndo: { en: "Undo.", zh: "撤销。", ja: "元に戻す。", fr: "Annuler." },
  mediaCut: { en: "Cut.", zh: "剪切。", ja: "切り取り。", fr: "Couper." },
  mediaCopy: { en: "Copy.", zh: "复制。", ja: "コピー。", fr: "Copier." },
  mediaPste: { en: "Paste.", zh: "粘贴。", ja: "貼り付け。", fr: "Coller." },
  mediaFind: { en: "Find.", zh: "查找。", ja: "検索。", fr: "Rechercher." },
  categoryTapDance: { en: "Tap Dance", zh: "Tap Dance", ja: "Tap Dance", fr: "Tap Dance" },
  categoryMacrosTapDance: { en: "Combo Keys", zh: "组合按键", ja: "コンボキー", fr: "Touches combinées" },

  // Basic-category sub-groups (cascade selector middle column)
  groupBasicLetters: { en: "Letters", zh: "字母", ja: "文字", fr: "Lettres" },
  groupBasicNumbers: { en: "Numbers", zh: "数字", ja: "数字", fr: "Chiffres" },
  groupBasicSymbols: { en: "Symbols", zh: "符号", ja: "記号", fr: "Symboles" },
  groupBasicFKeys: { en: "F-keys", zh: "F 功能键", ja: "F キー", fr: "Touches F" },
  groupBasicEditing: { en: "Editing", zh: "编辑/导航", ja: "編集", fr: "Édition" },
  groupBasicMods: { en: "Modifiers", zh: "修饰键", ja: "修飾キー", fr: "Modificateurs" },
  groupBasicBoard: { en: "Basic Keys", zh: "基础按键", ja: "基本キー", fr: "Touches de base" },

  // Special-keys section below the simulated keyboard (clear / transparent / any)
  specialKeys: { en: "Special Keys", zh: "特殊按键", ja: "特殊キー", fr: "Touches spéciales" },
  specialClear: { en: "Clear", zh: "清空按键", ja: "クリア", fr: "Effacer" },
  specialTransparent: { en: "Transparent", zh: "穿透按键", ja: "透過", fr: "Transparent" },
  specialAny: { en: "Any Key", zh: "任意按键", ja: "任意のキー", fr: "N'importe quelle touche" },

  // Sub-groups within the "Function" tab
  // 卡片里只有 F13~F24(F1~F12 在 基础按键 那台模拟键盘上),标题带上范围,免得
  // 用户点开 "Fn 键" 找 F5 却找不到。
  groupFnKeys: {
    en: "Fn Keys (F13–F24)",
    zh: "Fn 键(F13~F24)",
    ja: "Fn キー(F13〜F24)",
    fr: "Touches Fn (F13–F24)",
  },
  groupMouse: { en: "Mouse", zh: "鼠标按键", ja: "マウス", fr: "Souris" },
  groupMedia: { en: "Media", zh: "媒体按键", ja: "メディア", fr: "Média" },
  // 配置区域里鼠标与灯光合成一个标签页(两张卡横排)。
  groupMouseLighting: { en: "Mouse & Lighting", zh: "鼠标与灯光", ja: "マウスとライティング", fr: "Souris et éclairage" },
  groupLayerKeys: { en: "Layer", zh: "层按键", ja: "レイヤー", fr: "Calque" },

  // The expanded 层按键 card: pick a layer-switch type, then a target layer number.
  layerPickType: { en: "Layer Type", zh: "层类型", ja: "レイヤータイプ", fr: "Type de calque" },
  layerPickNum: { en: "Layer Number", zh: "层编号", ja: "レイヤー番号", fr: "Numéro de calque" },
  layerPickNumHint: { en: "Pick a type first", zh: "请先选择层类型", ja: "先にタイプを選択してください", fr: "Choisissez d'abord un type" },

  // Section labels within the expanded Mouse card (cross-shaped clusters + rest)
  groupMouseMove: { en: "Move", zh: "移动", ja: "移動", fr: "Déplacement" },
  groupMouseWheel: { en: "Wheel", zh: "滚轮", ja: "ホイール", fr: "Molette" },
  groupMouseButtons: { en: "Buttons", zh: "按键", ja: "ボタン", fr: "Boutons" },
  groupMouseSpeed: { en: "Speed", zh: "速度", ja: "速度", fr: "Vitesse" },

  // 配置区域里「自定义按键」那一页(宏 / Tap Dance / 组合 三张卡片)的标签名。
  groupCustomKeys: {
    en: "Custom Keys",
    zh: "自定义按键",
    ja: "カスタムキー",
    fr: "Touches personnalisées",
  },
  // Sub-groups within the merged "Macros / Tap Dance" tab
  groupMacros: { en: "Macros", zh: "宏", ja: "マクロ", fr: "Macros" },
  groupTapDance: { en: "Tap Dance", zh: "Tap Dance", ja: "Tap Dance", fr: "Tap Dance" },
  groupMultiFunction: { en: "Key Overlay", zh: "按键叠加", ja: "キーオーバーレイ", fr: "Superposition de touche" },
  // 按键叠加页的三张卡片:单击叠加修饰键 / 长按叠加修饰键 / 长按叠加层按键。
  multiFuncTapMod: {
    en: "Modifier on Tap",
    zh: "叠加单击修饰键",
    ja: "単押しに修飾キーを重ねる",
    fr: "Modificateur à l'appui",
  },
  multiFuncHoldMod: {
    en: "Modifier on Hold",
    zh: "叠加长按修饰键",
    ja: "長押しに修飾キーを重ねる",
    fr: "Modificateur au maintien",
  },
  multiFuncHoldLayer: {
    en: "Layer on Hold",
    zh: "叠加长按层按键",
    ja: "長押しにレイヤーを重ねる",
    fr: "Calque au maintien",
  },
  multiFuncTapModDesc: {
    en: "One press sends the modifier together with the base key, like Ctrl+C.",
    zh: "单击时把修饰键和基础按键一起发出，例如 Ctrl+C",
    ja: "一度押すと修飾キーと基本キーが同時に送られます（例：Ctrl+C）。",
    fr: "Une pression envoie le modificateur avec la touche de base, comme Ctrl+C.",
  },
  multiFuncHoldModDesc: {
    en: "Tap sends the base key; hold turns it into a modifier.",
    zh: "轻触发送基础按键，长按时当作修饰键使用",
    ja: "軽く押すと基本キー、長押しすると修飾キーになります。",
    fr: "Un appui bref envoie la touche de base ; un maintien la transforme en modificateur.",
  },
  multiFuncHoldLayerDesc: {
    en: "Tap sends the base key; hold switches to another layer.",
    zh: "轻触发送基础按键，长按时切换到指定层",
    ja: "軽く押すと基本キー、長押しすると指定のレイヤーに切り替わります。",
    fr: "Un appui bref envoie la touche de base ; un maintien bascule vers un calque.",
  },
  // 三张卡片正文里那块按钮的说明:点一下就把框架写进当前选中的键。
  multiFuncApply: {
    en: "Apply to the selected key",
    zh: "应用到选中的按键",
    ja: "選択中のキーに適用",
    fr: "Appliquer à la touche sélectionnée",
  },
  detailSettings: { en: "Detailed settings", zh: "详细设置", ja: "詳細設定", fr: "Réglages détaillés" },

  // Combo-keys tab: the two expandable category cards
  // Blank in English on purpose: the card's click affordance reads clearly
  // enough without a prompt, so the hint line shows only the detail (count /
  // usage). `cardHint()` drops the empty part.
  comboCardReveal: { en: "", zh: "点击展开", ja: "クリックして展開", fr: "Cliquer pour développer" },
  comboCardCount: { en: "{n} available", zh: "共 {n} 个", ja: "利用可能:{n} 個", fr: "{n} disponible(s)" },
  comboCardUsed: { en: "Total ({used}/{total})", zh: "共计 ({used}/{total}) 个", ja: "合計 ({used}/{total})", fr: "Total ({used}/{total})" },
  comboCardEmpty: { en: "None on this device", zh: "此设备暂无", ja: "このデバイスにはありません", fr: "Aucun sur ce périphérique" },
  comboSlotConfigured: { en: "Already configured", zh: "已配置", ja: "設定済み", fr: "Déjà configuré" },
  layerCardCommon: { en: "Common", zh: "常用", ja: "よく使う", fr: "Courant" },
  comboCardEdit: { en: "Edit", zh: "编辑", ja: "編集", fr: "Modifier" },
  // The third, non-expandable Combo card in the "Macros / Tap Dance" tab.
  groupCombo: { en: "Combo", zh: "Combo", ja: "コンボ", fr: "Combo" },
  comboCardInfoHint: { en: "Applied automatically", zh: "创建后自动生效", ja: "自動的に適用されます", fr: "Appliqué automatiquement" },
  comboAutoApply: {
    en: "Combos take effect automatically once created — no key binding needed.",
    zh: "combo 创建完自动生效，无需绑定按键",
    ja: "コンボは作成すると自動的に有効になります——キーの割り当ては不要です。",
    fr: "Les combos prennent effet automatiquement une fois créés — aucune assignation de touche nécessaire.",
  },

  // Sub-groups within the "Layers" tab (one per layer-switch function)
  groupLayerMO: { en: "MO · Momentary", zh: "MO · 临时层", ja: "MO・一時レイヤー", fr: "MO · Momentané" },
  groupLayerTG: { en: "TG · Toggle", zh: "TG · 切换层", ja: "TG・切り替え", fr: "TG · Bascule" },
  groupLayerTT: { en: "TT · Tap-Toggle", zh: "TT · 点触切换", ja: "TT・タップ切り替え", fr: "TT · Bascule par frappe" },
  groupLayerOSL: { en: "OSL · One-Shot", zh: "OSL · 单次层", ja: "OSL・ワンショット", fr: "OSL · Usage unique" },
  groupLayerTO: { en: "TO · Activate", zh: "TO · 激活层", ja: "TO・有効化", fr: "TO · Activation" },
  groupLayerDF: { en: "DF · Default", zh: "DF · 默认层", ja: "DF・デフォルト", fr: "DF · Par défaut" },
  groupLayerOther: { en: "Other", zh: "其他", ja: "その他", fr: "Autre" },

  // Hover help for each "Layers" sub-group
  groupLayerMOHelp: {
    en: "Activates the target layer only while the key is held down; releasing returns to the previous layer.",
    zh: "按住时临时激活目标层，松开后立即回到原来的层。",
    ja: "キーを押している間だけ対象のレイヤーを有効化します;離すと元のレイヤーに戻ります。",
    fr: "Active le calque cible uniquement pendant que la touche est maintenue ; le relâchement revient au calque précédent.",
  },
  groupLayerTGHelp: {
    en: "Toggles the target layer on or off with each tap; the layer stays active until you toggle it off.",
    zh: "每次点按在开/关之间切换目标层，激活后会保持，直到再次切换关闭。",
    ja: "タップするたびに対象のレイヤーのオン/オフを切り替えます;オフにするまでレイヤーは有効なままです。",
    fr: "Active ou désactive le calque cible à chaque frappe ; le calque reste actif jusqu'à sa désactivation.",
  },
  groupLayerTTHelp: {
    en: "Acts like MO when held, but tapping it repeatedly toggles the layer on like TG.",
    zh: "按住时表现为 MO（临时层），连续点按则像 TG 一样把层锁定开启。",
    ja: "長押しすると MO のように動作しますが、連続してタップすると TG のようにレイヤーをオンに固定します。",
    fr: "Se comporte comme MO en maintien, mais des frappes répétées activent le calque comme TG.",
  },
  groupLayerOSLHelp: {
    en: "Activates the target layer for the next single key press only, then returns automatically.",
    zh: "只对下一次按键激活目标层，按完一个键后自动返回。",
    ja: "次の 1 回のキー入力のみ対象のレイヤーを有効化し、その後自動的に戻ります。",
    fr: "Active le calque cible uniquement pour la prochaine frappe, puis revient automatiquement.",
  },
  groupLayerTOHelp: {
    en: "Switches to the target layer and keeps it active, turning off other layers above the base.",
    zh: "切换到目标层并保持激活，同时关闭基础层之上的其他层。",
    ja: "対象のレイヤーに切り替えて有効なままにし、ベースレイヤーより上の他のレイヤーをオフにします。",
    fr: "Passe au calque cible et le maintient actif, désactivant les autres calques au-dessus de la base.",
  },
  groupLayerDFHelp: {
    en: "Sets the target layer as the new default (base) layer that stays active by default.",
    zh: "将目标层设为新的默认（基础）层，默认保持激活。",
    ja: "対象のレイヤーを新しいデフォルト(ベース)レイヤーとして設定し、デフォルトで有効なままにします。",
    fr: "Définit le calque cible comme nouveau calque par défaut (de base), actif par défaut.",
  },
  groupLayerOtherHelp: {
    en: "Other layer-switching keycodes that don't fit the categories above.",
    zh: "不属于上述分类的其他层切换键码。",
    ja: "上記のカテゴリに当てはまらない、その他のレイヤー切り替え用キーコード。",
    fr: "Autres codes de changement de calque qui ne correspondent pas aux catégories ci-dessus.",
  },

  // Sub-groups within the "Quantum" tab
  groupQuantumOSM: { en: "One-Shot Mods", zh: "单次修饰键", ja: "ワンショット修飾キー", fr: "Modificateurs à usage unique" },
  groupQuantumMods: { en: "Modifiers", zh: "修饰键", ja: "修飾キー", fr: "Modificateurs" },
  groupQuantumModTap: { en: "Mod-Tap", zh: "修饰 / 点触", ja: "Mod-Tap", fr: "Mod-Tap" },
  groupQuantumLayerTap: { en: "Layer-Tap", zh: "层 / 点触", ja: "Layer-Tap", fr: "Layer-Tap" },
  groupQuantumOther: { en: "Other", zh: "其他", ja: "その他", fr: "Autre" },
  groupQuantumMisc: { en: "Miscellaneous", zh: "其他键码", ja: "その他のキーコード", fr: "Divers" },
  // Heading for the catch-all card in the 其他 column (One-Shot Mods + misc
  // Quantum + leftover Layer fn keys). Named "更多 / More" rather than "其他"
  // to read as an overflow bucket, not a sibling of the 其他 category itself.
  cardMore: { en: "More", zh: "更多", ja: "もっと", fr: "Plus" },

  // Hover help for each "Quantum" sub-group
  groupQuantumOSMHelp: {
    en: "Tap to apply the modifier to the next single key press only, so you don't have to hold it down.",
    zh: "点按后只对下一次按键生效对应修饰键，无需一直按住。",
    ja: "タップすると次の 1 回のキー入力にのみ修飾キーが適用されるため、押し続ける必要がありません。",
    fr: "Appuyez pour appliquer le modificateur uniquement à la prochaine frappe, sans avoir à le maintenir.",
  },
  groupQuantumModsHelp: {
    en: "Applies one or more modifiers (Ctrl/Shift/Alt/GUI) to another basic keycode.",
    zh: "为某个基础键码叠加一个或多个修饰键（Ctrl/Shift/Alt/GUI）。",
    ja: "1 つ以上の修飾キー(Ctrl/Shift/Alt/GUI)を別の基本キーコードに適用します。",
    fr: "Applique un ou plusieurs modificateurs (Ctrl/Maj/Alt/GUI) à un autre code de touche de base.",
  },
  groupQuantumModTapHelp: {
    en: "Acts as a modifier when held and sends the basic keycode when tapped.",
    zh: "按住时作为修饰键，点按时发送基础键码。",
    ja: "長押しすると修飾キーとして動作し、タップすると基本キーコードを送信します。",
    fr: "Agit comme un modificateur en maintien et envoie le code de touche de base en frappe.",
  },
  groupQuantumLayerTapHelp: {
    en: "Activates the target layer when held and sends the basic keycode when tapped.",
    zh: "按住时激活目标层，点按时发送基础键码。",
    ja: "長押しすると対象のレイヤーを有効化し、タップすると基本キーコードを送信します。",
    fr: "Active le calque cible en maintien et envoie le code de touche de base en frappe.",
  },
  groupQuantumOtherHelp: {
    en: "Other Quantum keycodes that don't fit the categories above.",
    zh: "不属于上述分类的其他 Quantum 键码。",
    ja: "上記のカテゴリに当てはまらない、その他の Quantum キーコード。",
    fr: "Autres codes Quantum qui ne correspondent pas aux catégories ci-dessus.",
  },

  // QuantumCards composer (Modifiers / Mod-Tap / Layer-Tap)
  quantumCardConfigure: { en: "Click to configure", zh: "点击配置", ja: "クリックして設定", fr: "Cliquer pour configurer" },
  quantumPickMods: { en: "① Modifiers", zh: "① 选择修饰键", ja: "① 修飾キー", fr: "① Modificateurs" },
  quantumPickLayer: { en: "① Target layer", zh: "① 选择目标层", ja: "① 対象レイヤー", fr: "① Calque cible" },
  quantumPickBasic: { en: "② Basic key", zh: "② 选择普通按键", ja: "② 基本キー", fr: "② Touche de base" },
  quantumSideLeft: { en: "Left", zh: "左", ja: "左", fr: "Gauche" },
  quantumSideRight: { en: "Right", zh: "右", ja: "右", fr: "Droite" },
  quantumLayerN: { en: "L{n}", zh: "层 {n}", ja: "L{n}", fr: "L{n}" },
  quantumPreview: { en: "Preview", zh: "预览", ja: "プレビュー", fr: "Aperçu" },
  quantumApply: { en: "Apply to key", zh: "应用到按键", ja: "キーに適用", fr: "Appliquer à la touche" },
  quantumComboMissing: {
    en: "No keycode exists for this modifier combination — pick a different one.",
    zh: "该修饰键组合没有对应的键码,请更换组合。",
    ja: "この修飾キーの組み合わせに対応するキーコードがありません——別の組み合わせを選択してください。",
    fr: "Aucun code de touche n'existe pour cette combinaison de modificateurs — choisissez-en une autre.",
  },
  quantumNeedMod: { en: "Select at least one modifier.", zh: "请至少选择一个修饰键。", ja: "少なくとも 1 つの修飾キーを選択してください。", fr: "Sélectionnez au moins un modificateur." },
  quantumNeedLayer: { en: "Select a target layer.", zh: "请选择目标层。", ja: "対象のレイヤーを選択してください。", fr: "Sélectionnez un calque cible." },
  quantumNeedBasic: { en: "Pick a basic key below.", zh: "请在下方选择一个普通按键。", ja: "下から基本キーを選択してください。", fr: "Choisissez une touche de base ci-dessous." },

  // MatrixTester
  matrixStopped: {
    en: "Matrix test stopped: {error}",
    zh: "矩阵测试已停止:{error}",
    ja: "マトリックステストが停止しました:{error}",
    fr: "Test de matrice arrêté : {error}",
  },
  matrixRetrying: {
    en: "Matrix test interrupted, retrying… ({error})",
    zh: "矩阵测试已中断,正在自动重试…({error})",
    ja: "マトリックステストが中断されました、再試行中…({error})",
    fr: "Test de matrice interrompu, nouvelle tentative… ({error})",
  },
  checkingLock: {
    en: "Checking keyboard lock state…",
    zh: "正在检查键盘锁定状态…",
    ja: "キーボードのロック状態を確認中…",
    fr: "Vérification de l'état de verrouillage du clavier…",
  },
  mustUnlock: {
    en: "The keyboard must be unlocked before its switch matrix can be tested.",
    zh: "需要先解锁键盘,才能进行矩阵测试。",
    ja: "スイッチマトリックスをテストする前に、キーボードのロックを解除する必要があります。",
    fr: "Le clavier doit être déverrouillé avant de pouvoir tester sa matrice de commutateurs.",
  },
  unlock: { en: "Unlock", zh: "解锁", ja: "ロック解除", fr: "Déverrouiller" },
  matrixInstructions: {
    en: "Press every key on the keyboard; keys light up while held and stay marked once they have registered.",
    zh: "逐个按下键盘上的每个按键:按住时高亮,成功触发过的按键会保持标记。",
    ja: "キーボードのすべてのキーを押してください;押している間は点灯し、認識されると印がついたままになります。",
    fr: "Appuyez sur toutes les touches du clavier ; elles s'allument pendant l'appui et restent marquées une fois détectées.",
  },
  matrixLogEmpty: {
    en: "Waiting for a keypress…",
    zh: "等待按键触发…",
    ja: "キー入力を待っています…",
    fr: "En attente d'une frappe…",
  },
  matrixLogPress: {
    en: 'Row {row}, col {col} — "{key}" — press #{n}',
    zh: "第 {row} 行第 {col} 列 —— “{key}” 键 —— 第 {n} 次触发",
    ja: "{row} 行 {col} 列 —— 「{key}」 —— {n} 回目",
    fr: "Ligne {row}, col. {col} — « {key} » — appui n°{n}",
  },
  matrixLogChord: {
    en: "(+{n} held)",
    zh: "(同时按住 {n} 个键)",
    ja: "(+{n} 個同時押し)",
    fr: "(+{n} maintenue(s))",
  },
  reset: { en: "Reset", zh: "重置", ja: "リセット", fr: "Réinitialiser" },

  // UnlockDialog
  unlockTitle: { en: "Unlock keyboard", zh: "解锁键盘", ja: "キーボードのロック解除", fr: "Déverrouiller le clavier" },
  unlockWarning: {
    en: "In order to proceed, the keyboard must be set into unlocked mode. You should only perform this operation on computers that you trust.",
    zh: "继续操作前需要将键盘设为解锁模式。请只在你信任的电脑上执行此操作。",
    ja: "続行するには、キーボードをロック解除モードにする必要があります。この操作は信頼できるコンピューターでのみ行ってください。",
    fr: "Pour continuer, le clavier doit être mis en mode déverrouillé. N'effectuez cette opération que sur des ordinateurs de confiance.",
  },
  unlockHold: {
    en: "Press and hold the highlighted keys until the progress bar fills up:",
    zh: "按住高亮显示的按键,直到进度条充满:",
    ja: "プログレスバーが満たされるまで、ハイライトされたキーを押し続けてください:",
    fr: "Maintenez les touches surlignées jusqu'à ce que la barre de progression se remplisse :",
  },

  // Key info hover card
  keyInfoCode: { en: "Code", zh: "编码", ja: "コード", fr: "Code" },
  keyInfoTap: { en: "Tap", zh: "点击", ja: "タップ", fr: "Frappe" },
  keyInfoHold: { en: "Hold", zh: "长按", ja: "ホールド", fr: "Maintien" },
  keyInfoCombo: { en: "Together", zh: "同时", ja: "同時", fr: "Ensemble" },
  keyInfoLayerAction: { en: "Switch to layer {layer}", zh: "切换到层 {layer}", ja: "レイヤー {layer} に切り替え", fr: "Passer au calque {layer}" },
  // Behaviour blurbs at the bottom of the card. Each interpolates the key's own
  // operands (tap key / modifier / target layer) so the sentence describes *this*
  // key concretely instead of the keycode family in the abstract.
  keyInfoComboHint: {
    en: "One press sends {mod} + {key} together, exactly as if you held {mod} and then tapped {key}. It has no separate tap action.",
    zh: "按下一次就同时发送 {mod} + {key},效果等同于按住 {mod} 再敲 {key};它没有单独的点击动作。",
    ja: "1 回押すだけで {mod} + {key} が同時に送信されます。{mod} を押しながら {key} を叩くのと同じで、単独のタップ動作はありません。",
    fr: "Une seule pression envoie {mod} + {key} ensemble, exactement comme si vous mainteniez {mod} puis frappiez {key}. Elle n'a pas d'action de frappe distincte.",
  },
  keyInfoModTapHint: {
    en: "Tap it to send {key}. Hold it and it behaves as the {mod} modifier instead, so you can press other keys while holding to form a shortcut.",
    zh: "轻点发送 {key};按住不放则当作 {mod} 修饰键使用,期间再按其它键就能组成快捷键。",
    ja: "タップすると {key} を送信します。押し続けると {mod} 修飾キーとして働き、その間に他のキーを押してショートカットを作れます。",
    fr: "Une frappe envoie {key}. Maintenue, elle agit comme le modificateur {mod} : vous pouvez alors presser d'autres touches pour former un raccourci.",
  },
  keyInfoLayerTapHint: {
    en: "Tap it to send {key}. Hold it to activate layer {layer} for as long as it stays down — other keys then use their layer {layer} assignments — and releasing returns to the current layer.",
    zh: "轻点发送 {key};按住期间激活第 {layer} 层,此时其它键输出的是它们在第 {layer} 层上的定义,松手立即回到当前层。",
    ja: "タップすると {key} を送信します。押している間はレイヤー {layer} が有効になり、他のキーはレイヤー {layer} の割り当てで動作します。離すと現在のレイヤーに戻ります。",
    fr: "Une frappe envoie {key}. Maintenue, elle active le calque {layer} tant qu'elle reste enfoncée — les autres touches utilisent alors leurs affectations du calque {layer} — et le relâchement revient au calque actuel.",
  },
  keyInfoLayerMOHint: {
    en: "Activates layer {layer} only while this key is held down; releasing it returns to the layer you were on.",
    zh: "只在按住这个键期间激活第 {layer} 层,松开后立刻回到原来的层。",
    ja: "このキーを押している間だけレイヤー {layer} を有効にし、離すと元のレイヤーに戻ります。",
    fr: "Active le calque {layer} uniquement pendant que cette touche est maintenue ; le relâchement revient au calque précédent.",
  },
  keyInfoLayerTGHint: {
    en: "Each tap toggles layer {layer} on or off. Once on it stays on — even after you release the key — until you tap it again.",
    zh: "每次点按在开/关之间切换第 {layer} 层;开启后即使松开也会一直保持,直到再次点按关闭。",
    ja: "タップするたびにレイヤー {layer} のオン/オフが切り替わります。オンにするとキーを離しても、もう一度タップするまで有効なままです。",
    fr: "Chaque frappe active ou désactive le calque {layer}. Une fois actif, il le reste — même après relâchement — jusqu'à une nouvelle frappe.",
  },
  keyInfoLayerTTHint: {
    en: "Held, it activates layer {layer} like MO. Tapped repeatedly (5 times by default in QMK) it locks the layer on like TG; one more tap unlocks it.",
    zh: "按住时像 MO 一样临时激活第 {layer} 层;连续快速点按到设定次数(QMK 默认 5 次)则像 TG 一样把该层锁定开启,再点按一次解除。",
    ja: "押し続けると MO と同じようにレイヤー {layer} を一時的に有効化します。既定回数(QMK では 5 回)連続タップすると TG のようにレイヤーを固定し、もう 1 回タップで解除します。",
    fr: "Maintenue, elle active le calque {layer} comme MO. Frappée plusieurs fois (5 par défaut dans QMK), elle verrouille le calque comme TG ; une frappe de plus le déverrouille.",
  },
  keyInfoLayerOSLHint: {
    en: "Activates layer {layer} for the next key press only, then drops back automatically — no need to keep this key held.",
    zh: "激活第 {layer} 层,但只对下一次按键生效,按完一个键后自动返回,不需要一直按住这个键。",
    ja: "次の 1 回のキー入力にだけレイヤー {layer} を有効にし、その後自動的に戻ります。このキーを押し続ける必要はありません。",
    fr: "Active le calque {layer} pour la prochaine frappe seulement, puis revient automatiquement — inutile de maintenir cette touche.",
  },
  keyInfoLayerTOHint: {
    en: "Switches to layer {layer} and stays there, turning off every other layer above the base one. Another layer key is needed to leave it.",
    zh: "切换到第 {layer} 层并保持,同时关闭基础层之上的其它所有层;要离开这一层需要再按对应的层切换键。",
    ja: "レイヤー {layer} に切り替えてそのまま維持し、ベースレイヤーより上の他のレイヤーをすべてオフにします。抜けるには別のレイヤーキーが必要です。",
    fr: "Passe au calque {layer} et y reste, désactivant tous les autres calques au-dessus du calque de base. Une autre touche de calque est nécessaire pour en sortir.",
  },
  keyInfoLayerDFHint: {
    en: "Makes layer {layer} the new default (base) layer, the one active when no other layer is held; every temporary layer then stacks on top of it.",
    zh: "把第 {layer} 层设为新的默认(基础)层,也就是没有激活其它层时所处的层;之后所有临时层都叠加在它之上。",
    ja: "レイヤー {layer} を新しいデフォルト(ベース)レイヤー、つまり他のレイヤーが有効でないときのレイヤーにします。以降の一時レイヤーはその上に重なります。",
    fr: "Fait du calque {layer} le nouveau calque par défaut (de base), celui actif quand aucun autre n'est maintenu ; les calques temporaires s'empilent ensuite par-dessus.",
  },
  keyInfoLayerPDFHint: {
    en: "Makes layer {layer} the default (base) layer like DF, but also writes the choice to the keyboard's EEPROM so it survives a power cycle.",
    zh: "与 DF 一样把第 {layer} 层设为默认(基础)层,但会把选择写入键盘 EEPROM,断电重插后依然生效。",
    ja: "DF と同様にレイヤー {layer} をデフォルト(ベース)レイヤーにしますが、選択をキーボードの EEPROM に保存するため電源を入れ直しても保持されます。",
    fr: "Fait du calque {layer} le calque par défaut (de base) comme DF, mais enregistre aussi ce choix dans l'EEPROM du clavier pour qu'il survive à une coupure d'alimentation.",
  },

  // Knob panel (shown above quick-config when a knob is selected). Deliberately
  // free of protocol vocabulary — no "encoder", no CW/CCW: to the user this is
  // one control on the board that happens to have several functions.
  knobTitle: { en: "Knob", zh: "旋钮", ja: "ノブ", fr: "Molette" },
  knobIntro: {
    en: "This position has several functions — pick one, then assign a key to it below.",
    zh: "这个位置有多个功能——先选一个,再到下方给它指定按键。",
    ja: "この位置には複数の機能があります——1 つ選んでから、下でキーを割り当ててください。",
    fr: "Cette position a plusieurs fonctions — choisissez-en une, puis attribuez-lui une touche ci-dessous.",
  },
  knobCcw: { en: "Turn left", zh: "左旋", ja: "左に回す", fr: "Rotation gauche" },
  knobCw: { en: "Turn right", zh: "右旋", ja: "右に回す", fr: "Rotation droite" },
  knobPress: { en: "Press", zh: "按下", ja: "押し込み", fr: "Appui" },
  // Neutral on purpose: the UI can't tell "this board doesn't wire the knob's
  // switch into the matrix" apart from "we couldn't work out which key it is".
  knobPressNone: {
    en: "Not detected",
    zh: "未检测到",
    ja: "検出されません",
    fr: "Non détecté",
  },

  // Dual-role hold editor (shown when a cap's hold band is selected)
  holdEditorTitle: { en: "Hold action", zh: "长按动作", ja: "ホールド時の動作", fr: "Action de maintien" },
  holdEditorIntro: {
    en: "Tap outputs the key; hold to activate a layer or modifiers.",
    zh: "点按输出按键;长按激活层或修饰键。",
    ja: "タップするとキーが出力されます;ホールドするとレイヤーまたは修飾キーが有効になります。",
    fr: "La frappe envoie la touche ; le maintien active un calque ou des modificateurs.",
  },
  holdEditorTapKeeps: { en: "Tap stays: {key}", zh: "点按保持:{key}", ja: "タップは変わらず:{key}", fr: "La frappe reste : {key}" },
  holdEditorModeNone: { en: "None", zh: "无", ja: "なし", fr: "Aucun" },
  holdEditorModifiers: { en: "Modifiers", zh: "修饰键", ja: "修飾キー", fr: "Modificateurs" },
  holdEditorSide: { en: "Side", zh: "左右", ja: "左右", fr: "Côté" },
  holdEditorSideLeft: { en: "Left", zh: "左", ja: "左", fr: "Gauche" },
  holdEditorSideRight: { en: "Right", zh: "右", ja: "右", fr: "Droite" },
  holdEditorLayer: { en: "Layer", zh: "层", ja: "レイヤー", fr: "Calque" },
  holdEditorNoModsHint: {
    en: "No modifier selected — clearing all removes the hold and the cap becomes a plain key.",
    zh: "未选择修饰键——全部取消将移除长按,按键变为普通键。",
    ja: "修飾キーが選択されていません——すべて解除するとホールド動作が削除され、通常のキーになります。",
    fr: "Aucun modificateur sélectionné — tout effacer supprime le maintien et la touche redevient une touche simple.",
  },
  // Fire-together (masked-modifier) editor: the dashed-band cards.
  holdComboTitle: { en: "Combined modifiers", zh: "组合修饰键", ja: "組み合わせ修飾キー", fr: "Modificateurs combinés" },
  holdComboIntro: {
    en: "A single press fires the tap key together with the checked modifiers.",
    zh: "单次按下会让点按键与勾选的修饰键同时触发。",
    ja: "1 回押すだけで、タップキーとチェックした修飾キーが同時に発動します。",
    fr: "Une seule pression déclenche la touche de frappe avec les modificateurs cochés.",
  },
  holdComboUnsupported: {
    en: "This modifier combination has no fire-together form on this side.",
    zh: "该修饰键组合在此侧没有「同时触发」形式。",
    ja: "この修飾キーの組み合わせには、この側での「同時発火」形式がありません。",
    fr: "Cette combinaison de modificateurs n'a pas de forme de déclenchement simultané de ce côté.",
  },
  holdModUnsupported: {
    en: "This modifier combination has no matching keycode.",
    zh: "该修饰键组合没有对应的键码。",
    ja: "この修飾キーの組み合わせに対応するキーコードがありません。",
    fr: "Cette combinaison de modificateurs n'a pas de code de touche correspondant.",
  },
  holdSelectAtLeastOne: {
    en: "Select at least one modifier — the key is cleared when you leave.",
    zh: "至少选择一个修饰键——离开此界面后按键将被清空。",
    ja: "少なくとも 1 つの修飾キーを選択してください——このまま離れるとキーはクリアされます。",
    fr: "Sélectionnez au moins un modificateur — la touche sera effacée si vous quittez sans le faire.",
  },
  holdClearKey: { en: "Clear key", zh: "清空按键", ja: "キーをクリア", fr: "Effacer la touche" },
} as const satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof MESSAGES;

function isLang(value: string | null): value is Lang {
  return value === "en" || value === "zh" || value === "ja" || value === "fr";
}

export function detectLang(): Lang {
  // An explicit ?lang= wins so the SEO hreflang variants (?lang=en / ?lang=zh /
  // ?lang=ja / ?lang=fr) deliver the advertised language to crawlers and shared links.
  try {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (isLang(param)) {
      return param;
    }
  } catch {
    // No URL / params available — fall through.
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) {
      return stored;
    }
  } catch {
    // Storage may be unavailable (private mode etc.) — fall through.
  }
  const browserLang = navigator.language?.toLowerCase() ?? "";
  if (browserLang.startsWith("zh")) return "zh";
  if (browserLang.startsWith("ja")) return "ja";
  if (browserLang.startsWith("fr")) return "fr";
  return "en";
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
    const htmlLang: Record<Lang, string> = { en: "en", zh: "zh-CN", ja: "ja", fr: "fr" };
    const ogLocale: Record<Lang, string> = { en: "en_US", zh: "zh_CN", ja: "ja_JP", fr: "fr_FR" };
    document.documentElement.lang = htmlLang[lang];
    document.title = MESSAGES.seoTitle[lang];
    setMetaContent("meta[name='description']", MESSAGES.seoDescription[lang]);
    setMetaContent("meta[property='og:title']", MESSAGES.seoTitle[lang]);
    setMetaContent("meta[property='og:description']", MESSAGES.seoDescription[lang]);
    setMetaContent("meta[property='og:locale']", ogLocale[lang]);
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
