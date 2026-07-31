import { useI18n } from "../../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { qualifiedLabelParts } from "./keycodeMeta.ts";

/**
 * The "<category> / <label>" naming of a keycode, rendered rather than returned as a string: the
 * category and the "/" separating it sit back in a muted grey so what the eye lands on is the key
 * name itself, the category reading as the qualifier it is. Used by every place that shows the
 * qualified form — the cascade selector's trigger button and the read-only field displays — so
 * they all weight the two halves the same way.
 */
export function QualifiedKeyLabel({
  qmkId,
  categories,
}: {
  qmkId: string;
  /** Scoped catalogue, forwarded to {@link qualifiedLabelParts} — a filtered picker names a key
   *  only by a category it actually offers. */
  categories?: { name: string; entries: KeycodeDef[] }[];
}) {
  const { t } = useI18n();
  const { category, label } = qualifiedLabelParts(t, qmkId, categories);
  if (!category) return <>{label}</>;
  return (
    <>
      {/* `mx-1` rather than literal spaces: the field boxes render with `whitespace-pre-line`,
          which collapses runs of spaces, so the gaps have to come from the layout. */}
      <span className="font-normal opacity-45">{category}</span>
      <span className="mx-1 font-normal opacity-45">/</span>
      {label}
    </>
  );
}
