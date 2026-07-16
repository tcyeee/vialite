import type { SVGProps } from "react";
import { useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { KeyboardLayoutPreview, type PreviewSize } from "../keymap/KeyboardLayoutPreview.tsx";

const SIZE_KEY = "vialite-color-preview-size";
const SIZES: PreviewSize[] = ["s", "m", "l", "xl"];

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

/**
 * 键盘配色 (Keyboard Color) page. For now a display-only preview of the physical
 * layout read from the connected board — no per-key color action wired up yet.
 * The display-size range only scales the preview.
 */
export function KeyboardColorPanel({ keyboard }: { keyboard: Keyboard }) {
  const { t } = useI18n();
  const [size, setSize] = useState<PreviewSize>(readStoredSize);

  const onSizeChange = (index: number) => {
    const next = SIZES[index];
    setSize(next);
    try {
      window.localStorage.setItem(SIZE_KEY, next);
    } catch {
      // Non-persistent is fine.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <span className="shrink-0 text-sm font-medium text-brand-on-surface-variant">{t("displaySizeTitle")}</span>
        <div className="flex w-full max-w-xs items-center gap-2 text-brand-on-surface-variant">
          <MinusIcon className="h-4 w-4 shrink-0" />
          <input
            type="range"
            min={0}
            max={SIZES.length - 1}
            step={1}
            value={SIZES.indexOf(size)}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="range range-primary range-sm"
            aria-label={t("displaySizeTitle")}
          />
          <PlusIcon className="h-4 w-4 shrink-0" />
        </div>
      </div>

      <p className="text-sm text-brand-on-surface-variant">{t("siteColorDesc")}</p>
      <div className="overflow-x-auto rounded-box border border-brand-outline/30 p-4">
        <KeyboardLayoutPreview keyboard={keyboard} size={size} />
      </div>
    </div>
  );
}

function MinusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" d="M5 12h14" />
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}
