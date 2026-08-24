import Foundation

#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

public protocol DeckServing {
    func snapshot() async throws -> DeckSnapshot
    func mutate(_ request: DeckMutationRequest) async throws -> DeckMutationResult
}

public struct GajendraNodeResolution: Equatable, Sendable {
    public let executable: String
    public let prefixArguments: [String]
    public let source: String

    public init(executable: String, prefixArguments: [String] = [], source: String) {
        self.executable = executable
        self.prefixArguments = prefixArguments
        self.source = source
    }
}

public struct GajendraProcessLimits: Equatable, Sendable {
    /// The local service may use its full 30-second generation budget, then settle at most two
    /// bounded 5-second store operations before encoding a safe response. Keep a final bounded
    /// margin for process startup, JSON output, and shutdown so the native watchdog cannot race a
    /// valid service result at the same deadline.
    public static let defaultTimeout: TimeInterval = 45

    public let timeout: TimeInterval
    public let stdoutBytes: Int
    public let stderrBytes: Int
    public let terminationGrace: TimeInterval

    public init(
        timeout: TimeInterval = GajendraProcessLimits.defaultTimeout,
        stdoutBytes: Int = 4 * 1024 * 1024,
        stderrBytes: Int = 1 * 1024 * 1024,
        terminationGrace: TimeInterval = 0.5
    ) {
        self.timeout = max(0.01, timeout)
        self.stdoutBytes = max(1, stdoutBytes)
        self.stderrBytes = max(1, stderrBytes)
        self.terminationGrace = max(0.01, terminationGrace)
    }
}

/// Resolves the runtime without consulting a shell or requiring a developer-installed Node.
/// The checker is injectable so the resolver can be proven with an empty PATH in self-tests.
public struct GajendraNodeResolver: Sendable {
    public let environment: [String: String]
    public let bundleURL: URL?
    private let isExecutable: @Sendable (String) -> Bool

    public init(
        environment: [String: String],
        bundleURL: URL? = Bundle.main.bundleURL,
        isExecutable: @escaping @Sendable (String) -> Bool = { FileManager.default.isExecutableFile(atPath: $0) }
    ) {
        self.environment = environment
        self.bundleURL = bundleURL
        self.isExecutable = isExecutable
    }

    public func resolve() -> GajendraNodeResolution? {
        let explicit = environment["GAJENDRA_NODE_BIN"]
        if let explicit, isExecutable(explicit) {
            return GajendraNodeResolution(executable: explicit, source: "GAJENDRA override")
        }

        if let bundleURL {
            let bundled = bundleURL
                .appendingPathComponent("Contents", isDirectory: true)
                .appendingPathComponent("Resources", isDirectory: true)
                .appendingPathComponent("Runtime", isDirectory: true)
                .appendingPathComponent("node", isDirectory: true)
                .appendingPathComponent("bin", isDirectory: true)
                .appendingPathComponent("node", isDirectory: false)
            if isExecutable(bundled.path) {
                return GajendraNodeResolution(executable: bundled.path, source: "bundled runtime")
            }
        }

        let developmentCandidates = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node",
        ] + (environment["PATH"] ?? "")
            .split(separator: ":")
            .map { String($0).appending("/node") }
        if let development = developmentCandidates.first(where: isExecutable) {
            return GajendraNodeResolution(executable: development, source: "Homebrew/development fallback")
        }
        return nil
    }
}

public struct DeckClient: Sendable, DeckServing {
    public enum ClientError: LocalizedError, Equatable {
        case missingServer
        case missingNode
        case commandFailed
        case invalidResponse
        case timedOut
        case outputTooLarge

        public var errorDescription: String? {
            switch self {
            case .missingServer:
                return "The Gajendra app appears incomplete: its local service is missing. Rebuild or reinstall the app."
            case .missingNode:
                return "The Gajendra app appears incomplete: its bundled runtime is missing. Rebuild or reinstall the app."
            case .commandFailed:
                return "Gajendra could not read its local data."
            case .invalidResponse:
                return "Gajendra returned an invalid local response."
            case .timedOut:
                return "Gajendra could not finish reading its local data."
            case .outputTooLarge:
                return "Gajendra received an unexpectedly large local response."
            }
        }
    }

    private let serverURL: URL?
    private let environment: [String: String]
    private let nodeResolver: GajendraNodeResolver
    private let processLimits: GajendraProcessLimits

    public init(
        serverURL: URL? = nil,
        environment: [String: String] = ProcessInfo.processInfo.environment,
        nodeResolver: GajendraNodeResolver? = nil,
        processLimits: GajendraProcessLimits = GajendraProcessLimits()
    ) {
        self.serverURL = serverURL
        self.environment = environment
        self.nodeResolver = nodeResolver ?? GajendraNodeResolver(environment: environment)
        self.processLimits = processLimits
    }

    public func snapshot() async throws -> DeckSnapshot {
        try await execute(arguments: ["--snapshot-json"], input: nil, decode: DeckSnapshot.self)
    }

    public func mutate(_ request: DeckMutationRequest) async throws -> DeckMutationResult {
        try await execute(
            arguments: ["--mutate-json"],
            input: try JSONEncoder().encode(request),
            decode: DeckMutationResult.self
        )
    }

    private func execute<T: Decodable>(
        arguments: [String],
        input: Data?,
        decode: T.Type
    ) async throws -> T {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<T, Error>) in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let output = try run(arguments: arguments, input: input)
                    continuation.resume(returning: try JSONDecoder().decode(T.self, from: output))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func run(arguments: [String], input: Data?) throws -> Data {
        let serviceURL = try resolveServerURL()
        guard let node = nodeResolver.resolve() else { throw ClientError.missingNode }
        let processArguments = [node.executable] + node.prefixArguments + [serviceURL.path] + arguments

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
        let standardOutput = Pipe()
        let standardError = Pipe()
        let standardInput = Pipe()
        #if canImport(Darwin) || canImport(Glibc)
        let childProcessID: Int32
        do {
            childProcessID = try spawnProcess(
                executable: node.executable,
                arguments: processArguments,
                environment: childEnvironment,
                standardInput: standardInput,
                standardOutput: standardOutput,
                standardError: standardError
            )
        } catch {
            try? standardInput.fileHandleForReading.close()
            try? standardInput.fileHandleForWriting.close()
            try? standardOutput.fileHandleForReading.close()
            try? standardOutput.fileHandleForWriting.close()
            try? standardError.fileHandleForReading.close()
            try? standardError.fileHandleForWriting.close()
            throw error
        }
        #else
        throw ClientError.commandFailed
        #endif

        // The parent must not keep the child's pipe ends open: otherwise a descendant can
        // keep a read drain alive after the leader exits. The child received these descriptors
        // through POSIX spawn file actions before exec.
        try? standardInput.fileHandleForReading.close()
        try? standardOutput.fileHandleForWriting.close()
        try? standardError.fileHandleForWriting.close()

        let outputLock = NSLock()
        var output = Data()
        var stdoutTooLarge = false
        var stderrTooLarge = false
        var timedOut = false
        var terminationRequested = false
        var groupCleanupStarted = false
        var delayedKill: DispatchWorkItem?

        // POSIX_SPAWN_SETPGROUP establishes this group before the executable runs. A parent-side
        // setpgid after Foundation Process.run is racy and returns EACCES on macOS.
        let processGroupID: Int32? = childProcessID

        func sendTerminationSignal(_ signal: Int32) {
            #if canImport(Darwin) || canImport(Glibc)
            if let processGroupID {
                _ = kill(-processGroupID, signal)
            }
            #endif
        }

        func forceKillAfterGrace() {
            let work = DispatchWorkItem {
                // Do not gate this on the leader still running: a descendant may be the only
                // process keeping the inherited stdout/stderr pipe open.
                sendTerminationSignal(SIGKILL)
            }
            outputLock.lock()
            guard !groupCleanupStarted else {
                outputLock.unlock()
                return
            }
            delayedKill = work
            outputLock.unlock()
            DispatchQueue.global(qos: .utility).asyncAfter(
                deadline: .now() + processLimits.terminationGrace,
                execute: work
            )
        }

        func cancelDelayedKill() {
            outputLock.lock()
            let work = delayedKill
            delayedKill = nil
            outputLock.unlock()
            work?.cancel()
            work?.wait()
        }

        func beginGroupCleanup() {
            outputLock.lock()
            groupCleanupStarted = true
            outputLock.unlock()
            // Join an already-running delayed kill or cancel one that has not fired. This
            // prevents a stale negative-PGID signal after this method returns and the PID is
            // potentially reused by another process.
            cancelDelayedKill()
        }

        func processGroupExists() -> Bool {
            #if canImport(Darwin) || canImport(Glibc)
            guard let processGroupID else { return false }
            if kill(-processGroupID, 0) == 0 { return true }
            return errno == EPERM
            #else
            return false
            #endif
        }

        func waitForGroupToExit(within timeout: TimeInterval) {
            let deadline = Date().addingTimeInterval(timeout)
            while processGroupExists() {
                let remaining = deadline.timeIntervalSinceNow
                if remaining <= 0 { break }
                Thread.sleep(forTimeInterval: min(0.01, remaining))
            }
        }

        func cleanupProcessGroup() {
            beginGroupCleanup()
            sendTerminationSignal(SIGTERM)
            waitForGroupToExit(within: processLimits.terminationGrace)
            // Send KILL even if the group disappeared during the grace interval: kill(-pgid,
            // SIGKILL) is then a harmless ESRCH and establishes the TERM→grace→KILL sequence.
            sendTerminationSignal(SIGKILL)
            waitForGroupToExit(within: processLimits.terminationGrace)
        }

        func requestTermination() {
            outputLock.lock()
            if groupCleanupStarted {
                outputLock.unlock()
                return
            }
            let shouldTerminate = !terminationRequested
            terminationRequested = true
            outputLock.unlock()
            if shouldTerminate {
                sendTerminationSignal(SIGTERM)
                forceKillAfterGrace()
            }
        }

        let drainGroup = DispatchGroup()
        func drain(_ handle: FileHandle, limit: Int, capture: Bool, markTooLarge: @escaping () -> Void) {
            drainGroup.enter()
            DispatchQueue.global(qos: .utility).async {
                defer { drainGroup.leave() }
                var bytesRead = 0
                while true {
                    let chunk: Data
                    do {
                        guard let next = try handle.read(upToCount: 64 * 1024), !next.isEmpty else { break }
                        chunk = next
                    } catch {
                        // The bounded cleanup path closes local read handles after the process
                        // group is killed. Treat that close as EOF instead of surfacing an
                        // uncaught NSFileHandle exception from a blocked drain.
                        break
                    }
                    bytesRead += chunk.count
                    if bytesRead > limit {
                        markTooLarge()
                        requestTermination()
                        continue
                    }
                    guard capture else { continue }
                    outputLock.lock()
                    output.append(chunk)
                    outputLock.unlock()
                }
            }
        }

        drain(standardOutput.fileHandleForReading, limit: processLimits.stdoutBytes, capture: true) {
            outputLock.lock()
            stdoutTooLarge = true
            outputLock.unlock()
        }
        drain(standardError.fileHandleForReading, limit: processLimits.stderrBytes, capture: false) {
            outputLock.lock()
            stderrTooLarge = true
            outputLock.unlock()
        }

        func waitForDrains(_ group: DispatchGroup, stdout: FileHandle, stderr: FileHandle) {
            if group.wait(timeout: .now() + processLimits.terminationGrace) == .timedOut {
                // A descendant may still own the kernel pipe after the process group has been
                // killed. Closing our local handles releases the drain workers, and the second
                // bounded wait keeps both normal and error paths finite.
                try? stdout.close()
                try? stderr.close()
                _ = group.wait(timeout: .now() + processLimits.terminationGrace)
            }
        }

        let deadline = DispatchWorkItem {
            outputLock.lock()
            timedOut = isProcessRunning(childProcessID)
            outputLock.unlock()
            requestTermination()
        }
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + processLimits.timeout, execute: deadline)

        do {
            if let input {
                try standardInput.fileHandleForWriting.write(contentsOf: input)
            }
            try standardInput.fileHandleForWriting.close()
        } catch {
            try? standardInput.fileHandleForWriting.close()
            requestTermination()
            _ = try? waitForProcessExit(childProcessID)
            deadline.cancel()
            cleanupProcessGroup()
            waitForDrains(
                drainGroup,
                stdout: standardOutput.fileHandleForReading,
                stderr: standardError.fileHandleForReading
            )
            throw error
        }
        let terminationStatus = try waitForProcessExit(childProcessID)
        deadline.cancel()
        cleanupProcessGroup()
        // A descendant can keep a pipe open after the leader has exited. Wait only for the
        // bounded post-KILL grace, then destroy our local read handles to release blocked drains;
        // never let a rejected client hold the native UI indefinitely.
        waitForDrains(
            drainGroup,
            stdout: standardOutput.fileHandleForReading,
            stderr: standardError.fileHandleForReading
        )
        try? standardOutput.fileHandleForReading.close()
        try? standardError.fileHandleForReading.close()

        outputLock.lock()
        let didTimeOut = timedOut
        let didExceedOutput = stdoutTooLarge || stderrTooLarge
        let finalOutput = output
        outputLock.unlock()
        if didTimeOut { throw ClientError.timedOut }
        if didExceedOutput { throw ClientError.outputTooLarge }
        guard terminationStatus == 0 else {
            throw ClientError.commandFailed
        }
        guard !finalOutput.isEmpty else { throw ClientError.invalidResponse }
        return finalOutput
    }

    #if canImport(Darwin) || canImport(Glibc)
    private func spawnProcess(
        executable: String,
        arguments: [String],
        environment: [String: String],
        standardInput: Pipe,
        standardOutput: Pipe,
        standardError: Pipe
    ) throws -> Int32 {
        var fileActions: posix_spawn_file_actions_t? = nil
        guard posix_spawn_file_actions_init(&fileActions) == 0 else {
            throw ClientError.commandFailed
        }
        defer { posix_spawn_file_actions_destroy(&fileActions) }

        func requireAction(_ status: Int32) throws {
            guard status == 0 else { throw ClientError.commandFailed }
        }

        let stdinRead = standardInput.fileHandleForReading.fileDescriptor
        let stdinWrite = standardInput.fileHandleForWriting.fileDescriptor
        let stdoutRead = standardOutput.fileHandleForReading.fileDescriptor
        let stdoutWrite = standardOutput.fileHandleForWriting.fileDescriptor
        let stderrRead = standardError.fileHandleForReading.fileDescriptor
        let stderrWrite = standardError.fileHandleForWriting.fileDescriptor

        try requireAction(posix_spawn_file_actions_adddup2(&fileActions, stdinRead, STDIN_FILENO))
        try requireAction(posix_spawn_file_actions_adddup2(&fileActions, stdoutWrite, STDOUT_FILENO))
        try requireAction(posix_spawn_file_actions_adddup2(&fileActions, stderrWrite, STDERR_FILENO))

        let pipeDescriptors = Set([stdinRead, stdinWrite, stdoutRead, stdoutWrite, stderrRead, stderrWrite])
        for descriptor in pipeDescriptors where descriptor != STDIN_FILENO
            && descriptor != STDOUT_FILENO
            && descriptor != STDERR_FILENO {
            try requireAction(posix_spawn_file_actions_addclose(&fileActions, descriptor))
        }

        var attributes: posix_spawnattr_t? = nil
        guard posix_spawnattr_init(&attributes) == 0 else {
            throw ClientError.commandFailed
        }
        defer { posix_spawnattr_destroy(&attributes) }
        try requireAction(posix_spawnattr_setflags(&attributes, Int16(POSIX_SPAWN_SETPGROUP)))
        // A pgroup of zero means “use the spawned child's PID”, so descendants inherit a
        // dedicated group from the first instruction before exec. This is the critical safety
        // boundary; setting it from the parent after Process.run() is too late on macOS.
        try requireAction(posix_spawnattr_setpgroup(&attributes, 0))

        func makeCStringArray(_ strings: [String]) throws -> [UnsafeMutablePointer<CChar>?] {
            var pointers: [UnsafeMutablePointer<CChar>?] = []
            pointers.reserveCapacity(strings.count + 1)
            for string in strings {
                guard !string.utf8.contains(0), let pointer = strdup(string) else {
                    pointers.compactMap { $0 }.forEach { free($0) }
                    throw ClientError.commandFailed
                }
                pointers.append(pointer)
            }
            pointers.append(nil)
            return pointers
        }

        var argv = try makeCStringArray(arguments)
        defer { argv.compactMap { $0 }.forEach { free($0) } }
        let environmentStrings = environment.keys.sorted().map { key in
            "\(key)=\(environment[key] ?? "")"
        }
        var envp = try makeCStringArray(environmentStrings)
        defer { envp.compactMap { $0 }.forEach { free($0) } }

        var childProcessID: pid_t = 0
        let spawnResult = executable.withCString { executablePath in
            argv.withUnsafeMutableBufferPointer { argvBuffer in
                envp.withUnsafeMutableBufferPointer { environmentBuffer in
                    posix_spawn(
                        &childProcessID,
                        executablePath,
                        &fileActions,
                        &attributes,
                        argvBuffer.baseAddress,
                        environmentBuffer.baseAddress
                    )
                }
            }
        }
        guard spawnResult == 0 else { throw ClientError.commandFailed }
        return Int32(childProcessID)
    }

    private func waitForProcessExit(_ processIdentifier: Int32) throws -> Int32 {
        var status: Int32 = 0
        while true {
            let result = waitpid(processIdentifier, &status, 0)
            if result == processIdentifier { return status }
            if result == -1 && errno == EINTR { continue }
            throw ClientError.commandFailed
        }
    }

    private func isProcessRunning(_ processIdentifier: Int32) -> Bool {
        if kill(processIdentifier, 0) == 0 { return true }
        return errno == EPERM
    }
    #endif

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

    private func firstExecutable(_ paths: [String]) -> String? {
        paths.first(where: FileManager.default.isExecutableFile(atPath:))
    }
}
