export type SupportStatus = "supported" | "insecure" | "unsupported";

/**
 * WebHID is only exposed in secure contexts, so a missing navigator.hid can
 * mean either "this browser can't do it" or "this page was served over plain
 * HTTP" — the user needs a different message for each.
 */
export function getSupportStatus(): SupportStatus {
  if ("hid" in navigator) {
    return "supported";
  }
  if (!window.isSecureContext) {
    return "insecure";
  }
  return "unsupported";
}
