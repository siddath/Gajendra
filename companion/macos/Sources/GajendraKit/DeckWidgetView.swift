import AppKit
import SwiftUI

public struct GajendraHostedLayoutEvidence: Equatable, Sendable {
    public var metadataFrame: CGRect?
    public var primaryActionFrame: CGRect?

    public init(metadataFrame: CGRect? = nil, primaryActionFrame: CGRect? = nil) {
        self.metadataFrame = metadataFrame
        self.primaryActionFrame = primaryActionFrame
    }
}

public struct GajendraHostedLayoutEvidenceKey: PreferenceKey {
    public static let coordinateSpaceName = "gajendra-hosted-evidence"
    public static let defaultValue = GajendraHostedLayoutEvidence()

    public static func reduce(
        value: inout GajendraHostedLayoutEvidence,
        nextValue: () -> GajendraHostedLayoutEvidence
    ) {
        let next = nextValue()
        if let metadataFrame = next.metadataFrame {
            value.metadataFrame = metadataFrame
        }
        if let primaryActionFrame = next.primaryActionFrame {
            value.primaryActionFrame = primaryActionFrame
        }
    }
}

public enum GajendraOverlayPlacement {
    public static let dragThreshold: CGFloat = 6

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
        origin(
            for: .bottomTrailing,
            windowSize: windowSize,
            visibleFrame: visibleFrame,
            margin: margin
        )
    }

    public static func origin(
        for anchor: GajendraPillAnchor,
        windowSize: CGSize,
        visibleFrame: CGRect,
        margin: CGFloat = 18
    ) -> CGPoint {
        let x: CGFloat
        let y: CGFloat
        switch anchor {
        case .topLeading:
            x = visibleFrame.minX + margin
            y = visibleFrame.maxY - windowSize.height - margin
        case .topTrailing:
            x = visibleFrame.maxX - windowSize.width - margin
            y = visibleFrame.maxY - windowSize.height - margin
        case .center:
            x = visibleFrame.midX - windowSize.width / 2
            y = visibleFrame.midY - windowSize.height / 2
        case .bottomLeading:
            x = visibleFrame.minX + margin
            y = visibleFrame.minY + margin
        case .bottomCenter:
            x = visibleFrame.midX - windowSize.width / 2
            y = visibleFrame.minY + margin
        case .bottomTrailing:
            x = visibleFrame.maxX - windowSize.width - margin
            y = visibleFrame.minY + margin
        }
        return clampedOrigin(
            windowSize: windowSize,
            proposedOrigin: CGPoint(x: x, y: y),
            visibleFrame: visibleFrame,
            margin: min(margin, 8)
        )
    }

    public static func nearestAnchor(
        to proposedOrigin: CGPoint,
        windowSize: CGSize,
        visibleFrame: CGRect
    ) -> GajendraPillAnchor {
        let proposedCenter = CGPoint(
            x: proposedOrigin.x + windowSize.width / 2,
            y: proposedOrigin.y + windowSize.height / 2
        )
        return GajendraPillAnchor.allCases.min { lhs, rhs in
            let lhsOrigin = origin(for: lhs, windowSize: windowSize, visibleFrame: visibleFrame)
            let rhsOrigin = origin(for: rhs, windowSize: windowSize, visibleFrame: visibleFrame)
            let lhsDistance = squaredDistance(
                from: proposedCenter,
                to: CGPoint(x: lhsOrigin.x + windowSize.width / 2, y: lhsOrigin.y + windowSize.height / 2)
            )
            let rhsDistance = squaredDistance(
                from: proposedCenter,
                to: CGPoint(x: rhsOrigin.x + windowSize.width / 2, y: rhsOrigin.y + windowSize.height / 2)
            )
            return lhsDistance < rhsDistance
        } ?? .bottomTrailing
    }

    public static func isMeaningfulDrag(_ translation: CGSize) -> Bool {
        hypot(translation.width, translation.height) >= dragThreshold
    }

    public static func cardMaximumSize(
        for anchor: GajendraPillAnchor,
        pillSize: CGSize,
        visibleFrame: CGRect,
        gap: CGFloat = 10,
        edgeMargin: CGFloat = 12
    ) -> CGSize {
        let centeredSideAllowance = max(
            240,
            (visibleFrame.width - pillSize.width) / 2 - gap - edgeMargin
        )
        let verticalAllowance = max(360, visibleFrame.height - pillSize.height - gap - edgeMargin * 2)
        switch anchor {
        case .center:
            return CGSize(width: centeredSideAllowance, height: max(360, visibleFrame.height - edgeMargin * 2))
        case .topLeading, .topTrailing, .bottomLeading, .bottomCenter, .bottomTrailing:
            return CGSize(width: max(320, visibleFrame.width - edgeMargin * 2), height: verticalAllowance)
        }
    }

    public static func cardOrigin(
        cardSize: CGSize,
        pillFrame: CGRect,
        visibleFrame: CGRect,
        anchor: GajendraPillAnchor? = nil,
        gap: CGFloat = 10,
        edgeMargin: CGFloat = 12
    ) -> CGPoint {
        let resolvedAnchor = anchor ?? nearestAnchor(
            to: pillFrame.origin,
            windowSize: pillFrame.size,
            visibleFrame: visibleFrame
        )
        let minimumX = visibleFrame.minX + edgeMargin
        let maximumX = visibleFrame.maxX - cardSize.width - edgeMargin
        let minimumY = visibleFrame.minY + edgeMargin
        let maximumY = visibleFrame.maxY - cardSize.height - edgeMargin
        let proposed: CGPoint
        switch resolvedAnchor {
        case .topLeading:
            proposed = CGPoint(x: pillFrame.minX, y: pillFrame.minY - cardSize.height - gap)
        case .topTrailing:
            proposed = CGPoint(x: pillFrame.maxX - cardSize.width, y: pillFrame.minY - cardSize.height - gap)
        case .center:
            let rightX = pillFrame.maxX + gap
            let leftX = pillFrame.minX - cardSize.width - gap
            let sideX = rightX <= maximumX ? rightX : leftX
            proposed = CGPoint(x: sideX, y: pillFrame.midY - cardSize.height / 2)
        case .bottomLeading:
            proposed = CGPoint(x: pillFrame.minX, y: pillFrame.maxY + gap)
        case .bottomCenter:
            proposed = CGPoint(x: pillFrame.midX - cardSize.width / 2, y: pillFrame.maxY + gap)
        case .bottomTrailing:
            proposed = CGPoint(x: pillFrame.maxX - cardSize.width, y: pillFrame.maxY + gap)
        }
        return CGPoint(
            x: min(max(proposed.x, minimumX), maximumX),
            y: min(max(proposed.y, minimumY), maximumY)
        )
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

    private static func squaredDistance(from lhs: CGPoint, to rhs: CGPoint) -> CGFloat {
        let x = lhs.x - rhs.x
        let y = lhs.y - rhs.y
        return x * x + y * y
    }
}

public struct GajendraCardPresentationState: Equatable, Sendable {
    public private(set) var isPresented = false

    public init() {}

    @discardableResult
    public mutating func toggle() -> Bool {
        isPresented.toggle()
        return isPresented
    }

    @discardableResult
    public mutating func dismiss() -> Bool {
        guard isPresented else { return false }
        isPresented = false
        return true
    }
}

public final class GajendraPillEditController: ObservableObject {
    @Published public private(set) var isEditing = false

    public init() {}

    public var acceptsDrag: Bool { isEditing }

    public func enter() {
        isEditing = true
    }

    public func toggle() {
        isEditing.toggle()
    }

    public func exit() {
        isEditing = false
    }

    /// A primary launcher action must never become a dead end just because move/hide mode is
    /// active. Finish that transient mode first, then perform the same card action as a normal tap.
    public func performPrimaryAction(_ action: () -> Void) {
        exit()
        action()
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
        let markColor = colorScheme == .dark ? Color.gajendraGoldLight : Color.gajendraGoldDeep
        ZStack {
            GajendraElephantLotusMarkShape()
                .stroke(
                    markColor,
                    style: StrokeStyle(lineWidth: max(1, size * 0.0278), lineCap: .round, lineJoin: .round)
                )
            GajendraElephantLotusDetailShape()
                .stroke(
                    markColor,
                    style: StrokeStyle(lineWidth: max(0.7, size * 0.0137), lineCap: .round, lineJoin: .round)
                )
            GajendraElephantLotusPetalShape()
                .stroke(
                    markColor,
                    style: StrokeStyle(lineWidth: max(0.85, size * 0.02), lineCap: .round, lineJoin: .round)
                )
            GajendraElephantLotusPupilShape()
                .fill(markColor)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct GajendraElephantLotusMarkShape: Shape {
    func path(in rect: CGRect) -> Path {
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(
                x: rect.minX + (x / 128) * rect.width,
                y: rect.minY + (y / 128) * rect.height
            )
        }

        var path = Path()

        path.move(to: point(37, 42))
        path.addCurve(to: point(18, 54), control1: point(29, 40), control2: point(23, 45))
        path.addCurve(to: point(30, 75), control1: point(18, 63), control2: point(23, 70))
        path.addCurve(to: point(39, 89), control1: point(34, 79), control2: point(35, 86))
        path.addCurve(to: point(48, 78), control1: point(44, 92), control2: point(49, 86))
        path.addCurve(to: point(45, 52), control1: point(47, 69), control2: point(47, 60))
        path.addCurve(to: point(37, 42), control1: point(43, 46), control2: point(40, 43))
        path.closeSubpath()

        path.move(to: point(20, 54))
        path.addCurve(to: point(34, 46), control1: point(25, 55), control2: point(29, 49))
        path.addCurve(to: point(45, 51), control1: point(39, 44), control2: point(43, 47))
        path.addCurve(to: point(33, 64), control1: point(40, 53), control2: point(36, 58))

        path.move(to: point(40, 42))
        path.addCurve(to: point(67, 40), control1: point(49, 36), control2: point(59, 35))
        path.addCurve(to: point(79, 55), control1: point(74, 45), control2: point(74, 51))
        path.addCurve(to: point(84, 78), control1: point(85, 60), control2: point(83, 69))
        path.addCurve(to: point(90, 91), control1: point(84, 85), control2: point(86, 90))
        path.addCurve(to: point(99, 84), control1: point(95, 93), control2: point(99, 89))
        path.addCurve(to: point(95, 67), control1: point(100, 78), control2: point(97, 71))
        path.addCurve(to: point(98, 57), control1: point(93, 63), control2: point(93, 59))
        path.addCurve(to: point(102, 59), control1: point(100, 56), control2: point(102, 57))

        path.move(to: point(98, 62))
        path.addCurve(to: point(103, 65), control1: point(100, 62), control2: point(102, 63))
        path.addCurve(to: point(104, 94), control1: point(108, 73), control2: point(109, 85))
        path.addCurve(to: point(74, 97), control1: point(98, 103), control2: point(84, 104))
        path.addCurve(to: point(62, 82), control1: point(68, 93), control2: point(65, 87))

        path.move(to: point(47, 64))
        path.addCurve(to: point(52, 80), control1: point(45, 72), control2: point(46, 78))
        path.addCurve(to: point(62, 83), control1: point(56, 81), control2: point(59, 80))

        return path
    }
}

private struct GajendraElephantLotusDetailShape: Shape {
    func path(in rect: CGRect) -> Path {
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(
                x: rect.minX + (x / 128) * rect.width,
                y: rect.minY + (y / 128) * rect.height
            )
        }

        var path = Path()

        path.move(to: point(55, 57))
        path.addCurve(to: point(66, 57), control1: point(58, 54), control2: point(63, 54))

        path.move(to: point(56, 59))
        path.addCurve(to: point(66, 59), control1: point(59, 56), control2: point(63, 56))
        path.addCurve(to: point(56, 59), control1: point(64, 62), control2: point(59, 63))
        path.closeSubpath()

        path.move(to: point(58, 75))
        path.addCurve(to: point(62, 80), control1: point(60, 75), control2: point(60, 79))
        path.addCurve(to: point(69, 79), control1: point(64, 78), control2: point(67, 77))

        path.move(to: point(67, 79))
        path.addCurve(to: point(75, 84), control1: point(69, 81), control2: point(72, 83))
        path.addCurve(to: point(68, 77), control1: point(72, 81), control2: point(70, 79))

        return path
    }
}

private struct GajendraElephantLotusPetalShape: Shape {
    func path(in rect: CGRect) -> Path {
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(
                x: rect.minX + (x / 128) * rect.width,
                y: rect.minY + (y / 128) * rect.height
            )
        }

        var path = Path()

        path.move(to: point(92, 43))
        path.addCurve(to: point(92, 23), control1: point(86, 38), control2: point(86, 30))
        path.addCurve(to: point(94, 43), control1: point(99, 30), control2: point(101, 38))
        path.addCurve(to: point(92, 43), control1: point(93, 44), control2: point(92, 44))
        path.closeSubpath()

        path.move(to: point(89, 41))
        path.addCurve(to: point(84, 22), control1: point(83, 36), control2: point(82, 28))
        path.addCurve(to: point(92, 41), control1: point(90, 26), control2: point(93, 33))

        path.move(to: point(94, 41))
        path.addCurve(to: point(108, 27), control1: point(99, 33), control2: point(104, 29))
        path.addCurve(to: point(96, 43), control1: point(108, 34), control2: point(104, 40))

        path.move(to: point(89, 42))
        path.addCurve(to: point(75, 35), control1: point(83, 45), control2: point(77, 41))
        path.addCurve(to: point(92, 41), control1: point(82, 34), control2: point(87, 36))

        path.move(to: point(95, 43))
        path.addCurve(to: point(111, 34), control1: point(102, 41), control2: point(108, 37))
        path.addCurve(to: point(95, 45), control1: point(108, 42), control2: point(102, 46))

        path.move(to: point(88, 32))
        path.addCurve(to: point(94, 19), control1: point(88, 27), control2: point(91, 22))
        path.addCurve(to: point(100, 32), control1: point(98, 23), control2: point(100, 28))

        path.move(to: point(94, 44))
        path.addCurve(to: point(105, 50), control1: point(100, 44), control2: point(104, 47))
        path.addCurve(to: point(91, 44), control1: point(99, 51), control2: point(94, 48))

        path.move(to: point(92, 43))
        path.addCurve(to: point(99, 60.5), control1: point(88, 49), control2: point(89, 56))

        return path
    }
}

private struct GajendraElephantLotusPupilShape: Shape {
    func path(in rect: CGRect) -> Path {
        let center = CGPoint(
            x: rect.minX + (63.1 / 128) * rect.width,
            y: rect.minY + (59 / 128) * rect.height
        )
        let diameter = max(1.05, (1.7 / 128) * rect.width)
        return Path(
            ellipseIn: CGRect(
                x: center.x - diameter / 2,
                y: center.y - diameter / 2,
                width: diameter,
                height: diameter
            )
        )
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
    private let onActivate: () -> Void
    private let onOpenOrganizer: () -> Void
    private let onDragChanged: (CGSize, Bool) -> Void
    private let onHide: () -> Void
    private let onRequestUninstall: () -> Void

    public init(
        model: DeckViewModel,
        visualSettings: GajendraVisualSettings,
        editController: GajendraPillEditController,
        onActivate: @escaping () -> Void = {},
        onOpenOrganizer: @escaping () -> Void = {},
        onDragChanged: @escaping (CGSize, Bool) -> Void = { _, _ in },
        onHide: @escaping () -> Void = {},
        onRequestUninstall: @escaping () -> Void = {}
    ) {
        self.model = model
        self.visualSettings = visualSettings
        self.editController = editController
        self.onActivate = onActivate
        self.onOpenOrganizer = onOpenOrganizer
        self.onDragChanged = onDragChanged
        self.onHide = onHide
        self.onRequestUninstall = onRequestUninstall
    }

    public var body: some View {
        ZStack(alignment: .topTrailing) {
            pillLabel
                .frame(width: 60, height: 60)
                .contentShape(Rectangle())
                .opacity(model.isLoading ? 0.72 : 1)
                .scaleEffect(isHovered && !editController.isEditing ? 1.05 : 1)

            if editController.isEditing {
                Group {
                    if reduceMotion {
                        hideButton
                    } else {
                        GajendraJigglingView { hideButton }
                    }
                }
            }
        }
        .accessibilityLabel(GajendraBrandCopy.name)
        .accessibilityHint(editController.isEditing ? "Click to open priorities and finish moving. Drag to a snap position. Double-click, click outside, or press Escape to finish without opening." : "Click to show or hide priorities. Double-click to move or hide Gajendra. Use the contextual menu for more options.")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction {
            editController.performPrimaryAction(onActivate)
        }
        .accessibilityAction(named: "Move or hide Gajendra") {
            editController.enter()
        }
        .onHover { hovered in
            isHovered = hovered
        }
        .animation(reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 0.82), value: model.isLoading)
        .animation(reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.78), value: isHovered)
        .simultaneousGesture(
            DragGesture(minimumDistance: GajendraOverlayPlacement.dragThreshold)
                .onChanged { gesture in
                    guard editController.acceptsDrag else { return }
                    onDragChanged(gesture.translation, false)
                }
                .onEnded { gesture in
                    guard editController.acceptsDrag else { return }
                    onDragChanged(gesture.translation, true)
                },
            including: editController.acceptsDrag ? .all : .none
        )
        .onExitCommand {
            editController.exit()
        }
        .contextMenu {
            Button("Show or Hide Gajendra") { editController.performPrimaryAction(onActivate) }
            Button("Open Organizer…") { onOpenOrganizer() }
            Divider()
            Button("Move or Hide Gajendra") { editController.enter() }
            Divider()
            Button("Uninstall Gajendra…", role: .destructive) { onRequestUninstall() }
        }
        .frame(width: 60, height: 60)
    }

    private var pillLabel: some View {
        HStack(spacing: 4) {
            Group {
                if editController.isEditing && !reduceMotion {
                    GajendraJigglingView { pillIcon }
                } else {
                    pillIcon
                }
            }
        }
        .frame(width: visualSettings.theme == .focusDeck ? 52 : 48, height: visualSettings.theme == .focusDeck ? 40 : 48)
        .background(pillSurface)
        .overlay(pillBorder)
        .contentShape(RoundedRectangle(cornerRadius: visualSettings.theme == .focusDeck ? 14 : 24, style: .continuous))
    }

    private var pillIcon: some View {
        HStack(spacing: 4) {
            GajendraMark(size: visualSettings.theme == .focusDeck ? 28 : 32)
            if visualSettings.theme == .focusDeck {
                Image(systemName: "star.fill")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(Color.gajendraAccent(for: colorScheme))
            }
        }
    }

    private var hideButton: some View {
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
        .help("Hide Gajendra launcher")
        .accessibilityLabel("Hide Gajendra launcher")
    }

    @ViewBuilder
    private var pillSurface: some View {
        let radius: CGFloat = visualSettings.theme == .focusDeck ? 14 : 24
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        Group {
            if #available(macOS 26.0, *) {
                shape
                    .fill(.clear)
                    .glassEffect(.regular.interactive(), in: .rect(cornerRadius: radius))
                    .background(visualSettings.theme == .focusDeck ? Color.gajendraIndigoSoft.opacity(colorScheme == .dark ? 0.62 : 0.14) : Color.clear, in: shape)
            } else {
                shape
                    .fill(.ultraThinMaterial)
                    .overlay(shape.fill(visualSettings.theme == .focusDeck ? Color.gajendraIndigoSoft.opacity(colorScheme == .dark ? 0.58 : 0.14) : (colorScheme == .dark ? Color.gajendraIndigo.opacity(0.28) : Color.white.opacity(0.2))))
            }
        }
        // This view lives inside a fixed 60x60 transparent panel. A wide outer blur is clipped to
        // that rectangular boundary, which is the occasional rectangular shadow users could see
        // behind the rounded mark. Keep the material and border, but no window-edge blur.
        .clipShape(shape)
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

private struct GajendraJigglingView<Content: View>: View {
    @State private var phase = false
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .rotationEffect(.degrees(phase ? 1.35 : -1.35))
            .onAppear {
                withAnimation(.easeInOut(duration: 0.11).repeatForever(autoreverses: true)) {
                    phase = true
                }
            }
    }
}

private final class GajendraSearchField: NSTextField {
    private var selectsAllOnNextMouseDown = true
    private var pendingMouseSelectionValue: String?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    func prepareForFocusEntry() {
        selectsAllOnNextMouseDown = true
        pendingMouseSelectionValue = nil
    }

    func markFocusEntryHandled() {
        selectsAllOnNextMouseDown = false
        pendingMouseSelectionValue = nil
    }

    func cancelPendingMouseSelection() {
        pendingMouseSelectionValue = nil
    }

    override func mouseDown(with event: NSEvent) {
        let shouldSelectExistingText = selectsAllOnNextMouseDown
        let selectionValue = stringValue
        markFocusEntryHandled()
        super.mouseDown(with: event)

        guard shouldSelectExistingText, !selectionValue.isEmpty else { return }
        pendingMouseSelectionValue = selectionValue
        DispatchQueue.main.async { [weak self] in
            guard let self,
                  self.pendingMouseSelectionValue == selectionValue,
                  self.stringValue == selectionValue,
                  let editor = self.currentEditor() as? NSTextView else { return }
            self.pendingMouseSelectionValue = nil
            editor.selectAll(nil)
        }
    }
}

struct GajendraSearchTextField: NSViewRepresentable {
    @Binding var text: String
    @Binding var isFocused: Bool
    let prompt: String
    let fontSize: CGFloat
    let onFocusRequested: () -> Void
    let onSubmit: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> NSTextField {
        let field = GajendraSearchField()
        field.delegate = context.coordinator
        field.isBordered = false
        field.isBezeled = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.usesSingleLineMode = true
        field.lineBreakMode = .byTruncatingTail
        field.placeholderString = prompt
        field.font = .systemFont(ofSize: fontSize)
        field.setAccessibilityLabel("Search every AI-agent thread")
        return field
    }

    func updateNSView(_ field: NSTextField, context: Context) {
        let coordinator = context.coordinator
        coordinator.parent = self
        coordinator.observeWindow(of: field)
        coordinator.reconcileText(in: field, with: text)
        if field.placeholderString != prompt { field.placeholderString = prompt }
        field.font = .systemFont(ofSize: fontSize)

        if isFocused {
            coordinator.requestFocusIfNeeded(for: field)
        } else if field.currentEditor() == nil {
            coordinator.resetFocusRequest()
        }
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: GajendraSearchTextField
        private var appliedFocusRequest = false
        private var pendingSelectionValue: String?
        private var pendingUserText: String?
        private weak var observedWindow: NSWindow?
        private var resignKeyObserver: NSObjectProtocol?

        init(parent: GajendraSearchTextField) {
            self.parent = parent
        }

        deinit {
            if let resignKeyObserver { NotificationCenter.default.removeObserver(resignKeyObserver) }
        }

        func observeWindow(of field: NSTextField) {
            guard let window = field.window, observedWindow !== window else { return }
            if let resignKeyObserver { NotificationCenter.default.removeObserver(resignKeyObserver) }
            observedWindow = window
            resignKeyObserver = NotificationCenter.default.addObserver(
                forName: NSWindow.didResignKeyNotification,
                object: window,
                queue: .main
            ) { [weak self, weak field] _ in
                guard let self else { return }
                (field as? GajendraSearchField)?.prepareForFocusEntry()
                self.pendingUserText = nil
                self.resetFocusRequest()
                self.parent.isFocused = false
            }
        }

        func reconcileText(in field: NSTextField, with value: String) {
            if let pendingUserText {
                if value == pendingUserText {
                    self.pendingUserText = nil
                } else if field.stringValue == pendingUserText {
                    return
                } else {
                    self.pendingUserText = nil
                }
            }
            if field.stringValue != value { field.stringValue = value }
        }

        func requestFocusIfNeeded(for field: NSTextField) {
            guard !appliedFocusRequest else { return }
            appliedFocusRequest = true
            pendingSelectionValue = field.stringValue
            parent.onFocusRequested()

            if field.window?.makeFirstResponder(field) == true {
                selectExistingTextIfUnchanged(in: field)
                return
            }

            DispatchQueue.main.async { [weak self, weak field] in
                guard let self, let field, self.parent.isFocused else { return }
                field.window?.makeFirstResponder(field)
                self.selectExistingTextIfUnchanged(in: field)
            }
        }

        func resetFocusRequest() {
            appliedFocusRequest = false
            pendingSelectionValue = nil
        }

        private func selectExistingTextIfUnchanged(in field: NSTextField) {
            guard let pendingSelectionValue else { return }
            self.pendingSelectionValue = nil
            guard !pendingSelectionValue.isEmpty,
                  pendingUserText == nil,
                  field.stringValue == pendingSelectionValue,
                  let editor = field.currentEditor() as? NSTextView else { return }
            (field as? GajendraSearchField)?.markFocusEntryHandled()
            editor.selectAll(nil)
        }

        func controlTextDidBeginEditing(_ notification: Notification) {
            guard let field = notification.object as? NSTextField else { return }
            if !appliedFocusRequest {
                appliedFocusRequest = true
                pendingSelectionValue = field.stringValue
                parent.onFocusRequested()
            }
            parent.isFocused = true
        }

        func controlTextDidChange(_ notification: Notification) {
            guard let field = notification.object as? NSTextField else { return }
            pendingSelectionValue = nil
            pendingUserText = field.stringValue
            (field as? GajendraSearchField)?.cancelPendingMouseSelection()
            if parent.text != field.stringValue { parent.text = field.stringValue }
        }

        func controlTextDidEndEditing(_ notification: Notification) {
            guard let field = notification.object as? NSTextField else { return }
            pendingSelectionValue = nil
            (field as? GajendraSearchField)?.prepareForFocusEntry()
            DispatchQueue.main.async { [weak self, weak field] in
                guard let self, let field, field.currentEditor() == nil else { return }
                self.pendingUserText = nil
                self.resetFocusRequest()
                self.parent.isFocused = false
            }
        }

        func control(
            _ control: NSControl,
            textView: NSTextView,
            doCommandBy commandSelector: Selector
        ) -> Bool {
            guard commandSelector == #selector(NSResponder.insertNewline(_:)) else { return false }
            parent.onSubmit()
            return true
        }
    }
}

public enum GajendraQueueEditHitTesting {
    public static func isSelfDrop(
        at point: CGPoint,
        sourceThreadId: String,
        taskFrames: [String: CGRect]
    ) -> Bool {
        taskFrames[sourceThreadId]?.contains(point) == true
    }

    public static func shouldExit(
        at point: CGPoint,
        taskFrames: [CGRect],
        editingAtPointerDown: Bool
    ) -> Bool {
        editingAtPointerDown && !taskFrames.contains(where: { $0.contains(point) })
    }
}

public enum GajendraQueueInteractionTuning {
    public static let stationaryPressMilliseconds = GajendraQueueInteractionPolicy.stationaryPressMilliseconds
    public static let movementTolerance = GajendraQueueInteractionPolicy.movementTolerance
    public static let dragMinimumDistance: CGFloat = 3
    public static let dragLiftScale: CGFloat = 1.035
    public static let holdToDragInstruction = "Hold to select; keep holding to drag"
    public static let reorderSpringResponse = 0.22
    public static let reorderSpringDamping = 0.9

    public static func dragPreviewScale(reduceMotion: Bool) -> CGFloat {
        reduceMotion ? 1 : dragLiftScale
    }
}

public struct GajendraCardInteractionState: Equatable, Sendable {
    public var isQueueEditing = false
    public var isSearchFocused = false
    public var isDragging = false

    public init(isQueueEditing: Bool = false, isSearchFocused: Bool = false, isDragging: Bool = false) {
        self.isQueueEditing = isQueueEditing
        self.isSearchFocused = isSearchFocused
        self.isDragging = isDragging
    }

    public var blocksSurfaceRefresh: Bool {
        isQueueEditing || isSearchFocused || isDragging
    }
}

public enum GajendraSurfaceRefreshPolicy {
    /// A conservative visible-surface cadence that avoids background provider polling while still
    /// allowing Running/Ready metadata to settle during an open card or status-item popover.
    public static let interval: TimeInterval = 30

    public static func shouldRefresh(
        surfaceIsVisible: Bool,
        modelIsLoading: Bool,
        modelIsMutating: Bool,
        interactionState: GajendraCardInteractionState
    ) -> Bool {
        surfaceIsVisible
            && !modelIsLoading
            && !modelIsMutating
            && !interactionState.blocksSurfaceRefresh
    }
}

/// Small state machine shared by the app delegate and deterministic tests. Refresh ownership
/// follows the actual visible surface: a floating card and a status-item popover are equivalent
/// visible surfaces, and their handoff must not briefly tear down the timer.
public struct GajendraSurfaceRefreshLifecycle: Equatable, Sendable {
    public private(set) var cardSurfaceVisible = false
    public private(set) var popoverVisible = false
    public private(set) var timerActive = false

    public init() {}

    public var surfaceIsVisible: Bool {
        cardSurfaceVisible || popoverVisible
    }

    public var shouldPoll: Bool {
        timerActive && surfaceIsVisible
    }

    public mutating func revealCard() {
        cardSurfaceVisible = true
        timerActive = true
    }

    public mutating func revealPopover() {
        popoverVisible = true
        timerActive = true
    }

    public mutating func handoffToCard() {
        popoverVisible = false
        cardSurfaceVisible = true
        timerActive = true
    }

    public mutating func closePopover(cardSurfaceVisible: Bool) {
        popoverVisible = false
        self.cardSurfaceVisible = cardSurfaceVisible
        timerActive = cardSurfaceVisible
    }

    public mutating func reconcile(cardSurfaceVisible: Bool, popoverVisible: Bool) {
        self.cardSurfaceVisible = cardSurfaceVisible
        self.popoverVisible = popoverVisible
        timerActive = cardSurfaceVisible || popoverVisible
    }

    public mutating func stop() {
        cardSurfaceVisible = false
        popoverVisible = false
        timerActive = false
    }
}

public enum GajendraSurfacePresentationPolicy {
    /// Closing the status-item popover must not tear down the timer for a floating card that
    /// is already being revealed during the same surface transition.
    public static func shouldStopRefreshOnPopoverClose(cardSurfaceVisible: Bool) -> Bool {
        !cardSurfaceVisible
    }
}

public final class GajendraCardInteractionSession: ObservableObject {
    @Published public private(set) var resetRevision = 0
    @Published public private(set) var state = GajendraCardInteractionState()

    public init() {}

    public func update(
        isQueueEditing: Bool,
        isSearchFocused: Bool,
        isDragging: Bool
    ) {
        state = GajendraCardInteractionState(
            isQueueEditing: isQueueEditing,
            isSearchFocused: isSearchFocused,
            isDragging: isDragging
        )
    }

    public func resetTransientState() {
        state = GajendraCardInteractionState()
        resetRevision &+= 1
    }
}

private struct GajendraQueueTaskFramePreferenceKey: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, newest in newest })
    }
}

private struct GajendraQueueColumnFramePreferenceKey: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, newest in newest })
    }
}

private final class GajendraQueueDragGeometry: ObservableObject {
    var taskFrames: [String: CGRect] = [:]
    var columnFrames: [String: CGRect] = [:]
}

struct GajendraLiveActivityMark: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulseExpanded = false
    let scale: CGFloat
    let animated: Bool

    init(scale: CGFloat = 1, animated: Bool = false) {
        self.scale = scale
        self.animated = animated
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.green.opacity(animated && !reduceMotion ? (pulseExpanded ? 0 : 0.28) : 0.14))
                .scaleEffect(animated && !reduceMotion ? (pulseExpanded ? 1.7 : 0.72) : 1)
            Circle()
                .stroke(Color.green.opacity(0.34), lineWidth: 0.7)
                .padding(2.25 * scale)
            Circle()
                .fill(Color.green)
                .padding(3.8 * scale)
        }
        .frame(width: 12 * scale, height: 12 * scale)
        .onAppear {
            guard animated, !reduceMotion else { return }
            pulseExpanded = false
            withAnimation(.easeOut(duration: 0.82)) {
                pulseExpanded = true
            }
        }
        .accessibilityLabel("Running now")
        .help("Provider reports active work")
    }
}

struct GajendraReviewStatusMark: View {
    let scale: CGFloat

    init(scale: CGFloat = 1) {
        self.scale = scale
    }

    var body: some View {
        Image(systemName: "checkmark.bubble.fill")
            .font(.system(size: 11 * scale, weight: .semibold))
            .foregroundStyle(Color.orange)
            .accessibilityLabel("Ready for Review")
            .help("Provider reports work ready for review")
    }
}

struct GajendraStatusCountBadge: View {
    @Environment(\.colorScheme) private var colorScheme
    let count: Int
    let tint: Color
    let scale: CGFloat

    init(count: Int, tint: Color, scale: CGFloat = 1) {
        self.count = count
        self.tint = tint
        self.scale = scale
    }

    var body: some View {
        Text("\(count)")
            .font(.system(size: 10 * scale, weight: .bold, design: .rounded).monospacedDigit())
            .foregroundStyle(count > 0 ? tint : Color.secondary)
            .frame(minWidth: 20 * scale, minHeight: 18 * scale)
            .padding(.horizontal, 2 * scale)
            .background(
                tint.opacity(count > 0 ? (colorScheme == .dark ? 0.2 : 0.13) : 0.045),
                in: Capsule()
            )
            .overlay(
                Capsule()
                    .stroke(tint.opacity(count > 0 ? 0.58 : 0.16), lineWidth: 1)
            )
            .accessibilityLabel("\(count)")
    }
}

public struct GajendraHoverCardView: View {
    @ObservedObject private var model: DeckViewModel
    @ObservedObject private var visualSettings: GajendraVisualSettings
    @ObservedObject private var interactionSession: GajendraCardInteractionSession
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var hoveredThreadId: String?
    @State private var isNowHovered = false
    @State private var isSearchHovered = false
    @State private var isRunningHeaderHovered = false
    @State private var isRunningExpanded = true
    @State private var isReviewHeaderHovered = false
    @State private var isReviewExpanded = true
    @State private var searchQuery: String
    @State private var searchFocused = false
    @State private var isQueueEditing: Bool
    @State private var targetedQueueThreadId: String?
    @State private var targetedQueueLevel: PriorityLevel?
    @State private var draggingQueueThreadId: String?
    @State private var queueDragLocation: CGPoint?
    @State private var heldQueueThreadId: String?
    @State private var selectedQueueThreadId: String?
    @State private var suppressedQueueOpenThreadId: String?
    @State private var queueEditingAtPointerDown: Bool?
    @StateObject private var queueDragGeometry = GajendraQueueDragGeometry()
    private let isPreview: Bool
    private let onOpenOrganizer: () -> Void
    private let onManageSources: () -> Void
    private let onDismiss: () -> Void
    private let onSearchFocusRequested: () -> Void

    public init(
        model: DeckViewModel,
        visualSettings: GajendraVisualSettings,
        interactionSession: GajendraCardInteractionSession = GajendraCardInteractionSession(),
        isPreview: Bool = false,
        previewSearchQuery: String = "",
        previewQueueEditing: Bool = false,
        onOpenOrganizer: @escaping () -> Void = {},
        onManageSources: @escaping () -> Void = {},
        onDismiss: @escaping () -> Void = {},
        onSearchFocusRequested: @escaping () -> Void = {}
    ) {
        self.model = model
        self.visualSettings = visualSettings
        self.interactionSession = interactionSession
        self.isPreview = isPreview
        _searchQuery = State(initialValue: previewSearchQuery)
        _isQueueEditing = State(initialValue: previewQueueEditing)
        self.onOpenOrganizer = onOpenOrganizer
        self.onManageSources = onManageSources
        self.onDismiss = onDismiss
        self.onSearchFocusRequested = onSearchFocusRequested
    }

    public var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
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

                if let queueDragLocation,
                   let draggingQueueThreadId,
                   let thread = model.snapshot?.allThreads.first(where: { $0.id == draggingQueueThreadId }) {
                    GajendraQueueDragPreview(thread: thread, scale: contentScale)
                        .frame(width: min(260 * contentScale, max(220, proxy.size.width - 32)))
                        .position(
                            x: min(max(queueDragLocation.x + 118 * contentScale, 118 * contentScale), max(118 * contentScale, proxy.size.width - 118 * contentScale)),
                            y: min(max(queueDragLocation.y - 22 * contentScale, 28 * contentScale), max(28 * contentScale, proxy.size.height - 28 * contentScale))
                        )
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                        .transition(.opacity.combined(with: .scale(scale: reduceMotion ? 1 : 0.94)))
                }
            }
        }
        .coordinateSpace(name: "gajendra-hover-card")
        .contentShape(Rectangle())
        .simultaneousGesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .named("gajendra-hover-card"))
                .onChanged { _ in
                    if queueEditingAtPointerDown == nil {
                        queueEditingAtPointerDown = isQueueEditing
                    }
                }
                .onEnded { event in
                    let editingAtPointerDown = queueEditingAtPointerDown ?? isQueueEditing
                    queueEditingAtPointerDown = nil
                    guard GajendraQueueEditHitTesting.shouldExit(
                        at: event.location,
                        taskFrames: Array(queueDragGeometry.taskFrames.values),
                        editingAtPointerDown: editingAtPointerDown
                    ) else { return }
                    setQueueEditing(false)
                }
        )
        .onPreferenceChange(GajendraQueueTaskFramePreferenceKey.self) { frames in
            queueDragGeometry.taskFrames = frames
        }
        .onPreferenceChange(GajendraQueueColumnFramePreferenceKey.self) { frames in
            queueDragGeometry.columnFrames = frames
        }
        .onExitCommand {
            if isQueueEditing {
                setQueueEditing(false)
            } else {
                onDismiss()
            }
        }
        .onChange(of: searchFocused) { focused in
            if focused && isQueueEditing {
                setQueueEditing(false)
            }
        }
        .onChange(of: normalizedSearchQuery) { query in
            if !query.isEmpty && isQueueEditing {
                setQueueEditing(false)
            }
        }
        .onChange(of: interactionSession.resetRevision) { _ in
            resetQueueEditing()
        }
        .onAppear {
            publishInteractionState()
        }
        .onDisappear {
            interactionSession.update(isQueueEditing: false, isSearchFocused: false, isDragging: false)
        }
        .onChange(of: isQueueEditing) { _ in
            publishInteractionState()
        }
        .onChange(of: searchFocused) { _ in
            publishInteractionState()
        }
        .onChange(of: draggingQueueThreadId) { _ in
            publishInteractionState()
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: model.errorMessage)
    }

    private func publishInteractionState() {
        interactionSession.update(
            isQueueEditing: isQueueEditing,
            isSearchFocused: searchFocused,
            isDragging: draggingQueueThreadId != nil
        )
    }

    private var cardLayout: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .allowsHitTesting(!isQueueEditing)
            Divider().padding(.top, 8)
            if let snapshot = model.snapshot {
                if isPreview {
                    GeometryReader { proxy in
                        scrollableCardContent(snapshot)
                            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)
                            .clipped()
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollViewReader { proxy in
                        ScrollView(.vertical, showsIndicators: true) {
                            scrollableCardContent(snapshot)
                        }
                        .onChange(of: normalizedSearchQuery) { _ in
                            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.16)) {
                                proxy.scrollTo("gajendra-card-scroll-top", anchor: .top)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityLabel("Scrollable Gajendra task overview")
                }

                persistentSearchFooter(total: snapshot.allThreads.count)
                    .allowsHitTesting(!isQueueEditing)
            } else {
                VStack(spacing: 8 * contentScale) {
                    if model.isLoading {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text(model.isLoading ? "Reading your configured thread sources…" : "No thread data is available yet.")
                        .font(scaledFont(12, weight: .regular))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                .accessibilityElement(children: .combine)
            }
            footer
                .padding(.top, 8)
                .allowsHitTesting(!isQueueEditing)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func scrollableCardContent(_ snapshot: DeckSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear
                .frame(height: 0)
                .id("gajendra-card-scroll-top")
            nowSection
                .padding(.vertical, 10)
                .allowsHitTesting(!isQueueEditing)
            if normalizedSearchQuery.isEmpty {
                queueSummary
                runningSummary(snapshot.runningThreads)
                    .padding(.top, 8 * contentScale)
                    .allowsHitTesting(!isQueueEditing)
                reviewReadySummary(snapshot.reviewReadyThreads)
                    .padding(.top, 8 * contentScale)
                    .allowsHitTesting(!isQueueEditing)
            } else {
                searchResults(snapshot.searchThreads(searchQuery))
            }
            Spacer(minLength: 8 * contentScale)
        }
        .padding(.trailing, 3 * contentScale)
    }

    private var header: some View {
        ZStack(alignment: .center) {
            VStack(alignment: .center, spacing: 1) {
                Text(GajendraBrandCopy.name)
                    .font(scaledFont(17, weight: .semibold))
                Text(GajendraBrandCopy.descriptor)
                    .font(scaledFont(11, weight: .regular))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, alignment: .center)

            HStack(spacing: 10 * contentScale) {
                GajendraMark(size: 34 * contentScale)
                    .frame(width: 42 * contentScale, height: 42 * contentScale)

                Spacer(minLength: 12 * contentScale)

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
                    if model.isMutating {
                        HStack(spacing: 3) {
                            ProgressView()
                                .controlSize(.mini)
                            Text("Saving…")
                                .font(scaledFont(10, weight: .regular))
                        }
                        .foregroundStyle(.secondary)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Saving priority change")
                        .accessibilityValue("Busy")
                    }
                    refreshControl
                    if isPreview {
                        settingsIcon
                    } else {
                        visualSettingsMenu
                    }
                }
                .fixedSize()
            }
        }
        .frame(height: 42 * contentScale, alignment: .center)
    }

    private var visualSettingsMenu: some View {
        Menu {
            Button {
                onManageSources()
            } label: {
                Label("Manage AI tools…", systemImage: "point.3.connected.trianglepath.dotted")
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
        .gajendraHoverSurface()
        .help("Gajendra settings")
        .accessibilityLabel("Open Gajendra settings")
        .accessibilityHint("Manage AI tools or choose theme, appearance, card size, and lotus position")
    }

    private var settingsIcon: some View {
        Image(systemName: "gearshape")
            .font(scaledFont(13, weight: .medium))
            .foregroundStyle(.secondary)
            .frame(width: 28, height: 28)
        .contentShape(RoundedRectangle(cornerRadius: 10 * contentScale, style: .continuous))
    }

    @ViewBuilder
    private var nowSection: some View {
        if let current = model.snapshot?.current {
            HStack(alignment: .center, spacing: 14 * contentScale) {
                VStack(alignment: .leading, spacing: 7 * contentScale) {
                    HStack(spacing: 6) {
                        Image(systemName: visualSettings.theme == .focusDeck ? "star.fill" : "scope")
                        Text("NOW")
                        Text("Current focus")
                            .font(scaledFont(10.5, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    .font(scaledFont(12.5, weight: .bold))
                    .foregroundStyle(Color.gajendraAccent(for: colorScheme))

                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Text(current.title)
                            .font(scaledFont(17, weight: .semibold))
                            .lineLimit(visualSettings.hoverCardSize == .compact ? 2 : 3)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        if current.isReadyForReview {
                            GajendraReviewStatusMark(scale: contentScale)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background {
                        GeometryReader { proxy in
                            Color.clear.preference(
                                key: GajendraHostedLayoutEvidenceKey.self,
                                value: GajendraHostedLayoutEvidence(
                                    metadataFrame: proxy.frame(in: .named(GajendraHostedLayoutEvidenceKey.coordinateSpaceName))
                                )
                            )
                        }
                    }

                    HStack(spacing: 7) {
                        Text(current.project)
                            .font(scaledFont(11.5, weight: .regular))
                            .lineLimit(1)
                            .foregroundStyle(.secondary)
                        if let context = current.context {
                            contextBadge(context)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                HStack(alignment: .center, spacing: 7) {
                    Button { model.open(current) } label: {
                        Text("Open")
                            .font(scaledFont(11.5, weight: .semibold))
                            .foregroundStyle(openButtonForeground)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .tint(openButtonTint)
                    .fixedSize()
                    .accessibilityIdentifier("gajendra-primary-open")
                    .accessibilityLabel("Open Gajendra")
                    .background {
                        GeometryReader { proxy in
                            Color.clear.preference(
                                key: GajendraHostedLayoutEvidenceKey.self,
                                value: GajendraHostedLayoutEvidence(
                                    primaryActionFrame: proxy.frame(in: .named(GajendraHostedLayoutEvidenceKey.coordinateSpaceName))
                                )
                            )
                        }
                    }
                    executionSignal(current)
                    Button { model.open(current) } label: { sourceBadge(current) }
                        .buttonStyle(.plain)
                        .help("Open in \(current.sourceName)")
                }
                .fixedSize(horizontal: true, vertical: false)
            }
            .padding(.horizontal, 13 * contentScale)
            .padding(.vertical, 11 * contentScale)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(nowSurfaceColor)
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(isNowHovered ? Color.primary.opacity(0.055) : Color.clear)
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(
                        Color.gajendraAccent(for: colorScheme).opacity(
                            isNowHovered ? 0.78 : (visualSettings.theme == .focusDeck ? 0.72 : 0.42)
                        ),
                        lineWidth: isNowHovered ? 1.25 : 1
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .onHover { isNowHovered = $0 }
            .onTapGesture(count: 2) {
                model.open(current)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("\(current.title), \(current.sourceName), NOW")
            .accessibilityHint("Double-click anywhere on this NOW card to open the thread")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction {
                model.open(current)
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isNowHovered)
        } else if model.isLoading {
            Text("Reading your configured thread sources…")
                .font(scaledFont(13, weight: .regular))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 18)
        } else {
            Text("Choose one Focus thread as NOW in Gajendra.")
                .font(scaledFont(13, weight: .regular))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 18)
        }
    }

    @ViewBuilder
    private var queueSummary: some View {
        if let snapshot = model.snapshot {
            VStack(alignment: .leading, spacing: 6 * contentScale) {
                queueInteractionBar
                HStack(alignment: .top, spacing: 10 * contentScale) {
                    queueColumn(
                        title: "Focus",
                        systemImage: "star.fill",
                        level: .focus,
                        threads: snapshot.focus.filter { !$0.isCurrent }
                    )
                    queueColumn(
                        title: "Important",
                        systemImage: "bookmark.fill",
                        level: .important,
                        threads: snapshot.important
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var queueInteractionBar: some View {
        if isQueueEditing {
            queueEditModeBar
        } else {
            HStack(spacing: 7 * contentScale) {
                Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                    .font(scaledFont(10.5, weight: .semibold))
                Text(GajendraQueueInteractionTuning.holdToDragInstruction)
                    .font(scaledFont(10.5, weight: .medium))
                Spacer(minLength: 8)
                Button("Edit") {
                    setQueueEditing(true)
                }
                .font(scaledFont(10.5, weight: .semibold))
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(queueInteractionBlocked)
                .accessibilityLabel("Edit priorities")
            }
            .foregroundStyle(.secondary)
            .padding(.leading, 10 * contentScale)
            .padding(.trailing, 6 * contentScale)
            .frame(maxWidth: .infinity, minHeight: 30 * contentScale)
            .background(
                Color.primary.opacity(0.025),
                in: RoundedRectangle(cornerRadius: 9, style: .continuous)
            )
        }
    }

    private var queueEditModeBar: some View {
        HStack(spacing: 7 * contentScale) {
            Image(systemName: "hand.draw.fill")
                .font(scaledFont(10.5, weight: .semibold))
            Text("Editing priorities")
                .font(scaledFont(11, weight: .semibold))
            Text("Drag any task")
                .font(scaledFont(10, weight: .regular))
                .foregroundStyle(.secondary)
            Spacer(minLength: 8)
            Button("Done") {
                setQueueEditing(false)
            }
            .font(scaledFont(10.5, weight: .semibold))
            .buttonStyle(.bordered)
            .controlSize(.small)
            .accessibilityLabel("Done editing priorities")
        }
        .foregroundStyle(Color.gajendraAccent(for: colorScheme))
        .padding(.leading, 10 * contentScale)
        .padding(.trailing, 6 * contentScale)
        .frame(maxWidth: .infinity, minHeight: 30 * contentScale)
        .background(
            Color.gajendraAccent(for: colorScheme).opacity(colorScheme == .dark ? 0.1 : 0.075),
            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .stroke(Color.gajendraAccent(for: colorScheme).opacity(0.26), lineWidth: 0.75)
        )
        .transition(.move(edge: .top).combined(with: .opacity))
        .accessibilityElement(children: .contain)
        .contentShape(Rectangle())
        .onTapGesture {
            setQueueEditing(false)
        }
    }

    private func queueColumn(
        title: String,
        systemImage: String,
        level: PriorityLevel,
        threads: [DeckThread]
    ) -> some View {
        let visibleThreads = Array(threads.prefix(5))
        let column = VStack(alignment: .leading, spacing: 0) {
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
                ForEach(Array(visibleThreads.enumerated()), id: \.element.id) { index, thread in
                    queueRow(
                        thread,
                        level: level,
                        index: index,
                        count: threads.count,
                        showsTopDivider: index > 0
                    )
                }
            }
            if threads.count > 5 {
                Divider()
                moreButton(remaining: threads.count - 5, title: title)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(queueSurfaceColor(title), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(
                    queueDragIsActive && targetedQueueLevel == level
                        ? Color.gajendraAccent(for: colorScheme).opacity(0.8)
                        : Color.primary.opacity(0.08),
                    lineWidth: queueDragIsActive && targetedQueueLevel == level ? 1.25 : 0.5
                )
        )
        .animation(queueMovementAnimation, value: visibleThreads.map(\.id))
        .animation(reduceMotion ? nil : .spring(response: 0.18, dampingFraction: 0.9), value: targetedQueueLevel)
        .background {
            GeometryReader { proxy in
                Color.clear.preference(
                    key: GajendraQueueColumnFramePreferenceKey.self,
                    value: [level.rawValue: proxy.frame(in: .named("gajendra-hover-card"))]
                )
            }
        }
        return column
    }

    private func queueRow(
        _ thread: DeckThread,
        level: PriorityLevel,
        index: Int,
        count: Int,
        showsTopDivider: Bool
    ) -> some View {
        let accessibilityTargetLevel: PriorityLevel
        let accessibilityMoveActionName: String
        switch level {
        case .focus:
            accessibilityTargetLevel = .important
            accessibilityMoveActionName = "Move to Important"
        case .important:
            accessibilityTargetLevel = .focus
            accessibilityMoveActionName = "Move to Focus"
        }
        let isHeld = heldQueueThreadId == thread.id || selectedQueueThreadId == thread.id
        let rowLabel = VStack(alignment: .leading, spacing: 2 * contentScale) {
            HStack(alignment: .firstTextBaseline, spacing: 7) {
                if thread.isRunning {
                    GajendraLiveActivityMark(scale: contentScale)
                } else if thread.isReadyForReview {
                    GajendraReviewStatusMark(scale: contentScale)
                }
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
        .padding(.leading, (isQueueEditing ? 32 : 10) * contentScale)
        .padding(.trailing, 10 * contentScale)
        .padding(.vertical, 6 * contentScale)
        .frame(maxWidth: .infinity, minHeight: 39 * contentScale, alignment: .leading)
        .overlay(alignment: .top) {
            if showsTopDivider {
                Divider()
            }
        }
        .contentShape(Rectangle())

        let visualRow = ZStack(alignment: .leading) {
            // Keep the sequenced hold/drag gesture's source view alive while the pointer is
            // down. Switching to the edit-only surface at recognition time would cancel the
            // same-pointer hold-then-drag before it can reach its drop target.
            let useDirectEditSurface = isQueueEditing
                && heldQueueThreadId != thread.id
            if useDirectEditSurface {
                directQueueDragSurface(rowLabel, thread: thread)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(hoveredThreadId == thread.id ? rowHoverColor : Color.clear)
                    )
            } else {
                Button {
                    guard suppressedQueueOpenThreadId != thread.id else {
                        suppressedQueueOpenThreadId = nil
                        return
                    }
                    model.open(thread)
                } label: {
                    rowLabel
                }
                .buttonStyle(
                    GajendraThreadRowButtonStyle(
                        isHovered: hoveredThreadId == thread.id,
                        hoverColor: rowHoverColor,
                        pressedColor: rowPressedColor
                    )
                )
                .simultaneousGesture(
                    LongPressGesture(
                        minimumDuration: Double(GajendraQueueInteractionTuning.stationaryPressMilliseconds) / 1_000,
                        maximumDistance: GajendraQueueInteractionTuning.movementTolerance
                    )
                    .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .named("gajendra-hover-card")))
                    .onChanged { value in
                        guard !queueInteractionBlocked,
                              !isQueueEditing || heldQueueThreadId == thread.id || draggingQueueThreadId == thread.id else {
                            return
                        }
                        switch value {
                        case .first(true):
                            if heldQueueThreadId != thread.id {
                                heldQueueThreadId = thread.id
                            }
                            selectedQueueThreadId = thread.id
                        case let .second(true, drag):
                            heldQueueThreadId = thread.id
                            selectedQueueThreadId = thread.id
                            suppressedQueueOpenThreadId = thread.id
                            setQueueEditing(true)
                            if let drag {
                                updateQueueDrag(threadId: thread.id, at: drag.location)
                            }
                        default:
                            break
                        }
                    }
                    .onEnded { value in
                        guard !queueInteractionBlocked else {
                            heldQueueThreadId = nil
                            selectedQueueThreadId = nil
                            return
                        }
                        switch value {
                        case .first(true):
                            selectedQueueThreadId = thread.id
                            suppressedQueueOpenThreadId = thread.id
                            setQueueEditing(true)
                        case let .second(true, drag):
                            selectedQueueThreadId = thread.id
                            suppressedQueueOpenThreadId = thread.id
                            setQueueEditing(true)
                            if let drag {
                                finishQueueDrag(threadId: thread.id, at: drag.location)
                            }
                        default:
                            break
                        }
                        heldQueueThreadId = nil
                    }
                )
                .disabled(queueInteractionBlocked)
            }

            if isQueueEditing {
                queueJiggle {
                    Button {
                        removeQueueThread(thread, from: level)
                    } label: {
                        Image(systemName: "xmark")
                            .font(scaledFont(8.5, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(width: 20 * contentScale, height: 20 * contentScale)
                            .background(
                                LinearGradient(
                                    colors: [removeControlRed.opacity(0.96), removeControlRed.opacity(0.74)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                in: Circle()
                            )
                            .overlay(
                                Circle()
                                    .stroke(Color.white.opacity(colorScheme == .dark ? 0.3 : 0.5), lineWidth: 0.65)
                            )
                    }
                    .buttonStyle(
                        GajendraRemoveTaskButtonStyle(
                            color: removeControlRed,
                            reduceMotion: reduceMotion
                        )
                    )
                    .disabled(queueInteractionBlocked)
                    .help("Remove from \(level.title). The task stays in \(thread.sourceName).")
                    .accessibilityIdentifier("gajendra-widget-remove-task")
                    .accessibilityLabel("Remove \(thread.title) from \(level.title)")
                }
                .padding(.leading, 6 * contentScale)
            }

        }
        .contentShape(Rectangle())
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(
                    targetedQueueThreadId == thread.id || isHeld
                        ? Color.gajendraAccent(for: colorScheme).opacity(0.9)
                        : Color.clear,
                    lineWidth: isHeld ? 1.5 : 1.25
                )
                .allowsHitTesting(false)
        )
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(isHeld ? rowPressedColor.opacity(0.9) : Color.clear)
                .allowsHitTesting(false)
        )
        .onHover { hovered in
            hoveredThreadId = hovered ? thread.id : (hoveredThreadId == thread.id ? nil : hoveredThreadId)
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: targetedQueueThreadId)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.14), value: heldQueueThreadId)
        .background {
            GeometryReader { proxy in
                Color.clear.preference(
                    key: GajendraQueueTaskFramePreferenceKey.self,
                    value: [thread.id: proxy.frame(in: .named("gajendra-hover-card"))]
                )
            }
        }
        .contextMenu {
            queueRowContextMenu(
                thread: thread,
                level: level,
                index: index,
                count: count,
                targetLevel: accessibilityTargetLevel,
                moveActionName: accessibilityMoveActionName
            )
        }

        let row = queueRowAccessibility(
            visualRow,
            thread: thread,
            level: level,
            index: index,
            count: count,
            targetLevel: accessibilityTargetLevel,
            moveActionName: accessibilityMoveActionName
        )

        return row
    }

    private func queueRowAccessibility<Content: View>(
        _ content: Content,
        thread: DeckThread,
        level: PriorityLevel,
        index: Int,
        count: Int,
        targetLevel: PriorityLevel,
        moveActionName: String
    ) -> some View {
        let canMoveUp = !queueInteractionBlocked && index > 0
        let canMoveDown = !queueInteractionBlocked && index < count - 1

        return content
        .help(isQueueEditing ? "Drag anywhere on the task to reorder, or use the X to remove from \(level.title)" : "Open \(thread.title) in \(thread.sourceName). Hold to select; keep holding to drag.")
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            "\(thread.title), \(thread.sourceName)\(thread.isRunning ? ", Running now" : thread.isReadyForReview ? ", Ready for Review" : "")"
        )
        .accessibilityValue(
            queueInteractionBlocked
                ? "Busy; unavailable"
                : (draggingQueueThreadId == thread.id
                    ? "Dragging"
                    : (targetedQueueThreadId == thread.id
                        ? "Drop target"
                        : (selectedQueueThreadId == thread.id ? "Selected" : "Ready")))
        )
        .accessibilityHint(
            queueInteractionBlocked
                ? "Priority change in progress. This row is unavailable until it finishes."
                : (isQueueEditing ? "Priority editing is active. Drag this task or use the remove action." : "Open this thread. Hold to select; keep holding to drag.")
        )
        .disabled(queueInteractionBlocked)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction {
            guard !queueInteractionBlocked, !isQueueEditing else { return }
            model.open(thread)
        }
        .accessibilityAction(named: Text(isQueueEditing ? "Done editing priorities" : "Edit priorities")) {
            guard !queueInteractionBlocked else { return }
            setQueueEditing(!isQueueEditing)
        }
        .accessibilityAction(named: Text("Move up")) {
            guard canMoveUp else { return }
            _ = model.performAccessibilityMutation(
                .move(threadId: thread.id, direction: .up),
                actionName: "Move up"
            )
        }
        .accessibilityAction(named: Text("Move down")) {
            guard canMoveDown else { return }
            _ = model.performAccessibilityMutation(
                .move(threadId: thread.id, direction: .down),
                actionName: "Move down"
            )
        }
        .accessibilityAction(named: Text(moveActionName)) {
            guard !queueInteractionBlocked else { return }
            _ = model.performAccessibilityMove(
                threadId: thread.id,
                level: targetLevel,
                actionName: moveActionName
            )
        }
        .accessibilityAction(named: Text("Remove from \(level.title)")) {
            guard !queueInteractionBlocked else { return }
            removeQueueThread(thread, from: level)
        }
    }

    @ViewBuilder
    private func queueRowContextMenu(
        thread: DeckThread,
        level: PriorityLevel,
        index: Int,
        count: Int,
        targetLevel: PriorityLevel,
        moveActionName: String
    ) -> some View {
        Button(isQueueEditing ? "Done Editing" : "Edit Priorities") {
            setQueueEditing(!isQueueEditing)
        }
        Divider()
        Button("Move Up") {
            model.apply(.move(threadId: thread.id, direction: .up))
        }
        .disabled(index == 0 || queueInteractionBlocked)
        Button("Move Down") {
            model.apply(.move(threadId: thread.id, direction: .down))
        }
        .disabled(index == count - 1 || queueInteractionBlocked)
        Button(moveActionName) {
            model.moveToLevel(threadId: thread.id, level: targetLevel)
        }
        .disabled(queueInteractionBlocked)
        Divider()
        Button("Remove from \(level.title)", role: .destructive) {
            removeQueueThread(thread, from: level)
        }
        .disabled(queueInteractionBlocked)
    }

    @ViewBuilder
    private func queueJiggle<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        if reduceMotion || isPreview {
            content()
        } else {
            GajendraJigglingView(content: content)
        }
    }

    private func removeQueueThread(_ thread: DeckThread, from level: PriorityLevel) {
        guard thread.level == level else { return }
        model.moveToLevel(threadId: thread.id, level: nil)
    }

    private func setQueueEditing(_ editing: Bool, animated: Bool = true) {
        withAnimation(reduceMotion || !animated ? nil : .easeOut(duration: 0.16)) {
            isQueueEditing = editing
        }
        if !editing {
            queueEditingAtPointerDown = nil
            suppressedQueueOpenThreadId = nil
            heldQueueThreadId = nil
            selectedQueueThreadId = nil
            draggingQueueThreadId = nil
            queueDragLocation = nil
            targetedQueueThreadId = nil
            targetedQueueLevel = nil
        }
    }

    private func resetQueueEditing() {
        isQueueEditing = false
        queueEditingAtPointerDown = nil
        draggingQueueThreadId = nil
        queueDragLocation = nil
        heldQueueThreadId = nil
        selectedQueueThreadId = nil
        suppressedQueueOpenThreadId = nil
        targetedQueueThreadId = nil
        targetedQueueLevel = nil
    }

    private func moveQueueThread(_ threadId: String, to level: PriorityLevel, before targetId: String?) -> Bool {
        if threadId == targetId { return true }
        guard !queueInteractionBlocked,
              let snapshot = model.snapshot,
              !(targetId == nil
                && snapshot.allThreads.first(where: { $0.id == threadId })?.level == level
                && GajendraQueueMovePlanner.lane(for: level, snapshot: snapshot).last?.id == threadId) else { return false }
        targetedQueueThreadId = nil
        targetedQueueLevel = nil
        model.moveToLevel(
            threadId: threadId,
            level: level,
            beforeThreadId: targetId,
            actionName: "Move priority"
        )
        if !isQueueEditing {
            setQueueEditing(true)
        }
        return true
    }

    private func updateQueueDrag(threadId: String, at point: CGPoint) {
        guard !queueInteractionBlocked else { return }
        selectedQueueThreadId = threadId
        if draggingQueueThreadId != threadId {
            draggingQueueThreadId = threadId
        }
        queueDragLocation = point
        updateQueueDropTarget(at: point, sourceThreadId: threadId)
    }

    private func directQueueDragSurface<Content: View>(
        _ content: Content,
        thread: DeckThread
    ) -> some View {
        content
            .highPriorityGesture(
                DragGesture(minimumDistance: GajendraQueueInteractionTuning.dragMinimumDistance, coordinateSpace: .named("gajendra-hover-card"))
                    .onChanged { value in
                        guard !queueInteractionBlocked else { return }
                        updateQueueDrag(threadId: thread.id, at: value.location)
                    }
                    .onEnded { value in
                        finishQueueDrag(threadId: thread.id, at: value.location)
                    }
            )
    }

    private func updateQueueDropTarget(at point: CGPoint, sourceThreadId: String) {
        if GajendraQueueEditHitTesting.isSelfDrop(
            at: point,
            sourceThreadId: sourceThreadId,
            taskFrames: queueDragGeometry.taskFrames
        ) {
            // A stationary hold that ends on its own row is a selection/no-op, never an
            // implicit append to whichever column happens to contain that frame.
            setQueueDropTarget(threadId: nil, level: nil)
            return
        }
        if let target = queueDragGeometry.taskFrames.first(where: {
            $0.key != sourceThreadId && $0.value.contains(point)
        }), let level = model.snapshot?.allThreads.first(where: { $0.id == target.key })?.level {
            setQueueDropTarget(threadId: target.key, level: level)
            return
        }
        if let column = queueDragGeometry.columnFrames.first(where: { $0.value.contains(point) }),
           let level = PriorityLevel(rawValue: column.key) {
            setQueueDropTarget(threadId: nil, level: level)
            return
        }
        setQueueDropTarget(threadId: nil, level: nil)
    }

    private func setQueueDropTarget(threadId: String?, level: PriorityLevel?) {
        if targetedQueueThreadId != threadId { targetedQueueThreadId = threadId }
        if targetedQueueLevel != level { targetedQueueLevel = level }
    }

    private func finishQueueDrag(threadId: String, at point: CGPoint) {
        updateQueueDropTarget(at: point, sourceThreadId: threadId)
        let targetLevel = targetedQueueLevel
        let targetThreadId = targetedQueueThreadId
        draggingQueueThreadId = nil
        queueDragLocation = nil
        heldQueueThreadId = nil
        targetedQueueThreadId = nil
        targetedQueueLevel = nil
        guard let targetLevel else { return }
        _ = moveQueueThread(threadId, to: targetLevel, before: targetThreadId)
    }

    private var queueDragIsActive: Bool {
        isQueueEditing || draggingQueueThreadId != nil
    }

    private var queueInteractionBlocked: Bool {
        // A snapshot refresh retains the last valid visible snapshot, and DeckViewModel queues a
        // resulting priority intent behind that read. Only an actual mutation blocks another
        // pointer or accessibility priority action.
        model.isMutating
    }

    private var queueMovementAnimation: Animation? {
        reduceMotion
            ? nil
            : .interactiveSpring(
                response: GajendraQueueInteractionTuning.reorderSpringResponse,
                dampingFraction: GajendraQueueInteractionTuning.reorderSpringDamping,
                blendDuration: 0.04
            )
    }

    @ViewBuilder
    private func moreButton(remaining: Int, title: String) -> some View {
        if isPreview {
            HStack(spacing: 5) {
                Text("Show \(remaining) more in Organizer")
                Image(systemName: "chevron.right")
                    .font(scaledFont(8, weight: .bold))
            }
            .font(scaledFont(10.5, weight: .medium))
            .foregroundStyle(Color.gajendraAccent(for: colorScheme))
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.horizontal, 10 * contentScale)
            .padding(.vertical, 5 * contentScale)
        } else {
            Button(action: onOpenOrganizer) {
                HStack(spacing: 5) {
                    Text("Show \(remaining) more in Organizer")
                    Image(systemName: "chevron.right")
                        .font(scaledFont(8, weight: .bold))
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.horizontal, 10 * contentScale)
                .padding(.vertical, 5 * contentScale)
                .contentShape(Rectangle())
            }
            .font(scaledFont(10.5, weight: .medium))
            .buttonStyle(.plain)
            .foregroundStyle(Color.gajendraAccent(for: colorScheme))
            .gajendraHoverSurface(cornerRadius: 6)
            .help("View all \(title) tasks in the organizer")
            .accessibilityLabel("Show \(remaining) more \(title) tasks in the organizer")
            .allowsHitTesting(!isQueueEditing)
        }
    }

    private func executionSignal(_ thread: DeckThread) -> some View {
        HStack(spacing: 7) {
            if thread.isRunning {
                GajendraLiveActivityMark(scale: contentScale)
            } else if thread.isReadyForReview {
                GajendraReviewStatusMark(scale: contentScale)
            } else {
                Image(systemName: "clock")
                    .font(scaledFont(10, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(thread.isRunning ? "Running now" : thread.isReadyForReview ? "Ready for Review" : "Ready to resume")
                    .font(scaledFont(10.5, weight: .semibold))
                    .lineLimit(1)
                Text(isPreview
                     ? (thread.isReadyForReview ? "Ready recently" : "Updated recently")
                     : thread.isReadyForReview
                        ? relativeReviewText(thread.review?.updatedAt ?? 0)
                        : relativeUpdateText(thread.updatedAt))
                    .font(scaledFont(9.5, weight: .regular))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 8 * contentScale)
        .padding(.vertical, 6 * contentScale)
        .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(
                    thread.isRunning
                        ? Color.green.opacity(0.3)
                        : thread.isReadyForReview ? Color.orange.opacity(0.34) : Color.primary.opacity(0.08),
                    lineWidth: 0.75
                )
        )
        .fixedSize()
        .help("Provider status: \(thread.status)")
        .accessibilityElement(children: .combine)
    }

    private func runningSummary(_ threads: [DeckThread]) -> some View {
        LazyVStack(alignment: .leading, spacing: 0) {
            if threads.isEmpty {
                HStack(spacing: 0) {
                    runningDisclosureHeader(count: 0)
                    runningDisclosureControl(count: 0, expanded: false)
                        .padding(.trailing, 10 * contentScale)
                }
                Divider()
                Text("No provider reports active work")
                    .font(scaledFont(10.5, weight: .regular))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10 * contentScale)
                    .padding(.vertical, 8 * contentScale)
            } else {
                HStack(spacing: 0) {
                    runningDisclosureHeader(count: threads.count)
                        .contentShape(Rectangle())
                        .background(
                            isRunningHeaderHovered
                                ? Color.green.opacity(colorScheme == .dark ? 0.1 : 0.07)
                                : Color.clear,
                            in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                        )
                        .onHover { isRunningHeaderHovered = $0 }
                        .onTapGesture(count: 2) {
                            toggleRunningDock()
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityAddTraits(.isButton)
                        .accessibilityAction {
                            toggleRunningDock()
                        }
                        .accessibilityLabel("Running, \(threads.count) active threads")
                        .accessibilityValue(isRunningExpanded ? "Expanded" : "Collapsed")
                        .accessibilityHint(
                            "Double-click the dock or click All priority lanes to "
                                + "\(isRunningExpanded ? "collapse" : "expand") the running thread list"
                        )
                        .help("Double-click to \(isRunningExpanded ? "shrink" : "expand") Running")
                    runningDisclosureControl(count: threads.count, expanded: isRunningExpanded)
                        .padding(.trailing, 10 * contentScale)
                }

                Divider()
                if isRunningExpanded {
                    ForEach(Array(threads.enumerated()), id: \.element.id) { index, thread in
                        Button { model.open(thread) } label: {
                            runningRow(thread)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .gajendraHoverSurface(cornerRadius: 6)
                        .help("Open \(thread.title) in \(thread.sourceName)")
                        .accessibilityLabel("\(thread.title), \(thread.sourceName), Running now")
                        if index < threads.count - 1 { Divider() }
                    }
                } else {
                    Text("\(threads.count) active threads across every priority lane")
                        .font(scaledFont(10.5, weight: .regular))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10 * contentScale)
                        .padding(.vertical, 8 * contentScale)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(queueSurfaceColor("Running"), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.green.opacity(0.2), lineWidth: 0.75)
        )
        .accessibilityElement(children: .contain)
    }

    private func toggleRunningDock() {
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.16)) {
            isRunningExpanded.toggle()
        }
    }

    private func runningDisclosureHeader(count: Int) -> some View {
        HStack(spacing: 7 * contentScale) {
            Image(systemName: "waveform")
                .font(scaledFont(10.5, weight: .semibold))
                .foregroundStyle(Color.green)
            Text("Running")
                .font(scaledFont(11.5, weight: .semibold))
            GajendraStatusCountBadge(count: count, tint: .green, scale: contentScale)
            Spacer(minLength: 8)
        }
        .padding(.horizontal, 10 * contentScale)
        .frame(maxWidth: .infinity, minHeight: 34 * contentScale, alignment: .leading)
    }

    private func runningDisclosureControl(count: Int, expanded: Bool) -> some View {
        Button {
            guard count > 0 else { return }
            toggleRunningDock()
        } label: {
            HStack(spacing: 5 * contentScale) {
                Text("All priority lanes")
                    .lineLimit(1)
                if count > 0 {
                    Image(systemName: "chevron.down")
                        .font(scaledFont(8.5, weight: .bold))
                        .rotationEffect(.degrees(expanded ? 0 : -90))
                        .accessibilityHidden(true)
                }
            }
            .font(scaledFont(9.5, weight: .semibold))
            .foregroundStyle(count > 0 ? runningControlColor : Color.secondary)
            .padding(.horizontal, 8 * contentScale)
            .padding(.vertical, 5 * contentScale)
            .background(Color.green.opacity(count > 0 ? 0.09 : 0.035), in: Capsule())
            .overlay(Capsule().stroke(Color.green.opacity(count > 0 ? 0.28 : 0.12), lineWidth: 0.75))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(count == 0)
        .accessibilityLabel("All priority lanes, Running")
        .accessibilityValue(expanded ? "Expanded" : "Collapsed")
        .accessibilityHint("Click to \(expanded ? "collapse" : "expand") the running thread list")
        .help("Click to \(expanded ? "shrink" : "expand") Running")
    }

    private func runningRow(_ thread: DeckThread) -> some View {
        HStack(spacing: 6) {
            GajendraLiveActivityMark(scale: contentScale, animated: true)
            Text(thread.title)
                .font(scaledFont(10.5, weight: .medium))
                .lineLimit(1)
            Spacer(minLength: 6)
            providerBadge(thread, compact: true)
            if let placement = thread.placementLabel {
                Text(placement)
                    .font(scaledFont(8.5, weight: .bold))
                    .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .padding(.horizontal, 10 * contentScale)
        .frame(maxWidth: .infinity, minHeight: 32 * contentScale, alignment: .leading)
    }

    private func reviewReadySummary(_ threads: [DeckThread]) -> some View {
        LazyVStack(alignment: .leading, spacing: 0) {
            if threads.isEmpty {
                reviewDisclosureHeader(count: 0, expanded: false)
                Divider()
                Text("No provider reports work ready for review.")
                    .font(scaledFont(10.5, weight: .regular))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10 * contentScale)
                    .padding(.vertical, 8 * contentScale)
            } else {
                reviewDisclosureHeader(count: threads.count, expanded: isReviewExpanded)
                    .contentShape(Rectangle())
                    .background(
                        isReviewHeaderHovered ? Color.orange.opacity(colorScheme == .dark ? 0.12 : 0.08) : Color.clear,
                        in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                    )
                    .onHover { isReviewHeaderHovered = $0 }
                    .onTapGesture(count: 2) {
                        toggleReviewDock()
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction {
                        toggleReviewDock()
                    }
                    .accessibilityLabel(
                        "Ready for Review, \(threads.count) \(threads.count == 1 ? "thread" : "threads")"
                    )
                    .accessibilityValue(isReviewExpanded ? "Expanded" : "Collapsed")
                    .accessibilityHint("Double-click to \(isReviewExpanded ? "collapse" : "expand") the review-ready thread list")
                    .help("Double-click to \(isReviewExpanded ? "shrink" : "expand") Ready for Review")

                Divider()
                if isReviewExpanded {
                    ForEach(Array(threads.enumerated()), id: \.element.id) { index, thread in
                        reviewReadyRow(thread)
                        if index < threads.count - 1 { Divider() }
                    }
                } else {
                Text(
                    threads.count == 1
                        ? "1 thread needs your review"
                        : "\(threads.count) threads need your review"
                )
                        .font(scaledFont(10.5, weight: .regular))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10 * contentScale)
                        .padding(.vertical, 8 * contentScale)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(queueSurfaceColor("Review"), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.orange.opacity(0.24), lineWidth: 0.75)
        )
        .accessibilityElement(children: .contain)
    }

    private func toggleReviewDock() {
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) {
            isReviewExpanded.toggle()
        }
    }

    private func reviewDisclosureHeader(count: Int, expanded: Bool) -> some View {
        HStack(spacing: 7 * contentScale) {
            GajendraReviewStatusMark(scale: contentScale)
            Text("Ready for Review")
                .font(scaledFont(11.5, weight: .semibold))
            GajendraStatusCountBadge(count: count, tint: .orange, scale: contentScale)
            Spacer(minLength: 8)
            HStack(spacing: 5 * contentScale) {
                Text("Needs your review")
                    .lineLimit(1)
                if count > 0 {
                    Image(systemName: "chevron.down")
                        .font(scaledFont(8.5, weight: .bold))
                        .rotationEffect(.degrees(expanded ? 0 : -90))
                        .accessibilityHidden(true)
                }
            }
            .font(scaledFont(9.5, weight: .semibold))
            .foregroundStyle(count > 0 ? reviewControlColor : Color.secondary)
            .padding(.horizontal, 8 * contentScale)
            .padding(.vertical, 5 * contentScale)
            .background(Color.orange.opacity(count > 0 ? 0.11 : 0.04), in: Capsule())
            .overlay(Capsule().stroke(Color.orange.opacity(count > 0 ? 0.34 : 0.14), lineWidth: 0.75))
        }
        .padding(.horizontal, 10 * contentScale)
        .frame(maxWidth: .infinity, minHeight: 34 * contentScale, alignment: .leading)
    }

    private func reviewReadyRow(_ thread: DeckThread) -> some View {
        HStack(spacing: 6 * contentScale) {
            Button { model.openReview(thread) } label: {
                HStack(spacing: 7 * contentScale) {
                    GajendraReviewStatusMark(scale: contentScale)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(thread.title)
                            .font(scaledFont(10.5, weight: .medium))
                            .lineLimit(1)
                        Text(isPreview ? "Ready recently" : relativeReviewText(thread.review?.updatedAt ?? 0))
                            .font(scaledFont(9, weight: .regular))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 6)
                    if let placement = thread.placementLabel {
                        Text(placement)
                            .font(scaledFont(8.5, weight: .bold))
                            .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                            .fixedSize(horizontal: true, vertical: false)
                    }
                    Text(thread.review?.destination.actionLabel ?? "Review")
                        .font(scaledFont(8.5, weight: .semibold))
                        .foregroundStyle(reviewControlColor)
                        .fixedSize(horizontal: true, vertical: false)
                }
                .frame(maxWidth: .infinity, minHeight: 36 * contentScale, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .gajendraHoverSurface(cornerRadius: 6)
            .help("Open \(thread.review?.destination.actionLabel.lowercased() ?? "review") for \(thread.title)")
            .accessibilityLabel("\(thread.title), Ready for Review, \(thread.review?.destination.actionLabel ?? "Review") destination")

            Button { model.open(thread) } label: { providerBadge(thread, compact: true) }
                .buttonStyle(.plain)
                .help("Open the owning task in \(thread.sourceName)")
                .accessibilityLabel("Open owning task in \(thread.sourceName)")
        }
        .padding(.horizontal, 10 * contentScale)
        .frame(maxWidth: .infinity, minHeight: 38 * contentScale, alignment: .leading)
    }

    private var normalizedSearchQuery: String {
        searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    @ViewBuilder
    private func quickSearch(total: Int) -> some View {
        let isSearchActive = searchFocused || isSearchHovered
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(scaledFont(10.5, weight: .semibold))
                .foregroundStyle(isSearchActive ? Color.gajendraAccent(for: colorScheme) : Color.secondary)
            if isPreview {
                Text(searchQuery.isEmpty ? "Search all \(total) threads" : searchQuery)
                    .font(scaledFont(11, weight: .regular))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                GajendraSearchTextField(
                    text: $searchQuery,
                    isFocused: $searchFocused,
                    prompt: "Search all \(total) threads",
                    fontSize: 11 * contentScale,
                    onFocusRequested: onSearchFocusRequested,
                    onSubmit: {
                        guard let thread = model.snapshot?.searchThreads(searchQuery).first else { return }
                        model.open(thread)
                    }
                )
                .frame(maxWidth: .infinity, minHeight: 20 * contentScale)
            }
            if !searchQuery.isEmpty {
                if isPreview {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                } else {
                    Button {
                        searchQuery = ""
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
        }
        .padding(.horizontal, 11 * contentScale)
        .frame(maxWidth: .infinity, minHeight: 34 * contentScale)
        .background(Color.primary.opacity(isSearchActive ? 0.07 : 0.04), in: Capsule())
        .overlay(
            Capsule().stroke(
                isSearchActive ? Color.gajendraAccent(for: colorScheme).opacity(0.58) : Color.primary.opacity(0.1),
                lineWidth: isSearchActive ? 1 : 0.75
            )
        )
        .contentShape(Capsule())
        .onTapGesture {
            if !isPreview {
                onSearchFocusRequested()
                searchFocused = true
            }
        }
        .onHover { isSearchHovered = $0 }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isSearchActive)
    }

    private func persistentSearchFooter(total: Int) -> some View {
        VStack(spacing: 6 * contentScale) {
            Divider()
            quickSearch(total: total)
        }
        .padding(.top, 6 * contentScale)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("All-thread search footer")
    }

    private func searchResults(_ matches: [DeckThread]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Text("Search results")
                    .font(scaledFont(12.5, weight: .semibold))
                Text("\(matches.count)")
                    .font(scaledFont(9.5, weight: .medium).monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer()
                Text("Open or organize here")
                    .font(scaledFont(9.5, weight: .regular))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10 * contentScale)
            .frame(height: 30 * contentScale)

            if matches.isEmpty {
                Text("No matching threads")
                    .font(scaledFont(11, weight: .regular))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 76 * contentScale, alignment: .center)
            } else {
                ForEach(Array(matches.prefix(5).enumerated()), id: \.element.id) { index, thread in
                    searchResultRow(thread, showsTopDivider: index > 0)
                }
                if matches.count > 5 {
                    Divider()
                    moreButton(remaining: matches.count - 5, title: "matching")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(queueSurfaceColor("Search"), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.primary.opacity(0.08), lineWidth: 0.5))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Search results")
    }

    private func searchResultRow(_ thread: DeckThread, showsTopDivider: Bool) -> some View {
        HStack(spacing: 8) {
            Button { model.open(thread) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(thread.title)
                            .font(scaledFont(11.5, weight: .medium))
                            .lineLimit(1)
                        if thread.isRunning {
                            Image(systemName: "waveform")
                                .font(scaledFont(8.5, weight: .semibold))
                                .foregroundStyle(Color.green)
                        } else if thread.isReadyForReview {
                            GajendraReviewStatusMark(scale: contentScale)
                        }
                    }
                    HStack(spacing: 5) {
                        providerBadge(thread, compact: true)
                        Text(thread.project)
                            .font(scaledFont(9.5, weight: .regular))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        if let context = thread.context {
                            contextBadge(context, compact: true)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Open \(thread.title) in \(thread.sourceName)")
        }
        .padding(.horizontal, 10 * contentScale)
        .padding(.vertical, 5 * contentScale)
        .frame(maxWidth: .infinity, minHeight: 42 * contentScale)
        .overlay(alignment: .top) { if showsTopDivider { Divider() } }
        .contextMenu {
            if !isPreview {
                searchActions(thread)
            }
        }
    }

    @ViewBuilder
    private func searchActions(_ thread: DeckThread) -> some View {
        if !thread.isCurrent {
            Button("Make NOW") { model.makeNow(threadId: thread.id) }
        }
        if thread.level != .focus {
            Button("Move to Focus") { model.moveToLevel(threadId: thread.id, level: .focus) }
        }
        if thread.level != .important {
            Button("Move to Important") { model.moveToLevel(threadId: thread.id, level: .important) }
        }
        if thread.level != nil {
            Button("Remove from priorities") { model.moveToLevel(threadId: thread.id, level: nil) }
        }
        Divider()
        Menu("Context") {
            ForEach(ThreadContext.allCases) { context in
                Button(context.title) { model.apply(.setContext(threadId: thread.id, context: context)) }
            }
            if thread.context != nil {
                Button("Clear context") { model.apply(.setContext(threadId: thread.id, context: nil)) }
            }
        }
        Button("Open in \(thread.sourceName)") { model.open(thread) }
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

    private var footer: some View {
        HStack(spacing: 8) {
            if let error = model.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(scaledFont(10.5, weight: .regular))
                    .foregroundStyle(.orange)
                    .lineLimit(1)
            } else {
                Text(GajendraBrandCopy.promise)
                    .font(scaledFont(10.5, weight: .regular))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
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
        case "grok": return colorScheme == .dark ? Color(red: 0.47, green: 0.84, blue: 0.73) : Color(red: 0.14, green: 0.42, blue: 0.35)
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
        if title == "Running" {
            return colorScheme == .dark ? Color.green.opacity(0.08) : Color.green.opacity(0.045)
        }
        if title == "Review" {
            return colorScheme == .dark ? Color.orange.opacity(0.09) : Color.orange.opacity(0.05)
        }
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

    private var rowPressedColor: Color {
        visualSettings.theme == .focusDeck
            ? Color.gajendraAccent(for: colorScheme).opacity(colorScheme == .dark ? 0.22 : 0.16)
            : Color(nsColor: .controlAccentColor).opacity(colorScheme == .dark ? 0.24 : 0.16)
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

    private var removeControlRed: Color {
        colorScheme == .dark
            ? Color(red: 0.78, green: 0.1, blue: 0.14)
            : Color(red: 0.68, green: 0.035, blue: 0.075)
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
            .accessibilityLabel(model.isLoading ? "Refreshing Gajendra" : "Refresh Gajendra")
        }
    }
}

private struct GajendraQueueDragPreview: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let thread: DeckThread
    let scale: CGFloat

    var body: some View {
        HStack(spacing: 8 * scale) {
            Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                .font(.system(size: 11 * scale, weight: .semibold))
                .foregroundStyle(Color.gajendraAccent(for: colorScheme))
            VStack(alignment: .leading, spacing: 2 * scale) {
                Text(thread.title)
                    .font(.system(size: 11.5 * scale, weight: .semibold))
                    .lineLimit(1)
                HStack(spacing: 5 * scale) {
                    Text(thread.project)
                        .font(.system(size: 9.5 * scale, weight: .regular))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    if let context = thread.context {
                        Text(context.title)
                            .font(.system(size: 8.5 * scale, weight: .semibold))
                            .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                            .lineLimit(1)
                    }
                    Text(thread.sourceName)
                        .font(.system(size: 8.5 * scale, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10 * scale)
        .padding(.vertical, 8 * scale)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.gajendraAccent(for: colorScheme).opacity(0.64), lineWidth: 1)
        )
        .shadow(
            color: Color.black.opacity(colorScheme == .dark ? 0.34 : 0.18),
            radius: reduceMotion ? 4 : 12,
            y: reduceMotion ? 1 : 6
        )
        .scaleEffect(GajendraQueueInteractionTuning.dragPreviewScale(reduceMotion: reduceMotion))
    }
}

private struct GajendraThreadRowButtonStyle: ButtonStyle {
    let isHovered: Bool
    let hoverColor: Color
    let pressedColor: Color

    func makeBody(configuration: Configuration) -> some View {
        GajendraThreadRowButtonBody(
            configuration: configuration,
            isHovered: isHovered,
            hoverColor: hoverColor,
            pressedColor: pressedColor
        )
    }
}

private struct GajendraThreadRowButtonBody: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let configuration: ButtonStyleConfiguration
    let isHovered: Bool
    let hoverColor: Color
    let pressedColor: Color

    var body: some View {
        configuration.label
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(configuration.isPressed ? pressedColor : (isHovered ? hoverColor : Color.clear))
            )
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.985 : 1)
            .animation(
                reduceMotion ? nil : .spring(response: 0.16, dampingFraction: 0.82),
                value: configuration.isPressed
            )
    }
}

private struct GajendraRemoveTaskButtonStyle: ButtonStyle {
    let color: Color
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        GajendraRemoveTaskButtonBody(
            configuration: configuration,
            color: color,
            reduceMotion: reduceMotion
        )
    }
}

private struct GajendraRemoveTaskButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let color: Color
    let reduceMotion: Bool
    @State private var isHovered = false

    var body: some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.78 : (isHovered ? 1.08 : 1))
            .brightness(configuration.isPressed ? 0.12 : 0)
            .shadow(
                color: color.opacity(isHovered ? 0.42 : 0.24),
                radius: isHovered ? 5 : 3,
                y: configuration.isPressed ? 0 : 1.5
            )
            .contentShape(Circle())
            .onHover { isHovered = $0 }
            .animation(
                reduceMotion ? nil : .spring(response: 0.18, dampingFraction: 0.68),
                value: configuration.isPressed
            )
            .animation(
                reduceMotion ? nil : .easeOut(duration: 0.12),
                value: isHovered
            )
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
