import { useState } from "react";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import { deserialize, label as kcLabel, type KeycodeDef } from "../../../protocol/keycodes.ts";
import { HelpIcon } from "../../common/HelpIcon.tsx";
import { KeycodeCascadeSelector } from "../KeycodeCascadeSelector.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { quantumHelp } from "./quantumHelp.ts";
import { ExpandableCardColumn, type ExpandableCardDef } from "./ExpandableCardColumn.tsx";

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
  /** Assign the composed/picked keycode (routed through QuickConfigPanel's pick handler). */
  onPick: (entry: KeycodeDef) => void;
  /** Connected device, for the inner-key cascade selector's macro / tap-dance previews. */
  keyboard: Keyboard;
}

/** Background colors cycled across the Quantum cards (up to five groups). */
const CARD_BG = ["#3E5C6E", "#4A5478", "#5C4E78", "#6E5A3E", "#3E6E5C"];

/** The four modifier bits, in keycap order. */
const MOD_BITS: { key: ModKey; label: string }[] = [
  { key: "ctrl", label: "Ctrl" },
  { key: "shift", label: "Shift" },
  { key: "alt", label: "Alt" },
  { key: "gui", label: "GUI" },
];
type ModKey = "ctrl" | "shift" | "alt" | "gui";
type ModState = Record<ModKey, boolean>;
const NO_MODS: ModState = { ctrl: false, shift: false, alt: false, gui: false };

/** Which composer a card renders: modifier stack, layer picker, or plain reveal. */
type Kind = "mod" | "layer" | "other";
function kindOf(titleKey: string): Kind {
  if (titleKey === "groupQuantumMods" || titleKey === "groupQuantumModTap") return "mod";
  if (titleKey === "groupQuantumLayerTap") return "layer";
  return "other";
}

/**
 * Maps a modifier bitmask (`ctrl | shift<<1 | alt<<2 | gui<<3`, plus `0x10` for
 * the right-hand side) to the card's template for that exact combination. Built
 * by decoding each masked template's high byte, so a mask absent from the map
 * means this card carries no keycode for that combination (→ warn, block apply).
 */
function maskToTemplate(entries: KeycodeDef[]): Map<number, KeycodeDef> {
  const map = new Map<number, KeycodeDef>();
  for (const e of entries) {
    if (!e.masked) continue;
    try {
      // Masked templates ("LCTL(kc)", "C_S(kc)", "RCAG_T(kc)"…) are direct
      // entries in the keycode table, so deserialize returns their base value
      // without going through the expression parser — its high byte carries the
      // modifier mask + right-hand bit.
      const base = deserialize(e.qmkId);
      map.set((base >> 8) & 0x1f, e);
    } catch {
      // Skip anything that doesn't resolve to a concrete masked base.
    }
  }
  return map;
}

/** Available Layer-Tap layers, parsed from the card's `LT<n>(kc)` templates. */
function layerTemplates(entries: KeycodeDef[]): number[] {
  const layers: number[] = [];
  for (const e of entries) {
    const m = /^LT(\d+)\(kc\)$/.exec(e.qmkId);
    if (m) layers.push(Number.parseInt(m[1], 10));
  }
  return layers.sort((a, b) => a - b);
}

/**
 * The Quantum cards inside the Basic tab: one card per sub-category (One-Shot
 * Mods, Modifiers, Mod-Tap, Layer-Tap, Other). The three composite cards
 * (Modifiers, Mod-Tap, Layer-Tap) float open into an in-card composer — pick the
 * modifier stack (or target layer) plus a basic key on the mini board, preview
 * the result, then apply — so both halves are chosen in one place. The "Other"
 * card keeps the flat reveal. Uses the shared {@link ExpandableCardColumn},
 * matching the Fn/Media/Mouse and Combo Keys columns.
 */
export function QuantumCards({ groups, onPick, keyboard }: Props) {
  const { t, lang } = useI18n();
  // Composer state — shared, since only one card is ever open at a time; reset
  // whenever the open card changes (via ExpandableCardColumn's onExpandedChange).
  const [mods, setMods] = useState<ModState>(NO_MODS);
  const [side, setSide] = useState<"L" | "R">("L");
  const [layer, setLayer] = useState<number | null>(null);
  const [basic, setBasic] = useState<string | null>(null);

  const resetComposer = () => {
    setMods(NO_MODS);
    setSide("L");
    setLayer(null);
    setBasic(null);
  };

  /**
   * A single assignable keycode button; `j` drives the staggered reveal
   * animation. Uses the "Keyboard Function" tab's uniform tile look (fixed
   * height, soft translucent border/fill), translated to white for the card's
   * colored background. When help text exists for the keycode, a corner HelpIcon
   * is overlaid; the badge stops click propagation so hovering never assigns.
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

  /** The expanded in-card composer for a Modifiers/Mod-Tap or Layer-Tap card. */
  const composer = (group: QuantumCardGroup, kind: "mod" | "layer") => {
    const mask =
      (mods.ctrl ? 0x1 : 0) |
      (mods.shift ? 0x2 : 0) |
      (mods.alt ? 0x4 : 0) |
      (mods.gui ? 0x8 : 0) |
      (side === "R" ? 0x10 : 0);
    const anyMod = (mask & 0xf) !== 0;
    const template = kind === "mod" ? maskToTemplate(group.entries).get(mask) : undefined;
    const layers = kind === "layer" ? layerTemplates(group.entries) : [];
    // The chosen modifier/layer as a "…(kc)" template, or undefined when incomplete.
    const templateId =
      kind === "mod" ? template?.qmkId : layer !== null ? `LT${layer}(kc)` : undefined;
    const composedId = templateId && basic ? templateId.replace("kc", basic) : null;
    const comboMissing = kind === "mod" && anyMod && !template;
    // Preview falls back to the partial selection (template alone, or the bare
    // basic key) so the keycap updates at every step.
    const previewId = composedId ?? templateId ?? basic ?? null;
    const canApply = Boolean(composedId) && !comboMissing;
    const hint = comboMissing
      ? null
      : kind === "mod"
        ? !anyMod
          ? t("quantumNeedMod")
          : !basic
            ? t("quantumNeedBasic")
            : null
        : layer === null
          ? t("quantumNeedLayer")
          : !basic
            ? t("quantumNeedBasic")
            : null;

    const stepClass = "text-xs font-semibold tracking-wide uppercase opacity-70";
    const chip = (selected: boolean) =>
      `btn btn-sm border-white/20 font-normal text-white normal-case ${
        selected ? "border-white/50 bg-white/30 hover:bg-white/40" : "bg-white/10 hover:bg-white/20"
      }`;

    return (
      <div className="flex flex-col gap-4">
        {/* Step 1 — the modifier stack, or the target layer. */}
        <div className="flex flex-col gap-2">
          <div className={stepClass}>{t(kind === "mod" ? "quantumPickMods" : "quantumPickLayer")}</div>
          {kind === "mod" ? (
            <div className="flex flex-wrap items-center gap-2">
              {MOD_BITS.map((m) => (
                <button
                  key={m.key}
                  className={chip(mods[m.key])}
                  onClick={() => setMods((cur) => ({ ...cur, [m.key]: !cur[m.key] }))}
                >
                  {m.label}
                </button>
              ))}
              <div className="join ml-1">
                {(["L", "R"] as const).map((s) => (
                  <button
                    key={s}
                    className={`btn btn-sm join-item border-white/20 font-normal text-white normal-case ${
                      side === s ? "border-white/50 bg-white/30" : "bg-white/10 hover:bg-white/20"
                    }`}
                    onClick={() => setSide(s)}
                  >
                    {t(s === "L" ? "quantumSideLeft" : "quantumSideRight")}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {layers.map((n) => (
                <button key={n} className={chip(layer === n)} onClick={() => setLayer(n)}>
                  {t("quantumLayerN", { n })}
                </button>
              ))}
            </div>
          )}
          {comboMissing && (
            <div className="rounded-md border border-amber-300/40 bg-amber-300/15 px-3 py-1.5 text-xs text-amber-100">
              {t("quantumComboMissing")}
            </div>
          )}
        </div>

        {/* Step 2 — the inner basic key, via the cascade selector. */}
        <div className="flex flex-col gap-2">
          <div className={stepClass}>{t("quantumPickBasic")}</div>
          <KeycodeCascadeSelector keyboard={keyboard} onPick={(entry) => setBasic(entry.qmkId)} />
        </div>

        {/* Preview + apply. */}
        <div className="flex flex-wrap items-center gap-3">
          <span className={stepClass}>{t("quantumPreview")}</span>
          <div className="flex min-h-11 min-w-12 items-center justify-center rounded-md border border-white/25 bg-white/10 px-2 py-1 text-center text-sm leading-tight whitespace-pre-line text-white">
            {previewId ? kcLabel(previewId) : "—"}
          </div>
          <button
            className="btn btn-sm border-none bg-white/90 font-medium text-brand-background hover:bg-white disabled:bg-white/20 disabled:text-white/40"
            disabled={!canApply}
            onClick={() => composedId && onPick({ qmkId: composedId, label: kcLabel(composedId) })}
          >
            {t("quantumApply")}
          </button>
          {hint && <span className="text-xs opacity-60">{hint}</span>}
        </div>
      </div>
    );
  };

  const cards: ExpandableCardDef[] = groups.map((group, i) => {
    const empty = group.entries.length === 0;
    const kind = kindOf(group.titleKey);
    return {
      key: group.titleKey,
      bg: CARD_BG[i % CARD_BG.length],
      disabled: empty,
      header: (
        <div className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
          <span>{t(group.titleKey)}</span>
          {group.helpKey && (
            <span onClick={(e) => e.stopPropagation()}>
              <HelpIcon text={t(group.helpKey)} variant="light" />
            </span>
          )}
        </div>
      ),
      overlay: (
        <div className="badge badge-sm absolute top-3 right-3 z-10 border-none bg-white/20 font-medium text-white">
          {t("comboCardCount", { n: group.entries.length })}
        </div>
      ),
      hint: empty ? "—" : t(kind === "other" ? "comboCardReveal" : "quantumCardConfigure"),
      body: empty
        ? undefined
        : kind !== "other"
          ? () => composer(group, kind)
          : group.sections
            ? () => (
                <div className="flex flex-col gap-3">
                  {group.sections!.map((section, s) => (
                    <div key={section.titleKey} className="flex flex-col gap-2">
                      <div className="flex items-center gap-1 text-xs font-semibold tracking-wide uppercase opacity-60">
                        <span>{t(section.titleKey)}</span>
                        {section.helpKey && <HelpIcon text={t(section.helpKey)} variant="light" />}
                      </div>
                      <div className="combo-num-grid flex flex-wrap gap-2">
                        {section.entries.map((entry, j) => keyButton(entry, s === 0 ? j : j + 4))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            : () => (
                <div className="combo-num-grid flex flex-wrap gap-2">
                  {group.entries.map((entry, j) => keyButton(entry, j))}
                </div>
              ),
    };
  });

  return (
    <ExpandableCardColumn
      cards={cards}
      idPrefix="quantumcard"
      expandedWidth="w-[26rem]"
      growLeft
      onExpandedChange={resetComposer}
    />
  );
}
