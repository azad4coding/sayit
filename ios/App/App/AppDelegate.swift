import UIKit
import Capacitor
import OneSignalFramework
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    // Guard against adding the WKScriptMessageHandler more than once
    // (applicationDidBecomeActive fires on every foreground transition).
    private var sayItBridgeInstalled = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialise OneSignal — must happen before the app finishes launching
        OneSignal.initialize("6c42b899-7188-4e29-9056-b9c316bc0c74", withLaunchOptions: launchOptions)
        // Ask for notification permission (shows system dialog once)
        OneSignal.Notifications.requestPermission({ _ in }, fallbackToSettings: true)
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Install the WebKit message handler the first time the app becomes active.
        // By this point CAPBridgeViewController.viewDidLoad has already run and the
        // WKWebView exists — so bridge?.webView is non-nil.
        installSayItBridge()
    }

    // ── WKScriptMessageHandler installation ─────────────────────────────────
    // JS calls: window.webkit.messageHandlers.sayitBridge.postMessage({...})
    // This completely bypasses Capacitor's plugin routing — no UNIMPLEMENTED.
    private func installSayItBridge() {
        guard !sayItBridgeInstalled else { return }

        // Give the Capacitor bridge one run-loop tick to finish viewDidLoad
        // before we try to access it (safety net for very fast launches).
        DispatchQueue.main.async {
            guard let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController,
                  let webView  = bridgeVC.bridge?.webView
            else {
                print("[SayItBridge] webView not ready yet — will retry on next foreground")
                return
            }
            webView.configuration.userContentController.add(self, name: "sayitBridge")
            self.sayItBridgeInstalled = true
            print("[SayItBridge] WKScriptMessageHandler installed ✓")
        }
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}
}

// ── Handle messages from JS ──────────────────────────────────────────────────
extension AppDelegate: WKScriptMessageHandler {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "sayitBridge",
              let body   = message.body as? [String: Any],
              let action = body["action"] as? String
        else { return }

        switch action {
        case "linkOneSignal":
            if let userId = body["userId"] as? String, !userId.isEmpty {
                OneSignal.login(userId)
                print("[OneSignal] linked userId:", userId)
            }
        case "logoutOneSignal":
            OneSignal.logout()
            print("[OneSignal] logged out")
        default:
            break
        }
    }
}
