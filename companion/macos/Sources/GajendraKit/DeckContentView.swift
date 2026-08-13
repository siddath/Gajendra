import AppKit
import SwiftUI

public struct DeckContentView: View {
    @ObservedObject private var model: DeckViewModel
    @ObservedObject private var visualSettings: GajendraVisualSettings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var search = ""
    private let usesScrollView: Bool
    private let isPreview: Bool

    public init(
        model: DeckViewModel,
        visualSettings: GajendraVisualSettings,
        usesScrollView: Bool = true,
        isPreview: Bool = false
    ) {
        self.model = model
        self.visualSettings = visualSettings
        self.usesScrollView = usesScrollView
        self.isPreview = isPreview
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            if let error = model.errorMessage {
                errorBanner(error)
            }
            if let snapshot = model.snapshot {
                if usesScrollView {
                    ScrollView {
                        deckSections(snapshot)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    deckSections(snapshot)
                }
            } else if model.isLoading {
                HStack {
                    Spacer()
                    ProgressView("Loading AI-agent threads…")
                    Spacer()
                }
                .frame(maxHeight: .infinity)
            } else {
                VStack(spacing: 8) {
                    GajendraMark(size: 34)
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("Gaja is unavailable")
                        .font(.headline)
                    Text("Refresh to read your configured local thread sources.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            footer
        }
        .padding(16)
        .frame(minWidth: usesScrollView ? 520 : 430, minHeight: 650)
        .background(organizerSurface)
        .animation(deckAnimation, value: model.snapshot)
        .animation(deckAnimation, value: model.errorMessage)
        .task {
            model.refresh()
        }
    }

    private var deckAnimation: Animation? {
        reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.86)
    }

    private func deckSections(_ snapshot: DeckSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sourceStrip(snapshot.sources)
            nowCard(snapshot.current)
            prioritySection(
                title: "Double-star Focus",
                level: .focus,
                threads: snapshot.focus,
                collapsed: snapshot.collapsed.focus
            )
            prioritySection(
                title: "Important",
                level: .important,
                threads: snapshot.important,
                collapsed: snapshot.collapsed.important
            )
            availableSection(snapshot.available)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            GajendraMark(size: 24)
            VStack(alignment: .leading, spacing: 1) {
                Text("Gaja")
                    .font(.headline)
                Text("Elephant Focus for AI Power Users")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if model.isLoading {
                Text("Refreshing")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if isPreview {
                Image(systemName: "paintpalette")
                    .frame(width: 20, height: 20)
                    .foregroundStyle(.secondary)
            } else {
                visualSettingsMenu
            }
            refreshButton
        }
    }

    private var visualSettingsMenu: some View {
        Menu {
            Picker("Theme", selection: $visualSettings.theme) {
                ForEach(GajendraVisualTheme.allCases) { theme in
                    Text(theme.title).tag(theme)
                }
            }
            Divider()
            Picker("Appearance", selection: $visualSettings.appearance) {
                ForEach(GajendraAppearance.allCases) { appearance in
                    Text(appearance.title).tag(appearance)
                }
            }
        } label: {
            Image(systemName: "paintpalette")
                .frame(width: 20, height: 20)
                .contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .frame(width: 28)
        .help("Theme and appearance")
        .accessibilityLabel("Theme and appearance")
    }

    @ViewBuilder
    private func sourceStrip(_ sources: [ThreadSourceStatus]) -> some View {
        if isPreview {
            HStack(spacing: 7) {
                ForEach(sources) { source in
                    sourcePill(source)
                }
            }
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(sources) { source in
                        Button {
                            model.apply(.setSourceEnabled(sourceId: source.id, enabled: !source.enabled))
                        } label: {
                            sourcePill(source)
                        }
                        .buttonStyle(.plain)
                        .opacity(source.enabled ? 1 : 0.58)
                        .disabled(model.isLoading)
                        .help(source.detail ?? (source.enabled ? "Disable \(source.name)" : "Enable \(source.name)"))
                        .accessibilityLabel("\(source.name), \(source.state), \(source.threadCount) threads")
                    }
                }
            }
            .accessibilityLabel("Configured thread sources")
        }
    }

    private func sourcePill(_ source: ThreadSourceStatus) -> some View {
        HStack(spacing: 5) {
            Circle().fill(sourceStateColor(source)).frame(width: 6, height: 6)
            Text(source.name)
            Text("\(source.threadCount)").monospacedDigit().foregroundStyle(.secondary)
        }
        .font(.caption2.weight(.medium))
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(Color.primary.opacity(0.045), in: Capsule())
        .overlay(Capsule().stroke(Color.secondary.opacity(0.2), lineWidth: 0.75))
    }

    private func sourceStateColor(_ source: ThreadSourceStatus) -> Color {
        guard source.enabled else { return .secondary }
        switch source.state {
        case "ready": return .green
        case "error": return .red
        case "not-installed": return .orange
        default: return .secondary
        }
    }

    @ViewBuilder
    private var refreshButton: some View {
        if !isPreview {
            Button {
                model.refresh()
            } label: {
                Group {
                    if model.isLoading {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                .frame(width: 20, height: 20)
                .contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .disabled(model.isLoading)
            .help(model.isLoading ? "Refreshing" : "Refresh")
            .accessibilityLabel(model.isLoading ? "Refreshing Gaja" : "Refresh Gaja")
        }
    }

    private func nowCard(_ current: DeckThread?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: "scope")
                    .font(.caption.bold())
                Text("NOW")
                    .font(.caption.bold())
                    .tracking(1.1)
                Text("Current focus")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .foregroundStyle(Color.gajendraAccent(for: colorScheme))
            if let current {
                HStack(alignment: .center, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(current.title)
                            .font(.title3.weight(.semibold))
                            .lineLimit(2)
                        HStack(spacing: 6) {
                            Text(current.project)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Button {
                                model.open(current)
                            } label: {
                                sourceBadge(current)
                            }
                            .buttonStyle(.plain)
                            .help("Open \(current.title) in \(current.sourceName)")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Button("Open thread") {
                        model.open(current)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.accentColor)
                    .keyboardShortcut(.return, modifiers: [])
                    .fixedSize()
                }
            } else {
                Text("Choose one Focus task to make current.")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(nowSurfaceColor)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(nowBorderColor, lineWidth: visualSettings.theme == .focusDeck ? 1.25 : 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(current == nil ? "No current NOW task" : "Current NOW task")
    }

    private func prioritySection(
        title: String,
        level: PriorityLevel,
        threads: [DeckThread],
        collapsed: Bool
    ) -> some View {
        let sectionContent = VStack(alignment: .leading, spacing: 0) {
            Button {
                model.apply(.setCollapsed(level: level, collapsed: !collapsed))
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: level == .focus ? "star.fill" : "bookmark")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(level == .focus ? Color.gajendraAccent(for: colorScheme) : Color.secondary)
                    Text(title)
                        .font(.subheadline.weight(level == .focus ? .bold : .semibold))
                    Text("\(threads.count)")
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: collapsed ? "chevron.right" : "chevron.down")
                        .font(.caption.bold())
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(10)
            .disabled(model.isLoading)
            .accessibilityLabel("\(title), \(threads.count) tasks")
            .accessibilityValue(collapsed ? "Collapsed" : "Expanded")

            if !collapsed {
                Group {
                    Divider()
                    if threads.isEmpty {
                        Text("No tasks in this section.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(10)
                    } else {
                        ForEach(Array(threads.enumerated()), id: \.element.id) { index, thread in
                            priorityRow(thread, level: level, index: index, count: threads.count)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                            if index < threads.count - 1 { Divider() }
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(sectionSurfaceColor(level))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(sectionBorderColor(level), lineWidth: 1)
        )
        return priorityDropSection(sectionContent, level: level)
    }

    private func priorityRow(_ thread: DeckThread, level: PriorityLevel, index: Int, count: Int) -> some View {
        let row = HStack(spacing: 8) {
            Button {
                model.open(thread)
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        if thread.isCurrent {
                            Text("NOW")
                                .font(.caption2.bold())
                                .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                        }
                        Text(thread.title)
                            .lineLimit(1)
                    }
                    Text(thread.project)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    sourceBadge(thread)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if level == .focus && !thread.isCurrent {
                Button("Make NOW") {
                    model.apply(.setCurrent(threadId: thread.id))
                }
                .controlSize(.small)
                .disabled(model.isLoading)
            }
            if isPreview {
                previewRowActions(index: index, count: count)
            } else {
                Button {
                    model.apply(.move(threadId: thread.id, direction: .up))
                } label: {
                    Image(systemName: "arrow.up")
                }
                .buttonStyle(.borderless)
                .disabled(index == 0 || model.isLoading)
                .help("Move up")
                .accessibilityLabel("Move \(thread.title) up")
                Button {
                    model.apply(.move(threadId: thread.id, direction: .down))
                } label: {
                    Image(systemName: "arrow.down")
                }
                .buttonStyle(.borderless)
                .disabled(index == count - 1 || model.isLoading)
                .help("Move down")
                .accessibilityLabel("Move \(thread.title) down")
                Menu {
                    if level == .focus {
                        Button("Move to Important") {
                            model.apply(.setLevel(threadId: thread.id, level: .important))
                        }
                    } else {
                        Button("Move to Focus") {
                            model.apply(.setLevel(threadId: thread.id, level: .focus))
                        }
                    }
                    Button("Remove", role: .destructive) {
                        model.apply(.setLevel(threadId: thread.id, level: nil))
                    }
                } label: {
                    Image(systemName: "ellipsis")
                }
                .menuIndicator(.hidden)
                .menuStyle(.borderlessButton)
                .frame(width: 30, height: 28)
                .contentShape(Rectangle())
                .disabled(model.isLoading)
                .accessibilityLabel("Actions for \(thread.title)")
            }
        }
        .padding(10)
        .background(thread.isCurrent ? nowSurfaceColor : Color.clear)
        return priorityDragRow(row, threadId: thread.id, level: level, before: thread.id)
    }

    private func previewRowActions(index: Int, count: Int) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "arrow.up")
                .opacity(index == 0 ? 0.35 : 1)
            Image(systemName: "arrow.down")
                .opacity(index == count - 1 ? 0.35 : 1)
            Image(systemName: "ellipsis")
                .frame(width: 30, height: 28)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private func availableSection(_ available: [DeckThread]) -> some View {
        let normalizedQuery = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let matches = available.filter { thread in
            normalizedQuery.isEmpty || thread.title.lowercased().contains(normalizedQuery) || thread.project.lowercased().contains(normalizedQuery) || thread.sourceName.lowercased().contains(normalizedQuery)
        }
        return VStack(alignment: .leading, spacing: 8) {
            Text("Add from recent threads")
                .font(.subheadline.weight(.semibold))
            if isPreview {
                Text("Search threads, projects, or agents")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 6))
            } else {
                TextField("Search threads, projects, or agents", text: $search)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Search recent AI-agent threads")
            }
            ForEach(Array(matches.prefix(8))) { thread in
                recentDragRow(HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(thread.title).lineLimit(1)
                        HStack(spacing: 6) {
                            if isPreview {
                                sourceBadge(thread)
                            } else {
                                Button { model.open(thread) } label: { sourceBadge(thread) }
                                    .buttonStyle(.plain)
                                    .help("Open in \(thread.sourceName)")
                            }
                            Text(thread.project)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Button("Important") {
                        model.apply(.setLevel(threadId: thread.id, level: .important))
                    }
                    .controlSize(.small)
                    .disabled(model.isLoading)
                    Button("Focus ✦✦") {
                        model.apply(.setLevel(threadId: thread.id, level: .focus))
                    }
                    .controlSize(.small)
                    .disabled(model.isLoading)
                }, threadId: thread.id)
                .padding(.vertical, 3)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            if matches.isEmpty {
                Text("No matching recent threads.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.primary.opacity(0.025))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.secondary.opacity(0.18), lineWidth: 1)
        )
        .animation(deckAnimation, value: matches.map(\.id))
    }

    private func errorBanner(_ error: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .accessibilityHidden(true)
            Text(error)
                .font(.caption)
                .textSelection(.enabled)
            Spacer()
        }
        .padding(10)
        .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Gaja error: \(error)")
    }

    private func sourceBadge(_ thread: DeckThread) -> some View {
        Text(thread.sourceName)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(providerColor(thread))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(providerColor(thread).opacity(colorScheme == .dark ? 0.18 : 0.1), in: Capsule())
            .overlay(Capsule().stroke(providerColor(thread).opacity(0.34), lineWidth: 0.75))
            .accessibilityLabel("Open in \(thread.sourceName)")
    }

    private func providerColor(_ thread: DeckThread) -> Color {
        switch thread.sourceId.lowercased() {
        case "codex": return colorScheme == .dark ? Color(red: 0.49, green: 0.78, blue: 0.96) : Color(red: 0.03, green: 0.36, blue: 0.6)
        case "claude": return colorScheme == .dark ? Color(red: 1, green: 0.63, blue: 0.34) : Color(red: 0.68, green: 0.27, blue: 0.06)
        case "cursor": return colorScheme == .dark ? Color(red: 0.76, green: 0.7, blue: 1) : Color(red: 0.35, green: 0.25, blue: 0.62)
        default: return .secondary
        }
    }

    private var organizerSurface: some View {
        Group {
            if visualSettings.theme == .focusDeck {
                Rectangle().fill(focusDeckField)
            } else {
                GajendraGlassSurface(cornerRadius: 0, castsShadow: false, theme: .nativePopover)
            }
        }
    }

    private var focusDeckField: Color {
        colorScheme == .dark
            ? Color(red: 0.055, green: 0.075, blue: 0.12)
            : Color(red: 0.965, green: 0.945, blue: 0.9)
    }

    private var nowSurfaceColor: Color {
        if visualSettings.theme == .focusDeck {
            return colorScheme == .dark
                ? Color.gajendraIndigoSoft.opacity(0.52)
                : Color.gajendraGold.opacity(0.16)
        }
        return Color.gajendraGold.opacity(colorScheme == .dark ? 0.12 : 0.09)
    }

    private var nowBorderColor: Color {
        Color.gajendraAccent(for: colorScheme).opacity(visualSettings.theme == .focusDeck ? 0.72 : 0.5)
    }

    private func sectionSurfaceColor(_ level: PriorityLevel) -> Color {
        guard visualSettings.theme == .focusDeck else { return Color.primary.opacity(0.035) }
        if level == .focus {
            return colorScheme == .dark ? Color.gajendraIndigoSoft.opacity(0.34) : Color.white.opacity(0.58)
        }
        return Color.primary.opacity(colorScheme == .dark ? 0.028 : 0.02)
    }

    private func sectionBorderColor(_ level: PriorityLevel) -> Color {
        if visualSettings.theme == .focusDeck && level == .focus {
            return Color.gajendraAccent(for: colorScheme).opacity(0.42)
        }
        return Color.secondary.opacity(0.22)
    }

    private func moveDroppedThread(_ threadId: String, to level: PriorityLevel, before targetId: String?) -> Bool {
        guard !model.isLoading, let snapshot = model.snapshot else { return false }
        let allThreads = snapshot.focus + snapshot.important + snapshot.available
        guard let thread = allThreads.first(where: { $0.id == threadId }) else { return false }
        let targetThreads = level == .focus ? snapshot.focus : snapshot.important

        if thread.level != level {
            model.apply(.setLevel(threadId: threadId, level: level))
            guard let targetId, let targetIndex = targetThreads.firstIndex(where: { $0.id == targetId }) else { return true }
            for _ in 0..<(targetThreads.count - targetIndex) {
                model.apply(.move(threadId: threadId, direction: .up))
            }
            return true
        }

        guard let sourceIndex = targetThreads.firstIndex(where: { $0.id == threadId }),
              let targetId,
              targetId != threadId,
              let targetIndex = targetThreads.firstIndex(where: { $0.id == targetId }) else { return true }
        if sourceIndex > targetIndex {
            for _ in 0..<(sourceIndex - targetIndex) {
                model.apply(.move(threadId: threadId, direction: .up))
            }
        } else {
            for _ in 0..<max(0, targetIndex - sourceIndex - 1) {
                model.apply(.move(threadId: threadId, direction: .down))
            }
        }
        return true
    }

    @ViewBuilder
    private func priorityDropSection<Content: View>(_ content: Content, level: PriorityLevel) -> some View {
        if isPreview {
            content
        } else {
            content.dropDestination(for: String.self) { identifiers, _ in
                guard let threadId = identifiers.first else { return false }
                return moveDroppedThread(threadId, to: level, before: nil)
            }
        }
    }

    @ViewBuilder
    private func priorityDragRow<Content: View>(
        _ content: Content,
        threadId: String,
        level: PriorityLevel,
        before targetId: String
    ) -> some View {
        if isPreview {
            content
        } else {
            content
                .draggable(threadId)
                .dropDestination(for: String.self) { identifiers, _ in
                    guard let droppedId = identifiers.first else { return false }
                    return moveDroppedThread(droppedId, to: level, before: targetId)
                }
        }
    }

    @ViewBuilder
    private func recentDragRow<Content: View>(_ content: Content, threadId: String) -> some View {
        if isPreview {
            content
        } else {
            content.draggable(threadId)
        }
    }

    private var footer: some View {
        HStack {
            Text("Local metadata only")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Spacer()
            if isPreview {
                Text("Quit")
                    .font(.caption)
            } else {
                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .buttonStyle(.borderless)
                .font(.caption)
            }
        }
    }
}
