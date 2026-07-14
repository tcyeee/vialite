export function isBrowserSupported(): boolean {
  return "hid" in navigator;
}
