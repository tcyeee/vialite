// Live controls for the 3D preview's tunable constants. Debug-only surface on
// the Beta page: rows are labelled with the source constant name rather than a
// translated phrase, and "Copy as code" emits declarations ready to paste back
// into KeyboardLayout3D.tsx once a value looks right.
import { useState } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import {
  DEFAULT_PREVIEW_3D_PARAMS,
  PREVIEW_3D_GROUPS,
  formatAsConstants,
  type Preview3DParams,
} from "./preview3dParams.ts";

interface Props {
  params: Preview3DParams;
  onChange: (params: Preview3DParams) => void;
}

export function Preview3DDebugPanel({ params, onChange }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof Preview3DParams>(key: K, value: Preview3DParams[K]) =>
    onChange({ ...params, [key]: value });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatAsConstants(params));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the panel still shows the live values.
    }
  };

  return (
    <section className="mt-6 rounded-2xl bg-brand-surface-container-highest/40 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-brand-on-surface">{t("preview3dParams")}</h2>
        <HelpIcon text={t("preview3dParamsHint")} />
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(DEFAULT_PREVIEW_3D_PARAMS)}>
            <Icon icon="mdi:restore" className="h-4 w-4" />
            {t("preview3dReset")}
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={copy}>
            <Icon icon={copied ? "mdi:check" : "mdi:content-copy"} className="h-4 w-4" />
            {copied ? t("preview3dCopied") : t("preview3dCopy")}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {PREVIEW_3D_GROUPS.map((group) => (
          <div key={group.titleKey} className="min-w-0">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-on-surface-variant">
              {t(group.titleKey)}
            </h3>
            <div className="flex flex-col gap-3">
              {group.sliders.map(({ key, constant, min, max, step, hint }) => (
                <label key={key} className="block" title={hint}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate font-mono text-xs text-brand-on-surface-variant">{constant}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-brand-on-surface">
                      {params[key].toFixed(3)}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="range range-xs"
                    min={min}
                    max={max}
                    step={step}
                    value={params[key]}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                </label>
              ))}
              {group.colors.map(({ key, constant }) => (
                <label key={key} className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-brand-on-surface-variant">{constant}</span>
                  <input
                    type="color"
                    className="h-7 w-12 shrink-0 cursor-pointer rounded border-none bg-transparent p-0"
                    value={params[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
