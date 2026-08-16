import Foundation
import GajendraKit

@main
enum GajendraSelfTest {
    static func main() async throws {
        let snapshot = try JSONDecoder().decode(DeckSnapshot.self, from: Data(fixture.utf8))
        try require(snapshot.current?.id == "codex:focus-1", "current thread did not decode")
        try require(snapshot.focus.filter(\.isCurrent).count == 1, "NOW must remain singular")
        try require(snapshot.current?.deepLink == "codex://threads/focus-1", "deep link changed")
        try require(snapshot.current?.context == .design, "thread context did not decode")
        try require(snapshot.sources.count == 2, "thread sources did not decode")
        try require(DeckThread.isRunningStatus("active"), "active provider status must be treated as running")
        try require(DeckThread.isRunningStatus("in-progress"), "normalized in-progress status must be treated as running")
        try require(!DeckThread.isRunningStatus("resumable"), "resumable metadata must not be inferred as running")
        try require(!DeckThread.isRunningStatus("notLoaded"), "unloaded provider metadata must not be inferred as running")
        let activeNow = DeckThread(
            id: "codex:focus-1", sourceId: "codex", sourceName: "Codex", title: "Current", project: "Fixture",
            updatedAt: 4, status: "active", level: .focus, isCurrent: true, deepLink: "codex://threads/focus-1"
        )
        let activeImportant = DeckThread(
            id: "cursor:important-1", sourceId: "cursor", sourceName: "Cursor", title: "Important active", project: "Fixture",
            updatedAt: 3, status: "running", level: .important, isCurrent: false, deepLink: "cursor://threads/important-1"
        )
        let activeAvailable = DeckThread(
            id: "claude:available-1", sourceId: "claude", sourceName: "Claude", title: "Available active", project: "Fixture",
            updatedAt: 2, status: "working", level: nil, isCurrent: false, deepLink: "claude://threads/available-1"
        )
        let inclusiveSnapshot = DeckSnapshot(
            generatedAt: snapshot.generatedAt,
            current: activeNow,
            focus: [activeNow],
            important: [activeImportant],
            available: [activeAvailable],
            collapsed: snapshot.collapsed,
            focusGuide: snapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: snapshot.source,
            sources: snapshot.sources,
            error: nil
        )
        try require(
            inclusiveSnapshot.runningThreads.map(\.id) == [activeNow.id, activeImportant.id, activeAvailable.id],
            "Running must include NOW, Important, and unprioritized active threads"
        )
        try require(inclusiveSnapshot.searchThreads("cursor").map(\.id) == [activeImportant.id], "global thread search must match providers")
        try require(inclusiveSnapshot.searchThreads("active cursor").map(\.id) == [activeImportant.id], "global thread search must match every metadata term")
        let duplicateFocusCurrent = DeckThread(
            id: activeImportant.id,
            sourceId: activeImportant.sourceId,
            sourceName: activeImportant.sourceName,
            title: activeImportant.title,
            project: activeImportant.project,
            updatedAt: activeImportant.updatedAt,
            status: activeImportant.status,
            level: .focus,
            isCurrent: true,
            deepLink: activeImportant.deepLink
        )
        let duplicateImportantCurrent = DeckThread(
            id: activeAvailable.id,
            sourceId: activeAvailable.sourceId,
            sourceName: activeAvailable.sourceName,
            title: activeAvailable.title,
            project: activeAvailable.project,
            updatedAt: activeAvailable.updatedAt,
            status: activeAvailable.status,
            level: .important,
            isCurrent: true,
            deepLink: activeAvailable.deepLink
        )
        let malformedSelection = DeckSnapshot(
            generatedAt: snapshot.generatedAt,
            current: activeNow,
            focus: [activeNow, duplicateFocusCurrent],
            important: [duplicateImportantCurrent],
            available: [],
            collapsed: snapshot.collapsed,
            focusGuide: snapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: snapshot.source,
            sources: snapshot.sources,
            error: nil
        )
        try require(
            (malformedSelection.focus + malformedSelection.important).filter(\.isCurrent).map(\.id) == [activeNow.id],
            "snapshot normalization must keep exactly one selected NOW task"
        )
        try require(
            snapshot.available.first?.resumeCommand
                == ResumeCommand(executable: "/usr/local/bin/claude", arguments: ["--resume", "claude-1"], cwd: "/tmp/project"),
            "service resume-command args did not decode"
        )

        let data = try JSONEncoder().encode(DeckMutation.setLevel(threadId: "codex:focus-1", level: nil))
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SelfTestError.failed("mutation did not encode as an object")
        }
        try require(object["type"] as? String == "set-level", "mutation type changed")
        try require(object["threadId"] as? String == "codex:focus-1", "mutation thread ID changed")
        try require(object["level"] is NSNull, "removal must encode an explicit null level")
        let contextData = try JSONEncoder().encode(DeckMutation.setContext(threadId: "codex:focus-1", context: .engineering))
        guard let contextObject = try JSONSerialization.jsonObject(with: contextData) as? [String: Any] else {
            throw SelfTestError.failed("context mutation did not encode as an object")
        }
        try require(contextObject["type"] as? String == "set-context", "context mutation type changed")
        try require(contextObject["context"] as? String == "engineering", "bounded context did not encode")
        let visibleFrame = CGRect(x: 0, y: 25, width: 1512, height: 950)
        let pillOrigin = GajendraOverlayPlacement.bottomTrailingOrigin(
            windowSize: CGSize(width: 60, height: 60),
            visibleFrame: visibleFrame
        )
        try require(pillOrigin == CGPoint(x: 1434, y: 43), "pill placement changed")
        let expectedAnchorOrigins: [GajendraPillAnchor: CGPoint] = [
            .topLeading: CGPoint(x: 18, y: 897),
            .topTrailing: CGPoint(x: 1434, y: 897),
            .center: CGPoint(x: 726, y: 470),
            .bottomLeading: CGPoint(x: 18, y: 43),
            .bottomCenter: CGPoint(x: 726, y: 43),
            .bottomTrailing: CGPoint(x: 1434, y: 43),
        ]
        for anchor in GajendraPillAnchor.allCases {
            let anchorOrigin = GajendraOverlayPlacement.origin(
                for: anchor,
                windowSize: CGSize(width: 60, height: 60),
                visibleFrame: visibleFrame
            )
            try require(anchorOrigin == expectedAnchorOrigins[anchor], "\(anchor.title) hotspot placement changed")
            let maximumCardSize = GajendraOverlayPlacement.cardMaximumSize(
                for: anchor,
                pillSize: CGSize(width: 60, height: 60),
                visibleFrame: visibleFrame
            )
            let cardSize = CGSize(
                width: min(660, maximumCardSize.width),
                height: min(610, maximumCardSize.height)
            )
            let pillFrame = CGRect(origin: anchorOrigin, size: CGSize(width: 60, height: 60))
            let anchoredCardOrigin = GajendraOverlayPlacement.cardOrigin(
                cardSize: cardSize,
                pillFrame: pillFrame,
                visibleFrame: visibleFrame,
                anchor: anchor
            )
            try require(
                !CGRect(origin: anchoredCardOrigin, size: cardSize).intersects(pillFrame),
                "\(anchor.title) card must open inward without covering the launcher"
            )
        }
        try require(
            GajendraOverlayPlacement.nearestAnchor(
                to: CGPoint(x: 710, y: 44),
                windowSize: CGSize(width: 60, height: 60),
                visibleFrame: visibleFrame
            ) == .bottomCenter,
            "manual movement must snap to the nearest hotspot"
        )
        try require(
            !GajendraOverlayPlacement.isMeaningfulDrag(CGSize(width: 2, height: 3)),
            "micro movement must not reposition the launcher"
        )
        try require(
            GajendraOverlayPlacement.isMeaningfulDrag(CGSize(width: 6, height: 0)),
            "an intentional drag must reposition the launcher"
        )
        let cardOrigin = GajendraOverlayPlacement.cardOrigin(
            cardSize: CGSize(width: 428, height: 326),
            pillFrame: CGRect(origin: pillOrigin, size: CGSize(width: 60, height: 60)),
            visibleFrame: visibleFrame
        )
        try require(cardOrigin == CGPoint(x: 1066, y: 113), "hover card placement changed")
        let clampedCardOrigin = GajendraOverlayPlacement.cardOrigin(
            cardSize: CGSize(width: 428, height: 326),
            pillFrame: CGRect(x: -20, y: 43, width: 60, height: 60),
            visibleFrame: CGRect(x: 0, y: 25, width: 1512, height: 950)
        )
        try require(clampedCardOrigin.x == 12, "hover card must stay inside the visible screen")
        let topPillFrame = CGRect(x: 1_434, y: 907, width: 60, height: 60)
        let belowTopPillOrigin = GajendraOverlayPlacement.cardOrigin(
            cardSize: CGSize(width: 660, height: 610),
            pillFrame: topPillFrame,
            visibleFrame: visibleFrame
        )
        let topCardFrame = CGRect(origin: belowTopPillOrigin, size: CGSize(width: 660, height: 610))
        try require(!topCardFrame.intersects(topPillFrame), "hover card must move below a top-edge launcher instead of covering it")
        let referenceCardSize = GajendraHoverCardSizing.size(
            for: .comfortable,
            visibleFrame: CGRect(x: 0, y: 0, width: 1512, height: 949)
        )
        try require(referenceCardSize == CGSize(width: 660, height: 610), "14-inch reference card size changed")
        let compactCardSize = GajendraHoverCardSizing.size(
            for: .compact,
            visibleFrame: CGRect(x: 0, y: 0, width: 1512, height: 949)
        )
        let expandedCardSize = GajendraHoverCardSizing.size(
            for: .expanded,
            visibleFrame: CGRect(x: 0, y: 0, width: 1512, height: 949)
        )
        try require(compactCardSize.width < referenceCardSize.width, "Compact must be narrower than Comfortable")
        try require(expandedCardSize.width > referenceCardSize.width, "Expanded must be wider than Comfortable")
        let smallDisplayCardSize = GajendraHoverCardSizing.size(
            for: .expanded,
            visibleFrame: CGRect(x: 0, y: 0, width: 620, height: 500)
        )
        try require(
            smallDisplayCardSize.width <= 596 && smallDisplayCardSize.height <= 476,
            "card size must clamp to a small display's visible frame"
        )
        let smallVisibleFrame = CGRect(x: 0, y: 0, width: 620, height: 500)
        let smallCenterPillOrigin = GajendraOverlayPlacement.origin(
            for: .center,
            windowSize: CGSize(width: 60, height: 60),
            visibleFrame: smallVisibleFrame
        )
        let smallCenterMaximum = GajendraOverlayPlacement.cardMaximumSize(
            for: .center,
            pillSize: CGSize(width: 60, height: 60),
            visibleFrame: smallVisibleFrame
        )
        let smallCenterCardSize = CGSize(
            width: min(smallDisplayCardSize.width, smallCenterMaximum.width),
            height: min(smallDisplayCardSize.height, smallCenterMaximum.height)
        )
        let smallCenterPillFrame = CGRect(
            origin: smallCenterPillOrigin,
            size: CGSize(width: 60, height: 60)
        )
        let smallCenterCardOrigin = GajendraOverlayPlacement.cardOrigin(
            cardSize: smallCenterCardSize,
            pillFrame: smallCenterPillFrame,
            visibleFrame: smallVisibleFrame,
            anchor: .center
        )
        try require(
            !CGRect(origin: smallCenterCardOrigin, size: smallCenterCardSize).intersects(smallCenterPillFrame),
            "center hotspot must keep the card away from the launcher on a small display"
        )
        let movedPillOrigin = GajendraOverlayPlacement.clampedOrigin(
            windowSize: CGSize(width: 60, height: 60),
            proposedOrigin: CGPoint(x: -400, y: 2_000),
            visibleFrame: visibleFrame
        )
        try require(movedPillOrigin == CGPoint(x: 8, y: 907), "dragged pill must clamp to the visible screen")
        let pointerStart = GajendraOverlayPlacement.pointerStart(
            pointerLocation: CGPoint(x: 1_205, y: 85),
            gestureTranslation: CGSize(width: -25, height: -25)
        )
        try require(
            pointerStart == CGPoint(x: 1_230, y: 60),
            "first drag event must reconstruct the global pointer start without losing motion"
        )
        let globallyDraggedOrigin = GajendraOverlayPlacement.draggedOrigin(
            startOrigin: CGPoint(x: 1_200, y: 40),
            pointerStart: CGPoint(x: 1_230, y: 70),
            pointerLocation: CGPoint(x: -760, y: 420)
        )
        try require(
            globallyDraggedOrigin == CGPoint(x: -790, y: 390),
            "pill drag must use stable global pointer coordinates across displays"
        )
        var cardPresentation = GajendraCardPresentationState()
        try require(!cardPresentation.isPresented, "card must start hidden")
        try require(cardPresentation.toggle(), "the first icon click must present the card")
        try require(cardPresentation.isPresented, "the card must stay presented without hover state")
        try require(!cardPresentation.toggle(), "the second icon click must dismiss the card")
        try require(!cardPresentation.isPresented, "the card must remain hidden after click dismissal")
        try require(!cardPresentation.dismiss(), "dismissing an already-hidden card must be idempotent")
        try require(cardPresentation.toggle(), "the card must reopen on a later click")
        try require(cardPresentation.dismiss(), "outside click or Escape must dismiss a presented card")
        try await MainActor.run {
            let editController = GajendraPillEditController()
            try require(!editController.acceptsDrag, "pill drag must be locked before the double-click edit transition")
            try require(!editController.requestHide(), "pill hide must be locked before the double-click edit transition")
            editController.toggle()
            try require(
                !editController.dismissIfOutside(
                    point: CGPoint(x: 25, y: 25),
                    pillFrame: CGRect(x: 0, y: 0, width: 60, height: 60)
                ),
                "clicking the pill must preserve edit mode"
            )
            try require(editController.isEditing, "an inside click unexpectedly ended edit mode")
            try require(
                editController.dismissIfOutside(
                    point: CGPoint(x: -1, y: 25),
                    pillFrame: CGRect(x: 0, y: 0, width: 60, height: 60)
                ),
                "an outside click must end edit mode"
            )
            try require(!editController.isEditing, "outside dismissal left edit mode active")
            editController.enter()
            try require(editController.requestHide(), "edit mode must expose the pill hide action")
            try require(!editController.acceptsDrag, "hiding the pill must leave edit mode")
            editController.enter()
            editController.exit()
            try require(!editController.acceptsDrag, "Escape must leave pill edit mode")
        }
        try await verifyVisualSettings()
        try await verifySourceOnboarding()
        try await verifyQueuedRefresh(with: snapshot)
        try await verifyQueuedMutation(with: snapshot)
        print("Gaja companion self-test passed")
    }

    private static func verifyVisualSettings() async throws {
        try await MainActor.run {
            try require(GajendraVisualTheme.allCases == [.nativePopover, .focusDeck], "exactly two production themes must remain available")
            let suiteName = "gajendra-visual-settings-\(UUID().uuidString)"
            guard let defaults = UserDefaults(suiteName: suiteName) else {
                throw SelfTestError.failed("could not create isolated visual-settings store")
            }
            defer { defaults.removePersistentDomain(forName: suiteName) }

            var settings = GajendraVisualSettings(defaults: defaults)
            try require(settings.theme == .nativePopover, "Native Popover must be the default theme")
            try require(settings.appearance == .automatic, "Auto must be the default appearance")
            try require(settings.hoverCardSize == .comfortable, "Comfortable must be the default hover-card size")
            try require(settings.pillAnchor == .bottomTrailing, "Bottom Right must be the default launcher hotspot")
            settings.theme = .focusDeck
            settings.appearance = .dark
            settings.hoverCardSize = .expanded
            settings.pillAnchor = .bottomCenter
            settings = GajendraVisualSettings(defaults: defaults)
            try require(settings.theme == .focusDeck, "theme choice did not survive reinitialization")
            try require(settings.appearance == .dark, "appearance choice did not survive reinitialization")
            try require(settings.hoverCardSize == .expanded, "hover-card size did not survive reinitialization")
            try require(settings.pillAnchor == .bottomCenter, "launcher hotspot did not survive reinitialization")
            defaults.set("command-capsule", forKey: GajendraVisualSettings.themeKey)
            defaults.set("sepia", forKey: GajendraVisualSettings.appearanceKey)
            defaults.set("cinema", forKey: GajendraVisualSettings.hoverCardSizeKey)
            defaults.set("floating-middle", forKey: GajendraVisualSettings.pillAnchorKey)
            settings = GajendraVisualSettings(defaults: defaults)
            try require(settings.theme == .nativePopover, "invalid theme must fall back safely")
            try require(settings.appearance == .automatic, "invalid appearance must fall back safely")
            try require(settings.hoverCardSize == .comfortable, "invalid hover-card size must fall back safely")
            try require(settings.pillAnchor == .bottomTrailing, "invalid launcher hotspot must fall back safely")
            try require(GajendraAppearance.automatic.appKitName == nil, "Auto must follow the system appearance")
            try require(GajendraAppearance.light.appKitName == .aqua, "Light must map to Aqua")
            try require(GajendraAppearance.dark.appKitName == .darkAqua, "Dark must map to Dark Aqua")
        }
    }

    private static func verifySourceOnboarding() async throws {
        try await MainActor.run {
            let freshSuite = "gajendra-source-onboarding-fresh-\(UUID().uuidString)"
            guard let freshDefaults = UserDefaults(suiteName: freshSuite) else {
                throw SelfTestError.failed("could not create isolated first-launch onboarding store")
            }
            defer { freshDefaults.removePersistentDomain(forName: freshSuite) }
            let freshState = GajendraSourceOnboardingState(defaults: freshDefaults)
            try require(
                freshState.shouldPresentOnLaunch(hasPriorNativeState: false),
                "a clean first launch must present source onboarding"
            )
            try require(!freshState.isCompleted, "presenting onboarding must not silently complete it")
            freshState.markCompleted()
            try require(freshState.isCompleted, "onboarding completion did not persist")
            try require(
                !freshState.shouldPresentOnLaunch(hasPriorNativeState: false),
                "completed onboarding must not present twice"
            )

            let upgradeSuite = "gajendra-source-onboarding-upgrade-\(UUID().uuidString)"
            guard let upgradeDefaults = UserDefaults(suiteName: upgradeSuite) else {
                throw SelfTestError.failed("could not create isolated upgrade onboarding store")
            }
            defer { upgradeDefaults.removePersistentDomain(forName: upgradeSuite) }
            let upgradeState = GajendraSourceOnboardingState(defaults: upgradeDefaults)
            try require(
                !upgradeState.shouldPresentOnLaunch(hasPriorNativeState: true),
                "an existing native installation must not receive an unsolicited onboarding window"
            )
            try require(upgradeState.isCompleted, "the existing-user migration must remain completed")

            let codex = ThreadSourceStatus(
                id: "codex",
                name: "Codex",
                kind: "codex-app-server",
                state: "ready",
                enabled: true,
                threadCount: 3
            )
            let configuredError = ThreadSourceStatus(
                id: "configured-sources",
                name: "Configured sources",
                kind: "configured",
                state: "error",
                enabled: false,
                threadCount: 0,
                detail: "Invalid catalog"
            )
            let custom = ThreadSourceStatus(
                id: "windsurf",
                name: "Windsurf",
                kind: "configured",
                state: "disabled",
                enabled: false,
                threadCount: 0
            )
            try require(GajendraSourceOnboardingCopy.isToggleable(codex), "Codex onboarding must expose source enablement")
            try require(!GajendraSourceOnboardingCopy.isToggleable(configuredError), "the registry error row must not be toggleable")
            try require(GajendraSourceOnboardingCopy.isToggleable(custom), "configured supported agents must be toggleable")
            try require(
                GajendraSourceOnboardingCopy.connectionMethod(for: custom).contains("bounded local catalog"),
                "configured agents must disclose their bounded local catalog"
            )
            try require(
                GajendraSourceOnboardingCopy.detail(for: codex) == "3 threads available",
                "ready source thread counts must use accurate copy"
            )
        }
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
        "context": "design",
        "deepLink": "codex://threads/focus-1", "resumeCommand": null
      },
      "focus": [{
        "id": "codex:focus-1", "sourceId": "codex", "sourceName": "Codex", "title": "Current", "project": "Fixture", "updatedAt": 1,
        "status": "idle", "level": "focus", "isCurrent": true,
        "context": "design",
        "deepLink": "codex://threads/focus-1", "resumeCommand": null
      }],
      "important": [],
      "available": [{
        "id": "claude:claude-1", "sourceId": "claude", "sourceName": "Claude Code", "title": "Claude task", "project": "Fixture", "updatedAt": 1,
        "status": "resumable", "level": null, "isCurrent": false,
        "context": null,
        "deepLink": "gajendra://thread/claude%3Aclaude-1",
        "resumeCommand": {"executable":"/usr/local/bin/claude","args":["--resume","claude-1"],"cwd":"/tmp/project"}
      }],
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
