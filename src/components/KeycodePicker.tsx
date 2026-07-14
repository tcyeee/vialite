import { KEYCODE_CATEGORIES } from "../protocol/keycodes.ts";

interface Props {
  onPick: (qmkId: string) => void;
  onClose: () => void;
}

export function KeycodePicker({ onPick, onClose }: Props) {
  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        {KEYCODE_CATEGORIES.map((category) => (
          <section key={category.name}>
            <h4>{category.name}</h4>
            <div className="picker-grid">
              {category.entries.map((entry) => (
                <button key={entry.qmkId} title={entry.qmkId} onClick={() => onPick(entry.qmkId)}>
                  {entry.label || entry.qmkId}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
