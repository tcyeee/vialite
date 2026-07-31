// Switch matrix tester, ported from vial-gui's editor/matrix_test.py.
// Requires the keyboard to be unlocked (the firmware refuses to report matrix
// state otherwise, to prevent a web page from keylogging).
//
// Unlike vial-gui (which leaves the board unlocked and offers Security->Lock),
// nothing else in Vialite needs the unlocked state, so we re-lock on exit.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import type { Keyboard, PhysicalKey } from "../../protocol/keyboard.ts";
import { label } from "../../protocol/keycodes.ts";
import { isLinkFatal } from "../../protocol/transport.ts";
import { UnlockDialog } from "./UnlockDialog.tsx";
import { track } from "../../lib/analytics.ts";
import { hasSecondRect, placeLayout } from "../keymap/layout/layoutGeometry.ts";
import { shapeStyle } from "../keymap/layout/KeyboardLayoutPreview.tsx";

const UNIT = 54; // same scale as KeyboardLayoutEditor
// Gap between adjacent caps (the old code baked this in as `width * UNIT - 4`).
const INSET = 4;

const POLL_INTERVAL_MS = 50;
// Back-off between retries when a poll fails (e.g. a transient HID hiccup). The
// loop keeps retrying rather than stopping, so a brief glitch self-recovers.
const RETRY_INTERVAL_MS = 500;

// Per-key press counters saturate rather than widening the cap: the label has to
// stay inside a 1u keycap.
const COUNT_CAP = 9999;
// How many recent triggers the log window keeps. The window always renders this
// many rows (blank-padded) so it doesn't grow as presses come in.
const LOG_LIMIT = 15;

/**
 * One press. Stored as structured fields rather than a rendered string so the
 * human-readable half can re-render in the current UI language — switching
 * languages shouldn't leave stale lines behind.
 */
interface LogEntry {
  /** Monotonic id — several entries can share a position and a timestamp. */
  id: number;
  time: string;
  row: number;
  col: number;
  /** Which press of this key this was (1-based). */
  count: number;
  /** Assignment on every layer, index = layer. */
  layerCodes: string[];
  /** Other matrix positions held at the same instant. */
  others: string[];
  /** Language-neutral physical geometry, pre-rendered, least-important last. */
  geometry: string[];
}

/** Local wall-clock with milliseconds — presses are only ~50ms apart at best. */
function stamp(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Trim trailing zeros so KLE's fractional units read as 1.25u / 2u, not 1.250000u. */
function unit(n: number): string {
  return `${Number(n.toFixed(3))}u`;
}

/**
 * Raw fields, most diagnostically important first: which switch fired, what it's
 * bound to, how many times, when, what it was chorded with, and only then the
 * cosmetic geometry.
 */
function rawFields(entry: LogEntry): string {
  const fields = [
    `row=${entry.row} col=${entry.col}`,
    entry.layerCodes.map((code, l) => `L${l}=${code}`).join(" "),
    `n=${entry.count}`,
  ];
  // No `t=` field: the timestamp already leads the line.
  if (entry.others.length > 0) {
    fields.push(`with=[${entry.others.join(" ")}]`);
  }
  return [...fields, ...entry.geometry].join("  ");
}

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
  // Press counts per matrix position, and the rolling trigger log (newest first).
  // Both are driven by rising edges only — the poll loop re-reports a held key
  // every 50ms, so `prevPressedRef` is what turns "still down" into "pressed once".
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  // Mirror of `counts` so a log line can quote the press number it belongs to
  // without waiting for the state update to land.
  const countsRef = useRef<Map<string, number>>(new Map());
  const [log, setLog] = useState<LogEntry[]>([]);
  const prevPressedRef = useRef<Set<string>>(new Set());
  const logIdRef = useRef(0);
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

  // Physical key by matrix position, for annotating log lines. Held in a ref
  // (not read through the render closure) so the poll effect can stay keyed on
  // [keyboard, unlocked] — restarting it on a layout-option change would re-lock
  // the keyboard via its cleanup.
  const keyByPosRef = useRef<Map<string, PhysicalKey>>(new Map());
  keyByPosRef.current = useMemo(() => {
    const map = new Map<string, PhysicalKey>();
    for (const { key } of placed.keys) {
      if (!key.decal) {
        // Layout-option alternates share a position; first one wins.
        map.set(`${key.row},${key.col}`, key);
      }
    }
    return map;
  }, [placed]);

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
          const newlyPressed = [...state].filter((pos) => !prevPressedRef.current.has(pos));
          prevPressedRef.current = state;
          if (state.size > 0) {
            setTested((prev) => {
              const next = new Set(prev);
              for (const pos of state) {
                next.add(pos);
              }
              return next;
            });
          }
          if (newlyPressed.length > 0) {
            for (const pos of newlyPressed) {
              countsRef.current.set(pos, Math.min(COUNT_CAP, (countsRef.current.get(pos) ?? 0) + 1));
            }
            setCounts(new Map(countsRef.current));

            const time = stamp(new Date());
            const added = newlyPressed.map<LogEntry>((pos) => {
              const [row, col] = pos.split(",").map(Number);
              const key = keyByPosRef.current.get(pos);
              const geometry: string[] = [];
              if (key) {
                geometry.push(`at=(${key.x},${key.y})`, `size=${unit(key.width)}x${unit(key.height)}`);
                if (key.rotationAngle !== 0) {
                  geometry.push(`rot=${key.rotationAngle}°@(${key.rotationX},${key.rotationY})`);
                }
                if (key.layoutIndex >= 0) {
                  geometry.push(`layout=${key.layoutIndex}.${key.layoutOption}`);
                }
              }
              return {
                id: logIdRef.current++,
                time,
                row,
                col,
                count: countsRef.current.get(pos) ?? 1,
                // The tester is layer-agnostic, so record every layer's
                // assignment rather than picking one. KC_NO/KC_TRNS are kept —
                // an unexpected KC_NO on the layer you meant to test is exactly
                // the useful bit.
                layerCodes: Array.from({ length: keyboard.layers }, (_, l) =>
                  keyboard.getKey(l, row, col),
                ),
                others: [...state].filter((p) => p !== pos),
                geometry,
              };
            });
            setLog((prev) => [...added.reverse(), ...prev].slice(0, LOG_LIMIT));
          }
          // A successful read clears any lingering retry banner.
          setPollError((prev) => (prev === null ? prev : null));
        } catch (err) {
          if (cancelled) {
            return;
          }
          // A dead link can't be retried into life — the transport is closed for good and the
          // app is already on its way back to the connect screen, so stop rather than spin a
          // poll loop against it until the page unmounts.
          if (isLinkFatal(err)) {
            return;
          }
          // Anything else: surface it as a retry banner and try again after a
          // back-off, so a transient HID hiccup self-recovers.
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
      prevPressedRef.current = new Set();
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
      {pollError && (
        <div role="alert" className="alert alert-warning alert-soft mb-3 text-sm">
          <span className="loading loading-spinner loading-sm" />
          <span>{t("matrixRetrying", { error: pollError })}</span>
        </div>
      )}
      <div ref={measureRef} className="w-full flex flex-col items-center">
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
                // Only keys that have actually registered carry a counter.
                const count = counts.get(pos);
                return (
                  // Several KLE keys can share one matrix position (layout-option
                  // alternates like ISO/ANSI Enter), so `pos` isn't unique here.
                  <div
                    key={`${pos}-${i}`}
                    className={`matrix-key${state}`}
                    title={pos}
                    style={shapeStyle(key, shiftX, shiftY, UNIT, INSET, 0)}
                  >
                    {count !== undefined && <span className="matrix-key-count">{count}</span>}
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
                key={`encoder-${encoder.index}-${encoder.direction}`}
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
        {/* Rolling trigger log, newest first. Rendered even when empty so the
            panel doesn't pop the layout on the first keypress. */}
        <div className="mt-4" style={{ width: boardWidth * zoom, maxWidth: "100%" }}>
          <div data-lenis-prevent className="mockup-code w-full overflow-x-auto text-xs">
            {/* Always LOG_LIMIT rows: blank-padded so the window keeps a constant
                height instead of growing as presses come in. */}
            {Array.from({ length: LOG_LIMIT }, (_, i) => {
              const entry = log[i];
              if (!entry) {
                return (
                  <pre key={`blank-${i}`} data-prefix=" ">
                    <code>{i === 0 && log.length === 0 ? t("matrixLogEmpty") : " "}</code>
                  </pre>
                );
              }
              // Plain-language half first, raw fields dimmed behind a divider.
              // The human half counts rows/cols from 1 (nobody reads "row 0");
              // the raw half keeps the firmware's 0-based indices.
              const human = t("matrixLogPress", {
                key: label(entry.layerCodes[0] ?? "KC_NO").split("\n").join(" "),
                row: String(entry.row + 1),
                col: String(entry.col + 1),
                n: String(entry.count),
              });
              const chord =
                entry.others.length > 0
                  ? ` ${t("matrixLogChord", { n: String(entry.others.length) })}`
                  : "";
              return (
                <pre key={entry.id} data-prefix=">">
                  <code>
                    <span className="whitespace-pre">{`${entry.time}  ${human}${chord}`}</span>
                    <span className="opacity-50 whitespace-pre">{`   │   ${rawFields(entry)}`}</span>
                  </code>
                </pre>
              );
            })}
          </div>
        </div>
        {tested.size > 0 && (
          <div className="mt-4 flex justify-center" style={{ width: boardWidth * zoom }}>
            <button
              className="btn btn-neutral"
              onClick={() => {
                setTested(new Set());
                countsRef.current = new Map();
                setCounts(new Map());
                setLog([]);
              }}
            >
              {t("reset")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
