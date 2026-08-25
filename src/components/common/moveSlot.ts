/**
 * Clears the slot an entry just moved out of, after the write to its new slot already landed.
 * Shared by ComboPanel's and TapDancePanel's `moveTo`: the move is two separate device round
 * trips, so if this second write (clearing the old slot) fails, the entry is now duplicated on
 * the device rather than moved — that failure is surfaced distinctly via `duplicatedMessage`
 * rather than folded into the generic write-error path.
 */
export async function clearOldSlotAfterMove(
  clearOldSlot: () => Promise<void>,
  onWriteError: (err: unknown) => void,
  duplicatedMessage: string,
): Promise<void> {
  try {
    await clearOldSlot();
  } catch (err) {
    onWriteError(new Error(`${duplicatedMessage}: ${err instanceof Error ? err.message : String(err)}`));
  }
}
