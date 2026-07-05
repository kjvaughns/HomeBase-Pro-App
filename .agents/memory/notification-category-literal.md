---
name: notificationService category literal
description: dispatchNotification's category argument is a strict TypeScript union, not free text — must match one of the defined categories.
---

`artifacts/api-server/src/notificationService.ts` defines:

```ts
type NotificationCategory = 'bookings' | 'invoices' | 'messages' | 'reminders';
```

Any call to `dispatchNotification(userId, title, body, eventKey, data, category)` must pass one of these four exact strings. Passing an ad-hoc string like `"payments"` or `"earnings"` compiles fine at the call site (string literal) but fails `tsc --noEmit` with a TS2345 mismatch against `NotificationCategory | undefined`.

**Why:** This has caused typecheck regressions when adding new notification call sites for money-related events (autopay failures, payouts, etc.) — the natural English word for the concept ("payments", "earnings") is not in the union; the closest existing bucket is usually `'invoices'`.

**How to apply:** Before adding a new `dispatchNotification(...)` call, grep for `type NotificationCategory` to check current valid values, and pick the closest existing bucket rather than inventing a new category string.
