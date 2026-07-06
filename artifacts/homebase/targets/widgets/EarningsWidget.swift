import SwiftUI
import WidgetKit

struct EarningsEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct EarningsProvider: TimelineProvider {
    func placeholder(in context: Context) -> EarningsEntry {
        EarningsEntry(
            date: Date(),
            snapshot: WidgetSnapshot(businessName: "HomeBase Pro", nextJob: nil, earnedTodayCents: 34000, updatedAt: nil)
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (EarningsEntry) -> Void) {
        completion(EarningsEntry(date: Date(), snapshot: WidgetDataStore.readSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EarningsEntry>) -> Void) {
        Task {
            let snapshot = await WidgetDataStore.fetchLatestSnapshot()
            let entry = EarningsEntry(date: Date(), snapshot: snapshot)
            let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
        }
    }
}

private func formatDollars(_ cents: Int) -> String {
    let dollars = Double(cents) / 100.0
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.maximumFractionDigits = dollars.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
    return formatter.string(from: NSNumber(value: dollars)) ?? "$0"
}

struct EarningsWidgetView: View {
    var entry: EarningsProvider.Entry
    @Environment(\.widgetFamily) var family

    private var earnedTodayCents: Int {
        entry.snapshot?.earnedTodayCents ?? 0
    }

    var body: some View {
        switch family {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Earned today")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(formatDollars(earnedTodayCents))
                    .font(.headline)
            }
        case .accessoryInline:
            Text("Earned today: \(formatDollars(earnedTodayCents))")
        default:
            VStack(alignment: .leading, spacing: 6) {
                Label("Earned Today", systemImage: "dollarsign.circle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 2)
                Text(formatDollars(earnedTodayCents))
                    .font(.title.bold())
            }
            .padding(4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

struct EarningsWidget: Widget {
    let kind: String = "EarningsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: EarningsProvider()) { entry in
            EarningsWidgetView(entry: entry)
                .widgetBackground()
        }
        .configurationDisplayName("Earned Today")
        .description("Shows how much you've earned so far today.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
    }
}
