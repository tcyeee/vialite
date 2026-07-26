// Thin wrapper over the Goatcounter script loaded in index.html.
//
// Vialite is a single-page app with no URL routing, so Goatcounter's default
// script only ever reports one pageview per session. This module adds explicit
// event counts for the actions that actually matter (connect success, which
// feature view is used, .vil import/export, matrix tester) via Goatcounter's
// custom-event API: `goatcounter.count({ path, title, event: true })`.
//
// Everything here is best-effort and must never throw into the app: analytics
// is optional (an ad-blocker or offline load leaves `window.goatcounter`
// undefined), so failures are swallowed. Events fired before the async script
// has finished loading are queued and flushed once it appears.

interface GoatcounterCount {
  path: string;
  title?: string;
  event?: boolean;
}

interface Goatcounter {
  count?: (vars: GoatcounterCount) => void;
}

declare global {
  interface Window {
    goatcounter?: Goatcounter;
  }
}

const queue: GoatcounterCount[] = [];

function flush(): boolean {
  const count = window.goatcounter?.count;
  if (!count) {
    return false;
  }
  while (queue.length > 0) {
    const vars = queue.shift()!;
    try {
      count(vars);
    } catch {
      // Ignore — analytics must never break the app.
    }
  }
  return true;
}

/**
 * Report a custom event. `path` is a stable slug (e.g. "connect/success" or
 * "view/macro"); `title` is an optional human-readable label shown in the
 * Goatcounter dashboard. No-ops if the Goatcounter script is unavailable.
 */
export function track(path: string, title?: string): void {
  queue.push({ path, title: title ?? path, event: true });
  if (!flush()) {
    // Script not ready yet (async load). Retry shortly; drop quietly if it
    // never arrives (e.g. blocked by an ad-blocker) so nothing accumulates.
    setTimeout(flush, 2000);
  }
}
