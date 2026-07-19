// Vial unlock flow, ported from vial-gui's unlocker.py: start the unlock,
// then poll every 200ms while the user holds the indicated keys; the reply's
// counter counts down to 0 and drives the progress bar.

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";

const UNIT = 27; // half of KeyboardLayout's UNIT: a small reference rendering

interface Props {
  keyboard: Keyboard;
  onUnlocked: () => void;
  onCancel: () => void;
}

export function UnlockDialog({ keyboard, onUnlocked, onCancel }: Props) {
  const { t } = useI18n();
  const [unlockKeys, setUnlockKeys] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Poll results can arrive after unmount/cancel; latch to ignore them.
  const done = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let maxCounter = 1;

    const poll = async () => {
      try {
        const { unlocked, counter } = await keyboard.unlockPoll();
        if (cancelled) {
          return;
        }
        maxCounter = Math.max(maxCounter, counter);
        setProgress((maxCounter - counter) / maxCounter);
        if (unlocked) {
          done.current = true;
          onUnlocked();
          return;
        }
        timer = setTimeout(poll, 200);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    const start = async () => {
      try {
        const status = await keyboard.getUnlockStatus();
        if (cancelled) {
          return;
        }
        if (status.unlocked) {
          done.current = true;
          onUnlocked();
          return;
        }
        setUnlockKeys(new Set(status.keys.map((k) => `${k.row},${k.col}`)));
        await keyboard.unlockStart();
        if (!cancelled) {
          timer = setTimeout(poll, 200);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyboard, onUnlocked]);

  const handleCancel = () => {
    if (done.current) {
      return;
    }
    // Abort the half-finished unlock so the keyboard isn't left mid-handshake.
    keyboard.lock().catch(() => {});
    onCancel();
  };

  const width = Math.max(...keyboard.keys.map((k) => k.x + k.width), 0) * UNIT;
  const height = Math.max(...keyboard.keys.map((k) => k.y + k.height), 0) * UNIT;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h4 className="mb-2 text-base font-semibold">{t("unlockTitle")}</h4>
        <p className="mb-1">{t("unlockWarning")}</p>
        <p className="mb-3">{t("unlockHold")}</p>
        <div className="unlock-reference" style={{ width, height }}>
          {keyboard.keys.map((key, i) => (
            <div
              key={`${key.row},${key.col}-${i}`}
              className={`unlock-key${unlockKeys.has(`${key.row},${key.col}`) ? " hold" : ""}`}
              style={{
                left: key.x * UNIT,
                top: key.y * UNIT,
                width: key.width * UNIT - 2,
                height: key.height * UNIT - 2,
              }}
            />
          ))}
        </div>
        <div className="unlock-progress">
          <div className="unlock-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        {error && <p className="error mb-2">{error}</p>}
        <button className="btn btn-sm" onClick={handleCancel}>
          {t("cancel")}
        </button>
      </div>
      <div className="modal-backdrop" onClick={handleCancel} />
    </div>
  );
}
