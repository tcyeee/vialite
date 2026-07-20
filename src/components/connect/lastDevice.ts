// Remembers only the name of the most recently connected keyboard, so the
// waiting screen can offer a one-click "重新连接 <name>" shortcut instead of
// always sending the user through the WebHID chooser again. This is purely a
// display/UX hint — the actual reconnect still goes through
// navigator.hid.getDevices() and a real Vial handshake, so a stale or wrong
// name here can't cause a bad connection, only a missing/misleading button.
//
// Uses the `vialite-` prefix so SiteSettingsPanel's "清空缓存" wipe (which
// removes every localStorage key with that prefix) clears it for free.
const STORAGE_KEY = "vialite-last-device";

export function saveLastDeviceName(name: string | undefined): void {
  if (!name) return;
  window.localStorage.setItem(STORAGE_KEY, name);
}

export function loadLastDeviceName(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function clearLastDeviceName(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

// Marks that the user explicitly disconnected, so a page reload lands on the
// waiting screen instead of the mount-time auto-reconnect effect silently
// re-attaching the same board. This used to be done by revoking the WebHID
// grant itself (`HIDDevice.forget()`) — effective, but it also erased the
// device from navigator.hid.getDevices(), which broke the "重新连接 <name>"
// shortcut (nothing left to reconnect to) and forced the picker dialog back
// on the next real connect. A plain flag gets the same "don't auto-reconnect"
// outcome without touching the underlying permission grant. Cleared as soon
// as the user connects again (manually or via the shortcut) — see
// attachTransport in App.tsx — so auto-reconnect resumes trusting future
// reloads from that point on.
const SKIP_AUTOCONNECT_KEY = "vialite-skip-autoconnect";

export function markSkipAutoConnect(): void {
  window.localStorage.setItem(SKIP_AUTOCONNECT_KEY, "1");
}

export function shouldSkipAutoConnect(): boolean {
  return window.localStorage.getItem(SKIP_AUTOCONNECT_KEY) === "1";
}

export function clearSkipAutoConnect(): void {
  window.localStorage.removeItem(SKIP_AUTOCONNECT_KEY);
}
