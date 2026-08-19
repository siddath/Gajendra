import Foundation
import AppKit
import GajendraKit
import SwiftUI

#if canImport(Darwin)
import Darwin
#endif

@main
enum GajendraSelfTest {
    static func main() async throws {
        let snapshot = try JSONDecoder().decode(DeckSnapshot.self, from: Data(fixture.utf8))
        try require(snapshot.revision == 42, "snapshot revision did not decode")
        try require(snapshot.current?.id == "codex:focus-1", "current thread did not decode")
        try require(snapshot.focus.filter(\.isCurrent).count == 1, "NOW must remain singular")
        try require(snapshot.current?.deepLink == "codex://threads/focus-1", "deep link changed")
        try require(snapshot.current?.context == .design, "thread context did not decode")
        try require(snapshot.current?.allowedDeepLinkSchemes == ["codex"], "per-source deep-link allowlist did not decode")
        try require(snapshot.sources.count == 2, "thread sources did not decode")
        try require(DeckThread.isRunningStatus("active"), "active provider status must be treated as running")
        try require(DeckThread.isRunningStatus("in-progress"), "normalized in-progress status must be treated as running")
        try require(!DeckThread.isRunningStatus("resumable"), "resumable metadata must not be inferred as running")
        try require(!DeckThread.isRunningStatus("notLoaded"), "unloaded provider metadata must not be inferred as running")
        try require(
            (200...300).contains(GajendraQueueInteractionTuning.stationaryPressMilliseconds),
            "priority edit hold must feel deliberate without delaying drag pickup"
        )
        try require(
            GajendraQueueInteractionTuning.movementTolerance == 4,
            "priority edit hold must cancel before an intentional task drag or scroll"
        )
        try require(
            !GajendraQueueInteractionPolicy.cancelsStationaryPress(
                start: CGPoint(x: 10, y: 10), current: CGPoint(x: 12, y: 12)
            )
                && GajendraQueueInteractionPolicy.cancelsStationaryPress(
                    start: CGPoint(x: 10, y: 10), current: CGPoint(x: 15, y: 10)
                )
                && GajendraQueueInteractionPolicy.cancelsStationaryPress(
                    start: CGPoint(x: 10, y: 10), current: CGPoint(x: 10, y: 10), competingDrag: true
                )
                && GajendraQueueInteractionPolicy.cancelsStationaryPress(
                    start: CGPoint(x: 10, y: 10), current: CGPoint(x: 10, y: 10), viewVisible: false
                ),
            "hold selection must cancel on excessive movement, competing drag, or disappearance"
        )
        try require(
            GajendraQueueInteractionTuning.dragMinimumDistance == 3
                && GajendraQueueInteractionTuning.dragLiftScale > 1
                && GajendraQueueInteractionTuning.holdToDragInstruction == "Hold to select; keep holding to drag",
            "compact queue drag must use a local lifted preview and hold-to-drag instruction"
        )
        try require(
            GajendraQueueInteractionTuning.dragPreviewScale(reduceMotion: false) > 1
                && GajendraQueueInteractionTuning.dragPreviewScale(reduceMotion: true) == 1,
            "Reduce Motion must remove the lifted preview scale"
        )
        try require(
            GajendraSurfaceRefreshPolicy.interval == 30
                && GajendraSurfaceRefreshPolicy.shouldRefresh(
                    surfaceIsVisible: true,
                    modelIsLoading: false,
                    modelIsMutating: false,
                    interactionState: GajendraCardInteractionState()
                )
                && !GajendraSurfaceRefreshPolicy.shouldRefresh(
                    surfaceIsVisible: false,
                    modelIsLoading: false,
                    modelIsMutating: false,
                    interactionState: GajendraCardInteractionState()
                )
                && !GajendraSurfaceRefreshPolicy.shouldRefresh(
                    surfaceIsVisible: true,
                    modelIsLoading: false,
                    modelIsMutating: false,
                    interactionState: GajendraCardInteractionState(isQueueEditing: true)
                )
                && !GajendraSurfaceRefreshPolicy.shouldRefresh(
                    surfaceIsVisible: true,
                    modelIsLoading: false,
                    modelIsMutating: false,
                    interactionState: GajendraCardInteractionState(isSearchFocused: true)
                )
                && !GajendraSurfaceRefreshPolicy.shouldRefresh(
                    surfaceIsVisible: true,
                    modelIsLoading: true,
                    modelIsMutating: false,
                    interactionState: GajendraCardInteractionState()
                )
                && !GajendraSurfaceRefreshPolicy.shouldRefresh(
                    surfaceIsVisible: true,
                    modelIsLoading: false,
                    modelIsMutating: true,
                    interactionState: GajendraCardInteractionState()
                ),
            "surface refresh must be visible-only and paused during queue interaction"
        )
        try require(
            GajendraSurfacePresentationPolicy.shouldStopRefreshOnPopoverClose(cardSurfaceVisible: false)
                && !GajendraSurfacePresentationPolicy.shouldStopRefreshOnPopoverClose(cardSurfaceVisible: true),
            "popover close must preserve refresh during a floating-card transition"
        )
        var refreshLifecycle = GajendraSurfaceRefreshLifecycle()
        try require(
            !refreshLifecycle.shouldPoll && !refreshLifecycle.surfaceIsVisible,
            "surface refresh must start hidden and stopped"
        )
        refreshLifecycle.revealPopover()
        try require(
            refreshLifecycle.popoverVisible
                && refreshLifecycle.shouldPoll
                && GajendraSurfaceRefreshPolicy.shouldRefresh(
                    surfaceIsVisible: refreshLifecycle.shouldPoll,
                    modelIsLoading: false,
                    modelIsMutating: false,
                    interactionState: GajendraCardInteractionState()
                ),
            "visible status-item popover must own an active refresh surface"
        )
        refreshLifecycle.handoffToCard()
        try require(
            refreshLifecycle.cardSurfaceVisible
                && !refreshLifecycle.popoverVisible
                && refreshLifecycle.shouldPoll,
            "popover-to-card handoff must preserve visible refresh ownership"
        )
        refreshLifecycle.closePopover(cardSurfaceVisible: true)
        try require(refreshLifecycle.shouldPoll, "popover close must not stop a visible card refresh")
        refreshLifecycle.reconcile(cardSurfaceVisible: false, popoverVisible: false)
        try require(
            !refreshLifecycle.shouldPoll,
            "hidden card and popover must stop refresh polling"
        )
        let interactionSession = GajendraCardInteractionSession()
        interactionSession.update(isQueueEditing: true, isSearchFocused: false, isDragging: true)
        try require(interactionSession.state.blocksSurfaceRefresh, "active card interaction did not block surface refresh")
        interactionSession.resetTransientState()
        try require(!interactionSession.state.blocksSurfaceRefresh, "surface interaction state did not clear on hide/reset")
        try require(
            GajendraQueueInteractionTuning.reorderSpringResponse <= 0.24
                && GajendraQueueInteractionTuning.reorderSpringDamping >= 0.88,
            "priority reorder motion must settle quickly without a loose bounce"
        )
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
        let reviewSignal: (String, Double, ReviewDestination) -> ReviewSignal = { status, updatedAt, destination in
            ReviewSignal(
                kind: destination.type == .url ? .pullRequest : .result,
                updatedAt: updatedAt,
                destination: destination,
                providerStatus: status
            )
        }
        let reviewFocus = DeckThread(
            id: "review-agent:focus", sourceId: "review-agent", sourceName: "Review Agent",
            title: "Focus review", project: "Fixture", updatedAt: 5, status: "idle", level: .focus,
            isCurrent: true, deepLink: "review-agent://threads/focus",
            allowedDeepLinkSchemes: ["review-agent", "https"],
            review: reviewSignal("FINISHED", 20, ReviewDestination(type: .url, url: "https://example.test/reviews/focus"))
        )
        let reviewImportant = DeckThread(
            id: "review-agent:important", sourceId: "review-agent", sourceName: "Review Agent",
            title: "Important review", project: "Fixture", updatedAt: 4, status: "idle", level: .important,
            isCurrent: false, deepLink: "review-agent://threads/important",
            allowedDeepLinkSchemes: ["review-agent"],
            review: reviewSignal("READY", 30, ReviewDestination(type: .thread, deepLink: "review-agent://threads/important"))
        )
        let reviewAvailable = DeckThread(
            id: "review-agent:available", sourceId: "review-agent", sourceName: "Review Agent",
            title: "Available review", project: "Fixture", updatedAt: 3, status: "idle", level: nil,
            isCurrent: false, deepLink: "review-agent://threads/available",
            allowedDeepLinkSchemes: ["review-agent", "https"],
            review: reviewSignal("FINISHED", 10, ReviewDestination(type: .url, url: "https://example.test/reviews/available"))
        )
        let staleRunningReview = DeckThread(
            id: "review-agent:running", sourceId: "review-agent", sourceName: "Review Agent",
            title: "Still running", project: "Fixture", updatedAt: 6, status: "active", level: nil,
            isCurrent: false, deepLink: "review-agent://threads/running",
            allowedDeepLinkSchemes: ["review-agent", "https"],
            review: reviewSignal("FINISHED", 40, ReviewDestination(type: .url, url: "https://example.test/reviews/running"))
        )
        let reviewSnapshot = DeckSnapshot(
            generatedAt: snapshot.generatedAt,
            current: reviewFocus,
            focus: [reviewFocus],
            important: [reviewImportant],
            available: [reviewAvailable, staleRunningReview],
            collapsed: snapshot.collapsed,
            focusGuide: snapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: snapshot.source,
            sources: snapshot.sources,
            error: nil
        )
        try require(
            reviewSnapshot.reviewReadyThreads.map(\.id) == [reviewImportant.id, reviewFocus.id, reviewAvailable.id],
            "Ready for Review must sort by ready time and suppress an overlapping Running record"
        )
        try require(
            reviewSnapshot.runningThreads.map(\.id) == [staleRunningReview.id],
            "Running must take precedence over stale review readiness"
        )
        try require(
            snapshot.searchThreads("design").contains(where: { $0.id == snapshot.current?.id })
                && inclusiveSnapshot.searchThreads("important").contains(where: { $0.id == activeImportant.id })
                && inclusiveSnapshot.searchThreads("running").count == 3
                && reviewSnapshot.searchThreads("ready for review").contains(where: { $0.id == reviewImportant.id }),
            "local search must cover bounded context, placement, provider-running, and Ready metadata"
        )
        try require(
            reviewSnapshot.searchThreads("review agent").map(\.id).count == 4
                && Set(reviewSnapshot.searchThreads("review agent").map(\.id)).count == 4,
            "global search must return review-ready and ordinary threads without duplicates"
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
        let moveBeforeData = try JSONEncoder().encode(
            DeckMutation.moveBefore(
                threadId: "codex:focus-1",
                level: .focus,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: "codex:focus-2"
            )
        )
        guard let moveBeforeObject = try JSONSerialization.jsonObject(with: moveBeforeData) as? [String: Any] else {
            throw SelfTestError.failed("move-before mutation did not encode as an object")
        }
        try require(moveBeforeObject["type"] as? String == "move-before", "atomic move type changed")
        try require(moveBeforeObject["currentThreadId"] as? String == "codex:focus-2", "exact NOW ID did not encode")
        try require(moveBeforeObject["beforeThreadId"] is NSNull, "append target must encode explicit null")

        let queueThread: (String, PriorityLevel) -> DeckThread = { id, level in
            DeckThread(
                id: id,
                sourceId: "codex",
                sourceName: "Codex",
                title: id,
                project: "Queue fixture",
                updatedAt: 1,
                status: "idle",
                level: level,
                isCurrent: false,
                deepLink: "codex://threads/\(id)"
            )
        }
        let queueNow = queueThread("queue-now", .focus)
        let queueFocusA = queueThread("queue-focus-a", .focus)
        let queueFocusB = queueThread("queue-focus-b", .focus)
        let queueFocusC = queueThread("queue-focus-c", .focus)
        let queueImportantA = queueThread("queue-important-a", .important)
        let queueImportantB = queueThread("queue-important-b", .important)
        let queueAvailable = DeckThread(
            id: "queue-available",
            sourceId: "codex",
            sourceName: "Codex",
            title: "queue-available",
            project: "Queue fixture",
            updatedAt: 1,
            status: "idle",
            level: nil,
            isCurrent: false,
            deepLink: "codex://threads/queue-available"
        )
        let queueSnapshot = DeckSnapshot(
            generatedAt: snapshot.generatedAt,
            current: queueNow,
            focus: [queueNow, queueFocusA, queueFocusB, queueFocusC],
            important: [queueImportantA, queueImportantB],
            available: [queueAvailable],
            collapsed: snapshot.collapsed,
            focusGuide: snapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: snapshot.source,
            sources: snapshot.sources,
            error: nil
        )
        guard let upwardPlan = GajendraQueueMovePlanner.plan(
            threadId: queueFocusC.id,
            to: .focus,
            before: queueFocusA.id,
            snapshot: queueSnapshot
        ) else { throw SelfTestError.failed("queue drag upward plan was not produced") }
        try require(
            upwardPlan.forward == .moveBefore(
                threadId: queueFocusC.id,
                level: .focus,
                beforeThreadId: queueFocusA.id,
                context: nil,
                currentThreadId: queueNow.id
            ),
            "queue drag must use one atomic move-before with the exact target sibling"
        )
        try require(
            upwardPlan.inverse == .moveBefore(
                threadId: queueFocusC.id,
                level: .focus,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: queueNow.id
            ),
            "queue undo must capture the exact prior lane/order/context/NOW"
        )
        let nonFirstCurrentSnapshot = DeckSnapshot(
            revision: queueSnapshot.revision,
            generatedAt: queueSnapshot.generatedAt,
            current: queueFocusB,
            focus: [queueFocusA, queueFocusB, queueFocusC],
            important: queueSnapshot.important,
            available: queueSnapshot.available,
            collapsed: queueSnapshot.collapsed,
            focusGuide: queueSnapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: queueSnapshot.source,
            sources: queueSnapshot.sources,
            error: nil
        )
        guard let nonFirstPlan = GajendraQueueMovePlanner.plan(
            threadId: queueFocusC.id,
            to: .focus,
            before: queueFocusA.id,
            snapshot: nonFirstCurrentSnapshot
        ) else { throw SelfTestError.failed("non-first NOW plan was not produced") }
        try require(
            nonFirstPlan.forward == .moveBefore(
                threadId: queueFocusC.id,
                level: .focus,
                beforeThreadId: queueFocusA.id,
                context: nil,
                currentThreadId: queueFocusB.id
            ) && nonFirstPlan.inverse == .moveBefore(
                threadId: queueFocusC.id,
                level: .focus,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: queueFocusB.id
            ),
            "move-before undo must preserve a non-first Focus NOW"
        )
        guard let downwardPlan = GajendraQueueMovePlanner.plan(
            threadId: queueFocusA.id,
            to: .focus,
            before: queueFocusC.id,
            snapshot: queueSnapshot
        ) else { throw SelfTestError.failed("queue drag downward plan was not produced") }
        try require(
            downwardPlan.forward == .moveBefore(
                threadId: queueFocusA.id,
                level: .focus,
                beforeThreadId: queueFocusC.id,
                context: nil,
                currentThreadId: queueNow.id
            ) && downwardPlan.inverse == .moveBefore(
                threadId: queueFocusA.id,
                level: .focus,
                beforeThreadId: queueFocusB.id,
                context: nil,
                currentThreadId: queueNow.id
            ),
            "same-lane move must capture both exact siblings"
        )
        guard let crossLanePlan = GajendraQueueMovePlanner.plan(
            threadId: queueImportantA.id,
            to: .focus,
            before: queueFocusA.id,
            snapshot: queueSnapshot
        ) else { throw SelfTestError.failed("cross-lane queue plan was not produced") }
        try require(
            crossLanePlan.forward == .moveBefore(
                threadId: queueImportantA.id,
                level: .focus,
                beforeThreadId: queueFocusA.id,
                context: nil,
                currentThreadId: queueNow.id
            ) && crossLanePlan.inverse == .moveBefore(
                threadId: queueImportantA.id,
                level: .important,
                beforeThreadId: queueImportantB.id,
                context: nil,
                currentThreadId: queueNow.id
            ),
            "cross-lane move must restore the original lane and next sibling atomically"
        )
        guard let appendPlan = GajendraQueueMovePlanner.plan(
            threadId: queueFocusA.id,
            to: .focus,
            before: nil,
            snapshot: queueSnapshot
        ) else { throw SelfTestError.failed("queue append plan was not produced") }
        try require(
            appendPlan.forward == .moveBefore(
                threadId: queueFocusA.id,
                level: .focus,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: queueNow.id
            ) && appendPlan.inverse == .moveBefore(
                threadId: queueFocusA.id,
                level: .focus,
                beforeThreadId: queueFocusB.id,
                context: nil,
                currentThreadId: queueNow.id
            ),
            "dropping on a lane must append with a reversible exact inverse"
        )
        try require(
            GajendraQueueMovePlanner.plan(
                threadId: queueFocusA.id,
                to: .focus,
                before: queueFocusA.id,
                snapshot: queueSnapshot
            ) == nil,
            "self-drop must be an explicit no-op"
        )
        let queueRowFrames = [
            queueFocusA.id: CGRect(x: 0, y: 0, width: 240, height: 40),
            queueFocusB.id: CGRect(x: 0, y: 40, width: 240, height: 40),
            queueFocusC.id: CGRect(x: 0, y: 80, width: 240, height: 40)
        ]
        try require(
            GajendraQueueEditHitTesting.isSelfDrop(
                at: CGPoint(x: 120, y: 60),
                sourceThreadId: queueFocusB.id,
                taskFrames: queueRowFrames
            )
                && !GajendraQueueEditHitTesting.isSelfDrop(
                    at: CGPoint(x: 120, y: 100),
                    sourceThreadId: queueFocusB.id,
                    taskFrames: queueRowFrames
                ),
            "dropping on the source frame must be an explicit UI no-op"
        )
        try require(
            GajendraQueueMovePlanner.plan(
                threadId: "missing",
                to: .important,
                before: nil,
                snapshot: queueSnapshot
            ) == nil,
            "queue drag must reject unknown task identifiers"
        )
        guard let currentToImportant = GajendraQueueMovePlanner.plan(
            threadId: queueNow.id,
            to: .important,
            before: nil,
            snapshot: queueSnapshot
        ) else { throw SelfTestError.failed("moving NOW out of Focus did not produce a plan") }
        try require(
            currentToImportant.forward == .moveBefore(
                threadId: queueNow.id,
                level: .important,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: queueFocusA.id
            ) && currentToImportant.inverse == .moveBefore(
                threadId: queueNow.id,
                level: .focus,
                beforeThreadId: queueFocusA.id,
                context: nil,
                currentThreadId: queueNow.id
            ),
            "moving NOW Focus to Important must select the next remaining Focus and restore it on undo"
        )
        guard let availableToImportant = GajendraQueueMovePlanner.plan(
            threadId: queueAvailable.id,
            to: .important,
            before: nil,
            snapshot: queueSnapshot
        ) else { throw SelfTestError.failed("available-to-Important plan was not produced") }
        try require(
            availableToImportant.inverse == .moveBefore(
                threadId: queueAvailable.id,
                level: nil,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: queueNow.id
            ),
            "Available add undo must always omit a before sibling"
        )
        try require(
            GajendraQueueMovePlanner.plan(
                threadId: queueFocusC.id,
                to: .focus,
                before: nil,
                snapshot: queueSnapshot
            ) == nil,
            "same-lane append of the last item must be a no-op"
        )
        guard let middleToEnd = GajendraQueueMovePlanner.plan(
            threadId: queueFocusA.id,
            to: .focus,
            before: nil,
            snapshot: queueSnapshot
        ) else { throw SelfTestError.failed("middle-to-end append plan was dropped") }
        try require(
            middleToEnd.forward == .moveBefore(
                threadId: queueFocusA.id,
                level: .focus,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: queueNow.id
            ),
            "middle-to-end append must remain an atomic move"
        )
        guard let makeNowPlan = GajendraQueueMovePlanner.planMakeNow(
            threadId: queueImportantA.id,
            snapshot: nonFirstCurrentSnapshot
        ) else { throw SelfTestError.failed("Make NOW atomic plan was not produced") }
        try require(
            makeNowPlan.forward == .moveBefore(
                threadId: queueImportantA.id,
                level: .focus,
                beforeThreadId: queueFocusA.id,
                context: nil,
                currentThreadId: queueImportantA.id
            ) && makeNowPlan.inverse == .moveBefore(
                threadId: queueImportantA.id,
                level: .important,
                beforeThreadId: queueImportantB.id,
                context: nil,
                currentThreadId: queueFocusB.id
            ),
            "Make NOW must capture Important order and a non-first prior NOW"
        )
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
        let thresholdEngagementOrigin = GajendraOverlayPlacement.draggedOrigin(
            startOrigin: CGPoint(x: 1_200, y: 40),
            pointerStart: CGPoint(x: 1_236, y: 70),
            pointerLocation: CGPoint(x: 1_236, y: 70)
        )
        try require(
            thresholdEngagementOrigin == CGPoint(x: 1_200, y: 40),
            "launcher drag engagement must consume its recognition dead zone without jumping"
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
        let priorityFrames = [
            CGRect(x: 20, y: 80, width: 240, height: 44),
            CGRect(x: 280, y: 80, width: 240, height: 44),
        ]
        try require(
            !GajendraQueueEditHitTesting.shouldExit(
                at: CGPoint(x: 120, y: 100),
                taskFrames: priorityFrames,
                editingAtPointerDown: true
            ),
            "a click inside a priority task must preserve card edit mode"
        )
        try require(
            GajendraQueueEditHitTesting.shouldExit(
                at: CGPoint(x: 120, y: 40),
                taskFrames: priorityFrames,
                editingAtPointerDown: true
            ),
            "a click outside every priority task must exit card edit mode"
        )
        try require(
            !GajendraQueueEditHitTesting.shouldExit(
                at: CGPoint(x: 120, y: 40),
                taskFrames: priorityFrames,
                editingAtPointerDown: false
            ),
            "the press that enters edit mode must not immediately cancel that mode on release"
        )
        try await MainActor.run {
            let cardInteractionSession = GajendraCardInteractionSession()
            let initialResetRevision = cardInteractionSession.resetRevision
            cardInteractionSession.resetTransientState()
            try require(
                cardInteractionSession.resetRevision == initialResetRevision + 1,
                "card dismissal must advance the transient edit reset signal"
            )
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
            var primaryActivationCount = 0
            editController.performPrimaryAction { primaryActivationCount += 1 }
            try require(!editController.isEditing, "a primary tap must finish launcher edit mode")
            try require(primaryActivationCount == 1, "a primary tap in edit mode must still open the card")
            editController.performPrimaryAction { primaryActivationCount += 1 }
            try require(primaryActivationCount == 2, "a normal primary tap must keep the same activation route")
            try require(
                GajendraOverlayPlacement.dragThreshold == 6,
                "launcher drag recognition must preserve the six-point micro-movement tolerance"
            )
            editController.enter()
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
        try await verifyNativeBoundaries()
        try verifyReviewOpenRoutes(reviewSnapshot)
        try await verifyNativeViewProof(with: snapshot)
        try await verifyQueueHandlers(with: snapshot)
        try await verifyAdvancingQueueIntents(with: snapshot)
        try await verifyQueuedRefresh(with: snapshot)
        try await verifyQueuedMutation(with: snapshot)
        try await verifyMultiLevelHistory(with: snapshot)
        try await verifyFailedMutationDoesNotRegisterUndo(with: snapshot)
        try await verifySlowMutationBusy(with: snapshot)
        try await verifyBusyAccessibilityRoute(with: snapshot)
        try await verifyResumeFailureCleanup(with: snapshot)
        try await verifyQueuedHistoryInvalidation(with: snapshot)
        try await verifyMutationResultValidation(with: snapshot)
        try await verifyClientProcessBounds(with: snapshot)
        print("Gajendra companion self-test passed")
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
            try require(settings.hoverCardSize == .compact, "Compact must be the default hover-card size")
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
            try require(settings.hoverCardSize == .compact, "invalid hover-card size must fall back safely")
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
            try require(freshState.wasSeen, "fresh onboarding must persist an explicit seen state before UI presentation")
            try require(
                freshState.shouldPresentOnLaunch(hasPriorNativeState: false),
                "Not now or window close must present onboarding again after relaunch"
            )
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

    private static func verifyNativeBoundaries() async throws {
        try require(GajendraBrandCopy.name == "Gajendra", "native product name drifted")
        try require(GajendraBrandCopy.descriptor == "One clear focus across your AI tools.", "native descriptor drifted")
        try require(GajendraBrandCopy.promise == "One NOW. One short queue. One click back to the exact thread.", "native promise drifted")
        try require(GajendraLaunchAtLoginPolicy.automaticAction() == .readOnly, "launch at login must be read-only at startup")
        try require(GajendraLaunchAtLoginPolicy.explicitAction(isEnabled: false) == .register, "explicit launch toggle must register when off")
        try require(GajendraLaunchAtLoginPolicy.explicitAction(isEnabled: true) == .unregister, "explicit launch toggle must unregister when on")
        try require(GajendraLaunchAtLoginPolicy.explicitAction(isEnabled: false, requiresApproval: true) == .unregister, "approval-required state must unregister on explicit toggle-off")
        var errorChannels = GajendraErrorChannels()
        errorChannels.openFailed("Gajendra could not open this thread.")
        try require(errorChannels.visible == "Gajendra could not open this thread.", "open failure was not visible")
        errorChannels.openSucceeded()
        try require(errorChannels.visible == nil, "successful open did not clear the stale open error")
        errorChannels.mutationFailed("That priority changed elsewhere. Refreshing the latest priorities.")
        errorChannels.openFailed("Gajendra could not open this thread.")
        errorChannels.openSucceeded()
        try require(
            errorChannels.visible == "That priority changed elsewhere. Refreshing the latest priorities.",
            "successful open hid a mutation error"
        )
        errorChannels.mutationSucceeded()
        try require(errorChannels.visible == nil, "successful mutation did not clear its typed error")

        let loginService = LoginServiceProbe()
        let loginToggle = GajendraLaunchAtLoginToggle(service: loginService)
        let registerAction = try loginToggle.toggle()
        try require(registerAction == .register, "login toggle must register from not-registered")
        try require(loginService.readStatus() == .requiresApproval, "login registration proof must include approval-required")
        let relaunchedToggle = GajendraLaunchAtLoginToggle(service: loginService)
        let unregisterAction = try relaunchedToggle.toggle()
        try require(unregisterAction == .unregister, "approval-required login item must unregister on toggle-off")
        try require(loginService.readStatus() == .notRegistered, "login item remained after explicit disable/relaunch")

        let bundleURL = URL(fileURLWithPath: "/tmp/Gajendra-self-test.app")
        let bundledPath = bundleURL.appendingPathComponent("Contents/Resources/Runtime/node/bin/node").path
        let overridePath = "/tmp/gajendra-node-override"
        let overrideResolver = GajendraNodeResolver(
            environment: ["GAJENDRA_NODE_BIN": overridePath, "PATH": ""],
            bundleURL: bundleURL,
            isExecutable: { path in path == overridePath || path == bundledPath }
        )
        try require(overrideResolver.resolve()?.source == "GAJENDRA override", "GAJENDRA override must resolve first")
        let bundledResolver = GajendraNodeResolver(
            environment: ["PATH": ""],
            bundleURL: bundleURL,
            isExecutable: { $0 == bundledPath }
        )
        try require(
            bundledResolver.resolve() == GajendraNodeResolution(executable: bundledPath, source: "bundled runtime"),
            "bundled Node must resolve with an empty PATH"
        )

        let base = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-self-test-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: base) }
        let quotedCommand = ResumeCommand(
            executable: "/bin/echo",
            arguments: ["hello world", "quote'arg"],
            cwd: "/tmp/work dir"
        )
        let script = try GajendraResumeScriptStore.makeScript(
            command: quotedCommand,
            baseDirectory: base,
            identifier: "fixture"
        )
        try require(script.lastPathComponent == "resume-fixture.command", "resume filename changed unexpectedly")
        let scriptContents = try String(contentsOf: script, encoding: .utf8)
        try require(
            scriptContents == "#!/bin/zsh\nset -e\ncd -- '/tmp/work dir'\nexec '/bin/echo' 'hello world' 'quote'\"'\"'arg'\n",
            "resume script content or shell quoting changed"
        )
        let directory = GajendraResumeScriptStore.directory(baseDirectory: base)
        let directoryPermissions = try FileManager.default.attributesOfItem(atPath: directory.path)[.posixPermissions] as? NSNumber
        let scriptPermissions = try FileManager.default.attributesOfItem(atPath: script.path)[.posixPermissions] as? NSNumber
        try require(directoryPermissions?.intValue ?? 0 & 0o777 == 0o700, "resume directory must be private on every use")
        try require(scriptPermissions?.intValue ?? 0 & 0o777 == 0o700, "resume script must be private")

        let rapidA = try GajendraResumeScriptStore.makeScript(
            command: ResumeCommand(executable: "/bin/echo", arguments: ["rapid"]),
            baseDirectory: base,
            identifier: "rapid"
        )
        let rapidB = try GajendraResumeScriptStore.makeScript(
            command: ResumeCommand(executable: "/bin/echo", arguments: ["rapid"]),
            baseDirectory: base,
            identifier: "rapid"
        )
        try require(rapidA != rapidB, "rapid resume opens must allocate unique scripts")
        let now = Date()
        GajendraResumeScriptStore.cleanup(baseDirectory: base, olderThan: GajendraResumeScriptStore.cleanupDelay, now: now)
        try require(FileManager.default.fileExists(atPath: rapidA.path), "ordinary cleanup removed a fresh resume script")
        try FileManager.default.setAttributes(
            [.modificationDate: now.addingTimeInterval(-(GajendraResumeScriptStore.cleanupDelay + 1))],
            ofItemAtPath: rapidA.path
        )
        GajendraResumeScriptStore.cleanup(baseDirectory: base, olderThan: GajendraResumeScriptStore.cleanupDelay, now: now)
        try require(!FileManager.default.fileExists(atPath: rapidA.path), "stale resume script cleanup did not run")

        let startupStale = try GajendraResumeScriptStore.makeScript(
            command: ResumeCommand(executable: "/bin/echo", arguments: ["stale"]),
            baseDirectory: base,
            identifier: "startup-stale"
        )
        do {
            let startupModel = await MainActor.run { DeckViewModel(client: nil, resumeBaseDirectory: base) }
            _ = startupModel
        }
        try require(!FileManager.default.fileExists(atPath: startupStale.path), "startup stale cleanup did not run")
        let terminationStale: URL
        do {
            let terminationModel = await MainActor.run { DeckViewModel(client: nil, resumeBaseDirectory: base) }
            terminationStale = try GajendraResumeScriptStore.makeScript(
                command: ResumeCommand(executable: "/bin/echo", arguments: ["termination"]),
                baseDirectory: base,
                identifier: "termination-stale"
            )
            _ = terminationModel
        }
        try require(!FileManager.default.fileExists(atPath: terminationStale.path), "termination cleanup did not run")

        let hostileBase = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-hostile-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: hostileBase) }
        try FileManager.default.createDirectory(at: hostileBase, withIntermediateDirectories: true)
        let hostileDirectory = GajendraResumeScriptStore.directory(baseDirectory: hostileBase)
        try FileManager.default.createSymbolicLink(at: hostileDirectory, withDestinationURL: URL(fileURLWithPath: "/tmp"))
        try require(
            (try? GajendraResumeScriptStore.prepareDirectory(baseDirectory: hostileBase)) == nil,
            "resume cleanup must reject a hostile directory symlink"
        )

        let danglingBase = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-dangling-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: danglingBase) }
        try FileManager.default.createDirectory(at: danglingBase, withIntermediateDirectories: true)
        let danglingDirectory = GajendraResumeScriptStore.directory(baseDirectory: danglingBase)
        try FileManager.default.createSymbolicLink(
            atPath: danglingDirectory.path,
            withDestinationPath: "/tmp/gajendra-missing-\(UUID().uuidString)"
        )
        try require(
            (try? GajendraResumeScriptStore.prepareDirectory(baseDirectory: danglingBase)) == nil,
            "resume cleanup must reject a dangling directory symlink before creation"
        )

        let modeBase = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-mode-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: modeBase) }
        let modeDirectory = GajendraResumeScriptStore.directory(baseDirectory: modeBase)
        try FileManager.default.createDirectory(at: modeDirectory, withIntermediateDirectories: true)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: modeDirectory.path)
        try require(
            (try? GajendraResumeScriptStore.prepareDirectory(baseDirectory: modeBase)) == nil,
            "resume cleanup must reject a non-private directory before enumeration"
        )

        try require(
            GajendraDeepLinkPolicy.isPermitted("codex://threads/focus-1", allowedSchemes: ["codex"]),
            "allowlisted deep link must remain openable"
        )
        for blocked in [
            "codex://threads/focus 1",
            "1codex://threads/focus-1",
            "javascript:alert(1)",
            "java%73cript:alert(1)",
            "codex://threads/focus%2D1",
            "data:text/plain,thread",
            "file:///tmp/thread",
            "https://example.com/thread",
        ] {
            try require(
                !GajendraDeepLinkPolicy.isPermitted(blocked, allowedSchemes: ["codex"]),
                "blocked deep link was accepted: \(blocked)"
            )
        }
    }

    @MainActor
    private static func verifyReviewOpenRoutes(_ snapshot: DeckSnapshot) throws {
        guard let urlReview = snapshot.reviewReadyThreads.first(where: { $0.review?.destination.type == .url }),
              let taskReview = snapshot.reviewReadyThreads.first(where: { $0.review?.destination.type == .thread }),
              let runningReview = snapshot.runningThreads.first(where: { $0.review != nil }),
              let urlReviewDestination = urlReview.review?.destination.value else {
            throw SelfTestError.failed("review open-route fixtures are incomplete")
        }
        var opened: [String] = []
        let model = DeckViewModel(
            client: nil,
            initialSnapshot: snapshot,
            deepLinkOpener: { url in
                opened.append(url.absoluteString)
                return true
            }
        )

        model.openReview(urlReview)
        try require(
            opened == [urlReviewDestination],
            "review row did not open its distinct provider-declared review destination"
        )
        model.open(urlReview)
        try require(
            opened.last == urlReview.deepLink,
            "review provider badge did not retain the owning task route"
        )
        model.openReview(taskReview)
        try require(
            opened.last == taskReview.deepLink,
            "task-only review fallback did not open the exact owning task"
        )
        let unsafeReview = DeckThread(
            id: "review-agent:unsafe", sourceId: "review-agent", sourceName: "Review Agent",
            title: "Unsafe review", project: "Fixture", updatedAt: 1, status: "idle", level: nil,
            isCurrent: false, deepLink: "review-agent://threads/unsafe",
            allowedDeepLinkSchemes: ["review-agent", "https"],
            review: ReviewSignal(
                kind: .diff,
                updatedAt: 1,
                destination: ReviewDestination(type: .url, url: "javascript:unsafe-review"),
                providerStatus: "FINISHED"
            )
        )
        let openCount = opened.count
        model.openReview(unsafeReview)
        try require(
            opened.count == openCount,
            "unsafe native review destination bypassed the execution-time allowlist"
        )
        model.openReview(runningReview)
        try require(
            opened.count == openCount,
            "a stale review signal on Running work bypassed Running precedence"
        )
        try require(
            model.openErrorMessage == "Gajendra could not open this review.",
            "suppressed review open did not fail closed with generic copy"
        )
    }

    private static func verifyNativeViewProof(with snapshot: DeckSnapshot) async throws {
        let longTitle = String(repeating: "Long synthetic metadata title ", count: 20)
        let longThread = DeckThread(
            id: "view-proof-long",
            sourceId: "codex",
            sourceName: "Codex",
            title: longTitle,
            project: String(repeating: "project ", count: 24),
            updatedAt: 1,
            status: "active",
            level: .focus,
            isCurrent: true,
            context: .engineering,
            deepLink: "codex://threads/view-proof-long",
            allowedDeepLinkSchemes: ["codex"]
        )
        let viewSnapshot = DeckSnapshot(
            revision: snapshot.revision,
            generatedAt: snapshot.generatedAt,
            current: longThread,
            focus: [longThread],
            important: [],
            available: [],
            collapsed: CollapsedSections(focus: false, important: false),
            focusGuide: snapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: snapshot.source,
            sources: snapshot.sources,
            error: nil
        )
        let model = await DeckViewModel(client: nil, initialSnapshot: viewSnapshot)
        let busyModel = await DeckViewModel(
            client: nil,
            initialSnapshot: viewSnapshot,
            previewBusy: true
        )
        try await MainActor.run {
            let settings = GajendraVisualSettings(
                theme: .focusDeck,
                appearance: .dark,
                hoverCardSize: .expanded
            )
            try require(viewSnapshot.current?.title.count ?? 0 > 240, "view fixture did not carry long metadata")

            let accessibilityView = GajendraHoverCardView(
                model: model,
                visualSettings: settings,
                isPreview: true
            )
            .environment(\.colorScheme, .dark)
            let cardCapture = HostedLayoutCapture()
            let cardHost = NSHostingView(
                rootView: HostedEvidenceContainer(content: accessibilityView, capture: cardCapture)
            )
            cardHost.frame = NSRect(x: 0, y: 0, width: 1320, height: 1220)
            cardHost.layoutSubtreeIfNeeded()
            try allowHostedPreferencesToSettle()
            try require(cardHost.fittingSize.width > 0 && cardHost.fittingSize.height > 0, "actual hosted card did not produce a layout")
            try requireHostedGeometry(
                cardCapture.evidence,
                in: cardHost.bounds,
                label: "expanded hosted card"
            )

            let busyView = GajendraHoverCardView(
                model: busyModel,
                visualSettings: settings,
                isPreview: true
            )
            .environment(\.colorScheme, .dark)
            let busyCapture = HostedLayoutCapture()
            let busyHost = NSHostingView(
                rootView: HostedEvidenceContainer(content: busyView, capture: busyCapture)
            )
            busyHost.frame = NSRect(x: 0, y: 0, width: 1320, height: 1220)
            busyHost.layoutSubtreeIfNeeded()
            try allowHostedPreferencesToSettle()
            try require(
                busyModel.isLoading && busyModel.isMutating
                    && busyHost.fittingSize.width > 0
                    && busyHost.fittingSize.height > 0,
                "actual busy preview did not expose a bounded accessible layout"
            )
            try requireHostedGeometry(busyCapture.evidence, in: busyHost.bounds, label: "busy hosted card")

            let organizerView = DeckContentView(
                model: model,
                visualSettings: settings,
                usesScrollView: false,
                isPreview: true
            )
            .environment(\.colorScheme, .dark)
            let organizerHost = NSHostingView(rootView: organizerView)
            organizerHost.frame = NSRect(x: 0, y: 0, width: 860, height: 900)
            organizerHost.layoutSubtreeIfNeeded()
            try require(organizerHost.fittingSize.width >= 520, "actual organizer view violated its minimum width")

            let compact = GajendraHoverCardSizing.size(
                for: .compact,
                visibleFrame: CGRect(x: 0, y: 0, width: 420, height: 380)
            )
            let expanded = GajendraHoverCardSizing.size(
                for: .expanded,
                visibleFrame: CGRect(x: 0, y: 0, width: 1512, height: 949)
            )
            try require(compact.width >= 320 && compact.height >= 356, "actual compact view size violated minimum bounds")
            try require(expanded.width <= 1512 && expanded.height <= 949, "actual expanded view exceeded visible bounds")

            let minimumCardSize = GajendraHoverCardSizing.size(
                for: .compact,
                visibleFrame: CGRect(x: 0, y: 0, width: 344, height: 380)
            )
            let minimumSettings = GajendraVisualSettings(
                theme: .nativePopover,
                appearance: .light,
                hoverCardSize: .compact
            )
            let minimumCapture = HostedLayoutCapture()
            let minimumView = GajendraHoverCardView(
                model: model,
                visualSettings: minimumSettings,
                isPreview: true
            )
            .environment(\.colorScheme, .light)
            let minimumHost = NSHostingView(
                rootView: HostedEvidenceContainer(content: minimumView, capture: minimumCapture)
            )
            minimumHost.frame = NSRect(
                x: 0,
                y: 0,
                width: minimumCardSize.width,
                height: minimumCardSize.height
            )
            minimumHost.layoutSubtreeIfNeeded()
            try allowHostedPreferencesToSettle()
            try require(
                minimumHost.fittingSize.width > 0 && minimumHost.fittingSize.height > 0,
                "minimum hosted card did not produce a layout"
            )
            try requireHostedGeometry(
                minimumCapture.evidence,
                in: minimumHost.bounds,
                label: "minimum hosted card"
            )

            let accessibilitySnapshot = hostedAccessibilitySnapshot(for: cardHost)
            if accessibilitySnapshot.labels.isEmpty && accessibilitySnapshot.navigationOrder.isEmpty {
                // SwiftUI's semantic tree is intentionally unavailable to a headless process
                // until an accessibility client is active. Keep this an honest external gate.
                try require(
                    !NSWorkspace.shared.isVoiceOverEnabled,
                    "hosted accessibility tree was empty while VoiceOver was active"
                )
            } else {
                try require(
                    accessibilitySnapshot.labels.contains("Open Gajendra"),
                    "hosted accessibility tree omitted the primary open label"
                )
                try require(
                    accessibilitySnapshot.navigationOrder.contains("Open Gajendra"),
                    "hosted accessibility navigation order omitted the primary open action"
                )
                try require(
                    accessibilitySnapshot.actions.contains(where: { $0.localizedCaseInsensitiveContains("press") }),
                    "hosted accessibility tree omitted the primary action"
                )
            }

            let busyAccessibilitySnapshot = hostedAccessibilitySnapshot(for: busyHost)
            if !busyAccessibilitySnapshot.labels.isEmpty
                || !busyAccessibilitySnapshot.values.isEmpty
                || !busyAccessibilitySnapshot.navigationOrder.isEmpty {
                try require(
                    busyAccessibilitySnapshot.values.contains("Busy; unavailable")
                        || busyAccessibilitySnapshot.unavailableLabels.contains(where: { $0.contains("Open Gajendra") }),
                    "hosted busy tree omitted the unavailable/busy state"
                )
            }

            let reducedMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
            let increasedContrast = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast
            let variantCapture = HostedLayoutCapture()
            let variantHost = NSHostingView(
                rootView: HostedEvidenceContainer(content: accessibilityView, capture: variantCapture)
            )
            variantHost.frame = cardHost.frame
            variantHost.layoutSubtreeIfNeeded()
            try allowHostedPreferencesToSettle()
            try requireHostedGeometry(variantCapture.evidence, in: variantHost.bounds, label: "system accessibility variant")
            print("Hosted B6 system variants: increased-contrast=\(increasedContrast), reduce-motion=\(reducedMotion), VoiceOver=\(NSWorkspace.shared.isVoiceOverEnabled)")
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
            let requests = await probe.requests()
            let isLoading = await model.isLoading
            if requests.map(\.mutation) == [mutation] && !isLoading {
                let idempotencyKey = requests.first?.idempotencyKey
                try require(idempotencyKey != nil, "native mutation must carry an idempotency key")
                try require(requests.first?.protocolVersion == 1, "native mutation protocol version changed")
                try require(requests.first?.expectedRevision == snapshot.revision, "native mutation must carry current revision")
                let undoRegistrations = await model.undoRegistrationCount
                try require(undoRegistrations == 1, "applied mutation must register undo")
                await MainActor.run { model.undo() }
                for _ in 0..<50 {
                    try await Task.sleep(for: .milliseconds(10))
                    let undoRequests = await probe.requests()
                    let undoLoading = await model.isLoading
                    if undoRequests.count == 2 && !undoLoading {
                        try require(
                            undoRequests[1].mutation == .setCollapsed(level: .focus, collapsed: false),
                            "undo must dispatch the captured inverse mutation"
                        )
                        let redoRegistrations = await model.undoRegistrationCount
                        try require(redoRegistrations == 2, "undo completion must register a redo")
                        let canRedo = await model.canRedo
                        try require(canRedo, "successful undo must expose redo")
                        await MainActor.run { model.redo() }
                        for _ in 0..<50 {
                            try await Task.sleep(for: .milliseconds(10))
                            let redoRequests = await probe.requests()
                            let redoLoading = await model.isLoading
                            if redoRequests.count == 3 && !redoLoading {
                                try require(
                                    redoRequests[2].mutation == mutation,
                                    "redo must dispatch a third server request through the visible history route"
                                )
                                let canUndo = await model.canUndo
                                try require(canUndo, "successful redo must restore undo")
                                return
                            }
                        }
                        throw SelfTestError.failed("redo did not dispatch a third request")
                    }
                }
                throw SelfTestError.failed("undo inverse did not complete and register redo")
            }
        }
        throw SelfTestError.failed("mutation requested during refresh was dropped")
    }

    private static func verifyAdvancingQueueIntents(with snapshot: DeckSnapshot) async throws {
        let makeThread: (String, PriorityLevel?, ThreadContext?) -> DeckThread = { id, level, context in
            DeckThread(
                id: id,
                sourceId: "codex",
                sourceName: "Codex",
                title: id,
                project: "Advancing queue fixture",
                updatedAt: 1,
                status: "idle",
                level: level,
                isCurrent: false,
                context: context,
                deepLink: "codex://threads/\(id)"
            )
        }
        let now = makeThread("intent-a", .focus, .design)
        let next = makeThread("intent-b", .focus, nil)
        let last = makeThread("intent-c", .focus, nil)
        let initial = DeckSnapshot(
            revision: 0,
            generatedAt: snapshot.generatedAt,
            current: now,
            focus: [now, next, last],
            important: [],
            available: [],
            collapsed: snapshot.collapsed,
            focusGuide: snapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: snapshot.source,
            sources: snapshot.sources,
            error: nil
        )

        let makeNowService = AdvancingQueueService(initial: initial)
        let makeNowModel = await DeckViewModel(client: makeNowService, initialSnapshot: initial)
        await makeNowModel.makeNow(threadId: next.id)
        await makeNowModel.makeNow(threadId: last.id)
        try await waitUntilIdle(makeNowModel)
        let makeNowRequests = await makeNowService.requests()
        try require(
            makeNowRequests.map(\.expectedRevision) == [0, 1],
            "queued Make NOW intents did not advance their expected revisions"
        )
        try require(
            makeNowRequests.map(\.mutation) == [
                .moveBefore(threadId: next.id, level: .focus, beforeThreadId: now.id, context: nil, currentThreadId: next.id),
                .moveBefore(threadId: last.id, level: .focus, beforeThreadId: next.id, context: nil, currentThreadId: last.id),
            ],
            "queued Make NOW intents carried stale forward order or NOW state"
        )
        let makeNowFinal = try await makeNowService.snapshot()
        try require(makeNowFinal.focus.map(\.id) == [last.id, next.id, now.id], "queued Make NOW final order was not exact")
        try require(makeNowFinal.current?.id == last.id, "queued Make NOW did not leave the last intent as NOW")

        let contextService = AdvancingQueueService(initial: initial)
        let contextModel = await DeckViewModel(client: contextService, initialSnapshot: initial)
        await contextModel.apply(.setContext(threadId: next.id, context: .engineering))
        await contextModel.moveToLevel(threadId: next.id, level: .important)
        try await waitUntilIdle(contextModel)
        let contextRequests = await contextService.requests()
        try require(
            contextRequests.map(\.expectedRevision) == [0, 1],
            "queued context and move intents did not advance their expected revisions"
        )
        try require(
            contextRequests.last?.mutation == .moveBefore(
                threadId: next.id,
                level: .important,
                beforeThreadId: nil,
                context: .engineering,
                currentThreadId: now.id
            ),
            "queued move intent did not preserve context from the actual dispatch snapshot"
        )
        let contextFinal = try await contextService.snapshot()
        try require(contextFinal.important.map(\.id) == [next.id], "queued context move did not reach Important")
        try require(contextFinal.important.first?.context == .engineering, "queued context move lost engineering context")
    }

    private static func verifyMultiLevelHistory(with snapshot: DeckSnapshot) async throws {
        let makeThread: (String, PriorityLevel, ThreadContext?) -> DeckThread = { id, level, context in
            DeckThread(
                id: id,
                sourceId: "codex",
                sourceName: "Codex",
                title: id,
                project: "History fixture",
                updatedAt: 1,
                status: "idle",
                level: level,
                isCurrent: false,
                context: context,
                deepLink: "codex://threads/\(id)"
            )
        }
        let now = makeThread("history-a", .focus, .design)
        let moved = makeThread("history-b", .focus, .life)
        let promoted = makeThread("history-c", .important, .engineering)
        let initial = DeckSnapshot(
            revision: 0,
            generatedAt: snapshot.generatedAt,
            current: now,
            focus: [now, moved],
            important: [promoted],
            available: [],
            collapsed: snapshot.collapsed,
            focusGuide: snapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: snapshot.source,
            sources: snapshot.sources,
            error: nil
        )
        let service = AdvancingQueueService(initial: initial)
        let model = await DeckViewModel(client: service, initialSnapshot: initial)
        await model.moveToLevel(threadId: moved.id, level: .important)
        await model.makeNow(threadId: promoted.id)
        try await waitUntilIdle(model)
        await model.undo()
        try await waitUntilIdle(model)
        await model.undo()
        try await waitUntilIdle(model)
        await model.redo()
        try await waitUntilIdle(model)
        await model.redo()
        try await waitUntilIdle(model)

        let requests = await service.requests()
        try require(
            requests.map(\.expectedRevision) == [0, 1, 2, 3, 4, 5],
            "multi-level history did not restamp its coherent revision watermark"
        )
        let final = try await service.snapshot()
        try require(final.focus.map(\.id) == [promoted.id, now.id], "redo did not restore exact Focus order")
        try require(final.important.map(\.id) == [moved.id], "redo did not restore exact Important order")
        try require(final.current?.id == promoted.id, "redo did not restore exact NOW")
        try require(final.focus.first?.context == promoted.context, "redo lost promoted context")
        try require(final.important.first?.context == moved.context, "redo lost moved context")
        let canUndo = await model.canUndo
        let canRedo = await model.canRedo
        let registrationCount = await model.undoRegistrationCount
        try require(canUndo && !canRedo, "two redos did not restore the correct history stacks")
        try require(registrationCount == 6, "each successful user/undo/redo operation must be recorded")
    }

    private static func verifyFailedMutationDoesNotRegisterUndo(with snapshot: DeckSnapshot) async throws {
        let probe = RefreshProbe(
            snapshot: snapshot,
            outcome: .conflict,
            error: DeckMutationError(code: "stale-revision", message: "server detail must not surface")
        )
        let model = await DeckViewModel(client: probe)
        await model.refresh()
        await model.apply(.setCollapsed(level: .focus, collapsed: true))
        for _ in 0..<50 {
            try await Task.sleep(for: .milliseconds(10))
            if !(await model.isLoading) {
                let undoRegistrations = await model.undoRegistrationCount
                let message = await model.errorMessage
                try require(undoRegistrations == 0, "conflict must not register undo")
                try require(
                    message == "That priority changed elsewhere. Refreshing the latest priorities.",
                    "conflict must preserve a typed generic user error"
                )
                return
            }
        }
        throw SelfTestError.failed("conflict mutation did not settle")
    }

    private static func verifySlowMutationBusy(with snapshot: DeckSnapshot) async throws {
        let probe = RefreshProbe(snapshot: snapshot, mutationDelayMilliseconds: 120)
        let model = await DeckViewModel(client: probe)
        await model.refresh()
        try await waitUntilIdle(model)
        let mutation = DeckMutation.setCollapsed(level: .focus, collapsed: true)
        await model.apply(mutation)
        var observedBusy = false
        for _ in 0..<80 {
            let mutating = await model.isMutating
            observedBusy = observedBusy || mutating
            if !(await model.isLoading) { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        try require(observedBusy, "slow mutation did not expose busy state")
        await model.apply(mutation)
        try await waitUntilIdle(model)
        let requestCount = await probe.requestCount()
        let canUndo = await model.canUndo
        let loading = await model.isLoading
        let mutating = await model.isMutating
        try require(requestCount == 1, "busy duplicate mutation was not prevented")
        try require(canUndo, "successful slow mutation did not enter history")
        try require(!loading && !mutating, "slow mutation left the UI permanently busy")
    }

    private static func verifyBusyAccessibilityRoute(with snapshot: DeckSnapshot) async throws {
        guard let thread = snapshot.allThreads.first else {
            throw SelfTestError.failed("busy accessibility fixture has no thread row")
        }
        let probe = RefreshProbe(snapshot: snapshot, mutationDelayMilliseconds: 120)
        let model = await DeckViewModel(client: probe, initialSnapshot: snapshot)
        let first = DeckMutation.setCollapsed(level: .focus, collapsed: true)
        await model.apply(first, actionName: "Initial busy mutation")
        let accepted = await model.performAccessibilityMutation(
            .move(threadId: thread.id, direction: .down),
            actionName: "Move down"
        )
        try require(!accepted, "busy widget row VoiceOver action was not guarded")
        try await waitUntilIdle(model)
        let requests = await probe.requests()
        try require(
            requests.count == 1 && requests.first?.mutation == first,
            "busy widget row VoiceOver action sent a second mutation request"
        )
    }

    private static func verifyResumeFailureCleanup(with snapshot: DeckSnapshot) async throws {
        let command = ResumeCommand(executable: "/bin/echo", arguments: ["resume failure fixture"], cwd: "/tmp")
        let thread = DeckThread(
            id: "resume-failure",
            sourceId: "codex",
            sourceName: "Codex",
            title: "Resume failure fixture",
            project: "Native self-test",
            updatedAt: 1,
            status: "idle",
            level: nil,
            isCurrent: false,
            deepLink: "codex://threads/resume-failure",
            allowedDeepLinkSchemes: ["codex"],
            resumeCommand: command
        )
        let failureModes: [(String, DeckViewModel.ResumeScriptOpener)] = [
            ("false", { _ in false }),
            ("throw", { _ in throw NSError(domain: "native-self-test", code: 1) }),
        ]
        for (label, opener) in failureModes {
            let base = FileManager.default.temporaryDirectory.appendingPathComponent(
                "gajendra-resume-failure-\(label)-\(UUID().uuidString)",
                isDirectory: true
            )
            defer { try? FileManager.default.removeItem(at: base) }
            let model = await DeckViewModel(
                client: nil,
                resumeBaseDirectory: base,
                resumeScriptOpener: opener
            )
            await model.open(thread)
            let directory = GajendraResumeScriptStore.directory(baseDirectory: base)
            let residue = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
            try require(
                residue.filter({ $0.lastPathComponent.hasPrefix("resume-") }).isEmpty,
                "failed resume opener (\(label)) left a runnable script behind"
            )
        }
    }

    private static func verifyQueuedHistoryInvalidation(with snapshot: DeckSnapshot) async throws {
        let queuedProbe = RefreshProbe(snapshot: snapshot, mutationDelayMilliseconds: 60)
        let queuedModel = await DeckViewModel(client: queuedProbe)
        await queuedModel.refresh()
        try await waitUntilIdle(queuedModel)
        let first = DeckMutation.setCollapsed(level: .focus, collapsed: true)
        let second = DeckMutation.setCollapsed(level: .important, collapsed: true)
        await queuedModel.apply(first)
        await queuedModel.apply(second)
        try await waitUntilIdle(queuedModel)
        let queuedRequests = await queuedProbe.requests()
        try require(queuedRequests.map(\.mutation) == [first, second], "two queued actions did not serialize")
        try require(
            queuedRequests[0].idempotencyKey != queuedRequests[1].idempotencyKey,
            "queued actions reused an idempotency key"
        )
        try require(
            queuedRequests.allSatisfy { $0.expectedRevision == snapshot.revision },
            "queued actions did not rebase their inverse at actual dispatch"
        )

        let committed = snapshotWithRevision(snapshot, revision: snapshot.revision + 1)
        let external = snapshotWithRevision(snapshot, revision: snapshot.revision + 2)
        let externalProbe = ExternalRefreshProbe(initial: snapshot, committed: committed)
        let externalModel = await DeckViewModel(client: externalProbe)
        await externalModel.refresh()
        try await waitUntilIdle(externalModel)
        await externalModel.apply(first)
        try await waitUntilIdle(externalModel)
        let committedCanUndo = await externalModel.canUndo
        try require(committedCanUndo, "committed action did not expose undo")
        await externalProbe.setSnapshot(external)
        await externalModel.refresh()
        try await waitUntilIdle(externalModel)
        let canUndoAfterRefresh = await externalModel.canUndo
        try require(!canUndoAfterRefresh, "external refresh retained stale undo history")
        let requestCountBeforeUndo = await externalProbe.requestCount()
        await externalModel.undo()
        try await Task.sleep(for: .milliseconds(80))
        let requestCountAfterUndo = await externalProbe.requestCount()
        try require(
            requestCountAfterUndo == requestCountBeforeUndo,
            "stale undo sent a mutation after external refresh"
        )
        let externalError = await externalModel.mutationErrorMessage
        try require(
            externalError == "That change is no longer undoable because priorities changed elsewhere.",
            "external refresh did not leave a typed fail-closed history error"
        )
    }

    private static func verifyMutationResultValidation(with snapshot: DeckSnapshot) async throws {
        let older = snapshotWithRevision(snapshot, revision: max(0, snapshot.revision - 1))
        let olderProbe = RefreshProbe(snapshot: snapshot, mutationResultSnapshot: older)
        let olderModel = await DeckViewModel(client: olderProbe)
        await olderModel.refresh()
        try await waitUntilIdle(olderModel)
        await olderModel.apply(.setCollapsed(level: .focus, collapsed: true))
        try await waitUntilIdle(olderModel)
        let olderRevision = await olderModel.snapshot?.revision
        let olderCanUndo = await olderModel.canUndo
        try require(olderRevision == snapshot.revision, "older mutation result replaced the authoritative snapshot")
        try require(!olderCanUndo, "older mutation result registered undo")

        let mismatchProbe = RefreshProbe(
            snapshot: snapshot,
            mutationResultSnapshot: snapshot,
            mutationRevisionOverride: snapshot.revision + 1
        )
        let mismatchModel = await DeckViewModel(client: mismatchProbe)
        await mismatchModel.refresh()
        try await waitUntilIdle(mismatchModel)
        await mismatchModel.apply(.setCollapsed(level: .focus, collapsed: true))
        try await waitUntilIdle(mismatchModel)
        let mismatchRevision = await mismatchModel.snapshot?.revision
        let mismatchCanUndo = await mismatchModel.canUndo
        try require(mismatchRevision == snapshot.revision, "mismatched mutation result was adopted")
        try require(!mismatchCanUndo, "mismatched mutation result registered undo")
    }

    private static func verifyClientProcessBounds(with snapshot: DeckSnapshot) async throws {
        let script = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-client-probe-\(UUID().uuidString).sh")
        defer { try? FileManager.default.removeItem(at: script) }
        let scriptContents = #"""
        #!/bin/sh
        case "${GAJENDRA_TEST_MODE:-ok}" in
          stderr)
            i=0
            while [ "$i" -lt 2000 ]; do printf 'stderr-line' >&2; i=$((i + 1)); done
            printf '%s' "$GAJENDRA_TEST_JSON"
            ;;
          stdout)
            printf '%s' "$GAJENDRA_TEST_OVERSIZE"
            ;;
          timeout)
            while :; do :; done
            ;;
          term-resistant)
            trap '' TERM
            printf '%s' "$$" > "$GAJENDRA_TEST_PID_FILE"
            while :; do printf 'term-resistant-stderr' >&2; done
            ;;
          inherited-pipes)
            trap '' TERM PIPE
            /bin/sh -c 'trap "" TERM PIPE; while :; do :; done' &
            child_pid=$!
            group_id=$(/bin/ps -o pgid= -p "$$" | /usr/bin/tr -d '[:space:]')
            child_group_id=$(/bin/ps -o pgid= -p "$child_pid" | /usr/bin/tr -d '[:space:]')
            printf '%s\n%s\n%s\n%s\n' "$$" "$child_pid" "$group_id" "$child_group_id" > "$GAJENDRA_TEST_PID_FILE"
            while :; do printf 'parent-stderr' >&2 || :; done
            ;;
          normal-descendant|nonzero-descendant)
            trap '' TERM PIPE
            /bin/sh -c 'trap "" TERM PIPE; while :; do :; done' &
            child_pid=$!
            group_id=$(/bin/ps -o pgid= -p "$$" | /usr/bin/tr -d '[:space:]')
            child_group_id=$(/bin/ps -o pgid= -p "$child_pid" | /usr/bin/tr -d '[:space:]')
            printf '%s\n%s\n%s\n%s\n' "$$" "$child_pid" "$group_id" "$child_group_id" > "$GAJENDRA_TEST_PID_FILE"
            printf '%s' "$GAJENDRA_TEST_JSON"
            if [ "${GAJENDRA_TEST_MODE}" = "nonzero-descendant" ]; then exit 17; fi
            exit 0
            ;;
          *)
            printf '%s' "$GAJENDRA_TEST_JSON"
            ;;
        esac
        """#
        try scriptContents.write(to: script, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: script.path)

        func client(mode: String, limits: GajendraProcessLimits, pidFile: URL? = nil) -> DeckClient {
            var environment = [
                "GAJENDRA_NODE_BIN": script.path,
                "GAJENDRA_TEST_MODE": mode,
                "GAJENDRA_TEST_JSON": fixture,
                "GAJENDRA_TEST_OVERSIZE": String(repeating: "x", count: 512),
                "PATH": "",
            ]
            if let pidFile {
                environment["GAJENDRA_TEST_PID_FILE"] = pidFile.path
            }
            let resolver = GajendraNodeResolver(
                environment: environment,
                bundleURL: nil,
                isExecutable: { $0 == script.path }
            )
            return DeckClient(
                serverURL: URL(fileURLWithPath: "/tmp/gajendra-test-server.mjs"),
                environment: environment,
                nodeResolver: resolver,
                processLimits: limits
            )
        }

        func assertDescendantGroupWasCleaned(
            _ pidFile: URL,
            started: Date,
            label: String
        ) async throws {
            var processIDs: [Int32] = []
            for _ in 0..<40 {
                processIDs = (try? String(contentsOf: pidFile, encoding: .utf8))?
                    .split(whereSeparator: \.isNewline)
                    .compactMap { Int32($0) } ?? []
                if processIDs.count == 4 { break }
                try await Task.sleep(for: .milliseconds(10))
            }
            try require(
                processIDs.count == 4,
                "(label) did not record parent, child, and process-group IDs"
            )
            try require(
                processIDs[2] == processIDs[0] && processIDs[3] == processIDs[0],
                "(label) did not establish one dedicated process group for the leader and descendant"
            )
            #if canImport(Darwin)
            for processID in processIDs.prefix(2) {
                var dead = false
                for _ in 0..<40 {
                    if kill(processID, 0) == -1 && errno == ESRCH {
                        dead = true
                        break
                    }
                    try await Task.sleep(for: .milliseconds(10))
                }
                try require(dead, "(label) descendant cleanup left pid (processID) alive")
            }
            #endif
            try require(
                Date().timeIntervalSince(started) < 2,
                "(label) group cleanup exceeded its bounded return deadline"
            )
        }

        let normal = try await client(mode: "ok", limits: GajendraProcessLimits(timeout: 2, stdoutBytes: 8 * 1024, stderrBytes: 8 * 1024)).snapshot()
        try require(normal.revision == snapshot.revision, "bounded process fixture did not decode a normal response")

        do {
            _ = try await client(mode: "stderr", limits: GajendraProcessLimits(timeout: 2, stdoutBytes: 8 * 1024, stderrBytes: 128)).snapshot()
            throw SelfTestError.failed("filled stderr was not bounded")
        } catch let error as DeckClient.ClientError {
            try require(error == .outputTooLarge, "filled stderr returned the wrong bounded-process error")
        }
        do {
            _ = try await client(mode: "stdout", limits: GajendraProcessLimits(timeout: 2, stdoutBytes: 128, stderrBytes: 8 * 1024)).snapshot()
            throw SelfTestError.failed("oversize stdout was not bounded")
        } catch let error as DeckClient.ClientError {
            try require(error == .outputTooLarge, "oversize stdout returned the wrong bounded-process error")
        }
        let started = Date()
        do {
            _ = try await client(mode: "timeout", limits: GajendraProcessLimits(timeout: 0.08, stdoutBytes: 8 * 1024, stderrBytes: 8 * 1024, terminationGrace: 0.05)).snapshot()
            throw SelfTestError.failed("process deadline did not terminate a hung client")
        } catch let error as DeckClient.ClientError {
            try require(error == .timedOut, "hung client returned the wrong deadline error")
        }
        try require(Date().timeIntervalSince(started) < 2, "hung client exceeded bounded cleanup deadline")

        let pidFile = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-term-resistant-\(UUID().uuidString).pid")
        defer { try? FileManager.default.removeItem(at: pidFile) }
        do {
            _ = try await client(
                mode: "term-resistant",
                limits: GajendraProcessLimits(timeout: 2, stdoutBytes: 8 * 1024, stderrBytes: 128, terminationGrace: 0.05),
                pidFile: pidFile
            ).snapshot()
            throw SelfTestError.failed("TERM-resistant client was not rejected by the output cap")
        } catch let error as DeckClient.ClientError {
            try require(error == .outputTooLarge, "TERM-resistant client returned the wrong bounded-process error")
        }
        var recordedPID: Int32?
        for _ in 0..<20 {
            if let value = try? String(contentsOf: pidFile, encoding: .utf8), let pid = Int32(value) {
                recordedPID = pid
                break
            }
            try await Task.sleep(for: .milliseconds(10))
        }
        guard let recordedPID else { throw SelfTestError.failed("TERM-resistant client did not record its PID") }
        #if canImport(Darwin)
        try require(kill(recordedPID, 0) == -1 && errno == ESRCH, "TERM-resistant client survived bounded KILL cleanup")
        #endif

        let inheritedPIDFile = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-inherited-pipes-\(UUID().uuidString).pid")
        defer { try? FileManager.default.removeItem(at: inheritedPIDFile) }
        let inheritedStarted = Date()
        do {
            _ = try await client(
                mode: "inherited-pipes",
                limits: GajendraProcessLimits(timeout: 2, stdoutBytes: 8 * 1024, stderrBytes: 128, terminationGrace: 0.05),
                pidFile: inheritedPIDFile
            ).snapshot()
            throw SelfTestError.failed("inherited-pipe descendant was not rejected by the output cap")
        } catch let error as DeckClient.ClientError {
            try require(error == .outputTooLarge, "inherited-pipe descendant returned the wrong bounded-process error")
        }
        let inheritedPIDs = (try? String(contentsOf: inheritedPIDFile, encoding: .utf8))?
            .split(whereSeparator: \.isNewline)
            .compactMap { Int32($0) } ?? []
        try require(inheritedPIDs.count == 4, "inherited-pipe fixture did not record parent, child, and process-group IDs")
        try require(
            inheritedPIDs[2] == inheritedPIDs[0],
            "POSIX_SPAWN_SETPGROUP did not establish the child as its own process-group leader"
        )
        try require(
            inheritedPIDs[3] == inheritedPIDs[0],
            "inherited-pipe descendant did not inherit the dedicated process group"
        )
        #if canImport(Darwin)
        for pid in inheritedPIDs.prefix(2) {
            var dead = false
            for _ in 0..<40 {
                if kill(pid, 0) == -1 && errno == ESRCH {
                    dead = true
                    break
                }
                try await Task.sleep(for: .milliseconds(10))
            }
            try require(dead, "inherited-pipe process (pid) survived pre-exec process-group KILL cleanup")
        }
        #endif
        try require(
            Date().timeIntervalSince(inheritedStarted) < 2,
            "inherited-pipe rejection exceeded its bounded cleanup deadline"
        )

        let normalDescendantPIDFile = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-normal-descendant-\(UUID().uuidString).pid")
        defer { try? FileManager.default.removeItem(at: normalDescendantPIDFile) }
        let normalDescendantStarted = Date()
        let normalWithDescendant = try await client(
            mode: "normal-descendant",
            limits: GajendraProcessLimits(timeout: 2, stdoutBytes: 8 * 1024, stderrBytes: 8 * 1024, terminationGrace: 0.05),
            pidFile: normalDescendantPIDFile
        ).snapshot()
        try require(
            normalWithDescendant.revision == snapshot.revision,
            "normal leader exit with a descendant did not preserve the valid snapshot"
        )
        try await assertDescendantGroupWasCleaned(
            normalDescendantPIDFile,
            started: normalDescendantStarted,
            label: "normal-success descendant"
        )

        let nonzeroDescendantPIDFile = FileManager.default.temporaryDirectory.appendingPathComponent("gajendra-nonzero-descendant-\(UUID().uuidString).pid")
        defer { try? FileManager.default.removeItem(at: nonzeroDescendantPIDFile) }
        let nonzeroDescendantStarted = Date()
        do {
            _ = try await client(
                mode: "nonzero-descendant",
                limits: GajendraProcessLimits(timeout: 2, stdoutBytes: 8 * 1024, stderrBytes: 8 * 1024, terminationGrace: 0.05),
                pidFile: nonzeroDescendantPIDFile
            ).snapshot()
            throw SelfTestError.failed("nonzero leader exit with a descendant was accepted")
        } catch let error as DeckClient.ClientError {
            try require(
                error == .commandFailed,
                "nonzero leader exit with a descendant returned the wrong error"
            )
        }
        try await assertDescendantGroupWasCleaned(
            nonzeroDescendantPIDFile,
            started: nonzeroDescendantStarted,
            label: "nonzero-exit descendant"
        )

        let timeoutModel = await DeckViewModel(
            client: client(mode: "timeout", limits: GajendraProcessLimits(timeout: 0.08, stdoutBytes: 8 * 1024, stderrBytes: 8 * 1024, terminationGrace: 0.05)),
            initialSnapshot: snapshot
        )
        await timeoutModel.apply(.setCollapsed(level: .focus, collapsed: true))
        try await waitUntilIdle(timeoutModel)
        let timeoutStillLoading = await timeoutModel.isLoading
        let timeoutStillMutating = await timeoutModel.isMutating
        try require(!timeoutStillLoading && !timeoutStillMutating, "client timeout left the native UI permanently busy")
    }

    private static func verifyQueueHandlers(with snapshot: DeckSnapshot) async throws {
        let thread: (String, PriorityLevel?) -> DeckThread = { id, level in
            DeckThread(
                id: id,
                sourceId: "codex",
                sourceName: "Codex",
                title: id,
                project: "Handler fixture",
                updatedAt: 1,
                status: "idle",
                level: level,
                isCurrent: false,
                deepLink: "codex://threads/\(id)"
            )
        }
        let now = thread("handler-now", .focus)
        let middle = thread("handler-middle", .focus)
        let last = thread("handler-last", .focus)
        let important = thread("handler-important", .important)
        let available = thread("handler-available", nil)
        let handlerSnapshot = DeckSnapshot(
            revision: snapshot.revision,
            generatedAt: snapshot.generatedAt,
            current: now,
            focus: [now, middle, last],
            important: [important],
            available: [available],
            collapsed: snapshot.collapsed,
            focusGuide: snapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: snapshot.source,
            sources: snapshot.sources,
            error: nil
        )
        let probe = RefreshProbe(snapshot: handlerSnapshot)
        let model = await DeckViewModel(client: probe, initialSnapshot: handlerSnapshot)

        await model.moveToLevel(threadId: now.id, level: .important)
        try await waitUntilIdle(model)
        var requests = await probe.requests()
        try require(
            requests.first?.mutation == .moveBefore(
                threadId: now.id,
                level: .important,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: middle.id
            ),
            "handler current-to-important did not select the next remaining Focus row as NOW"
        )

        await model.moveToLevel(threadId: available.id, level: .important)
        try await waitUntilIdle(model)
        requests = await probe.requests()
        try require(
            requests.dropFirst().first?.mutation == .moveBefore(
                threadId: available.id,
                level: .important,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: now.id
            ),
            "handler Available add did not use an atomic append move"
        )

        await model.undo()
        try await waitUntilIdle(model)
        requests = await probe.requests()
        try require(
            requests.dropFirst(2).first?.mutation == .moveBefore(
                threadId: available.id,
                level: nil,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: now.id
            ),
            "handler Available add undo did not restore the unprioritized lane atomically"
        )

        await model.moveToLevel(threadId: middle.id, level: .focus)
        try await waitUntilIdle(model)
        requests = await probe.requests()
        try require(
            requests.dropFirst(3).first?.mutation == .moveBefore(
                threadId: middle.id,
                level: .focus,
                beforeThreadId: nil,
                context: nil,
                currentThreadId: now.id
            ),
            "handler middle-to-end reorder was incorrectly treated as an append no-op"
        )
    }

    private static func waitUntilIdle(_ model: DeckViewModel) async throws {
        for _ in 0..<160 {
            if !(await model.isLoading) { return }
            try await Task.sleep(for: .milliseconds(10))
        }
        throw SelfTestError.failed("native operation did not settle")
    }

    private static func snapshotWithRevision(_ snapshot: DeckSnapshot, revision: Int) -> DeckSnapshot {
        DeckSnapshot(
            revision: revision,
            generatedAt: snapshot.generatedAt,
            current: snapshot.current,
            focus: snapshot.focus,
            important: snapshot.important,
            available: snapshot.available,
            collapsed: snapshot.collapsed,
            focusGuide: snapshot.focusGuide,
            focusOverGuide: snapshot.focusOverGuide,
            staleEntryCount: snapshot.staleEntryCount,
            source: snapshot.source,
            sources: snapshot.sources,
            error: snapshot.error
        )
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
        private let mutationResultSnapshot: DeckSnapshot?
        private let mutationOutcome: DeckMutationOutcome
        private let mutationError: DeckMutationError?
        private let mutationRevisionOverride: Int?
        private let mutationDelayMilliseconds: Int
        private var requestCountValue = 0
        private var receivedRequests: [DeckMutationRequest] = []

        init(
            snapshot: DeckSnapshot,
            outcome: DeckMutationOutcome = .applied,
            error: DeckMutationError? = nil,
            mutationResultSnapshot: DeckSnapshot? = nil,
            mutationRevisionOverride: Int? = nil,
            mutationDelayMilliseconds: Int = 0
        ) {
            result = snapshot
            self.mutationResultSnapshot = mutationResultSnapshot
            mutationOutcome = outcome
            mutationError = error
            self.mutationRevisionOverride = mutationRevisionOverride
            self.mutationDelayMilliseconds = mutationDelayMilliseconds
        }

        func snapshot() async throws -> DeckSnapshot {
            requestCountValue += 1
            try await Task.sleep(for: .milliseconds(35))
            return result
        }

        func mutate(_ request: DeckMutationRequest) async throws -> DeckMutationResult {
            receivedRequests.append(request)
            if mutationDelayMilliseconds > 0 {
                try await Task.sleep(for: .milliseconds(mutationDelayMilliseconds))
            }
            let responseSnapshot = mutationResultSnapshot ?? result
            return DeckMutationResult(
                outcome: mutationOutcome,
                revision: mutationRevisionOverride ?? responseSnapshot.revision,
                snapshot: responseSnapshot,
                error: mutationError
            )
        }

        func requestCount() -> Int {
            requestCountValue
        }

        func requests() -> [DeckMutationRequest] {
            receivedRequests
        }
    }

    private actor AdvancingQueueService: DeckServing {
        private var currentSnapshot: DeckSnapshot
        private var receivedRequests: [DeckMutationRequest] = []

        init(initial: DeckSnapshot) {
            currentSnapshot = initial
        }

        func snapshot() async throws -> DeckSnapshot {
            currentSnapshot
        }

        func mutate(_ request: DeckMutationRequest) async throws -> DeckMutationResult {
            receivedRequests.append(request)
            guard request.expectedRevision == currentSnapshot.revision else {
                return DeckMutationResult(
                    outcome: .conflict,
                    revision: currentSnapshot.revision,
                    snapshot: currentSnapshot,
                    error: DeckMutationError(code: "stale-revision")
                )
            }
            let next = apply(request.mutation, to: currentSnapshot)
            currentSnapshot = DeckSnapshot(
                revision: currentSnapshot.revision + 1,
                generatedAt: currentSnapshot.generatedAt,
                current: next.current,
                focus: next.focus,
                important: next.important,
                available: next.available,
                collapsed: next.collapsed,
                focusGuide: next.focusGuide,
                focusOverGuide: next.focusOverGuide,
                staleEntryCount: next.staleEntryCount,
                source: next.source,
                sources: next.sources,
                error: next.error
            )
            return DeckMutationResult(
                outcome: .applied,
                revision: currentSnapshot.revision,
                snapshot: currentSnapshot
            )
        }

        func requests() -> [DeckMutationRequest] {
            receivedRequests
        }

        private func apply(_ mutation: DeckMutation, to snapshot: DeckSnapshot) -> DeckSnapshot {
            switch mutation {
            case let .moveBefore(threadId, level, beforeThreadId, context, currentThreadId):
                var focus = snapshot.focus.filter { $0.id != threadId }
                var important = snapshot.important.filter { $0.id != threadId }
                var available = snapshot.available.filter { $0.id != threadId }
                guard let original = snapshot.allThreads.first(where: { $0.id == threadId }) else { return snapshot }
                let moved = DeckThread(
                    id: original.id,
                    sourceId: original.sourceId,
                    sourceName: original.sourceName,
                    title: original.title,
                    project: original.project,
                    updatedAt: original.updatedAt,
                    status: original.status,
                    level: level,
                    isCurrent: false,
                    context: context,
                    deepLink: original.deepLink,
                    allowedDeepLinkSchemes: original.allowedDeepLinkSchemes,
                    resumeCommand: original.resumeCommand
                )
                switch level {
                case .focus:
                    insert(moved, before: beforeThreadId, in: &focus)
                case .important:
                    insert(moved, before: beforeThreadId, in: &important)
                case nil:
                    insert(moved, before: nil, in: &available)
                }
                let all = [moved] + focus + important + available
                let current = currentThreadId.flatMap { id in all.first(where: { $0.id == id }) }
                return DeckSnapshot(
                    revision: snapshot.revision,
                    generatedAt: snapshot.generatedAt,
                    current: current,
                    focus: focus,
                    important: important,
                    available: available,
                    collapsed: snapshot.collapsed,
                    focusGuide: snapshot.focusGuide,
                    focusOverGuide: snapshot.focusOverGuide,
                    staleEntryCount: snapshot.staleEntryCount,
                    source: snapshot.source,
                    sources: snapshot.sources,
                    error: snapshot.error
                )
            case let .setContext(threadId, context):
                func update(_ thread: DeckThread) -> DeckThread {
                    DeckThread(
                        id: thread.id,
                        sourceId: thread.sourceId,
                        sourceName: thread.sourceName,
                        title: thread.title,
                        project: thread.project,
                        updatedAt: thread.updatedAt,
                        status: thread.status,
                        level: thread.level,
                        isCurrent: thread.isCurrent,
                        context: thread.id == threadId ? context : thread.context,
                        deepLink: thread.deepLink,
                        allowedDeepLinkSchemes: thread.allowedDeepLinkSchemes,
                        resumeCommand: thread.resumeCommand
                    )
                }
                return DeckSnapshot(
                    revision: snapshot.revision,
                    generatedAt: snapshot.generatedAt,
                    current: snapshot.current.map(update),
                    focus: snapshot.focus.map(update),
                    important: snapshot.important.map(update),
                    available: snapshot.available.map(update),
                    collapsed: snapshot.collapsed,
                    focusGuide: snapshot.focusGuide,
                    focusOverGuide: snapshot.focusOverGuide,
                    staleEntryCount: snapshot.staleEntryCount,
                    source: snapshot.source,
                    sources: snapshot.sources,
                    error: snapshot.error
                )
            default:
                return snapshot
            }
        }

        private func insert(_ thread: DeckThread, before targetId: String?, in lane: inout [DeckThread]) {
            let index = targetId.flatMap { target in lane.firstIndex(where: { $0.id == target }) } ?? lane.endIndex
            lane.insert(thread, at: index)
        }
    }

    private actor ExternalRefreshProbe: DeckServing {
        private var currentSnapshot: DeckSnapshot
        private let committedSnapshot: DeckSnapshot
        private var receivedRequests: [DeckMutationRequest] = []

        init(initial: DeckSnapshot, committed: DeckSnapshot) {
            currentSnapshot = initial
            committedSnapshot = committed
        }

        func snapshot() async throws -> DeckSnapshot {
            currentSnapshot
        }

        func mutate(_ request: DeckMutationRequest) async throws -> DeckMutationResult {
            receivedRequests.append(request)
            if receivedRequests.count == 1 {
                currentSnapshot = committedSnapshot
            }
            return DeckMutationResult(
                outcome: .applied,
                revision: currentSnapshot.revision,
                snapshot: currentSnapshot
            )
        }

        func setSnapshot(_ snapshot: DeckSnapshot) {
            currentSnapshot = snapshot
        }

        func requestCount() -> Int {
            receivedRequests.count
        }
    }

    @MainActor
    private final class HostedLayoutCapture: ObservableObject {
        @Published var evidence = GajendraHostedLayoutEvidence()
    }

    private struct HostedEvidenceContainer<Content: View>: View {
        let content: Content
        @ObservedObject var capture: HostedLayoutCapture

        var body: some View {
            content
                .coordinateSpace(name: GajendraHostedLayoutEvidenceKey.coordinateSpaceName)
                .onPreferenceChange(GajendraHostedLayoutEvidenceKey.self) { value in
                    capture.evidence = value
                }
        }
    }

    private struct HostedAccessibilitySnapshot {
        var labels: [String] = []
        var values: [String] = []
        var navigationOrder: [String] = []
        var actions: [String] = []
        var unavailableLabels: [String] = []
    }

    private static func allowHostedPreferencesToSettle() throws {
        RunLoop.main.run(until: Date().addingTimeInterval(0.04))
    }

    private static func requireHostedGeometry(
        _ evidence: GajendraHostedLayoutEvidence,
        in bounds: CGRect,
        label: String
    ) throws {
        guard let metadataFrame = evidence.metadataFrame,
              let primaryActionFrame = evidence.primaryActionFrame else {
            throw SelfTestError.failed("\(label) did not publish metadata and primary-action frames")
        }
        try require(metadataFrame.width > 0 && metadataFrame.height > 0, "\(label) metadata frame is empty")
        try require(primaryActionFrame.width > 0 && primaryActionFrame.height > 0, "\(label) primary action frame is empty")
        try require(bounds.contains(metadataFrame), "\(label) metadata frame was clipped")
        try require(bounds.contains(primaryActionFrame), "\(label) primary action frame was clipped")
        try require(!metadataFrame.intersects(primaryActionFrame), "\(label) metadata overlapped the primary action")
    }

    private static func hostedAccessibilitySnapshot(for host: NSView) -> HostedAccessibilitySnapshot {
        var result = HostedAccessibilitySnapshot()
        var visited = Set<ObjectIdentifier>()
        collectAccessibility(from: host, into: &result, visited: &visited)
        return result
    }

    private static func collectAccessibility(
        from value: Any,
        into result: inout HostedAccessibilitySnapshot,
        visited: inout Set<ObjectIdentifier>
    ) {
        guard let object = value as? NSObject else { return }
        let identifier = ObjectIdentifier(object)
        guard visited.insert(identifier).inserted else { return }

        let labels: [String]
        let valueDescription: String?
        let isEnabled: Bool?
        let actions: [String]
        let navigationChildren: [Any]
        let children: [Any]
        if let view = object as? NSView {
            labels = [view.accessibilityLabel(), view.accessibilityTitle()]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            valueDescription = (view.accessibilityValue() as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            isEnabled = view.isAccessibilityEnabled()
            actions = hostedAccessibilityActions(
                customActions: view.accessibilityCustomActions()?.map(\.name),
                role: view.accessibilityRole()?.rawValue
            )
            navigationChildren = view.accessibilityChildrenInNavigationOrder() ?? []
            children = view.accessibilityChildren() ?? []
        } else if let element = object as? NSAccessibilityElement {
            labels = [element.accessibilityLabel(), element.accessibilityTitle()]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            valueDescription = (element.accessibilityValue() as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            isEnabled = element.isAccessibilityEnabled()
            actions = hostedAccessibilityActions(
                customActions: element.accessibilityCustomActions()?.map(\.name),
                role: element.accessibilityRole()?.rawValue
            )
            navigationChildren = element.accessibilityChildrenInNavigationOrder() ?? []
            children = element.accessibilityChildren() ?? []
        } else {
            return
        }
        result.labels.append(contentsOf: labels)
        if let valueDescription, !valueDescription.isEmpty {
            result.values.append(valueDescription)
        }
        if isEnabled == false {
            result.unavailableLabels.append(contentsOf: labels)
        }
        result.actions.append(contentsOf: actions)

        for child in navigationChildren {
            if let childObject = child as? NSView {
                let childLabel = [childObject.accessibilityLabel(), childObject.accessibilityTitle()]
                    .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .first(where: { !$0.isEmpty })
                if let childLabel { result.navigationOrder.append(childLabel) }
            } else if let childObject = child as? NSAccessibilityElement {
                let childLabel = [childObject.accessibilityLabel(), childObject.accessibilityTitle()]
                    .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .first(where: { !$0.isEmpty })
                if let childLabel { result.navigationOrder.append(childLabel) }
            }
        }
        for child in children {
            collectAccessibility(from: child, into: &result, visited: &visited)
        }
    }

    private static func hostedAccessibilityActions(customActions: [String]?, role: String?) -> [String] {
        var actions = customActions ?? []
        if role == NSAccessibility.Role.button.rawValue {
            actions.append("press")
        }
        return actions
    }

    private final class LoginServiceProbe: GajendraLaunchAtLoginServicing {
        private var currentStatus: GajendraLaunchAtLoginStatus = .notRegistered

        func readStatus() -> GajendraLaunchAtLoginStatus {
            currentStatus
        }

        func register() throws {
            currentStatus = .requiresApproval
        }

        func unregister() throws {
            currentStatus = .notRegistered
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
      "revision": 42,
      "generatedAt": "2026-08-12T00:00:00Z",
      "current": {
        "id": "codex:focus-1", "sourceId": "codex", "sourceName": "Codex", "title": "Current", "project": "Fixture", "updatedAt": 1,
        "status": "idle", "level": "focus", "isCurrent": true,
        "context": "design",
        "deepLink": "codex://threads/focus-1", "allowedDeepLinkSchemes": ["codex"], "resumeCommand": null
      },
      "focus": [{
        "id": "codex:focus-1", "sourceId": "codex", "sourceName": "Codex", "title": "Current", "project": "Fixture", "updatedAt": 1,
        "status": "idle", "level": "focus", "isCurrent": true,
        "context": "design",
        "deepLink": "codex://threads/focus-1", "allowedDeepLinkSchemes": ["codex"], "resumeCommand": null
      }],
      "important": [],
      "available": [{
        "id": "claude:claude-1", "sourceId": "claude", "sourceName": "Claude Code", "title": "Claude task", "project": "Fixture", "updatedAt": 1,
        "status": "resumable", "level": null, "isCurrent": false,
        "context": null,
        "deepLink": "gajendra://thread/claude%3Aclaude-1", "allowedDeepLinkSchemes": ["gajendra"],
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
