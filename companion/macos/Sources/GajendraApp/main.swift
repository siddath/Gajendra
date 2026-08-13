import GajendraKit
import AppKit
import Combine
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
    let visualSettings = GajendraVisualSettings()
    let pillEditController = GajendraPillEditController()
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
    private var pillVisibilityItem: NSMenuItem?
    private var appearanceCancellable: AnyCancellable?
    private var hoverCardSizeCancellable: AnyCancellable?
    private var pillEditCancellable: AnyCancellable?
    private var localEditDismissMonitor: Any?
    private var globalEditDismissMonitor: Any?
    private var editDismissPollTimer: Timer?
    private var editDismissMouseWasDown = false
    private var pillDragStart: CGPoint?
    private var pillDragPointerStart: CGPoint?
    private let popover = NSPopover()
    private let pillSize = NSSize(width: 60, height: 60)
    private let pillHiddenKey = "gajendra.pill.hidden"
    private let pillHasCustomOriginKey = "gajendra.pill.has-custom-origin"
    private let pillOriginXKey = "gajendra.pill.origin.x"
    private let pillOriginYKey = "gajendra.pill.origin.y"

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureApplicationMenu()
        configureAppearance()
        configurePillInteraction()
        configureStatusItem()
        configurePopover()
        observeDesktopChanges()
        configureLaunchAtLogin()
        model.refresh()
        if !UserDefaults.standard.bool(forKey: pillHiddenKey) {
            showPill(on: preferredScreen())
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        hideCardWorkItem?.cancel()
        removePillEditDismissalMonitors()
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
        UserDefaults.standard.set(false, forKey: pillHasCustomOriginKey)
        UserDefaults.standard.set(false, forKey: pillHiddenKey)
        showPill(on: preferredScreen())
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
        let origin = storedPillOrigin() ?? GajendraOverlayPlacement.bottomTrailingOrigin(
            windowSize: panel.frame.size,
            visibleFrame: screen.visibleFrame
        )
        let targetScreen = screenContaining(origin) ?? screen
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
        hideCardImmediately()
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
        let proposed = GajendraOverlayPlacement.draggedOrigin(
            startOrigin: start,
            pointerStart: pointerStart,
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
            let defaults = UserDefaults.standard
            defaults.set(true, forKey: pillHasCustomOriginKey)
            defaults.set(origin.x, forKey: pillOriginXKey)
            defaults.set(origin.y, forKey: pillOriginYKey)
            pillDragStart = nil
            pillDragPointerStart = nil
        }
    }

    private func storedPillOrigin() -> CGPoint? {
        let defaults = UserDefaults.standard
        guard defaults.bool(forKey: pillHasCustomOriginKey) else { return nil }
        return CGPoint(x: defaults.double(forKey: pillOriginXKey), y: defaults.double(forKey: pillOriginYKey))
    }

    private func screenContaining(_ origin: CGPoint) -> NSScreen? {
        NSScreen.screens.first { screen in
            screen.visibleFrame.insetBy(dx: -pillSize.width, dy: -pillSize.height).contains(origin)
        }
    }

    private func setPillHovered(_ hovered: Bool) {
        let enteredPill = hoverState.setPillHovered(hovered)
        if enteredPill && !pillEditController.isEditing { model.refresh() }
        updateCardPresentation()
    }

    private func setCardHovered(_ hovered: Bool) {
        hoverState.setCardHovered(hovered)
        updateCardPresentation()
    }

    private func activatePill() {
        guard !pillEditController.isEditing else { return }
        hideCardWorkItem?.cancel()
        if cardWindow?.isVisible == true {
            hideCard()
        } else {
            showCard()
        }
    }

    private func updateCardPresentation() {
        hideCardWorkItem?.cancel()
        if pillEditController.isEditing {
            hideCardImmediately()
            return
        }
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
        guard !pillEditController.isEditing else { return }
        hideCardWorkItem?.cancel()
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
        if !wasVisible && !hoverState.pillHovered { model.refresh() }
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

    private func hideCardImmediately() {
        hideCardWorkItem?.cancel()
        cardAnimationGeneration += 1
        cardWindow?.orderOut(nil)
        cardWindow?.alphaValue = 1
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

    private func resizeCard(for screen: NSScreen, animated: Bool) {
        guard let panel = cardWindow else { return }
        let targetSize = GajendraHoverCardSizing.size(
            for: visualSettings.hoverCardSize,
            visibleFrame: screen.visibleFrame
        )
        panel.contentMaxSize = NSSize(
            width: max(320, screen.visibleFrame.width - 24),
            height: max(360, screen.visibleFrame.height - 24)
        )
        guard panel.frame.size != targetSize else { return }
        let targetOrigin = pillWindow.map {
            GajendraOverlayPlacement.cardOrigin(
                cardSize: targetSize,
                pillFrame: $0.frame,
                visibleFrame: screen.visibleFrame
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

        let visibilityItem = NSMenuItem(
            title: "Hide Gaja Lotus",
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
        updatePillVisibilityMenuState()
    }

    private func updatePillVisibilityMenuState() {
        pillVisibilityItem?.title = pillWindow?.isVisible == true ? "Hide Gaja Lotus" : "Show Gaja Lotus"
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

    private func configurePillInteraction() {
        pillEditCancellable = pillEditController.$isEditing
            .removeDuplicates()
            .sink { [weak self] isEditing in
                guard let self else { return }
                self.pillDragStart = nil
                self.pillDragPointerStart = nil
                if isEditing {
                    self.hideCardImmediately()
                    self.installPillEditDismissalMonitors()
                } else {
                    self.removePillEditDismissalMonitors()
                    self.updateCardPresentation()
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
            rootView: DeckContentView(model: model, visualSettings: visualSettings)
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
        window.contentViewController = NSHostingController(rootView: DeckContentView(model: model, visualSettings: visualSettings))
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
                visualSettings: visualSettings,
                editController: pillEditController,
                onHoverChanged: { [weak self] hovered in self?.setPillHovered(hovered) },
                onActivate: { [weak self] in self?.activatePill() },
                onDragChanged: { [weak self] translation, ended in self?.handlePillDrag(translation: translation, ended: ended) },
                onHide: { [weak self] in self?.hidePill() }
            )
        )
        panel.setContentSize(pillSize)
        return panel
    }

    private func makeCardPanel() -> NSPanel {
        let screen = pillWindow?.screen ?? preferredScreen()
        let cardSize = GajendraHoverCardSizing.size(
            for: visualSettings.hoverCardSize,
            visibleFrame: screen.visibleFrame
        )
        let panel = makeOverlayPanel(title: "Gaja Details", size: cardSize)
        panel.contentMinSize = NSSize(width: 320, height: 360)
        panel.contentMaxSize = NSSize(
            width: max(320, screen.visibleFrame.width - 24),
            height: max(360, screen.visibleFrame.height - 24)
        )
        panel.setAccessibilityLabel("Gaja priority details")
        panel.contentViewController = NSHostingController(
            rootView: GajendraHoverCardView(
                model: model,
                visualSettings: visualSettings,
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
