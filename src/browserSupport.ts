export type SupportStatus = "supported" | "insecure" | "unsupported" | "inapp";

/**
 * Chat apps and social apps (WeChat, QQ, Weibo, DingTalk, Feishu/Lark,
 * Facebook, Instagram, Line, TikTok, ...) open links in an embedded WebView.
 * Some of those WebViews expose `navigator.hid` yet the device-chooser never
 * appears — `requestDevice()` just resolves to an empty array — so a bare
 * `"hid" in navigator` check wrongly reports them as supported and the user
 * only ever sees "no device selected". Match the known ones by UA so we can
 * tell them to reopen the page in a real browser instead.
 */
function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || "";
  return /MicroMessenger|\bQQ\/|QQBrowser\/|\bWeibo|DingTalk|Lark\/|FBAN|FBAV|Instagram|\bLine\/|SnapChat|TikTok|musical_ly|BytedanceWebview|KAKAOTALK|\bWhatsApp|\bDouyin/i.test(
    ua,
  );
}

/**
 * WebHID is only exposed in secure contexts, so a missing navigator.hid can
 * mean either "this browser can't do it" or "this page was served over plain
 * HTTP" — the user needs a different message for each. An in-app WebView is a
 * third case that's checked first because it can present `navigator.hid` while
 * still being unable to actually open the device picker.
 */
export function getSupportStatus(): SupportStatus {
  if (isInAppBrowser()) {
    return "inapp";
  }
  if ("hid" in navigator) {
    return "supported";
  }
  if (!window.isSecureContext) {
    return "insecure";
  }
  return "unsupported";
}

export interface BrowserInfo {
  /** Human-readable engine/brand name, e.g. "Edge", "Chrome", "Safari". */
  name: string;
  /** Major(.minor) version string, or "?" when it can't be parsed. */
  version: string;
}

/**
 * Best-effort browser name + version from the UA string, for the connect-screen
 * diagnostics panel. Order matters: Edge/Opera/Vivaldi/Brave all embed
 * "Chrome" in their UA, so they must be matched before the generic Chrome case,
 * and Chrome itself embeds "Safari". This is for troubleshooting display only —
 * it never gates behavior, so a wrong guess is harmless.
 */
export function getBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent || "";
  const match = (re: RegExp): string => ua.match(re)?.[1] ?? "?";

  if (/Edg\//.test(ua)) return { name: "Edge", version: match(/Edg\/([\d.]+)/) };
  if (/OPR\//.test(ua)) return { name: "Opera", version: match(/OPR\/([\d.]+)/) };
  if (/Vivaldi\//.test(ua)) return { name: "Vivaldi", version: match(/Vivaldi\/([\d.]+)/) };
  if (/Firefox\//.test(ua)) return { name: "Firefox", version: match(/Firefox\/([\d.]+)/) };
  if (/Chrome\//.test(ua)) return { name: "Chrome", version: match(/Chrome\/([\d.]+)/) };
  if (/Version\/[\d.]+.*Safari/.test(ua)) return { name: "Safari", version: match(/Version\/([\d.]+)/) };
  return { name: "Unknown", version: "?" };
}
