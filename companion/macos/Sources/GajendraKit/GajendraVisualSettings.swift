import AppKit
import Foundation
import SwiftUI

public enum GajendraVisualTheme: String, CaseIterable, Identifiable, Sendable {
    case nativePopover = "native-popover"
    case focusDeck = "focus-deck"

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .nativePopover: return "Native Popover"
        case .focusDeck: return "Focus Deck"
        }
    }
}

public enum GajendraAppearance: String, CaseIterable, Identifiable, Sendable {
    case automatic
    case light
    case dark

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .automatic: return "Auto"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    public var appKitName: NSAppearance.Name? {
        switch self {
        case .automatic: return nil
        case .light: return .aqua
        case .dark: return .darkAqua
        }
    }

}

public enum GajendraPillAnchor: String, CaseIterable, Identifiable, Sendable {
    case topLeading = "top-left"
    case topTrailing = "top-right"
    case center
    case bottomLeading = "bottom-left"
    case bottomCenter = "bottom-center"
    case bottomTrailing = "bottom-right"

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .topLeading: return "Top Left"
        case .topTrailing: return "Top Right"
        case .center: return "Center"
        case .bottomLeading: return "Bottom Left"
        case .bottomCenter: return "Bottom Center"
        case .bottomTrailing: return "Bottom Right"
        }
    }
}

public enum GajendraHoverCardSize: String, CaseIterable, Identifiable, Sendable {
    case compact
    case comfortable
    case expanded

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .compact: return "Compact"
        case .comfortable: return "Comfortable"
        case .expanded: return "Expanded"
        }
    }
}

public enum GajendraHoverCardSizing {
    private static let referenceFrame = CGSize(width: 1512, height: 949)

    // Keep the old presets as migration points; layout no longer controls window geometry.
    public static func initialWidgetSize(for layout: GajendraHoverCardSize) -> Double {
        switch layout {
        case .compact: return 0
        case .comfortable: return 25
        case .expanded: return 50
        }
    }

    public static func boundedWidgetSize(_ value: Double) -> Double {
        value.isFinite ? min(max(value, 0), 100) : 0
    }

    public static func size(widgetSize: Double, visibleFrame: CGRect) -> CGSize {
        let value = boundedWidgetSize(widgetSize)
        let start: CGSize
        let end: CGSize
        let fraction: Double
        if value <= 25 {
            start = CGSize(width: 560, height: 570)
            end = CGSize(width: 660, height: 610)
            fraction = value / 25
        } else if value <= 50 {
            start = CGSize(width: 660, height: 610)
            end = CGSize(width: 760, height: 680)
            fraction = (value - 25) / 25
        } else {
            start = CGSize(width: 760, height: 680)
            end = CGSize(width: 960, height: 850)
            fraction = (value - 50) / 50
        }
        let baseSize = CGSize(
            width: start.width + (end.width - start.width) * fraction,
            height: start.height + (end.height - start.height) * fraction
        )

        let displayScale = min(
            visibleFrame.width / referenceFrame.width,
            visibleFrame.height / referenceFrame.height
        )
        let boundedScale = min(max(displayScale, 0.88), 1.18)
        let maximumSize = CGSize(
            width: max(1, visibleFrame.width - 24),
            height: max(1, visibleFrame.height - 24)
        )
        return CGSize(
            width: min((baseSize.width * boundedScale).rounded(), maximumSize.width),
            height: min((baseSize.height * boundedScale).rounded(), maximumSize.height)
        )
    }

    public static func contentScale(for preference: GajendraHoverCardSize) -> CGFloat {
        switch preference {
        case .compact: return 0.94
        case .comfortable: return 1
        case .expanded: return 1.12
        }
    }
}

@MainActor
public final class GajendraVisualSettings: ObservableObject {
    public static let settingsWindowIdentifier = NSUserInterfaceItemIdentifier("gajendra-settings-popover")
    public static let themeKey = "gajendra.visual.theme"
    public static let appearanceKey = "gajendra.visual.appearance"
    public static let hoverCardSizeKey = "gajendra.visual.hover-card-size"
    public static let widgetSizeKey = "gajendra.visual.widget-size"
    public static let pillAnchorKey = "gajendra.visual.pill-anchor"

    @Published public var theme: GajendraVisualTheme {
        didSet { persist(theme.rawValue, forKey: Self.themeKey) }
    }

    @Published public var appearance: GajendraAppearance {
        didSet { persist(appearance.rawValue, forKey: Self.appearanceKey) }
    }

    @Published public var hoverCardSize: GajendraHoverCardSize {
        didSet {
            persist(hoverCardSize.rawValue, forKey: Self.hoverCardSizeKey)
            defaults?.set(widgetSize, forKey: Self.widgetSizeKey)
        }
    }

    @Published public var isAdjustingWidgetSize = false

    @Published public var widgetSize: Double {
        didSet {
            let bounded = GajendraHoverCardSizing.boundedWidgetSize(widgetSize)
            if widgetSize != bounded { widgetSize = bounded }
            defaults?.set(bounded, forKey: Self.widgetSizeKey)
        }
    }

    @Published public var pillAnchor: GajendraPillAnchor {
        didSet { persist(pillAnchor.rawValue, forKey: Self.pillAnchorKey) }
    }

    private let defaults: UserDefaults?

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        theme = GajendraVisualTheme(rawValue: defaults.string(forKey: Self.themeKey) ?? "") ?? .nativePopover
        appearance = GajendraAppearance(rawValue: defaults.string(forKey: Self.appearanceKey) ?? "") ?? .automatic
        let savedLayout = GajendraHoverCardSize(rawValue: defaults.string(forKey: Self.hoverCardSizeKey) ?? "") ?? .compact
        hoverCardSize = savedLayout
        widgetSize = (defaults.object(forKey: Self.widgetSizeKey) as? NSNumber).map {
            GajendraHoverCardSizing.boundedWidgetSize($0.doubleValue)
        } ?? GajendraHoverCardSizing.initialWidgetSize(for: savedLayout)
        // Persist the migration once so a later layout change cannot remap the saved size.
        pillAnchor = GajendraPillAnchor(rawValue: defaults.string(forKey: Self.pillAnchorKey) ?? "") ?? .bottomTrailing
        if defaults.object(forKey: Self.hoverCardSizeKey) != nil
            || defaults.object(forKey: Self.widgetSizeKey) != nil {
            defaults.set(widgetSize, forKey: Self.widgetSizeKey)
        }
    }

    public init(
        theme: GajendraVisualTheme,
        appearance: GajendraAppearance,
        hoverCardSize: GajendraHoverCardSize = .compact,
        widgetSize: Double? = nil,
        pillAnchor: GajendraPillAnchor = .bottomTrailing
    ) {
        defaults = nil
        self.theme = theme
        self.appearance = appearance
        self.hoverCardSize = hoverCardSize
        self.widgetSize = GajendraHoverCardSizing.boundedWidgetSize(
            widgetSize ?? GajendraHoverCardSizing.initialWidgetSize(for: hoverCardSize)
        )
        self.pillAnchor = pillAnchor
    }

    private func persist(_ value: String, forKey key: String) {
        defaults?.set(value, forKey: key)
    }
}

/// Shared by the floating card and Organizer settings.
struct GajendraWidgetLayoutControls: View {
    @ObservedObject var settings: GajendraVisualSettings
    var onManageSources: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Gajendra settings").font(.headline)
            VStack(alignment: .leading, spacing: 8) {
                Text("Task layout")
                Picker("Task layout", selection: $settings.hoverCardSize) {
                    ForEach(GajendraHoverCardSize.allCases) { layout in
                        Text(layout.title).tag(layout)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                Text("Adjust task spacing and detail.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Widget size")
                    Spacer()
                    Text("\(Int(settings.widgetSize))%").monospacedDigit()
                }
                Slider(value: $settings.widgetSize, in: 0...100, step: 1) { editing in
                    settings.isAdjustingWidgetSize = editing
                }
                    .accessibilityLabel("Widget size")
                    .accessibilityValue("\(Int(settings.widgetSize)) percent")
                HStack {
                    Text("Minimum")
                    Spacer()
                    Text("Maximum")
                }
                .font(.caption).foregroundStyle(.secondary)
                Text("Release to resize within the available screen space.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Divider()
            Picker("Theme", selection: $settings.theme) {
                ForEach(GajendraVisualTheme.allCases) { Text($0.title).tag($0) }
            }
            Picker("Appearance", selection: $settings.appearance) {
                ForEach(GajendraAppearance.allCases) { Text($0.title).tag($0) }
            }
            Picker("Lotus position", selection: $settings.pillAnchor) {
                ForEach(GajendraPillAnchor.allCases) { Text($0.title).tag($0) }
            }
            HStack {
                Button("Manage AI tools…") {
                    dismiss()
                    onManageSources()
                }
                Spacer()
                Button("Done") { dismiss() }
            }
        }
        .padding(20)
        .frame(width: 340)
        .background(GajendraSettingsWindowMarker())
        .onDisappear { settings.isAdjustingWidgetSize = false }
    }
}

/// NSPopover windows do not consistently expose their owner through NSWindow.parent.
private struct GajendraSettingsWindowMarker: NSViewRepresentable {
    final class MarkerView: NSView {
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            window?.identifier = GajendraVisualSettings.settingsWindowIdentifier
        }
    }

    func makeNSView(context: Context) -> MarkerView { MarkerView() }
    func updateNSView(_ view: MarkerView, context: Context) {}
}
