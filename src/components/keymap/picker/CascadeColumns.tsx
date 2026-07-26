import type { RefObject } from "react";
import { Icon } from "@iconify/react";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { CATEGORY_ICON_FALLBACK, categoryIcon } from "./keycodeMeta.ts";
import type { Category, MiddleGroup, MiddleItem } from "./cascadeGrouping.ts";

/** Icons for the two promoted clear keycodes in the first-level column. */
const CLEAR_ICONS: Record<string, string> = {
  KC_NO: "mdi:eraser",
  KC_TRNS: "mdi:arrow-down-circle-outline",
};

interface Props {
  /** Measured to decide which side the info panel opens on — see
   *  `KeycodeCascadeSelector`'s layout effects. */
  columnsRef: RefObject<HTMLDivElement | null>;
  clearEntries: KeycodeDef[];
  categories: Category[];
  activeCat: string | null;
  activeEntryId: string | null;
  pickedId: string | null;
  activeMiddle: MiddleItem[];
  activeGroup: MiddleGroup | null;
  activeGroupKey: string | null;
  catLabel: (name: string) => string;
  entryLabel: (entry: KeycodeDef) => string;
  groupLabel: (g: MiddleGroup) => string;
  subItemLabel: (sub: { entry: KeycodeDef; arg?: string }) => string;
  isConfigured: (qmkId: string) => boolean;
  /** Hovering a clear action (KC_NO/KC_TRNS): these belong to no category, so
   *  the middle/sub columns collapse and only the info panel follows. */
  onHoverClear: (qmkId: string) => void;
  /** Hovering a sub-column entry (a group's parameterised variant). */
  onHoverSub: (qmkId: string) => void;
  selectCat: (name: string) => void;
  seed: (loc: { group: string | null; qmkId: string | null }) => void;
  commit: (entry: KeycodeDef) => void;
}

/**
 * The cascade's up-to-three selection columns — clear actions + categories,
 * the active category's keycodes/groups, and an expanded group's sub-column —
 * as one bordered card. Extracted from `KeycodeCascadeSelector`, which owns
 * all the hover/click state this just renders against.
 */
export function CascadeColumns({
  columnsRef,
  clearEntries,
  categories,
  activeCat,
  activeEntryId,
  pickedId,
  activeMiddle,
  activeGroup,
  activeGroupKey,
  catLabel,
  entryLabel,
  groupLabel,
  subItemLabel,
  isConfigured,
  onHoverClear,
  onHoverSub,
  selectCat,
  seed,
  commit,
}: Props) {
  return (
    <div
      ref={columnsRef}
      className="flex overflow-hidden rounded-box bg-base-100 shadow ring-1 ring-base-content/10"
    >
      <ul
        data-lenis-prevent
        className="menu menu-sm max-h-72 w-36 flex-nowrap overflow-y-auto border-r border-base-content/10 p-1"
      >
        {/* 清空 / 穿透: committed straight from the first level (they need no
            drill-in), separated from the categories below by a rule so they
            read as actions rather than another category. */}
        {clearEntries.map((entry) => (
          <li key={entry.qmkId}>
            <button
              type="button"
              className={`justify-start ${
                activeEntryId === entry.qmkId || pickedId === entry.qmkId ? "menu-active" : ""
              }`}
              title={entry.qmkId}
              onMouseEnter={() => onHoverClear(entry.qmkId)}
              onClick={() => commit(entry)}
            >
              <Icon
                icon={CLEAR_ICONS[entry.qmkId] ?? CATEGORY_ICON_FALLBACK}
                className="h-4 w-4 shrink-0 opacity-70"
                aria-hidden="true"
              />
              <span className="truncate">{entryLabel(entry)}</span>
            </button>
          </li>
        ))}
        {clearEntries.length > 0 && (
          <li className="pointer-events-none my-1 border-t border-base-content/10" />
        )}
        {categories.map((c) => (
          <li key={c.name}>
            <button
              type="button"
              className={`flex justify-between ${activeCat === c.name ? "menu-active" : ""}`}
              onMouseEnter={() => selectCat(c.name)}
              onClick={() => selectCat(c.name)}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Icon
                  icon={categoryIcon(c.name)}
                  className="h-4 w-4 shrink-0 opacity-70"
                  aria-hidden="true"
                />
                <span className="truncate">{catLabel(c.name)}</span>
              </span>
              <span className="opacity-50">›</span>
            </button>
          </li>
        ))}
      </ul>
      {/* Middle column: revealed only once a category is active, so opening
          shows just the category column (progressive left→right drill-in). */}
      {activeCat !== null && (
        <ul data-lenis-prevent className="menu menu-sm max-h-72 w-44 flex-nowrap overflow-y-auto p-1">
          {activeMiddle.map((item) =>
            item.kind === "leaf" ? (
              <li key={item.entry.qmkId}>
                <button
                  type="button"
                  className={`justify-start ${item.entry.masked ? "italic" : ""} ${
                    pickedId === item.entry.qmkId ? "menu-active" : ""
                  }`}
                  title={item.entry.title ?? item.entry.qmkId}
                  onMouseEnter={() => seed({ group: null, qmkId: item.entry.qmkId })}
                  onClick={() => commit(item.entry)}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {/* Secondary dot marks macro / tap-dance slots the user has set. */}
                    {isConfigured(item.entry.qmkId) && (
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary" />
                    )}
                    <span className="truncate">{entryLabel(item.entry)}</span>
                  </span>
                </button>
              </li>
            ) : (
              <li key={`group:${item.key}`}>
                <button
                  type="button"
                  className={`flex justify-between ${
                    activeGroupKey === item.key ? "menu-active" : ""
                  }`}
                  onMouseEnter={() =>
                    seed({ group: item.key, qmkId: item.entries[0]?.entry.qmkId ?? null })
                  }
                  onClick={() =>
                    seed({ group: item.key, qmkId: item.entries[0]?.entry.qmkId ?? null })
                  }
                >
                  <span className="truncate">{groupLabel(item)}</span>
                  <span className="opacity-50">›</span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {/* Sub-column: parameterised variants of the expanded group (e.g. the
          target layer for MO/TG/…). Only rendered when a group is active,
          pushing the info panel to the 4th level. */}
      {activeGroup && (
        <ul
          data-lenis-prevent
          className="menu menu-sm max-h-72 w-32 flex-nowrap overflow-y-auto border-l border-base-content/10 p-1"
        >
          {activeGroup.entries.map((sub) => (
            <li key={sub.entry.qmkId}>
              <button
                type="button"
                className={`justify-start ${sub.entry.masked ? "italic" : ""} ${
                  activeEntryId === sub.entry.qmkId ? "menu-active" : ""
                }`}
                title={sub.entry.title ?? sub.entry.qmkId}
                onMouseEnter={() => onHoverSub(sub.entry.qmkId)}
                onClick={() => commit(sub.entry)}
              >
                <span className="truncate">{subItemLabel(sub)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
