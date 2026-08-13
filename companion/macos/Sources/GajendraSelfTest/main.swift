import Foundation
import GajendraKit

@main
enum GajendraSelfTest {
    static func main() async throws {
        let snapshot = try JSONDecoder().decode(DeckSnapshot.self, from: Data(fixture.utf8))
        try require(snapshot.current?.id == "codex:focus-1", "current thread did not decode")
        try require(snapshot.focus.filter(\.isCurrent).count == 1, "NOW must remain singular")
        try require(snapshot.current?.deepLink == "codex://threads/focus-1", "deep link changed")
        try require(snapshot.sources.count == 2, "thread sources did not decode")

        let data = try JSONEncoder().encode(DeckMutation.setLevel(threadId: "codex:focus-1", level: nil))
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SelfTestError.failed("mutation did not encode as an object")
        }
        try require(object["type"] as? String == "set-level", "mutation type changed")
        try require(object["threadId"] as? String == "codex:focus-1", "mutation thread ID changed")
        try require(object["level"] is NSNull, "removal must encode an explicit null level")
        let visibleFrame = CGRect(x: 0, y: 25, width: 1512, height: 950)
        let pillOrigin = GajendraOverlayPlacement.bottomTrailingOrigin(
            windowSize: CGSize(width: 60, height: 60),
            visibleFrame: visibleFrame
        )
        try require(pillOrigin == CGPoint(x: 1434, y: 43), "pill placement changed")
        let cardOrigin = GajendraOverlayPlacement.cardOrigin(
            cardSize: CGSize(width: 404, height: 310),
            pillFrame: CGRect(origin: pillOrigin, size: CGSize(width: 60, height: 60)),
            visibleFrame: visibleFrame
        )
        try require(cardOrigin == CGPoint(x: 1090, y: 113), "hover card placement changed")
        let clampedCardOrigin = GajendraOverlayPlacement.cardOrigin(
            cardSize: CGSize(width: 404, height: 310),
            pillFrame: CGRect(x: -20, y: 43, width: 60, height: 60),
            visibleFrame: CGRect(x: 0, y: 25, width: 1512, height: 950)
        )
        try require(clampedCardOrigin.x == 12, "hover card must stay inside the visible screen")
        var hover = GajendraHoverState()
        try require(!hover.wantsCardVisible, "card must start hidden")
        hover.setPillHovered(true)
        try require(hover.wantsCardVisible, "pill hover must reveal the card")
        hover.setPillHovered(false)
        hover.setCardHovered(true)
        try require(hover.wantsCardVisible, "card hover must keep details visible")
        hover.setCardHovered(false)
        try require(!hover.wantsCardVisible, "card must hide after both hover targets exit")
        try await verifyQueuedRefresh(with: snapshot)
        try await verifyQueuedMutation(with: snapshot)
        print("Gaja companion self-test passed")
    }

    private static func verifyQueuedMutation(with snapshot: DeckSnapshot) async throws {
        let probe = RefreshProbe(snapshot: snapshot)
        let model = await DeckViewModel(client: probe)
        let mutation = DeckMutation.setCollapsed(level: .focus, collapsed: true)
        await model.refresh()
        await model.apply(mutation)

        for _ in 0..<50 {
            try await Task.sleep(for: .milliseconds(10))
            let mutations = await probe.mutations()
            let isLoading = await model.isLoading
            if mutations == [mutation] && !isLoading { return }
        }
        throw SelfTestError.failed("mutation requested during refresh was dropped")
    }

    private static func verifyQueuedRefresh(with snapshot: DeckSnapshot) async throws {
        let probe = RefreshProbe(snapshot: snapshot)
        let model = await DeckViewModel(client: probe)
        await model.refresh()
        await model.refresh()

        for _ in 0..<50 {
            try await Task.sleep(for: .milliseconds(10))
            let requestCount = await probe.requestCount()
            let isLoading = await model.isLoading
            if requestCount == 2 && !isLoading {
                let currentId = await model.snapshot?.current?.id
                try require(currentId == snapshot.current?.id, "queued refresh changed the snapshot")
                return
            }
        }
        throw SelfTestError.failed("refresh requested during an active load was not queued exactly once")
    }

    private actor RefreshProbe: DeckServing {
        private let result: DeckSnapshot
        private var requests = 0
        private var receivedMutations: [DeckMutation] = []

        init(snapshot: DeckSnapshot) {
            result = snapshot
        }

        func snapshot() async throws -> DeckSnapshot {
            requests += 1
            try await Task.sleep(for: .milliseconds(35))
            return result
        }

        func mutate(_ mutation: DeckMutation) async throws -> DeckSnapshot {
            receivedMutations.append(mutation)
            return result
        }

        func requestCount() -> Int {
            requests
        }

        func mutations() -> [DeckMutation] {
            receivedMutations
        }
    }

    private static func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        if !condition() { throw SelfTestError.failed(message) }
    }

    private enum SelfTestError: LocalizedError {
        case failed(String)

        var errorDescription: String? {
            switch self {
            case let .failed(message): return message
            }
        }
    }

    private static let fixture = #"""
    {
      "generatedAt": "2026-08-12T00:00:00Z",
      "current": {
        "id": "codex:focus-1", "sourceId": "codex", "sourceName": "Codex", "title": "Current", "project": "Fixture", "updatedAt": 1,
        "status": "idle", "level": "focus", "isCurrent": true,
        "deepLink": "codex://threads/focus-1", "resumeCommand": null
      },
      "focus": [{
        "id": "codex:focus-1", "sourceId": "codex", "sourceName": "Codex", "title": "Current", "project": "Fixture", "updatedAt": 1,
        "status": "idle", "level": "focus", "isCurrent": true,
        "deepLink": "codex://threads/focus-1", "resumeCommand": null
      }],
      "important": [], "available": [],
      "collapsed": {"focus": false, "important": false},
      "focusGuide": 5, "focusOverGuide": false, "staleEntryCount": 0,
      "source": "fixture",
      "sources": [
        {"id":"codex","name":"Codex","kind":"codex-app-server","state":"ready","enabled":true,"threadCount":1,"detail":null},
        {"id":"claude","name":"Claude","kind":"claude-jsonl","state":"disabled","enabled":false,"threadCount":0,"detail":null}
      ],
      "error": null
    }
    """#
}
