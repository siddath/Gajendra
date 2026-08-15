import Foundation

public enum PriorityLevel: String, Codable, Sendable {
    case focus
    case important
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
    public let resumeCommand: ResumeCommand?

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
        resumeCommand: ResumeCommand? = nil
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
        self.resumeCommand = resumeCommand
    }

    public var isRunning: Bool {
        Self.isRunningStatus(status)
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
            resumeCommand: resumeCommand
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
        case generatedAt, current, focus, important, available, collapsed, focusGuide, focusOverGuide
        case staleEntryCount, source, sources, error
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
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

    public func searchThreads(_ query: String) -> [DeckThread] {
        allThreads.filter { $0.matchesSearch(query) }
    }
}

public enum DeckMutation: Encodable, Equatable, Sendable {
    case setLevel(threadId: String, level: PriorityLevel?)
    case setCurrent(threadId: String)
    case move(threadId: String, direction: MoveDirection)
    case setContext(threadId: String, context: ThreadContext?)
    case setCollapsed(level: PriorityLevel, collapsed: Bool)
    case setSourceEnabled(sourceId: String, enabled: Bool)

    public enum MoveDirection: String, Encodable, Sendable {
        case up
        case down
    }

    private enum CodingKeys: String, CodingKey {
        case type, threadId, level, direction, context, collapsed, sourceId, enabled
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
