import { Linking, Platform } from "react-native";

type UrlSource = string | (() => Promise<string>);

/**
 * Open an external URL in the system browser, working around two web pitfalls:
 *
 * 1. `Linking.openURL` on web sets `window.location` of the current document.
 *    Stripe-hosted pages reply with `X-Frame-Options: DENY`, so when the app
 *    is running inside an iframe (e.g. the canvas preview) the navigation is
 *    silently blocked. We use `window.open(url, "_blank")` instead so the
 *    page always opens in a new top-level tab.
 *
 * 2. Popup blockers reject `window.open(...)` if it is called after an
 *    `await` resolves, because the user-gesture context has been lost. To
 *    survive that, callers can pass a function that fetches the URL — we
 *    open a blank tab synchronously inside the click handler, then assign
 *    `tab.location.href` once the URL is known. If the fetch rejects we
 *    close the blank tab.
 *
 * Native platforms are unchanged — they keep using `Linking.openURL`, which
 * launches the system browser (Safari / Chrome) and satisfies App Store
 * guidelines for out-of-app payments.
 */
export async function openExternalUrl(source: UrlSource): Promise<void> {
  if (Platform.OS === "web") {
    // IMPORTANT: do NOT pass "noopener" / "noreferrer" in the features arg —
    // some browsers null out the returned handle when those flags are set,
    // which would force us to fall back to `window.location.href` and get
    // blocked by `X-Frame-Options: DENY` inside iframes (e.g. canvas
    // preview). We need a usable handle so we can navigate the new tab
    // after the URL resolves. We re-add `opener = null` after navigation
    // for the same security guarantee.
    const tab =
      typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;

    try {
      const url = typeof source === "string" ? source : await source();
      if (tab) {
        try {
          tab.opener = null;
        } catch {
          // Some browsers throw on cross-origin opener writes — safe to ignore.
        }
        tab.location.href = url;
      } else if (typeof window !== "undefined") {
        // Last-resort fallback: popup blocker prevented the new tab AND we're
        // not in an iframe (otherwise X-Frame-Options would silently kill
        // this). Better than a fully-silent failure.
        window.location.href = url;
      } else {
        throw new Error("Unable to open external URL");
      }
    } catch (err) {
      if (tab && !tab.closed) tab.close();
      throw err;
    }
    return;
  }

  const url = typeof source === "string" ? source : await source();
  await Linking.openURL(url);
}
