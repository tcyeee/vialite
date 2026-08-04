import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../contexts/i18n.tsx";
import { useToast } from "../contexts/toast.tsx";
import { track } from "../lib/analytics.ts";
import { knobLayout } from "../components/keymap/layout/knobGrouping.ts";
import type { KeyPart } from "../components/keymap/layout/KeyboardLayoutEditor.tsx";
import type { Keyboard } from "../protocol/keyboard.ts";
import { dualRole, withTap } from "../protocol/keycodes.ts";
import { parseVil, serializeVil } from "../protocol/vilFile.ts";
import { useWriteError } from "./useWriteError.ts";

export type Selected =
  | { kind: "key"; row: number; col: number; part?: KeyPart }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

/**
 * Next key after (row, col) in visual reading order — top-to-bottom, then
 * left-to-right — among the currently-visible caps, wrapping back to the first
 * after the last. Powers the "自动选取下一个" auto-advance. Keys within ~0.4 KLE
 * units of the same vertical position count as one row (staggered/keycap gaps).
 *
 * A knob's push switch is left out of the ordering entirely. Sweeping through a
 * row of letters and suddenly landing *inside* a knob would be jarring, and the
 * exclusion doubles as the guard for the opposite direction: a press key isn't
 * in the list, so `findIndex` misses and assigning to one advances nowhere —
 * which is what the knob panel wants (it keeps its own selection).
 */
function nextKeyPosition(
  keyboard: Keyboard,
  row: number,
  col: number,
): { row: number; col: number } | null {
  const { placed, pressKeys } = knobLayout(keyboard);
  const ordered = placed.keys
    .filter((placedKey) => !placedKey.key.decal && !pressKeys.has(placedKey))
    .map(({ key, shiftX, shiftY }) => ({
      row: key.row,
      col: key.col,
      x: key.x + shiftX,
      y: key.y + shiftY,
    }))
    .sort((a, b) => (Math.abs(a.y - b.y) > 0.4 ? a.y - b.y : a.x - b.x));
  const idx = ordered.findIndex((k) => k.row === row && k.col === col);
  if (idx === -1) {
    return null;
  }
  const next = ordered[(idx + 1) % ordered.length];
  return { row: next.row, col: next.col };
}

interface UseKeySelectionOptions {
  keyboard: Keyboard | null;
  layer: number;
  /** Connected device's product name, used to build the exported `.vil` filename. */
  productName?: string;
  /**
   * Owned by the caller (not this hook) rather than the other way round: App.tsx's
   * `useConnectionTransition`/`usePageNavigation` callbacks need to clear the
   * selection (`setSelected(null)`) at points that are established *before* this
   * hook can be called — it needs `keyboard`, which only exists once `conn` (built
   * from one of those callbacks) has already run.
   */
  selected: Selected | null;
  setSelected: (value: Selected | null | ((prev: Selected | null) => Selected | null)) => void;
}

/**
 * Every write path that acts on the selected key/encoder (assign, dual-role hold
 * write, right-click context assign, `.vil` export/import) and the "自动选取下一个"
 * auto-advance setting that `handleAssign` consults, plus the outside-click
 * deselect effect. Split out of App.tsx so this write-path logic can be reasoned
 * about independently of page layout/navigation — mirrors
 * `useConnectionTransition`/`usePageNavigation`.
 */
export function useKeySelection({
  keyboard,
  layer,
  productName,
  selected,
  setSelected,
}: UseKeySelectionOptions) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const onWriteError = useWriteError("writeKeyFailed");
  // 点击键盘预览与按键配置区(快捷配置 / 双功能编辑器)之外的任何地方都取消选中,
  // 这样选中态不会在用户已经把注意力移开后继续挂着。用文档级监听而不是背景遮罩,
  // 页面其余部分才能照常点击;两个区域各自带 data- 标记,便于命中测试区分内外。
  // 快捷配置里的浮层提示都是 pointer-events-none,不会成为 pointerdown 的目标,
  // 无需额外标记。
  useEffect(() => {
    if (!selected) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("[data-keyboard-preview], [data-key-config]")) return;
      setSelected(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selected]);
  // When on, assigning a key advances the selection to the next key (reading
  // order) so a run of keys can be configured without re-clicking each cap.
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [importing, setImporting] = useState(false);

  // "修改成功" 绿色提示:每次成功写入都(重新)启动一个 1 秒定时器,期间再次写入
  // 会先清掉旧定时器再重新计时,而不是叠加,所以连续修改时提示会一直显示、只在
  // 停手 1 秒后才消失。
  const [justModified, setJustModified] = useState(false);
  const modifiedTimerRef = useRef<number | undefined>(undefined);
  const markModified = useCallback(() => {
    window.clearTimeout(modifiedTimerRef.current);
    setJustModified(true);
    modifiedTimerRef.current = window.setTimeout(() => setJustModified(false), 1000);
  }, []);
  useEffect(() => () => window.clearTimeout(modifiedTimerRef.current), []);

  // Assigns a keycode to the currently-selected key/encoder. Unlike the old
  // popup flow, the selection is kept so the user can keep re-assigning the
  // same key from the quick-config board below.
  const handleAssign = useCallback(
    async (qmkId: string) => {
      if (!keyboard || !selected) {
        return;
      }
      let ok = false;
      try {
        if (selected.kind === "key") {
          const current = keyboard.getKey(layer, selected.row, selected.col);
          // The tap half of a dual-role cap swaps the inner key while keeping the
          // hold (falling back to writing the pick as-is if it can't recombine); a
          // plain cap writes the pick whole. The hold half is edited separately by
          // the dual-role editor, not through this pick flow.
          let toWrite = qmkId;
          try {
            if (selected.part === "tap" && dualRole(current)) {
              toWrite = withTap(current, qmkId);
            }
          } catch {
            toWrite = qmkId;
          }
          await keyboard.setKey(layer, selected.row, selected.col, toWrite);
        } else {
          await keyboard.setEncoder(layer, selected.index, selected.direction, qmkId);
        }
        ok = true;
        markModified();
      } catch (err) {
        onWriteError(err);
      }
      // "自动选取下一个": once a whole cap is assigned, advance the selection to the
      // next key in reading order so the user can configure a run of keys without
      // clicking each one. Only whole-key picks advance — editing the tap half of a
      // dual-role cap or an encoder keeps its own selection.
      if (ok && autoAdvance && selected.kind === "key" && selected.part === undefined) {
        const next = nextKeyPosition(keyboard, selected.row, selected.col);
        if (next) {
          setSelected({ kind: "key", row: next.row, col: next.col });
        }
      }
    },
    [keyboard, selected, layer, onWriteError, autoAdvance, markModified],
  );

  // Dual-role hold editor writes a fully-rebuilt keycode (Mod-Tap / Layer-Tap /
  // plain tap) straight to the selected cap — no recombination. Choosing 无
  // yields a non-dual-role key, so the hold sub-selection is dropped and the cap
  // falls back to the normal whole-key flow (quick-config reappears).
  const handleHoldWrite = useCallback(
    async (qmkId: string) => {
      if (!keyboard || selected?.kind !== "key") {
        return;
      }
      const { row, col } = selected;
      try {
        await keyboard.setKey(layer, row, col, qmkId);
        markModified();
      } catch (err) {
        onWriteError(err);
      }
      if (!dualRole(qmkId)) {
        setSelected({ kind: "key", row, col });
      }
    },
    [keyboard, selected, layer, onWriteError, markModified],
  );

  // Right-click context menu on the layout preview: write KC_NO / KC_TRNS
  // straight to the clicked cap or encoder, independent of the current selection.
  const handleContextAssign = useCallback(
    async (
      target:
        | { kind: "key"; row: number; col: number }
        | { kind: "encoder"; index: number; direction: 0 | 1 },
      qmkId: string,
    ) => {
      if (!keyboard) {
        return;
      }
      try {
        if (target.kind === "key") {
          await keyboard.setKey(layer, target.row, target.col, qmkId);
        } else {
          await keyboard.setEncoder(layer, target.index, target.direction, qmkId);
        }
        markModified();
      } catch (err) {
        onWriteError(err);
      }
    },
    [keyboard, layer, onWriteError, markModified],
  );

  const handleExport = useCallback(() => {
    if (!keyboard) {
      return;
    }
    const text = serializeVil(keyboard.saveLayout());
    const name = (productName ?? "keyboard").replace(/[\\/:*?"<>|]/g, "_");
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.vil`;
    a.click();
    URL.revokeObjectURL(url);
    track("vil/export");
  }, [keyboard, productName]);

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!keyboard) {
        return;
      }
      try {
        const parsed = parseVil(await file.text());
        if (parsed.uid !== keyboard.uid && !window.confirm(t("importUidMismatch"))) {
          return;
        }
        setImporting(true);
        const report = await keyboard.restoreLayout(parsed);
        track("vil/import");
        const notes: string[] = [t("importWritten", { n: report.written })];
        if (report.unknownKeycodes.length > 0) {
          notes.push(t("importSkippedKeycodes", { list: report.unknownKeycodes.join(", ") }));
        }
        if (parsed.skippedFeatures.length > 0) {
          notes.push(t("importSkippedFeatures", { list: parsed.skippedFeatures.join(", ") }));
        }
        showToast(notes.join(" "), "success");
      } catch (err) {
        showToast(t("importFailed", { error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setImporting(false);
      }
    },
    [keyboard, t, showToast],
  );

  return {
    autoAdvance,
    setAutoAdvance,
    importing,
    justModified,
    handleAssign,
    handleHoldWrite,
    handleContextAssign,
    handleExport,
    handleImportFile,
  };
}
