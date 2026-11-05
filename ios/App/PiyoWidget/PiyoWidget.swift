import SwiftUI
import WidgetKit
import UIKit

private let hungerPerHour = 100.0 / 48.0 // src/game/rules.ts の HUNGER_EMPTY_H と合わせる

struct PiyoEntry: TimelineEntry {
    let date: Date
    let name: String
    let image: String
    let hunger: Double
    let away: Bool
    let hasPet: Bool
}

struct PiyoProvider: TimelineProvider {
    func load(at date: Date) -> PiyoEntry {
        let d = UserDefaults(suiteName: "group.app.piyogohan.app")?.dictionary(forKey: "pet")
        guard let d else { return PiyoEntry(date: date, name: "", image: "piyo", hunger: 70, away: false, hasPet: false) }
        let savedAt = (d["at"] as? Double ?? 0) / 1000
        let hours = max(0, date.timeIntervalSince1970 - savedAt) / 3600
        let base = (d["image"] as? String ?? "piyo.webp").replacingOccurrences(of: ".webp", with: "")
        return PiyoEntry(
            date: date,
            name: d["name"] as? String ?? "ぴよこ",
            image: base,
            hunger: max(0, (d["hunger"] as? Double ?? 50) - hungerPerHour * hours),
            away: d["away"] as? Bool ?? false,
            hasPet: true
        )
    }
    func placeholder(in context: Context) -> PiyoEntry {
        PiyoEntry(date: Date(), name: "ぴよこ", image: "piyo", hunger: 70, away: false, hasPet: true)
    }
    func getSnapshot(in context: Context, completion: @escaping (PiyoEntry) -> Void) {
        completion(load(at: Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PiyoEntry>) -> Void) {
        let now = Date()
        // おなかは 時間で 減るので、先の 12時間ぶんを 1時間ごとに 作っておく
        let entries = (0..<12).map { load(at: now.addingTimeInterval(Double($0) * 3600)) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct PiyoWidgetView: View {
    let entry: PiyoEntry
    var line: String {
        if !entry.hasPet { return "たまごが まってるよ" }
        if entry.away { return "むかえに きてね" }
        if entry.hunger <= 0 { return "まってるよ" }
        if entry.hunger < 25 { return "おなか すいた…" }
        return entry.name
    }
    var body: some View {
        VStack(spacing: 4) {
            if entry.away {
                Text("手紙").font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 0.43, green: 0.31, blue: 0.24))
                    .padding(.horizontal, 22).padding(.vertical, 26)
                    .background(Color.white).cornerRadius(6).rotationEffect(.degrees(-4))
            } else if let img = UIImage(named: entry.hasPet ? entry.image : "piyo_egg") {
                Image(uiImage: img).resizable().scaledToFit().opacity(entry.hunger <= 0 ? 0.65 : 1)
            }
            Text(line)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(red: 0.43, green: 0.31, blue: 0.24))
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .padding(10)
    }
}

@main
struct PiyoWidget: Widget {
    private let bg = Color(red: 1.0, green: 0.95, blue: 0.9)
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PiyoWidget", provider: PiyoProvider()) { entry in
            if #available(iOS 17.0, *) {
                PiyoWidgetView(entry: entry).containerBackground(bg, for: .widget)
            } else {
                PiyoWidgetView(entry: entry).background(bg)
            }
        }
        .configurationDisplayName("ぴよごはん")
        .description("ホーム画面で いつも いっしょ")
        .supportedFamilies([.systemSmall])
    }
}
