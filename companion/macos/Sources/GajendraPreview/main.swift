import AppKit
import GajendraKit
import SwiftUI

@main
enum GajendraPreview {
    @MainActor
    static func main() throws {
        let now = thread("focus-1", "Finish the Gaja hover-pill release", "gajendra", level: .focus, current: true, context: .design)
        let snapshot = DeckSnapshot(
            generatedAt: "2026-08-12T00:00:00Z",
            current: now,
            focus: [now, thread("focus-2", "Review launch evidence", "tooling", level: .focus)],
            important: [thread("important-1", "Prepare the next design pass", "design-system", level: .important, context: .life)],
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
            ],
            error: nil
        )
        let model = DeckViewModel(client: nil, initialSnapshot: snapshot)
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

        try renderSuite(
            model: model,
            theme: .nativePopover,
            appearance: .light,
            organizer: organizerDestination,
            card: cardDestination,
            pill: pillDestination
        )
        try renderSuite(
            model: model,
            theme: .nativePopover,
            appearance: .dark,
            organizer: darkOrganizerDestination,
            card: darkCardDestination,
            pill: darkPillDestination
        )
        try renderSuite(
            model: model,
            theme: .focusDeck,
            appearance: .light,
            organizer: focusOrganizerDestination,
            card: focusCardDestination,
            pill: focusPillDestination
        )
        try renderSuite(
            model: model,
            theme: .focusDeck,
            appearance: .dark,
            organizer: focusDarkOrganizerDestination,
            card: focusDarkCardDestination,
            pill: focusDarkPillDestination
        )
    }

    @MainActor
    private static func renderSuite(
        model: DeckViewModel,
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
            DeckContentView(model: model, visualSettings: setting, usesScrollView: false, isPreview: true),
            width: 620,
            height: 650,
            destination: organizer,
            colorScheme: appearance
        )
        try render(
            GajendraHoverCardView(model: model, visualSettings: setting, isPreview: true),
            width: 428,
            height: 326,
            destination: card,
            colorScheme: appearance
        )
        try render(
            GajendraPillView(
                model: model,
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
        context: ThreadContext? = nil
    ) -> DeckThread {
        DeckThread(
            id: "codex:\(id)",
            sourceId: "codex",
            sourceName: "Codex",
            title: title,
            project: project,
            updatedAt: 1_786_473_600,
            status: "idle",
            level: level,
            isCurrent: current,
            context: context,
            deepLink: "codex://threads/\(id)",
            resumeCommand: nil
        )
    }

    private enum PreviewError: Error {
        case renderFailed
    }
}
