import { useI18n } from "../../contexts/i18n.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { LayoutOptions } from "./LayoutOptions.tsx";

interface Props {
  keyboard: Keyboard;
  /** Called after a layout option was written to the device, so the parent re-renders. */
  onChange: () => void;
}

/** Standalone 布局配置 page — the physical-layout switches from vial.json `layouts.labels`. */
export function LayoutConfigPanel({ keyboard, onChange }: Props) {
  const { t } = useI18n();
  const hasLayoutOptions = !!keyboard.layoutLabels && keyboard.layoutLabels.length > 0 && keyboard.layoutOptions >= 0;

  return (
    <div className="flex flex-col gap-6">
      {hasLayoutOptions ? (
        <LayoutOptions keyboard={keyboard} onChange={onChange} />
      ) : (
        <p className="text-sm text-brand-on-surface-variant">{t("layoutConfigEmpty")}</p>
      )}
    </div>
  );
}
