// Switch matrix tester, ported from vial-gui's editor/matrix_test.py.
// Requires the keyboard to be unlocked (the firmware refuses to report matrix
// state otherwise, to prevent a web page from keylogging).
//
// Unlike vial-gui (which leaves the board unlocked and offers Security->Lock),
// nothing else in Vialite needs the unlocked state, so we re-lock on exit.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
// Back-off between retries when a poll fails (e.g. a transient HID hiccup). The
// loop keeps retrying rather than stopping, so a brief glitch self-recovers.
const RETRY_INTERVAL_MS = 500;

// Horizontal padding the board container reserves (p-4 × 2).
const CONTAINER_PADDING_PX = 32;

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
  // `error` is a fatal setup failure (unlock-status check); it replaces the UI.
  const [error, setError] = useState<string | null>(null);
  // `pollError` is a transient poll failure: the loop keeps retrying and clears
  // it on the next successful read, so it shows as a non-fatal retry banner.
  const [pollError, setPollError] = useState<string | null>(null);
  // The board auto-fits its container: shrinks as needed but never scales past
  // its natural 1× size (zoom is capped at 1). There are no manual zoom controls.
  const [zoom, setZoom] = useState(1);
  // Full-width measuring element (independent of the board's own width) so the
  // fit reads the space available, not the current — possibly shrunk — board.
  const measureRef = useRef<HTMLDivElement>(null);

  // Geometry pipeline (rotated keys, layout-option variants, ISO-Enter second
  // rects). Computed unconditionally so the auto-fit effect below can depend on
  // the board's natural width without tripping the rules-of-hooks ordering.
  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    [keyboard, keyboard.layoutOptions],
  );
  const boardWidth = placed.width * UNIT + INSET;
  const boardHeight = placed.height * UNIT + INSET;

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
          // A successful read clears any lingering retry banner.
          setPollError((prev) => (prev === null ? prev : null));
        } catch (err) {
          if (cancelled) {
            return;
          }
          // Don't stop on a failed read — surface it as a retry banner and try
          // again after a back-off, so a transient HID hiccup self-recovers.
          setPollError(err instanceof Error ? err.message : String(err));
          await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
          continue;
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

  // Auto-fit: keep the board scaled to the largest size that fits the available
  // width, capped at 1× (never enlarged). Re-runs whenever the container resizes
  // (window/sidebar) or the board's natural width changes.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!unlocked || !el) {
      return;
    }
    const recompute = () => {
      const available = el.clientWidth - CONTAINER_PADDING_PX;
      if (available > 0 && boardWidth > 0) {
        setZoom(Math.min(1, available / boardWidth));
      }
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [unlocked, boardWidth]);

  if (error) {
    return (
      <div role="alert" className="alert alert-error alert-soft text-sm">
        <span>{t("matrixStopped", { error })}</span>
      </div>
    );
  }

  if (unlocked === null) {
    return (
      <div role="alert" className="alert alert-info alert-soft text-sm">
        <span className="loading loading-spinner loading-sm" />
        <span>{t("checkingLock")}</span>
      </div>
    );
  }

  if (!unlocked) {
    if (dialogDismissed) {
      return (
        <div className="matrix-tester">
          <div role="alert" className="alert alert-warning alert-soft mb-3 text-sm">
            <span>{t("mustUnlock")}</span>
          </div>
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

  return (
    <div className="matrix-tester">
      {pollError ? (
        <div role="alert" className="alert alert-warning alert-soft mb-3 text-sm">
          <span className="loading loading-spinner loading-sm" />
          <span>{t("matrixRetrying", { error: pollError })}</span>
        </div>
      ) : (
        <div role="alert" className="alert alert-info alert-soft mb-3 text-sm">
          <span>{t("matrixInstructions")}</span>
        </div>
      )}
      <div ref={measureRef} className="w-full">
        <div
          data-lenis-prevent
          className="w-fit max-w-full overflow-auto rounded-lg bg-base-100 p-4"
        >
          {/* A CSS transform doesn't affect layout, so the wrapper is given the
              scaled box explicitly and the board scaled from its top-left to fill
              it — the container then scrolls/reflows around the apparent size. */}
          <div style={{ width: boardWidth * zoom, height: boardHeight * zoom }}>
            <div
              className="keyboard-layout"
              style={{
                width: boardWidth,
                height: boardHeight,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
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
        {/* Only surface Reset once something is highlighted. Centered on the
            board's width (not the page) by matching the container to the scaled
            board size and centering the button within it. */}
        {tested.size > 0 && (
          <div className="mt-4 flex justify-center" style={{ width: boardWidth * zoom }}>
            <button className="btn btn-neutral" onClick={() => setTested(new Set())}>
              {t("reset")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
