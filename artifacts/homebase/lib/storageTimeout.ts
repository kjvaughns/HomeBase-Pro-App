/**
 * On web, AsyncStorage falls back to an IndexedDB-backed implementation.
 * In some sandboxed / headless browser contexts (e.g. third-party iframes,
 * automated testing browsers, certain privacy modes) IndexedDB requests can
 * hang indefinitely without ever resolving or rejecting. Since app startup
 * gates rendering on storage hydration finishing, a hung request would leave
 * the app stuck on a blank screen forever. This wraps a promise with a
 * timeout fallback so hydration always completes.
 */
export function withStorageTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 2500): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, timeoutMs);

    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      },
    );
  });
}
