import SwiftUI
import AppKit

private struct GajendraHoverKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var gajendraHovered: Bool {
        get { self[GajendraHoverKey.self] }
        set { self[GajendraHoverKey.self] = newValue }
    }
}

/// Pointer feedback is local presentation state; targets and model actions never wait for motion.
private struct GajendraHoverFeedback: ViewModifier {
    let tint: Color
    let drawsBackground: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hovered = false

    func body(content: Content) -> some View {
        content
            .environment(\.gajendraHovered, hovered)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(tint.opacity(colorScheme == .dark ? 0.16 : 0.10))
                    .opacity(hovered && drawsBackground ? 1 : 0)
                    .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: hovered)
                    .allowsHitTesting(false)
            }
            .contentShape(Rectangle())
            .onHover { hovered = $0 }
    }
}

extension View {
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
                    .font(font.weight(.medium))
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

/// A single reversible hover transition, with no timers, repeating animation, or layout changes.
struct GajendraHoverIcon: View {
    let kind: GajendraHoverIconKind
    let tint: Color
    var size: CGFloat = 12
    @Environment(\.gajendraHovered) private var hovered
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var moves: Bool { hovered && !reduceMotion }

    var body: some View {
        artwork
            .foregroundStyle(tint)
            .frame(width: size * 1.5, height: size * 1.5)
            .animation(reduceMotion ? nil : .timingCurve(0.23, 1, 0.32, 1, duration: hovered ? 0.22 : 0.16), value: hovered)
            .accessibilityHidden(true)
            .allowsHitTesting(false)
    }

    @ViewBuilder private var artwork: some View {
        switch kind {
        case .running:
            HStack(spacing: size * 0.13) {
                ForEach(0..<5) { index in
                    Capsule()
                        .frame(width: size * 0.13, height: size * [0.35, 0.7, 1, 0.7, 0.35][index])
                        .scaleEffect(x: 1, y: moves ? [1.35, 0.72, 0.84, 1.2, 1.45][index] : 1)
                        .offset(y: moves ? (index.isMultiple(of: 2) ? -size * 0.08 : size * 0.08) : 0)
                }
            }
            .opacity(hovered ? 1 : 0.8)
        case .review:
            ZStack {
                Image(systemName: "tray.fill")
                    .font(.system(size: size, weight: .semibold))
                Image(systemName: "envelope.fill")
                    .font(.system(size: size * 0.55, weight: .semibold))
                    .offset(y: reduceMotion ? -size * 0.28 : (hovered ? -size * 0.28 : -size * 0.7))
                    .opacity(hovered ? 1 : 0)
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
