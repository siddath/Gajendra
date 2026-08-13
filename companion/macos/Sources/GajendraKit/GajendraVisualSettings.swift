import AppKit
import Foundation

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

    public static func size(
        for preference: GajendraHoverCardSize,
        visibleFrame: CGRect
    ) -> CGSize {
        let baseSize: CGSize
        switch preference {
        case .compact:
            baseSize = CGSize(width: 560, height: 460)
        case .comfortable:
            baseSize = CGSize(width: 660, height: 500)
        case .expanded:
            baseSize = CGSize(width: 760, height: 560)
        }

        let displayScale = min(
            visibleFrame.width / referenceFrame.width,
            visibleFrame.height / referenceFrame.height
        )
        let boundedScale = min(max(displayScale, 0.88), 1.18)
        let maximumSize = CGSize(
            width: max(320, visibleFrame.width - 24),
            height: max(360, visibleFrame.height - 24)
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
    public static let themeKey = "gajendra.visual.theme"
    public static let appearanceKey = "gajendra.visual.appearance"
    public static let hoverCardSizeKey = "gajendra.visual.hover-card-size"

    @Published public var theme: GajendraVisualTheme {
        didSet { persist(theme.rawValue, forKey: Self.themeKey) }
    }

    @Published public var appearance: GajendraAppearance {
        didSet { persist(appearance.rawValue, forKey: Self.appearanceKey) }
    }

    @Published public var hoverCardSize: GajendraHoverCardSize {
        didSet { persist(hoverCardSize.rawValue, forKey: Self.hoverCardSizeKey) }
    }

    private let defaults: UserDefaults?

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        theme = GajendraVisualTheme(rawValue: defaults.string(forKey: Self.themeKey) ?? "") ?? .nativePopover
        appearance = GajendraAppearance(rawValue: defaults.string(forKey: Self.appearanceKey) ?? "") ?? .automatic
        hoverCardSize = GajendraHoverCardSize(rawValue: defaults.string(forKey: Self.hoverCardSizeKey) ?? "") ?? .comfortable
    }

    public init(
        theme: GajendraVisualTheme,
        appearance: GajendraAppearance,
        hoverCardSize: GajendraHoverCardSize = .comfortable
    ) {
        defaults = nil
        self.theme = theme
        self.appearance = appearance
        self.hoverCardSize = hoverCardSize
    }

    private func persist(_ value: String, forKey key: String) {
        defaults?.set(value, forKey: key)
    }
}
