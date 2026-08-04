import { Icon } from "@iconify/react";
import { useI18n } from "../../../contexts/i18n.tsx";
import { useKeyDisplay } from "../../../contexts/keyDisplay.tsx";
import { label as kcLabel } from "../../../protocol/keycodes.ts";
import { CapGlyph } from "../layout/KeycapFace.tsx";
import { capIcon } from "../layout/keycapIcons.ts";

/** Which of the knob's functions a row stands for. */
export type KnobPart = "ccw" | "press" | "cw";

/** Rows in the same order the knob widget stacks them: turn, press, turn. */
const PARTS: readonly KnobPart[] = ["ccw", "press", "cw"];

const PART_ICON: Record<KnobPart, string> = {
  ccw: "mdi:rotate-left",
  press: "mdi:gesture-tap-button",
  cw: "mdi:rotate-right",
};

const PART_LABEL: Record<KnobPart, "knobCcw" | "knobPress" | "knobCw"> = {
  ccw: "knobCcw",
  press: "knobPress",
  cw: "knobCw",
};

interface Props {
  /** Current binding of each function; `press` is null when the board has none. */
  bindings: Record<"ccw" | "cw", string> & { press: string | null };
  /** Which function the quick-config grid below is currently writing to. */
  active: KnobPart;
  /** Points the selection at another of the knob's functions. */
  onSelect: (part: KnobPart) => void;
}

/** One knob function: its glyph, its name, and the keycode currently bound to it. */
function KnobRow({
  part,
  qmkId,
  active,
  onSelect,
}: {
  part: KnobPart;
  /** null renders the row as unavailable — see the panel's doc comment. */
  qmkId: string | null;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const { keyDisplay } = useKeyDisplay();
  // Same face treatment the caps use, so a binding reads identically here and
  // on the board; multi-line labels collapse to one line for this narrow slot.
  const name = qmkId === null ? "" : kcLabel(qmkId).split("\n").join(" ") || qmkId;
  const spec = qmkId === null ? null : capIcon(qmkId, keyDisplay);
  return (
    <button
      type="button"
      disabled={qmkId === null}
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-44 flex-col items-center gap-3 rounded-xl border p-4 transition-colors ${
        qmkId === null
          ? "cursor-not-allowed border-base-content/10 bg-base-200/40 opacity-50"
          : active
            ? "field-selected border-primary/50 bg-primary/10"
            : "border-base-content/10 bg-base-200/60 hover:bg-base-200"
      }`}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold opacity-70">
        <Icon icon={PART_ICON[part]} className="text-lg" aria-hidden="true" />
        {t(PART_LABEL[part])}
      </span>
      {qmkId === null ? (
        <span className="text-xs opacity-70">{t("knobPressNone")}</span>
      ) : (
        <span className="kbd kbd-md min-w-10 justify-center">
          {spec ? <CapGlyph spec={spec} label={name} /> : name}
        </span>
      )}
    </button>
  );
}

/**
 * The knob's state panel, shown above the quick-config grid whenever a knob is
 * selected. It is a *selector*, not an editor: it shows what each of the knob's
 * functions is currently bound to and routes the selection between them, while
 * the quick-config grid below does the actual assigning. That keeps one keycode
 * picker in the app instead of a second, inevitably weaker, copy in here.
 *
 * The panel exists because a knob's functions are separate bindings in the
 * protocol but one physical control to the user — see knobGrouping.ts. Rotation
 * directions that share a footprint are drawn as a single knob widget on the
 * board, so this panel is the only way to reach the direction that would
 * otherwise sit underneath the other one.
 *
 * Deliberately free of protocol vocabulary: the user is told this position has
 * several functions, not that turning travels over a different HID command than
 * pressing. The press row stays visible but disabled when no push switch could
 * be attributed to the knob — dropping the row entirely reads as a bug, and its
 * wording stays neutral because the UI genuinely cannot tell "this board doesn't
 * wire the switch into the matrix" apart from "we couldn't identify which key it
 * is" (see the inference in knobGrouping.ts).
 */
export function KnobPanel({ bindings, active, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <div className="mb-5 max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-primary/60 bg-primary/10 text-2xl text-primary"
        >
          <Icon icon="mdi:knob" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight text-brand-on-surface">
            {t("knobTitle")}
          </h2>
          <p className="text-sm opacity-70">{t("knobIntro")}</p>
        </div>
      </header>
      <div className="flex flex-wrap gap-3">
        {PARTS.map((part) => (
          <KnobRow
            key={part}
            part={part}
            qmkId={bindings[part]}
            active={active === part}
            onSelect={() => onSelect(part)}
          />
        ))}
      </div>
    </div>
  );
}
