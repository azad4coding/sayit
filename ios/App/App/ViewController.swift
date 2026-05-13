import UIKit
import Capacitor
import OneSignalFramework
import WebKit

@objc(ViewController)
class ViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ContactsPlugin())

        bridge?.webView?.configuration.userContentController
            .add(self, name: "sayitBridge")

        print("[ViewController] capacitorDidLoad ✓")
    }

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
        default:
            break
        }
    }
}
