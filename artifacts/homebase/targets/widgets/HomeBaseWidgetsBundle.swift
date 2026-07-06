import SwiftUI
import WidgetKit

// Task #487 — one extension, two display-only widgets: "Next Job" and
// "Earned Today". Both draw from the same shared App Group data written by
// the RN app (lib/widgetData.ts) and can self-refresh over the network.
@main
struct HomeBaseWidgetsBundle: WidgetBundle {
    var body: some Widget {
        NextJobWidget()
        EarningsWidget()
    }
}
