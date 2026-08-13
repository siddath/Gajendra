import AppKit
import GajendraKit
import SwiftUI

@main
enum GajendraPreview {
    @MainActor
    static func main() throws {
        let now = thread("focus-1", "Finish the Gaja hover-pill release", "gajendra", level: .focus, current: true)
        let snapshot = DeckSnapshot(
            generatedAt: "2026-08-12T00:00:00Z",
            current: now,
            focus: [now, thread("focus-2", "Review launch evidence", "tooling", level: .focus)],
            important: [thread("important-1", "Prepare the next design pass", "design-system", level: .important)],
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
        try render(
            DeckContentView(model: model, usesScrollView: false, isPreview: true),
            width: 620,
            height: 650,
            destination: organizerDestination,
            colorScheme: .light
        )
        try render(
            GajendraHoverCardView(model: model, isPreview: true),
            width: 404,
            height: 310,
            destination: cardDestination,
            colorScheme: .light
        )
        try render(
            GajendraPillView(model: model, onHoverChanged: { _ in }, onActivate: {}),
            width: 60,
            height: 60,
            destination: pillDestination,
            colorScheme: .light
        )
        try render(
            DeckContentView(model: model, usesScrollView: false, isPreview: true),
            width: 620,
            height: 650,
            destination: darkOrganizerDestination,
            colorScheme: .dark
        )
        try render(
            GajendraHoverCardView(model: model, isPreview: true),
            width: 404,
            height: 310,
            destination: darkCardDestination,
            colorScheme: .dark
        )
        try render(
            GajendraPillView(model: model, onHoverChanged: { _ in }, onActivate: {}),
            width: 60,
            height: 60,
            destination: darkPillDestination,
            colorScheme: .dark
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
        current: Bool = false
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
            deepLink: "codex://threads/\(id)",
            resumeCommand: nil
        )
    }

    private enum PreviewError: Error {
        case renderFailed
    }
}
