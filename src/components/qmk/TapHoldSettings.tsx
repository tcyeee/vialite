import type { SVGProps } from "react";
import {
  QMK_SETTINGS_QSID_CHORDAL_HOLD,
  QMK_SETTINGS_QSID_FLOW_TAP,
  QMK_SETTINGS_QSID_HOLD_ON_OTHER_KEY_PRESS,
  QMK_SETTINGS_QSID_PERMISSIVE_HOLD,
  QMK_SETTINGS_QSID_QUICK_TAP_TERM,
  QMK_SETTINGS_QSID_RETRO_TAPPING,
  QMK_SETTINGS_QSID_TAP_CODE_DELAY,
  QMK_SETTINGS_QSID_TAP_HOLD_CAPS_DELAY,
  QMK_SETTINGS_QSID_TAP_HOLD_FLAGS,
  QMK_SETTINGS_QSID_TAPPING_TERM,
  QMK_SETTINGS_QSID_TAPPING_TOGGLE,
  type Keyboard,
} from "../../protocol/keyboard.ts";
import { QmkSettingsSection, type QmkSettingField } from "./QmkSettingsPanel.tsx";

interface Props {
  keyboard: Keyboard;
}

/**
 * vial-gui's qmk_settings.json "Tap-Hold" tab. Spans several qsids: 7/8 are
 * the older combined tapping-term/flags pair, 18-20 are QMK's generic
 * tap/hold delay knobs, and 22-27 are the newer per-feature qsids that
 * superseded qsid 8's bitfield on recent vial-qmk — upstream lists both
 * generations under the same tab (with duplicate titles), and only the
 * qsids the connected firmware actually reports end up rendered.
 */
const FIELDS: QmkSettingField[] = [
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_TAPPING_TERM,
    min: 0,
    max: 10000,
    labelKey: "tapHoldTappingTerm",
    unitKey: "unitMs",
  },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_TAP_HOLD_FLAGS, bit: 0, labelKey: "tapHoldPermissiveHold" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_TAP_HOLD_FLAGS, bit: 1, labelKey: "tapHoldIgnoreModTapInterrupt" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_TAP_HOLD_FLAGS, bit: 2, labelKey: "tapHoldTappingForceHold" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_TAP_HOLD_FLAGS, bit: 3, labelKey: "tapHoldRetroTapping" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_PERMISSIVE_HOLD, bit: 0, labelKey: "tapHoldPermissiveHold" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_HOLD_ON_OTHER_KEY_PRESS, bit: 0, labelKey: "tapHoldHoldOnOtherKeyPress" },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_RETRO_TAPPING, bit: 0, labelKey: "tapHoldRetroTapping" },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_QUICK_TAP_TERM,
    min: 0,
    max: 10000,
    labelKey: "tapHoldQuickTapTerm",
    unitKey: "unitMs",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_TAP_CODE_DELAY,
    min: 0,
    max: 1000,
    labelKey: "tapHoldTapCodeDelay",
    unitKey: "unitMs",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_TAP_HOLD_CAPS_DELAY,
    min: 0,
    max: 1000,
    labelKey: "tapHoldTapHoldCapsDelay",
    unitKey: "unitMs",
  },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_TAPPING_TOGGLE,
    min: 0,
    max: 100,
    labelKey: "tapHoldTappingToggle",
    unitKey: "unitTaps",
  },
  { type: "boolean", qsid: QMK_SETTINGS_QSID_CHORDAL_HOLD, bit: 0, labelKey: "tapHoldChordalHold" },
  {
    type: "integer",
    qsid: QMK_SETTINGS_QSID_FLOW_TAP,
    min: 0,
    max: 10000,
    labelKey: "tapHoldFlowTap",
    unitKey: "unitMs",
  },
];

/** Tap-Hold QMK-Settings fields; hidden entirely when the device exposes none of the qsids above. */
export function TapHoldSettings({ keyboard }: Props) {
  return (
    <QmkSettingsSection
      keyboard={keyboard}
      titleKey="tapHoldSettingsTitle"
      fields={FIELDS}
      icon={<TapHoldIcon className="h-4.5 w-4.5" />}
    />
  );
}

function TapHoldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="8" cy="12" r="3" />
      <path strokeLinecap="round" d="M14.5 9.5h5M14.5 14.5h3.5" />
    </svg>
  );
}
