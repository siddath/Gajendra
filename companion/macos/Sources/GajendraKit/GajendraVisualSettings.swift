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

@MainActor
public final class GajendraVisualSettings: ObservableObject {
    public static let themeKey = "gajendra.visual.theme"
    public static let appearanceKey = "gajendra.visual.appearance"

    @Published public var theme: GajendraVisualTheme {
        didSet { persist(theme.rawValue, forKey: Self.themeKey) }
    }

    @Published public var appearance: GajendraAppearance {
        didSet { persist(appearance.rawValue, forKey: Self.appearanceKey) }
    }

    private let defaults: UserDefaults?

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        theme = GajendraVisualTheme(rawValue: defaults.string(forKey: Self.themeKey) ?? "") ?? .nativePopover
        appearance = GajendraAppearance(rawValue: defaults.string(forKey: Self.appearanceKey) ?? "") ?? .automatic
    }

    public init(theme: GajendraVisualTheme, appearance: GajendraAppearance) {
        defaults = nil
        self.theme = theme
        self.appearance = appearance
    }

    private func persist(_ value: String, forKey key: String) {
        defaults?.set(value, forKey: key)
    }
}
