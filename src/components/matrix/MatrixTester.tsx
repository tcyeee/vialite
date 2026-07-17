// Switch matrix tester, ported from vial-gui's editor/matrix_test.py.
// Requires the keyboard to be unlocked (the firmware refuses to report matrix
// state otherwise, to prevent a web page from keylogging).
//
// Unlike vial-gui (which leaves the board unlocked and offers Security->Lock),
// nothing else in Vialite needs the unlocked state, so we re-lock on exit.

import { useEffect, useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { UnlockDialog } from "../common/UnlockDialog.tsx";
import { track } from "../../analytics.ts";

const UNIT = 54; // same scale as KeyboardLayout

const POLL_INTERVAL_MS = 50;

interface Props {
  keyboard: Keyboard;
}

export function MatrixTester({ keyboard }: Props) {
  const { t } = useI18n();
  // null = still checking the lock state
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [dialogDismissed, setDialogDismissed] = useState(false);
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [tested, setTested] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    keyboard
      .getUnlockStatus()
      .then((status) => {
        if (!cancelled) {
          setUnlocked(status.unlocked);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [keyboard]);

  useEffect(() => {
    if (!unlocked) {
      return;
    }
    track("matrix/test");
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        try {
          const state = await keyboard.getMatrixState();
          if (cancelled) {
            return;
          }
          setPressed(state);
          if (state.size > 0) {
            setTested((prev) => {
              const next = new Set(prev);
              for (const pos of state) {
                next.add(pos);
              }
              return next;
            });
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    };
    void loop();

    return () => {
      cancelled = true;
      // Nothing else in the app needs the unlocked state; don't leave the
      // keyboard silently unlocked when the user navigates away.
      keyboard.lock().catch(() => {});
    };
  }, [keyboard, unlocked]);

  if (error) {
    return <p className="error">{t("matrixStopped", { error })}</p>;
  }

  if (unlocked === null) {
    return <p className="text-brand-on-surface-variant">{t("checkingLock")}</p>;
  }

  if (!unlocked) {
    if (dialogDismissed) {
      return (
        <div className="matrix-tester">
          <p className="mb-3">{t("mustUnlock")}</p>
          <button className="btn btn-outline border-base-300" onClick={() => setDialogDismissed(false)}>
          {t("unlock")}
        </button>
        </div>
      );
    }
    return (
      <UnlockDialog
        keyboard={keyboard}
        onUnlocked={() => setUnlocked(true)}
        onCancel={() => setDialogDismissed(true)}
      />
    );
  }

  const rightEdges = [
    ...keyboard.keys.map((k) => k.x + k.width),
    ...keyboard.encoders.map((e) => e.x + e.width),
    0,
  ];
  const bottomEdges = [
    ...keyboard.keys.map((k) => k.y + k.height),
    ...keyboard.encoders.map((e) => e.y + e.height),
    0,
  ];

  return (
    <div className="matrix-tester">
      <p className="mb-3">{t("matrixInstructions")}</p>
      <div className="mockup-window w-fit max-w-full border border-base-300 bg-base-100">
        <div className="overflow-auto border-t border-base-300 p-4">
          <div
            className="keyboard-layout"
            style={{ width: Math.max(...rightEdges) * UNIT, height: Math.max(...bottomEdges) * UNIT }}
          >
            {keyboard.keys.map((key) => {
              const pos = `${key.row},${key.col}`;
              const state = pressed.has(pos) ? " pressed" : tested.has(pos) ? " tested" : "";
              return (
                <div
                  key={pos}
                  className={`matrix-key${state}`}
                  title={pos}
                  style={{
                    left: key.x * UNIT,
                    top: key.y * UNIT,
                    width: key.width * UNIT - 4,
                    height: key.height * UNIT - 4,
                  }}
                />
              );
            })}
            {keyboard.encoders.map((encoder) => (
              <div
                key={`encoder-${encoder.index}`}
                className="encoder"
                title={`Encoder ${encoder.index}`}
                style={{
                  left: encoder.x * UNIT,
                  top: encoder.y * UNIT,
                  width: encoder.width * UNIT - 4,
                  height: encoder.height * UNIT - 4,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <button className="btn btn-neutral mt-4" onClick={() => setTested(new Set())}>
        {t("reset")}
      </button>
    </div>
  );
}
