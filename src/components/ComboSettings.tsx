import type { SVGProps } from "react";
import { QMK_SETTINGS_QSID_COMBO_TERM, type Keyboard } from "../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
  /** Called after a setting was written to the device, so the parent re-renders. */
  onChange: () => void;
}

/** vial-gui's qmk_settings.json "Combo" tab (qsid 2, combo timeout in ms). */
const FIELDS: QmkSettingField[] = [
  { type: "integer", qsid: QMK_SETTINGS_QSID_COMBO_TERM, min: 0, max: 10000, labelKey: "comboTermMs" },
];

/** Combo timeout QMK-Settings field; hidden entirely when the device doesn't expose qsid 2. */
export function ComboSettings({ keyboard, onChange }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="comboSettingsTitle"
      fields={FIELDS}
      icon={<ComboIcon className="h-4.5 w-4.5" />}
      onChange={onChange}
    />
  );
}

function ComboIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="8.5" cy="12" r="3" />
      <circle cx="15.5" cy="12" r="3" />
    </svg>
  );
}
