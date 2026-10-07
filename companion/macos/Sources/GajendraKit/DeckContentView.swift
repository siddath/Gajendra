import AppKit
import SwiftUI

private struct GajendraOrganizerTaskFramePreferenceKey: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, newest in newest })
    }
}

private struct GajendraOrganizerSectionFramePreferenceKey: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, newest in newest })
    }
}

private enum GajendraHistoryFilter: String, CaseIterable, Identifiable {
    case all
    case reviewed
    case finished

    var id: String { rawValue }
    var title: String { rawValue.capitalized }

    func includes(_ thread: DeckThread) -> Bool {
        switch self {
        case .all: return true
        case .reviewed: return thread.reviewAcknowledged
        case .finished: return thread.workState == "completed"
        }
    }
}

public struct DeckContentView: View {
    @ObservedObject private var model: DeckViewModel
    @ObservedObject private var visualSettings: GajendraVisualSettings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var search = ""
    @State private var historyFilter: GajendraHistoryFilter = .all
    @State private var historyVisibleCount = 8
    @State private var isNowHovered = false
    @State private var isSearchHovered = false
    @State private var isRunningExpanded = true
    @State private var isReviewExpanded = true
    @State private var searchFocused = false
    @State private var organizerTaskFrames: [String: CGRect] = [:]
    @State private var organizerSectionFrames: [String: CGRect] = [:]
    @State private var organizerDraggingThreadId: String?
    @State private var organizerTargetThreadId: String?
    @State private var organizerTargetLevel: PriorityLevel?
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
                errorBanner(
                    error,
                    offersRetry: model.canRetryReview,
                    offersReconnect: model.mutationErrorMessage == nil && hasUnavailableSource
                )
            }
            if model.pendingReviewCount > 0 || model.reviewFeedback != nil {
                reviewFeedbackBanner
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
                    Text("Gajendra is unavailable")
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
        .coordinateSpace(name: "gajendra-organizer")
        .onPreferenceChange(GajendraOrganizerTaskFramePreferenceKey.self) { frames in
            DispatchQueue.main.async {
                if organizerTaskFrames != frames { organizerTaskFrames = frames }
            }
        }
        .onPreferenceChange(GajendraOrganizerSectionFramePreferenceKey.self) { frames in
            DispatchQueue.main.async {
                if organizerSectionFrames != frames { organizerSectionFrames = frames }
            }
        }
        .animation(deckAnimation, value: model.errorMessage)
    }

    private var deckAnimation: Animation? {
        reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.86)
    }

    private var hasUnavailableSource: Bool {
        model.clientErrorMessage != nil
            || model.snapshot?.error != nil
            || model.snapshot?.sources.contains(where: { $0.enabled && $0.state != "ready" }) == true
    }

    private var reviewFeedbackBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: model.pendingReviewCount > 0 ? "clock" : "checkmark.circle.fill")
                .foregroundStyle(model.pendingReviewCount > 0 ? Color.secondary : Color.green)
                .accessibilityHidden(true)
            Text(model.pendingReviewCount > 0
                 ? (model.pendingReviewCount == 1 ? "Saving review…" : "Saving \(model.pendingReviewCount) reviews…")
                 : (model.reviewFeedback ?? "Review update"))
                .font(.caption)
            Spacer()
            if model.canUndoReview {
                Button("Undo review") { model.undo() }
                    .buttonStyle(.borderless)
                    .help("Restore this response to Ready for Review")
                    .accessibilityLabel("Undo review acknowledgement")
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Review acknowledgement status")
    }

    private func deckSections(_ snapshot: DeckSnapshot) -> some View {
        let running = snapshot.runningThreads
        let reviewReady = snapshot.reviewReadyThreads
        let recent = snapshot.historyThreads
        return VStack(alignment: .leading, spacing: 12) {
            sourceStrip(snapshot.sources)
            nowCard(snapshot.current)
            reviewSection(reviewReady)
            if !snapshot.needsInputThreads.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Needs input").font(.headline)
                    ForEach(snapshot.needsInputThreads) { thread in
                        Button { model.open(thread) } label: {
                            GajendraRecordTitle(title: thread.title)
                        }.buttonStyle(.gajendraPress).gajendraHoverFeedback()
                    }
                }
            }
            runningSection(running)
            Text("Your priorities").font(.headline)
                .frame(maxWidth: .infinity, alignment: .center).padding(.top, 8)
            prioritySection(
                title: "Focus",
                level: .focus,
                threads: snapshot.continueThreads.filter { $0.level == .focus && !$0.isCurrent },
                collapsed: snapshot.collapsed.focus
            )
            prioritySection(
                title: "Important",
                level: .important,
                threads: snapshot.continueThreads.filter { $0.level == .important },
                collapsed: snapshot.collapsed.important
            )
            availableSection(snapshot: snapshot, recent: recent)
                .id("gajendra-organizer-search-results")
        }
    }

    private var header: some View {
        ZStack(alignment: .center) {
            VStack(alignment: .center, spacing: 1) {
                Text(GajendraBrandCopy.name)
                    .font(.headline)
                Text(GajendraBrandCopy.descriptor)
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
                    if model.isMutating {
                        HStack(spacing: 4) {
                            ProgressView()
                                .controlSize(.mini)
                            Text("Saving…")
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Saving Gajendra change")
                        .accessibilityValue("Busy")
                    } else if model.isLoading {
                        Text("Refreshing")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .accessibilityLabel("Refreshing Gajendra")
                            .accessibilityValue("Busy")
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

    @State private var showsLayoutControls = false

    private var visualSettingsMenu: some View {
        Button { showsLayoutControls = true } label: { settingsIcon }
            .buttonStyle(.gajendraPress)
            .popover(isPresented: $showsLayoutControls) {
                GajendraWidgetLayoutControls(settings: visualSettings, onManageSources: onManageSources)
            }
            .help("Gajendra settings")
            .accessibilityLabel("Open Gajendra settings")
            .accessibilityHint("Manage AI tools or choose theme, appearance, task layout, widget size, and lotus position")
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
                        .buttonStyle(.gajendraPress)
                        .opacity(source.enabled ? 1 : 0.58)
                        .disabled(model.isLoading)
                        .help(source.sanitizedDetail)
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
            .accessibilityLabel(model.isLoading ? "Refreshing Gajendra" : "Refresh Gajendra")
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
                        HStack(alignment: .firstTextBaseline, spacing: 7) {
                            GajendraRecordTitle(title: current.title, font: .title3, lineLimit: 2)
                                .environment(\.gajendraHovered, isNowHovered)
                                .multilineTextAlignment(.leading)
                        }
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

                        if isPreview { Text("More").font(.caption).foregroundStyle(.secondary) }
                        else { GajendraWorkActions(model: model, thread: current) }

                        Button {
                            model.open(current)
                        } label: {
                            sourceBadge(current)
                        }
                        .buttonStyle(.gajendraPress)
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
            if thread.isRunning {
                GajendraLiveActivityMark()
            } else if thread.isReadyForReview {
                GajendraReviewStatusMark()
            } else {
                Image(systemName: "clock")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(thread.isRunning ? "Running now" : thread.isReadyForReview ? "Ready for Review" : "Ready to resume")
                    .font(.caption.weight(.semibold))
                Text(isPreview
                     ? (thread.isReadyForReview ? "Ready recently" : "Updated recently")
                     : thread.isReadyForReview
                        ? relativeReviewText(thread.review?.updatedAt ?? 0)
                        : relativeUpdateText(thread.updatedAt))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(
                    thread.isRunning
                        ? Color.green.opacity(0.3)
                        : thread.isReadyForReview ? Color.orange.opacity(0.34) : Color.secondary.opacity(0.16),
                    lineWidth: 0.75
                )
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
                    GajendraHoverIcon(kind: level == .focus ? .focus : .important,
                        tint: Color.gajendraAccent(for: colorScheme))
                    Text(title)
                        .font(.subheadline.weight(.semibold))
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
            .buttonStyle(.gajendraPress)
            .padding(10)
            .gajendraHoverFeedback(tint: Color.gajendraAccent(for: colorScheme))
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

        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(
                    organizerDraggingThreadId != nil && organizerTargetLevel == level
                        ? Color.gajendraAccent(for: colorScheme).opacity(0.82)
                        : Color.clear,
                    lineWidth: organizerDraggingThreadId != nil && organizerTargetLevel == level ? 1.5 : 1
                )
        )
        .animation(deckAnimation, value: threads.map(\.id))
        .background {
            if !isPreview {
                GeometryReader { proxy in
                    Color.clear.preference(
                        key: GajendraOrganizerSectionFramePreferenceKey.self,
                        value: [level.rawValue: proxy.frame(in: .named("gajendra-organizer"))]
                    )
                }
            }
        }
        return sectionContent
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
                        if thread.isRunning {
                            GajendraLiveActivityMark()
                        }
                        GajendraRecordTitle(title: thread.title)
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
            .buttonStyle(.gajendraPress)

            contextControl(thread)

            if !isPreview {
                queueDragHandle(thread)
            }

            if level == .focus && !thread.isCurrent {
                Button("Make NOW") {
                    model.makeNow(threadId: thread.id)
                }
                .controlSize(.small)
                .disabled(model.isLoading)
            }
            if isPreview {
                previewRowActions(index: index, count: count, allowsLaneActions: !thread.isCurrent)
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
                if !isPreview { GajendraWorkActions(model: model, thread: thread) }
                if !thread.isCurrent {
                    Menu {
                        if level == .focus {
                            Button("Move to Important") {
                                model.moveToLevel(threadId: thread.id, level: .important)
                            }
                        } else {
                            Button("Move to Focus") {
                                model.moveToLevel(threadId: thread.id, level: .focus)
                            }
                        }
                        Button("Remove", role: .destructive) {
                            model.moveToLevel(threadId: thread.id, level: nil)
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
        }
        .padding(10)
        .gajendraHoverFeedback()
        .background(
            organizerTargetThreadId == thread.id
                ? Color.gajendraAccent(for: colorScheme).opacity(0.11)
                : (thread.isCurrent ? nowSurfaceColor : Color.clear)
        )
        .background {
            if !isPreview {
                GeometryReader { proxy in
                    Color.clear.preference(
                        key: GajendraOrganizerTaskFramePreferenceKey.self,
                        value: [thread.id: proxy.frame(in: .named("gajendra-organizer"))]
                    )
                }
            }
        }
        return row
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

    private func previewRowActions(index: Int, count: Int, allowsLaneActions: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "arrow.up")
                .opacity(index == 0 ? 0.35 : 1)
            Image(systemName: "arrow.down")
                .opacity(index == count - 1 ? 0.35 : 1)
            if allowsLaneActions {
                Image(systemName: "ellipsis")
                    .frame(width: 30, height: 28)
            } else {
                Color.clear
                    .frame(width: 30, height: 28)
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private func runningSection(_ threads: [DeckThread]) -> some View {
        let dockValue = isRunningExpanded ? "Expanded" : "Collapsed"
        let dockAction = isRunningExpanded ? "collapse" : "expand"
        let dockSizeAction = isRunningExpanded ? "shrink" : "expand"
        let dockLabel = "Running, \(threads.count) active threads across all priority lanes"
        let dockHint = "Double-click the dock or click All priority lanes to \(dockAction) the running thread list"

        return LazyVStack(alignment: .leading, spacing: 0) {
            if threads.isEmpty {
                HStack(spacing: 0) {
                    runningSectionHeader(count: 0)
                    runningSectionControl(count: 0, expanded: false)
                        .padding(.trailing, 10)
                }
                .gajendraHoverFeedback(tint: runningControlColor)
            } else {
                HStack(spacing: 0) {
                    runningSectionHeader(count: threads.count)
                        .contentShape(Rectangle())
                        .onTapGesture(count: 2) {
                            toggleRunningDock()
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityAddTraits(.isButton)
                        .accessibilityAction {
                            toggleRunningDock()
                        }
                        .accessibilityLabel(dockLabel)
                        .accessibilityValue(dockValue)
                        .accessibilityHint(dockHint)
                        .help("Double-click to \(dockSizeAction) Running")
                    runningSectionControl(count: threads.count, expanded: isRunningExpanded)
                        .padding(.trailing, 10)
                }
                .gajendraHoverFeedback(tint: runningControlColor)
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

        .accessibilityElement(children: .contain)
    }

    private func toggleRunningDock() {
        withAnimation(deckAnimation) {
            isRunningExpanded.toggle()
        }
    }

    private func runningSectionHeader(count: Int) -> some View {
        HStack(spacing: 7) {
            GajendraHoverIcon(kind: .running, tint: runningControlColor)
            Text("Running")
                .font(.subheadline.weight(.semibold))
            GajendraStatusCountBadge(count: count, tint: .green)
            Spacer()
        }
        .frame(maxWidth: .infinity, minHeight: 34, alignment: .leading)
        .padding(10)
    }

    private func runningSectionControl(count: Int, expanded: Bool) -> some View {
        Button {
            guard count > 0 else { return }
            toggleRunningDock()
        } label: {
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
            .contentShape(Capsule())
        }
        .buttonStyle(.gajendraPress)
        .disabled(count == 0)
        .accessibilityLabel("All priority lanes, Running in Organizer")
        .accessibilityValue(expanded ? "Expanded" : "Collapsed")
        .accessibilityHint("Click to \(expanded ? "collapse" : "expand") the running thread list")
        .help("Click to \(expanded ? "shrink" : "expand") Running")
    }

    private func runningRow(_ thread: DeckThread) -> some View {
        HStack(spacing: 8) {
            GajendraLiveActivityMark(animated: true)
            Button {
                model.open(thread)
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    GajendraRecordTitle(title: thread.title)
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
            .buttonStyle(.gajendraPress)
            .help("Open in \(thread.sourceName)")

            if !thread.isCurrent {
                Button("Make NOW") {
                    model.makeNow(threadId: thread.id)
                }
                .controlSize(.small)
                .disabled(model.isLoading)
            }
            if !thread.isCurrent {
                if thread.level != .important {
                    Button("Important") {
                        model.moveToLevel(threadId: thread.id, level: .important)
                    }
                    .controlSize(.small)
                    .disabled(model.isLoading)
                }
                if thread.level != .focus {
                    Button("Focus") {
                        model.moveToLevel(threadId: thread.id, level: .focus)
                    }
                    .controlSize(.small)
                    .disabled(model.isLoading)
                }
            }
        }
        .padding(10)
        .gajendraHoverFeedback(tint: runningControlColor)
    }

    private func reviewSection(_ threads: [DeckThread]) -> some View {
        LazyVStack(alignment: .leading, spacing: 0) {
            if threads.isEmpty {
                reviewSectionHeader(count: 0, expanded: false)
            } else {
                reviewSectionHeader(count: threads.count, expanded: isReviewExpanded)
                .contentShape(Rectangle())
                .onTapGesture(count: 2) {
                    toggleReviewDock()
                }
                .accessibilityElement(children: .ignore)
                .accessibilityAddTraits(.isButton)
                .accessibilityAction {
                    toggleReviewDock()
                }
                .accessibilityLabel(
                    "Ready for Review, \(threads.count) \(threads.count == 1 ? "thread" : "threads") needing human attention"
                )
                .accessibilityValue(isReviewExpanded ? "Expanded" : "Collapsed")
                .accessibilityHint("Double-click to \(isReviewExpanded ? "collapse" : "expand") the review-ready thread list")
                .help("Double-click to \(isReviewExpanded ? "shrink" : "expand") Ready for Review")
            }

            Divider()

            if threads.isEmpty {
                Text("No provider reports work ready for review.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(10)
            } else if isReviewExpanded {
                ForEach(Array(threads.enumerated()), id: \.element.id) { index, thread in
                    reviewRow(thread)
                    if index < threads.count - 1 { Divider() }
                }
            } else {
                Text(
                    threads.count == 1
                        ? "1 thread needs your review"
                        : "\(threads.count) threads need your review"
                )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(10)
            }
        }

        .accessibilityElement(children: .contain)
    }

    private func toggleReviewDock() {
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) {
            isReviewExpanded.toggle()
        }
    }

    private func reviewSectionHeader(count: Int, expanded: Bool) -> some View {
        HStack(spacing: 7) {
            GajendraHoverIcon(kind: .review, tint: reviewControlColor)
            Text("Ready for Review")
                .font(.subheadline.weight(.semibold))
            GajendraStatusCountBadge(count: count, tint: .orange)
            Spacer()
            HStack(spacing: 5) {
                Text("Needs your review")
                    .lineLimit(1)
                if count > 0 {
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.bold))
                        .rotationEffect(.degrees(expanded ? 0 : -90))
                        .accessibilityHidden(true)
                }
            }
            .font(.caption2.weight(.semibold))
            .foregroundStyle(count > 0 ? reviewControlColor : Color.secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
        }
        .frame(maxWidth: .infinity, minHeight: 34, alignment: .leading)
        .padding(10)
        .gajendraHoverFeedback(tint: reviewControlColor)
    }

    private func reviewRow(_ thread: DeckThread) -> some View {
        HStack(spacing: 8) {
            GajendraReviewStatusMark()
            Button {
                model.openReview(thread)
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    GajendraRecordTitle(title: thread.title)
                    HStack(spacing: 6) {
                        Text(isPreview ? "Ready recently" : relativeReviewText(thread.review?.updatedAt ?? 0)).lineLimit(1)
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
            .buttonStyle(.gajendraPress)
            .help("Open \(thread.review?.destination.actionLabel.lowercased() ?? "review") for \(thread.title)")
            .accessibilityLabel("\(thread.title), Ready for Review, \(thread.review?.destination.actionLabel ?? "Review") destination")

            Button {
                model.setReviewAcknowledged(thread, acknowledged: true)
            } label: {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(runningControlColor)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.gajendraPress)
            .disabled(isPreview || !model.canAcknowledgeReviews || model.isReviewPending(thread))
            .help("Mark this exact response reviewed")
            .accessibilityIdentifier("gajendra-organizer-review-done")
            .accessibilityLabel("Mark \(thread.title) reviewed")
            .accessibilityHint("Removes only this response from Ready for Review. Priority is unchanged.")

            if !isPreview { GajendraWorkActions(model: model, thread: thread) }
            Button { model.open(thread) } label: { sourceBadge(thread) }
                .buttonStyle(.gajendraPress)
                .help("Open the owning task in \(thread.sourceName)")
        }
        .padding(10)
        .gajendraHoverFeedback(tint: reviewControlColor)
    }

    private func availableSection(snapshot: DeckSnapshot, recent: [DeckThread]) -> some View {
        let normalizedQuery = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let matches = normalizedQuery.isEmpty
            ? recent.filter { historyFilter.includes($0) && (historyFilter != .reviewed || !model.isReviewPending($0)) }
            : snapshot.searchThreads(search)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(normalizedQuery.isEmpty ? "History" : "Search every thread")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if normalizedQuery.isEmpty {
                    Picker("History filter", selection: $historyFilter) {
                        ForEach(GajendraHistoryFilter.allCases) { filter in
                            Text(filter.title).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)
                    .controlSize(.small)
                    .labelsHidden()
                    .frame(maxWidth: 250)
                    .accessibilityLabel("Filter History")
                }
            }
            ForEach(Array(matches.prefix(historyVisibleCount))) { thread in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Button { model.open(thread) } label: {
                            GajendraRecordTitle(title: thread.title)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.gajendraPress)
                        .help("Open \(thread.title) in \(thread.sourceName)")
                        .accessibilityLabel("Open \(thread.title) in \(thread.sourceName)")
                        HStack(spacing: 6) {
                            if isPreview {
                                sourceBadge(thread)
                            } else {
                                Button { model.open(thread) } label: { sourceBadge(thread) }
                                    .buttonStyle(.gajendraPress)
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
                            if normalizedQuery.isEmpty {
                                Text(model.isReviewPending(thread) ? "Saving review…" : thread.historyStatus)
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(Color.secondary)
                            }
                        }
                        historyContinuity(thread, snapshot: snapshot)
                    }
                    Spacer()
                    if !thread.isCurrent && thread.workState != "completed" && thread.currentThreadId == thread.id {
                        Button("Make NOW") {
                            model.makeNow(threadId: thread.id)
                        }
                        .controlSize(.small)
                        .disabled(model.isLoading)
                    }
                    if !thread.isCurrent && thread.workState != "completed" && thread.currentThreadId == thread.id {
                        if thread.level != .important {
                            Button("Important") {
                                model.moveToLevel(threadId: thread.id, level: .important)
                            }
                            .controlSize(.small)
                            .disabled(model.isLoading)
                        }
                        if thread.level != .focus {
                            Button("Focus") {
                                model.moveToLevel(threadId: thread.id, level: .focus)
                            }
                            .controlSize(.small)
                            .disabled(model.isLoading)
                        }
                        if thread.level != nil {
                            Button("Remove") {
                                model.moveToLevel(threadId: thread.id, level: nil)
                            }
                            .controlSize(.small)
                            .disabled(model.isLoading)
                        }
                    }
                    if !isPreview { GajendraWorkActions(model: model, thread: thread) }
                    if !isPreview {
                        queueDragHandle(thread)
                    }
                }
                .padding(.vertical, 3)
                .gajendraHoverFeedback()
                .background {
                    if !isPreview {
                        GeometryReader { proxy in
                            Color.clear.preference(
                                key: GajendraOrganizerTaskFramePreferenceKey.self,
                                value: [thread.id: proxy.frame(in: .named("gajendra-organizer"))]
                            )
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            if matches.count > historyVisibleCount {
                Button("Show \(min(8, matches.count - historyVisibleCount)) more") { historyVisibleCount += 8 }
                    .buttonStyle(.gajendraPress)
                    .font(.caption.weight(.medium))
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            if matches.isEmpty {
                Text(historyEmptyMessage(query: normalizedQuery))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)

        .onChange(of: historyFilter) { _ in historyVisibleCount = 8 }
        .onChange(of: search) { _ in historyVisibleCount = 8 }
        .animation(deckAnimation, value: matches.map(\.id))
    }

    private func historyEmptyMessage(query: String) -> String {
        guard query.isEmpty else { return "No matching threads." }
        switch historyFilter {
        case .all: return "No earlier work to show."
        case .reviewed: return "No reviewed responses in History."
        case .finished: return "No finished work in History."
        }
    }

    @ViewBuilder
    private func historyContinuity(_ thread: DeckThread, snapshot: DeckSnapshot) -> some View {
        let threadsById = Dictionary(uniqueKeysWithValues: snapshot.allThreads.map { ($0.id, $0) })
        if !thread.predecessorThreadIds.isEmpty || thread.currentThreadId != thread.id {
            VStack(alignment: .leading, spacing: 2) {
                if !thread.predecessorThreadIds.isEmpty {
                    HStack(spacing: 4) {
                        Text("Continued from")
                        ForEach(Array(thread.predecessorThreadIds.enumerated()), id: \.element) { index, threadId in
                            if let predecessor = threadsById[threadId] {
                                if index > 0 { Text("·") }
                                Button(predecessor.title) { model.open(predecessor) }
                                    .buttonStyle(.gajendraPress)
                                    .foregroundStyle(Color.accentColor)
                                    .underline()
                                    .help("Open earlier chat \(predecessor.title)")
                            } else {
                                Text("Earlier chat unavailable")
                            }
                        }
                    }
                }
                if thread.currentThreadId != thread.id {
                    if let current = threadsById[thread.currentThreadId] {
                        HStack(spacing: 4) {
                            Text("Continued as")
                            Button(current.title) { model.open(current) }
                                .buttonStyle(.gajendraPress)
                                .foregroundStyle(Color.accentColor)
                                .underline()
                                .help("Open current continuation \(current.title)")
                        }
                    } else {
                        Text("Current continuation unavailable")
                    }
                }
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
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
                .buttonStyle(.gajendraPress)
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

    private func errorBanner(_ error: String, offersRetry: Bool, offersReconnect: Bool) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .accessibilityHidden(true)
            Text(error)
                .font(.caption)
                .textSelection(.enabled)
            Spacer()
            if offersRetry {
                Button("Retry review") { model.retryReviewAcknowledgement() }
                    .buttonStyle(.borderless)
                    .help("Retry saving this review acknowledgement")
            } else if offersReconnect {
                Button("Reconnect", action: onManageSources)
                    .buttonStyle(.borderless)
                    .help("Manage AI tool connections")
            }
        }
        .padding(10)
        .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Gajendra error: \(error)")
    }

    private func relativeUpdateText(_ timestamp: Double) -> String {
        guard timestamp > 0 else { return "Update time unavailable" }
        let elapsed = max(0, Date().timeIntervalSince1970 - timestamp)
        if elapsed < 60 { return "Updated just now" }
        if elapsed < 3_600 { return "Updated \(Int(elapsed / 60))m ago" }
        if elapsed < 86_400 { return "Updated \(Int(elapsed / 3_600))h ago" }
        return "Updated \(Int(elapsed / 86_400))d ago"
    }

    private func relativeReviewText(_ timestamp: Double) -> String {
        relativeUpdateText(timestamp).replacingOccurrences(of: "Updated", with: "Ready")
    }

    private func sourceBadge(_ thread: DeckThread) -> some View {
        Text(thread.sourceName)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .accessibilityLabel("Open in \(thread.sourceName)")
    }

    private func contextBadge(_ context: ThreadContext) -> some View {
        Text(context.title)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
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

    private var reviewControlColor: Color {
        colorScheme == .dark
            ? Color(red: 1, green: 0.67, blue: 0.24)
            : Color(red: 0.63, green: 0.29, blue: 0.02)
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

    private func moveOrganizerThread(_ threadId: String, to level: PriorityLevel, before targetId: String?) -> Bool {
        if threadId == targetId { return true }
        guard !model.isLoading,
              let snapshot = model.snapshot,
              snapshot.current?.id != threadId || level == .focus,
              !(targetId == nil
                && snapshot.allThreads.first(where: { $0.id == threadId })?.level == level
                && GajendraQueueMovePlanner.lane(for: level, snapshot: snapshot).last?.id == threadId) else { return false }
        model.moveToLevel(
            threadId: threadId,
            level: level,
            beforeThreadId: targetId,
            actionName: "Move priority"
        )
        return true
    }

    private func queueDragHandle(_ thread: DeckThread) -> some View {
        Image(systemName: "line.3.horizontal")
            .font(.caption.weight(.semibold))
            .foregroundStyle(
                organizerDraggingThreadId == thread.id
                    ? Color.gajendraAccent(for: colorScheme)
                    : Color.secondary
            )
            .frame(width: 28, height: 28)
            .contentShape(Rectangle())
            .highPriorityGesture(
                DragGesture(minimumDistance: 3, coordinateSpace: .named("gajendra-organizer"))
                    .onChanged { value in
                        guard !model.isLoading else { return }
                        organizerDraggingThreadId = thread.id
                        updateOrganizerDropTarget(at: value.location, sourceThreadId: thread.id)
                    }
                    .onEnded { value in
                        finishOrganizerDrag(threadId: thread.id, at: value.location)
                    }
            )
            .disabled(model.isLoading)
            .help(
                thread.isCurrent
                    ? "Drag \(thread.title) within Focus. Make another task NOW before changing its lane."
                    : "Drag \(thread.title) to reorder or move priority lanes"
            )
            .accessibilityLabel("Drag \(thread.title)")
            .accessibilityValue(model.isLoading ? "Busy; unavailable" : "Ready")
            .accessibilityHint("Drag with the pointer. Use the row actions for keyboard or VoiceOver moves.")
            .accessibilityAddTraits(.isButton)
    }

    private func updateOrganizerDropTarget(at point: CGPoint, sourceThreadId: String) {
        let sourceIsCurrent = model.snapshot?.current?.id == sourceThreadId
        if organizerTaskFrames[sourceThreadId]?.contains(point) == true {
            organizerTargetThreadId = nil
            organizerTargetLevel = nil
            return
        }
        if let target = organizerTaskFrames.first(where: {
            $0.key != sourceThreadId && $0.value.contains(point)
        }), let level = model.snapshot?.allThreads.first(where: { $0.id == target.key })?.level {
            guard !sourceIsCurrent || level == .focus else {
                organizerTargetThreadId = nil
                organizerTargetLevel = nil
                return
            }
            organizerTargetThreadId = target.key
            organizerTargetLevel = level
            return
        }
        if let section = organizerSectionFrames.first(where: { $0.value.contains(point) }),
           let level = PriorityLevel(rawValue: section.key) {
            guard !sourceIsCurrent || level == .focus else {
                organizerTargetThreadId = nil
                organizerTargetLevel = nil
                return
            }
            organizerTargetThreadId = nil
            organizerTargetLevel = level
            return
        }
        organizerTargetThreadId = nil
        organizerTargetLevel = nil
    }

    private func finishOrganizerDrag(threadId: String, at point: CGPoint) {
        updateOrganizerDropTarget(at: point, sourceThreadId: threadId)
        let targetLevel = organizerTargetLevel
        let targetThreadId = organizerTargetThreadId
        organizerDraggingThreadId = nil
        organizerTargetThreadId = nil
        organizerTargetLevel = nil
        guard let targetLevel else { return }
        _ = moveOrganizerThread(threadId, to: targetLevel, before: targetThreadId)
    }

    private var footer: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(GajendraBrandCopy.promise)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                if let savedAt = model.snapshot?.cachedAt {
                    Text("Saved view · " + savedAt).font(.caption2).foregroundStyle(.secondary)
                }
                Text("Local metadata only")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            if model.errorMessage != nil { Button("Reconnect", action: onManageSources) }
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
