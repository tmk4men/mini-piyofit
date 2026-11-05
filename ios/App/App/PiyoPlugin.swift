import Foundation
import Capacitor
import HealthKit
import StoreKit
import UserNotifications
import WidgetKit

/// 歩数・買い切り・通知・ウィジェット。Web 側の入り口は src/native/bridge.ts
@objc(PiyoPlugin)
public class PiyoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PiyoPlugin"
    public let jsName = "Piyo"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestSteps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dailySteps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "productPrice", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleHungry", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pushWidget", returnType: CAPPluginReturnPromise),
    ]

    static let productId = "app.piyogohan.unlock"
    static let appGroup = "group.app.piyogohan.app"

    private let health = HKHealthStore()
    private var stepType: HKQuantityType { HKQuantityType.quantityType(forIdentifier: .stepCount)! }

    // MARK: 歩数（iPhone が記録している歩数を、開いた時にまとめて読む）

    @objc func requestSteps(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { return call.resolve(["ok": false]) }
        health.requestAuthorization(toShare: nil, read: [stepType]) { ok, _ in
            call.resolve(["ok": ok])
        }
    }

    /// from（"2026-11-5" の形）から今日までの、日ごとの歩数。最大14日
    @objc func dailySteps(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { return call.resolve(["days": []]) }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let oldest = cal.date(byAdding: .day, value: -13, to: today)!
        let from = Self.parseDay(call.getString("from") ?? "") ?? today
        let start = max(from, oldest)
        let query = HKStatisticsCollectionQuery(
            quantityType: stepType,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: Date()),
            options: .cumulativeSum,
            anchorDate: today,
            intervalComponents: DateComponents(day: 1)
        )
        query.initialResultsHandler = { _, results, _ in
            var days: [[String: Any]] = []
            results?.enumerateStatistics(from: start, to: Date()) { stat, _ in
                let steps = stat.sumQuantity()?.doubleValue(for: .count()) ?? 0
                days.append(["day": Self.dayKey(stat.startDate), "steps": Int(steps)])
            }
            call.resolve(["days": days])
        }
        health.execute(query)
    }

    /// JS の dayKey と同じ形（ゼロ埋めなし）
    static func dayKey(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return "\(c.year!)-\(c.month!)-\(c.day!)"
    }

    static func parseDay(_ s: String) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }

    // MARK: 買い切り（StoreKit 2）

    @objc func productPrice(_ call: CAPPluginCall) {
        Task {
            let product = try? await Product.products(for: [Self.productId]).first
            call.resolve(["price": product?.displayPrice ?? NSNull()])
        }
    }

    @objc func buy(_ call: CAPPluginCall) {
        Task {
            do {
                guard let product = try await Product.products(for: [Self.productId]).first else {
                    return call.resolve(["result": "error"])
                }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let tx) = verification else { return call.resolve(["result": "error"]) }
                    await tx.finish()
                    call.resolve(["result": "ok"])
                case .userCancelled:
                    call.resolve(["result": "cancel"])
                case .pending:
                    call.resolve(["result": "cancel"])
                @unknown default:
                    call.resolve(["result": "error"])
                }
            } catch {
                call.resolve(["result": "error"])
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["result": await Self.owned() ? "ok" : "none"])
            } catch {
                call.resolve(["result": "error"])
            }
        }
    }

    @objc func entitled(_ call: CAPPluginCall) {
        Task { call.resolve(["owned": await Self.owned()]) }
    }

    static func owned() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.productID == productId, tx.revocationDate == nil { return true }
        }
        return false
    }

    // MARK: 通知（サーバーなし。端末の中で予約する）

    @objc func requestNotify(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { ok, _ in
            call.resolve(["ok": ok])
        }
    }

    @objc func scheduleHungry(_ call: CAPPluginCall) {
        let id = "hungry"
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [id])
        let delay = (call.getDouble("at") ?? 0) / 1000 - Date().timeIntervalSince1970
        guard delay > 60 else { return call.resolve() }
        let content = UNMutableNotificationContent()
        content.body = "\(call.getString("name") ?? "ぴよこ")が おなか すかせてるよ"
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger)) { _ in call.resolve() }
    }

    // MARK: ウィジェット

    @objc func pushWidget(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        defaults?.set([
            "name": call.getString("name") ?? "ぴよこ",
            "image": call.getString("image") ?? "piyo.webp",
            "hunger": call.getDouble("hunger") ?? 50,
            "mood": call.getDouble("mood") ?? 50,
            "away": call.getBool("away") ?? false,
            "at": call.getDouble("at") ?? 0,
        ] as [String: Any], forKey: "pet")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
