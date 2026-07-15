// Vial unlock flow, ported from vial-gui's unlocker.py: start the unlock,
// then poll every 200ms while the user holds the indicated keys; the reply's
// counter counts down to 0 and drives the progress bar.

import { useEffect, useRef, useState } from "react";
import type { Keyboard } from "../protocol/keyboard.ts";

const UNIT = 27; // half of KeyboardLayout's UNIT: a small reference rendering

interface Props {
  keyboard: Keyboard;
  onUnlocked: () => void;
  onCancel: () => void;
}

export function UnlockDialog({ keyboard, onUnlocked, onCancel }: Props) {
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
    <div className="picker-overlay" onClick={handleCancel}>
      <div className="picker unlock-dialog" onClick={(e) => e.stopPropagation()}>
        <h4>Unlock keyboard</h4>
        <p>
          In order to proceed, the keyboard must be set into unlocked mode. You should only perform
          this operation on computers that you trust.
        </p>
        <p>Press and hold the highlighted keys until the progress bar fills up:</p>
        <div className="unlock-reference" style={{ width, height }}>
          {keyboard.keys.map((key) => (
            <div
              key={`${key.row},${key.col}`}
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
        {error && <p className="error">{error}</p>}
        <button onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  );
}
