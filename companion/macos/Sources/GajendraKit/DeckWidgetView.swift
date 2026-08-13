import SwiftUI

public enum GajendraOverlayPlacement {
    public static func bottomTrailingOrigin(
        windowSize: CGSize,
        visibleFrame: CGRect,
        margin: CGFloat = 18
    ) -> CGPoint {
        CGPoint(
            x: visibleFrame.maxX - windowSize.width - margin,
            y: visibleFrame.minY + margin
        )
    }

    public static func cardOrigin(
        cardSize: CGSize,
        pillFrame: CGRect,
        visibleFrame: CGRect,
        gap: CGFloat = 10,
        edgeMargin: CGFloat = 12
    ) -> CGPoint {
        let desiredX = pillFrame.maxX - cardSize.width
        let minimumX = visibleFrame.minX + edgeMargin
        let maximumX = visibleFrame.maxX - cardSize.width - edgeMargin
        let clampedX = min(max(desiredX, minimumX), maximumX)
        let desiredY = pillFrame.maxY + gap
        let maximumY = visibleFrame.maxY - cardSize.height - edgeMargin
        return CGPoint(x: clampedX, y: min(desiredY, maximumY))
    }

    public static func clampedOrigin(
        windowSize: CGSize,
        proposedOrigin: CGPoint,
        visibleFrame: CGRect,
        margin: CGFloat = 8
    ) -> CGPoint {
        CGPoint(
            x: min(max(proposedOrigin.x, visibleFrame.minX + margin), visibleFrame.maxX - windowSize.width - margin),
            y: min(max(proposedOrigin.y, visibleFrame.minY + margin), visibleFrame.maxY - windowSize.height - margin)
        )
    }
}

public struct GajendraHoverState: Equatable, Sendable {
    public private(set) var pillHovered = false
    public private(set) var cardHovered = false

    public init() {}

    public var wantsCardVisible: Bool { pillHovered || cardHovered }

    @discardableResult
    public mutating func setPillHovered(_ hovered: Bool) -> Bool {
        let entered = hovered && !pillHovered
        pillHovered = hovered
        return entered
    }

    public mutating func setCardHovered(_ hovered: Bool) {
        cardHovered = hovered
    }
}

public struct GajendraPillEditState: Equatable, Sendable {
    public private(set) var isEditing = false

    public init() {}

    public var acceptsDrag: Bool { isEditing }

    public mutating func enter() {
        isEditing = true
    }

    public mutating func exit() {
        isEditing = false
    }

    @discardableResult
    public mutating func requestHide() -> Bool {
        guard isEditing else { return false }
        isEditing = false
        return true
    }
}

public struct GajendraMark: View {
    @Environment(\.colorScheme) private var colorScheme
    private let size: CGFloat

    public init(size: CGFloat = 18) {
        self.size = size
    }

    public var body: some View {
        GajendraLotusMarkShape()
            .stroke(
                colorScheme == .dark ? Color.gajendraGoldLight : Color.gajendraGoldDeep,
                style: StrokeStyle(lineWidth: max(0.85, size * 0.042), lineCap: .round, lineJoin: .round)
            )
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct GajendraLotusMarkShape: Shape {
    func path(in rect: CGRect) -> Path {
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(
                x: rect.minX + (x / 128) * rect.width,
                y: rect.minY + (y / 128) * rect.height
            )
        }

        var path = Path()

        path.move(to: point(64, 101))
        path.addCurve(to: point(64, 24), control1: point(48, 83), control2: point(49, 47))
        path.addCurve(to: point(64, 101), control1: point(79, 47), control2: point(80, 83))
        path.closeSubpath()

        path.move(to: point(61, 101))
        path.addCurve(to: point(31, 49), control1: point(42, 91), control2: point(29, 70))
        path.addCurve(to: point(64, 96), control1: point(49, 56), control2: point(61, 73))

        path.move(to: point(67, 101))
        path.addCurve(to: point(97, 49), control1: point(86, 91), control2: point(99, 70))
        path.addCurve(to: point(64, 96), control1: point(79, 56), control2: point(67, 73))

        path.move(to: point(59, 105))
        path.addCurve(to: point(11, 72), control1: point(38, 105), control2: point(18, 92))
        path.addCurve(to: point(63, 103), control1: point(31, 70), control2: point(50, 82))

        path.move(to: point(69, 105))
        path.addCurve(to: point(117, 72), control1: point(90, 105), control2: point(110, 92))
        path.addCurve(to: point(65, 103), control1: point(97, 70), control2: point(78, 82))

        path.move(to: point(24, 102))
        path.addCurve(to: point(104, 102), control1: point(42, 116), control2: point(86, 116))

        path.move(to: point(38, 113))
        path.addCurve(to: point(90, 113), control1: point(51, 121), control2: point(77, 121))

        return path
    }
}

public struct GajendraGlassSurface: View {
    @Environment(\.colorScheme) private var colorScheme
    private let cornerRadius: CGFloat
    private let castsShadow: Bool
    private let interactive: Bool
    private let theme: GajendraVisualTheme

    public init(
        cornerRadius: CGFloat,
        castsShadow: Bool = true,
        interactive: Bool = false,
        theme: GajendraVisualTheme = .nativePopover
    ) {
        self.cornerRadius = cornerRadius
        self.castsShadow = castsShadow
        self.interactive = interactive
        self.theme = theme
    }

    public var body: some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        Group {
            if #available(macOS 26.0, *) {
                Color.clear
                    .glassEffect(
                        interactive ? .regular.interactive() : .regular,
                        in: .rect(cornerRadius: cornerRadius)
                    )
                    .background(themeTint, in: shape)
                    .overlay(shape.stroke(Color.primary.opacity(0.13), lineWidth: 0.5))
            } else {
                shape
                    .fill(.ultraThinMaterial)
                    .overlay(
                        shape.fill(themeTint)
                    )
                    .overlay(shape.stroke(Color.primary.opacity(0.14), lineWidth: 0.5))
            }
        }
        .shadow(color: castsShadow ? Color.black.opacity(colorScheme == .dark ? 0.28 : 0.13) : .clear, radius: 18, y: 8)
    }

    private var themeTint: Color {
        if theme == .focusDeck {
            return colorScheme == .dark
                ? Color.gajendraIndigo.opacity(0.72)
                : Color(red: 0.97, green: 0.94, blue: 0.86).opacity(0.78)
        }
        return colorScheme == .dark ? Color.gajendraIndigo.opacity(0.2) : Color.white.opacity(0.18)
    }
}

public struct GajendraPillView: View {
    @ObservedObject private var model: DeckViewModel
    @ObservedObject private var visualSettings: GajendraVisualSettings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var isHovered = false
    @State private var editState = GajendraPillEditState()
    @State private var jigglePhase = false
    private let onHoverChanged: (Bool) -> Void
    private let onActivate: () -> Void
    private let onDragChanged: (CGSize, Bool) -> Void
    private let onHide: () -> Void

    public init(
        model: DeckViewModel,
        visualSettings: GajendraVisualSettings,
        onHoverChanged: @escaping (Bool) -> Void,
        onActivate: @escaping () -> Void,
        onDragChanged: @escaping (CGSize, Bool) -> Void = { _, _ in },
        onHide: @escaping () -> Void = {}
    ) {
        self.model = model
        self.visualSettings = visualSettings
        self.onHoverChanged = onHoverChanged
        self.onActivate = onActivate
        self.onDragChanged = onDragChanged
        self.onHide = onHide
    }

    public var body: some View {
        ZStack(alignment: .topTrailing) {
            Button {
                if !editState.isEditing { onActivate() }
            } label: {
                pillLabel
                    .opacity(model.isLoading ? 0.72 : 1)
                    .scaleEffect(isHovered && !editState.isEditing ? 1.05 : 1)
                    .rotationEffect(.degrees(editState.isEditing ? (jigglePhase ? 1.35 : -1.35) : 0))
            }
            .buttonStyle(.plain)

            if editState.isEditing {
                Button {
                    if editState.requestHide() { onHide() }
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 8, weight: .bold))
                        .frame(width: 17, height: 17)
                        .background(Color(nsColor: .controlBackgroundColor), in: Circle())
                        .overlay(Circle().stroke(Color.secondary.opacity(0.45), lineWidth: 0.75))
                }
                .buttonStyle(.plain)
                .help("Hide Gaja lotus")
                .accessibilityLabel("Hide Gaja lotus")
            }
        }
        .accessibilityLabel("Gaja, Elephant Focus for AI Power Users")
        .accessibilityHint(editState.isEditing ? "Drag to move Gaja. Press Escape to finish." : "Hover or press to show priorities. Press and hold to move or hide Gaja.")
        .onHover { hovered in
            isHovered = hovered
            onHoverChanged(hovered)
        }
        .animation(reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 0.82), value: model.isLoading)
        .animation(reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.78), value: isHovered)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.55)
                .onEnded { _ in
                    editState.enter()
                    jigglePhase.toggle()
                }
        )
        .simultaneousGesture(
            DragGesture(minimumDistance: 1)
                .onChanged { gesture in
                    guard editState.acceptsDrag else { return }
                    onDragChanged(gesture.translation, false)
                }
                .onEnded { gesture in
                    guard editState.acceptsDrag else { return }
                    onDragChanged(gesture.translation, true)
                }
        )
        .onChange(of: editState.isEditing) { editing in
            guard editing, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.11).repeatForever(autoreverses: true)) {
                jigglePhase.toggle()
            }
        }
        .onExitCommand {
            editState.exit()
        }
        .frame(width: 60, height: 60)
    }

    private var pillLabel: some View {
        HStack(spacing: 4) {
            GajendraMark(size: visualSettings.theme == .focusDeck ? 23 : 27)
            if visualSettings.theme == .focusDeck {
                Image(systemName: "star.fill")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(Color.gajendraAccent(for: colorScheme))
            }
        }
        .frame(width: visualSettings.theme == .focusDeck ? 52 : 48, height: visualSettings.theme == .focusDeck ? 40 : 48)
        .background(pillSurface)
        .overlay(pillBorder)
        .contentShape(RoundedRectangle(cornerRadius: visualSettings.theme == .focusDeck ? 14 : 24, style: .continuous))
    }

    @ViewBuilder
    private var pillSurface: some View {
        let radius: CGFloat = visualSettings.theme == .focusDeck ? 14 : 24
        if #available(macOS 26.0, *) {
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(.clear)
                .glassEffect(.regular.interactive(), in: .rect(cornerRadius: radius))
                .background(visualSettings.theme == .focusDeck ? Color.gajendraIndigoSoft.opacity(colorScheme == .dark ? 0.62 : 0.14) : Color.clear, in: RoundedRectangle(cornerRadius: radius))
                .shadow(color: .black.opacity(colorScheme == .dark ? 0.3 : 0.16), radius: 12, y: 5)
        } else {
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: radius).fill(visualSettings.theme == .focusDeck ? Color.gajendraIndigoSoft.opacity(colorScheme == .dark ? 0.58 : 0.14) : (colorScheme == .dark ? Color.gajendraIndigo.opacity(0.28) : Color.white.opacity(0.2))))
                .shadow(color: .black.opacity(colorScheme == .dark ? 0.3 : 0.16), radius: 12, y: 5)
        }
    }

    private var pillBorder: some View {
        let radius: CGFloat = visualSettings.theme == .focusDeck ? 14 : 24
        return RoundedRectangle(cornerRadius: radius, style: .continuous)
            .stroke(
                visualSettings.theme == .focusDeck
                    ? Color.gajendraAccent(for: colorScheme).opacity(0.46)
                    : (colorScheme == .dark ? Color.white.opacity(0.2) : Color.gajendraIndigo.opacity(0.18)),
                lineWidth: 1
            )
    }
}

public struct GajendraHoverCardView: View {
    @ObservedObject private var model: DeckViewModel
    @ObservedObject private var visualSettings: GajendraVisualSettings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    private let isPreview: Bool
    private let onHoverChanged: (Bool) -> Void
    private let onOpenOrganizer: () -> Void

    public init(
        model: DeckViewModel,
        visualSettings: GajendraVisualSettings,
        isPreview: Bool = false,
        onHoverChanged: @escaping (Bool) -> Void = { _ in },
        onOpenOrganizer: @escaping () -> Void = {}
    ) {
        self.model = model
        self.visualSettings = visualSettings
        self.isPreview = isPreview
        self.onHoverChanged = onHoverChanged
        self.onOpenOrganizer = onOpenOrganizer
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            nowSection
            queueSummary
            footer
        }
        .padding(16)
        .frame(width: 380, height: 286)
        .background(
            GajendraGlassSurface(cornerRadius: 18, theme: visualSettings.theme)
        )
        .padding(12)
        .contentShape(Rectangle())
        .onTapGesture(count: 2) {
            if let current = model.snapshot?.current { model.open(current) }
        }
        .onHover(perform: onHoverChanged)
        .animation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.88), value: model.snapshot)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: model.errorMessage)
    }

    private var header: some View {
        HStack(spacing: 9) {
            GajendraMark(size: 20)
            VStack(alignment: .leading, spacing: 1) {
                Text("Gaja")
                    .font(.headline)
                Text("Elephant Focus for AI Power Users")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if isPreview {
                Image(systemName: "rectangle.3.group")
                    .foregroundStyle(Color.gajendraAccent(for: colorScheme))
            } else {
                Button(action: onOpenOrganizer) {
                    Image(systemName: "rectangle.3.group")
                        .frame(width: 18, height: 18)
                }
                    .buttonStyle(.borderless)
                    .help("Open organizer")
                    .accessibilityLabel("Open organizer")
            }
            if isPreview {
                Image(systemName: "paintpalette")
                    .frame(width: 18, height: 18)
                    .foregroundStyle(.secondary)
            } else {
                visualSettingsMenu
            }
            refreshControl
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
                .frame(width: 18, height: 18)
        }
        .menuStyle(.borderlessButton)
        .frame(width: 24)
        .help("Theme and appearance")
        .accessibilityLabel("Theme and appearance")
    }

    @ViewBuilder
    private var nowSection: some View {
        if let current = model.snapshot?.current {
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    Image(systemName: "scope")
                    Text("NOW")
                        .tracking(1.1)
                    Text("Current focus")
                        .fontWeight(.regular)
                        .foregroundStyle(.secondary)
                }
                .font(.caption2.bold())
                .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(current.title)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(2)
                        HStack(spacing: 5) {
                            Text(current.project)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Button { model.open(current) } label: { sourceBadge(current) }
                                .buttonStyle(.plain)
                                .help("Open in \(current.sourceName)")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Button("Open thread") { model.open(current) }
                        .buttonStyle(.borderedProminent)
                        .tint(.accentColor)
                        .fixedSize()
                }
            }
            .padding(11)
            .background(nowSurfaceColor, in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(Color.gajendraAccent(for: colorScheme).opacity(visualSettings.theme == .focusDeck ? 0.72 : 0.5), lineWidth: 1)
            )
        } else if model.isLoading {
            Text("Reading your configured thread sources…")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 14)
        } else {
            Text("Choose one Focus thread as NOW in Gaja.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 14)
        }
    }

    @ViewBuilder
    private var queueSummary: some View {
        if let snapshot = model.snapshot {
            HStack(alignment: .top, spacing: 10) {
                compactList(title: "Focus", systemImage: "star.fill", threads: snapshot.focus)
                compactList(title: "Important", systemImage: "bookmark", threads: snapshot.important)
            }
        }
    }

    private func compactList(title: String, systemImage: String, threads: [DeckThread]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 5) {
                Image(systemName: systemImage)
                    .font(.caption2)
                    .foregroundStyle(title == "Focus" ? Color.gajendraAccent(for: colorScheme) : Color.secondary)
                Text(title)
                    .font(.caption.weight(title == "Focus" ? .bold : .semibold))
                Text("\(threads.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer()
            }
            ForEach(Array(threads.prefix(2))) { thread in
                Button { model.open(thread) } label: {
                    HStack(spacing: 5) {
                        Circle()
                            .fill(thread.isCurrent ? Color.gajendraAccent(for: colorScheme) : Color.secondary.opacity(0.45))
                            .frame(width: 5, height: 5)
                        Text(thread.title)
                            .font(.caption2)
                            .lineLimit(1)
                        Text(thread.sourceName)
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(providerColor(thread))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(providerColor(thread).opacity(0.1), in: Capsule())
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            if threads.isEmpty {
                Text("No tasks")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(compactListSurface(title), in: RoundedRectangle(cornerRadius: 9))
    }

    private var footer: some View {
        HStack {
            if let error = model.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption2)
                    .foregroundStyle(.orange)
                    .lineLimit(1)
            } else {
                Text("Local metadata only")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("Double-click the card to open NOW")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
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

    private var nowSurfaceColor: Color {
        if visualSettings.theme == .focusDeck {
            return colorScheme == .dark ? Color.gajendraIndigoSoft.opacity(0.52) : Color.gajendraGold.opacity(0.16)
        }
        return Color.gajendraGold.opacity(colorScheme == .dark ? 0.12 : 0.09)
    }

    private func compactListSurface(_ title: String) -> Color {
        if visualSettings.theme == .focusDeck && title == "Focus" {
            return colorScheme == .dark ? Color.gajendraIndigoSoft.opacity(0.34) : Color.white.opacity(0.52)
        }
        return Color.primary.opacity(0.035)
    }

    @ViewBuilder
    private var refreshControl: some View {
        if isPreview {
            Image(systemName: "arrow.clockwise")
                .frame(width: 20, height: 20)
                .foregroundStyle(.secondary)
        } else {
            Button { model.refresh() } label: {
                if model.isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .frame(width: 20, height: 20)
                } else {
                    Image(systemName: "arrow.clockwise")
                        .frame(width: 20, height: 20)
                }
            }
            .buttonStyle(.borderless)
            .disabled(model.isLoading)
            .help(model.isLoading ? "Refreshing" : "Refresh")
            .accessibilityLabel(model.isLoading ? "Refreshing Gaja" : "Refresh Gaja")
        }
    }
}

extension Color {
    static let gajendraIndigo = Color(red: 0.035, green: 0.075, blue: 0.18)
    static let gajendraIndigoSoft = Color(red: 0.12, green: 0.2, blue: 0.36)
    static let gajendraGold = Color(red: 0.91, green: 0.70, blue: 0.28)
    static let gajendraGoldLight = Color(red: 0.98, green: 0.82, blue: 0.46)
    static let gajendraGoldDeep = Color(red: 0.62, green: 0.42, blue: 0.08)
    static let gajendraIvory = Color(red: 1.0, green: 0.96, blue: 0.82)

    static func gajendraAccent(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? .gajendraGoldLight : .gajendraGoldDeep
    }
}
