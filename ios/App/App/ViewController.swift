import UIKit
import Capacitor
import OneSignalFramework
import WebKit

// @objc(ViewController) is REQUIRED — the storyboard resolves customClass via
// NSClassFromString("ViewController"). Without this attribute, Swift mangles
// the name to "_TtC3App14ViewController" and UIKit can't find the class,
// which causes the black-screen crash we saw previously.
@objc(ViewController)
class ViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override func capacitorDidLoad() {
        // 1. Register ContactsPlugin explicitly.
        //    CAPBridgedPlugin auto-discovery only works for SPM-distributed plugins,
        //    not app-local plugins living in the app target. Must register here.
        bridge?.registerPluginInstance(ContactsPlugin())

        // 2. Add WKScriptMessageHandler for OneSignal user linking.
        //    Bypasses Capacitor plugin routing entirely — fire-and-forget, no
        //    UNIMPLEMENTED errors. JS calls:
        //    window.webkit.messageHandlers.sayitBridge.postMessage({...})
        bridge?.webView?.configuration.userContentController
            .add(self, name: "sayitBridge")

        print("[ViewController] capacitorDidLoad ✓ — ContactsPlugin + sayitBridge ready")
    }

    // ── Handle messages from JS (OneSignal user linking) ─────────────────────
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
