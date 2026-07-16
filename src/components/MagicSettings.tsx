import type { SVGProps } from "react";
import { QMK_SETTINGS_QSID_MAGIC, type Keyboard } from "../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
  /** Called after a setting was written to the device, so the parent re-renders. */
  onChange: () => void;
}

/** vial-gui's qmk_settings.json "Magic" tab (qsid 21, one bit per toggle). */
const FIELDS: QmkSettingField[] = [
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 0, labelKey: "magicSwapCapsLockControl" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 1, labelKey: "magicCapsLockAsControl" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 2, labelKey: "magicSwapLaltLgui" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 3, labelKey: "magicSwapRaltRgui" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 4, labelKey: "magicDisableGui" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 5, labelKey: "magicSwapGraveEsc" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 6, labelKey: "magicSwapBackslashBackspace" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 7, labelKey: "magicNkro" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 8, labelKey: "magicSwapLctlLgui" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 9, labelKey: "magicSwapRctlRgui" },
];

/** Magic QMK-Settings toggles; hidden entirely when the device doesn't expose qsid 21. */
export function MagicSettings({ keyboard, onChange }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="magicSettingsTitle"
      fields={FIELDS}
      icon={<MagicIcon className="h-4.5 w-4.5" />}
      onChange={onChange}
    />
  );
}

function MagicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 13.6 8.4 18.5 10 13.6 11.6 12 16.5 10.4 11.6 5.5 10 10.4 8.4Z" />
      <path strokeLinecap="round" d="M18.5 15.5v3M17 17h3" />
    </svg>
  );
}
