import { Icon } from "@iconify/react";
import { QMK_SETTINGS_QSID_COMBO_TERM, type Keyboard } from "../../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
}

/** vial-gui's qmk_settings.json "Combo" tab (qsid 2, combo timeout in ms). */
const FIELDS: QmkSettingField[] = [
  { type: "integer", qsid: QMK_SETTINGS_QSID_COMBO_TERM, min: 0, max: 10000, labelKey: "comboTermMs", unitKey: "unitMs", helpKey: "comboTermMsHelp" },
];

/** Combo timeout QMK-Settings field; hidden entirely when the device doesn't expose qsid 2. */
export function ComboSettings({ keyboard }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="comboSettingsTitle"
      fields={FIELDS}
      icon={<Icon icon="mdi:vector-combine" className="h-4.5 w-4.5" />}
    />
  );
}

