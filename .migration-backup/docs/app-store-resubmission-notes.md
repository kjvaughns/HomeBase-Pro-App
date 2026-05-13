# App Store resubmission notes — build after 1.0 (36)

This is paste-in copy for the human submitter. The agent does not (and cannot)
edit App Store Connect.

## 1. App Description — append at the bottom

Open App Store Connect → App → App Information → App Description, scroll to the
bottom, and append (on its own paragraph, after a blank line):

```
Terms of Use (EULA): https://homebaseproapp.com/terms
Privacy Policy: https://homebaseproapp.com/privacy
```

## 2. EULA configuration

Keep the standard Apple EULA (Apple's default). Do **not** upload a custom EULA
in the App Information → License Agreement field. The link in the App
Description above plus the in-app links on the Subscription screen
(Subscription → "Terms of Use (EULA)") satisfy Guideline 3.1.2(c).

## 3. Privacy Policy URL field

In App Store Connect → App Information → Privacy Policy URL, ensure the value
is:

```
https://homebaseproapp.com/privacy
```

(Not just in the description — Apple also requires this dedicated field to be
populated.)

## 4. App Review Information — review notes

In the App Review Information → Notes field for this submission, paste:

```
Re: Guideline 2.1(a) — iPad Air 11" responsiveness.
The previous build had absolute-fill BlurView and tint overlays inside the
floating tab bar and several card components that were not opted out of touch
handling. On iPadOS 26 with the new React Native architecture, those overlays
intercepted taps after sign-in. We added pointerEvents="none" to every
absolute-fill BlurView and tint overlay (tab bar, FAB, cards, gate modals) and
added presentationStyle="overFullScreen" + statusBarTranslucent to all
transparent Modals so iPad does not centre-card them. Verified on iPad-sized
viewport: bottom tabs, the floating + FAB, in-screen Pressables, More tab rows,
"Add Job", "Add Invoice", and the Subscription Subscribe button all respond to
a single tap in both portrait and landscape, on both provider and homeowner
sides.

Re: Guideline 3.1.2(c) — EULA metadata.
The Subscription screen now renders the Terms of Use (EULA), Privacy Policy,
and Contact support links directly above the Subscribe / Manage button on
every state (free, grace_period, expired, subscribed), in addition to the
existing footer row below the card. The App Description has been updated to
also include a public Terms of Use URL alongside the existing Privacy Policy
URL, and the Privacy Policy URL field is populated. We are keeping Apple's
standard EULA — no custom EULA is being uploaded.
```
