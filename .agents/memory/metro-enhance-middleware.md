---
name: Metro enhanceMiddleware scope
description: metro.config.js enhanceMiddleware cannot intercept the HTML document — Expo Express serves it before Metro.
---

## Rule
Do not use `config.server.enhanceMiddleware` in `metro.config.js` to intercept or modify the HTML document served at `/`. It only applies to Metro's bundle-serving layer, which never sees HTML requests.

**Why:** In Expo SDK 55, `expo start` runs two layers:
1. **Expo Express** — handles `GET /` (the HTML document), generated from an internal template
2. **Metro bundler** — handles `/*.bundle` requests, static assets, HMR

`config.server.enhanceMiddleware` wraps Metro's request handler (layer 2). By the time a `/` request would reach Metro, Expo Express (layer 1) has already handled it and returned the response. The middleware is never invoked for HTML requests.

**How to apply:** If you need to customize the initial HTML:
- `web/index.html` overrides do NOT work in dev mode (Expo SDK 55 ignores them when `output: "single"`).
- `output: "static"` in app.json enables SSR-generated HTML per route but may need guards for browser-only APIs.
- In dev mode, the blank-before-JS state is unavoidable for `output: "single"` SPAs — the `<script>` tag uses `defer`, and the screenshot tool captures the empty-`#root` state.
