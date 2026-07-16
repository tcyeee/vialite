import type { SVGProps } from "react";
import { QMK_SETTINGS_QSID_GRAVE_ESCAPE, type Keyboard } from "../../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
}

/** vial-gui's qmk_settings.json "Grave Escape" tab (qsid 1, one bit per toggle). */
const FIELDS: QmkSettingField[] = [
  { type: "boolean", qsid: QMK_SETTINGS_QSID_GRAVE_ESCAPE, bit: 0, labelKey: "graveEscapeAlt" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_GRAVE_ESCAPE, bit: 1, labelKey: "graveEscapeControl" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_GRAVE_ESCAPE, bit: 2, labelKey: "graveEscapeGui" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_GRAVE_ESCAPE, bit: 3, labelKey: "graveEscapeShift" },
];

/** Grave Escape QMK-Settings toggles; hidden entirely when the device doesn't expose qsid 1. */
export function GraveEscapeSettings({ keyboard }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="graveEscapeSettingsTitle"
      fields={FIELDS}
      icon={<GraveEscapeIcon className="h-4.5 w-4.5" />}
    />
  );
}

function GraveEscapeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9.5 6.5 11l1.5 1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 10.5 13.5 12.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5 15.5 12.5" />
    </svg>
  );
}
