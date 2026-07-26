import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import type { Keyboard, TapDanceEntry } from "../../../protocol/keyboard.ts";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import type { MacroAction } from "../../../protocol/macro.ts";
import { kcText, macroIndex, tapDanceConfigured, tapDanceIndex } from "./cascadeGrouping.ts";

/** Tap-dance action fields, in the order the preview lists them. */
const TD_FIELDS: { key: MessageKey; field: keyof TapDanceEntry }[] = [
  { key: "tapDanceOnTap", field: "onTap" },
  { key: "tapDanceOnHold", field: "onHold" },
  { key: "tapDanceOnDoubleTap", field: "onDoubleTap" },
  { key: "tapDanceOnTapHold", field: "onTapHold" },
];

interface Props {
  /** The keycode currently described (kept fed during fade-out — see
   *  {@link ./KeycodeCascadeSelector}'s `lastInfoEntry`). */
  infoEntry: KeycodeDef;
  /** Whether the panel has finished its open delay and should be visible. */
  infoShown: boolean;
  /** Open to the left of the selection columns instead of the right. */
  infoFlip: boolean;
  /** Per-key description blurb, or null when the active keycode has none. */
  keyDesc: string | null;
  /** Category-level blurb, shown last as supplementary context. */
  catDesc: string | null;
  /** Connected device, for the live macro / tap-dance previews. Optional —
   *  omitted in picker contexts with no attached keyboard. */
  keyboard?: Keyboard;
}

/**
 * Read-only card describing the cascade's active keycode: encoding, per-key
 * description, a live macro / tap-dance preview when applicable, and the
 * category blurb. Extracted from `KeycodeCascadeSelector`, which owns the
 * positioning/fade choreography (`infoShown`/`infoFlip`) this panel is driven
 * by — see that file for the layout effects.
 */
export function CascadeInfoPanel({
  infoEntry,
  infoShown,
  infoFlip,
  keyDesc,
  catDesc,
  keyboard,
}: Props) {
  const { t, lang } = useI18n();
  const zh = lang === "zh";
  const macros = keyboard?.macros ?? [];
  const activeMacroIdx = macroIndex(infoEntry.qmkId);
  const activeTapDanceIdx = tapDanceIndex(infoEntry.qmkId);

  const macroActionKind = (a: MacroAction): string => {
    if (a.kind === "text") return t("macroActionText");
    if (a.kind === "delay") return t("macroActionDelay");
    return { tap: t("macroActionTap"), down: t("macroActionDown"), up: t("macroActionUp") }[
      a.kind
    ];
  };
  const macroActionValue = (a: MacroAction): string => {
    if (a.kind === "text") return a.text;
    if (a.kind === "delay") return `${a.ms} ms`;
    return a.keycodes.map(kcText).join(" + ");
  };

  return (
    // Out of flow (absolute) so flipping sides never shifts the selection
    // columns out from under the pointer, and so revealing it doesn't widen
    // the popover the clamp effect measures. Styled as an inverted `neutral`
    // tooltip surface rather than another base-100 card, so it reads as
    // annotation rather than one more column of the menu.
    <div
      data-lenis-prevent
      aria-hidden={!infoShown}
      className={`absolute top-0 max-h-72 w-52 overflow-y-auto rounded-box bg-neutral p-3 text-neutral-content shadow-lg ring-1 ring-neutral/40 motion-safe:transition motion-safe:duration-150 motion-safe:ease-out ${
        infoFlip ? "right-full mr-2 origin-right" : "left-full ml-2 origin-left"
      } ${
        infoShown
          ? "scale-100 opacity-100"
          : // Not just invisible but inert, so the faded-out panel can't
            // swallow hovers over whatever sits beside the menu.
            `pointer-events-none scale-95 opacity-0 ${
              infoFlip ? "translate-x-1" : "-translate-x-1"
            }`
      }`}
    >
      <div className="flex flex-col gap-3">
        {/* 1. Keycode encoding — always first. */}
        <div>
          <div className="mb-1 text-xs opacity-50">{zh ? "按键编码" : "Keycode"}</div>
          <div className="font-mono text-sm break-all">{infoEntry.qmkId}</div>
        </div>
        {/* 2. Per-key description. */}
        {keyDesc && (
          <div>
            <div className="mb-1 text-xs opacity-50">{zh ? "按键说明" : "Description"}</div>
            <div className="text-xs leading-relaxed opacity-80">{keyDesc}</div>
          </div>
        )}
        {/* 3. Macro / tap-dance content. */}
        {activeMacroIdx !== null && (
          <div>
            <div className="mb-1 text-xs opacity-50">{t("cascadeMacroContents")}</div>
            {(macros[activeMacroIdx]?.length ?? 0) === 0 ? (
              <div className="text-xs opacity-40">{t("cascadeNotConfigured")}</div>
            ) : (
              <div className="flex flex-col gap-1 text-xs">
                {macros[activeMacroIdx].map((a, i) => (
                  <div key={i} className="flex items-start gap-1">
                    {/* Outline, not ghost: ghost paints a base-200 chip that
                        disappears on the neutral surface. */}
                    <span className="badge badge-outline badge-xs shrink-0">
                      {macroActionKind(a)}
                    </span>
                    <span className="break-all">{macroActionValue(a)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTapDanceIdx !== null && keyboard && (
          <div>
            <div className="mb-1 text-xs opacity-50">{t("cascadeTapDanceActions")}</div>
            {(() => {
              const e = keyboard.tapDanceEntries[activeTapDanceIdx];
              if (!tapDanceConfigured(e)) {
                return <div className="text-xs opacity-40">{t("cascadeNotConfigured")}</div>;
              }
              return (
                <div className="flex flex-col gap-0.5 text-xs">
                  {TD_FIELDS.filter((f) => (e[f.field] as string) !== "KC_NO").map((f) => (
                    <div key={f.field} className="flex justify-between gap-2">
                      <span className="opacity-50">{t(f.key)}</span>
                      <span className="font-medium">{kcText(e[f.field] as string)}</span>
                    </div>
                  ))}
                  <div className="mt-0.5 text-right opacity-40">
                    {t("tapDanceTermMs", { ms: e.tappingTerm })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {/* 4. Other info: the category-level blurb. */}
        {catDesc && (
          <div>
            <div className="mb-1 text-xs opacity-50">{zh ? "分类说明" : "Category"}</div>
            <div className="text-xs leading-relaxed opacity-80">{catDesc}</div>
          </div>
        )}
      </div>
    </div>
  );
}
