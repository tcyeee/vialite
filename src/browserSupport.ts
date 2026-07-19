export type SupportStatus = "supported" | "insecure" | "unsupported" | "inapp";

/**
 * Chat apps and social apps (WeChat, QQ, Weibo, Alipay, DingTalk, Feishu/Lark,
 * Baidu, UC, Facebook, Instagram, Line, TikTok, ...) open links in an embedded
 * WebView. Some of those WebViews expose `navigator.hid` yet the device-chooser
 * never appears — `requestDevice()` just resolves to an empty array — so a bare
 * `"hid" in navigator` check wrongly reports them as supported and the user
 * only ever sees "no device selected". Match the known ones by UA so we can
 * tell them to reopen the page in a real browser instead.
 *
 * Two layers: a whitelist of per-app UA tokens (most reliable, gives a specific
 * "reopen in your browser" message), then an Android-WebView fallback — real
 * Chrome never carries the `; wv)` marker, so any Chromium UA that does is an
 * embedded WebView we haven't enumerated. iOS in-app browsers are all WKWebView
 * with a Safari-like UA and no `wv` marker, but iOS has no WebHID at all so
 * those fall through to `unsupported` anyway and need no special-casing here.
 */
const IN_APP_UA =
  /MicroMessenger|\bQQ\/|QQBrowser\/|\bWeibo|AlipayClient|DingTalk|Lark\/|Feishu|baiduboxapp|BaiduHD|UCBrowser|UBrowser|Kwai|ksNebula|FBAN|FBAV|Instagram|\bLine\/|SnapChat|TikTok|musical_ly|aweme|BytedanceWebview|KAKAOTALK|\bWhatsApp|\bDouyin/i;

/** Android System WebView marker; real Chrome/Edge/Opera never include it. */
const ANDROID_WEBVIEW_UA = /;\s*wv\)/i;

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || "";
  return IN_APP_UA.test(ua) || ANDROID_WEBVIEW_UA.test(ua);
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
 * and Chrome itself embeds "Safari". An in-app WebView reports its Chromium
 * version truthfully, so we tag the name with "(in-app)" to make the diagnostics
 * panel show why WebHID might be missing. This is for troubleshooting display
 * only — it never gates behavior, so a wrong guess is harmless.
 */
export function getBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent || "";
  const match = (re: RegExp): string => ua.match(re)?.[1] ?? "?";
  const tag = (name: string): string => (isInAppBrowser() ? `${name} (in-app)` : name);

  if (/Edg\//.test(ua)) return { name: tag("Edge"), version: match(/Edg\/([\d.]+)/) };
  if (/OPR\//.test(ua)) return { name: tag("Opera"), version: match(/OPR\/([\d.]+)/) };
  if (/Vivaldi\//.test(ua)) return { name: tag("Vivaldi"), version: match(/Vivaldi\/([\d.]+)/) };
  if (/Firefox\//.test(ua)) return { name: tag("Firefox"), version: match(/Firefox\/([\d.]+)/) };
  if (/Chrome\//.test(ua)) return { name: tag("Chrome"), version: match(/Chrome\/([\d.]+)/) };
  if (/Version\/[\d.]+.*Safari/.test(ua)) return { name: tag("Safari"), version: match(/Version\/([\d.]+)/) };
  return { name: tag("Unknown"), version: "?" };
}
