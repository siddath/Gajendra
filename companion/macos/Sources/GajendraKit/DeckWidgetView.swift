import SwiftUI

public enum GajendraOverlayPlacement {
    public static func pointerStart(
        pointerLocation: CGPoint,
        gestureTranslation: CGSize
    ) -> CGPoint {
        CGPoint(
            x: pointerLocation.x - gestureTranslation.width,
            y: pointerLocation.y + gestureTranslation.height
        )
    }

    public static func draggedOrigin(
        startOrigin: CGPoint,
        pointerStart: CGPoint,
        pointerLocation: CGPoint
    ) -> CGPoint {
        CGPoint(
            x: startOrigin.x + pointerLocation.x - pointerStart.x,
            y: startOrigin.y + pointerLocation.y - pointerStart.y
        )
    }

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

public final class GajendraPillEditController: ObservableObject {
    @Published public private(set) var isEditing = false

    public init() {}

    public var acceptsDrag: Bool { isEditing }

    public func enter() {
        isEditing = true
    }

    public func exit() {
        isEditing = false
    }

    @discardableResult
    public func dismissIfOutside(point: CGPoint, pillFrame: CGRect) -> Bool {
        guard isEditing, !pillFrame.contains(point) else { return false }
        exit()
        return true
    }

    @discardableResult
    public func requestHide() -> Bool {
        guard isEditing else { return false }
        exit()
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
                    .fill(.thinMaterial)
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
                ? Color.gajendraIndigo.opacity(0.58)
                : Color(red: 0.97, green: 0.94, blue: 0.86).opacity(0.6)
        }
        return Color(nsColor: .windowBackgroundColor).opacity(colorScheme == .dark ? 0.56 : 0.46)
    }
}

public struct GajendraPillView: View {
    @ObservedObject private var model: DeckViewModel
    @ObservedObject private var visualSettings: GajendraVisualSettings
    @ObservedObject private var editController: GajendraPillEditController
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var isHovered = false
    @State private var jigglePhase = false
    private let onHoverChanged: (Bool) -> Void
    private let onActivate: () -> Void
    private let onDragChanged: (CGSize, Bool) -> Void
    private let onHide: () -> Void

    public init(
        model: DeckViewModel,
        visualSettings: GajendraVisualSettings,
        editController: GajendraPillEditController,
        onHoverChanged: @escaping (Bool) -> Void,
        onActivate: @escaping () -> Void,
        onDragChanged: @escaping (CGSize, Bool) -> Void = { _, _ in },
        onHide: @escaping () -> Void = {}
    ) {
        self.model = model
        self.visualSettings = visualSettings
        self.editController = editController
        self.onHoverChanged = onHoverChanged
        self.onActivate = onActivate
        self.onDragChanged = onDragChanged
        self.onHide = onHide
    }

    public var body: some View {
        ZStack(alignment: .topTrailing) {
            Button {
                if !editController.isEditing { onActivate() }
            } label: {
                pillLabel
                    .opacity(model.isLoading ? 0.72 : 1)
                    .scaleEffect(isHovered && !editController.isEditing ? 1.05 : 1)
                    .rotationEffect(.degrees(editController.isEditing ? (jigglePhase ? 1.35 : -1.35) : 0))
            }
            .buttonStyle(.plain)

            if editController.isEditing {
                Button {
                    if editController.requestHide() { onHide() }
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
        .accessibilityHint(editController.isEditing ? "Drag to move Gaja. Click outside or press Escape to finish." : "Hover or press to show priorities. Press and hold to move or hide Gaja.")
        .onHover { hovered in
            isHovered = hovered
            onHoverChanged(hovered)
        }
        .animation(reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 0.82), value: model.isLoading)
        .animation(reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.78), value: isHovered)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.55)
                .onEnded { _ in
                    editController.enter()
                    jigglePhase.toggle()
                }
        )
        .simultaneousGesture(
            DragGesture(minimumDistance: 1)
                .onChanged { gesture in
                    guard editController.acceptsDrag else { return }
                    onDragChanged(gesture.translation, false)
                }
                .onEnded { gesture in
                    guard editController.acceptsDrag else { return }
                    onDragChanged(gesture.translation, true)
                }
        )
        .onChange(of: editController.isEditing) { editing in
            guard editing, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.11).repeatForever(autoreverses: true)) {
                jigglePhase.toggle()
            }
        }
        .onExitCommand {
            editController.exit()
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
    @State private var hoveredThreadId: String?
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
        GeometryReader { proxy in
            cardLayout
                .padding(contentInset)
                .frame(
                    width: max(0, proxy.size.width - 24),
                    height: max(0, proxy.size.height - 24),
                    alignment: .top
                )
                .background(
                    GajendraGlassSurface(
                        cornerRadius: visualSettings.theme == .focusDeck ? 14 : 16,
                        theme: visualSettings.theme
                    )
                )
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
        }
        .contentShape(Rectangle())
        .onTapGesture(count: 2) {
            if let current = model.snapshot?.current { model.open(current) }
        }
        .onHover(perform: onHoverChanged)
        .animation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.88), value: model.snapshot)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: model.errorMessage)
    }

    private var cardLayout: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider().padding(.top, 8)
            nowSection.padding(.vertical, 10)
            queueSummary
            Spacer(minLength: 6)
            footer.padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var header: some View {
        HStack(spacing: 0) {
            GajendraMark(size: 24 * contentScale)
                .frame(width: 116, alignment: .leading)
            VStack(alignment: .center, spacing: 1) {
                Text("Gaja")
                    .font(scaledFont(17, weight: .semibold))
                Text("Elephant Focus for AI Power Users")
                    .font(scaledFont(11, weight: .regular))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            HStack(spacing: 5) {
                if isPreview {
                    Image(systemName: "rectangle.3.group")
                        .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                        .frame(width: 28, height: 28)
                } else {
                    Button(action: onOpenOrganizer) {
                        Image(systemName: "rectangle.3.group")
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(.plain)
                    .gajendraHoverSurface()
                    .help("Open organizer")
                    .accessibilityLabel("Open organizer")
                }
                if isPreview {
                    Image(systemName: "paintpalette")
                        .frame(width: 28, height: 28)
                        .foregroundStyle(.secondary)
                } else {
                    visualSettingsMenu
                }
                refreshControl
            }
            .frame(width: 116, alignment: .trailing)
        }
        .frame(height: 38 * contentScale, alignment: .center)
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
            Divider()
            Picker("Hover card size", selection: $visualSettings.hoverCardSize) {
                ForEach(GajendraHoverCardSize.allCases) { size in
                    Text(size.title).tag(size)
                }
            }
        } label: {
            Image(systemName: "paintpalette")
                .frame(width: 28, height: 28)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .gajendraHoverSurface()
        .help("Theme, appearance, and card size")
        .accessibilityLabel("Theme, appearance, and card size")
    }

    @ViewBuilder
    private var nowSection: some View {
        if let current = model.snapshot?.current {
            VStack(alignment: .leading, spacing: 7 * contentScale) {
                HStack(spacing: 6) {
                    Image(systemName: visualSettings.theme == .focusDeck ? "star.fill" : "scope")
                    Text("NOW")
                    Text("Current focus")
                        .font(scaledFont(10.5, weight: .medium))
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .font(scaledFont(12.5, weight: .bold))
                .foregroundStyle(Color.gajendraAccent(for: colorScheme))

                Text(current.title)
                    .font(scaledFont(17, weight: .semibold))
                    .lineLimit(visualSettings.hoverCardSize == .compact ? 2 : 3)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(alignment: .center, spacing: 7) {
                    Text(current.project)
                        .font(scaledFont(11.5, weight: .regular))
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                    if let context = current.context {
                        contextBadge(context)
                    }
                    Spacer(minLength: 8)
                    Button { model.open(current) } label: { sourceBadge(current) }
                        .buttonStyle(.plain)
                        .help("Open in \(current.sourceName)")
                    Button { model.open(current) } label: {
                        Text("Open")
                            .font(scaledFont(11.5, weight: .semibold))
                            .foregroundStyle(openButtonForeground)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .tint(openButtonTint)
                    .fixedSize()
                }
            }
            .padding(.horizontal, 13 * contentScale)
            .padding(.vertical, 11 * contentScale)
            .background(nowSurfaceColor, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.gajendraAccent(for: colorScheme).opacity(visualSettings.theme == .focusDeck ? 0.72 : 0.42), lineWidth: 1)
            )
        } else if model.isLoading {
            Text("Reading your configured thread sources…")
                .font(scaledFont(13, weight: .regular))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 18)
        } else {
            Text("Choose one Focus thread as NOW in Gaja.")
                .font(scaledFont(13, weight: .regular))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 18)
        }
    }

    @ViewBuilder
    private var queueSummary: some View {
        if let snapshot = model.snapshot {
            HStack(alignment: .top, spacing: 10 * contentScale) {
                queueColumn(
                    title: "Focus",
                    systemImage: "star.fill",
                    threads: snapshot.focus.filter { !$0.isCurrent }
                )
                queueColumn(
                    title: "Important",
                    systemImage: "bookmark.fill",
                    threads: snapshot.important
                )
            }
        }
    }

    private func queueColumn(title: String, systemImage: String, threads: [DeckThread]) -> some View {
        let visibleThreads = Array(threads.prefix(5))
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(scaledFont(11.5, weight: .semibold))
                    .foregroundStyle(title == "Focus" ? Color.gajendraAccent(for: colorScheme) : Color.secondary)
                Text(title)
                    .font(scaledFont(13.5, weight: .semibold))
                Text("\(threads.count)")
                    .font(scaledFont(10.5, weight: .medium).monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer(minLength: 4)
                if threads.count > 5 {
                    moreButton(remaining: threads.count - 5, title: title)
                }
            }
            .frame(height: 30 * contentScale)
            .padding(.horizontal, 10 * contentScale)

            if threads.isEmpty {
                Text("No tasks")
                    .font(scaledFont(11.5, weight: .regular))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 39 * contentScale, alignment: .leading)
                    .padding(.horizontal, 10 * contentScale)
            } else {
                ForEach(visibleThreads.indices, id: \.self) { index in
                    if index > 0 { Divider().padding(.leading, 10 * contentScale) }
                    queueRow(visibleThreads[index])
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(queueSurfaceColor(title), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.primary.opacity(0.08), lineWidth: 0.5)
        )
    }

    private func queueRow(_ thread: DeckThread) -> some View {
        Button { model.open(thread) } label: {
            VStack(alignment: .leading, spacing: 2 * contentScale) {
                HStack(alignment: .firstTextBaseline, spacing: 7) {
                    Text(thread.title)
                        .font(scaledFont(12.5, weight: .medium))
                        .lineLimit(1)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 5)
                    providerBadge(thread, compact: true)
                }
                HStack(spacing: 5) {
                    Text(thread.project)
                        .font(scaledFont(10.5, weight: .regular))
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                    if let context = thread.context {
                        contextBadge(context, compact: true)
                    }
                    Spacer(minLength: 0)
                }
            }
            .padding(.horizontal, 10 * contentScale)
            .padding(.vertical, 6 * contentScale)
            .frame(maxWidth: .infinity, minHeight: 39 * contentScale, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(hoveredThreadId == thread.id ? rowHoverColor : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovered in
            hoveredThreadId = hovered ? thread.id : (hoveredThreadId == thread.id ? nil : hoveredThreadId)
        }
        .help("Open \(thread.title) in \(thread.sourceName)")
        .accessibilityLabel("\(thread.title), \(thread.sourceName)")
        .accessibilityHint("Open this thread")
    }

    @ViewBuilder
    private func moreButton(remaining: Int, title: String) -> some View {
        if isPreview {
            Text("More \(remaining)")
                .font(scaledFont(10.5, weight: .medium))
                .foregroundStyle(Color.gajendraAccent(for: colorScheme))
        } else {
            Button("More \(remaining)", action: onOpenOrganizer)
                .font(scaledFont(10.5, weight: .medium))
                .buttonStyle(.plain)
                .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                .gajendraHoverSurface(cornerRadius: 6)
                .help("View all \(title) tasks in the organizer")
        }
    }

    private var footer: some View {
        HStack(spacing: 8) {
            if let error = model.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(scaledFont(10.5, weight: .regular))
                    .foregroundStyle(.orange)
                    .lineLimit(1)
            } else {
                Text("Fresh on hover · Local metadata")
                    .font(scaledFont(10.5, weight: .regular))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if visualSettings.hoverCardSize != .compact {
                Text("Double-click to open NOW")
                    .font(scaledFont(10.5, weight: .regular))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var contentInset: CGFloat {
        (visualSettings.theme == .focusDeck ? 17 : 16) * contentScale
    }

    private var contentScale: CGFloat {
        GajendraHoverCardSizing.contentScale(for: visualSettings.hoverCardSize)
    }

    private func scaledFont(_ size: CGFloat, weight: Font.Weight) -> Font {
        .system(size: size * contentScale, weight: weight, design: .default)
    }

    private var openButtonTint: Color {
        if visualSettings.theme == .focusDeck {
            return colorScheme == .dark ? Color.gajendraGoldLight : Color.gajendraGoldDeep
        }
        return Color(nsColor: .controlAccentColor)
    }

    private var openButtonForeground: Color {
        visualSettings.theme == .focusDeck && colorScheme == .dark
            ? Color.gajendraIndigo
            : Color.white
    }

    private func sourceBadge(_ thread: DeckThread) -> some View {
        providerBadge(thread, compact: false)
            .accessibilityLabel("Open in \(thread.sourceName)")
    }

    private func providerBadge(_ thread: DeckThread, compact: Bool) -> some View {
        Text(thread.sourceName)
            .font(scaledFont(compact ? 9.5 : 10.5, weight: .semibold))
            .lineLimit(1)
            .fixedSize()
            .foregroundStyle(providerColor(thread))
            .padding(.horizontal, compact ? 6 : 8)
            .padding(.vertical, compact ? 2 : 3)
            .background(providerColor(thread).opacity(colorScheme == .dark ? 0.2 : 0.1), in: Capsule())
            .overlay(Capsule().stroke(providerColor(thread).opacity(0.38), lineWidth: 0.75))
    }

    private func contextBadge(_ context: ThreadContext, compact: Bool = false) -> some View {
        Text(context.title)
            .font(scaledFont(compact ? 9 : 10, weight: .semibold))
            .lineLimit(1)
            .fixedSize()
            .foregroundStyle(contextColor(context))
            .padding(.horizontal, compact ? 5 : 7)
            .padding(.vertical, compact ? 1.5 : 2.5)
            .background(contextColor(context).opacity(colorScheme == .dark ? 0.18 : 0.1), in: Capsule())
            .overlay(Capsule().stroke(contextColor(context).opacity(0.34), lineWidth: 0.75))
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

    private var nowSurfaceColor: Color {
        if visualSettings.theme == .focusDeck {
            return colorScheme == .dark ? Color.gajendraIndigoSoft.opacity(0.5) : Color.gajendraGold.opacity(0.16)
        }
        return colorScheme == .dark ? Color.white.opacity(0.055) : Color.white.opacity(0.34)
    }

    private func queueSurfaceColor(_ title: String) -> Color {
        if visualSettings.theme == .focusDeck {
            if title == "Focus" {
                return colorScheme == .dark ? Color.gajendraIndigoSoft.opacity(0.36) : Color.white.opacity(0.48)
            }
            return colorScheme == .dark ? Color.black.opacity(0.16) : Color.gajendraGold.opacity(0.07)
        }
        return colorScheme == .dark ? Color.black.opacity(0.12) : Color.white.opacity(0.25)
    }

    private var rowHoverColor: Color {
        visualSettings.theme == .focusDeck
            ? Color.gajendraAccent(for: colorScheme).opacity(colorScheme == .dark ? 0.12 : 0.09)
            : Color(nsColor: .controlAccentColor).opacity(colorScheme == .dark ? 0.15 : 0.09)
    }

    @ViewBuilder
    private var refreshControl: some View {
        if isPreview {
            Image(systemName: "arrow.clockwise")
                .frame(width: 28, height: 28)
                .foregroundStyle(.secondary)
        } else {
            Button { model.refresh() } label: {
                if model.isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .frame(width: 28, height: 28)
                } else {
                    Image(systemName: "arrow.clockwise")
                        .frame(width: 28, height: 28)
                }
            }
            .buttonStyle(.plain)
            .gajendraHoverSurface()
            .disabled(model.isLoading)
            .help(model.isLoading ? "Refreshing" : "Refresh")
            .accessibilityLabel(model.isLoading ? "Refreshing Gaja" : "Refresh Gaja")
        }
    }
}

private struct GajendraHoverSurfaceModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isHovered = false
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content
            .padding(2)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(isHovered ? Color.primary.opacity(0.08) : Color.clear)
            )
            .contentShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .onHover { isHovered = $0 }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isHovered)
    }
}

private extension View {
    func gajendraHoverSurface(cornerRadius: CGFloat = 7) -> some View {
        modifier(GajendraHoverSurfaceModifier(cornerRadius: cornerRadius))
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
