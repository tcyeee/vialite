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
          <input
            type="radio"
            name="layer_tabs"
            role="tab"
            className="tab"
            aria-label={`${isConfigured?.(i) ? "● " : ""}${t("layerN", { n: i })}`}
            checked={i === active}
            onChange={() => onSelect(i)}
          />
          <div className="tab-content bg-base-100 border-base-300 w-fit p-6">{i === active && children}</div>
        </Fragment>
      ))}
    </div>
  );
}
