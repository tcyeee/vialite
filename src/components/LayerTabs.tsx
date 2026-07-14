interface Props {
  layers: number;
  active: number;
  onSelect: (layer: number) => void;
}

export function LayerTabs({ layers, active, onSelect }: Props) {
  return (
    <div className="layer-tabs">
      {Array.from({ length: layers }, (_, i) => (
        <button key={i} className={i === active ? "active" : ""} onClick={() => onSelect(i)}>
          Layer {i}
        </button>
      ))}
    </div>
  );
}
