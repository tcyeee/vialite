import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import type { KeycapPaletteColor } from "../../contexts/previewAppearance.tsx";
import { ColorPicker } from "../common/ColorPicker.tsx";

/** Starting hex for a freshly-added palette color — the user recolors it via its own edit swatch right after. */
const DEFAULT_NEW_COLOR = "#4f9e5a";

/**
 * 颜色管理区 (color management area): replaces every other 个性化 settings
 * section while open — see `KeyboardColorPanel`'s `coloringMode`. Lets the
 * user add/edit/delete palette colors and pick one as the active paint
 * brush, which `KeyboardColorPanel` then feeds into the pinned board's
 * `KeyboardLayoutPreview` via its `paint` prop so clicking a keycap there
 * assigns the selected color (see 键帽上色).
 */
export function KeycapColorManager({
  palette,
  activeBrush,
  onSelectBrush,
  onAddColor,
  onEditColor,
  onDeleteColor,
  onCancel,
}: {
  palette: KeycapPaletteColor[];
  activeBrush: string | "eraser" | null;
  onSelectBrush: (brush: string | "eraser" | null) => void;
  onAddColor: (hex: string) => void;
  onEditColor: (id: string, hex: string) => void;
  onDeleteColor: (id: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-on-surface-variant">
          {t("keycapColorManagerTitle")}
        </h2>
        <button type="button" className="btn btn-sm btn-outline" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
      <p className="mb-3 text-xs text-brand-on-surface-variant/70">
        {t("keycapColorManagerHint")}
      </p>
      <div className="flex flex-col gap-2 rounded-box border border-brand-outline/30 p-3">
        {palette.map((color) => (
          <PaletteRow
            key={color.id}
            color={color}
            selected={activeBrush === color.id}
            onSelect={() => onSelectBrush(activeBrush === color.id ? null : color.id)}
            onEdit={(hex) => onEditColor(color.id, hex)}
            onDelete={() => onDeleteColor(color.id)}
          />
        ))}
        {palette.length === 0 && (
          <p className="text-xs text-brand-on-surface-variant/60">{t("keycapColorNone")}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            className={
              "btn btn-sm gap-2" + (activeBrush === "eraser" ? " btn-primary" : " btn-outline")
            }
            onClick={() => onSelectBrush(activeBrush === "eraser" ? null : "eraser")}
          >
            <Icon icon="mdi:eraser" className="h-4 w-4" />
            {t("keycapColorEraser")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline gap-2"
            onClick={() => onAddColor(DEFAULT_NEW_COLOR)}
          >
            <Icon icon="mdi:plus" className="h-4 w-4" />
            {t("keycapColorAdd")}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * One palette entry: a circular swatch selects it as the active brush (ring
 * highlight while selected), the rectangular `ColorPicker` next to it edits
 * its hex in place — retroactively recoloring every key already painted
 * with it, since keys store this row's id, not a raw hex (see
 * `previewAppearance.tsx`'s `updateKeycapColor`) — and the trash button
 * removes it entirely.
 */
function PaletteRow({
  color,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  color: KeycapPaletteColor;
  selected: boolean;
  onSelect: () => void;
  onEdit: (hex: string) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        className={
          "h-8 w-8 shrink-0 rounded-full border-2 " +
          (selected ? "border-brand-on-surface" : "border-brand-outline/40")
        }
        style={{ backgroundColor: color.hex }}
        title={color.hex}
        aria-label={color.hex}
        aria-pressed={selected}
      />
      <ColorPicker value={color.hex} onChange={onEdit} label={t("edit")} />
      <span className="font-mono text-xs uppercase text-brand-on-surface-variant/70">
        {color.hex}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm ml-auto px-1.5"
        title={t("delete")}
        onClick={onDelete}
      >
        <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
      </button>
    </div>
  );
}
