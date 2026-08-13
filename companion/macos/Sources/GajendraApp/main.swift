import GajendraKit
import AppKit
import ServiceManagement
import SwiftUI

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
                print("launchAtLoginStatus=\(service.status);error=\(error.localizedDescription)")
                exit(1)
            }
            return
        }
        if CommandLine.arguments.contains("--diagnose-launch-at-login") {
            let service = SMAppService.mainApp
            do {
                if service.status != .enabled && service.status != .requiresApproval { try service.register() }
                print("launchAtLoginStatus=\(service.status)")
            } catch {
                print("launchAtLoginStatus=\(service.status);error=\(error.localizedDescription)")
            }
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
final class GajendraAppDelegate: NSObject, NSApplicationDelegate {
    let model = DeckViewModel()
    private var organizerWindow: NSWindow?
    private var pillWindow: NSPanel?
    private var cardWindow: NSPanel?
    private var statusItem: NSStatusItem?
    private var workspaceActivationObserver: NSObjectProtocol?
    private var screenParametersObserver: NSObjectProtocol?
    private var hoverState = GajendraHoverState()
    private var hideCardWorkItem: DispatchWorkItem?
    private var cardAnimationGeneration = 0
    private var launchAtLoginItem: NSMenuItem?
    private let popover = NSPopover()
    private let pillSize = NSSize(width: 60, height: 60)
    private let cardSize = NSSize(width: 404, height: 310)

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureApplicationMenu()
        configureStatusItem()
        configurePopover()
        observeDesktopChanges()
        configureLaunchAtLogin()
        model.refresh()
        showPill(on: preferredScreen())
    }

    func applicationWillTerminate(_ notification: Notification) {
        hideCardWorkItem?.cancel()
        let center = NSWorkspace.shared.notificationCenter
        if let workspaceActivationObserver { center.removeObserver(workspaceActivationObserver) }
        if let screenParametersObserver {
            NotificationCenter.default.removeObserver(screenParametersObserver)
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showOrganizer()
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
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
    private func movePillHere(_ sender: Any?) {
        showPill(on: preferredScreen())
    }

    @objc
    private func refreshFromMenu(_ sender: Any?) {
        model.refresh()
    }

    @objc
    private func toggleLaunchAtLogin(_ sender: NSMenuItem) {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            NSSound.beep()
        }
        updateLaunchAtLoginMenuState()
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
        let window = organizerWindow ?? makeOrganizerWindow()
        organizerWindow = window
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    private func showPill(on screen: NSScreen) {
        let panel = pillWindow ?? makePillPanel()
        pillWindow = panel
        panel.setFrameOrigin(
            GajendraOverlayPlacement.bottomTrailingOrigin(
                windowSize: panel.frame.size,
                visibleFrame: screen.visibleFrame
            )
        )
        panel.orderFrontRegardless()
        if cardWindow?.isVisible == true { positionCard() }
    }

    private func setPillHovered(_ hovered: Bool) {
        hoverState.setPillHovered(hovered)
        updateCardPresentation()
    }

    private func setCardHovered(_ hovered: Bool) {
        hoverState.setCardHovered(hovered)
        updateCardPresentation()
    }

    private func activatePill() {
        hideCardWorkItem?.cancel()
        if cardWindow?.isVisible == true {
            hideCard()
        } else {
            showCard()
        }
    }

    private func updateCardPresentation() {
        hideCardWorkItem?.cancel()
        if hoverState.wantsCardVisible {
            showCard()
            return
        }

        let workItem = DispatchWorkItem { [weak self] in
            guard let self, !self.hoverState.wantsCardVisible else { return }
            self.hideCard()
        }
        hideCardWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22, execute: workItem)
    }

    private func showCard() {
        hideCardWorkItem?.cancel()
        let panel = cardWindow ?? makeCardPanel()
        let wasVisible = panel.isVisible
        cardWindow = panel
        cardAnimationGeneration += 1
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
        if !wasVisible { model.refresh() }
    }

    private func hideCard() {
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
                      !self.hoverState.wantsCardVisible else { return }
                panel.orderOut(nil)
                panel.alphaValue = 1
            }
        }
    }

    private func positionCard() {
        guard let pillWindow, let cardWindow, let screen = pillWindow.screen ?? preferredScreenOptional() else { return }
        cardWindow.setFrameOrigin(
            GajendraOverlayPlacement.cardOrigin(
                cardSize: cardWindow.frame.size,
                pillFrame: pillWindow.frame,
                visibleFrame: screen.visibleFrame
            )
        )
    }

    private func configureApplicationMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)

        let appMenu = NSMenu()
        let organizerItem = NSMenuItem(
            title: "Open Gaja",
            action: #selector(showOrganizerFromMenu(_:)),
            keyEquivalent: "o"
        )
        organizerItem.keyEquivalentModifierMask = [.command, .shift]
        organizerItem.target = self
        appMenu.addItem(organizerItem)

        let moveItem = NSMenuItem(
            title: "Move Gaja Lotus Here",
            action: #selector(movePillHere(_:)),
            keyEquivalent: "m"
        )
        moveItem.keyEquivalentModifierMask = [.command, .shift]
        moveItem.target = self
        appMenu.addItem(moveItem)

        let refreshItem = NSMenuItem(
            title: "Refresh Threads",
            action: #selector(refreshFromMenu(_:)),
            keyEquivalent: "r"
        )
        refreshItem.keyEquivalentModifierMask = [.command]
        refreshItem.target = self
        appMenu.addItem(refreshItem)

        let loginItem = NSMenuItem(
            title: "Launch Gaja at Login",
            action: #selector(toggleLaunchAtLogin(_:)),
            keyEquivalent: ""
        )
        loginItem.target = self
        launchAtLoginItem = loginItem
        appMenu.addItem(loginItem)
        appMenu.addItem(.separator())
        appMenu.addItem(
            withTitle: "Quit Gaja",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        appMenuItem.submenu = appMenu
        NSApplication.shared.mainMenu = mainMenu
    }

    private func configureStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        guard let button = item.button else { return }

        let image = Bundle.main.url(forResource: "GajendraMenuBar", withExtension: "svg")
            .flatMap(NSImage.init(contentsOf:))
            ?? NSImage(systemSymbolName: "camera.macro", accessibilityDescription: "Gaja")
        image?.isTemplate = true
        button.image = image
        button.toolTip = "Gaja, Elephant Focus for AI Power Users"
        button.target = self
        button.action = #selector(togglePopover(_:))
        statusItem = item
    }

    private func configureLaunchAtLogin() {
        if SMAppService.mainApp.status != .enabled && SMAppService.mainApp.status != .requiresApproval {
            try? SMAppService.mainApp.register()
        }
        updateLaunchAtLoginMenuState()
    }

    private func updateLaunchAtLoginMenuState() {
        launchAtLoginItem?.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }

    private func configurePopover() {
        popover.behavior = .transient
        popover.animates = true
        popover.contentSize = NSSize(width: 520, height: 650)
        popover.contentViewController = NSHostingController(
            rootView: DeckContentView(model: model)
        )
    }

    private func makeOrganizerWindow() -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: NSSize(width: 620, height: 700)),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Gaja"
        window.contentViewController = NSHostingController(rootView: DeckContentView(model: model))
        window.setContentSize(NSSize(width: 620, height: 700))
        window.contentMinSize = NSSize(width: 520, height: 620)
        window.isReleasedWhenClosed = false
        window.hidesOnDeactivate = false
        window.center()
        return window
    }

    private func makePillPanel() -> NSPanel {
        let panel = makeOverlayPanel(title: "Gaja Focus Pill", size: pillSize)
        panel.setAccessibilityLabel("Gaja focus pill")
        panel.contentViewController = NSHostingController(
            rootView: GajendraPillView(
                model: model,
                onHoverChanged: { [weak self] hovered in self?.setPillHovered(hovered) },
                onActivate: { [weak self] in self?.activatePill() }
            )
        )
        panel.setContentSize(pillSize)
        return panel
    }

    private func makeCardPanel() -> NSPanel {
        let panel = makeOverlayPanel(title: "Gaja Details", size: cardSize)
        panel.setAccessibilityLabel("Gaja priority details")
        panel.contentViewController = NSHostingController(
            rootView: GajendraHoverCardView(
                model: model,
                onHoverChanged: { [weak self] hovered in self?.setCardHovered(hovered) },
                onOpenOrganizer: { [weak self] in self?.showOrganizer() }
            )
        )
        panel.setContentSize(cardSize)
        return panel
    }

    private func makeOverlayPanel(title: String, size: NSSize) -> NSPanel {
        let panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
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

    private func observeDesktopChanges() {
        workspaceActivationObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
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
                self.showPill(on: self.preferredScreen())
            }
        }
    }
}
