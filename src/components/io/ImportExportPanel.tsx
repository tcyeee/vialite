import { useRef, type SVGProps } from "react";
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
          icon={<DownloadIcon className="h-4.5 w-4.5" />}
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
              <DownloadIcon className="h-4.5 w-4.5" />
            </button>
          }
        />
        <SettingsRow
          icon={<UploadIcon className="h-4.5 w-4.5" />}
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
              <UploadIcon className="h-4.5 w-4.5" />
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

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5v11.5M7.5 11l4.5 4.5L16.5 11" />
      <path strokeLinecap="round" d="M4.5 17.5v2a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5" />
      <path strokeLinecap="round" d="M4.5 17.5v2a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}
