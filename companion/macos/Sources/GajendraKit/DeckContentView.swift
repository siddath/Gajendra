import AppKit
import SwiftUI

public struct DeckContentView: View {
    @ObservedObject private var model: DeckViewModel
    @ObservedObject private var visualSettings: GajendraVisualSettings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var search = ""
    @State private var isNowHovered = false
    @State private var isSearchHovered = false
    @State private var isRunningHeaderHovered = false
    @State private var isRunningExpanded = true
    @State private var searchFocused = false
    private let usesScrollView: Bool
    private let isPreview: Bool
    private let onManageSources: () -> Void

    public init(
        model: DeckViewModel,
        visualSettings: GajendraVisualSettings,
        usesScrollView: Bool = true,
        isPreview: Bool = false,
        onManageSources: @escaping () -> Void = {}
    ) {
        self.model = model
        self.visualSettings = visualSettings
        self.usesScrollView = usesScrollView
        self.isPreview = isPreview
        self.onManageSources = onManageSources
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            if let error = model.errorMessage {
                errorBanner(error)
            }
            if let snapshot = model.snapshot {
                if usesScrollView {
                    ScrollViewReader { proxy in
                        ScrollView {
                            deckSections(snapshot)
                        }
                        .onChange(of: search) { value in
                            guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                            withAnimation(deckAnimation) {
                                proxy.scrollTo("gajendra-organizer-search-results", anchor: .top)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    deckSections(snapshot)
                }
                organizerSearchFooter(snapshot: snapshot)
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
        .frame(minWidth: usesScrollView ? 520 : 430, minHeight: 650, alignment: .topLeading)
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
        let running = snapshot.runningThreads
        let recent = snapshot.available.filter { !$0.isRunning }
        return VStack(alignment: .leading, spacing: 12) {
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
            runningSection(running)
            availableSection(snapshot: snapshot, recent: recent)
                .id("gajendra-organizer-search-results")
        }
    }

    private var header: some View {
        ZStack(alignment: .center) {
            VStack(alignment: .center, spacing: 1) {
                Text("Gaja")
                    .font(.headline)
                Text("Elephant Focus for AI Power Users")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, alignment: .center)

            HStack(spacing: 10) {
                GajendraMark(size: 34)
                    .frame(width: 42, height: 42)

                Spacer(minLength: 12)

                HStack(spacing: 5) {
                    if model.isLoading {
                        Text("Refreshing")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    refreshButton
                    if isPreview {
                        settingsIcon
                    } else {
                        visualSettingsMenu
                    }
                }
                .fixedSize()
            }
        }
        .frame(height: 42, alignment: .center)
    }

    private var visualSettingsMenu: some View {
        Menu {
            Button {
                onManageSources()
            } label: {
                Label("Connect AI Tools…", systemImage: "point.3.connected.trianglepath.dotted")
            }
            Divider()
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
            Divider()
            Picker("Hover card size", selection: $visualSettings.hoverCardSize) {
                ForEach(GajendraHoverCardSize.allCases) { size in
                    Text(size.title).tag(size)
                }
            }
            Divider()
            Picker("Lotus position", selection: $visualSettings.pillAnchor) {
                ForEach(GajendraPillAnchor.allCases) { anchor in
                    Text(anchor.title).tag(anchor)
                }
            }
        } label: {
            settingsIcon
        }
        .menuIndicator(.hidden)
        .menuStyle(.borderlessButton)
        .fixedSize()
        .help("Gaja settings")
        .accessibilityLabel("Open Gaja settings")
        .accessibilityHint("Connect AI tools or choose theme, appearance, card size, and lotus position")
    }

    private var settingsIcon: some View {
        Image(systemName: "gearshape")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(.secondary)
            .frame(width: 28, height: 28)
        .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
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
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack(spacing: 6) {
                            Text(current.project)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if let context = current.context {
                                contextBadge(context)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(spacing: 8) {
                        Button("Open thread") {
                            model.open(current)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.accentColor)
                        .keyboardShortcut(.return, modifiers: [])
                        .fixedSize()

                        executionSignal(current)

                        Button {
                            model.open(current)
                        } label: {
                            sourceBadge(current)
                        }
                        .buttonStyle(.plain)
                        .help("Open \(current.title) in \(current.sourceName)")
                    }
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
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(nowSurfaceColor)
                RoundedRectangle(cornerRadius: 12)
                    .fill(isNowHovered ? Color.primary.opacity(0.055) : Color.clear)
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(
                    isNowHovered ? Color.gajendraAccent(for: colorScheme).opacity(0.8) : nowBorderColor,
                    lineWidth: isNowHovered ? 1.5 : (visualSettings.theme == .focusDeck ? 1.25 : 1)
                )
        )
        .contentShape(RoundedRectangle(cornerRadius: 12))
        .onHover { isNowHovered = $0 }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isNowHovered)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(current == nil ? "No current NOW task" : "Current NOW task")
    }

    private func executionSignal(_ thread: DeckThread) -> some View {
        HStack(spacing: 7) {
            Image(systemName: thread.isRunning ? "waveform" : "clock")
                .font(.caption.weight(.semibold))
                .foregroundStyle(thread.isRunning ? Color.green : Color.secondary)
            VStack(alignment: .leading, spacing: 1) {
                Text(thread.isRunning ? "Running now" : "Ready to resume")
                    .font(.caption.weight(.semibold))
                Text(isPreview ? "Updated recently" : relativeUpdateText(thread.updatedAt))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(thread.isRunning ? Color.green.opacity(0.3) : Color.secondary.opacity(0.16), lineWidth: 0.75)
        )
        .fixedSize()
        .help("Provider status: \(thread.status)")
        .accessibilityElement(children: .combine)
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
                    HStack(spacing: 5) {
                        Text(thread.project)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        sourceBadge(thread)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            contextControl(thread)

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

    @ViewBuilder
    private func contextControl(_ thread: DeckThread) -> some View {
        if isPreview {
            if let context = thread.context {
                contextBadge(context)
            } else {
                Label("Add label", systemImage: "tag")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        } else {
            Menu {
                ForEach(ThreadContext.allCases) { context in
                    Button {
                        model.apply(.setContext(threadId: thread.id, context: context))
                    } label: {
                        Label(context.title, systemImage: thread.context == context ? "checkmark" : "circle")
                    }
                }
                if thread.context != nil {
                    Divider()
                    Button("Clear label") {
                        model.apply(.setContext(threadId: thread.id, context: nil))
                    }
                }
            } label: {
                if let context = thread.context {
                    contextBadge(context)
                } else {
                    Label("Add label", systemImage: "tag")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }
            .menuIndicator(.hidden)
            .menuStyle(.borderlessButton)
            .fixedSize()
            .disabled(model.isLoading)
            .help(thread.context == nil ? "Add Design, Engineering, or Life label" : "Change label")
            .accessibilityLabel(thread.context == nil ? "Add label to \(thread.title)" : "Change label for \(thread.title)")
        }
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

    private func runningSection(_ threads: [DeckThread]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if threads.isEmpty {
                runningSectionHeader(count: 0, expanded: false)
            } else {
                Button {
                    withAnimation(deckAnimation) {
                        isRunningExpanded.toggle()
                    }
                } label: {
                    runningSectionHeader(count: threads.count, expanded: isRunningExpanded)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .background(
                    isRunningHeaderHovered ? Color.green.opacity(colorScheme == .dark ? 0.1 : 0.07) : Color.clear,
                    in: RoundedRectangle(cornerRadius: 8)
                )
                .onHover { isRunningHeaderHovered = $0 }
                .accessibilityLabel("Running, \(threads.count) active threads")
                .accessibilityValue(isRunningExpanded ? "Expanded" : "Collapsed")
                .accessibilityHint(isRunningExpanded ? "Collapse the running thread list" : "Expand the running thread list")
            }

            Divider()

            if threads.isEmpty {
                Text("No provider reports active work.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(10)
            } else if isRunningExpanded {
                ForEach(Array(threads.enumerated()), id: \.element.id) { index, thread in
                    runningRow(thread)
                    if index < threads.count - 1 { Divider() }
                }
            } else {
                Text("\(threads.count) active threads across every priority lane")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(10)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.green.opacity(colorScheme == .dark ? 0.055 : 0.035))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.green.opacity(0.22), lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Running, \(threads.count) active threads across all priority lanes")
    }

    private func runningSectionHeader(count: Int, expanded: Bool) -> some View {
        HStack(spacing: 7) {
            Image(systemName: "waveform")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.green)
            Text("Running")
                .font(.subheadline.weight(.semibold))
            Text("\(count)")
                .font(.caption.monospacedDigit().weight(.semibold))
                .foregroundStyle(.secondary)
            Spacer()
            HStack(spacing: 5) {
                Text("All priority lanes")
                    .lineLimit(1)
                if count > 0 {
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.bold))
                        .rotationEffect(.degrees(expanded ? 0 : -90))
                        .accessibilityHidden(true)
                }
            }
            .font(.caption2.weight(.semibold))
            .foregroundStyle(count > 0 ? runningControlColor : Color.secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color.green.opacity(count > 0 ? 0.09 : 0.035), in: Capsule())
            .overlay(Capsule().stroke(Color.green.opacity(count > 0 ? 0.28 : 0.12), lineWidth: 0.75))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
    }

    private func runningRow(_ thread: DeckThread) -> some View {
        HStack(spacing: 8) {
            Button {
                model.open(thread)
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(thread.title).lineLimit(1)
                    HStack(spacing: 6) {
                        sourceBadge(thread)
                        Text(thread.project)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        if let placement = thread.placementLabel {
                            Text(placement)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Open in \(thread.sourceName)")

            if !thread.isCurrent {
                Button("Make NOW") {
                    model.apply(.setCurrent(threadId: thread.id))
                }
                .controlSize(.small)
                .disabled(model.isLoading)
            }
            if thread.level != .important {
                Button("Important") {
                    model.apply(.setLevel(threadId: thread.id, level: .important))
                }
                .controlSize(.small)
                .disabled(model.isLoading)
            }
            if thread.level != .focus {
                Button("Focus ✦✦") {
                    model.apply(.setLevel(threadId: thread.id, level: .focus))
                }
                .controlSize(.small)
                .disabled(model.isLoading)
            }
        }
        .padding(10)
    }

    private func availableSection(snapshot: DeckSnapshot, recent: [DeckThread]) -> some View {
        let normalizedQuery = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let matches = normalizedQuery.isEmpty ? recent : snapshot.searchThreads(search)
        return VStack(alignment: .leading, spacing: 8) {
            Text(normalizedQuery.isEmpty ? "Add from recent threads" : "Search every thread")
                .font(.subheadline.weight(.semibold))
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
                            if let placement = thread.placementLabel {
                                Text(placement)
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                            }
                        }
                    }
                    Spacer()
                    if !thread.isCurrent {
                        Button("Make NOW") {
                            model.apply(.setCurrent(threadId: thread.id))
                        }
                        .controlSize(.small)
                        .disabled(model.isLoading)
                    }
                    if thread.level != .important {
                        Button("Important") {
                            model.apply(.setLevel(threadId: thread.id, level: .important))
                        }
                        .controlSize(.small)
                        .disabled(model.isLoading)
                    }
                    if thread.level != .focus {
                        Button("Focus ✦✦") {
                            model.apply(.setLevel(threadId: thread.id, level: .focus))
                        }
                        .controlSize(.small)
                        .disabled(model.isLoading)
                    }
                    if thread.level != nil {
                        Button("Remove") {
                            model.apply(.setLevel(threadId: thread.id, level: nil))
                        }
                        .controlSize(.small)
                        .disabled(model.isLoading)
                    }
                }, threadId: thread.id)
                .padding(.vertical, 3)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            if matches.isEmpty {
                Text(normalizedQuery.isEmpty ? "Every recent thread is already organized." : "No matching threads.")
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

    @ViewBuilder
    private func organizerSearchField(snapshot: DeckSnapshot) -> some View {
        let isSearchActive = searchFocused || isSearchHovered
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.caption.weight(.semibold))
                .foregroundStyle(isSearchActive ? Color.gajendraAccent(for: colorScheme) : Color.secondary)
            if isPreview {
                Text(search.isEmpty ? "Search all \(snapshot.allThreads.count) threads" : search)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                GajendraSearchTextField(
                    text: $search,
                    isFocused: $searchFocused,
                    prompt: "Search all \(snapshot.allThreads.count) threads",
                    fontSize: NSFont.systemFontSize,
                    onFocusRequested: {},
                    onSubmit: {
                        guard let thread = snapshot.searchThreads(search).first else { return }
                        model.open(thread)
                    }
                )
                .frame(maxWidth: .infinity, minHeight: 22)
            }
            if !search.isEmpty && !isPreview {
                Button {
                    search = ""
                    searchFocused = true
                } label: {
                    Image(systemName: "xmark.circle.fill")
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .help("Clear thread search")
                .accessibilityLabel("Clear thread search")
            }
        }
        .padding(.horizontal, 11)
        .frame(maxWidth: .infinity, minHeight: 38)
        .background(Color.primary.opacity(isSearchActive ? 0.07 : 0.04), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .stroke(
                    isSearchActive ? Color.gajendraAccent(for: colorScheme).opacity(0.58) : Color.secondary.opacity(0.2),
                    lineWidth: isSearchActive ? 1 : 0.75
                )
        )
        .contentShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .onTapGesture {
            if !isPreview { searchFocused = true }
        }
        .onHover { isSearchHovered = $0 }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isSearchActive)
    }

    private func organizerSearchFooter(snapshot: DeckSnapshot) -> some View {
        VStack(spacing: 8) {
            Divider()
            organizerSearchField(snapshot: snapshot)
        }
        .padding(.top, 2)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("All-thread search footer")
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

    private func relativeUpdateText(_ timestamp: Double) -> String {
        guard timestamp > 0 else { return "Update time unavailable" }
        let elapsed = max(0, Date().timeIntervalSince1970 - timestamp)
        if elapsed < 60 { return "Updated just now" }
        if elapsed < 3_600 { return "Updated \(Int(elapsed / 60))m ago" }
        if elapsed < 86_400 { return "Updated \(Int(elapsed / 3_600))h ago" }
        return "Updated \(Int(elapsed / 86_400))d ago"
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

    private func contextBadge(_ context: ThreadContext) -> some View {
        Text(context.title)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(contextColor(context))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(contextColor(context).opacity(colorScheme == .dark ? 0.18 : 0.1), in: Capsule())
            .overlay(Capsule().stroke(contextColor(context).opacity(0.36), lineWidth: 0.75))
            .accessibilityLabel("Context: \(context.title)")
    }

    private func contextColor(_ context: ThreadContext) -> Color {
        switch context {
        case .design:
            return colorScheme == .dark ? Color(red: 0.57, green: 0.73, blue: 1) : Color(red: 0.16, green: 0.36, blue: 0.67)
        case .engineering:
            return colorScheme == .dark ? Color(red: 0.47, green: 0.84, blue: 0.69) : Color(red: 0.11, green: 0.42, blue: 0.31)
        case .life:
            return colorScheme == .dark ? Color(red: 0.94, green: 0.64, blue: 0.77) : Color(red: 0.55, green: 0.25, blue: 0.38)
        }
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

    private var runningControlColor: Color {
        colorScheme == .dark
            ? Color(red: 0.38, green: 0.9, blue: 0.54)
            : Color(red: 0.04, green: 0.39, blue: 0.16)
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
