let getSessionTokenImpl: () => string | null = () => null;
let onExpiryImpl: () => void = () => {};
let sessionExpiryHandled = false;
let lastSessionTokenSeen: string | null = null;

export function registerSessionHandlers(opts: {
  getSessionToken: () => string | null;
  onExpiry: () => void;
}): void {
  getSessionTokenImpl = opts.getSessionToken;
  onExpiryImpl = opts.onExpiry;
}

export function getSessionToken(): string | null {
  return getSessionTokenImpl();
}

export function handleSessionExpiry(): void {
  const sessionToken = getSessionTokenImpl();
  if (!sessionToken) return;
  if (sessionExpiryHandled && lastSessionTokenSeen === sessionToken) return;
  sessionExpiryHandled = true;
  lastSessionTokenSeen = sessionToken;
  setTimeout(() => {
    try {
      onExpiryImpl();
    } catch (err) {
      console.error("[sessionExpiry] logout failed:", err);
    }
    setTimeout(() => {
      sessionExpiryHandled = false;
    }, 1000);
  }, 0);
}
