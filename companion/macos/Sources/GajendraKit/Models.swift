import CoreTransferable
import Combine
import Foundation
import UniformTypeIdentifiers

#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

public enum PriorityLevel: String, Codable, Sendable {
    case focus
    case important

    public var title: String {
        switch self {
        case .focus: return "Focus"
        case .important: return "Important"
        }
    }
}

public enum ThreadContext: String, Codable, CaseIterable, Identifiable, Sendable {
    case design
    case engineering
    case life

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .design: return "Design"
        case .engineering: return "Engineering"
        case .life: return "Life"
        }
    }
}

public struct ResumeCommand: Codable, Equatable, Sendable {
    public let executable: String
    public let arguments: [String]
    public let cwd: String?

    private enum CodingKeys: String, CodingKey {
        case executable
        case arguments = "args"
        case cwd
    }

    public init(executable: String, arguments: [String], cwd: String? = nil) {
        self.executable = executable
        self.arguments = arguments
        self.cwd = cwd
    }
}

public enum ReviewKind: String, Codable, Sendable {
    case result
    case diff
    case pullRequest = "pull-request"
}

public enum ReviewState: String, Codable, Sendable {
    case ready
}

public enum ReviewDestinationType: String, Codable, Sendable {
    case thread
    case url
}

public struct ReviewDestination: Codable, Equatable, Sendable {
    public let type: ReviewDestinationType
    public let deepLink: String?
    public let url: String?

    public init(type: ReviewDestinationType, deepLink: String? = nil, url: String? = nil) {
        self.type = type
        self.deepLink = deepLink
        self.url = url
    }

    private enum CodingKeys: String, CodingKey {
        case type, deepLink, url
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(ReviewDestinationType.self, forKey: .type)
        let deepLink = try container.decodeIfPresent(String.self, forKey: .deepLink)
        let url = try container.decodeIfPresent(String.self, forKey: .url)
        switch type {
        case .thread where deepLink?.isEmpty == false && url == nil:
            self.init(type: type, deepLink: deepLink)
        case .url where url?.isEmpty == false && deepLink == nil:
            self.init(type: type, url: url)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Review destination does not match its declared type."
            )
        }
    }

    public var value: String? {
        switch type {
        case .thread: return deepLink
        case .url: return url
        }
    }

    public var actionLabel: String {
        type == .thread ? "Task" : "Review"
    }
}

public struct ReviewSignal: Codable, Equatable, Sendable {
    public let state: ReviewState
    public let kind: ReviewKind
    public let updatedAt: Double
    public let destination: ReviewDestination
    public let providerStatus: String

    public init(
        state: ReviewState = .ready,
        kind: ReviewKind,
        updatedAt: Double,
        destination: ReviewDestination,
        providerStatus: String
    ) {
        self.state = state
        self.kind = kind
        self.updatedAt = updatedAt
        self.destination = destination
        self.providerStatus = providerStatus
    }

    public var isReady: Bool { state == .ready }
}

public struct DeckThread: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let sourceId: String
    public let sourceName: String
    public let title: String
    public let project: String
    public let updatedAt: Double
    public let status: String
    public let level: PriorityLevel?
    public let isCurrent: Bool
    public let context: ThreadContext?
    public let deepLink: String
    public let allowedDeepLinkSchemes: [String]
    public let resumeCommand: ResumeCommand?
    public let review: ReviewSignal?

    public init(
        id: String,
        sourceId: String,
        sourceName: String,
        title: String,
        project: String,
        updatedAt: Double,
        status: String,
        level: PriorityLevel?,
        isCurrent: Bool,
        context: ThreadContext? = nil,
        deepLink: String,
        allowedDeepLinkSchemes: [String] = [],
        resumeCommand: ResumeCommand? = nil,
        review: ReviewSignal? = nil
    ) {
        self.id = id
        self.sourceId = sourceId
        self.sourceName = sourceName
        self.title = title
        self.project = project
        self.updatedAt = updatedAt
        self.status = status
        self.level = level
        self.isCurrent = isCurrent
        self.context = context
        self.deepLink = deepLink
        self.allowedDeepLinkSchemes = allowedDeepLinkSchemes
        self.resumeCommand = resumeCommand
        self.review = review
    }

    private enum CodingKeys: String, CodingKey {
        case id, sourceId, sourceName, title, project, updatedAt, status, level, isCurrent, context
        case deepLink, allowedDeepLinkSchemes, resumeCommand, review
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(String.self, forKey: .id),
            sourceId: try container.decode(String.self, forKey: .sourceId),
            sourceName: try container.decode(String.self, forKey: .sourceName),
            title: try container.decode(String.self, forKey: .title),
            project: try container.decode(String.self, forKey: .project),
            updatedAt: try container.decode(Double.self, forKey: .updatedAt),
            status: try container.decode(String.self, forKey: .status),
            level: try container.decodeIfPresent(PriorityLevel.self, forKey: .level),
            isCurrent: try container.decode(Bool.self, forKey: .isCurrent),
            context: try container.decodeIfPresent(ThreadContext.self, forKey: .context),
            deepLink: try container.decode(String.self, forKey: .deepLink),
            allowedDeepLinkSchemes: try container.decodeIfPresent([String].self, forKey: .allowedDeepLinkSchemes) ?? [],
            resumeCommand: try container.decodeIfPresent(ResumeCommand.self, forKey: .resumeCommand),
            review: try container.decodeIfPresent(ReviewSignal.self, forKey: .review)
        )
    }

    public var isRunning: Bool {
        Self.isRunningStatus(status)
    }

    public var isReadyForReview: Bool {
        review?.isReady == true && !isRunning
    }

    public var placementLabel: String? {
        if isCurrent { return "NOW" }
        switch level {
        case .focus: return "Focus"
        case .important: return "Important"
        case nil: return nil
        }
    }

    public func matchesSearch(_ query: String) -> Bool {
        let terms = query.lowercased().split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !terms.isEmpty else { return true }
        let searchableMetadata = [title, project, sourceName, sourceId, id, status]
            .joined(separator: " ")
            .lowercased()
        return terms.allSatisfy(searchableMetadata.contains)
    }

    fileprivate func settingCurrent(_ value: Bool) -> DeckThread {
        DeckThread(
            id: id,
            sourceId: sourceId,
            sourceName: sourceName,
            title: title,
            project: project,
            updatedAt: updatedAt,
            status: status,
            level: level,
            isCurrent: value,
            context: context,
            deepLink: deepLink,
            allowedDeepLinkSchemes: allowedDeepLinkSchemes,
            resumeCommand: resumeCommand,
            review: review
        )
    }

    public static func isRunningStatus(_ status: String) -> Bool {
        let key = status.lowercased().unicodeScalars
            .filter { CharacterSet.letters.contains($0) }
            .map(String.init)
            .joined()
        return ["active", "busy", "inprogress", "processing", "running", "streaming", "working"].contains(key)
    }
}

public struct ThreadSourceStatus: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let kind: String
    public let state: String
    public let enabled: Bool
    public let threadCount: Int
    public let detail: String?

    public init(id: String, name: String, kind: String, state: String, enabled: Bool, threadCount: Int, detail: String? = nil) {
        self.id = id
        self.name = name
        self.kind = kind
        self.state = state
        self.enabled = enabled
        self.threadCount = threadCount
        self.detail = detail
    }

    /// Provider diagnostics are decoded for protocol compatibility but are not UI-safe copy.
    /// Native surfaces must use this bounded state-derived text instead of `detail`.
    public var sanitizedDetail: String {
        if state == "ready" {
            return threadCount == 1 ? "1 thread available" : "\(threadCount) threads available"
        }
        switch state {
        case "disabled": return "Turn on to include this source on refresh."
        case "not-installed": return "The supported local tool is not installed."
        case "not-configured": return "This local source needs setup."
        case "error": return "This local source needs attention."
        default: return "Local source status is unavailable."
        }
    }
}

public struct CollapsedSections: Codable, Equatable, Sendable {
    public let focus: Bool
    public let important: Bool

    public init(focus: Bool, important: Bool) {
        self.focus = focus
        self.important = important
    }
}

public struct DeckSnapshot: Codable, Equatable, Sendable {
    public let revision: Int
    public let generatedAt: String
    public let current: DeckThread?
    public let focus: [DeckThread]
    public let important: [DeckThread]
    public let available: [DeckThread]
    public let collapsed: CollapsedSections
    public let focusGuide: Int
    public let focusOverGuide: Bool
    public let staleEntryCount: Int
    public let source: String
    public let sources: [ThreadSourceStatus]
    public let error: String?

    public init(
        revision: Int = 0,
        generatedAt: String,
        current: DeckThread?,
        focus: [DeckThread],
        important: [DeckThread],
        available: [DeckThread],
        collapsed: CollapsedSections,
        focusGuide: Int,
        focusOverGuide: Bool,
        staleEntryCount: Int,
        source: String,
        sources: [ThreadSourceStatus],
        error: String?
    ) {
        self.revision = revision
        self.generatedAt = generatedAt
        let currentId = current?.id
        self.current = current?.settingCurrent(true)
        self.focus = focus.map { $0.settingCurrent($0.id == currentId) }
        self.important = important.map { $0.settingCurrent(false) }
        self.available = available.map { $0.settingCurrent(false) }
        self.collapsed = collapsed
        self.focusGuide = focusGuide
        self.focusOverGuide = focusOverGuide
        self.staleEntryCount = staleEntryCount
        self.source = source
        self.sources = sources
        self.error = error
    }

    private enum CodingKeys: String, CodingKey {
        case revision, generatedAt, current, focus, important, available, collapsed, focusGuide, focusOverGuide
        case staleEntryCount, source, sources, error
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            revision: try container.decodeIfPresent(Int.self, forKey: .revision) ?? 0,
            generatedAt: try container.decode(String.self, forKey: .generatedAt),
            current: try container.decodeIfPresent(DeckThread.self, forKey: .current),
            focus: try container.decode([DeckThread].self, forKey: .focus),
            important: try container.decode([DeckThread].self, forKey: .important),
            available: try container.decode([DeckThread].self, forKey: .available),
            collapsed: try container.decode(CollapsedSections.self, forKey: .collapsed),
            focusGuide: try container.decode(Int.self, forKey: .focusGuide),
            focusOverGuide: try container.decode(Bool.self, forKey: .focusOverGuide),
            staleEntryCount: try container.decode(Int.self, forKey: .staleEntryCount),
            source: try container.decode(String.self, forKey: .source),
            sources: try container.decode([ThreadSourceStatus].self, forKey: .sources),
            error: try container.decodeIfPresent(String.self, forKey: .error)
        )
    }

    public var allThreads: [DeckThread] {
        var seen = Set<String>()
        return ([current].compactMap { $0 } + focus + important + available).filter { thread in
            seen.insert(thread.id).inserted
        }
    }

    public var runningThreads: [DeckThread] {
        allThreads.filter(\.isRunning).sorted { left, right in
            left.updatedAt > right.updatedAt
        }
    }

    public var reviewReadyThreads: [DeckThread] {
        allThreads.filter(\.isReadyForReview).sorted { left, right in
            (left.review?.updatedAt ?? 0) > (right.review?.updatedAt ?? 0)
        }
    }

    public func searchThreads(_ query: String) -> [DeckThread] {
        allThreads.filter { $0.matchesSearch(query) }
    }
}

public enum DeckMutation: Encodable, Equatable, Sendable {
    case setLevel(threadId: String, level: PriorityLevel?)
    case setCurrent(threadId: String)
    case move(threadId: String, direction: MoveDirection)
    case moveBefore(
        threadId: String,
        level: PriorityLevel?,
        beforeThreadId: String?,
        context: ThreadContext?,
        currentThreadId: String?
    )
    case setContext(threadId: String, context: ThreadContext?)
    case setCollapsed(level: PriorityLevel, collapsed: Bool)
    case setSourceEnabled(sourceId: String, enabled: Bool)

    public enum MoveDirection: String, Encodable, Sendable {
        case up
        case down
    }

    private enum CodingKeys: String, CodingKey {
        case type, threadId, level, direction, beforeThreadId, context, currentThreadId, collapsed, sourceId, enabled
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .setLevel(threadId, level):
            try container.encode("set-level", forKey: .type)
            try container.encode(threadId, forKey: .threadId)
            try container.encode(level, forKey: .level)
        case let .setCurrent(threadId):
            try container.encode("set-current", forKey: .type)
            try container.encode(threadId, forKey: .threadId)
        case let .move(threadId, direction):
            try container.encode("move", forKey: .type)
            try container.encode(threadId, forKey: .threadId)
            try container.encode(direction, forKey: .direction)
        case let .moveBefore(threadId, level, beforeThreadId, context, currentThreadId):
            try container.encode("move-before", forKey: .type)
            try container.encode(threadId, forKey: .threadId)
            try container.encode(level, forKey: .level)
            try container.encode(beforeThreadId, forKey: .beforeThreadId)
            try container.encode(context, forKey: .context)
            try container.encode(currentThreadId, forKey: .currentThreadId)
        case let .setContext(threadId, context):
            try container.encode("set-context", forKey: .type)
            try container.encode(threadId, forKey: .threadId)
            try container.encode(context, forKey: .context)
        case let .setCollapsed(level, collapsed):
            try container.encode("set-collapsed", forKey: .type)
            try container.encode(level, forKey: .level)
            try container.encode(collapsed, forKey: .collapsed)
        case let .setSourceEnabled(sourceId, enabled):
            try container.encode("set-source-enabled", forKey: .type)
            try container.encode(sourceId, forKey: .sourceId)
            try container.encode(enabled, forKey: .enabled)
        }
    }
}

public struct DeckMutationRequest: Encodable, Equatable, Sendable {
    public let protocolVersion: Int
    public let mutation: DeckMutation
    public let expectedRevision: Int?
    public let idempotencyKey: String?

    public init(
        protocolVersion: Int = 1,
        mutation: DeckMutation,
        expectedRevision: Int? = nil,
        idempotencyKey: String? = nil
    ) {
        self.protocolVersion = protocolVersion
        self.mutation = mutation
        self.expectedRevision = expectedRevision
        self.idempotencyKey = idempotencyKey
    }
}

public enum DeckMutationOutcome: String, Codable, Sendable {
    case applied
    case replayed
    case conflict
    case rejected
}

public struct DeckMutationError: Codable, Equatable, Sendable {
    public let code: String?
    public let message: String?

    public init(code: String? = nil, message: String? = nil) {
        self.code = code
        self.message = message
    }
}

public struct DeckMutationResult: Codable, Equatable, Sendable {
    public let protocolVersion: Int
    public let outcome: DeckMutationOutcome
    public let revision: Int
    public let snapshot: DeckSnapshot
    public let error: DeckMutationError?

    public init(
        protocolVersion: Int = 1,
        outcome: DeckMutationOutcome,
        revision: Int,
        snapshot: DeckSnapshot,
        error: DeckMutationError? = nil
    ) {
        self.protocolVersion = protocolVersion
        self.outcome = outcome
        self.revision = revision
        self.snapshot = snapshot
        self.error = error
    }

    public var genericUserMessage: String {
        switch error?.code {
        case "stale-revision", "conflict":
            return "That priority changed elsewhere. Refreshing the latest priorities."
        case "unknown-thread":
            return "That thread is no longer available."
        case "unknown-source":
            return "That source is unavailable."
        case "invalid-target", "invalid-mutation":
            return "That priority change is no longer available."
        case "store-recovery-required":
            return "Gajendra needs to recover its priority store before changing priorities."
        case "store-busy":
            return "Gajendra is busy. Try again in a moment."
        default:
            return "Gajendra could not apply that priority change."
        }
    }
}

/// Separate native error channels keep an open failure from hiding a later mutation failure (and
/// vice versa). The visible error is intentionally generic; provider diagnostics never enter it.
public struct GajendraErrorChannels: Equatable, Sendable {
    public private(set) var open: String?
    public private(set) var mutation: String?
    public private(set) var client: String?

    public init(open: String? = nil, mutation: String? = nil, client: String? = nil) {
        self.open = open
        self.mutation = mutation
        self.client = client
    }

    public var visible: String? {
        mutation ?? open ?? client
    }

    public mutating func openFailed(_ message: String) {
        open = message
    }

    public mutating func openSucceeded() {
        open = nil
    }

    public mutating func mutationFailed(_ message: String) {
        mutation = message
    }

    public mutating func mutationSucceeded() {
        mutation = nil
    }

    public mutating func clientFailed(_ message: String) {
        client = message
    }

    public mutating func clientSucceeded() {
        client = nil
    }
}

public enum GajendraBrandCopy {
    public static let name = "Gajendra"
    public static let descriptor = "One clear focus across your AI tools."
    public static let promise = "One NOW. One short queue. One click back to the exact thread."
}

public enum GajendraDeepLinkPolicy {
    public static func isPermitted(_ value: String, allowedSchemes: [String]) -> Bool {
        guard !value.isEmpty,
              value == value.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.contains(where: { $0.isWhitespace }),
              let colon = value.firstIndex(of: ":") else { return false }

        let rawScheme = String(value[..<colon])
        guard !rawScheme.isEmpty,
              rawScheme == rawScheme.removingPercentEncoding,
              rawScheme.first?.isLetter == true,
              rawScheme.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "+" || $0 == "-" || $0 == ".") }),
              let url = URL(string: value),
              let scheme = url.scheme?.lowercased(),
              scheme == rawScheme.lowercased(),
              !["javascript", "data", "file"].contains(scheme),
              allowedSchemes.map({ $0.lowercased() }).contains(scheme) else { return false }

        // Encoded schemes, path components, and control characters must not be handed to
        // NSWorkspace. Canonical provider links are already opaque IDs and need no escaping.
        guard !value.contains("%") else { return false }
        if ["http", "https"].contains(scheme) {
            return URLComponents(string: value)?.host?.isEmpty == false
        }
        return true
    }
}

public enum GajendraLaunchAtLoginAction: String, Codable, Sendable {
    case readOnly
    case register
    case unregister
    case requiresApproval
    case unavailable
}

public enum GajendraLaunchAtLoginStatus: String, Codable, Sendable {
    case enabled
    case requiresApproval
    case notRegistered
    case notFound
    case unknown
}

public protocol GajendraLaunchAtLoginServicing {
    func readStatus() -> GajendraLaunchAtLoginStatus
    func register() throws
    func unregister() throws
}

/// Small service seam used by the app adapter and the self-test. Approval-required is still an
/// installed login item and must therefore be unregistered by an explicit user toggle-off.
public struct GajendraLaunchAtLoginToggle {
    private let service: any GajendraLaunchAtLoginServicing

    public init(service: any GajendraLaunchAtLoginServicing) {
        self.service = service
    }

    @discardableResult
    public func toggle() throws -> GajendraLaunchAtLoginAction {
        switch service.readStatus() {
        case .enabled, .requiresApproval:
            try service.unregister()
            return .unregister
        case .notRegistered:
            try service.register()
            return .register
        case .notFound, .unknown:
            return .unavailable
        }
    }
}

public enum GajendraLaunchAtLoginPolicy {
    public static func automaticAction() -> GajendraLaunchAtLoginAction { .readOnly }

    public static func explicitAction(isEnabled: Bool, requiresApproval: Bool = false) -> GajendraLaunchAtLoginAction {
        return isEnabled || requiresApproval ? .unregister : .register
    }

    public static func action(for status: GajendraLaunchAtLoginStatus) -> GajendraLaunchAtLoginAction {
        switch status {
        case .enabled, .requiresApproval: return .unregister
        case .notRegistered: return .register
        case .notFound, .unknown: return .unavailable
        }
    }
}

public enum GajendraQueueInteractionPolicy {
    public static let stationaryPressMilliseconds = 280
    public static let movementTolerance: CGFloat = 4

    public static func cancelsStationaryPress(
        start: CGPoint,
        current: CGPoint,
        competingDrag: Bool = false,
        viewVisible: Bool = true
    ) -> Bool {
        competingDrag || !viewVisible || hypot(current.x - start.x, current.y - start.y) > movementTolerance
    }
}

public struct GajendraQueueDragPayload: Codable, Hashable, Sendable, Transferable {
    public let token: String

    public init(token: String) {
        self.token = token
    }

    public static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: GajendraDragTransfer.contentType)
    }
}

public enum GajendraDragTransfer {
    public static let contentType = UTType(exportedAs: "dev.sid.gajendra.queue-token", conformingTo: .data)
}

@MainActor
public final class GajendraQueueDragRegistry: ObservableObject {
    public static let shared = GajendraQueueDragRegistry()

    private struct Entry {
        let threadId: String
        let expiresAt: Date
    }

    private var entries: [String: Entry] = [:]
    private let lifetime: TimeInterval

    public init(lifetime: TimeInterval = 300) {
        self.lifetime = lifetime
    }

    public func issue(threadId: String, now: Date = Date()) -> GajendraQueueDragPayload {
        prune(now: now)
        let token = UUID().uuidString.lowercased()
        entries[token] = Entry(threadId: threadId, expiresAt: now.addingTimeInterval(lifetime))
        return GajendraQueueDragPayload(token: token)
    }

    public func resolve(_ payload: GajendraQueueDragPayload, now: Date = Date()) -> String? {
        prune(now: now)
        guard let entry = entries.removeValue(forKey: payload.token), entry.expiresAt > now else { return nil }
        return entry.threadId
    }

    /// Explicit cancellation is useful when a drag leaves the app without a drop.
    public func cancel(_ payload: GajendraQueueDragPayload) {
        entries[payload.token] = nil
    }

    public func cancelAll() {
        entries.removeAll(keepingCapacity: false)
    }

    public func encodedBytes(for payload: GajendraQueueDragPayload) -> Data {
        (try? JSONEncoder().encode(payload)) ?? Data()
    }

    private func prune(now: Date) {
        entries = entries.filter { $0.value.expiresAt > now }
    }
}

public struct GajendraQueueMovePlan: Equatable, Sendable {
    public let forward: DeckMutation
    public let inverse: DeckMutation

    public init(forward: DeckMutation, inverse: DeckMutation) {
        self.forward = forward
        self.inverse = inverse
    }
}

/// A queue action keeps its user intent until dispatch. The concrete move-before envelope is
/// materialized from the latest authoritative snapshot so queued actions never carry stale order,
/// context, or NOW decisions from the original click.
public enum GajendraQueueIntent: Equatable, Sendable {
    case makeNow(threadId: String)
    case move(threadId: String, level: PriorityLevel?, beforeThreadId: String?)
}

public enum GajendraQueueMovePlanner {
    public static func plan(intent: GajendraQueueIntent, snapshot: DeckSnapshot) -> GajendraQueueMovePlan? {
        switch intent {
        case let .makeNow(threadId):
            return planMakeNow(threadId: threadId, snapshot: snapshot)
        case let .move(threadId, level, beforeThreadId):
            return plan(threadId: threadId, to: level, before: beforeThreadId, snapshot: snapshot)
        }
    }

    public static func plan(
        threadId: String,
        to level: PriorityLevel?,
        before targetId: String?,
        snapshot: DeckSnapshot
    ) -> GajendraQueueMovePlan? {
        guard let thread = snapshot.allThreads.first(where: { $0.id == threadId }) else { return nil }
        guard targetId != threadId else { return nil }
        if level == nil, targetId != nil { return nil }
        let destination = lane(for: level, snapshot: snapshot)
        if let targetId, !destination.contains(where: { $0.id == targetId }) { return nil }

        let priorLane = lane(for: thread.level, snapshot: snapshot)
        let priorIndex = priorLane.firstIndex(where: { $0.id == threadId })
        let priorBefore = beforeAfter(threadId: threadId, in: priorLane)
        let currentThreadId = snapshot.current?.id
        let nextFocus = snapshot.focus.first(where: { $0.id != threadId })?.id
        let forwardCurrentThreadId = currentThreadId == threadId && level != .focus
            ? nextFocus
            : currentThreadId

        // Dropping an item at the end of its existing lane is the only same-lane append no-op.
        // A middle item dropped at the end must still produce an atomic reorder.
        if thread.level == level,
           targetId == nil,
           priorIndex == priorLane.count - 1 {
            return nil
        }
        if thread.level == level,
           let targetId,
           let targetIndex = destination.firstIndex(where: { $0.id == targetId }),
           priorIndex.map({ $0 + 1 == targetIndex }) == true {
            return nil
        }

        return GajendraQueueMovePlan(
            forward: .moveBefore(
                threadId: threadId,
                level: level,
                beforeThreadId: targetId,
                context: thread.context,
                currentThreadId: forwardCurrentThreadId
            ),
            inverse: .moveBefore(
                threadId: threadId,
                level: thread.level,
                beforeThreadId: thread.level == nil ? nil : priorBefore,
                context: thread.context,
                currentThreadId: currentThreadId
            )
        )
    }

    /// Captures the complete old/new state for the visible Make NOW action. The target is placed
    /// at the front of Focus and the prior NOW remains in its exact Focus order for the inverse.
    public static func planMakeNow(threadId: String, snapshot: DeckSnapshot) -> GajendraQueueMovePlan? {
        guard let thread = snapshot.allThreads.first(where: { $0.id == threadId }), !thread.isCurrent else { return nil }
        let priorLane = lane(for: thread.level, snapshot: snapshot)
        let priorBefore = beforeAfter(threadId: threadId, in: priorLane)
        let focusWithoutTarget = snapshot.focus.filter { $0.id != threadId }
        let targetBefore = focusWithoutTarget.first?.id
        return GajendraQueueMovePlan(
            forward: .moveBefore(
                threadId: threadId,
                level: .focus,
                beforeThreadId: targetBefore,
                context: thread.context,
                currentThreadId: thread.id
            ),
            inverse: .moveBefore(
                threadId: threadId,
                level: thread.level,
                beforeThreadId: thread.level == nil ? nil : priorBefore,
                context: thread.context,
                currentThreadId: snapshot.current?.id
            )
        )
    }

    public static func lane(for level: PriorityLevel?, snapshot: DeckSnapshot) -> [DeckThread] {
        switch level {
        case .focus: return snapshot.focus
        case .important: return snapshot.important
        case nil: return snapshot.available
        }
    }

    private static func beforeAfter(threadId: String, in lane: [DeckThread]) -> String? {
        guard let index = lane.firstIndex(where: { $0.id == threadId }), index + 1 < lane.count else { return nil }
        return lane[index + 1].id
    }
}

public enum GajendraResumeScriptStore {
    public static let directoryName = "Gajendra"
    public static let cleanupDelay: TimeInterval = 60

    public static func directory(baseDirectory: URL = FileManager.default.temporaryDirectory) -> URL {
        baseDirectory.appendingPathComponent(directoryName, isDirectory: true)
    }

    @discardableResult
    public static func prepareDirectory(baseDirectory: URL = FileManager.default.temporaryDirectory) throws -> URL {
        let directory = directory(baseDirectory: baseDirectory)
        if isExistingPath(directory.path) {
            // FileManager attributes can follow links, so use lstat before any enumeration.
            if isSymbolicLink(directory.path) || (try? FileManager.default.destinationOfSymbolicLink(atPath: directory.path)) != nil {
                throw CocoaError(.fileReadNoPermission)
            }
            let attributes = try FileManager.default.attributesOfItem(atPath: directory.path)
            guard attributes[.type] as? FileAttributeType == .typeDirectory else {
                throw CocoaError(.fileReadNoPermission)
            }
            let permissions = (attributes[.posixPermissions] as? NSNumber)?.intValue ?? 0
            guard permissions == 0o700 else {
                throw CocoaError(.fileReadNoPermission)
            }
        } else {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700]
            )
            guard !isSymbolicLink(directory.path) else {
                throw CocoaError(.fileReadNoPermission)
            }
        }
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
        return directory
    }

    public static func cleanup(
        baseDirectory: URL = FileManager.default.temporaryDirectory,
        olderThan age: TimeInterval = 0,
        now: Date = Date()
    ) {
        guard let directory = try? prepareDirectory(baseDirectory: baseDirectory) else { return }
        guard let items = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey, .isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return }
        for item in items where item.lastPathComponent.hasPrefix("resume-") && item.pathExtension == "command" {
            let values = try? item.resourceValues(forKeys: [.contentModificationDateKey, .isDirectoryKey])
            guard values?.isDirectory != true else { continue }
            let modified = values?.contentModificationDate ?? .distantPast
            guard now.timeIntervalSince(modified) >= age else { continue }
            try? FileManager.default.removeItem(at: item)
        }
    }

    public static func makeScript(
        command: ResumeCommand,
        baseDirectory: URL = FileManager.default.temporaryDirectory,
        identifier: String = UUID().uuidString
    ) throws -> URL {
        let directory = try prepareDirectory(baseDirectory: baseDirectory)
        let safeIdentifier = identifier
            .filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        let baseName = safeIdentifier.isEmpty ? UUID().uuidString.lowercased() : safeIdentifier
        var script = directory.appendingPathComponent("resume-\(baseName).command")
        if FileManager.default.fileExists(atPath: script.path) {
            script = directory.appendingPathComponent("resume-\(baseName)-\(UUID().uuidString.lowercased()).command")
        }
        var lines = ["#!/bin/zsh", "set -e"]
        if let cwd = command.cwd, !cwd.isEmpty {
            lines.append("cd -- \(shellQuote(cwd))")
        }
        guard !command.executable.isEmpty else { throw CocoaError(.fileNoSuchFile) }
        let arguments = command.arguments.map(shellQuote).joined(separator: " ")
        let argumentSuffix = arguments.isEmpty ? "" : " " + arguments
        lines.append("exec \(shellQuote(command.executable))\(argumentSuffix)")
        try (lines.joined(separator: "\n") + "\n").write(to: script, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: script.path)
        return script
    }

    private static func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\"'\"'") + "'"
    }

    private static func isExistingPath(_ path: String) -> Bool {
        #if canImport(Darwin) || canImport(Glibc)
        var info = stat()
        return lstat(path, &info) == 0
        #else
        return FileManager.default.fileExists(atPath: path)
        #endif
    }

    private static func isSymbolicLink(_ path: String) -> Bool {
        #if canImport(Darwin) || canImport(Glibc)
        var info = stat()
        guard lstat(path, &info) == 0 else { return false }
        return (info.st_mode & S_IFMT) == S_IFLNK
        #else
        return (try? FileManager.default.destinationOfSymbolicLink(atPath: path)) != nil
        #endif
    }
}
