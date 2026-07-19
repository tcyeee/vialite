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
