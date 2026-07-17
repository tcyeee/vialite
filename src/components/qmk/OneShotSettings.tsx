import { Icon } from "@iconify/react";
import { QMK_SETTINGS_QSID_ONESHOT_TAP_TOGGLE, QMK_SETTINGS_QSID_ONESHOT_TIMEOUT, type Keyboard } from "../../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
}

/** vial-gui's qmk_settings.json "One Shot Keys" tab (qsid 5 tap-toggle count, qsid 6 timeout in ms). */
const FIELDS: QmkSettingField[] = [
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_ONESHOT_TAP_TOGGLE,
    min: 0,
    max: 50,
    labelKey: "oneShotTapToggle",
    unitKey: "unitTaps",
    helpKey: "oneShotTapToggleHelp",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_ONESHOT_TIMEOUT,
    min: 0,
    max: 60000,
    labelKey: "oneShotTimeoutMs",
    unitKey: "unitMs",
    helpKey: "oneShotTimeoutMsHelp",
  },
];

/** One Shot Keys QMK-Settings fields; hidden entirely when the device exposes neither qsid. */
export function OneShotSettings({ keyboard }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="oneShotSettingsTitle"
      fields={FIELDS}
      icon={<Icon icon="mdi:numeric-1-circle-outline" className="h-4.5 w-4.5" />}
    />
  );
}

