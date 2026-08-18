import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

private enum GajendraUITestError: Error, CustomStringConvertible {
    case failed(String)

    var description: String {
        switch self {
        case let .failed(message): message
        }
    }
}

private struct WindowSnapshot {
    let bounds: CGRect
    let layer: Int
    let isOnScreen: Bool
    let alpha: CGFloat
}

@main
@MainActor
enum GajendraUITest {
    private static let timeout: TimeInterval = 5

    static func main() {
        do {
            try run()
            print(#"{"status":"passed","stationaryToggle":true,"microMovementReopen":true,"editModeTapRecovery":true,"accessibilityPressRecovery":true,"outerEdgeTarget":true}"#)
        } catch {
            fputs("Gajendra UI test failed: \(error)\n", stderr)
            exit(1)
        }
    }

    private static func run() throws {
        guard let rawPID = CommandLine.arguments.dropFirst().compactMap(Int32.init).last,
              rawPID > 0 else {
            throw GajendraUITestError.failed("expected one positive Gajendra PID")
        }
        guard CGPreflightPostEventAccess() else {
            throw GajendraUITestError.failed("the UI test host lacks permission to post pointer events")
        }
        NSRunningApplication(processIdentifier: rawPID)?.activate(options: .activateIgnoringOtherApps)
        Thread.sleep(forTimeInterval: 0.2)
        let originalPointer = CGEvent(source: nil)?.location ?? .zero
        defer { postMove(to: originalPointer) }

        let pill = try waitForPill(pid: rawPID)
        _ = try waitForPillHelp(pid: rawPID, containing: "Click to show or hide priorities")
        Thread.sleep(forTimeInterval: 0.3)

        try tap(pill.center)
        try waitForCard(pid: rawPID, visible: true, label: "stationary open")
        try tap(pill.center)
        try waitForCard(pid: rawPID, visible: false, label: "stationary close")

        try microMovementTap(pill.center)
        try waitForCard(pid: rawPID, visible: true, label: "micro-movement open")
        try tap(pill.center)
        try waitForCard(pid: rawPID, visible: false, label: "micro-movement close")

        try doubleTap(pill.center)
        _ = try waitForPillHelp(pid: rawPID, containing: "Click to open priorities and finish moving")
        try microMovementTap(pill.center)
        try waitForCard(pid: rawPID, visible: true, label: "edit-mode tap recovery")
        _ = try waitForPillHelp(pid: rawPID, containing: "Click to show or hide priorities")
        try tap(pill.center)
        try waitForCard(pid: rawPID, visible: false, label: "edit-mode recovery close")

        try doubleTap(pill.center)
        let editingButton = try waitForPillHelp(pid: rawPID, containing: "Click to open priorities and finish moving")
        guard AXUIElementPerformAction(editingButton, kAXPressAction as CFString) == .success else {
            throw GajendraUITestError.failed("the launcher accessibility press action was unavailable")
        }
        try waitForCard(pid: rawPID, visible: true, label: "accessibility press recovery")
        _ = try waitForPillHelp(pid: rawPID, containing: "Click to show or hide priorities")
        try tap(pill.center)
        try waitForCard(pid: rawPID, visible: false, label: "accessibility recovery close")

        let outerEdge = CGPoint(x: pill.minX + 8, y: pill.midY)
        try tap(outerEdge)
        try waitForCard(pid: rawPID, visible: true, label: "outer-edge open")
        try tap(pill.center)
        try waitForCard(pid: rawPID, visible: false, label: "outer-edge recovery close")
    }

    private static func waitForPill(pid: pid_t) throws -> CGRect {
        try waitForWindow(pid: pid, width: 60, height: 60)
    }

    private static func waitForWindow(pid: pid_t, width: CGFloat, height: CGFloat) throws -> CGRect {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let match = windows(pid: pid).first(where: {
                $0.isOnScreen
                    && abs($0.bounds.width - width) < 0.5
                    && abs($0.bounds.height - height) < 0.5
            }) {
                return match.bounds
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed("timed out waiting for the \(Int(width)) by \(Int(height)) window")
    }

    private static func waitForCard(pid: pid_t, visible: Bool, label: String) throws {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            let cardVisible = windows(pid: pid).contains {
                $0.isOnScreen
                    && $0.layer > 0
                    && $0.bounds.width >= 300
                    && $0.bounds.height >= 300
                    && $0.alpha > 0.01
            }
            if cardVisible == visible { return }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        let summary = windows(pid: pid)
            .map { "\(Int($0.bounds.width))x\(Int($0.bounds.height))@layer\($0.layer):on=\($0.isOnScreen):alpha=\(String(format: "%.2f", $0.alpha))" }
            .joined(separator: ",")
        throw GajendraUITestError.failed("timed out during \(label); windows=\(summary)")
    }

    private static func windows(pid: pid_t) -> [WindowSnapshot] {
        let rawWindows = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as? [[String: Any]] ?? []
        return rawWindows.compactMap { window in
            guard (window[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == pid,
                  let rawBounds = window[kCGWindowBounds as String] as? [String: Any],
                  let x = number(rawBounds["X"]),
                  let y = number(rawBounds["Y"]),
                  let width = number(rawBounds["Width"]),
                  let height = number(rawBounds["Height"]) else { return nil }
            return WindowSnapshot(
                bounds: CGRect(x: x, y: y, width: width, height: height),
                layer: (window[kCGWindowLayer as String] as? NSNumber)?.intValue ?? 0,
                isOnScreen: (window[kCGWindowIsOnscreen as String] as? NSNumber)?.boolValue == true,
                alpha: number(window[kCGWindowAlpha as String]) ?? 1
            )
        }
    }

    private static func number(_ value: Any?) -> CGFloat? {
        (value as? NSNumber).map { CGFloat(truncating: $0) }
    }

    private static func waitForPillHelp(pid: pid_t, containing expected: String) throws -> AXUIElement {
        let deadline = Date().addingTimeInterval(timeout)
        var observed = "launcher button unavailable"
        repeat {
            if let button = pillButton(pid: pid) {
                let help = attribute(button, kAXHelpAttribute) as? String ?? "help unavailable"
                observed = help
                if help.contains(expected) { return button }
            }
            Thread.sleep(forTimeInterval: 0.05)
        } while Date() < deadline
        throw GajendraUITestError.failed("timed out waiting for launcher state: \(expected); observed: \(observed)")
    }

    private static func pillButton(pid: pid_t) -> AXUIElement? {
        let application = AXUIElementCreateApplication(pid)
        return firstPillButton(in: application, depth: 0)
    }

    private static func firstPillButton(in element: AXUIElement, depth: Int) -> AXUIElement? {
        guard depth <= 12 else { return nil }
        if attribute(element, kAXRoleAttribute) as? String == kAXButtonRole,
           let size = elementSize(element),
           abs(size.width - 60) < 0.5,
           abs(size.height - 60) < 0.5 {
            return element
        }
        guard let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] else { return nil }
        for child in children {
            if let match = firstPillButton(in: child, depth: depth + 1) { return match }
        }
        return nil
    }

    private static func elementSize(_ element: AXUIElement) -> CGSize? {
        guard let value = attribute(element, kAXSizeAttribute),
              CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
        var size = CGSize.zero
        guard AXValueGetValue(value as! AXValue, .cgSize, &size) else { return nil }
        return size
    }

    private static func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
        var result: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &result) == .success else { return nil }
        return result
    }

    private static func tap(_ point: CGPoint) throws {
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.06)
        try postMouse(.leftMouseUp, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.7)
    }

    private static func microMovementTap(_ point: CGPoint) throws {
        let end = CGPoint(x: point.x + 2, y: point.y + 1)
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.06)
        try postMouse(.leftMouseDragged, at: end, clickState: 1)
        Thread.sleep(forTimeInterval: 0.03)
        try postMouse(.leftMouseUp, at: end, clickState: 1)
        Thread.sleep(forTimeInterval: 0.7)
    }

    private static func doubleTap(_ point: CGPoint) throws {
        Thread.sleep(forTimeInterval: 0.7)
        postMove(to: point)
        Thread.sleep(forTimeInterval: 0.04)
        try postMouse(.leftMouseDown, at: point, clickState: 1)
        try postMouse(.leftMouseUp, at: point, clickState: 1)
        Thread.sleep(forTimeInterval: 0.08)
        try postMouse(.leftMouseDown, at: point, clickState: 2)
        try postMouse(.leftMouseUp, at: point, clickState: 2)
        Thread.sleep(forTimeInterval: 0.7)
    }

    private static func postMove(to point: CGPoint) {
        CGEvent(
            mouseEventSource: nil,
            mouseType: .mouseMoved,
            mouseCursorPosition: point,
            mouseButton: .left
        )?.post(tap: .cghidEventTap)
    }

    private static func postMouse(_ type: CGEventType, at point: CGPoint, clickState: Int64) throws {
        guard let event = CGEvent(
            mouseEventSource: nil,
            mouseType: type,
            mouseCursorPosition: point,
            mouseButton: .left
        ) else {
            throw GajendraUITestError.failed("could not create a pointer event")
        }
        event.setIntegerValueField(.mouseEventClickState, value: clickState)
        event.post(tap: .cghidEventTap)
    }
}

private extension CGRect {
    var center: CGPoint { CGPoint(x: midX, y: midY) }
}
