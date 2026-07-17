import { useRef } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";

interface Props {
  importing: boolean;
  onExport: () => void;
  onImportFile: (file: File) => void;
}

/** Import/export a `.vil` layout file — the standalone 导入导出 page. */
export function ImportExportPanel({ importing, onExport, onImportFile }: Props) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-6">
      <ul className="list rounded-box border border-brand-outline/30">
        <SettingsRow
          icon={<Icon icon="mdi:download" className="h-4.5 w-4.5" />}
          label={t("exportLayout")}
          description={t("exportLayoutDesc")}
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
          description={t("importLayoutDesc")}
          control={
            <button
              type="button"
              className="btn btn-circle btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              aria-label={t("importLayout")}
              title={importing ? t("importing") : t("importLayout")}
            >
              <Icon icon="mdi:upload" className="h-4.5 w-4.5" />
            </button>
          }
        />
        <input
          ref={fileInputRef}
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
    </div>
  );
}

