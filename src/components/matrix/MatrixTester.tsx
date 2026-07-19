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
import { hasSecondRect, placeLayout } from "../keymap/layoutGeometry.ts";
import { shapeStyle } from "../keymap/KeyboardLayoutPreview.tsx";

const UNIT = 54; // same scale as KeyboardLayout
// Gap between adjacent caps (the old code baked this in as `width * UNIT - 4`).
const INSET = 4;

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

  // Run the same geometry pipeline as the other boards so rotated ("倾斜") keys,
  // layout-option variants and ISO-Enter second rects render in the right place
  // — the old code positioned keys from raw x/y and dropped the rotation entirely.
  const placed = placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices);

  return (
    <div className="matrix-tester">
      <p className="mb-3">{t("matrixInstructions")}</p>
      <div className="mockup-window w-fit max-w-full border border-base-300 bg-base-100">
        <div data-lenis-prevent className="overflow-auto border-t border-base-300 p-4">
          <div
            className="keyboard-layout"
            style={{ width: placed.width * UNIT + INSET, height: placed.height * UNIT + INSET }}
          >
            {placed.keys
              .filter(({ key }) => !key.decal)
              .map(({ key, shiftX, shiftY }, i) => {
                const pos = `${key.row},${key.col}`;
                const state = pressed.has(pos) ? " pressed" : tested.has(pos) ? " tested" : "";
                return (
                  // Several KLE keys can share one matrix position (layout-option
                  // alternates like ISO/ANSI Enter), so `pos` isn't unique here.
                  <div
                    key={`${pos}-${i}`}
                    className={`matrix-key${state}`}
                    title={pos}
                    style={shapeStyle(key, shiftX, shiftY, UNIT, INSET, 0)}
                  >
                    {hasSecondRect(key) && (
                      <span
                        className={`matrix-key${state}`}
                        style={{
                          position: "absolute",
                          left: key.x2 * UNIT,
                          top: key.y2 * UNIT,
                          width: key.width2 * UNIT - INSET,
                          height: key.height2 * UNIT - INSET,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            {placed.encoders.map(({ encoder, shiftX, shiftY }) => (
              <div
                key={`encoder-${encoder.index}`}
                className="encoder"
                title={`Encoder ${encoder.index}`}
                style={shapeStyle(encoder, shiftX, shiftY, UNIT, INSET, 0)}
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
