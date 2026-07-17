import { Icon } from "@iconify/react";
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
    helpKey: "mouseKeyDelayHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_INTERVAL,
    min: 0,
    max: 10000,
    labelKey: "mouseKeyInterval",
    unitKey: "unitMs",
    helpKey: "mouseKeyIntervalHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_STEP_SIZE,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyStepSize",
    unitKey: "unitPx",
    helpKey: "mouseKeyStepSizeHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_MAX_SPEED,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyMaxSpeed",
    unitKey: "unitPx",
    helpKey: "mouseKeyMaxSpeedHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_TIME_TO_MAX,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyTimeToMax",
    unitKey: "unitMs",
    helpKey: "mouseKeyTimeToMaxHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_DELAY,
    min: 0,
    max: 10000,
    labelKey: "mouseKeyWheelDelay",
    unitKey: "unitMs",
    helpKey: "mouseKeyWheelDelayHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_INTERVAL,
    min: 0,
    max: 10000,
    labelKey: "mouseKeyWheelInterval",
    unitKey: "unitMs",
    helpKey: "mouseKeyWheelIntervalHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_MAX_SPEED,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyWheelMaxSpeed",
    unitKey: "unitSteps",
    helpKey: "mouseKeyWheelMaxSpeedHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_TIME_TO_MAX,
    min: 0,
    max: 1000,
    labelKey: "mouseKeyWheelTimeToMax",
    unitKey: "unitMs",
    helpKey: "mouseKeyWheelTimeToMaxHelp",
  },
];

/** Mouse Keys QMK-Settings fields; hidden entirely when the device exposes none of the qsids above. */
export function MouseKeySettings({ keyboard }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="mouseKeySettingsTitle"
      fields={FIELDS}
      icon={<Icon icon="mdi:mouse-outline" className="h-4.5 w-4.5" />}
    />
  );
}

