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
}

public struct GajendraHoverState: Equatable, Sendable {
    public private(set) var pillHovered = false
    public private(set) var cardHovered = false

    public init() {}

    public var wantsCardVisible: Bool { pillHovered || cardHovered }

    public mutating func setPillHovered(_ hovered: Bool) {
        pillHovered = hovered
    }

    public mutating func setCardHovered(_ hovered: Bool) {
        cardHovered = hovered
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

    public init(cornerRadius: CGFloat, castsShadow: Bool = true, interactive: Bool = false) {
        self.cornerRadius = cornerRadius
        self.castsShadow = castsShadow
        self.interactive = interactive
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
                    .overlay(shape.stroke(Color.primary.opacity(0.13), lineWidth: 0.5))
            } else {
                shape
                    .fill(.ultraThinMaterial)
                    .overlay(
                        shape.fill(colorScheme == .dark ? Color.gajendraIndigo.opacity(0.2) : Color.white.opacity(0.18))
                    )
                    .overlay(shape.stroke(Color.primary.opacity(0.14), lineWidth: 0.5))
            }
        }
        .shadow(color: castsShadow ? Color.black.opacity(colorScheme == .dark ? 0.28 : 0.13) : .clear, radius: 18, y: 8)
    }
}

public struct GajendraPillView: View {
    @ObservedObject private var model: DeckViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var isHovered = false
    private let onHoverChanged: (Bool) -> Void
    private let onActivate: () -> Void

    public init(
        model: DeckViewModel,
        onHoverChanged: @escaping (Bool) -> Void,
        onActivate: @escaping () -> Void
    ) {
        self.model = model
        self.onHoverChanged = onHoverChanged
        self.onActivate = onActivate
    }

    public var body: some View {
        Button(action: onActivate) {
            GajendraMark(size: 27)
                .frame(width: 48, height: 48)
                .background(pillSurface)
                .overlay(
                    Circle()
                        .stroke(colorScheme == .dark ? Color.white.opacity(0.2) : Color.gajendraIndigo.opacity(0.18), lineWidth: 1)
                )
                .contentShape(Circle())
                .opacity(model.isLoading ? 0.72 : 1)
                .scaleEffect(isHovered ? 1.06 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Gaja, Elephant Focus for AI Power Users")
        .accessibilityHint("Hover or press to show your current AI-agent priorities")
        .onHover { hovered in
            isHovered = hovered
            onHoverChanged(hovered)
        }
        .animation(reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 0.82), value: model.isLoading)
        .animation(reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.78), value: isHovered)
        .frame(width: 60, height: 60)
    }

    @ViewBuilder
    private var pillSurface: some View {
        if #available(macOS 26.0, *) {
            Circle()
                .fill(.clear)
                .glassEffect(.regular.interactive(), in: .circle)
                .shadow(color: .black.opacity(colorScheme == .dark ? 0.3 : 0.16), radius: 12, y: 5)
        } else {
            Circle()
                .fill(.ultraThinMaterial)
                .overlay(Circle().fill(colorScheme == .dark ? Color.gajendraIndigo.opacity(0.28) : Color.white.opacity(0.2)))
                .shadow(color: .black.opacity(colorScheme == .dark ? 0.3 : 0.16), radius: 12, y: 5)
        }
    }
}

public struct GajendraHoverCardView: View {
    @ObservedObject private var model: DeckViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    private let isPreview: Bool
    private let onHoverChanged: (Bool) -> Void
    private let onOpenOrganizer: () -> Void

    public init(
        model: DeckViewModel,
        isPreview: Bool = false,
        onHoverChanged: @escaping (Bool) -> Void = { _ in },
        onOpenOrganizer: @escaping () -> Void = {}
    ) {
        self.model = model
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
            GajendraGlassSurface(cornerRadius: 18)
        )
        .padding(12)
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
            refreshControl
        }
    }

    @ViewBuilder
    private var nowSection: some View {
        if let current = model.snapshot?.current {
            VStack(alignment: .leading, spacing: 7) {
                Text("NOW")
                    .font(.caption2.bold())
                    .tracking(1.2)
                    .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(current.title)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(2)
                        HStack(spacing: 5) {
                            sourceBadge(current)
                            Text(current.project)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
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
            .background(Color.gajendraGold.opacity(0.09), in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(Color.gajendraGold.opacity(0.5), lineWidth: 1)
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
                compactList(title: "Focus", threads: snapshot.focus)
                compactList(title: "Important", threads: snapshot.important)
            }
        }
    }

    private func compactList(title: String, threads: [DeckThread]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                Spacer()
                Text("\(threads.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
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
                        Text(thread.sourceName.prefix(1))
                            .font(.caption2.bold())
                            .foregroundStyle(.secondary)
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
        .background(Color.primary.opacity(0.035), in: RoundedRectangle(cornerRadius: 9))
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
            Button(action: onOpenOrganizer) {
                Text("Open organizer")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.gajendraAccent(for: colorScheme))
                    .fixedSize()
            }
            .buttonStyle(.plain)
        }
    }

    private func sourceBadge(_ thread: DeckThread) -> some View {
        Text(thread.sourceName)
            .font(.caption2.weight(.medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.primary.opacity(0.055), in: Capsule())
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
