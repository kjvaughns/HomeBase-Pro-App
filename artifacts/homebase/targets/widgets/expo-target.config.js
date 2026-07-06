/**
 * Task #487 — Home screen & lock screen widgets.
 *
 * Defines the native iOS WidgetKit extension target (built via
 * @bacons/apple-targets + `expo prebuild`). This directory is NOT part of
 * the React Native bundle — everything in here is plain Swift/SwiftUI that
 * ships as its own app extension.
 *
 * Two widgets live in one extension (one WidgetBundle): "Next Job" and
 * "Earned Today". Both read from the App Group shared storage the RN app
 * writes to (see lib/widgetData.ts) and can also self-refresh over the
 * network using the public /api/public/widget-snapshot endpoint.
 */

const APP_GROUP = "group.com.homebasepro.app.widgets";

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "HomeBaseWidgets",
  displayName: "HomeBase",
  frameworks: ["SwiftUI", "WidgetKit"],
  // Lock-screen accessory widget families (accessoryRectangular/Inline)
  // require iOS 16+; the main app itself keeps its lower deploymentTarget.
  deploymentTarget: "16.0",
  entitlements: {
    "com.apple.security.application-groups": [APP_GROUP],
  },
});

module.exports.APP_GROUP = APP_GROUP;
