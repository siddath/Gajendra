import Foundation
import SwiftUI

@MainActor
public final class GajendraSourceOnboardingState {
    public static let completionKey = "gajendra.onboarding.sources.completed.v1"

    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public var isCompleted: Bool {
        defaults.bool(forKey: Self.completionKey)
    }

    public func shouldPresentOnLaunch(hasPriorNativeState: Bool) -> Bool {
        if defaults.object(forKey: Self.completionKey) != nil {
            return !isCompleted
        }
        guard !hasPriorNativeState else {
            markCompleted()
            return false
        }
        return true
    }

    public func markCompleted() {
        defaults.set(true, forKey: Self.completionKey)
    }
}

public enum GajendraSourceOnboardingCopy {
    public static func isToggleable(_ source: ThreadSourceStatus) -> Bool {
        source.id != "configured-sources"
    }

    public static func symbolName(for source: ThreadSourceStatus) -> String {
        switch source.id {
        case "codex": return "chevron.left.forwardslash.chevron.right"
        case "claude": return "sparkles"
        case "cursor": return "cursorarrow.rays"
        case "grok": return "bolt.horizontal"
        default: return "point.3.connected.trianglepath.dotted"
        }
    }

    public static func connectionMethod(for source: ThreadSourceStatus) -> String {
        switch source.id {
        case "codex": return "Local Codex app-server"
        case "claude": return "Local session metadata · opt-in"
        case "cursor": return "Local Cursor Agent CLI"
        case "grok": return "Local summary metadata · opt-in"
        case "configured-sources": return "Configured source registry"
        default: return "Explicit bounded local catalog"
        }
    }

    public static func statusTitle(for source: ThreadSourceStatus) -> String {
        switch source.state {
        case "ready": return "Ready"
        case "disabled": return "Off"
        case "not-installed": return "Not installed"
        case "not-configured": return "Needs setup"
        case "error": return "Needs attention"
        default: return source.state.replacingOccurrences(of: "-", with: " ").capitalized
        }
    }

    public static func detail(for source: ThreadSourceStatus) -> String {
        if source.state == "ready" {
            return source.threadCount == 1 ? "1 thread available" : "\(source.threadCount) threads available"
        }
        if let detail = source.detail, !detail.isEmpty {
            return detail
        }
        switch source.state {
        case "disabled": return "Turn on to include this tool when Gaja refreshes."
        case "not-installed": return "Install the supported local CLI, then rescan."
        case "not-configured": return "Complete this tool's local source setup, then rescan."
        case "error": return "Gaja could not read this source's metadata contract."
        default: return "Local source status is unavailable."
        }
    }
}

public struct GajendraSourceOnboardingView: View {
    @ObservedObject private var model: DeckViewModel
    @Environment(\.colorScheme) private var colorScheme
    private let onFinish: () -> Void
    private let onSkip: () -> Void
    private let isPreview: Bool

    public init(
        model: DeckViewModel,
        onFinish: @escaping () -> Void = {},
        onSkip: @escaping () -> Void = {},
        isPreview: Bool = false
    ) {
        self.model = model
        self.onFinish = onFinish
        self.onSkip = onSkip
        self.isPreview = isPreview
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            privacyNotice
            sourceSection
            footer
        }
        .padding(28)
        .frame(minWidth: 560, minHeight: 560, alignment: .topLeading)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 18) {
            GajendraMark(size: 66)
                .frame(width: 74, height: 74)

            VStack(alignment: .leading, spacing: 6) {
                Text("Connect your AI tools")
                    .font(.system(size: 27, weight: .semibold))
                Text("Bring supported local threads into one focused view, so your NOW stays clear across tools.")
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var privacyNotice: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lock.shield")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text("Local metadata only")
                    .font(.system(size: 13, weight: .semibold))
                Text("No account sign-in or cloud sync. Gaja never stores prompts, transcripts, tokens, credentials, or provider databases.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.gajendraAccent(for: colorScheme).opacity(colorScheme == .dark ? 0.12 : 0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var sourceSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("LOCAL SOURCES")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .tracking(0.7)
                    Text("Gaja refreshes selected sources without changing their sessions.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if isPreview {
                    Label(model.isLoading ? "Scanning" : "Rescan", systemImage: "arrow.clockwise")
                        .foregroundStyle(.secondary)
                } else {
                    Button {
                        model.refresh()
                    } label: {
                        Label(model.isLoading ? "Scanning" : "Rescan", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderless)
                    .disabled(model.isLoading)
                    .help("Rescan supported local AI tools")
                    .accessibilityLabel(model.isLoading ? "Scanning local AI tools" : "Rescan local AI tools")
                    .accessibilityHint("Refreshes local source availability and thread metadata")
                    .accessibilityIdentifier("gajendra-source-rescan")
                }
            }

            Group {
                if let sources = model.snapshot?.sources {
                    if isPreview {
                        VStack(spacing: 0) {
                            sourceRows(sources)
                        }
                    } else {
                        ScrollView(.vertical, showsIndicators: sources.count > 4) {
                            VStack(spacing: 0) {
                                sourceRows(sources)
                            }
                        }
                    }
                } else if model.isLoading {
                    HStack(spacing: 10) {
                        ProgressView()
                            .controlSize(.small)
                        Text("Finding supported local tools…")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 116)
                } else {
                    VStack(spacing: 7) {
                        Image(systemName: "exclamationmark.arrow.triangle.2.circlepath")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                        Text("Gaja could not scan local tools.")
                            .font(.headline)
                        Button("Try Again") { model.refresh() }
                    }
                    .frame(maxWidth: .infinity, minHeight: 116)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 116, maxHeight: 286, alignment: .top)
            .background(Color.primary.opacity(colorScheme == .dark ? 0.035 : 0.025))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.secondary.opacity(0.2), lineWidth: 0.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            if let error = model.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private func sourceRows(_ sources: [ThreadSourceStatus]) -> some View {
        ForEach(Array(sources.enumerated()), id: \.element.id) { index, source in
            sourceRow(source)
            if index < sources.count - 1 {
                Divider().padding(.leading, 54)
            }
        }
    }

    private func sourceRow(_ source: ThreadSourceStatus) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: GajendraSourceOnboardingCopy.symbolName(for: source))
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(sourceColor(source))
                .frame(width: 30, height: 30)
                .background(sourceColor(source).opacity(colorScheme == .dark ? 0.15 : 0.1))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(source.name)
                        .font(.system(size: 13.5, weight: .semibold))
                    Text(GajendraSourceOnboardingCopy.statusTitle(for: source))
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(statusColor(source))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(statusColor(source).opacity(colorScheme == .dark ? 0.14 : 0.09))
                        .clipShape(Capsule())
                }
                Text(GajendraSourceOnboardingCopy.connectionMethod(for: source))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(GajendraSourceOnboardingCopy.detail(for: source))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(2)
            }

            Spacer(minLength: 10)

            if GajendraSourceOnboardingCopy.isToggleable(source) {
                if isPreview {
                    previewSwitch(isOn: source.enabled)
                } else {
                    Toggle("", isOn: Binding(
                        get: { source.enabled },
                        set: { enabled in
                            model.apply(.setSourceEnabled(sourceId: source.id, enabled: enabled))
                        }
                    ))
                    .labelsHidden()
                    .toggleStyle(.switch)
                    .disabled(model.isLoading)
                    .accessibilityLabel("Use \(source.name) in Gaja")
                    .accessibilityValue(source.enabled ? "On" : "Off")
                    .accessibilityHint("Includes only supported local metadata when Gaja refreshes")
                    .accessibilityIdentifier("gajendra-source-toggle-\(source.id)")
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func previewSwitch(isOn: Bool) -> some View {
        ZStack(alignment: isOn ? .trailing : .leading) {
            Capsule()
                .fill(isOn ? Color.accentColor : Color.secondary.opacity(0.3))
                .frame(width: 30, height: 18)
            Circle()
                .fill(.white)
                .frame(width: 14, height: 14)
                .padding(2)
        }
        .accessibilityHidden(true)
    }

    private var footer: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Change sources anytime from Settings → Connect AI Tools.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Refresh reads the latest local metadata; it does not copy conversations.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            Button("Skip for now", action: onSkip)
                .keyboardShortcut(.cancelAction)
                .accessibilityLabel("Skip AI tool setup")
                .accessibilityHint("Closes setup and keeps the current source choices")
                .accessibilityIdentifier("gajendra-source-onboarding-skip")
            Button("Finish setup", action: onFinish)
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .accessibilityLabel("Finish AI tool setup")
                .accessibilityHint("Saves completion and closes setup")
                .accessibilityIdentifier("gajendra-source-onboarding-finish")
        }
    }

    private func statusColor(_ source: ThreadSourceStatus) -> Color {
        switch source.state {
        case "ready": return .green
        case "not-installed", "not-configured": return .orange
        case "error": return .red
        default: return .secondary
        }
    }

    private func sourceColor(_ source: ThreadSourceStatus) -> Color {
        switch source.id {
        case "codex": return Color.gajendraAccent(for: colorScheme)
        case "claude": return colorScheme == .dark ? Color(red: 1, green: 0.64, blue: 0.35) : Color(red: 0.68, green: 0.27, blue: 0.06)
        case "cursor": return colorScheme == .dark ? Color(red: 0.76, green: 0.7, blue: 1) : Color(red: 0.35, green: 0.25, blue: 0.62)
        case "grok": return colorScheme == .dark ? .white : .black
        default: return .secondary
        }
    }
}
