import { useI18n } from "../i18n.tsx";

interface Props {
  layers: number;
  active: number;
  onSelect: (layer: number) => void;
}

export function LayerTabs({ layers, active, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <div role="tablist" className="tabs tabs-lift mb-5">
      {Array.from({ length: layers }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          className={i === active ? "tab tab-active" : "tab bg-transparent"}
          onClick={() => onSelect(i)}
        >
          {t("layerN", { n: i })}
        </button>
      ))}
    </div>
  );
}
