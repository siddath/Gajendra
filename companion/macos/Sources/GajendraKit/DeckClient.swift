import Foundation

public protocol DeckServing {
    func snapshot() async throws -> DeckSnapshot
    func mutate(_ mutation: DeckMutation) async throws -> DeckSnapshot
}

public struct DeckClient: Sendable, DeckServing {
    public enum ClientError: LocalizedError {
        case missingServer
        case missingNode
        case commandFailed(String)
        case invalidResponse

        public var errorDescription: String? {
            switch self {
            case .missingServer:
                return "The bundled Gajendra service is missing. Rebuild the companion app."
            case .missingNode:
                return "Node.js 20 or later was not found. Install Node or set GAJENDRA_NODE_BIN."
            case let .commandFailed(message):
                return message.isEmpty ? "Gaja could not load." : message
            case .invalidResponse:
                return "Gaja returned an invalid response."
            }
        }
    }

    private let serverURL: URL?
    private let environment: [String: String]

    public init(serverURL: URL? = nil, environment: [String: String] = ProcessInfo.processInfo.environment) {
        self.serverURL = serverURL
        self.environment = environment
    }

    public func snapshot() async throws -> DeckSnapshot {
        try await execute(arguments: ["--snapshot-json"], input: nil)
    }

    public func mutate(_ mutation: DeckMutation) async throws -> DeckSnapshot {
        try await execute(arguments: ["--mutate-json"], input: try JSONEncoder().encode(mutation))
    }

    private func execute(arguments: [String], input: Data?) async throws -> DeckSnapshot {
        try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    continuation.resume(returning: try run(arguments: arguments, input: input))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func run(arguments: [String], input: Data?) throws -> DeckSnapshot {
        let serviceURL = try resolveServerURL()
        let node = try resolveNode()
        let process = Process()
        process.executableURL = URL(fileURLWithPath: node.executable)
        process.arguments = node.prefixArguments + [serviceURL.path] + arguments

        var childEnvironment = environment
        if childEnvironment["GAJENDRA_CODEX_BIN"] == nil,
           childEnvironment["AADI_CODEX_BIN"] == nil,
           childEnvironment["PRIORITY_DECK_CODEX_BIN"] == nil,
           let codex = firstExecutable([
               "/Applications/ChatGPT.app/Contents/Resources/codex",
               "/opt/homebrew/bin/codex",
               "/usr/local/bin/codex",
           ]) {
            childEnvironment["GAJENDRA_CODEX_BIN"] = codex
        }
        process.environment = childEnvironment

        let standardOutput = Pipe()
        let standardError = Pipe()
        let standardInput = Pipe()
        process.standardOutput = standardOutput
        process.standardError = standardError
        process.standardInput = standardInput
        try process.run()

        if let input {
            try standardInput.fileHandleForWriting.write(contentsOf: input)
        }
        try standardInput.fileHandleForWriting.close()

        let output = standardOutput.fileHandleForReading.readDataToEndOfFile()
        let errorOutput = standardError.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let message = String(data: errorOutput, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            throw ClientError.commandFailed(message)
        }
        guard !output.isEmpty else { throw ClientError.invalidResponse }
        return try JSONDecoder().decode(DeckSnapshot.self, from: output)
    }

    private func resolveServerURL() throws -> URL {
        if let serverURL { return serverURL }
        if let override = environment["GAJENDRA_SERVER_PATH"] ?? environment["AADI_SERVER_PATH"] ?? environment["PRIORITY_DECK_SERVER_PATH"], !override.isEmpty {
            return URL(fileURLWithPath: override)
        }
        guard let bundled = Bundle.main.url(forResource: "server", withExtension: "mjs") else {
            throw ClientError.missingServer
        }
        return bundled
    }

    private func resolveNode() throws -> (executable: String, prefixArguments: [String]) {
        if let override = environment["GAJENDRA_NODE_BIN"] ?? environment["AADI_NODE_BIN"] ?? environment["PRIORITY_DECK_NODE_BIN"], FileManager.default.isExecutableFile(atPath: override) {
            return (override, [])
        }
        if let node = firstExecutable(["/opt/homebrew/bin/node", "/usr/local/bin/node"]) {
            return (node, [])
        }
        throw ClientError.missingNode
    }

    private func firstExecutable(_ paths: [String]) -> String? {
        paths.first(where: FileManager.default.isExecutableFile(atPath:))
    }
}
