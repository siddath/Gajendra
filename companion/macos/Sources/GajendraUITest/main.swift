import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

private enum GajendraUITestError: Error, CustomStringConvertible {
    case failed(String)

    var description: String {
        switch self {
        case let .failed(message): message
        }
    }
}

private struct WindowSnapshot {
    let bounds: CGRect
    let layer: Int
    let isOnScreen: Bool
    let alpha: CGFloat
}

private struct PillHitReceipt {
    let pillFrame: CGRect
    let hitLabel: String
    let hitWindowFrame: CGRect
    let ownerPID: pid_t
}

private struct StoredPriorityState: Decodable, Equatable {
    struct Entry: Decodable, Equatable {
        let threadId: String
        let level: String
    }

    let currentFocusThreadId: String?
    let entries: [Entry]
}

private struct GajendraUIJourneyMetrics {
    let prewarmedRevealMilliseconds: Int
    let coldPopupMilliseconds: Int
    let warmPopupMilliseconds: Int
    let statusItemCompactSurfaceObserved: Bool
}

@main
@MainActor
enum GajendraUITest {
    private static let timeout: TimeInterval = 5
    private static let stableFrameTolerance: CGFloat = 0.5
    // The pre-fix real-window baseline was 454-552 ms. This budget is less than half of the
    // fastest baseline while retaining more than 2x headroom over the measured 80-94 ms repair.
    private static let popupLatencyBudgetMilliseconds = 200

    static func main() {
        do {
            let metrics = try run()
            let scope = ProcessInfo.processInfo.environment["GAJENDRA_UI_TEST_SCOPE"]
            if scope == "running-dock" {
                print(
                    #"{"status":"passed","scope":"running-dock","compactRunningDockControlClick":true,"compactRunningDockDoubleClick":true,"organizerRunningDockControlClick":true,"organizerRunningDockDoubleClick":true}"#
                )
            } else if scope == "widget" {
                print(
                    #"{"status":"passed","scope":"widget","compactReopen":true,"inactiveFirstInteraction":true,"nowCardDoubleClick":true,"statusItemCompactSurfaceObserved":\#(metrics.statusItemCompactSurfaceObserved),"compactRowsNoHandle":true,"stationaryToggle":true,"microMovementReopen":true,"editModeTapRecovery":true,"accessibilityPressRecovery":true,"outerEdgeTarget":true,"taskTapPreservesOpenMode":true,"taskLongPressSelected":true,"continuousHoldDrag":true,"taskRowDragInEditMode":true,"queueDragAndDrop":true,"priorityActions":true,"readyPriorityActions":true,"runningDockControlClick":true,"runningDockDoubleClick":true,"reviewDockDoubleClick":true,"searchUsable":true,"visibleRefreshLifecycleContract":true,"popupLatencyBudgetMet":true,"prewarmedRevealMilliseconds":\#(metrics.prewarmedRevealMilliseconds),"coldPopupMilliseconds":\#(metrics.coldPopupMilliseconds),"warmPopupMilliseconds":\#(metrics.warmPopupMilliseconds)}"#
                )
            } else {
                print(
                    #"{"status":"passed","compactReopen":true,"inactiveFirstInteraction":true,"nowCardDoubleClick":true,"statusItemCompactSurfaceObserved":\#(metrics.statusItemCompactSurfaceObserved),"compactRowsNoHandle":true,"stationaryToggle":true,"microMovementReopen":true,"editModeTapRecovery":true,"accessibilityPressRecovery":true,"outerEdgeTarget":true,"taskTapPreservesOpenMode":true,"taskLongPressSelected":true,"continuousHoldDrag":true,"taskRowDragInEditMode":true,"queueDragAndDrop":true,"priorityActions":true,"readyPriorityActions":true,"dockSingleClickGuard":true,"runningDockControlClick":true,"runningDockDoubleClick":true,"reviewDockDoubleClick":true,"searchUsable":true,"visibleRefreshLifecycleContract":true,"organizerQueueDragAndDrop":true,"organizerNowGuard":true,"organizerRunningDockControlClick":true,"organizerRunningDockDoubleClick":true,"organizerReviewDockDoubleClick":true,"popupLatencyBudgetMet":true,"prewarmedRevealMilliseconds":\#(metrics.prewarmedRevealMilliseconds),"coldPopupMilliseconds":\#(metrics.coldPopupMilliseconds),"warmPopupMilliseconds":\#(metrics.warmPopupMilliseconds)}"#
                )
            }
        } catch {
            fputs("Gajendra UI test failed: \(error)\n", stderr)
            exit(1)
        }
    }

    private static func run() throws -> GajendraUIJourneyMetrics {
        let arguments = Array(CommandLine.arguments.dropFirst())
        guard arguments.count == 3,
              let rawPID = Int32(arguments[0]),
              rawPID > 0 else {
            throw GajendraUITestError.failed("expected a positive Gajendra PID, isolated state path, and app path")
        }
        let stateURL = URL(fileURLWithPath: arguments[1])
        let appURL = URL(fileURLWithPath: arguments[2])
        guard CGPreflightPostEventAccess() else {
            throw GajendraUITestError.failed("the UI test host lacks permission to post pointer events")
        }
        NSRunningApplication(processIdentifier: rawPID)?.activate(options: .activateIgnoringOtherApps)
        Thread.sleep(forTimeInterval: 0.2)
        let originalPointer = CGEvent(source: nil)?.location ?? .zero
        defer { postMove(to: originalPointer) }

        let pill = try waitForPill(pid: rawPID)
        _ = try waitForPillHelp(pid: rawPID, containing: "Click to show or hide priorities")
        Thread.sleep(forTimeInterval: 0.3)

        if ProcessInfo.processInfo.environment["GAJENDRA_UI_TEST_SCOPE"] == "running-dock" {
            try verifyRunningDockControlsOnly(pid: rawPID)
            return GajendraUIJourneyMetrics(
                prewarmedRevealMilliseconds: 0,
                coldPopupMilliseconds: 0,
                warmPopupMilliseconds: 0,
                statusItemCompactSurfaceObserved: false
            )
        }

        let prewarmedRevealMilliseconds = try verifyApplicationReopenSurface(
            pid: rawPID,
            appURL: appURL,
            stateURL: stateURL,
            pill: pill
        )
        let statusItemCompactSurfaceObserved = verifyStatusItemCompactSurface(pid: rawPID)
        try activateFinderAwayFromGajendra(pid: rawPID)

        let coldPopupMilliseconds = try measuredCardOpen(
            pid: rawPID,
            label: "cold stationary open"
        )
        try waitForFocusedCard(pid: rawPID, label: "cold first-interaction card")
        try verifyFirstPresentedPointerInteraction(pid: rawPID)
        try tapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: false, label: "stationary close")

        NSRunningApplication(processIdentifier: rawPID)?.activate(options: .activateIgnoringOtherApps)
        Thread.sleep(forTimeInterval: 0.2)
        let warmPopupMilliseconds = try measuredCardOpen(
            pid: rawPID,
            label: "warm stationary open"
        )
        try tapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: false, label: "warm stationary close")
        guard prewarmedRevealMilliseconds <= popupLatencyBudgetMilliseconds,
              coldPopupMilliseconds <= popupLatencyBudgetMilliseconds,
              warmPopupMilliseconds <= popupLatencyBudgetMilliseconds else {
            throw GajendraUITestError.failed(
                "launcher popup exceeded the \(popupLatencyBudgetMilliseconds)ms measured regression budget; "
                    + "prewarmed=\(prewarmedRevealMilliseconds)ms cold=\(coldPopupMilliseconds)ms warm=\(warmPopupMilliseconds)ms"
            )
        }

        try microMovementTapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: true, label: "micro-movement open")
        try tapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: false, label: "micro-movement close")

        try doubleTapCurrentPill(pid: rawPID)
        _ = try waitForPillHelp(pid: rawPID, containing: "Click to open priorities and finish moving")
        try microMovementTapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: true, label: "edit-mode tap recovery")
        _ = try waitForPillHelp(pid: rawPID, containing: "Click to show or hide priorities")
        try tapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: false, label: "edit-mode recovery close")

        try doubleTapCurrentPill(pid: rawPID)
        let editingButton = try waitForPillHelp(pid: rawPID, containing: "Click to open priorities and finish moving")
        guard AXUIElementPerformAction(editingButton, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("the launcher accessibility press action was unavailable")
        }
        try waitForCard(pid: rawPID, visible: true, label: "accessibility press recovery")
        _ = try waitForPillHelp(pid: rawPID, containing: "Click to show or hide priorities")
        try tapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: false, label: "accessibility recovery close")

        let currentPill = try waitForStablePillFrame(pid: rawPID)
        let outerEdge = CGPoint(x: currentPill.minX + 8, y: currentPill.midY)
        try tap(outerEdge)
        try waitForCard(pid: rawPID, visible: true, label: "outer-edge open")
        try tapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: false, label: "outer-edge recovery close")

        try tapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: true, label: "interaction card open")
        try verifyNowCardDoubleClick(pid: rawPID, stateURL: stateURL)
        try verifyCompactSurfaceRows(pid: rawPID)
        try verifyTaskLongPressAndRowDrag(pid: rawPID, stateURL: stateURL)
        try verifyQueueDrag(pid: rawPID, stateURL: stateURL)
        try verifyTaskTapPreservesOpenMode(pid: rawPID)
        try verifySearch(pid: rawPID)
        try verifyDockControlClick(
            pid: rawPID,
            headerLabel: "Running, 2 active threads",
            controlLabel: "All priority lanes, Running"
        )
        try verifyDockDoubleClick(
            pid: rawPID,
            label: "Running, 2 active threads",
            collapsedValue: "Collapsed"
        )
        try verifyDockDoubleClick(
            pid: rawPID,
            label: "Ready for Review, 1 thread",
            collapsedValue: "Collapsed"
        )
        if ProcessInfo.processInfo.environment["GAJENDRA_UI_TEST_SCOPE"] == "widget" {
            try verifyCompactPriorityActions(pid: rawPID, stateURL: stateURL)
            return GajendraUIJourneyMetrics(
                prewarmedRevealMilliseconds: prewarmedRevealMilliseconds,
                coldPopupMilliseconds: coldPopupMilliseconds,
                warmPopupMilliseconds: warmPopupMilliseconds,
                statusItemCompactSurfaceObserved: statusItemCompactSurfaceObserved
            )
        }
        try verifyOrganizerDrag(pid: rawPID, stateURL: stateURL)
        try tapCurrentPill(pid: rawPID)
        try waitForCard(pid: rawPID, visible: true, label: "priority-action card reopen")
        try verifyCompactPriorityActions(pid: rawPID, stateURL: stateURL)
        return GajendraUIJourneyMetrics(
            prewarmedRevealMilliseconds: prewarmedRevealMilliseconds,
            coldPopupMilliseconds: coldPopupMilliseconds,
            warmPopupMilliseconds: warmPopupMilliseconds,
            statusItemCompactSurfaceObserved: statusItemCompactSurfaceObserved
        )
    }

    private static func verifyApplicationReopenSurface(
        pid: pid_t,
        appURL: URL,
        stateURL: URL,
        pill: CGRect
    ) throws -> Int {
        let probeURL = stateURL
            .deletingLastPathComponent()
            .appendingPathComponent(".gajendra-ui-reopen-received", isDirectory: false)
        try? FileManager.default.removeItem(at: probeURL)
        let reopen = Process()
        reopen.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        reopen.arguments = ["-a", appURL.path]
        try reopen.run()
        reopen.waitUntilExit()
        guard reopen.terminationStatus == 0 else {
            throw GajendraUITestError.failed("Dock reopen trigger did not complete")
        }
        let started = try waitForReopenProbe(at: probeURL)
        _ = try waitForCompactCard(pid: pid, label: "Dock reopen compact card")
        let milliseconds = Int(max(0, ProcessInfo.processInfo.systemUptime - started) * 1_000)
        try closePresentedCard(pid: pid, pill: pill, label: "Dock reopen compact card close")
        fputs("Gajendra UI metric: prewarmed reveal after reopen callback=\(milliseconds)ms\n", stderr)
        return milliseconds
    }

    private static func waitForReopenProbe(at url: URL) throws -> TimeInterval {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let value = try? String(contentsOf: url, encoding: .utf8),
               let uptime = Double(value.trimmingCharacters(in: .whitespacesAndNewlines)) {
                return uptime
            }
            Thread.sleep(forTimeInterval: 0.01)
        } while Date() < deadline
        throw GajendraUITestError.failed("Dock reopen callback was not observed by the isolated app probe")
    }

    private static func verifyStatusItemCompactSurface(pid: pid_t) -> Bool {
        guard let statusItem = try? waitForStatusItem(pid: pid) else {
            fputs(
                "Gajendra UI proof note: system AX tree did not expose the status item; "
                    + "status-item presentation remains an external/manual gate.\n",
                stderr
            )
            return false
        }
        do {
            let frame = try elementFrame(statusItem)
            try tap(frame.center)
            _ = try waitForCompactCard(pid: pid, label: "status-item compact card")
            try tap(frame.center)
            if (try? waitForCard(pid: pid, visible: false, label: "status-item compact card close")) == nil {
                try pressEscape()
                try waitForCard(pid: pid, visible: false, label: "status-item compact card escape close")
            }
            return true
        } catch {
            fputs("Gajendra UI proof note: status-item surface interaction failed: \(error)\n", stderr)
            return false
        }
    }

    private static func activateFinderAwayFromGajendra(pid: pid_t) throws {
        guard let finder = NSRunningApplication.runningApplications(
            withBundleIdentifier: "com.apple.finder"
        ).first else {
            throw GajendraUITestError.failed("Finder was unavailable for the inactive-card interaction proof")
        }
        finder.activate(options: [.activateIgnoringOtherApps])
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if NSRunningApplication(processIdentifier: pid)?.isActive == false { return }
            Thread.sleep(forTimeInterval: 0.02)
        } while Date() < deadline
        throw GajendraUITestError.failed("Gajendra did not yield application activation before the cold-card proof")
    }

    private static func waitForFocusedCard(pid: pid_t, label: String) throws {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let application = AXUIElementCreateApplication(pid)
            if let rawWindow = attribute(application, kAXFocusedWindowAttribute),
               CFGetTypeID(rawWindow) == AXUIElementGetTypeID(),
               let frame = try? elementFrame(rawWindow as! AXUIElement),
               frame.width >= 300,
               frame.height >= 300 {
                return
            }
            Thread.sleep(forTimeInterval: 0.02)
        } while Date() < deadline
        throw GajendraUITestError.failed("the \(label) was visible but never became the focused interaction window")
    }

    private static func verifyFirstPresentedPointerInteraction(pid: pid_t) throws {
        // Do not raise or reactivate Gajendra here. This must be the first pointer sequence after
        // the nonactivating card appears over Finder.
        let source = try waitForStableHittableElement(
            pid: pid,
            label: "Run the drag regression, Synthetic UI Agent, Running now"
        )
        try longPress(try elementFrame(source).center)
        _ = try waitForElement(
            pid: pid,
            label: "Run the drag regression, Synthetic UI Agent, Running now",
            value: "Selected"
        )
        let done = try waitForElement(pid: pid, label: "Done editing priorities")
        guard AXUIElementPerformAction(done, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("the first inactive-card hold could not exit priority editing")
        }
        _ = try waitForElement(
            pid: pid,
            label: "Run the drag regression, Synthetic UI Agent, Running now",
            value: "Ready"
        )
    }

    private static func verifyNowCardDoubleClick(pid: pid_t, stateURL: URL) throws {
        let marker = stateURL
            .deletingLastPathComponent()
            .appendingPathComponent(".gajendra-ui-opened-url", isDirectory: false)
        try? FileManager.default.removeItem(at: marker)
        let nowCard = try waitForElement(
            pid: pid,
            label: "Shape the interaction contract, Synthetic UI Agent, NOW"
        )
        let frame = try elementFrame(nowCard)
        let neutralPoint = CGPoint(
            x: frame.minX + min(90, frame.width * 0.28),
            y: frame.midY
        )
        Thread.sleep(forTimeInterval: 0.7)
        try doubleTap(neutralPoint)

        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let opened = try? String(contentsOf: marker, encoding: .utf8),
               opened == "ui-agent://threads/focus-a" {
                return
            }
            Thread.sleep(forTimeInterval: 0.02)
        } while Date() < deadline
        throw GajendraUITestError.failed("double-clicking the NOW card did not open its exact synthetic thread")
    }

    private static func closePresentedCard(pid: pid_t, pill: CGRect, label: String) throws {
        if let button = pillButton(pid: pid),
           AXUIElementPerformAction(button, kAXPressAction as CFString) == .success,
           (try? waitForCard(pid: pid, visible: false, label: label)) != nil {
            return
        }
        try tap(try waitForStablePillFrame(pid: pid).center)
        if (try? waitForCard(pid: pid, visible: false, label: label)) != nil { return }
        try pressEscape()
        try waitForCard(pid: pid, visible: false, label: "\(label) via Escape")
    }

    private static func verifyCompactSurfaceRows(pid: pid_t) throws {
        let labels = accessibilityLabels(in: AXUIElementCreateApplication(pid), depth: 0)
        let forbidden = labels.filter { label in
            label.hasPrefix("Drag ")
                || label.localizedCaseInsensitiveContains("drag handle")
                || label.localizedCaseInsensitiveContains("ellipsis")
        }
        guard forbidden.isEmpty else {
            throw GajendraUITestError.failed("compact rows exposed a forbidden handle/menu label: \(forbidden)")
        }
        _ = try waitForElement(pid: pid, label: "Verify queue ordering, Synthetic UI Agent")
        _ = try waitForElement(pid: pid, label: "Run the drag regression, Synthetic UI Agent, Running now")
    }

    private static func verifyCompactPriorityActions(pid: pid_t, stateURL: URL) throws {
        let marker = stateURL
            .deletingLastPathComponent()
            .appendingPathComponent(".gajendra-ui-opened-url", isDirectory: false)
        try? FileManager.default.removeItem(at: marker)

        let nowCard = try waitForElement(
            pid: pid,
            label: "Shape the interaction contract, Synthetic UI Agent, NOW"
        )
        try requireNoPriorityMoveOrRemoveAction(on: nowCard)
        try requireElementAbsent(
            pid: pid,
            label: "Move Shape the interaction contract to Important",
            duration: 0.2
        )

        let readyHeader = try waitForStableDockHeader(
            pid: pid,
            label: "Ready for Review, 1 thread",
            value: "Expanded"
        )
        try scrollVertically(at: try elementFrame(readyHeader).center, lines: -8)
        let readyPrimary = try waitForStableHittableElement(
            pid: pid,
            label: "Inspect the finished UI proof, Ready for Review, Task destination",
            value: nil,
            scrollToVisible: true,
            requiresSemanticHit: false
        )
        let readyAddAction = try waitForStableHittableElement(
            pid: pid,
            label: "Add Inspect the finished UI proof to Focus or Important",
            value: nil,
            scrollToVisible: true,
            requiresSemanticHit: false
        )
        try requireSeparatePriorityAndOpenTargets(
            pid: pid,
            priorityAction: readyAddAction,
            primaryRow: readyPrimary,
            phase: "unprioritized Ready for Review row"
        )
        let beforeReadyAdd = try readState(stateURL)
        try openPriorityMenu(readyAddAction)
        try selectPriorityMenuItem(
            pid: pid,
            label: "Add to Important",
            fallbackDownArrowPresses: 2
        )
        try waitForPriorityLaneCounts(
            stateURL,
            entryCount: beforeReadyAdd.entries.count + 1,
            focusCount: priorityEntryCount(beforeReadyAdd, level: "focus"),
            importantCount: priorityEntryCount(beforeReadyAdd, level: "important") + 1,
            currentThreadId: beforeReadyAdd.currentFocusThreadId,
            phase: "adding the Ready for Review row to Important"
        )
        try requireOpenMarkerAbsent(marker, phase: "adding the Ready for Review row to Important")

        let primaryRowLabel = "Build the isolated app, Synthetic UI Agent, Running now"
        let addActionLabel = "Add Build the isolated app to Focus or Important"
        let primaryRow = try waitForStableHittableElement(
            pid: pid,
            label: primaryRowLabel,
            value: nil,
            scrollToVisible: true,
            requiresSemanticHit: false
        )
        let addAction = try waitForStableHittableElement(
            pid: pid,
            label: addActionLabel,
            value: nil,
            scrollToVisible: true,
            requiresSemanticHit: false
        )
        try requireSeparatePriorityAndOpenTargets(
            pid: pid,
            priorityAction: addAction,
            primaryRow: primaryRow,
            phase: "unprioritized Running row"
        )

        let beforeAdd = try readState(stateURL)
        let runningPrimaryCenter = try elementFrame(primaryRow).center
        let runningPriorityCenter = try elementFrame(addAction).center
        try openPriorityMenu(addAction)
        try selectPriorityMenuItem(
            pid: pid,
            label: "Add to Focus",
            fallbackDownArrowPresses: 1
        )
        try waitForPriorityLaneCounts(
            stateURL,
            entryCount: beforeAdd.entries.count + 1,
            focusCount: priorityEntryCount(beforeAdd, level: "focus") + 1,
            importantCount: priorityEntryCount(beforeAdd, level: "important"),
            currentThreadId: beforeAdd.currentFocusThreadId,
            phase: "adding the Running row to Focus"
        )
        try requireOpenMarkerAbsent(marker, phase: "adding the Running row to Focus")

        let moveActionLabel = "Move Build the isolated app to Important"
        let moveAction = try waitForStableHittableElement(
            pid: pid,
            label: moveActionLabel,
            value: nil,
            scrollToVisible: true,
            requiresSemanticHit: false,
            preferredPoint: runningPriorityCenter
        )
        let updatedPrimaryRow = try waitForStableHittableElement(
            pid: pid,
            label: primaryRowLabel,
            value: nil,
            scrollToVisible: true,
            requiresSemanticHit: false,
            preferredPoint: runningPrimaryCenter
        )
        try requireSeparatePriorityAndOpenTargets(
            pid: pid,
            priorityAction: moveAction,
            primaryRow: updatedPrimaryRow,
            phase: "prioritized Running row"
        )

        let beforeMove = try readState(stateURL)
        try tapWithoutSettling(try elementFrame(moveAction).center)
        Thread.sleep(forTimeInterval: 0.35)
        try waitForPriorityLaneCounts(
            stateURL,
            entryCount: beforeMove.entries.count,
            focusCount: priorityEntryCount(beforeMove, level: "focus") - 1,
            importantCount: priorityEntryCount(beforeMove, level: "important") + 1,
            currentThreadId: beforeMove.currentFocusThreadId,
            phase: "moving the Running row to Important"
        )
        try requireOpenMarkerAbsent(marker, phase: "moving the Running row to Important")
    }

    private static func requireNoPriorityMoveOrRemoveAction(on nowCard: AXUIElement) throws {
        var rawActionNames: CFArray?
        guard AXUIElementCopyActionNames(nowCard, &rawActionNames) == .success else {
            throw GajendraUITestError.failed("the NOW row did not expose accessibility actions for the priority-action guard")
        }
        let actionNames = (rawActionNames as? [String]) ?? []
        let forbidden = actionNames.filter { action in
            let normalized = action.lowercased()
            return normalized.contains("move to") || normalized.contains("remove from")
        }
        guard forbidden.isEmpty else {
            throw GajendraUITestError.failed("the NOW row exposed a priority move or remove accessibility action")
        }
    }

    private static func requireSeparatePriorityAndOpenTargets(
        pid: pid_t,
        priorityAction: AXUIElement,
        primaryRow: AXUIElement,
        phase: String
    ) throws {
        let priorityFrame = try elementFrame(priorityAction)
        let primaryFrame = try elementFrame(primaryRow)
        guard !priorityFrame.intersects(primaryFrame) else {
            throw GajendraUITestError.failed("the priority action overlaps its primary Open target for the \(phase)")
        }
        guard let priorityHit = systemElementAtPosition(point: priorityFrame.center),
              let primaryHit = systemElementAtPosition(point: primaryFrame.center) else {
            throw GajendraUITestError.failed("the real window did not expose separate pointer hit targets for the \(phase)")
        }
        var priorityPID: pid_t = 0
        var primaryPID: pid_t = 0
        AXUIElementGetPid(priorityHit, &priorityPID)
        AXUIElementGetPid(primaryHit, &primaryPID)
        guard priorityPID == pid, primaryPID == pid,
              accessibilityLabel(priorityHit) != accessibilityLabel(primaryHit) else {
            throw GajendraUITestError.failed("the priority action and primary Open control were not separate real-window targets for the \(phase)")
        }
    }

    private static func openPriorityMenu(_ action: AXUIElement) throws {
        try tapWithoutSettling(try elementFrame(action).center)
        Thread.sleep(forTimeInterval: 0.18)
    }

    private static func selectPriorityMenuItem(
        pid: pid_t,
        label: String,
        fallbackDownArrowPresses: Int
    ) throws {
        if let item = waitForPriorityMenuItem(pid: pid, label: label) {
            if AXUIElementPerformAction(item, kAXPressAction as CFString) == .success {
                Thread.sleep(forTimeInterval: 0.3)
                return
            }
            if let frame = try? elementFrame(item) {
                try tapWithoutSettling(frame.center)
                Thread.sleep(forTimeInterval: 0.3)
                return
            }
        }

        // SwiftUI/AppKit may present this transient Menu outside the app's durable AX subtree.
        // The trigger and its adjacent primary button were independently hit-tested above; retain
        // a real menu selection with the standard keyboard route when the child is not exposed.
        fputs(
            "Gajendra UI proof note: transient priority menu children were unavailable to AX; used the keyboard menu fallback after the separately hit-tested trigger.\n",
            stderr
        )
        for _ in 0..<fallbackDownArrowPresses {
            try postKey(125) // Down Arrow.
        }
        try postKey(36) // Return.
        Thread.sleep(forTimeInterval: 0.35)
    }

    private static func waitForPriorityMenuItem(pid: pid_t, label: String) -> AXUIElement? {
        let deadline = Date().addingTimeInterval(0.75)
        repeat {
            let application = AXUIElementCreateApplication(pid)
            if let item = firstElement(in: application, depth: 0, label: label) {
                return item
            }
            let system = AXUIElementCreateSystemWide()
            if let rawFocused = attribute(system, kAXFocusedUIElementAttribute),
               CFGetTypeID(rawFocused) == AXUIElementGetTypeID() {
                let focused = rawFocused as! AXUIElement
                if accessibilityLabel(focused) == label { return focused }
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        return nil
    }

    private static func waitForPriorityLaneCounts(
        _ url: URL,
        entryCount: Int,
        focusCount: Int,
        importantCount: Int,
        currentThreadId: String?,
        phase: String
    ) throws {
        let deadline = Date().addingTimeInterval(timeout)
        var lastCounts = (entries: -1, focus: -1, important: -1)
        repeat {
            if let state = try? readState(url) {
                lastCounts = (
                    entries: state.entries.count,
                    focus: priorityEntryCount(state, level: "focus"),
                    important: priorityEntryCount(state, level: "important")
                )
                if lastCounts.entries == entryCount,
                   lastCounts.focus == focusCount,
                   lastCounts.important == importantCount,
                   state.currentFocusThreadId == currentThreadId {
                    return
                }
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed(
            "the priority action did not persist the expected isolated lane counts during \(phase); "
                + "entries=\(lastCounts.entries), focus=\(lastCounts.focus), important=\(lastCounts.important)"
        )
    }

    private static func priorityEntryCount(_ state: StoredPriorityState, level: String) -> Int {
        state.entries.filter { $0.level == level }.count
    }

    private static func requireOpenMarkerAbsent(_ marker: URL, phase: String) throws {
        guard !FileManager.default.fileExists(atPath: marker.path) else {
            throw GajendraUITestError.failed("the priority action opened a synthetic task during \(phase)")
        }
    }

    private static func verifyTaskTapPreservesOpenMode(pid: pid_t) throws {
        let row = try waitForElement(
            pid: pid,
            label: "Review the dock behavior, Synthetic UI Agent"
        )
        try tap(try elementFrame(row).center)
        _ = try waitForElement(pid: pid, label: "Edit priorities")
        try requireElementAbsent(pid: pid, label: "Done editing priorities", duration: 0.2)
    }

    private static func verifyTaskLongPressAndRowDrag(pid: pid_t, stateURL: URL) throws {
        // focus-b is deliberately not the last Focus row: a stationary release on its own
        // frame must remain a selection/no-op rather than falling through to lane append.
        let source = try waitForElement(
            pid: pid,
            label: "Run the drag regression, Synthetic UI Agent, Running now",
            value: "Ready"
        )
        let sourceFrame = try elementFrame(source)
        let before = try readState(stateURL)
        try longPress(sourceFrame.center)
        let selected = try waitForElement(
            pid: pid,
            label: "Run the drag regression, Synthetic UI Agent, Running now",
            value: "Selected"
        )
        _ = try waitForElement(pid: pid, label: "Done editing priorities")
        let selectedFrame = try elementFrame(selected)
        guard selectedFrame.midY == sourceFrame.midY else {
            throw GajendraUITestError.failed("stationary hold moved the selected queue row")
        }
        let afterHold = try readState(stateURL)
        guard priorityEntries(afterHold) == priorityEntries(before) else {
            throw GajendraUITestError.failed("stationary hold changed persisted priority state")
        }
        try requireElementAbsent(
            pid: pid,
            label: "Gajendra could not open this thread.",
            duration: 0.35
        )
        let done = try waitForElement(pid: pid, label: "Done editing priorities")
        guard AXUIElementPerformAction(done, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("stationary hold selection could not be exited")
        }
        _ = try waitForElement(
            pid: pid,
            label: "Run the drag regression, Synthetic UI Agent, Running now",
            value: "Ready"
        )

        let reacquiredSource = try waitForStableHittableElement(
            pid: pid,
            label: "Verify queue ordering, Synthetic UI Agent"
        )
        let target = try waitForStableHittableElement(
            pid: pid,
            label: "Run the drag regression, Synthetic UI Agent, Running now"
        )
        let reacquiredSourceFrame = try elementFrame(reacquiredSource)
        let targetFrame = try elementFrame(target)
        try dragWithIntermediateEvidence(
            pid: pid,
            sourceLabel: "Verify queue ordering, Synthetic UI Agent",
            targetLabel: "Run the drag regression, Synthetic UI Agent, Running now",
            from: reacquiredSourceFrame.center,
            to: targetFrame.center
        )
        try waitForState(stateURL) { state in
            state.entries.filter { $0.level == "focus" }.map(\.threadId)
                == ["ui-agent:focus-a", "ui-agent:focus-c", "ui-agent:focus-b"]
        }
        let continuousDone = try waitForElement(pid: pid, label: "Done editing priorities")
        guard AXUIElementPerformAction(continuousDone, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("continuous hold-then-drag could not exit edit mode")
        }
        _ = try waitForElement(
            pid: pid,
            label: "Verify queue ordering, Synthetic UI Agent",
            value: "Ready"
        )
    }

    private static func verifyQueueDrag(pid: pid_t, stateURL: URL) throws {
        let sourceLabel = "Run the drag regression, Synthetic UI Agent, Running now"
        let targetLabel = "Verify queue ordering, Synthetic UI Agent"
        // Enter edit mode with the same pointer route a user uses. The AX action remains
        // covered by the launcher/card accessibility journeys, but must not be the only proof
        // that the visible Edit control works.
        let edit = try waitForStableHittableElement(pid: pid, label: "Edit priorities", value: nil)
        try tap(try elementFrame(edit).center)
        _ = try waitForElement(pid: pid, label: "Done editing priorities")
        // Accessibility exposes Done as soon as edit mode is requested, while SwiftUI may still
        // be committing the reordered row frames. Resolve both endpoints only after their
        // system hit targets have been stable, otherwise the pointer can start on a real row but
        // cross stale geometry and never expose a drop target.
        let source = try waitForStableHittableElement(pid: pid, label: sourceLabel)
        let target = try waitForStableHittableElement(pid: pid, label: targetLabel)
        let sourceFrame = try elementFrame(source)
        let targetFrame = try elementFrame(target)
        try dragWithIntermediateEvidence(
            pid: pid,
            sourceLabel: sourceLabel,
            targetLabel: targetLabel,
            from: sourceFrame.center,
            to: targetFrame.center
        )
        try waitForState(stateURL) { state in
            state.entries.filter { $0.level == "important" }.map(\.threadId)
                == ["ui-agent:important-a"]
                && state.entries.filter { $0.level == "focus" }.map(\.threadId)
                    == ["ui-agent:focus-a", "ui-agent:focus-b", "ui-agent:focus-c"]
        }
        _ = try waitForElement(pid: pid, label: "Remove Verify queue ordering from Focus")
        let done = try waitForElement(pid: pid, label: "Done editing priorities")
        guard AXUIElementPerformAction(done, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("priority editing could not be closed after the drag")
        }
        Thread.sleep(forTimeInterval: 0.35)
    }

    private static func verifySearch(pid: pid_t) throws {
        let field = try waitForStableHittableElement(
            pid: pid,
            label: "Search every AI-agent thread",
            value: nil
        )
        try focusSearchField(pid: pid, field: field)

        // Exercise the actual NSTextField delegate route. Direct AXValue writes can make the
        // field look empty while leaving the SwiftUI-bound query unchanged.
        try postKey(0, flags: .maskCommand) // Select All.
        try postKey(51) // Delete any pre-existing query.
        try waitForAXValue(field, pid: pid, expected: "", label: "search field after initial clear")
        try postUnicodeText("design")
        try waitForAXValue(field, pid: pid, expected: "design", label: "search field after typing design")

        _ = try waitForElementContaining(pid: pid, labelFragment: "Search results")
        _ = try waitForElementContaining(pid: pid, labelFragment: "Verify queue ordering")
        // `design` matches the real context metadata of focus-c, not the running focus-b row.
        // This proves the search is filtering the visible queue rather than merely echoing a
        // row that was already present before the query.
        try requireElementAbsent(
            pid: pid,
            label: "Run the drag regression, Synthetic UI Agent, Running now",
            duration: 0.35
        )

        // Clear with the same user key route, then require restored default content before any
        // dock assertions. This catches a stale binding even when AX reports an empty field.
        try postKey(0, flags: .maskCommand) // Select All.
        try postKey(51) // Delete.
        try waitForAXValue(field, pid: pid, expected: "", label: "search field after user clear")
        _ = try waitForElementContaining(pid: pid, labelFragment: "Verify queue ordering")
        _ = try waitForStableDockHeader(
            pid: pid,
            label: "Running, 2 active threads",
            value: "Expanded"
        )
    }

    private static func dragWithIntermediateEvidence(
        pid: pid_t,
        sourceLabel: String,
        targetLabel: String,
        from start: CGPoint,
        to end: CGPoint
    ) throws {
        postMove(to: start)
        Thread.sleep(forTimeInterval: 0.08)
        try postMouse(.leftMouseDown, at: start, clickState: 1)
        // Keep the pointer stationary beyond the product's 280 ms recognition threshold before
        // moving, so this proves one continuous non-edit-mode hold-then-drag gesture.
        Thread.sleep(forTimeInterval: 0.35)
        var sawDragging = false
        var sawDropTarget = false
        for step in 1...14 {
            let progress = CGFloat(step) / 14
            let point = CGPoint(
                x: start.x + ((end.x - start.x) * progress),
                y: start.y + ((end.y - start.y) * progress)
            )
            try postMouse(.leftMouseDragged, at: point, clickState: 1)
            Thread.sleep(forTimeInterval: 0.035)
            sawDragging = sawDragging || element(pid: pid, label: sourceLabel, value: "Dragging") != nil
            sawDropTarget = sawDropTarget || element(pid: pid, label: targetLabel, value: "Drop target") != nil
        }
        fputs(
            "Gajendra UI drag evidence: source=\(sourceLabel),target=\(targetLabel),dragging=\(sawDragging),dropTarget=\(sawDropTarget)\n",
            stderr
        )
        guard sawDragging || sawDropTarget else {
            try postMouse(.leftMouseUp, at: end, clickState: 1)
            throw GajendraUITestError.failed("hold-then-drag exposed no intermediate dragging or drop-target state")
        }
        Thread.sleep(forTimeInterval: 0.18)
        try postMouse(.leftMouseUp, at: end, clickState: 1)
        Thread.sleep(forTimeInterval: 0.8)
    }

    private static func verifyOrganizerDrag(pid: pid_t, stateURL: URL) throws {
        let organizer = try waitForElement(pid: pid, label: "Open organizer")
        guard AXUIElementPerformAction(organizer, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("the organizer accessibility press action was unavailable")
        }
        NSRunningApplication(processIdentifier: pid)?.activate(options: .activateIgnoringOtherApps)
        Thread.sleep(forTimeInterval: 0.25)
        let initialSource = try waitForElement(pid: pid, label: "Drag Run the drag regression")
        try moveContainingWindow(of: initialSource, to: CGPoint(x: 40, y: 40))
        Thread.sleep(forTimeInterval: 0.25)
        try requireElementAbsent(
            pid: pid,
            label: "Actions for Shape the interaction contract",
            duration: 0.2
        )
        let currentSource = try waitForStableHittableElement(
            pid: pid,
            label: "Drag Shape the interaction contract"
        )
        let currentCrossLaneTarget = try waitForStableHittableElement(
            pid: pid,
            label: "Drag Review the dock behavior"
        )
        let beforeCurrentDrag = try readState(stateURL)
        try drag(
            from: try elementFrame(currentSource).center,
            to: try elementFrame(currentCrossLaneTarget).center
        )
        Thread.sleep(forTimeInterval: 0.35)
        guard try readState(stateURL) == beforeCurrentDrag else {
            throw GajendraUITestError.failed("Organizer allowed NOW to move or lose current status across priority lanes")
        }
        let source = try waitForStableHittableElement(pid: pid, label: "Drag Run the drag regression")
        let target = try waitForStableHittableElement(pid: pid, label: "Drag Review the dock behavior")
        let sourceFrame = try elementFrame(source)
        let targetFrame = try elementFrame(target)
        try drag(from: sourceFrame.center, to: targetFrame.center)
        try waitForState(stateURL) { state in
            state.entries.filter { $0.level == "important" }.map(\.threadId)
                == ["ui-agent:focus-b", "ui-agent:important-a"]
        }
        try pressAccessibleToggle(
            pid: pid,
            label: "Focus, 2 tasks",
            from: "Expanded",
            to: "Collapsed"
        )
        try pressAccessibleToggle(
            pid: pid,
            label: "Important, 2 tasks",
            from: "Expanded",
            to: "Collapsed"
        )
        try verifyDockSingleClickDoesNotToggle(
            pid: pid,
            label: "Running, 2 active threads across all priority lanes",
            value: "Expanded"
        )
        try verifyDockControlClick(
            pid: pid,
            headerLabel: "Running, 2 active threads across all priority lanes",
            controlLabel: "All priority lanes, Running in Organizer"
        )
        try toggleDockDoubleClick(
            pid: pid,
            label: "Running, 2 active threads across all priority lanes",
            from: "Expanded",
            to: "Collapsed"
        )
        try verifyDockDoubleClick(
            pid: pid,
            label: "Ready for Review, 1 thread needing human attention",
            collapsedValue: "Collapsed"
        )
        try toggleDockDoubleClick(
            pid: pid,
            label: "Running, 2 active threads across all priority lanes",
            from: "Collapsed",
            to: "Expanded"
        )
        try pressAccessibleToggle(
            pid: pid,
            label: "Focus, 2 tasks",
            from: "Collapsed",
            to: "Expanded"
        )
        try pressAccessibleToggle(
            pid: pid,
            label: "Important, 2 tasks",
            from: "Collapsed",
            to: "Expanded"
        )
    }

    private static func verifyRunningDockControlsOnly(pid: pid_t) throws {
        let pillButton = try waitForPillHelp(pid: pid, containing: "Click to show or hide priorities")
        guard AXUIElementPerformAction(pillButton, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("the launcher accessibility press action was unavailable for dock proof")
        }
        try waitForCard(pid: pid, visible: true, label: "running dock focused proof")
        // The first visible refresh can overlap the source process warming on a clean
        // isolated launch. A second enabled-state refresh makes this focused journey
        // deterministic without bypassing the user-visible control.
        for _ in 0..<2 {
            let refresh = try waitForElement(pid: pid, label: "Refresh Threads", enabled: true)
            guard AXUIElementPerformAction(refresh, kAXPressAction as CFString) == .success else {
                throw GajendraUITestError.failed("the visible refresh action was unavailable for dock proof")
            }
            Thread.sleep(forTimeInterval: 0.35)
        }

        try verifyDockControlClick(
            pid: pid,
            headerLabel: "Running, 2 active threads",
            controlLabel: "All priority lanes, Running"
        )
        try verifyDockDoubleClick(
            pid: pid,
            label: "Running, 2 active threads",
            collapsedValue: "Collapsed"
        )

        let organizer = try waitForElement(pid: pid, label: "Open organizer")
        guard AXUIElementPerformAction(organizer, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("the organizer accessibility press action was unavailable for dock proof")
        }
        NSRunningApplication(processIdentifier: pid)?.activate(options: .activateIgnoringOtherApps)
        Thread.sleep(forTimeInterval: 0.25)
        let organizerHeader = try waitForElement(
            pid: pid,
            label: "Running, 2 active threads across all priority lanes",
            value: "Expanded"
        )
        try moveContainingWindow(of: organizerHeader, to: CGPoint(x: 40, y: 40))
        Thread.sleep(forTimeInterval: 0.25)

        try verifyDockControlClick(
            pid: pid,
            headerLabel: "Running, 2 active threads across all priority lanes",
            controlLabel: "All priority lanes, Running in Organizer"
        )
        try verifyDockDoubleClick(
            pid: pid,
            label: "Running, 2 active threads across all priority lanes",
            collapsedValue: "Collapsed"
        )
    }

    private static func verifyDockDoubleClick(
        pid: pid_t,
        label: String,
        collapsedValue: String
    ) throws {
        try verifyDockSingleClickDoesNotToggle(pid: pid, label: label, value: "Expanded")
        try toggleDockDoubleClick(pid: pid, label: label, from: "Expanded", to: collapsedValue)
        try toggleDockDoubleClick(pid: pid, label: label, from: collapsedValue, to: "Expanded")
    }

    private static func verifyDockSingleClickDoesNotToggle(
        pid: pid_t,
        label: String,
        value: String
    ) throws {
        let header = try waitForStableDockHeader(pid: pid, label: label, value: value)
        try tap(try elementFrame(header).center)
        _ = try waitForDockHeaderValue(header, pid: pid, label: label, expected: value)
    }

    private static func verifyDockControlClick(
        pid: pid_t,
        headerLabel: String,
        controlLabel: String
    ) throws {
        _ = try waitForStableDockHeader(pid: pid, label: headerLabel, value: "Expanded")
        let visibleExpandedControl = try waitForElement(
            pid: pid,
            label: controlLabel,
            value: "Expanded"
        )
        try raiseContainingWindow(of: visibleExpandedControl, context: "Running dock control")
        _ = AXUIElementPerformAction(visibleExpandedControl, "AXScrollToVisible" as CFString)
        let expandedControl = try waitForStableHittableElement(
            pid: pid,
            label: controlLabel,
            value: "Expanded",
            scrollToVisible: true,
            requiresSemanticHit: false
        )
        try tapWithoutSettling(try elementFrame(expandedControl).center)
        _ = try waitForElement(pid: pid, label: controlLabel, value: "Collapsed")
        Thread.sleep(forTimeInterval: 0.7)

        let collapsedControl = try waitForStableHittableElement(
            pid: pid,
            label: controlLabel,
            value: "Collapsed",
            scrollToVisible: true,
            requiresSemanticHit: false
        )
        try tapWithoutSettling(try elementFrame(collapsedControl).center)
        _ = try waitForElement(pid: pid, label: controlLabel, value: "Expanded")
        Thread.sleep(forTimeInterval: 0.7)
        _ = try waitForStableDockHeader(pid: pid, label: headerLabel, value: "Expanded")
    }

    private static func toggleDockDoubleClick(
        pid: pid_t,
        label: String,
        from initialValue: String,
        to finalValue: String
    ) throws {
        // Let AppKit clear any prior click sequence before resolving the current, possibly
        // scroll-adjusted header frame. The low-level gesture must click that fresh frame
        // immediately; otherwise a visible refresh/layout pass can move it during the delay.
        Thread.sleep(forTimeInterval: 0.7)
        let header = try waitForStableDockHeader(pid: pid, label: label, value: initialValue)
        try doubleTap(try elementFrame(header).center)
        _ = try waitForDockHeaderValue(header, pid: pid, label: label, expected: finalValue)
    }

    private static func waitForDockHeaderValue(
        _ retainedHeader: AXUIElement,
        pid: pid_t,
        label: String,
        expected: String
    ) throws -> AXUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        var observedValues: [String] = []
        repeat {
            _ = AXUIElementPerformAction(retainedHeader, "AXScrollToVisible" as CFString)
            if let retainedValue = attribute(retainedHeader, kAXValueAttribute) as? String {
                observedValues.append(retainedValue)
                if retainedValue == expected { return retainedHeader }
            }
            let application = AXUIElementCreateApplication(pid)
            if let current = firstElement(in: application, depth: 0, label: label),
               let currentValue = attribute(current, kAXValueAttribute) as? String {
                observedValues.append(currentValue)
                if currentValue == expected { return current }
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed(
            "timed out waiting for dock header \(label) value \(expected); "
                + "observed=\(observedValues.suffix(12))"
        )
    }

    private static func pressAccessibleToggle(
        pid: pid_t,
        label: String,
        from initialValue: String,
        to finalValue: String
    ) throws {
        let element = try waitForElement(pid: pid, label: label, value: initialValue)
        guard AXUIElementPerformAction(element, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("the accessibility press action was unavailable for \(label)")
        }
        _ = try waitForElement(pid: pid, label: label, value: finalValue)
    }

    private static func waitForPill(pid: pid_t) throws -> CGRect {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let frame = launcherWindow(pid: pid) { return frame }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed("timed out waiting for the Gajendra launcher control")
    }

    private static func waitForStablePillFrame(pid: pid_t) throws -> CGRect {
        try waitForStablePillHit(pid: pid).pillFrame
    }

    private static func waitForStablePillHit(pid: pid_t) throws -> PillHitReceipt {
        let deadline = Date().addingTimeInterval(timeout)
        var previousFrame: CGRect?
        var stableSamples = 0
        var lastOwnerPID: pid_t = 0
        var lastHitLabel = "none"
        var lastPillFrame: CGRect?
        var lastHitWindowFrame: CGRect?
        repeat {
            if let frame = launcherWindow(pid: pid),
               let hit = systemElementAtPosition(point: frame.center) {
                lastPillFrame = frame
                lastHitLabel = accessibilityLabel(hit) ?? "unlabeled"
                var hitPID: pid_t = 0
                AXUIElementGetPid(hit, &hitPID)
                lastOwnerPID = hitPID
                let hitWindowFrame: CGRect?
                if let rawWindow = attribute(hit, kAXWindowAttribute),
                   CFGetTypeID(rawWindow) == AXUIElementGetTypeID() {
                    hitWindowFrame = try? elementFrame(rawWindow as! AXUIElement)
                } else {
                    hitWindowFrame = nil
                }
                lastHitWindowFrame = hitWindowFrame
                guard hitPID == pid,
                      hitLabelRepresentsPill(lastHitLabel) else {
                    stableSamples = 0
                    previousFrame = nil
                    Thread.sleep(forTimeInterval: 0.001)
                    continue
                }
                if let previousFrame, framesMatch(previousFrame, frame) {
                    stableSamples += 1
                } else {
                    previousFrame = frame
                    stableSamples = 1
                }
                if stableSamples >= 3 {
                    return PillHitReceipt(
                        pillFrame: frame,
                        hitLabel: lastHitLabel,
                        hitWindowFrame: hitWindowFrame ?? frame,
                        ownerPID: hitPID
                    )
                }
            }
            Thread.sleep(forTimeInterval: 0.001)
        } while Date() < deadline
        let frameDescription = lastPillFrame.map {
            describeFrame($0)
        } ?? "none"
        let hitWindowDescription = lastHitWindowFrame.map(describeFrame) ?? "none"
        throw GajendraUITestError.failed(
            "timed out waiting for a stable pill hit target; ownerPID=\(lastOwnerPID), "
                + "hitLabel=\(lastHitLabel), hitWindowFrame=\(hitWindowDescription), "
                + "pillFrame=\(frameDescription), windows="
                + windows(pid: pid).map {
                    "origin=(\(Int($0.bounds.minX)),\(Int($0.bounds.minY))),"
                        + "size=(\(Int($0.bounds.width))x\(Int($0.bounds.height)))@layer\($0.layer):"
                        + "on=\($0.isOnScreen):alpha=\(String(format: "%.2f", $0.alpha))"
                }.joined(separator: ",")
        )
    }

    private static func framesMatch(_ lhs: CGRect, _ rhs: CGRect) -> Bool {
        abs(lhs.minX - rhs.minX) <= stableFrameTolerance
            && abs(lhs.minY - rhs.minY) <= stableFrameTolerance
            && abs(lhs.width - rhs.width) <= stableFrameTolerance
            && abs(lhs.height - rhs.height) <= stableFrameTolerance
    }

    private static func describeFrame(_ frame: CGRect) -> String {
        "origin=(\(String(format: "%.1f", frame.minX)),\(String(format: "%.1f", frame.minY))),"
            + "size=(\(String(format: "%.1f", frame.width))x\(String(format: "%.1f", frame.height)))"
    }

    private static func waitForWindow(pid: pid_t, width: CGFloat, height: CGFloat) throws -> CGRect {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let match = windows(pid: pid).first(where: {
                $0.isOnScreen
                    && abs($0.bounds.width - width) < 0.5
                    && abs($0.bounds.height - height) < 0.5
            }) {
                return match.bounds
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed("timed out waiting for the \(Int(width)) by \(Int(height)) window")
    }

    private static func waitForCard(pid: pid_t, visible: Bool, label: String) throws {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let cardVisible = cardWindowIsVisible(pid: pid)
            if cardVisible == visible { return }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        let summary = windows(pid: pid)
            .map { "\(Int($0.bounds.width))x\(Int($0.bounds.height))@layer\($0.layer):on=\($0.isOnScreen):alpha=\(String(format: "%.2f", $0.alpha))" }
            .joined(separator: ",")
        throw GajendraUITestError.failed("timed out during \(label); windows=\(summary)")
    }

    private static func waitForCardHiddenStable(pid: pid_t, label: String) throws {
        let deadline = Date().addingTimeInterval(timeout)
        var hiddenSamples = 0
        repeat {
            if cardWindowIsVisible(pid: pid) {
                hiddenSamples = 0
            } else {
                hiddenSamples += 1
                if hiddenSamples >= 3 { return }
            }
            Thread.sleep(forTimeInterval: 0.1)
        } while Date() < deadline
        let summary = windows(pid: pid)
            .map { "\(Int($0.bounds.width))x\(Int($0.bounds.height))@layer\($0.layer):on=\($0.isOnScreen):alpha=\(String(format: "%.2f", $0.alpha))" }
            .joined(separator: ",")
        throw GajendraUITestError.failed(
            "timed out during \(label); card was not hidden for 200ms; windows=\(summary)"
        )
    }

    private static func cardWindowIsVisible(pid: pid_t) -> Bool {
        windows(pid: pid).contains {
            $0.isOnScreen
                && $0.layer > 0
                && $0.bounds.width >= 300
                && $0.bounds.height >= 300
                && $0.alpha > 0.01
        }
    }

    private static func waitForCompactCard(pid: pid_t, label: String) throws -> CGRect {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let compact = windows(pid: pid).first(where: {
                $0.isOnScreen
                    && $0.layer > 0
                    && $0.bounds.width >= 320
                    && $0.bounds.height >= 360
                    && $0.bounds.width < 620
                    && $0.bounds.height < 700
                    && $0.alpha > 0.01
            }) {
                return compact.bounds
            }
            Thread.sleep(forTimeInterval: 0.001)
        } while Date() < deadline
        let summary = windows(pid: pid)
            .map { "\(Int($0.bounds.width))x\(Int($0.bounds.height))@layer\($0.layer):on=\($0.isOnScreen):alpha=\(String(format: "%.2f", $0.alpha))" }
            .joined(separator: ",")
        throw GajendraUITestError.failed("timed out during \(label); expected compact card, windows=\(summary)")
    }

    private static func measuredCardOpen(pid: pid_t, label: String) throws -> Int {
        try waitForCardHiddenStable(pid: pid, label: "\(label) precondition")
        let receipt = try waitForStablePillHit(pid: pid)
        let point = receipt.pillFrame.center
        fputs(
            "Gajendra UI accepted pill hit: \(label); ownerPID=\(receipt.ownerPID); "
                + "hitLabel=\(receipt.hitLabel); hitWindowFrame=\(describeFrame(receipt.hitWindowFrame)); "
                + "pillFrame=\(describeFrame(receipt.pillFrame))\n",
            stderr
        )
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        let started = ContinuousClock.now
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.02)
        try postMouse(.leftMouseUp, at: point, clickState: 1)
        do {
            try waitForCard(pid: pid, visible: true, label: label)
        } catch {
            let pointerFailure = String(describing: error)
            let axPressResult: String
            if let button = pillButton(pid: pid) {
                axPressResult = String(describing: AXUIElementPerformAction(button, kAXPressAction as CFString))
            } else {
                axPressResult = "button unavailable"
            }
            let axOpened = waitForCardVisibility(pid: pid, visible: true, within: 1.0)
            if axOpened {
                throw GajendraUITestError.failed(
                    "\(label) pointer open timed out; AX falsifier opened the card "
                        + "(dropped pointer delivery); AXPress=\(axPressResult); pointer=\(pointerFailure)"
                )
            }
            throw GajendraUITestError.failed(
                "\(label) pointer open timed out; AX falsifier left the card hidden "
                    + "(presentation-state desync); AXPress=\(axPressResult); pointer=\(pointerFailure)"
            )
        }
        let elapsed = started.duration(to: .now)
        let milliseconds = Int(elapsed.components.seconds * 1_000)
            + Int(elapsed.components.attoseconds / 1_000_000_000_000_000)
        fputs("Gajendra UI metric: \(label)=\(milliseconds)ms\n", stderr)
        Thread.sleep(forTimeInterval: 0.15)
        return milliseconds
    }

    private static func waitForCardVisibility(
        pid: pid_t,
        visible: Bool,
        within interval: TimeInterval
    ) -> Bool {
        let deadline = Date().addingTimeInterval(interval)
        repeat {
            if cardWindowIsVisible(pid: pid) == visible { return true }
            Thread.sleep(forTimeInterval: 0.02)
        } while Date() < deadline
        return cardWindowIsVisible(pid: pid) == visible
    }

    private static func windows(pid: pid_t) -> [WindowSnapshot] {
        let rawWindows = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as? [[String: Any]] ?? []
        return rawWindows.compactMap { window in
            guard (window[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == pid,
                  let rawBounds = window[kCGWindowBounds as String] as? [String: Any],
                  let x = number(rawBounds["X"]),
                  let y = number(rawBounds["Y"]),
                  let width = number(rawBounds["Width"]),
                  let height = number(rawBounds["Height"]) else { return nil }
            return WindowSnapshot(
                bounds: CGRect(x: x, y: y, width: width, height: height),
                layer: (window[kCGWindowLayer as String] as? NSNumber)?.intValue ?? 0,
                isOnScreen: (window[kCGWindowIsOnscreen as String] as? NSNumber)?.boolValue == true,
                alpha: number(window[kCGWindowAlpha as String]) ?? 1
            )
        }
    }

    private static func number(_ value: Any?) -> CGFloat? {
        (value as? NSNumber).map { CGFloat(truncating: $0) }
    }

    private static func waitForPillHelp(pid: pid_t, containing expected: String) throws -> AXUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        var observed = "launcher button unavailable"
        repeat {
            if let button = pillButton(pid: pid) {
                let help = attribute(button, kAXHelpAttribute) as? String ?? "help unavailable"
                observed = help
                if help.contains(expected) { return button }
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed("timed out waiting for launcher state: \(expected); observed: \(observed)")
    }

    private static func waitForStatusItem(pid: pid_t) throws -> AXUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let system = AXUIElementCreateSystemWide()
            if let item = firstStatusItem(in: system, ownerPID: pid, depth: 0) {
                return item
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        let labels = accessibilityLabels(in: AXUIElementCreateSystemWide(), depth: 0).prefix(40)
        throw GajendraUITestError.failed(
            "timed out waiting for the Gajendra menu-bar status item; observed=\(Array(labels))"
        )
    }

    private static func firstStatusItem(
        in element: AXUIElement,
        ownerPID: pid_t,
        depth: Int
    ) -> AXUIElement? {
        guard depth <= 20 else { return nil }
        var elementPID: pid_t = 0
        AXUIElementGetPid(element, &elementPID)
        if elementPID == ownerPID {
            let role = attribute(element, kAXRoleAttribute) as? String
            let label = accessibilityLabel(element) ?? ""
            let help = attribute(element, kAXHelpAttribute) as? String ?? ""
            if (role == kAXButtonRole || role == kAXImageRole)
                && (label.localizedCaseInsensitiveContains("Gajendra")
                    || help.localizedCaseInsensitiveContains("One clear focus across your AI tools")) {
                return element
            }
        }
        guard let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] else { return nil }
        for child in children {
            if let match = firstStatusItem(in: child, ownerPID: ownerPID, depth: depth + 1) {
                return match
            }
        }
        return nil
    }

    private static func pillButton(pid: pid_t) -> AXUIElement? {
        if let frame = launcherWindow(pid: pid),
           let hit = systemElementAtPosition(point: frame.center),
           let match = pillButtonFromHit(hit, ownerPID: pid) {
            return match
        }
        let application = AXUIElementCreateApplication(pid)
        return firstPillButton(in: application, depth: 0)
    }

    private static func pillButtonFromHit(_ element: AXUIElement, ownerPID: pid_t) -> AXUIElement? {
        var candidate: AXUIElement? = element
        for _ in 0..<8 {
            guard let current = candidate else { return nil }
            var currentPID: pid_t = 0
            AXUIElementGetPid(current, &currentPID)
            if currentPID == ownerPID,
               attribute(current, kAXRoleAttribute) as? String == kAXButtonRole,
               hitLabelRepresentsPill(accessibilityLabel(current) ?? "") {
                return current
            }
            guard let parent = attribute(current, kAXParentAttribute),
                  CFGetTypeID(parent) == AXUIElementGetTypeID() else { return nil }
            candidate = (parent as! AXUIElement)
        }
        return nil
    }

    private static func launcherWindow(pid: pid_t) -> CGRect? {
        windows(pid: pid).first(where: {
            $0.isOnScreen
                && $0.layer > 0
                && $0.alpha > 0.01
                && $0.bounds.width >= 48
                && $0.bounds.width <= 61
                && $0.bounds.height >= 48
                && $0.bounds.height <= 61
        })?.bounds
    }

    private static func waitForElement(
        pid: pid_t,
        label: String,
        value: String? = nil,
        enabled: Bool? = nil
    ) throws -> AXUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        var observedValues: [String] = []
        repeat {
            let application = AXUIElementCreateApplication(pid)
            if let element = firstElement(in: application, depth: 0, label: label) {
                let observedValue = attribute(element, kAXValueAttribute) as? String
                if let observedValue { observedValues.append(observedValue) }
                let observedEnabled = (attribute(element, kAXEnabledAttribute) as? NSNumber)?.boolValue
                if (value == nil || observedValue == value)
                    && (enabled == nil || observedEnabled == enabled) {
                    return element
                }
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        let nearby = accessibilityLabels(in: AXUIElementCreateApplication(pid), depth: 0)
            .filter { candidate in
                label.split(separator: " ").contains { candidate.localizedCaseInsensitiveContains($0) }
            }
            .prefix(20)
        throw GajendraUITestError.failed(
            "timed out waiting for accessibility element \(label)"
                + (value.map { " with value \($0); observed=\(observedValues.suffix(5))" } ?? "")
                + (enabled.map { " with enabled=\($0)" } ?? "")
                + "; nearby=\(Array(nearby))"
        )
    }

    private static func waitForElementContaining(pid: pid_t, labelFragment: String) throws -> AXUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let application = AXUIElementCreateApplication(pid)
            if let element = firstElementContaining(
                in: application,
                depth: 0,
                labelFragment: labelFragment
            ) {
                return element
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        let observed = accessibilityLabels(in: AXUIElementCreateApplication(pid), depth: 0)
            .filter { $0.localizedCaseInsensitiveContains(labelFragment) }
            .prefix(20)
        throw GajendraUITestError.failed(
            "timed out waiting for accessibility element containing \(labelFragment); observed=\(Array(observed))"
        )
    }

    private static func waitForAXValue(
        _ element: AXUIElement,
        pid: pid_t,
        expected: String,
        label: String
    ) throws {
        let deadline = Date().addingTimeInterval(timeout)
        var observedValues: [String] = []
        repeat {
            if let observed = attribute(element, kAXValueAttribute) as? String {
                observedValues.append(observed)
                if observed == expected { return }
            }
            Thread.sleep(forTimeInterval: 0.02)
        } while Date() < deadline
        let summary = windows(pid: pid)
            .map { "\(Int($0.bounds.width))x\(Int($0.bounds.height))@layer\($0.layer):on=\($0.isOnScreen):alpha=\(String(format: "%.2f", $0.alpha))" }
            .joined(separator: ",")
        throw GajendraUITestError.failed(
            "timed out waiting for \(label) value \(expected); observed=\(observedValues.suffix(8)); "
                + "windows=\(summary)"
        )
    }

    private static func requireElementAbsent(pid: pid_t, label: String, duration: TimeInterval) throws {
        let deadline = Date().addingTimeInterval(duration)
        repeat {
            let application = AXUIElementCreateApplication(pid)
            if firstElement(in: application, depth: 0, label: label) != nil {
                throw GajendraUITestError.failed("unexpected accessibility element appeared: \(label)")
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
    }

    private static func waitForHittableElement(pid: pid_t, label: String) throws -> AXUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let application = AXUIElementCreateApplication(pid)
            for element in matchingElements(in: application, depth: 0, label: label) {
                guard (attribute(element, kAXEnabledAttribute) as? NSNumber)?.boolValue != false,
                      let frame = try? elementFrame(element),
                      let hit = elementAtPosition(pid: pid, point: frame.center),
                      accessibilityLabel(hit) == label else { continue }
                return element
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed("timed out waiting for hittable accessibility element \(label)")
    }

    private static func waitForStableDockHeader(
        pid: pid_t,
        label: String,
        value: String
    ) throws -> AXUIElement {
        let header = try waitForElement(pid: pid, label: label, value: value)
        try raiseContainingWindow(of: header, context: "dock header")
        // Compact cards can place the review disclosure below the current ScrollView viewport.
        // Request visibility before resolving a pointer frame; unsupported AX actions are safe
        // to ignore on older accessibility implementations.
        _ = AXUIElementPerformAction(header, "AXScrollToVisible" as CFString)
        return try waitForStableHittableElement(
            pid: pid,
            label: label,
            value: value,
            scrollToVisible: true,
            requiresSemanticHit: false
        )
    }

    private static func waitForStableHittableElement(pid: pid_t, label: String) throws -> AXUIElement {
        try waitForStableHittableElement(pid: pid, label: label, value: "Ready")
    }

    private static func waitForStableHittableElement(
        pid: pid_t,
        label: String,
        value: String?,
        scrollToVisible: Bool = false,
        requiresSemanticHit: Bool = true,
        preferredPoint: CGPoint? = nil
    ) throws -> AXUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        var previousFrame: CGRect?
        var stableSamples = 0
        var lastOwnerPID: pid_t = 0
        var lastHitLabel = "none"
        var recentFrames: [String] = []
        repeat {
            let application = AXUIElementCreateApplication(pid)
            let matches = matchingElements(in: application, depth: 0, label: label)
            let orderedMatches: [AXUIElement]
            if let preferredPoint {
                let nearest = matches.min { lhs, rhs in
                    let lhsCenter = (try? elementFrame(lhs))?.center ?? .zero
                    let rhsCenter = (try? elementFrame(rhs))?.center ?? .zero
                    return hypot(lhsCenter.x - preferredPoint.x, lhsCenter.y - preferredPoint.y)
                        < hypot(rhsCenter.x - preferredPoint.x, rhsCenter.y - preferredPoint.y)
                }
                orderedMatches = nearest.map { [$0] } ?? []
            } else {
                orderedMatches = matches
            }
            for element in orderedMatches {
                guard (attribute(element, kAXEnabledAttribute) as? NSNumber)?.boolValue != false,
                      value == nil || (attribute(element, kAXValueAttribute) as? String) == value else { continue }
                if scrollToVisible {
                    _ = AXUIElementPerformAction(element, "AXScrollToVisible" as CFString)
                }
                guard let frame = try? elementFrame(element),
                      let hit = systemElementAtPosition(point: frame.center) else { continue }
                recentFrames.append(describeFrame(frame))
                if recentFrames.count > 12 {
                    recentFrames.removeFirst(recentFrames.count - 12)
                }
                lastHitLabel = accessibilityLabel(hit) ?? "unlabeled"
                var hitPID: pid_t = 0
                AXUIElementGetPid(hit, &hitPID)
                lastOwnerPID = hitPID
                guard hitPID == pid else { continue }
                if requiresSemanticHit,
                   !hitLabelRepresentsRow(lastHitLabel, expected: label) {
                    continue
                }
                if let previousFrame,
                   abs(previousFrame.minX - frame.minX) <= stableFrameTolerance,
                   abs(previousFrame.minY - frame.minY) <= stableFrameTolerance,
                   abs(previousFrame.width - frame.width) <= stableFrameTolerance,
                   abs(previousFrame.height - frame.height) <= stableFrameTolerance {
                    stableSamples += 1
                } else {
                    previousFrame = frame
                    stableSamples = 1
                }
                if stableSamples >= 3 { return element }
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed(
            "timed out waiting for stable hittable accessibility element \(label); "
                + "ownerPID=\(lastOwnerPID), hitLabel=\(lastHitLabel), "
                + "recentFrames=\(recentFrames.joined(separator: ";"))"
        )
    }

    private static func hitLabelRepresentsRow(_ hitLabel: String, expected: String) -> Bool {
        guard hitLabel != expected else { return true }
        let expectedTokens = expected
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        let hitTokens = Set(
            hitLabel
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        )
        return !expectedTokens.isEmpty && expectedTokens.allSatisfy(hitTokens.contains)
    }

    private static func hitLabelRepresentsPill(_ hitLabel: String) -> Bool {
        let normalized = hitLabel
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return normalized == "gajendra"
            || normalized == "gajendra focus pill"
            || normalized.hasPrefix("gajendra,")
            || normalized.hasPrefix("gajendra focus pill,")
    }

    private static func moveContainingWindow(of element: AXUIElement, to point: CGPoint) throws {
        guard let rawWindow = attribute(element, kAXWindowAttribute),
              CFGetTypeID(rawWindow) == AXUIElementGetTypeID() else {
            throw GajendraUITestError.failed("the Organizer drag handle did not expose its window")
        }
        var destination = point
        guard let value = AXValueCreate(.cgPoint, &destination),
              AXUIElementSetAttributeValue(
                rawWindow as! AXUIElement,
                kAXPositionAttribute as CFString,
                value
              ) == .success else {
            throw GajendraUITestError.failed("the isolated Organizer window could not be positioned for pointer testing")
        }
        try raiseContainingWindow(of: element, context: "Organizer")
    }

    private static func raiseContainingWindow(of element: AXUIElement, context: String) throws {
        guard let rawWindow = attribute(element, kAXWindowAttribute),
              CFGetTypeID(rawWindow) == AXUIElementGetTypeID() else {
            throw GajendraUITestError.failed("the \(context) did not expose its containing window")
        }
        var ownerPID: pid_t = 0
        AXUIElementGetPid(rawWindow as! AXUIElement, &ownerPID)
        NSRunningApplication(processIdentifier: ownerPID)?.activate(
            options: [.activateAllWindows, .activateIgnoringOtherApps]
        )
        guard AXUIElementPerformAction(rawWindow as! AXUIElement, kAXRaiseAction as CFString) == .success else {
            throw GajendraUITestError.failed("the \(context) window could not be raised for pointer testing")
        }
        Thread.sleep(forTimeInterval: 0.2)
    }

    private static func firstElement(
        in element: AXUIElement,
        depth: Int,
        label: String
    ) -> AXUIElement? {
        guard depth <= 18 else { return nil }
        if accessibilityLabel(element) == label { return element }
        guard let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] else { return nil }
        for child in children {
            if let match = firstElement(in: child, depth: depth + 1, label: label) { return match }
        }
        return nil
    }

    private static func firstElementContaining(
        in element: AXUIElement,
        depth: Int,
        labelFragment: String
    ) -> AXUIElement? {
        guard depth <= 18 else { return nil }
        if accessibilityLabel(element)?.localizedCaseInsensitiveContains(labelFragment) == true {
            return element
        }
        guard let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] else { return nil }
        for child in children {
            if let match = firstElementContaining(in: child, depth: depth + 1, labelFragment: labelFragment) {
                return match
            }
        }
        return nil
    }

    private static func matchingElements(
        in element: AXUIElement,
        depth: Int,
        label: String
    ) -> [AXUIElement] {
        guard depth <= 18 else { return [] }
        var matches = accessibilityLabel(element) == label ? [element] : []
        if let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] {
            for child in children {
                matches.append(contentsOf: matchingElements(in: child, depth: depth + 1, label: label))
            }
        }
        return matches
    }

    private static func accessibilityLabel(_ element: AXUIElement) -> String? {
        for name in [kAXDescriptionAttribute, kAXTitleAttribute] {
            if let value = attribute(element, name) as? String, !value.isEmpty { return value }
        }
        return nil
    }

    private static func accessibilityLabels(in element: AXUIElement, depth: Int) -> [String] {
        guard depth <= 18 else { return [] }
        var labels = accessibilityLabel(element).map { [$0] } ?? []
        if let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] {
            for child in children {
                labels.append(contentsOf: accessibilityLabels(in: child, depth: depth + 1))
            }
        }
        return labels
    }

    private static func elementFrame(_ element: AXUIElement) throws -> CGRect {
        guard let positionValue = attribute(element, kAXPositionAttribute),
              CFGetTypeID(positionValue) == AXValueGetTypeID(),
              let sizeValue = attribute(element, kAXSizeAttribute),
              CFGetTypeID(sizeValue) == AXValueGetTypeID() else {
            throw GajendraUITestError.failed("accessibility element did not expose a frame")
        }
        var position = CGPoint.zero
        var size = CGSize.zero
        guard AXValueGetValue(positionValue as! AXValue, .cgPoint, &position),
              AXValueGetValue(sizeValue as! AXValue, .cgSize, &size) else {
            throw GajendraUITestError.failed("accessibility frame could not be decoded")
        }
        return CGRect(origin: position, size: size)
    }

    private static func elementAtPosition(pid: pid_t, point: CGPoint) -> AXUIElement? {
        let application = AXUIElementCreateApplication(pid)
        var result: AXUIElement?
        guard AXUIElementCopyElementAtPosition(application, Float(point.x), Float(point.y), &result) == .success else {
            return nil
        }
        return result
    }

    private static func systemElementAtPosition(point: CGPoint) -> AXUIElement? {
        let system = AXUIElementCreateSystemWide()
        var result: AXUIElement?
        guard AXUIElementCopyElementAtPosition(system, Float(point.x), Float(point.y), &result) == .success else {
            return nil
        }
        return result
    }

    private static func element(pid: pid_t, label: String, value: String? = nil) -> AXUIElement? {
        let application = AXUIElementCreateApplication(pid)
        return matchingElements(in: application, depth: 0, label: label).first { candidate in
            value == nil || (attribute(candidate, kAXValueAttribute) as? String) == value
        }
    }

    private static func waitForState(
        _ url: URL,
        matching predicate: (StoredPriorityState) -> Bool
    ) throws {
        let deadline = Date().addingTimeInterval(timeout)
        var lastEntries: [StoredPriorityState.Entry] = []
        repeat {
            if let data = try? Data(contentsOf: url),
               let state = try? JSONDecoder().decode(StoredPriorityState.self, from: data) {
                lastEntries = state.entries
                if predicate(state) { return }
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        let observed = lastEntries.map { "\($0.level):\($0.threadId)" }.joined(separator: ",")
        throw GajendraUITestError.failed(
            "drag and drop did not commit the expected priority order; observed=[\(observed)]"
        )
    }

    private static func readState(_ url: URL) throws -> StoredPriorityState {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(StoredPriorityState.self, from: data)
    }

    private static func priorityEntries(_ state: StoredPriorityState) -> [String] {
        state.entries.map { "\($0.threadId)|\($0.level)" }
    }

    private static func firstPillButton(in element: AXUIElement, depth: Int) -> AXUIElement? {
        guard depth <= 12 else { return nil }
        if attribute(element, kAXRoleAttribute) as? String == kAXButtonRole,
           accessibilityLabel(element) == "Gajendra",
           let size = elementSize(element),
           size.width >= 48, size.width <= 61,
           size.height >= 48, size.height <= 61 {
            return element
        }
        guard let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] else { return nil }
        for child in children {
            if let match = firstPillButton(in: child, depth: depth + 1) { return match }
        }
        return nil
    }

    private static func elementSize(_ element: AXUIElement) -> CGSize? {
        guard let value = attribute(element, kAXSizeAttribute),
              CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
        var size = CGSize.zero
        guard AXValueGetValue(value as! AXValue, .cgSize, &size) else { return nil }
        return size
    }

    private static func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
        var result: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &result) == .success else { return nil }
        return result
    }

    private static func tap(_ point: CGPoint) throws {
        try tapWithoutSettling(point)
        Thread.sleep(forTimeInterval: 0.7)
    }

    private static func tapWithoutSettling(_ point: CGPoint) throws {
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.06)
        try postMouse(.leftMouseUp, at: point, clickState: 1)
    }

    private static func focusSearchField(pid: pid_t, field: AXUIElement) throws {
        // Do not use the general tap helper here: its 700 ms settle allows a transient
        // refresh/layout pass to invalidate the field's AX identity after the pointer click.
        let point = try elementFrame(field).center
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.06)
        try postMouse(.leftMouseUp, at: point, clickState: 1)
        try waitForCard(pid: pid, visible: true, label: "search field focus")
        Thread.sleep(forTimeInterval: 0.12)
    }

    private static func tapCurrentPill(pid: pid_t) throws {
        try tap(try waitForStablePillFrame(pid: pid).center)
    }

    private static func microMovementTapCurrentPill(pid: pid_t) throws {
        try microMovementTap(try waitForStablePillFrame(pid: pid).center)
    }

    private static func doubleTapCurrentPill(pid: pid_t) throws {
        Thread.sleep(forTimeInterval: 0.7)
        try doubleTap(try waitForStablePillFrame(pid: pid).center)
    }

    private static func microMovementTap(_ point: CGPoint) throws {
        let end = CGPoint(x: point.x + 2, y: point.y + 1)
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.06)
        try postMouse(.leftMouseDragged, at: end, clickState: 1)
        Thread.sleep(forTimeInterval: 0.03)
        try postMouse(.leftMouseUp, at: end, clickState: 1)
        Thread.sleep(forTimeInterval: 0.7)
    }

    private static func drag(from start: CGPoint, to end: CGPoint) throws {
        postMove(to: start)
        Thread.sleep(forTimeInterval: 0.08)
        try postMouse(.leftMouseDown, at: start, clickState: 1)
        Thread.sleep(forTimeInterval: 0.18)
        for step in 1...14 {
            let progress = CGFloat(step) / 14
            let point = CGPoint(
                x: start.x + ((end.x - start.x) * progress),
                y: start.y + ((end.y - start.y) * progress)
            )
            try postMouse(.leftMouseDragged, at: point, clickState: 1)
            Thread.sleep(forTimeInterval: 0.035)
        }
        Thread.sleep(forTimeInterval: 0.18)
        try postMouse(.leftMouseUp, at: end, clickState: 1)
        Thread.sleep(forTimeInterval: 0.8)
    }

    private static func longPress(_ point: CGPoint) throws {
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.42)
        try postMouse(.leftMouseUp, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.25)
    }

    private static func doubleTap(_ point: CGPoint) throws {
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        try postMouse(.leftMouseUp, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.08)
        try postMouse(.leftMouseDown, at: point, clickState: 2)
        try postMouse(.leftMouseUp, at: point, clickState: 2)
        Thread.sleep(forTimeInterval: 0.7)
    }

    private static func postMove(to point: CGPoint) {
        CGEvent(
            mouseEventSource: nil,
            mouseType: .mouseMoved,
            mouseCursorPosition: point,
            mouseButton: .left
        )?.post(tap: .cghidEventTap)
    }

    private static func pressEscape() throws {
        guard let keyDown = CGEvent(
            keyboardEventSource: nil,
            virtualKey: 53,
            keyDown: true
        ), let keyUp = CGEvent(
            keyboardEventSource: nil,
            virtualKey: 53,
            keyDown: false
        ) else {
            throw GajendraUITestError.failed("could not create an Escape key event")
        }
        keyDown.post(tap: .cghidEventTap)
        keyUp.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.25)
    }

    private static func postKey(_ keyCode: CGKeyCode, flags: CGEventFlags = []) throws {
        guard let keyDown = CGEvent(
            keyboardEventSource: nil,
            virtualKey: keyCode,
            keyDown: true
        ), let keyUp = CGEvent(
            keyboardEventSource: nil,
            virtualKey: keyCode,
            keyDown: false
        ) else {
            throw GajendraUITestError.failed("could not create a keyboard event")
        }
        keyDown.flags = flags
        keyUp.flags = flags
        keyDown.post(tap: .cghidEventTap)
        keyUp.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.12)
    }

    private static func postUnicodeText(_ text: String) throws {
        let characters = Array(text.utf16)
        guard !characters.isEmpty,
              let keyDown = CGEvent(
                keyboardEventSource: nil,
                virtualKey: 0,
                keyDown: true
              ), let keyUp = CGEvent(
                keyboardEventSource: nil,
                virtualKey: 0,
                keyDown: false
              ) else {
            throw GajendraUITestError.failed("could not create a text keyboard event")
        }
        characters.withUnsafeBufferPointer { buffer in
            guard let baseAddress = buffer.baseAddress else { return }
            keyDown.keyboardSetUnicodeString(
                stringLength: buffer.count,
                unicodeString: baseAddress
            )
            keyUp.keyboardSetUnicodeString(
                stringLength: buffer.count,
                unicodeString: baseAddress
            )
            keyDown.post(tap: .cghidEventTap)
            keyUp.post(tap: .cghidEventTap)
        }
        Thread.sleep(forTimeInterval: 0.2)
    }

    private static func postMouse(_ type: CGEventType, at point: CGPoint, clickState: Int64) throws {
        guard let event = CGEvent(
            mouseEventSource: nil,
            mouseType: type,
            mouseCursorPosition: point,
            mouseButton: .left
        ) else {
            throw GajendraUITestError.failed("could not create a pointer event")
        }
        event.setIntegerValueField(.mouseEventClickState, value: clickState)
        event.post(tap: .cghidEventTap)
    }

    private static func scrollVertically(at point: CGPoint, lines: Int32) throws {
        postMove(to: point)
        guard let event = CGEvent(
            scrollWheelEvent2Source: nil,
            units: .line,
            wheelCount: 1,
            wheel1: lines,
            wheel2: 0,
            wheel3: 0
        ) else {
            throw GajendraUITestError.failed("could not create a vertical scroll event")
        }
        event.location = point
        event.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.35)
    }
}

private extension CGRect {
    var center: CGPoint { CGPoint(x: midX, y: midY) }
}
