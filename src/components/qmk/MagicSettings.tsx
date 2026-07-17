import { Icon } from "@iconify/react";
import { QMK_SETTINGS_QSID_MAGIC, type Keyboard } from "../../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
}

/** vial-gui's qmk_settings.json "Magic" tab (qsid 21, one bit per toggle). */
const FIELDS: QmkSettingField[] = [
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 0, labelKey: "magicSwapCapsLockControl", helpKey: "magicSwapCapsLockControlHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 1, labelKey: "magicCapsLockAsControl", helpKey: "magicCapsLockAsControlHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 2, labelKey: "magicSwapLaltLgui", helpKey: "magicSwapLaltLguiHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 3, labelKey: "magicSwapRaltRgui", helpKey: "magicSwapRaltRguiHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 4, labelKey: "magicDisableGui", helpKey: "magicDisableGuiHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 5, labelKey: "magicSwapGraveEsc", helpKey: "magicSwapGraveEscHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 6, labelKey: "magicSwapBackslashBackspace", helpKey: "magicSwapBackslashBackspaceHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 7, labelKey: "magicNkro", helpKey: "magicNkroHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 8, labelKey: "magicSwapLctlLgui", helpKey: "magicSwapLctlLguiHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_MAGIC, bit: 9, labelKey: "magicSwapRctlRgui", helpKey: "magicSwapRctlRguiHelp" },
];

/** Magic QMK-Settings toggles; hidden entirely when the device doesn't expose qsid 21. */
export function MagicSettings({ keyboard }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="magicSettingsTitle"
      fields={FIELDS}
      icon={<Icon icon="mdi:auto-fix" className="h-4.5 w-4.5" />}
    />
  );
}

