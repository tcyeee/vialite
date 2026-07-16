import { useState } from "react";
import { flushSync } from "react-dom";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../protocol/keycodes.ts";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { startViewTransition } from "../common/viewTransition.ts";
import { quantumHelp } from "./quantumHelp.ts";

/** A labelled block of keycodes shown within an expanded card. */
export interface QuantumCardSection {
  /** Translation key for the section heading. */
  titleKey: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
}

/** One Quantum sub-category shown as an expandable card (Modifiers, Mod-Tap, …). */
export interface QuantumCardGroup {
  /** Translation key for the card heading. */
  titleKey: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
  /**
   * When present, the expanded card splits its keycodes into labelled sections
   * instead of one flat wrap (the "Other" card folds One-Shot Mods in this way).
   */
  sections?: QuantumCardSection[];
}

interface Props {
  groups: QuantumCardGroup[];
  /** Assign the picked keycode (routed through KeycodeTabs' pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** Background colors cycled across the Quantum cards (up to five groups). */
const CARD_BG = ["#3E5C6E", "#4A5478", "#5C4E78", "#6E5A3E", "#3E6E5C"];

/**
 * The Quantum tab's landing view: one card per sub-category (One-Shot Mods,
 * Modifiers, Mod-Tap, Layer-Tap, Other). Clicking a card expands it inside a
 * View Transition to reveal every keycode as a labelled button; clicking one
 * assigns it (masked templates then wait for an inner basic key, mirroring
 * KeycodeTabs' pick flow). Only one card is open at a time. Mirrors
 * {@link FnMediaMouseCards} and {@link LayerCategoryCards}.
 */
export function QuantumCards({ groups, onPick }: Props) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);

  /** Toggle a card open/closed, animating the layout change via a View Transition. */
  const toggle = (titleKey: string) => {
    startViewTransition(() =>
      flushSync(() => setExpanded((cur) => (cur === titleKey ? null : titleKey))),
    );
  };

  /**
   * A single assignable keycode button; `j` drives the staggered reveal
   * animation. Uses the "Keyboard Function" tab's uniform tile look (fixed
   * height, soft translucent border/fill), translated to white for the card's
   * colored background. When help text exists for the keycode, a corner
   * HelpIcon is overlaid (mirroring the "Keyboard Function" tiles); the badge
   * stops click propagation so hovering for help never assigns the keycode.
   */
  const keyButton = (entry: KeycodeDef, j: number) => {
    const help = quantumHelp(entry.qmkId, lang);
    const button = (
      <button
        key={entry.qmkId}
        className={`combo-item btn btn-sm h-14 min-w-[4.5rem] border border-white/20 bg-white/[0.06] py-1 leading-tight font-normal whitespace-pre-line text-white normal-case hover:border-white/40 hover:bg-white/15${
          entry.masked ? " italic" : ""
        }`}
        style={{ animationDelay: `${Math.min(j * 25, 300)}ms` }}
        title={entry.title ?? entry.qmkId}
        onClick={() => onPick(entry)}
      >
        {entry.label || entry.qmkId}
      </button>
    );
    if (!help) return button;
    return (
      <div key={entry.qmkId} className="relative">
        {button}
        <span className="absolute top-0.5 right-0.5" onClick={(e) => e.stopPropagation()}>
          <HelpIcon text={help} variant="light" />
        </span>
      </div>
    );
  };

  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {groups.map((group, i) => {
        const isOpen = expanded === group.titleKey;
        const empty = group.entries.length === 0;
        return (
          <div
            key={group.titleKey}
            className={`group/quantumcard card relative select-none text-brand-background transition-shadow ${
              isOpen ? "w-full" : "w-56"
            } ${empty ? "cursor-default opacity-60" : "cursor-pointer hover:shadow-lg"}`}
            style={{ backgroundColor: CARD_BG[i % CARD_BG.length], viewTransitionName: `quantumcard-${i}` }}
            onClick={() => !empty && toggle(group.titleKey)}
          >
            <div className="badge badge-sm absolute top-3 right-3 z-10 border-none bg-white/20 font-medium text-white">
              {t("comboCardCount", { n: group.entries.length })}
            </div>
            <div className="card-body relative gap-3 p-5">
              <div className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
                <span>{t(group.titleKey)}</span>
                {group.helpKey && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <HelpIcon text={t(group.helpKey)} variant="light" />
                  </span>
                )}
              </div>

              {!isOpen ? (
                <div className="text-xs tracking-widest uppercase opacity-40">
                  {empty ? "—" : t("comboCardReveal")}
                </div>
              ) : group.sections ? (
                <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                  {group.sections.map((section, s) => (
                    <div key={section.titleKey} className="flex flex-col gap-2">
                      <div className="flex items-center gap-1 text-xs font-semibold tracking-wide uppercase opacity-60">
                        <span>{t(section.titleKey)}</span>
                        {section.helpKey && (
                          <HelpIcon text={t(section.helpKey)} variant="light" />
                        )}
                      </div>
                      <div className="combo-num-grid flex flex-wrap gap-2">
                        {section.entries.map((entry, j) => keyButton(entry, s === 0 ? j : j + 4))}
                      </div>
                    </div>
                  ))}
                  <button
                    className="btn btn-sm btn-ghost self-start text-white/70 hover:bg-white/15 hover:text-white"
                    onClick={() => toggle(group.titleKey)}
                  >
                    {t("comboCardBack")}
                  </button>
                </div>
              ) : (
                <div className="combo-num-grid flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {group.entries.map((entry, j) => keyButton(entry, j))}
                  <button
                    className="btn btn-sm btn-ghost ml-auto self-start text-white/70 hover:bg-white/15 hover:text-white"
                    onClick={() => toggle(group.titleKey)}
                  >
                    {t("comboCardBack")}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
