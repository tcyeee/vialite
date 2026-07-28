import { useRef } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../../contexts/i18n.tsx";
import { SettingsRow } from "../../qmk/QmkSettingsPanel.tsx";
import { ALWAYS_ENABLED_ATTR } from "./quickConfigData.ts";

interface Props {
  /** "自动选取下一个": whether assigning a key auto-advances the selection. */
  autoAdvance: boolean;
  onAutoAdvanceChange: (value: boolean) => void;
  /** True while a `.vil` import write is in flight — disables both export/import buttons. */
  importing: boolean;
  onExport: () => void;
  onImportFile: (file: File) => void;
  /** "配置键盘颜色": opens the 个性化 page via the same hero View Transition NewHomePage uses. */
  onOpenPersonalization: (origin: Element) => void;
}

/**
 * Basic tab's "配置设置" block (自动选取下一个 / 导入导出). Panel-level settings,
 * unrelated to whether a key is currently selected, so it carries
 * {@link ALWAYS_ENABLED_ATTR} and is never dimmed/disabled by the parent
 * `QuickConfigPanel` the way the keycode cards are.
 */
export function ConfigSettingsSection({
  autoAdvance,
  onAutoAdvanceChange,
  importing,
  onExport,
  onImportFile,
  onOpenPersonalization,
}: Props) {
  const { t } = useI18n();
  const importFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="flex shrink-0 flex-col items-start" {...{ [ALWAYS_ENABLED_ATTR]: "" }}>
      <h4 className="mb-2 text-sm font-semibold opacity-70">{t("groupConfigSettings")}</h4>
      {/* Same grouped-`list` look as the 个性化 / 网站设置 pages, so a setting
          reads identically wherever it surfaces. Deliberately narrow (not
          `max-w-md`/`w-full`): this section now sits as the last column
          alongside 特殊按键区域's other columns on the same row, so its width
          should stay as small as the content allows rather than stretching. */}
      <ul className="list w-64 rounded-box border border-brand-outline/30">
        <SettingsRow
          icon={<Icon icon="mdi:palette-outline" className="h-4.5 w-4.5" />}
          label={t("configKeyboardColor")}
          labelClassName="whitespace-nowrap"
          control={
            <button
              type="button"
              className="btn btn-circle btn-ghost"
              onClick={(e) => onOpenPersonalization(e.currentTarget)}
              aria-label={t("configKeyboardColor")}
            >
              <Icon icon="mdi:chevron-right" className="h-4.5 w-4.5" />
            </button>
          }
        />
        <SettingsRow
          icon={<Icon icon="mdi:cursor-default-click-outline" className="h-4.5 w-4.5" />}
          label={t("autoAdvance")}
          labelClassName="whitespace-nowrap"
          help={t("autoAdvanceHelp")}
          control={
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={autoAdvance}
              onChange={(e) => onAutoAdvanceChange(e.target.checked)}
              aria-label={t("autoAdvance")}
            />
          }
        />
        <SettingsRow
          icon={<Icon icon="mdi:download" className="h-4.5 w-4.5" />}
          label={t("exportLayout")}
          labelClassName="whitespace-nowrap"
          control={
            <button
              type="button"
              className="btn btn-circle btn-ghost"
              onClick={onExport}
              disabled={importing}
              aria-label={t("exportLayout")}
            >
              <Icon icon="mdi:download" className="h-4.5 w-4.5" />
            </button>
          }
        />
        <SettingsRow
          icon={<Icon icon="mdi:upload" className="h-4.5 w-4.5" />}
          label={t("importLayout")}
          labelClassName="whitespace-nowrap"
          control={
            <button
              type="button"
              className="btn btn-circle btn-ghost"
              onClick={() => importFileInputRef.current?.click()}
              disabled={importing}
              aria-label={t("importLayout")}
              title={importing ? t("importing") : t("importLayout")}
            >
              <Icon icon="mdi:upload" className="h-4.5 w-4.5" />
            </button>
          }
        />
        <input
          ref={importFileInputRef}
          type="file"
          accept=".vil,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) {
              onImportFile(file);
            }
          }}
        />
      </ul>
    </section>
  );
}
