import { type ReactNode } from "react";
import { Icon } from "@iconify/react";
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
    <div className="mb-5">
      {/* daisyUI `tabs-lift` lays tabs out with `flex-wrap: wrap`, which breaks the
          lifted folder look when there are many layers and the page is narrow: the
          wrapped rows each draw their own baseline underline and only the last row
          connects to the content box. We force a single, horizontally-scrollable row
          instead (`flex-nowrap overflow-x-auto`). The active-tab styling still works
          via `label:has(:checked)`; we only give up daisyUI's `:checked + .tab-content`
          toggle — React already renders just the active layer's content below. */}
      <div role="tablist" className="tabs tabs-lift flex-nowrap overflow-x-auto">
        {Array.from({ length: layers }, (_, i) => {
          const configured = isConfigured?.(i) ?? false;
          // Give inactive-but-configured tabs a translucent secondary fill so
          // they read as "has bindings" at a glance without competing with the
          // active tab. The active tab keeps daisyUI's lifted-folder styling.
          const markConfigured = configured && i !== active;
          return (
          // Label-wrapped radio (rather than a bare `input.tab`) so the "edited"
          // marker can be a real, secondary-colored dot instead of a glyph baked
          // into the tab's ::after label text (which can't be colored separately).
          <label
            key={i}
            role="tab"
            aria-selected={i === active}
            // shrink-0: flex items still shrink in a nowrap container, which would
            // squash the tabs and wrap their labels mid-word instead of scrolling.
            className="tab shrink-0 gap-1.5 relative isolate"
            title={t("layerN", { n: i })}
            aria-label={t("layerN", { n: i })}
          >
            {/* Inset translucent fill (inset-1 pulls it in from the tab edges so
                it doesn't touch the neighbouring tabs / the lifted baseline). */}
            {markConfigured && (
              <span
                aria-hidden="true"
                className="absolute inset-1 -z-10 rounded-md bg-brand-secondary/15"
              />
            )}
            <input
              type="radio"
              name="layer_tabs"
              className="sr-only"
              checked={i === active}
              onChange={() => onSelect(i)}
            />
            {configured && (
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary" />
            )}
            <Icon icon="mdi:layers" aria-hidden="true" />
            {i}
          </label>
          );
        })}
      </div>
      {/* Content box, decoupled from the scrolling strip above. The daisyUI classes
          (`-mt-px` overlap, top-left-square rounding) reproduce what
          `.tabs-lift > .tab-content` gave when the box was an interleaved sibling. */}
      <div className="-mt-px w-fit rounded-box rounded-tl-none border border-base-300 bg-base-100 p-6">
        {/* Keyed on the active layer so switching tabs remounts the panel and
            re-fires the appear animation (see .tab-panel-appear in index.css),
            which the old one-tab-content-per-layer markup got for free. */}
        <div key={active} className="tab-panel-appear">
          {children}
        </div>
      </div>
    </div>
  );
}
