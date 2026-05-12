import UIKit
import Capacitor
import OneSignalFramework
import WebKit

/// Custom bridge view controller.
/// Instead of fighting Capacitor's plugin-discovery system, we attach a
/// WKScriptMessageHandler directly to the WebView. JS can then call:
///   window.webkit.messageHandlers.sayitBridge.postMessage({...})
/// without going through the Capacitor plugin bridge at all.
class ViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override func capacitorDidLoad() {
        // bridge?.webView is the WKWebView Capacitor creates for us.
        // Adding a message handler here is safe — capacitorDidLoad fires
        // after the bridge and WebView are fully initialised.
        bridge?.webView?.configuration.userContentController
            .add(self, name: "sayitBridge")
        print("[SayItBridge] WKScriptMessageHandler registered")
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "sayitBridge",
              let body   = message.body as? [String: Any],
              let action = body["action"] as? String
        else { return }

        if action == "linkOneSignal", let userId = body["userId"] as? String {
            OneSignal.login(userId)
            print("[OneSignal] WKMessage linked userId:", userId)
        } else if action == "logoutOneSignal" {
            OneSignal.logout()
            print("[OneSignal] WKMessage logout")
        }
    }
}
