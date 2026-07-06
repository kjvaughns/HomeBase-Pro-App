import Foundation
import SwiftUI
import WidgetKit

extension View {
    /// `.containerBackground(_:for:)` is iOS 17+; this extension supports a
    /// 16.0 deploymentTarget for lock-screen accessory widgets, so fall back
    /// to a plain background modifier on iOS 16.
    @ViewBuilder
    func widgetBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(.background, for: .widget)
        } else {
            self.background(Color(.systemBackground))
        }
    }
}

// App Group identifier — must match `APP_GROUP` in expo-target.config.js
// and `WIDGET_APP_GROUP` in lib/widgetData.ts.
let appGroupId = "group.com.homebasepro.app.widgets"

// Keys written by the RN app via `ExtensionStorage` (lib/widgetData.ts).
private enum StorageKey {
    static let auth = "widgetAuth"
    static let snapshot = "widgetSnapshot"
}

/// Auth/config blob written by the app the first time it syncs widget data.
/// Lets the widget refresh itself over the network without the app running.
struct WidgetAuth: Codable {
    let providerId: String
    let token: String
    let apiBaseUrl: String
}

struct NextJobInfo: Codable {
    let scheduledDate: String
    let scheduledTime: String?
    let clientName: String
}

/// Matches the response shape of GET /api/public/widget-snapshot.
struct WidgetSnapshot: Codable {
    let businessName: String?
    let nextJob: NextJobInfo?
    let earnedTodayCents: Int
    let updatedAt: Double?
}

enum WidgetDataStore {
    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    static func readAuth() -> WidgetAuth? {
        guard let raw = defaults?.string(forKey: StorageKey.auth),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetAuth.self, from: data)
    }

    static func readSnapshot() -> WidgetSnapshot? {
        guard let raw = defaults?.string(forKey: StorageKey.snapshot),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    /// Caches the latest server response locally so the widget still has
    /// something to show if a later network refresh fails (e.g. offline).
    static func writeSnapshot(_ snapshot: WidgetSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot),
              let raw = String(data: data, encoding: .utf8) else { return }
        defaults?.set(raw, forKey: StorageKey.snapshot)
    }

    /// Tries a live network fetch first (so widgets stay fresh even if the
    /// app hasn't been opened in a while); falls back to the last cached
    /// snapshot the app or a previous widget refresh wrote.
    static func fetchLatestSnapshot() async -> WidgetSnapshot? {
        if let auth = readAuth(),
           var components = URLComponents(string: auth.apiBaseUrl + "api/public/widget-snapshot") {
            components.queryItems = [
                URLQueryItem(name: "providerId", value: auth.providerId),
                URLQueryItem(name: "token", value: auth.token),
            ]
            if let url = components.url {
                do {
                    let (data, response) = try await URLSession.shared.data(from: url)
                    if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                        let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
                        writeSnapshot(snapshot)
                        return snapshot
                    }
                } catch {
                    // Network unavailable / server error — fall through to cache.
                }
            }
        }
        return readSnapshot()
    }
}
