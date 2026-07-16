import type { SVGProps } from "react";
import {
  QMK_SETTINGS_QSID_MOUSEKEY_DELAY,
  QMK_SETTINGS_QSID_MOUSEKEY_INTERVAL,
  QMK_SETTINGS_QSID_MOUSEKEY_MAX_SPEED,
  QMK_SETTINGS_QSID_MOUSEKEY_STEP_SIZE,
  QMK_SETTINGS_QSID_MOUSEKEY_TIME_TO_MAX,
  QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_DELAY,
  QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_INTERVAL,
  QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_MAX_SPEED,
  QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_TIME_TO_MAX,
  type Keyboard,
} from "../../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
}

/** vial-gui's qmk_settings.json "Mouse keys" tab (qsid 9-17, all plain integers). */
const FIELDS: QmkSettingField[] = [
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_DELAY,
    min: 0,
    max: 10000,
    labelKey: "mouseKeyDelay",
    unitKey: "unitMs",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_INTERVAL,
    min: 0,
    max: 10000,
    labelKey: "mouseKeyInterval",
    unitKey: "unitMs",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_STEP_SIZE,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyStepSize",
    unitKey: "unitPx",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_MAX_SPEED,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyMaxSpeed",
    unitKey: "unitPx",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_TIME_TO_MAX,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyTimeToMax",
    unitKey: "unitMs",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_DELAY,
    min: 0,
    max: 10000,
    labelKey: "mouseKeyWheelDelay",
    unitKey: "unitMs",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_INTERVAL,
    min: 0,
    max: 10000,
    labelKey: "mouseKeyWheelInterval",
    unitKey: "unitMs",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_MAX_SPEED,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyWheelMaxSpeed",
    unitKey: "unitSteps",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_TIME_TO_MAX,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyWheelTimeToMax",
    unitKey: "unitMs",
  },
];

/** Mouse Keys QMK-Settings fields; hidden entirely when the device exposes none of the qsids above. */
export function MouseKeySettings({ keyboard }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="mouseKeySettingsTitle"
      fields={FIELDS}
      icon={<MouseKeyIcon className="h-4.5 w-4.5" />}
    />
  );
}

function MouseKeyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="7.5" y="3.5" width="9" height="17" rx="4.5" />
      <path strokeLinecap="round" d="M12 3.5v6" />
    </svg>
  );
}
