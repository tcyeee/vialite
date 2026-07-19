import { type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { usePersistedBoolean } from "../../hooks/usePersistedBoolean.ts";

interface BarProps {
  layers: number;
  active: number;
  onSelect: (layer: number) => void;
  /** Whether a layer has real bindings, so its tab gets a "configured" marker. */
  isConfigured?: (layer: number) => boolean;
  /** Extra classes for the tab-bar grid (defaults to `mb-3` when standalone). */
  className?: string;
}

interface Props extends Omit<BarProps, "className"> {
  /** Rendered inside the active layer's tab-content box. */
  children: ReactNode;
}

/**
 * Just the row of layer buttons (+ the show-all/show-used collapse toggle),
 * without any content box. Extracted from {@link LayerTabs} so a caller can
 * place the board separately from the tabs — the 键盘配色 page pins the board
 * sticky while these buttons scroll away with the rest of the page.
 */
export function LayerTabBar({
  layers,
  active,
  onSelect,
  isConfigured,
  className = "mb-3",
}: BarProps) {
  const { t } = useI18n();
  // Collapsed state persists across reloads (shared by every instance).
  const [collapsed, setCollapsed] = usePersistedBoolean("vialite-layer-tabs-collapsed");
  return (
    // Wrapping grid so boards with many layers flow into multiple rows instead
    // of a single horizontal-scroll strip. `auto-fill` keeps a consistent cell
    // width and packs as many columns per row as the container allows.
    <div
      role="tablist"
      aria-label={t("layers")}
      className={`grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(4.5rem,1fr))] ${className}`}
    >
      {Array.from({ length: layers }, (_, i) => {
        const configured = isConfigured?.(i) ?? false;
        const isActive = i === active;
        // When collapsed, only surface configured layers, keeping the active
        // layer visible so the selection always stays represented.
        if (collapsed && !configured && !isActive) return null;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            data-active={isActive}
            aria-selected={isActive}
            onClick={() => onSelect(i)}
            className={`btn btn-sm relative isolate justify-start gap-1.5 ${
              isActive ? "btn-primary" : "btn-outline border-base-300"
            }`}
            title={t("layerN", { n: i })}
            aria-label={t("layerN", { n: i })}
          >
            {/* Inset translucent fill marking inactive-but-configured layers. */}
            {configured && !isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-[inherit] bg-brand-secondary/15"
              />
            )}
            <Icon icon="mdi:layers" aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{i}</span>
            {configured && !isActive && (
              <span className="ml-auto inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary" />
            )}
          </button>
        );
      })}
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-square text-brand-on-surface-variant"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("layerShowAll") : t("layerShowUsed")}
        title={collapsed ? t("layerShowAll") : t("layerShowUsed")}
      >
        <Icon
          icon={collapsed ? "mdi:dots-horizontal" : "mdi:chevron-double-left"}
          className="h-5 w-5 shrink-0"
        />
      </button>
    </div>
  );
}

export function LayerTabs({ layers, active, onSelect, isConfigured, children }: Props) {
  return (
    <div className="mb-5">
      <LayerTabBar
        layers={layers}
        active={active}
        onSelect={onSelect}
        isConfigured={isConfigured}
      />
      {/* No border/card frame — the board shows directly. Keyed on the active
          layer so switching tabs remounts the panel and re-fires the appear
          animation (see .tab-panel-appear in index.css).
          `w-full` (not `w-fit`) matters: the board's overflow-x-auto viewport
          lives inside here, and auto-fit measures that viewport's width. A
          shrink-to-fit panel would size itself to the board, so the measurement
          would just echo the board's own width and never shrink it — and the
          viewport would never scroll either. */}
      <div key={active} className="tab-panel-appear w-full">
        {children}
      </div>
    </div>
  );
}
