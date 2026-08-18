import AppKit
import GajendraKit
import SwiftUI

@main
enum GajendraPreview {
    @MainActor
    static func main() throws {
        let focusReview = reviewSignal(
            kind: .pullRequest,
            updatedAt: 1_786_473_620,
            destination: ReviewDestination(type: .url, url: "https://example.invalid/reviews/focus-2"),
            providerStatus: "FINISHED"
        )
        let importantReview = reviewSignal(
            kind: .result,
            updatedAt: 1_786_473_580,
            destination: ReviewDestination(type: .thread, deepLink: "review-agent://threads/important-1"),
            providerStatus: "READY"
        )
        let recentReview = reviewSignal(
            kind: .diff,
            updatedAt: 1_786_473_520,
            destination: ReviewDestination(type: .url, url: "https://example.invalid/reviews/recent-1"),
            providerStatus: "FINISHED"
        )
        let now = thread("focus-1", "Finish the adaptive Gajendra hover-card release", "gajendra", level: .focus, current: true, context: .design, status: "active", updatedAt: 1_786_473_650)
        let cardSnapshot = DeckSnapshot(
            generatedAt: "2026-08-12T00:00:00Z",
            current: now,
            focus: [
                now,
                thread("focus-2", "Review launch evidence", "tooling", level: .focus, context: .engineering, sourceId: "review-agent", sourceName: "Review Agent", review: focusReview),
                thread("focus-3", "Tighten the organizer interaction model", "gajendra", level: .focus, sourceId: "claude", sourceName: "Claude", status: "working", updatedAt: 1_786_473_600),
                thread("focus-4", "Verify the exact thread resume paths", "agents", level: .focus, sourceId: "cursor", sourceName: "Cursor"),
                thread("focus-5", "Write the macOS design case study", "design-system", level: .focus, context: .design),
                thread("focus-6", "Audit reduced transparency behavior", "accessibility", level: .focus, context: .engineering),
                thread("focus-7", "Prepare the installed-app smoke test", "release", level: .focus),
            ],
            important: [
                thread("important-1", "Prepare the next design pass", "design-system", level: .important, context: .design, sourceId: "review-agent", sourceName: "Review Agent", review: importantReview),
                thread("important-2", "Reconcile the weekly operating plan", "planning", level: .important, context: .life, sourceId: "claude", sourceName: "Claude", status: "streaming", updatedAt: 1_786_473_550),
                thread("important-3", "Review source health failure states", "gajendra", level: .important, context: .engineering, sourceId: "grok", sourceName: "Grok Build"),
                thread("important-4", "Check the plugin host reload evidence", "harness", level: .important, sourceId: "cursor", sourceName: "Cursor"),
                thread("important-5", "Confirm dark appearance contrast", "design-system", level: .important, context: .design),
                thread("important-6", "Archive the release receipts", "operations", level: .important),
            ],
            available: [
                thread("running-1", "Validate the provider activity contract", "agents", sourceId: "review-agent", sourceName: "Review Agent", status: "in-progress", updatedAt: 1_786_473_500, review: focusReview),
                thread("running-2", "Watch the release verification", "gajendra", sourceId: "grok", sourceName: "Grok Build", status: "running", updatedAt: 1_786_473_450),
                thread("recent-1", "Reconcile the weekly plan", "planning", sourceId: "review-agent", sourceName: "Review Agent", review: recentReview),
            ],
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
                ThreadSourceStatus(id: "review-agent", name: "Review Agent", kind: "configured", state: "ready", enabled: true, threadCount: 4),
            ],
            error: nil
        )
        let organizerSnapshot = DeckSnapshot(
            generatedAt: cardSnapshot.generatedAt,
            current: now,
            focus: [now, thread("organizer-focus-2", "Review launch evidence", "tooling", level: .focus, sourceId: "review-agent", sourceName: "Review Agent", review: focusReview)],
            important: [thread("organizer-important-1", "Prepare the next design pass", "design-system", level: .important, context: .life, sourceId: "review-agent", sourceName: "Review Agent", review: importantReview)],
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
        let busyCardModel = DeckViewModel(client: nil, initialSnapshot: cardSnapshot, previewBusy: true)
        let reviewPreviewNow = thread(
            "review-preview-now",
            "Keep one clear focus while reviews arrive",
            "gajendra",
            level: .focus,
            current: true
        )
        let reviewRows = (1...10).map { index in
            let destination = index == 2
                ? ReviewDestination(type: .thread, deepLink: "review-agent://threads/review-\(index)")
                : ReviewDestination(type: .url, url: "https://example.invalid/reviews/review-\(index)")
            return thread(
                "review-\(index)",
                "Review ready result \(index)",
                index.isMultiple(of: 2) ? "agent-platform" : "desktop-client",
                level: index == 1 ? .important : nil,
                sourceId: "review-agent",
                sourceName: "Review Agent",
                updatedAt: 1_786_474_000 - Double(index),
                review: reviewSignal(
                    kind: index == 2 ? .result : .diff,
                    updatedAt: 1_786_474_100 - Double(index),
                    destination: destination,
                    providerStatus: index == 2 ? "READY" : "FINISHED"
                )
            )
        }
        let reviewPreviewSnapshot: ([DeckThread], [DeckThread]) -> DeckSnapshot = { important, available in
            DeckSnapshot(
                generatedAt: cardSnapshot.generatedAt,
                current: reviewPreviewNow,
                focus: [reviewPreviewNow],
                important: important,
                available: available,
                collapsed: CollapsedSections(focus: false, important: false),
                focusGuide: 5,
                focusOverGuide: false,
                staleEntryCount: 0,
                source: "fixture",
                sources: [ThreadSourceStatus(
                    id: "review-agent", name: "Review Agent", kind: "configured", state: "ready",
                    enabled: true, threadCount: important.count + available.count
                )],
                error: nil
            )
        }
        let oneReviewModel = DeckViewModel(
            client: nil,
            initialSnapshot: reviewPreviewSnapshot([reviewRows[0]], [])
        )
        let emptyReviewModel = DeckViewModel(
            client: nil,
            initialSnapshot: reviewPreviewSnapshot([], [])
        )
        let tenReviewModel = DeckViewModel(
            client: nil,
            initialSnapshot: reviewPreviewSnapshot([reviewRows[0]], Array(reviewRows.dropFirst()))
        )

        // Public launch captures use real SwiftUI views with deliberately synthetic metadata.
        // The titles mirror common Codex and Claude workflows without copying any private thread.
        let launchReviewSignal = reviewSignal(
            kind: .diff,
            updatedAt: 1_786_475_030,
            destination: ReviewDestination(
                type: .url,
                url: "https://example.invalid/reviews/gajendra-launch"
            ),
            providerStatus: "FINISHED"
        )
        let launchNow = thread(
            "launch-now",
            "Prepare Gajendra's public launch",
            "Gajendra",
            level: .focus,
            current: true,
            context: .design,
            sourceId: "codex",
            sourceName: "Codex",
            status: "working",
            updatedAt: 1_786_475_100
        )
        let launchClaudeStory = thread(
            "launch-story",
            "Turn the build notes into a clear story",
            "Launch",
            level: .focus,
            context: .design,
            sourceId: "claude",
            sourceName: "Claude",
            status: "working",
            updatedAt: 1_786_475_080
        )
        let launchCodexInteraction = thread(
            "launch-interaction",
            "Polish the widget reopen flow",
            "Gajendra",
            level: .focus,
            context: .engineering,
            sourceId: "codex",
            sourceName: "Codex",
            updatedAt: 1_786_475_060
        )
        let launchClaudeSetup = thread(
            "launch-setup",
            "Simplify the first-run setup guide",
            "Docs",
            level: .important,
            context: .design,
            sourceId: "claude",
            sourceName: "Claude",
            updatedAt: 1_786_475_040
        )
        let launchCodexRelease = thread(
            "launch-release",
            "Verify the public release checklist",
            "Release",
            level: .important,
            context: .engineering,
            sourceId: "codex",
            sourceName: "Codex",
            updatedAt: 1_786_475_020
        )
        let launchReviewThread = thread(
            "launch-review",
            "Review the launch screenshot set",
            "Launch",
            sourceId: "demo-review",
            sourceName: "Demo Review Feed",
            updatedAt: 1_786_475_010,
            review: launchReviewSignal
        )
        let launchSources = [
            ThreadSourceStatus(
                id: "codex", name: "Codex", kind: "codex-app-server", state: "ready",
                enabled: true, threadCount: 3
            ),
            ThreadSourceStatus(
                id: "claude", name: "Claude", kind: "claude-jsonl", state: "ready",
                enabled: true, threadCount: 2
            ),
            ThreadSourceStatus(
                id: "demo-review", name: "Demo Review Feed", kind: "configured", state: "ready",
                enabled: true, threadCount: 1
            ),
        ]
        let launchSnapshot = DeckSnapshot(
            generatedAt: "2026-08-18T00:00:00Z",
            current: launchNow,
            focus: [launchNow, launchClaudeStory, launchCodexInteraction],
            important: [launchClaudeSetup, launchCodexRelease],
            available: [launchReviewThread],
            collapsed: CollapsedSections(focus: false, important: false),
            focusGuide: 5,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: "synthetic-launch-fixture",
            sources: launchSources,
            error: nil
        )
        let launchReviewNow = thread(
            "launch-review-now",
            "Keep one clear focus during launch week",
            "Gajendra",
            level: .focus,
            current: true,
            context: .design,
            sourceId: "codex",
            sourceName: "Codex",
            updatedAt: 1_786_475_100
        )
        let launchReviewSnapshot = DeckSnapshot(
            generatedAt: launchSnapshot.generatedAt,
            current: launchReviewNow,
            focus: [launchReviewNow],
            important: [launchClaudeSetup],
            available: [launchReviewThread],
            collapsed: CollapsedSections(focus: false, important: false),
            focusGuide: 5,
            focusOverGuide: false,
            staleEntryCount: 0,
            source: launchSnapshot.source,
            sources: launchSources,
            error: nil
        )
        let launchModel = DeckViewModel(client: nil, initialSnapshot: launchSnapshot)
        let launchReviewModel = DeckViewModel(client: nil, initialSnapshot: launchReviewSnapshot)
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
        let searchCardDestination = arguments.dropFirst(14).first ?? "gajendra-hover-card-search.png"
        let onboardingDestination = arguments.dropFirst(15).first ?? "gajendra-source-onboarding.png"
        let darkOnboardingDestination = arguments.dropFirst(16).first ?? "gajendra-source-onboarding-dark.png"
        let queueEditingDestination = arguments.dropFirst(17).first ?? "gajendra-hover-card-queue-editing.png"
        let busyCardDestination = arguments.dropFirst(18).first ?? "gajendra-hover-card-busy.png"
        let oneReviewDestination = arguments.dropFirst(19).first ?? "gajendra-hover-card-review-one.png"
        let emptyReviewDestination = arguments.dropFirst(20).first ?? "gajendra-hover-card-review-empty.png"
        let tenReviewDestination = arguments.dropFirst(21).first ?? "gajendra-hover-card-review-ten-dark-static.png"
        let launchOverviewDestination = arguments.dropFirst(22).first ?? "gajendra-launch-overview.png"
        let launchReviewDestination = arguments.dropFirst(23).first ?? "gajendra-launch-ready-for-review.png"
        let launchSearchDestination = arguments.dropFirst(24).first ?? "gajendra-launch-search.png"
        let launchQueueDestination = arguments.dropFirst(25).first ?? "gajendra-launch-queue-editing.png"
        let launchOrganizerDestination = arguments.dropFirst(26).first ?? "gajendra-launch-organizer.png"

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
        try renderCard(
            model: cardModel,
            theme: .nativePopover,
            appearance: .light,
            size: .comfortable,
            destination: searchCardDestination,
            searchQuery: "Gajendra"
        )
        try renderCard(
            model: cardModel,
            theme: .nativePopover,
            appearance: .light,
            size: .comfortable,
            destination: queueEditingDestination,
            queueEditing: true
        )
        try renderCard(
            model: busyCardModel,
            theme: .nativePopover,
            appearance: .light,
            size: .comfortable,
            destination: busyCardDestination
        )
        try renderCard(
            model: oneReviewModel,
            theme: .nativePopover,
            appearance: .light,
            size: .comfortable,
            destination: oneReviewDestination
        )
        try renderCard(
            model: emptyReviewModel,
            theme: .focusDeck,
            appearance: .light,
            size: .comfortable,
            destination: emptyReviewDestination
        )
        try renderCard(
            model: tenReviewModel,
            theme: .focusDeck,
            appearance: .dark,
            size: .expanded,
            destination: tenReviewDestination
        )
        try renderCard(
            model: launchModel,
            theme: .nativePopover,
            appearance: .light,
            size: .expanded,
            destination: launchOverviewDestination
        )
        try renderCard(
            model: launchReviewModel,
            theme: .nativePopover,
            appearance: .light,
            size: .comfortable,
            destination: launchReviewDestination
        )
        try renderCard(
            model: launchModel,
            theme: .nativePopover,
            appearance: .light,
            size: .comfortable,
            destination: launchSearchDestination,
            searchQuery: "Codex"
        )
        try renderCard(
            model: launchModel,
            theme: .nativePopover,
            appearance: .light,
            size: .comfortable,
            destination: launchQueueDestination,
            queueEditing: true
        )
        try render(
            DeckContentView(
                model: launchModel,
                visualSettings: GajendraVisualSettings(theme: .nativePopover, appearance: .light),
                usesScrollView: false,
                isPreview: true
            ),
            width: 620,
            height: 900,
            destination: launchOrganizerDestination,
            colorScheme: .light
        )
        try render(
            GajendraSourceOnboardingView(model: cardModel, isPreview: true),
            width: 640,
            height: 620,
            destination: onboardingDestination,
            colorScheme: .light
        )
        try render(
            GajendraSourceOnboardingView(model: cardModel, isPreview: true),
            width: 640,
            height: 620,
            destination: darkOnboardingDestination,
            colorScheme: .dark
        )
    }

    @MainActor
    private static func renderCard(
        model: DeckViewModel,
        theme: GajendraVisualTheme,
        appearance: ColorScheme,
        size: GajendraHoverCardSize,
        destination: String,
        searchQuery: String = "",
        queueEditing: Bool = false
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
            GajendraHoverCardView(
                model: model,
                visualSettings: settings,
                isPreview: true,
                previewSearchQuery: searchQuery,
                previewQueueEditing: queueEditing
            ),
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
                editController: GajendraPillEditController()
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
        sourceName: String = "Codex",
        status: String = "idle",
        updatedAt: Double = 1_786_473_400,
        review: ReviewSignal? = nil
    ) -> DeckThread {
        var allowedSchemes = [sourceId]
        if let value = review?.destination.value,
           let scheme = URL(string: value)?.scheme,
           !allowedSchemes.contains(scheme) {
            allowedSchemes.append(scheme)
        }
        return DeckThread(
            id: "\(sourceId):\(id)",
            sourceId: sourceId,
            sourceName: sourceName,
            title: title,
            project: project,
            updatedAt: updatedAt,
            status: status,
            level: level,
            isCurrent: current,
            context: context,
            deepLink: "\(sourceId)://threads/\(id)",
            allowedDeepLinkSchemes: allowedSchemes,
            resumeCommand: nil,
            review: review
        )
    }

    private static func reviewSignal(
        kind: ReviewKind,
        updatedAt: Double,
        destination: ReviewDestination,
        providerStatus: String
    ) -> ReviewSignal {
        ReviewSignal(
            kind: kind,
            updatedAt: updatedAt,
            destination: destination,
            providerStatus: providerStatus
        )
    }

    private enum PreviewError: Error {
        case renderFailed
    }
}
