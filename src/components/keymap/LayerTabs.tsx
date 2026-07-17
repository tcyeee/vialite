import { Fragment, type ReactNode } from "react";
import { useI18n } from "../../contexts/i18n.tsx";

interface Props {
  layers: number;
  active: number;
  onSelect: (layer: number) => void;
  /** Whether a layer has real bindings, so its tab gets a "configured" marker. */
  isConfigured?: (layer: number) => boolean;
  /** Rendered inside the active layer's tab-content box. */
  children: ReactNode;
}

export function LayerTabs({ layers, active, onSelect, isConfigured, children }: Props) {
  const { t } = useI18n();
  return (
    <div role="tablist" className="tabs tabs-lift mb-5">
      {Array.from({ length: layers }, (_, i) => (
        <Fragment key={i}>
          {/* Label-wrapped radio (rather than a bare `input.tab`) so the "edited"
              marker can be a real, secondary-colored dot instead of a glyph baked
              into the tab's ::after label text (which can't be colored separately). */}
          <label role="tab" className="tab gap-1.5" aria-label={t("layerN", { n: i })}>
            <input
              type="radio"
              name="layer_tabs"
              className="sr-only"
              checked={i === active}
              onChange={() => onSelect(i)}
            />
            {isConfigured?.(i) && (
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary" />
            )}
            {t("layerN", { n: i })}
          </label>
          <div className="tab-content bg-base-100 border-base-300 w-fit p-6">
            {i === active && <div className="tab-panel-appear">{children}</div>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
