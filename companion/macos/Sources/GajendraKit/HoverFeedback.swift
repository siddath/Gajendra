import SwiftUI
import AppKit

private struct GajendraHoverKey: EnvironmentKey {
    static let defaultValue = false
}

private struct GajendraMotionVisibleKey: EnvironmentKey {
    static let defaultValue = true
}

extension EnvironmentValues {
    var gajendraHovered: Bool {
        get { self[GajendraHoverKey.self] }
        set { self[GajendraHoverKey.self] = newValue }
    }
    var gajendraMotionVisible: Bool {
        get { self[GajendraMotionVisibleKey.self] }
        set { self[GajendraMotionVisibleKey.self] = newValue }
    }
}

/// Prewarmed NSHostingViews stay mounted when their panel is ordered out. Observe the owning
/// window once per surface so hover loops stop even when SwiftUI never sends onDisappear.
private struct GajendraMotionVisibility: ViewModifier {
    @State private var visible = false

    func body(content: Content) -> some View {
        content
            .environment(\.gajendraMotionVisible, visible)
            .background(GajendraWindowVisibilityReader { visible = $0 }.allowsHitTesting(false))
    }
}

private struct GajendraWindowVisibilityReader: NSViewRepresentable {
    var onChange: (Bool) -> Void

    func makeNSView(context: Context) -> VisibilityView {
        let view = VisibilityView()
        view.onChange = onChange
        return view
    }

    func updateNSView(_ view: VisibilityView, context: Context) {
        view.onChange = onChange
        view.publishVisibility()
    }

    final class VisibilityView: NSView {
        var onChange: ((Bool) -> Void)?
        private var observer: NSObjectProtocol?
        private var lastVisible: Bool?

        deinit {
            if let observer { NotificationCenter.default.removeObserver(observer) }
        }

        override func hitTest(_ point: NSPoint) -> NSView? { nil }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            if let observer { NotificationCenter.default.removeObserver(observer) }
            observer = nil
            if let window {
                observer = NotificationCenter.default.addObserver(
                    forName: NSWindow.didChangeOcclusionStateNotification, object: window, queue: .main
                ) { [weak self] _ in self?.publishVisibility() }
            }
            publishVisibility()
        }

        func publishVisibility() {
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                let visible = self.window.map { $0.isVisible && $0.occlusionState.contains(.visible) } ?? false
                guard self.lastVisible != visible else { return }
                self.lastVisible = visible
                self.onChange?(visible)
            }
        }
    }
}

/// Pointer feedback is local presentation state; targets and model actions never wait for motion.
private struct GajendraHoverFeedback: ViewModifier {
    let tint: Color
    let drawsBackground: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.gajendraMotionVisible) private var surfaceVisible
    @State private var hovered = false

    func body(content: Content) -> some View {
        content
            .environment(\.gajendraHovered, hovered && surfaceVisible)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(tint.opacity(colorScheme == .dark ? 0.16 : 0.10))
                    .opacity(hovered && drawsBackground ? 1 : 0)
                    .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: hovered)
                    .allowsHitTesting(false)
            }
            .contentShape(Rectangle())
            .onHover { hovered = $0 }
            .onChange(of: surfaceVisible) { if !$0 { hovered = false } }
            .onDisappear { hovered = false }
    }
}

extension View {
    func gajendraMotionVisibility() -> some View {
        modifier(GajendraMotionVisibility())
    }

    func gajendraHoverFeedback(tint: Color = .primary, drawsBackground: Bool = true) -> some View {
        modifier(GajendraHoverFeedback(tint: tint, drawsBackground: drawsBackground))
    }
}

/// Reserve the bold title's footprint in both states. Only the visible weight changes;
/// truncation, row height, neighboring badges, and the open/action targets retain their geometry.
struct GajendraRecordTitle: View {
    let title: String
    var font: Font = .body
    var lineLimit: Int = 1
    @Environment(\.gajendraHovered) private var hovered
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Text(title)
            .font(font.weight(.bold))
            .lineLimit(lineLimit)
            .opacity(0)
            .overlay(alignment: .leading) {
                Text(title)
                    .font(font)
                    .lineLimit(lineLimit)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .opacity(hovered ? 0 : 1)
                Text(title)
                    .font(font.weight(.bold))
                    .lineLimit(lineLimit)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .opacity(hovered ? 1 : 0)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(title)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: hovered)
    }
}

/// Press feedback uses the existing button action without adding a gesture or delaying it.
/// Keyboard activation retains an immediate static response.
struct GajendraPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let pointer = [.leftMouseDown, .leftMouseDragged, .leftMouseUp].contains(NSApp.currentEvent?.type)
        configuration.label
            .opacity(configuration.isPressed ? 0.82 : 1)
            .scaleEffect(configuration.isPressed && pointer && !reduceMotion ? 0.97 : 1)
            .animation(reduceMotion || !pointer ? nil : .timingCurve(0.23, 1, 0.32, 1, duration: 0.16), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == GajendraPressStyle {
    static var gajendraPress: GajendraPressStyle { .init() }
}

enum GajendraHoverIconKind {
    case running, review, focus, important
}

public enum GajendraHoverMotion {
    public static let loopDuration: TimeInterval = 0.96

    public static func runs(hovered: Bool, reduceMotion: Bool, visible: Bool) -> Bool {
        hovered && !reduceMotion && visible
    }

    public static func phase(elapsed: TimeInterval) -> Double {
        max(0, elapsed).truncatingRemainder(dividingBy: loopDuration) / loopDuration
    }

    public static func barScale(index: Int, phase: Double) -> Double {
        1 + 0.24 * sin(2 * .pi * phase + Double(index) * .pi / 2)
    }
}

/// Only the small status artwork updates during a hover. Text, row geometry, and actions do
/// not animate on the timeline; hidden surfaces and Reduce Motion pause it completely.
struct GajendraHoverIcon: View {
    let kind: GajendraHoverIconKind
    let tint: Color
    var size: CGFloat = 12
    @Environment(\.gajendraHovered) private var hovered
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.gajendraMotionVisible) private var surfaceVisible
    @State private var hoverStart = Date()

    private var moves: Bool { hovered && !reduceMotion }
    private var loops: Bool {
        (kind == .running || kind == .review)
            && GajendraHoverMotion.runs(hovered: hovered, reduceMotion: reduceMotion, visible: surfaceVisible)
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !loops)) { timeline in
            artwork(phase: loops ? GajendraHoverMotion.phase(elapsed: timeline.date.timeIntervalSince(hoverStart)) : 0)
        }
            .foregroundStyle(tint)
            .frame(width: size * 1.5, height: size * 1.5)
            .animation(reduceMotion ? nil : .timingCurve(0.23, 1, 0.32, 1, duration: hovered ? 0.22 : 0.16), value: hovered)
            .onChange(of: loops) { if $0 { hoverStart = Date() } }
            .accessibilityHidden(true)
            .allowsHitTesting(false)
    }

    @ViewBuilder private func artwork(phase: Double) -> some View {
        switch kind {
        case .running:
            HStack(spacing: size * 0.13) {
                ForEach(0..<5) { index in
                    Capsule()
                        .frame(width: size * 0.13, height: size * [0.35, 0.7, 1, 0.7, 0.35][index])
                        .scaleEffect(x: 1, y: loops ? GajendraHoverMotion.barScale(index: index, phase: phase) : 1)
                }
            }
            .opacity(hovered ? 1 : 0.8)
        case .review:
            ZStack {
                Image(systemName: "tray.fill")
                    .font(.system(size: size, weight: .semibold))
                Image(systemName: "envelope.fill")
                    .font(.system(size: size * 0.55, weight: .semibold))
                    .offset(y: -size * (loops ? 0.7 - 0.42 * phase : (hovered ? 0.28 : 0.7)))
                    .opacity(loops ? min(1, min(phase / 0.15, (1 - phase) / 0.2)) : (hovered ? 1 : 0))
            }
        case .focus:
            Image(systemName: "star.fill")
                .font(.system(size: size, weight: .semibold))
                .opacity(hovered ? 1 : 0.7)
                .scaleEffect(moves ? 1.1 : 1)
        case .important:
            ZStack {
                Image(systemName: "bookmark")
                Image(systemName: "bookmark.fill").opacity(hovered ? 1 : 0)
            }
            .font(.system(size: size, weight: .semibold))
            .rotationEffect(.degrees(moves ? -7 : 0), anchor: .top)
            .scaleEffect(moves ? 1.06 : 1, anchor: .top)
        }
    }
}
