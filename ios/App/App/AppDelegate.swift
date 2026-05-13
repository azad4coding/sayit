import UIKit
import Capacitor
import OneSignalFramework
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var bridgeReady = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        OneSignal.initialize("6c42b899-7188-4e29-9056-b9c316bc0c74", withLaunchOptions: launchOptions)
        OneSignal.Notifications.requestPermission({ _ in }, fallbackToSettings: true)
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        setupBridge()
    }

    // Register ContactsPlugin + sayitBridge once, after the Capacitor bridge
    // and WKWebView are fully initialised (guaranteed by applicationDidBecomeActive).
    private func setupBridge() {
        guard !bridgeReady else { return }
        DispatchQueue.main.async {
            guard let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController,
                  let bridge   = bridgeVC.bridge,
                  let webView  = bridge.webView
            else {
                print("[AppDelegate] bridge not ready yet")
                return
            }
            // Register ContactsPlugin so JS can call Contacts.checkPermissions() etc.
            bridge.registerPluginInstance(ContactsPlugin())
            // WKScriptMessageHandler for OneSignal user linking
            webView.configuration.userContentController.add(self, name: "sayitBridge")
            self.bridgeReady = true
            print("[AppDelegate] bridge setup complete ✓")
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

extension AppDelegate: WKScriptMessageHandler {
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "sayitBridge",
              let body   = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "linkOneSignal":
            if let userId = body["userId"] as? String, !userId.isEmpty {
                OneSignal.login(userId)
                print("[OneSignal] linked userId:", userId)
            }
        case "logoutOneSignal":
            OneSignal.logout()
        default: break
        }
    }
}
