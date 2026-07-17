import { Icon } from "@iconify/react";
import { QMK_SETTINGS_QSID_GRAVE_ESCAPE, type Keyboard } from "../../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
}

/** vial-gui's qmk_settings.json "Grave Escape" tab (qsid 1, one bit per toggle). */
const FIELDS: QmkSettingField[] = [
  { type: "boolean", qsid: QMK_SETTINGS_QSID_GRAVE_ESCAPE, bit: 0, labelKey: "graveEscapeAlt", helpKey: "graveEscapeAltHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_GRAVE_ESCAPE, bit: 1, labelKey: "graveEscapeControl", helpKey: "graveEscapeControlHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_GRAVE_ESCAPE, bit: 2, labelKey: "graveEscapeGui", helpKey: "graveEscapeGuiHelp" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_GRAVE_ESCAPE, bit: 3, labelKey: "graveEscapeShift", helpKey: "graveEscapeShiftHelp" },
];

/** Grave Escape QMK-Settings toggles; hidden entirely when the device doesn't expose qsid 1. */
export function GraveEscapeSettings({ keyboard }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="graveEscapeSettingsTitle"
      fields={FIELDS}
      icon={<Icon icon="mdi:keyboard-esc" className="h-4.5 w-4.5" />}
    />
  );
}

