import SwiftUI
import WidgetKit

struct NextJobEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct NextJobProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextJobEntry {
        NextJobEntry(
            date: Date(),
            snapshot: WidgetSnapshot(
                businessName: "HomeBase Pro",
                nextJob: NextJobInfo(scheduledDate: ISO8601DateFormatter().string(from: Date()), scheduledTime: "10:00 AM", clientName: "Sarah K."),
                earnedTodayCents: 0,
                updatedAt: nil
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (NextJobEntry) -> Void) {
        completion(NextJobEntry(date: Date(), snapshot: WidgetDataStore.readSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextJobEntry>) -> Void) {
        Task {
            let snapshot = await WidgetDataStore.fetchLatestSnapshot()
            let entry = NextJobEntry(date: Date(), snapshot: snapshot)
            // Ask iOS to try again in 30 minutes — actual cadence is governed
            // by WidgetKit's per-app refresh budget.
            let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
        }
    }
}

private func formatJobTime(_ job: NextJobInfo) -> String {
    guard let time = job.scheduledTime, !time.isEmpty else { return "Today" }
    return time
}

struct NextJobWidgetView: View {
    var entry: NextJobProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if let job = entry.snapshot?.nextJob {
            content(job: job)
        } else {
            emptyState
        }
    }

    @ViewBuilder
    private func content(job: NextJobInfo) -> some View {
        switch family {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Next job")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(formatJobTime(job))
                    .font(.headline)
                Text(job.clientName)
                    .font(.caption)
                    .lineLimit(1)
            }
        case .accessoryInline:
            Text("\(formatJobTime(job)) · \(job.clientName)")
        default:
            VStack(alignment: .leading, spacing: 6) {
                Label("Next Job", systemImage: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 2)
                Text(formatJobTime(job))
                    .font(.title2.bold())
                Text(job.clientName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .padding(4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        switch family {
        case .accessoryRectangular, .accessoryInline:
            Text("No jobs scheduled")
                .font(.caption)
        default:
            VStack(alignment: .leading, spacing: 6) {
                Label("Next Job", systemImage: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 2)
                Text("No jobs scheduled")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

struct NextJobWidget: Widget {
    let kind: String = "NextJobWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextJobProvider()) { entry in
            NextJobWidgetView(entry: entry)
                .widgetBackground()
        }
        .configurationDisplayName("Next Job")
        .description("Shows your next scheduled job's time and client.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
    }
}
