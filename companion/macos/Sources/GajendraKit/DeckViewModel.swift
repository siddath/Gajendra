import AppKit
import Foundation

@MainActor
public final class DeckViewModel: ObservableObject {
    @Published public private(set) var snapshot: DeckSnapshot?
    @Published public private(set) var isLoading = false
    @Published public private(set) var errorMessage: String?

    private let client: (any DeckServing)?
    private var refreshRequestedWhileBusy = false
    private var pendingMutations: [DeckMutation] = []
    private var pendingThreadId: String?

    public init(client: (any DeckServing)? = DeckClient(), initialSnapshot: DeckSnapshot? = nil) {
        self.client = client
        self.snapshot = initialSnapshot
    }

    public func refresh() {
        guard let client else { return }
        guard !isLoading else {
            refreshRequestedWhileBusy = true
            return
        }
        isLoading = true
        errorMessage = nil
        Task {
            do {
                let next = try await client.snapshot()
                snapshot = next
                errorMessage = next.error
                openPendingThreadIfAvailable()
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
            runNextQueuedOperationIfNeeded()
        }
    }

    public func apply(_ mutation: DeckMutation) {
        guard let client else { return }
        guard !isLoading else {
            pendingMutations.append(mutation)
            return
        }
        isLoading = true
        errorMessage = nil
        Task {
            do {
                let next = try await client.mutate(mutation)
                snapshot = next
                errorMessage = next.error
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
            runNextQueuedOperationIfNeeded()
        }
    }

    public func open(_ thread: DeckThread) {
        if let command = thread.resumeCommand {
            openInTerminal(command, threadTitle: thread.title)
            return
        }
        guard !thread.deepLink.isEmpty, let url = URL(string: thread.deepLink) else {
            errorMessage = "(thread.sourceName) does not provide a resumable destination for this thread."
            return
        }
        if !NSWorkspace.shared.open(url) {
            errorMessage = "(thread.sourceName) could not open this thread."
        }
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
            errorMessage = "That AI-agent thread is no longer available."
            return
        }
        open(thread)
    }

    private func openInTerminal(_ command: ResumeCommand, threadTitle: String) {
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("Gajendra", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            let script = directory.appendingPathComponent("resume-\(UUID().uuidString).command")
            var lines = ["#!/bin/zsh", "set -e"]
            if let cwd = command.cwd, !cwd.isEmpty { lines.append("cd -- \(shellQuote(cwd))") }
            lines.append("exec \(shellQuote(command.executable)) \(command.arguments.map(shellQuote).joined(separator: " "))")
            try (lines.joined(separator: "\n") + "\n").write(to: script, atomically: true, encoding: .utf8)
            try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: script.path)
            guard NSWorkspace.shared.open(script) else {
                throw NSError(domain: "Gajendra", code: 1, userInfo: [NSLocalizedDescriptionKey: "Terminal did not accept the resume command."])
            }
            DispatchQueue.global().asyncAfter(deadline: .now() + 60) { try? FileManager.default.removeItem(at: script) }
        } catch {
            errorMessage = "Could not resume \(threadTitle): \(error.localizedDescription)"
        }
    }

    private func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\"'\"'") + "'"
    }

    private func runNextQueuedOperationIfNeeded() {
        if !pendingMutations.isEmpty {
            apply(pendingMutations.removeFirst())
        } else if refreshRequestedWhileBusy {
            refreshRequestedWhileBusy = false
            refresh()
        }
    }
}
