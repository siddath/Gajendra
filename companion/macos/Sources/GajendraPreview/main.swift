import AppKit
import GajendraKit
import SwiftUI

@main
enum GajendraPreview {
    @MainActor
    static func main() throws {
        let now = thread("focus-1", "Finish the adaptive Gaja hover-card release", "gajendra", level: .focus, current: true, context: .design)
        let cardSnapshot = DeckSnapshot(
            generatedAt: "2026-08-12T00:00:00Z",
            current: now,
            focus: [
                now,
                thread("focus-2", "Review launch evidence", "tooling", level: .focus, context: .engineering),
                thread("focus-3", "Tighten the organizer interaction model", "gajendra", level: .focus, sourceId: "claude", sourceName: "Claude"),
                thread("focus-4", "Verify the exact thread resume paths", "agents", level: .focus, sourceId: "cursor", sourceName: "Cursor"),
                thread("focus-5", "Write the macOS design case study", "design-system", level: .focus, context: .design),
                thread("focus-6", "Audit reduced transparency behavior", "accessibility", level: .focus, context: .engineering),
                thread("focus-7", "Prepare the installed-app smoke test", "release", level: .focus),
            ],
            important: [
                thread("important-1", "Prepare the next design pass", "design-system", level: .important, context: .design),
                thread("important-2", "Reconcile the weekly operating plan", "planning", level: .important, context: .life, sourceId: "claude", sourceName: "Claude"),
                thread("important-3", "Review source health failure states", "gajendra", level: .important, context: .engineering, sourceId: "grok", sourceName: "Grok Build"),
                thread("important-4", "Check the plugin host reload evidence", "harness", level: .important, sourceId: "cursor", sourceName: "Cursor"),
                thread("important-5", "Confirm dark appearance contrast", "design-system", level: .important, context: .design),
                thread("important-6", "Archive the release receipts", "operations", level: .important),
            ],
            available: [thread("recent-1", "Reconcile the weekly plan", "planning")],
            collapsed: CollapsedSections(focus: false, important: true),
            focusGuide: 5,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: "fixture",
            sources: [
                ThreadSourceStatus(id: "codex", name: "Codex", kind: "codex-app-server", state: "ready", enabled: true, threadCount: 3),
                ThreadSourceStatus(id: "claude", name: "Claude", kind: "claude-jsonl", state: "ready", enabled: true, threadCount: 1),
                ThreadSourceStatus(id: "cursor", name: "Cursor", kind: "cursor-cli", state: "not-installed", enabled: true, threadCount: 0),
                ThreadSourceStatus(id: "grok", name: "Grok Build", kind: "grok-summary", state: "disabled", enabled: false, threadCount: 0),
            ],
            error: nil
        )
        let organizerSnapshot = DeckSnapshot(
            generatedAt: cardSnapshot.generatedAt,
            current: now,
            focus: [now, thread("organizer-focus-2", "Review launch evidence", "tooling", level: .focus)],
            important: [thread("organizer-important-1", "Prepare the next design pass", "design-system", level: .important, context: .life)],
            available: cardSnapshot.available,
            collapsed: cardSnapshot.collapsed,
            focusGuide: cardSnapshot.focusGuide,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: cardSnapshot.source,
            sources: cardSnapshot.sources,
            error: nil
        )
        let cardModel = DeckViewModel(client: nil, initialSnapshot: cardSnapshot)
        let organizerModel = DeckViewModel(client: nil, initialSnapshot: organizerSnapshot)
        let arguments = Array(CommandLine.arguments.dropFirst())
        let organizerDestination = arguments.first ?? "gajendra-organizer.png"
        let cardDestination = arguments.dropFirst().first ?? "gajendra-hover-card.png"
        let pillDestination = arguments.dropFirst(2).first ?? "gajendra-pill.png"
        let darkOrganizerDestination = arguments.dropFirst(3).first ?? "gajendra-organizer-dark.png"
        let darkCardDestination = arguments.dropFirst(4).first ?? "gajendra-hover-card-dark.png"
        let darkPillDestination = arguments.dropFirst(5).first ?? "gajendra-pill-dark.png"
        let focusOrganizerDestination = arguments.dropFirst(6).first ?? "gajendra-focus-deck-organizer.png"
        let focusCardDestination = arguments.dropFirst(7).first ?? "gajendra-focus-deck-hover-card.png"
        let focusPillDestination = arguments.dropFirst(8).first ?? "gajendra-focus-deck-pill.png"
        let focusDarkOrganizerDestination = arguments.dropFirst(9).first ?? "gajendra-focus-deck-organizer-dark.png"
        let focusDarkCardDestination = arguments.dropFirst(10).first ?? "gajendra-focus-deck-hover-card-dark.png"
        let focusDarkPillDestination = arguments.dropFirst(11).first ?? "gajendra-focus-deck-pill-dark.png"
        let compactCardDestination = arguments.dropFirst(12).first ?? "gajendra-hover-card-compact.png"
        let expandedCardDestination = arguments.dropFirst(13).first ?? "gajendra-hover-card-expanded.png"

        try renderSuite(
            organizerModel: organizerModel,
            cardModel: cardModel,
            theme: .nativePopover,
            appearance: .light,
            organizer: organizerDestination,
            card: cardDestination,
            pill: pillDestination
        )
        try renderSuite(
            organizerModel: organizerModel,
            cardModel: cardModel,
            theme: .nativePopover,
            appearance: .dark,
            organizer: darkOrganizerDestination,
            card: darkCardDestination,
            pill: darkPillDestination
        )
        try renderSuite(
            organizerModel: organizerModel,
            cardModel: cardModel,
            theme: .focusDeck,
            appearance: .light,
            organizer: focusOrganizerDestination,
            card: focusCardDestination,
            pill: focusPillDestination
        )
        try renderSuite(
            organizerModel: organizerModel,
            cardModel: cardModel,
            theme: .focusDeck,
            appearance: .dark,
            organizer: focusDarkOrganizerDestination,
            card: focusDarkCardDestination,
            pill: focusDarkPillDestination
        )
        try renderCard(
            model: cardModel,
            theme: .nativePopover,
            appearance: .light,
            size: .compact,
            destination: compactCardDestination
        )
        try renderCard(
            model: cardModel,
            theme: .nativePopover,
            appearance: .light,
            size: .expanded,
            destination: expandedCardDestination
        )
    }

    @MainActor
    private static func renderCard(
        model: DeckViewModel,
        theme: GajendraVisualTheme,
        appearance: ColorScheme,
        size: GajendraHoverCardSize,
        destination: String
    ) throws {
        let settings = GajendraVisualSettings(
            theme: theme,
            appearance: appearance == .dark ? .dark : .light,
            hoverCardSize: size
        )
        let cardSize = GajendraHoverCardSizing.size(
            for: size,
            visibleFrame: CGRect(x: 0, y: 0, width: 1512, height: 949)
        )
        try render(
            GajendraHoverCardView(model: model, visualSettings: settings, isPreview: true),
            width: cardSize.width,
            height: cardSize.height,
            destination: destination,
            colorScheme: appearance
        )
    }

    @MainActor
    private static func renderSuite(
        organizerModel: DeckViewModel,
        cardModel: DeckViewModel,
        theme: GajendraVisualTheme,
        appearance: ColorScheme,
        organizer: String,
        card: String,
        pill: String
    ) throws {
        let setting = GajendraVisualSettings(
            theme: theme,
            appearance: appearance == .dark ? .dark : .light
        )
        try render(
            DeckContentView(model: organizerModel, visualSettings: setting, usesScrollView: false, isPreview: true),
            width: 620,
            height: 650,
            destination: organizer,
            colorScheme: appearance
        )
        try render(
            GajendraHoverCardView(model: cardModel, visualSettings: setting, isPreview: true),
            width: GajendraHoverCardSizing.size(
                for: .comfortable,
                visibleFrame: CGRect(x: 0, y: 0, width: 1512, height: 949)
            ).width,
            height: GajendraHoverCardSizing.size(
                for: .comfortable,
                visibleFrame: CGRect(x: 0, y: 0, width: 1512, height: 949)
            ).height,
            destination: card,
            colorScheme: appearance
        )
        try render(
            GajendraPillView(
                model: cardModel,
                visualSettings: setting,
                editController: GajendraPillEditController(),
                onHoverChanged: { _ in },
                onActivate: {}
            ),
            width: 60,
            height: 60,
            destination: pill,
            colorScheme: appearance
        )
    }

    @MainActor
    private static func render<Content: View>(
        _ content: Content,
        width: CGFloat,
        height: CGFloat,
        destination: String,
        colorScheme: ColorScheme
    ) throws {
        let renderer = ImageRenderer(content: content.environment(\.colorScheme, colorScheme))
        renderer.scale = 2
        renderer.proposedSize = ProposedViewSize(width: width, height: height)
        guard let image = renderer.nsImage,
              let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            throw PreviewError.renderFailed
        }
        try png.write(to: URL(fileURLWithPath: destination), options: .atomic)
    }

    private static func thread(
        _ id: String,
        _ title: String,
        _ project: String,
        level: PriorityLevel? = nil,
        current: Bool = false,
        context: ThreadContext? = nil,
        sourceId: String = "codex",
        sourceName: String = "Codex"
    ) -> DeckThread {
        DeckThread(
            id: "\(sourceId):\(id)",
            sourceId: sourceId,
            sourceName: sourceName,
            title: title,
            project: project,
            updatedAt: 1_786_473_600,
            status: "idle",
            level: level,
            isCurrent: current,
            context: context,
            deepLink: "\(sourceId)://threads/\(id)",
            resumeCommand: nil
        )
    }

    private enum PreviewError: Error {
        case renderFailed
    }
}
