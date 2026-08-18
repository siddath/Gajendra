import GajendraKit
import AppKit
import Combine
import ServiceManagement
import SwiftUI

private final class GajendraOverlayPanel: NSPanel {
    private let acceptsKeyboardInput: Bool

    init(contentRect: NSRect, acceptsKeyboardInput: Bool) {
        self.acceptsKeyboardInput = acceptsKeyboardInput
        super.init(
            contentRect: contentRect,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("GajendraOverlayPanel does not support NSCoder initialization")
    }

    override var canBecomeKey: Bool { acceptsKeyboardInput }
    override var canBecomeMain: Bool { false }
}

private final class GajendraFirstMouseHostingView<Content: View>: NSHostingView<Content> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

private final class GajendraPillHostingView<Content: View>: NSHostingView<Content> {
    var onAccessibilityPress: (() -> Void)?
    var onAccessibilityMove: (() -> Void)?
    var accessibilityHelpProvider: (() -> String)?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .button }
    override func accessibilityLabel() -> String? { GajendraBrandCopy.name }
    override func accessibilityHelp() -> String? { accessibilityHelpProvider?() }

    override func accessibilityPerformPress() -> Bool {
        onAccessibilityPress?()
        return onAccessibilityPress != nil
    }

    override func accessibilityCustomActions() -> [NSAccessibilityCustomAction]? {
        guard onAccessibilityMove != nil else { return nil }
        return [
            NSAccessibilityCustomAction(name: "Move or hide Gajendra") { [weak self] in
                self?.onAccessibilityMove?()
                return self?.onAccessibilityMove != nil
            }
        ]
    }
}

private struct GajendraSMAppServiceAdapter: GajendraLaunchAtLoginServicing {
    func readStatus() -> GajendraLaunchAtLoginStatus {
        switch SMAppService.mainApp.status {
        case .enabled: return .enabled
        case .requiresApproval: return .requiresApproval
        case .notRegistered: return .notRegistered
        case .notFound: return .notFound
        @unknown default: return .unknown
        }
    }

    func register() throws {
        try SMAppService.mainApp.register()
    }

    func unregister() throws {
        try SMAppService.mainApp.unregister()
    }
}

@main
enum GajendraMenuBarMain {
    @MainActor
    static func main() {
        if CommandLine.arguments.contains("--unregister-launch-at-login") {
            let service = SMAppService.mainApp
            do {
                if service.status == .enabled || service.status == .requiresApproval { try service.unregister() }
                print("launchAtLoginStatus=\(service.status)")
            } catch {
                print("launchAtLoginStatus=\(service.status);error=operation-failed")
                exit(1)
            }
            return
        }
        if CommandLine.arguments.contains("--diagnose-launch-at-login") {
            let service = SMAppService.mainApp
            print("launchAtLoginStatus=\(service.status)")
            return
        }
        let app = NSApplication.shared
        let delegate = GajendraAppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)

        withExtendedLifetime(delegate) {
            app.run()
        }
    }
}

@MainActor
final class GajendraAppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    let model = DeckViewModel()
    let visualSettings = GajendraVisualSettings()
    let pillEditController = GajendraPillEditController()
    let cardInteractionSession = GajendraCardInteractionSession()
    private var organizerWindow: NSWindow?
    private var sourceOnboardingWindow: NSWindow?
    private var pillWindow: NSPanel?
    private var cardWindow: NSPanel?
    private var statusItem: NSStatusItem?
    private var workspaceActivationObserver: NSObjectProtocol?
    private var screenParametersObserver: NSObjectProtocol?
    private var cardPresentation = GajendraCardPresentationState()
    private var cardAnimationGeneration = 0
    private var launchAtLoginItem: NSMenuItem?
    private var undoMenuItem: NSMenuItem?
    private var redoMenuItem: NSMenuItem?
    private var pillVisibilityItem: NSMenuItem?
    private var pillAnchorItems: [GajendraPillAnchor: NSMenuItem] = [:]
    private var appearanceCancellable: AnyCancellable?
    private var hoverCardSizeCancellable: AnyCancellable?
    private var pillAnchorCancellable: AnyCancellable?
    private var pillEditCancellable: AnyCancellable?
    private var historyCancellable: AnyCancellable?
    private var localCardDismissMonitor: Any?
    private var globalCardDismissMonitor: Any?
    private var localEditDismissMonitor: Any?
    private var globalEditDismissMonitor: Any?
    private var editDismissPollTimer: Timer?
    private var editDismissMouseWasDown = false
    private var pillDragStart: CGPoint?
    private var pillDragPointerStart: CGPoint?
    private var pillDragDidMove = false
    private let popover = NSPopover()
    private let pillSize = NSSize(width: 60, height: 60)
    private let pillHiddenKey = "gajendra.pill.hidden"
    private let pillHasCustomOriginKey = "gajendra.pill.has-custom-origin"
    private let pillOriginXKey = "gajendra.pill.origin.x"
    private let pillOriginYKey = "gajendra.pill.origin.y"
    private let pillScreenNumberKey = "gajendra.pill.screen-number"
    private let sourceOnboardingState = GajendraSourceOnboardingState()

    func applicationDidFinishLaunching(_ notification: Notification) {
        let shouldPresentSourceOnboarding = sourceOnboardingState.shouldPresentOnLaunch(
            hasPriorNativeState: hasPriorNativePreferences()
        )
        migrateLegacyPillPosition()
        configureApplicationMenu()
        historyCancellable = model.objectWillChange.sink { [weak self] _ in
            DispatchQueue.main.async { self?.updateHistoryMenuState() }
        }
        configureAppearance()
        configurePillPlacement()
        configurePillInteraction()
        configureStatusItem()
        configurePopover()
        observeDesktopChanges()
        model.cleanupResumeScripts()
        configureLaunchAtLogin()
        model.refresh()
        if !UserDefaults.standard.bool(forKey: pillHiddenKey) {
            showPill(on: preferredScreen())
        }
        if shouldPresentSourceOnboarding {
            showSourceOnboarding(refresh: false)
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        removeCardDismissalMonitors()
        removePillEditDismissalMonitors()
        let center = NSWorkspace.shared.notificationCenter
        if let workspaceActivationObserver { center.removeObserver(workspaceActivationObserver) }
        if let screenParametersObserver {
            NotificationCenter.default.removeObserver(screenParametersObserver)
        }
        historyCancellable = nil
        model.cleanupResumeScripts()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showOrganizer()
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func windowWillClose(_ notification: Notification) {
        guard let onboardingWindow = sourceOnboardingWindow,
              notification.object as? NSWindow === onboardingWindow else { return }
        // Closing the window, including the cancel button or the window close control, does not
        // complete onboarding. It must be offered again on the next launch.
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where url.scheme == "gajendra" && url.host == "thread" {
            let encoded = url.pathComponents.dropFirst().joined(separator: "/")
            if let id = encoded.removingPercentEncoding, !id.isEmpty {
                model.openCanonicalThread(id)
            }
        }
    }

    @objc
    private func showOrganizerFromMenu(_ sender: Any?) {
        showOrganizer()
    }

    @objc
    private func showSourceOnboardingFromMenu(_ sender: Any?) {
        showSourceOnboarding()
    }

    @objc
    private func selectPillAnchor(_ sender: NSMenuItem) {
        guard let rawValue = sender.representedObject as? String,
              let anchor = GajendraPillAnchor(rawValue: rawValue) else { return }
        UserDefaults.standard.set(false, forKey: pillHiddenKey)
        let screen = pillWindow?.screen ?? preferredScreen()
        storePillScreen(screen)
        visualSettings.pillAnchor = anchor
        showPill(on: screen)
        updatePillVisibilityMenuState()
    }

    @objc
    private func togglePillVisibility(_ sender: Any?) {
        if pillWindow?.isVisible == true {
            hidePill()
        } else {
            UserDefaults.standard.set(false, forKey: pillHiddenKey)
            showPill(on: preferredScreen())
            updatePillVisibilityMenuState()
        }
    }

    @objc
    private func refreshFromMenu(_ sender: Any?) {
        model.refresh()
    }

    @objc
    private func toggleLaunchAtLogin(_ sender: NSMenuItem) {
        do {
            let service = GajendraSMAppServiceAdapter()
            _ = try GajendraLaunchAtLoginToggle(service: service).toggle()
        } catch {
            NSSound.beep()
        }
        updateLaunchAtLoginMenuState()
    }

    @objc
    private func undoFromMenu(_ sender: Any?) {
        model.undo()
        updateHistoryMenuState()
    }

    @objc
    private func redoFromMenu(_ sender: Any?) {
        model.redo()
        updateHistoryMenuState()
    }

    @objc
    private func togglePopover(_ sender: NSStatusBarButton) {
        if popover.isShown {
            popover.performClose(sender)
        } else {
            model.refresh()
            popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
        }
    }

    private func showOrganizer() {
        dismissPresentedCard(animated: false)
        let window = organizerWindow ?? makeOrganizerWindow()
        organizerWindow = window
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    private func showSourceOnboarding(refresh: Bool = true) {
        dismissPresentedCard(animated: false)
        popover.performClose(nil)
        if refresh { model.refresh() }
        let window = sourceOnboardingWindow ?? makeSourceOnboardingWindow()
        sourceOnboardingWindow = window
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    private func completeSourceOnboarding() {
        sourceOnboardingState.markCompleted()
        sourceOnboardingWindow?.close()
    }

    private func dismissSourceOnboarding() {
        sourceOnboardingWindow?.close()
    }

    private func showPill(on screen: NSScreen) {
        let panel = pillWindow ?? makePillPanel()
        pillWindow = panel
        let targetScreen = storedPillScreen() ?? screen
        let origin = GajendraOverlayPlacement.origin(
            for: visualSettings.pillAnchor,
            windowSize: panel.frame.size,
            visibleFrame: targetScreen.visibleFrame
        )
        panel.setFrameOrigin(GajendraOverlayPlacement.clampedOrigin(
            windowSize: panel.frame.size,
            proposedOrigin: origin,
            visibleFrame: targetScreen.visibleFrame
        ))
        panel.orderFrontRegardless()
        UserDefaults.standard.set(false, forKey: pillHiddenKey)
        updatePillVisibilityMenuState()
        if cardWindow?.isVisible == true {
            resizeCard(for: targetScreen, animated: false)
            positionCard()
        }
    }

    private func hidePill() {
        pillEditController.exit()
        dismissPresentedCard(animated: false)
        pillWindow?.orderOut(nil)
        UserDefaults.standard.set(true, forKey: pillHiddenKey)
        updatePillVisibilityMenuState()
    }

    private func handlePillDrag(translation: CGSize, ended: Bool) {
        guard let panel = pillWindow else { return }
        let pointerLocation = NSEvent.mouseLocation
        if pillDragStart == nil {
            pillDragStart = panel.frame.origin
            pillDragPointerStart = GajendraOverlayPlacement.pointerStart(
                pointerLocation: pointerLocation,
                gestureTranslation: translation
            )
        }
        guard let start = pillDragStart, let pointerStart = pillDragPointerStart else { return }
        guard pillDragDidMove || GajendraOverlayPlacement.isMeaningfulDrag(translation) else {
            if ended { resetPillDrag() }
            return
        }
        if !pillDragDidMove {
            pillDragDidMove = true
            // Consume the recognition dead zone instead of making the launcher
            // jump by the threshold distance on the first accepted drag sample.
            pillDragStart = panel.frame.origin
            pillDragPointerStart = pointerLocation
            dismissPresentedCard(animated: false)
            if !ended { return }
        }
        let proposed = GajendraOverlayPlacement.draggedOrigin(
            startOrigin: pillDragStart ?? start,
            pointerStart: pillDragPointerStart ?? pointerStart,
            pointerLocation: pointerLocation
        )
        let targetScreen = NSScreen.screens.first(where: { $0.frame.contains(pointerLocation) })
            ?? panel.screen
            ?? preferredScreen()
        let origin = GajendraOverlayPlacement.clampedOrigin(
            windowSize: panel.frame.size,
            proposedOrigin: proposed,
            visibleFrame: targetScreen.visibleFrame
        )
        panel.setFrameOrigin(origin)
        if ended {
            let anchor = GajendraOverlayPlacement.nearestAnchor(
                to: origin,
                windowSize: panel.frame.size,
                visibleFrame: targetScreen.visibleFrame
            )
            storePillScreen(targetScreen)
            UserDefaults.standard.set(false, forKey: pillHasCustomOriginKey)
            visualSettings.pillAnchor = anchor
            let snappedOrigin = GajendraOverlayPlacement.origin(
                for: anchor,
                windowSize: panel.frame.size,
                visibleFrame: targetScreen.visibleFrame
            )
            if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
                panel.setFrameOrigin(snappedOrigin)
            } else {
                NSAnimationContext.runAnimationGroup { context in
                    context.duration = 0.18
                    context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                    panel.animator().setFrameOrigin(snappedOrigin)
                }
            }
            resetPillDrag()
        }
    }

    private func resetPillDrag() {
        pillDragStart = nil
        pillDragPointerStart = nil
        pillDragDidMove = false
    }

    private func storePillScreen(_ screen: NSScreen) {
        guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else { return }
        UserDefaults.standard.set(number.intValue, forKey: pillScreenNumberKey)
    }

    private func storedPillScreen() -> NSScreen? {
        guard let stored = UserDefaults.standard.object(forKey: pillScreenNumberKey) as? NSNumber else { return nil }
        return NSScreen.screens.first { screen in
            (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.intValue == stored.intValue
        }
    }

    private func migrateLegacyPillPosition() {
        let defaults = UserDefaults.standard
        guard defaults.bool(forKey: pillHasCustomOriginKey) else { return }
        let origin = CGPoint(
            x: defaults.double(forKey: pillOriginXKey),
            y: defaults.double(forKey: pillOriginYKey)
        )
        let screen = screenContaining(origin) ?? preferredScreen()
        visualSettings.pillAnchor = GajendraOverlayPlacement.nearestAnchor(
            to: origin,
            windowSize: pillSize,
            visibleFrame: screen.visibleFrame
        )
        storePillScreen(screen)
        defaults.set(false, forKey: pillHasCustomOriginKey)
    }

    private func screenContaining(_ origin: CGPoint) -> NSScreen? {
        NSScreen.screens.first { screen in
            screen.visibleFrame.insetBy(dx: -pillSize.width, dy: -pillSize.height).contains(origin)
        }
    }

    private func toggleCardFromPill() {
        guard !pillEditController.isEditing else { return }
        if cardPresentation.toggle() {
            model.refresh()
            showCard()
            installCardDismissalMonitors()
        } else {
            removeCardDismissalMonitors()
            hideCard()
        }
    }

    private func dismissPresentedCard(animated: Bool = true) {
        guard cardPresentation.dismiss() else { return }
        removeCardDismissalMonitors()
        cardWindow?.makeFirstResponder(nil)
        if animated {
            hideCard()
        } else {
            hideCardImmediately()
        }
    }

    private func showCard() {
        guard !pillEditController.isEditing else { return }
        cardInteractionSession.resetTransientState()
        let panel = cardWindow ?? makeCardPanel()
        let wasVisible = panel.isVisible
        cardWindow = panel
        cardAnimationGeneration += 1
        resizeCard(for: pillWindow?.screen ?? preferredScreen(), animated: false)
        positionCard()
        if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            panel.alphaValue = 1
            panel.orderFrontRegardless()
        } else {
            panel.orderFrontRegardless()
            if !wasVisible { panel.alphaValue = 0 }
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.18
                context.allowsImplicitAnimation = true
                panel.animator().alphaValue = 1
            }
        }
    }

    private func hideCard() {
        cardInteractionSession.resetTransientState()
        guard let panel = cardWindow, panel.isVisible else { return }
        cardAnimationGeneration += 1
        let generation = cardAnimationGeneration
        if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            panel.orderOut(nil)
            panel.alphaValue = 1
            return
        }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.14
            context.allowsImplicitAnimation = true
            panel.animator().alphaValue = 0
        } completionHandler: { [weak self, weak panel] in
            Task { @MainActor in
                guard let self, let panel,
                      generation == self.cardAnimationGeneration,
                      !self.cardPresentation.isPresented else { return }
                panel.orderOut(nil)
                panel.alphaValue = 1
            }
        }
    }

    private func hideCardImmediately() {
        cardInteractionSession.resetTransientState()
        cardAnimationGeneration += 1
        cardWindow?.orderOut(nil)
        cardWindow?.alphaValue = 1
    }

    private func installCardDismissalMonitors() {
        removeCardDismissalMonitors()
        let localEvents: NSEvent.EventTypeMask = [.leftMouseDown, .rightMouseDown, .otherMouseDown, .keyDown]
        localCardDismissMonitor = NSEvent.addLocalMonitorForEvents(matching: localEvents) { [weak self] event in
            if event.type == .keyDown, event.keyCode == 53 {
                self?.dismissPresentedCard()
                return nil
            }
            if self?.eventTargetsPresentedSurface(event) != true {
                self?.dismissPresentedCard()
            }
            return event
        }
        let pointerEvents: NSEvent.EventTypeMask = [.leftMouseDown, .rightMouseDown, .otherMouseDown]
        globalCardDismissMonitor = NSEvent.addGlobalMonitorForEvents(matching: pointerEvents) { [weak self] _ in
            DispatchQueue.main.async {
                self?.dismissCardIfOutside()
            }
        }
    }

    private func removeCardDismissalMonitors() {
        if let localCardDismissMonitor { NSEvent.removeMonitor(localCardDismissMonitor) }
        if let globalCardDismissMonitor { NSEvent.removeMonitor(globalCardDismissMonitor) }
        localCardDismissMonitor = nil
        globalCardDismissMonitor = nil
    }

    private func eventTargetsPresentedSurface(_ event: NSEvent) -> Bool {
        if event.window === cardWindow || event.window === pillWindow { return true }
        if event.window?.level == .popUpMenu { return true }
        return pointTargetsPresentedSurface(NSEvent.mouseLocation)
    }

    private func pointTargetsPresentedSurface(_ point: CGPoint) -> Bool {
        pillWindow?.frame.contains(point) == true || cardWindow?.frame.contains(point) == true
    }

    private func dismissCardIfOutside() {
        if !pointTargetsPresentedSurface(NSEvent.mouseLocation) { dismissPresentedCard() }
    }

    private func focusCardSearch() {
        cardWindow?.makeKey()
    }

    private func positionCard() {
        guard let pillWindow, let cardWindow, let screen = pillWindow.screen ?? preferredScreenOptional() else { return }
        cardWindow.setFrameOrigin(
            GajendraOverlayPlacement.cardOrigin(
                cardSize: cardWindow.frame.size,
                pillFrame: pillWindow.frame,
                visibleFrame: screen.visibleFrame,
                anchor: visualSettings.pillAnchor
            )
        )
    }

    private func resizeCard(for screen: NSScreen, animated: Bool) {
        guard let panel = cardWindow else { return }
        let preferredSize = GajendraHoverCardSizing.size(
            for: visualSettings.hoverCardSize,
            visibleFrame: screen.visibleFrame
        )
        let maximumSize = GajendraOverlayPlacement.cardMaximumSize(
            for: visualSettings.pillAnchor,
            pillSize: pillSize,
            visibleFrame: screen.visibleFrame
        )
        let targetSize = NSSize(
            width: min(preferredSize.width, maximumSize.width),
            height: min(preferredSize.height, maximumSize.height)
        )
        panel.contentMinSize = NSSize(
            width: min(320, maximumSize.width),
            height: min(360, maximumSize.height)
        )
        panel.contentMaxSize = maximumSize
        guard panel.frame.size != targetSize else { return }
        let targetOrigin = pillWindow.map {
            GajendraOverlayPlacement.cardOrigin(
                cardSize: targetSize,
                pillFrame: $0.frame,
                visibleFrame: screen.visibleFrame,
                anchor: visualSettings.pillAnchor
            )
        } ?? panel.frame.origin
        let targetFrame = NSRect(origin: targetOrigin, size: targetSize)
        if animated,
           panel.isVisible,
           !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.2
                context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                panel.animator().setFrame(targetFrame, display: true)
            }
        } else {
            panel.setFrame(targetFrame, display: panel.isVisible)
        }
    }

    private func configureApplicationMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)

        let appMenu = NSMenu()
        let organizerItem = NSMenuItem(
            title: "Open Gajendra",
            action: #selector(showOrganizerFromMenu(_:)),
            keyEquivalent: "o"
        )
        organizerItem.keyEquivalentModifierMask = [.command, .shift]
        organizerItem.target = self
        appMenu.addItem(organizerItem)

        let sourcesItem = NSMenuItem(
            title: "Manage AI tools…",
            action: #selector(showSourceOnboardingFromMenu(_:)),
            keyEquivalent: ""
        )
        sourcesItem.target = self
        appMenu.addItem(sourcesItem)
        appMenu.addItem(.separator())

        let positionItem = NSMenuItem(title: "Lotus Position", action: nil, keyEquivalent: "")
        let positionMenu = NSMenu(title: "Lotus Position")
        for anchor in GajendraPillAnchor.allCases {
            let item = NSMenuItem(
                title: anchor.title,
                action: #selector(selectPillAnchor(_:)),
                keyEquivalent: ""
            )
            item.target = self
            item.representedObject = anchor.rawValue
            pillAnchorItems[anchor] = item
            positionMenu.addItem(item)
        }
        positionItem.submenu = positionMenu
        appMenu.addItem(positionItem)

        let visibilityItem = NSMenuItem(
            title: "Hide Gajendra Lotus",
            action: #selector(togglePillVisibility(_:)),
            keyEquivalent: ""
        )
        visibilityItem.target = self
        pillVisibilityItem = visibilityItem
        appMenu.addItem(visibilityItem)

        let refreshItem = NSMenuItem(
            title: "Refresh Threads",
            action: #selector(refreshFromMenu(_:)),
            keyEquivalent: "r"
        )
        refreshItem.keyEquivalentModifierMask = [.command]
        refreshItem.target = self
        appMenu.addItem(refreshItem)

        let loginItem = NSMenuItem(
            title: "Launch Gajendra at Login",
            action: #selector(toggleLaunchAtLogin(_:)),
            keyEquivalent: ""
        )
        loginItem.target = self
        launchAtLoginItem = loginItem
        appMenu.addItem(loginItem)
        appMenu.addItem(.separator())
        let uninstallItem = NSMenuItem(
            title: "Uninstall Gajendra…",
            action: #selector(requestUninstallFromMenu(_:)),
            keyEquivalent: ""
        )
        uninstallItem.target = self
        appMenu.addItem(uninstallItem)
        appMenu.addItem(
            withTitle: "Quit Gajendra",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        appMenuItem.submenu = appMenu

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        let undoItem = editMenu.addItem(
            withTitle: "Undo",
            action: #selector(undoFromMenu(_:)),
            keyEquivalent: "z"
        )
        undoItem.target = self
        undoMenuItem = undoItem

        let redoItem = editMenu.addItem(
            withTitle: "Redo",
            action: #selector(redoFromMenu(_:)),
            keyEquivalent: "z"
        )
        redoItem.keyEquivalentModifierMask = [.command, .shift]
        redoItem.target = self
        redoMenuItem = redoItem
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        NSApplication.shared.mainMenu = mainMenu
        updatePillVisibilityMenuState()
        updatePillAnchorMenuState()
        updateHistoryMenuState()
    }

    private func updatePillVisibilityMenuState() {
        pillVisibilityItem?.title = pillWindow?.isVisible == true ? "Hide Gajendra Lotus" : "Show Gajendra Lotus"
    }

    private func updatePillAnchorMenuState() {
        for (anchor, item) in pillAnchorItems {
            item.state = anchor == visualSettings.pillAnchor ? .on : .off
        }
    }

    private func updateHistoryMenuState() {
        undoMenuItem?.isEnabled = model.canUndo && !model.isLoading
        redoMenuItem?.isEnabled = model.canRedo && !model.isLoading
    }

    @objc
    private func requestUninstallFromMenu(_ sender: Any?) {
        requestUninstall()
    }

    private func requestUninstall() {
        NSApplication.shared.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Uninstall Gajendra?"
        alert.informativeText = "This moves the Gajendra app to Trash and stops Launch at Login. Your local priority metadata and provider threads are retained."
        alert.addButton(withTitle: "Move App to Trash")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        let appURL = Bundle.main.bundleURL.standardizedFileURL
        guard Bundle.main.bundleIdentifier == "dev.sid.gajendra", appURL.pathExtension == "app" else {
            showUninstallError("Gajendra must be running from its installed app bundle before it can uninstall itself.")
            return
        }

        do {
            let loginService = SMAppService.mainApp
            if loginService.status == .enabled || loginService.status == .requiresApproval {
                try loginService.unregister()
            }
            try FileManager.default.trashItem(at: appURL, resultingItemURL: nil)
            NSApplication.shared.terminate(nil)
        } catch {
            showUninstallError("Gajendra could not be uninstalled.")
        }
    }

    private func showUninstallError(_ message: String) {
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "Gajendra Could Not Be Uninstalled"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    private func configureAppearance() {
        appearanceCancellable = visualSettings.$appearance.sink { appearance in
            NSApplication.shared.appearance = appearance.appKitName.flatMap(NSAppearance.init(named:))
        }
        hoverCardSizeCancellable = visualSettings.$hoverCardSize
            .removeDuplicates()
            .dropFirst()
            .sink { [weak self] _ in
                guard let self else { return }
                self.resizeCard(for: self.pillWindow?.screen ?? self.preferredScreen(), animated: true)
            }
    }

    private func configurePillPlacement() {
        pillAnchorCancellable = visualSettings.$pillAnchor
            .removeDuplicates()
            .sink { [weak self] anchor in
                guard let self else { return }
                self.updatePillAnchorMenuState()
                guard !UserDefaults.standard.bool(forKey: self.pillHiddenKey),
                      let panel = self.pillWindow else { return }
                let screen = panel.screen ?? self.preferredScreen()
                self.dismissPresentedCard(animated: false)
                panel.setFrameOrigin(GajendraOverlayPlacement.origin(
                    for: anchor,
                    windowSize: panel.frame.size,
                    visibleFrame: screen.visibleFrame
                ))
                if self.cardWindow?.isVisible == true {
                    self.resizeCard(for: screen, animated: false)
                    self.positionCard()
                }
            }
    }

    private func configurePillInteraction() {
        pillEditCancellable = pillEditController.$isEditing
            .removeDuplicates()
            .sink { [weak self] isEditing in
                guard let self else { return }
                self.resetPillDrag()
                if isEditing {
                    self.dismissPresentedCard(animated: false)
                    self.installPillEditDismissalMonitors()
                } else {
                    self.removePillEditDismissalMonitors()
                }
            }
    }

    private func installPillEditDismissalMonitors() {
        removePillEditDismissalMonitors()
        let events: NSEvent.EventTypeMask = [.leftMouseDown, .rightMouseDown, .otherMouseDown]
        localEditDismissMonitor = NSEvent.addLocalMonitorForEvents(matching: events) { [weak self] event in
            self?.dismissPillEditIfOutside()
            return event
        }
        globalEditDismissMonitor = NSEvent.addGlobalMonitorForEvents(matching: events) { [weak self] _ in
            DispatchQueue.main.async {
                self?.dismissPillEditIfOutside()
            }
        }
        editDismissMouseWasDown = NSEvent.pressedMouseButtons != 0
        let timer = Timer(
            timeInterval: 1.0 / 30.0,
            target: self,
            selector: #selector(handleEditDismissPoll(_:)),
            userInfo: nil,
            repeats: true
        )
        RunLoop.main.add(timer, forMode: .common)
        editDismissPollTimer = timer
    }

    private func removePillEditDismissalMonitors() {
        if let localEditDismissMonitor { NSEvent.removeMonitor(localEditDismissMonitor) }
        if let globalEditDismissMonitor { NSEvent.removeMonitor(globalEditDismissMonitor) }
        editDismissPollTimer?.invalidate()
        localEditDismissMonitor = nil
        globalEditDismissMonitor = nil
        editDismissPollTimer = nil
        editDismissMouseWasDown = false
    }

    private func dismissPillEditIfOutside() {
        guard let panel = pillWindow else { return }
        _ = pillEditController.dismissIfOutside(point: NSEvent.mouseLocation, pillFrame: panel.frame)
    }

    @objc
    private func handleEditDismissPoll(_ timer: Timer) {
        pollForOutsidePillEditClick()
    }

    private func pollForOutsidePillEditClick() {
        let mouseIsDown = NSEvent.pressedMouseButtons != 0
        defer { editDismissMouseWasDown = mouseIsDown }
        guard mouseIsDown, !editDismissMouseWasDown else { return }
        dismissPillEditIfOutside()
    }

    private func configureStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        guard let button = item.button else { return }

        let image = Bundle.main.url(forResource: "GajendraMenuBar", withExtension: "svg")
            .flatMap(NSImage.init(contentsOf:))
            ?? NSImage(systemSymbolName: "camera.macro", accessibilityDescription: "Gajendra")
        image?.isTemplate = true
        button.image = image
        button.toolTip = GajendraBrandCopy.descriptor
        button.target = self
        button.action = #selector(togglePopover(_:))
        statusItem = item
    }

    private func configureLaunchAtLogin() {
        updateLaunchAtLoginMenuState()
    }

    private func updateLaunchAtLoginMenuState() {
        let status = SMAppService.mainApp.status
        launchAtLoginItem?.state = status == .enabled ? .on : .off
        switch status {
        case .enabled:
            launchAtLoginItem?.title = "Launch Gajendra at Login (On)"
        case .requiresApproval:
            launchAtLoginItem?.title = "Launch Gajendra at Login (Approval Required)"
        default:
            launchAtLoginItem?.title = "Launch Gajendra at Login (Off)"
        }
    }

    private func configurePopover() {
        popover.behavior = .transient
        popover.animates = true
        popover.contentSize = NSSize(width: 520, height: 650)
        popover.contentViewController = NSHostingController(
            rootView: DeckContentView(
                model: model,
                visualSettings: visualSettings,
                onManageSources: { [weak self] in self?.showSourceOnboarding() }
            )
        )
    }

    private func makeOrganizerWindow() -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: NSSize(width: 620, height: 700)),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Gajendra"
        window.contentViewController = NSHostingController(
            rootView: DeckContentView(
                model: model,
                visualSettings: visualSettings,
                onManageSources: { [weak self] in self?.showSourceOnboarding() }
            )
        )
        window.setContentSize(NSSize(width: 620, height: 700))
        window.contentMinSize = NSSize(width: 520, height: 620)
        window.isReleasedWhenClosed = false
        window.hidesOnDeactivate = false
        window.center()
        return window
    }

    private func makeSourceOnboardingWindow() -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: NSSize(width: 640, height: 620)),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Choose your AI tools"
        window.identifier = NSUserInterfaceItemIdentifier("gajendra-source-onboarding")
        window.contentViewController = NSHostingController(
            rootView: GajendraSourceOnboardingView(
                model: model,
                onFinish: { [weak self] in self?.completeSourceOnboarding() },
                onSkip: { [weak self] in self?.dismissSourceOnboarding() }
            )
        )
        window.setContentSize(NSSize(width: 640, height: 620))
        window.contentMinSize = NSSize(width: 560, height: 560)
        window.isReleasedWhenClosed = false
        window.hidesOnDeactivate = false
        window.delegate = self
        window.setAccessibilityLabel("Choose your AI tools for Gajendra")
        window.center()
        return window
    }

    private func makePillPanel() -> NSPanel {
        let panel = makeOverlayPanel(title: "Gajendra Focus Pill", size: pillSize, acceptsKeyboardInput: false)
        panel.setAccessibilityLabel("Gajendra focus pill")
        let hostingView = GajendraPillHostingView(
            rootView: GajendraPillView(
                model: model,
                visualSettings: visualSettings,
                editController: pillEditController,
                onActivate: { [weak self] in self?.toggleCardFromPill() },
                onOpenOrganizer: { [weak self] in self?.showOrganizer() },
                onDragChanged: { [weak self] translation, ended in self?.handlePillDrag(translation: translation, ended: ended) },
                onHide: { [weak self] in self?.hidePill() },
                onRequestUninstall: { [weak self] in self?.requestUninstall() }
            )
        )
        hostingView.onAccessibilityPress = { [weak self] in
            guard let self else { return }
            self.pillEditController.performPrimaryAction { self.toggleCardFromPill() }
        }
        hostingView.onAccessibilityMove = { [weak self] in self?.pillEditController.enter() }
        hostingView.accessibilityHelpProvider = { [weak self] in
            guard let self else { return "Click to show or hide priorities." }
            return self.pillEditController.isEditing
                ? "Click to open priorities and finish moving. Drag to a snap position. Double-click, click outside, or press Escape to finish without opening."
                : "Click to show or hide priorities. Double-click to move or hide Gajendra. Use the contextual menu for more options."
        }
        panel.contentView = hostingView
        panel.setContentSize(pillSize)
        return panel
    }

    private func makeCardPanel() -> NSPanel {
        let screen = pillWindow?.screen ?? preferredScreen()
        let preferredSize = GajendraHoverCardSizing.size(
            for: visualSettings.hoverCardSize,
            visibleFrame: screen.visibleFrame
        )
        let maximumSize = GajendraOverlayPlacement.cardMaximumSize(
            for: visualSettings.pillAnchor,
            pillSize: pillSize,
            visibleFrame: screen.visibleFrame
        )
        let cardSize = NSSize(
            width: min(preferredSize.width, maximumSize.width),
            height: min(preferredSize.height, maximumSize.height)
        )
        let panel = makeOverlayPanel(title: "Gajendra Details", size: cardSize, acceptsKeyboardInput: true)
        panel.contentMinSize = NSSize(
            width: min(320, maximumSize.width),
            height: min(360, maximumSize.height)
        )
        panel.contentMaxSize = maximumSize
        panel.setAccessibilityLabel("Gajendra priority details")
        panel.contentView = GajendraFirstMouseHostingView(
            rootView: GajendraHoverCardView(
                model: model,
                visualSettings: visualSettings,
                interactionSession: cardInteractionSession,
                onOpenOrganizer: { [weak self] in self?.showOrganizer() },
                onManageSources: { [weak self] in self?.showSourceOnboarding() },
                onDismiss: { [weak self] in self?.dismissPresentedCard() },
                onSearchFocusRequested: { [weak self] in self?.focusCardSearch() }
            )
        )
        panel.setContentSize(cardSize)
        return panel
    }

    private func makeOverlayPanel(title: String, size: NSSize, acceptsKeyboardInput: Bool) -> NSPanel {
        let panel = GajendraOverlayPanel(
            contentRect: NSRect(origin: .zero, size: size),
            acceptsKeyboardInput: acceptsKeyboardInput
        )
        panel.title = title
        panel.setContentSize(size)
        panel.contentMinSize = size
        panel.contentMaxSize = size
        panel.level = .floating
        panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = true
        panel.hidesOnDeactivate = false
        panel.canHide = false
        panel.isReleasedWhenClosed = false
        panel.isMovable = false
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.contentView?.setFrameSize(size)
        configureOverlayCollectionBehavior(panel)
        return panel
    }

    private func configureOverlayCollectionBehavior(_ panel: NSPanel) {
        var behavior: NSWindow.CollectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        if #available(macOS 15.0, *) {
            behavior.insert(.canJoinAllApplications)
        } else {
            behavior.insert(.fullScreenAuxiliary)
        }
        panel.collectionBehavior = behavior
    }

    private func preferredScreen() -> NSScreen {
        preferredScreenOptional() ?? NSScreen.screens[0]
    }

    private func preferredScreenOptional() -> NSScreen? {
        organizerWindow?.screen
            ?? popover.contentViewController?.view.window?.screen
            ?? statusItem?.button?.window?.screen
            ?? pillWindow?.screen
            ?? NSScreen.main
    }

    private func hasPriorNativePreferences() -> Bool {
        let defaults = UserDefaults.standard
        return [
            pillHiddenKey,
            pillHasCustomOriginKey,
            pillOriginXKey,
            pillOriginYKey,
            pillScreenNumberKey,
            GajendraVisualSettings.themeKey,
            GajendraVisualSettings.appearanceKey,
            GajendraVisualSettings.hoverCardSizeKey,
            GajendraVisualSettings.pillAnchorKey,
        ].contains { defaults.object(forKey: $0) != nil }
    }

    private func observeDesktopChanges() {
        workspaceActivationObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                guard !UserDefaults.standard.bool(forKey: self.pillHiddenKey) else { return }
                self.pillWindow?.orderFrontRegardless()
                if self.cardWindow?.isVisible == true { self.cardWindow?.orderFrontRegardless() }
            }
        }

        screenParametersObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                guard !UserDefaults.standard.bool(forKey: self.pillHiddenKey) else { return }
                self.showPill(on: self.preferredScreen())
            }
        }
    }
}
