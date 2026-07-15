import { useI18n } from "../i18n.tsx";

interface Props {
  layers: number;
  active: number;
  onSelect: (layer: number) => void;
}

export function LayerTabs({ layers, active, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <div className="layer-tabs">
      {Array.from({ length: layers }, (_, i) => (
        <button key={i} className={i === active ? "active" : ""} onClick={() => onSelect(i)}>
          {t("layerN", { n: i })}
        </button>
      ))}
    </div>
  );
}
