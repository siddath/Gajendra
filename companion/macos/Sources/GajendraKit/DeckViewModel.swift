import AppKit
import Foundation

@MainActor
public final class DeckViewModel: ObservableObject {
    @Published public private(set) var snapshot: DeckSnapshot?
    @Published public private(set) var isLoading = false
    @Published public private(set) var isMutating = false
    @Published public private(set) var errorChannels = GajendraErrorChannels()
    @Published public private(set) var undoRegistrationCount = 0
    @Published private var historyVersion = 0

    public var errorMessage: String? { errorChannels.visible }
    public var openErrorMessage: String? { errorChannels.open }
    public var mutationErrorMessage: String? { errorChannels.mutation }
    public var clientErrorMessage: String? { errorChannels.client }
    public var canUndo: Bool { !undoStack.isEmpty }
    public var canRedo: Bool { !redoStack.isEmpty }

    private struct HistoryEntry {
        let forward: DeckMutation
        let inverse: DeckMutation
        let actionName: String
    }

    private enum HistoryOperation {
        case user
        case undo(HistoryEntry)
        case redo(HistoryEntry)
    }

    private enum QueuedMutationKind: Equatable {
        case raw(DeckMutation)
        case intent(GajendraQueueIntent)
    }

    private struct QueuedMutation {
        let kind: QueuedMutationKind
        let providedInverse: DeckMutation?
        let actionName: String
        let idempotencyKey: String
        let historyOperation: HistoryOperation
    }

    private let client: (any DeckServing)?
    private let resumeBaseDirectory: URL
    private var refreshRequestedWhileBusy = false
    private var pendingMutations: [QueuedMutation] = []
    private var activeMutation: QueuedMutation?
    private var pendingThreadId: String?
    private var undoStack: [HistoryEntry] = []
    private var redoStack: [HistoryEntry] = []
    /// Every history entry is valid against the same committed snapshot revision. Entries are
    /// restamped after each successful operation instead of retaining per-entry old revisions.
    private var historyWatermark: Int?

    public typealias ResumeScriptOpener = (URL) throws -> Bool
    public typealias DeepLinkOpener = (URL) -> Bool
    private let resumeScriptOpener: ResumeScriptOpener
    private let deepLinkOpener: DeepLinkOpener

    public init(
        client: (any DeckServing)? = DeckClient(),
        initialSnapshot: DeckSnapshot? = nil,
        resumeBaseDirectory: URL = FileManager.default.temporaryDirectory,
        previewBusy: Bool = false,
        resumeScriptOpener: @escaping ResumeScriptOpener = { NSWorkspace.shared.open($0) },
        deepLinkOpener: @escaping DeepLinkOpener = { NSWorkspace.shared.open($0) }
    ) {
        self.client = client
        self.snapshot = initialSnapshot
        self.resumeBaseDirectory = resumeBaseDirectory
        self.resumeScriptOpener = resumeScriptOpener
        self.deepLinkOpener = deepLinkOpener
        self._isLoading = Published(initialValue: previewBusy)
        self._isMutating = Published(initialValue: previewBusy)
        GajendraResumeScriptStore.cleanup(baseDirectory: resumeBaseDirectory)
    }

    deinit {
        GajendraResumeScriptStore.cleanup(baseDirectory: resumeBaseDirectory)
    }

    public func cleanupResumeScripts() {
        GajendraResumeScriptStore.cleanup(baseDirectory: resumeBaseDirectory)
    }

    public func refresh() {
        guard let client else { return }
        guard !isLoading else {
            refreshRequestedWhileBusy = true
            return
        }
        isLoading = true
        Task { [weak self] in
            guard let self else { return }
            do {
                let next = try await client.snapshot()
                try validateSnapshot(next, against: snapshot)
                if let previous = snapshot, next.revision != previous.revision {
                    let hadHistory = canUndo || canRedo
                    invalidateHistory()
                    if hadHistory {
                        errorChannels.mutationFailed("That change is no longer undoable because Gajendra changed elsewhere.")
                    }
                }
                snapshot = next
                errorChannels.clientSucceeded()
                openPendingThreadIfAvailable()
            } catch {
                errorChannels.clientFailed(genericClientError(error))
            }
            isLoading = false
            runNextQueuedOperationIfNeeded()
        }
    }

    /// Enqueues a mutation. The inverse is deliberately not inferred here: a queued action may
    /// dispatch after an earlier action commits, so the inverse is captured from the actual base
    /// snapshot at dispatch time.
    public func apply(
        _ mutation: DeckMutation,
        inverse: DeckMutation? = nil,
        actionName: String = "Change priority"
    ) {
        enqueue(
            kind: .raw(mutation),
            inverse: inverse,
            actionName: actionName
        )
    }

    /// The widget's custom VoiceOver mutation actions use this gate as well as the view's
    /// disabled state. A busy row must not turn an accessibility gesture into a second request.
    @discardableResult
    public func performAccessibilityMutation(
        _ mutation: DeckMutation,
        actionName: String = "Change priority"
    ) -> Bool {
        guard client != nil, !isMutating else { return false }
        apply(mutation, actionName: actionName)
        return true
    }

    /// Typed counterpart for the row's lane-changing VoiceOver action. The intent remains
    /// dispatch-time materialized just like the pointer/keyboard route.
    @discardableResult
    public func performAccessibilityMove(
        threadId: String,
        level: PriorityLevel?,
        actionName: String = "Move priority"
    ) -> Bool {
        guard client != nil, !isMutating else { return false }
        moveToLevel(threadId: threadId, level: level, actionName: actionName)
        return true
    }

    private func enqueue(
        kind: QueuedMutationKind,
        inverse: DeckMutation? = nil,
        actionName: String
    ) {
        guard client != nil else { return }
        let action = QueuedMutation(
            kind: kind,
            providedInverse: inverse,
            actionName: actionName,
            idempotencyKey: UUID().uuidString.lowercased(),
            historyOperation: .user
        )
        guard activeMutation?.kind != kind,
              !pendingMutations.contains(where: { $0.kind == kind }) else { return }
        if isLoading {
            pendingMutations.append(action)
            return
        }
        dispatch(action)
    }

    /// All visible Make NOW actions use one atomic move-before/currentThreadId mutation. This
    /// keeps only the intent until dispatch, where the latest lane/order/context/NOW is captured.
    public func makeNow(threadId: String, actionName: String = "Make NOW") {
        enqueue(
            kind: .intent(.makeNow(threadId: threadId)),
            actionName: actionName
        )
    }

    public func moveToLevel(
        threadId: String,
        level: PriorityLevel?,
        beforeThreadId: String? = nil,
        actionName: String = "Move priority"
    ) {
        enqueue(
            kind: .intent(.move(threadId: threadId, level: level, beforeThreadId: beforeThreadId)),
            actionName: actionName
        )
    }

    public func setReviewAcknowledged(_ thread: DeckThread, acknowledged: Bool) {
        guard thread.isReadyForReview,
              let review = thread.review,
              let reviewIdentity = review.identity else { return }
        apply(
            .setReviewAcknowledged(
                threadId: thread.id,
                reviewUpdatedAt: review.updatedAt,
                reviewIdentity: reviewIdentity,
                acknowledged: acknowledged
            ),
            actionName: acknowledged ? "Mark reviewed" : "Restore review"
        )
    }

    public func undo() {
        guard !isLoading, let entry = undoStack.last else { return }
        guard snapshot?.revision == historyWatermark else {
            invalidateHistory()
            errorChannels.mutationFailed("That change is no longer undoable because Gajendra changed elsewhere.")
            return
        }
        undoStack.removeLast()
        markHistoryChanged()
        dispatch(QueuedMutation(
            kind: .raw(entry.inverse),
            providedInverse: entry.forward,
            actionName: "Undo \(entry.actionName)",
            idempotencyKey: UUID().uuidString.lowercased(),
            historyOperation: .undo(entry)
        ))
    }

    public func redo() {
        guard !isLoading, let entry = redoStack.last else { return }
        guard snapshot?.revision == historyWatermark else {
            invalidateHistory()
            errorChannels.mutationFailed("That change is no longer redoable because Gajendra changed elsewhere.")
            return
        }
        redoStack.removeLast()
        markHistoryChanged()
        dispatch(QueuedMutation(
            kind: .raw(entry.forward),
            providedInverse: entry.inverse,
            actionName: "Redo \(entry.actionName)",
            idempotencyKey: UUID().uuidString.lowercased(),
            historyOperation: .redo(entry)
        ))
    }

    private func dispatch(_ action: QueuedMutation) {
        guard let client else { return }
        let baseRevision = snapshot?.revision
        guard let materialized = materialize(action) else {
            errorChannels.mutationFailed("That Gajendra change is no longer available.")
            restoreHistoryAfterFailureIfNeeded(action, invalidate: false)
            runNextQueuedOperationIfNeeded()
            return
        }
        let dispatchedAction = QueuedMutation(
            kind: .raw(materialized.forward),
            providedInverse: materialized.inverse,
            actionName: action.actionName,
            idempotencyKey: action.idempotencyKey,
            historyOperation: action.historyOperation
        )
        activeMutation = dispatchedAction
        isLoading = true
        isMutating = true
        let request = DeckMutationRequest(
            mutation: materialized.forward,
            expectedRevision: baseRevision,
            idempotencyKey: dispatchedAction.idempotencyKey
        )
        Task { [weak self] in
            guard let self else { return }
            do {
                let result = try await client.mutate(request)
                try validateMutationResult(result, against: baseRevision)
                snapshot = result.snapshot
                switch result.outcome {
                case .applied, .replayed:
                    errorChannels.mutationSucceeded()
                    completeHistorySuccess(for: dispatchedAction, committedRevision: result.revision)
                case .conflict, .rejected:
                    errorChannels.mutationFailed(result.genericUserMessage)
                    if result.outcome == .conflict { invalidateHistory() }
                    restoreHistoryAfterFailureIfNeeded(dispatchedAction, invalidate: result.outcome == .conflict)
                }
            } catch {
                errorChannels.mutationFailed(genericMutationError(error))
                restoreHistoryAfterFailureIfNeeded(dispatchedAction, invalidate: false)
            }
            activeMutation = nil
            isLoading = false
            isMutating = false
            runNextQueuedOperationIfNeeded()
        }
    }

    private func completeHistorySuccess(for action: QueuedMutation, committedRevision: Int) {
        switch action.historyOperation {
        case .user:
            if let inverse = action.providedInverse,
               case let .raw(forward) = action.kind {
                undoStack.append(HistoryEntry(
                    forward: forward,
                    inverse: inverse,
                    actionName: action.actionName
                ))
            }
            redoStack.removeAll()
        case let .undo(entry):
            redoStack.append(HistoryEntry(
                forward: entry.forward,
                inverse: entry.inverse,
                actionName: entry.actionName
            ))
        case let .redo(entry):
            undoStack.append(HistoryEntry(
                forward: entry.forward,
                inverse: entry.inverse,
                actionName: entry.actionName
            ))
        }
        historyWatermark = committedRevision
        undoRegistrationCount &+= 1
        restampHistory(to: committedRevision)
        markHistoryChanged()
    }

    private func restoreHistoryAfterFailureIfNeeded(_ action: QueuedMutation, invalidate: Bool) {
        guard !invalidate else { return }
        switch action.historyOperation {
        case .user:
            break
        case let .undo(entry):
            undoStack.append(entry)
        case let .redo(entry):
            redoStack.append(entry)
        }
        markHistoryChanged()
    }

    private func invalidateHistory() {
        guard !undoStack.isEmpty || !redoStack.isEmpty || historyWatermark != nil else { return }
        undoStack.removeAll()
        redoStack.removeAll()
        historyWatermark = nil
        markHistoryChanged()
    }

    private func restampHistory(to revision: Int) {
        // The watermark is the single validity guard for both stacks. Entries themselves are
        // immutable mutations and therefore need no stale per-entry revision field.
        historyWatermark = revision
    }

    private func markHistoryChanged() {
        historyVersion &+= 1
    }

    private func inferredInverse(for mutation: DeckMutation) -> DeckMutation? {
        guard let snapshot else { return nil }
        switch mutation {
        case let .moveBefore(threadId, level, beforeThreadId, _, _):
            return GajendraQueueMovePlanner.plan(
                threadId: threadId,
                to: level,
                before: beforeThreadId,
                snapshot: snapshot
            )?.inverse
        case let .setLevel(threadId, level):
            return GajendraQueueMovePlanner.plan(
                threadId: threadId,
                to: level,
                before: nil,
                snapshot: snapshot
            )?.inverse
        case let .move(threadId, direction):
            return .move(threadId: threadId, direction: direction == .up ? .down : .up)
        case let .setContext(threadId, _):
            guard let thread = snapshot.allThreads.first(where: { $0.id == threadId }) else { return nil }
            return .setContext(threadId: threadId, context: thread.context)
        case let .setReviewAcknowledged(threadId, reviewUpdatedAt, reviewIdentity, acknowledged):
            return .setReviewAcknowledged(
                threadId: threadId,
                reviewUpdatedAt: reviewUpdatedAt,
                reviewIdentity: reviewIdentity,
                acknowledged: !acknowledged
            )
        case let .setCollapsed(level, _):
            let collapsed = level == .focus ? snapshot.collapsed.focus : snapshot.collapsed.important
            return .setCollapsed(level: level, collapsed: collapsed)
        case let .setSourceEnabled(sourceId, _):
            guard let source = snapshot.sources.first(where: { $0.id == sourceId }) else { return nil }
            return .setSourceEnabled(sourceId: sourceId, enabled: source.enabled)
        case let .setCurrent(threadId):
            return GajendraQueueMovePlanner.planMakeNow(threadId: threadId, snapshot: snapshot)?.inverse
        }
    }

    private func materialize(_ action: QueuedMutation) -> (forward: DeckMutation, inverse: DeckMutation?)? {
        switch action.historyOperation {
        case .user:
            switch action.kind {
            case let .raw(mutation):
                return (mutation, inferredInverse(for: mutation))
            case let .intent(intent):
                guard let snapshot,
                      let plan = GajendraQueueMovePlanner.plan(intent: intent, snapshot: snapshot) else {
                    return nil
                }
                return (plan.forward, plan.inverse)
            }
        case .undo, .redo:
            guard case let .raw(mutation) = action.kind else { return nil }
            // History counterparts were committed at the coherent watermark and must not be
            // re-inferred from a later snapshot.
            return (mutation, action.providedInverse)
        }
    }

    private func validateSnapshot(_ next: DeckSnapshot, against previous: DeckSnapshot?) throws {
        guard let previous = previous else { return }
        guard next.revision >= previous.revision else { throw DeckClient.ClientError.invalidResponse }
    }

    private func validateMutationResult(_ result: DeckMutationResult, against baseRevision: Int?) throws {
        guard result.protocolVersion == 1,
              result.revision == result.snapshot.revision,
              baseRevision.map({ result.revision >= $0 }) ?? true else {
            throw DeckClient.ClientError.invalidResponse
        }
    }

    public func open(_ thread: DeckThread) {
        if let command = thread.resumeCommand {
            openInTerminal(command)
            return
        }
        openDeepLink(
            thread.deepLink,
            allowedSchemes: thread.allowedDeepLinkSchemes,
            failureMessage: "Gajendra could not open this thread."
        )
    }

    public func openReview(_ thread: DeckThread) {
        guard thread.isReadyForReview,
              let destination = thread.review?.destination,
              let value = destination.value else {
            errorChannels.openFailed("Gajendra could not open this review.")
            return
        }

        // A provider-declared task fallback should use the owning task's ordinary route. This
        // preserves safe resume-command behavior while a distinct URL opens the review itself.
        if destination.type == .thread, value == thread.deepLink {
            open(thread)
            return
        }

        openDeepLink(
            value,
            allowedSchemes: thread.allowedDeepLinkSchemes,
            failureMessage: "Gajendra could not open this review."
        )
    }

    private func openDeepLink(_ value: String, allowedSchemes: [String], failureMessage: String) {
        // Revalidate immediately before handing a URL to Launch Services. The model may have
        // been decoded earlier, and allowlists must not be bypassed by stale UI state.
        guard GajendraDeepLinkPolicy.isPermitted(value, allowedSchemes: allowedSchemes),
              let url = URL(string: value),
              deepLinkOpener(url) else {
            errorChannels.openFailed(failureMessage)
            return
        }
        errorChannels.openSucceeded()
    }

    public func openCanonicalThread(_ id: String) {
        if let thread = allThreads.first(where: { $0.id == id }) {
            open(thread)
        } else {
            pendingThreadId = id
            refresh()
        }
    }

    private var allThreads: [DeckThread] {
        guard let snapshot else { return [] }
        var unique: [String: DeckThread] = [:]
        ([snapshot.current].compactMap { $0 } + snapshot.focus + snapshot.important + snapshot.available)
            .forEach { unique[$0.id] = $0 }
        return Array(unique.values)
    }

    private func openPendingThreadIfAvailable() {
        guard let id = pendingThreadId else { return }
        pendingThreadId = nil
        guard let thread = allThreads.first(where: { $0.id == id }) else {
            errorChannels.openFailed("That thread is no longer available.")
            return
        }
        open(thread)
    }

    private func openInTerminal(_ command: ResumeCommand) {
        var createdScript: URL?
        do {
            GajendraResumeScriptStore.cleanup(
                baseDirectory: resumeBaseDirectory,
                olderThan: GajendraResumeScriptStore.cleanupDelay
            )
            let script = try GajendraResumeScriptStore.makeScript(
                command: command,
                baseDirectory: resumeBaseDirectory
            )
            createdScript = script
            scheduleResumeCleanup(for: script)
            guard try resumeScriptOpener(script) else {
                throw NSError(domain: "Gajendra", code: 1)
            }
            errorChannels.openSucceeded()
        } catch {
            // A failed opener must not leave a runnable command behind. The bounded cleanup is
            // scheduled before the opener call, and this immediate removal closes the failure
            // window for an opener that returns false or throws.
            if let createdScript { try? FileManager.default.removeItem(at: createdScript) }
            errorChannels.openFailed("Gajendra could not open this thread.")
        }
    }

    private func scheduleResumeCleanup(for script: URL) {
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + GajendraResumeScriptStore.cleanupDelay) {
            try? FileManager.default.removeItem(at: script)
        }
    }

    private func genericClientError(_ error: Error) -> String {
        if let clientError = error as? DeckClient.ClientError {
            return clientError.errorDescription ?? "Gajendra could not read its local data."
        }
        return "Gajendra could not read its local data."
    }

    private func genericMutationError(_ error: Error) -> String {
        if let clientError = error as? DeckClient.ClientError, clientError == .invalidResponse {
            return "Gajendra returned an invalid priority response."
        }
        return "Gajendra could not apply that change."
    }

    private func runNextQueuedOperationIfNeeded() {
        if !pendingMutations.isEmpty {
            dispatch(pendingMutations.removeFirst())
        } else if refreshRequestedWhileBusy {
            refreshRequestedWhileBusy = false
            refresh()
        }
    }
}
