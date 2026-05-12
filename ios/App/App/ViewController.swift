import UIKit
import Capacitor

/// Custom bridge view controller — lets us register app-local plugins explicitly
/// via capacitorDidLoad(), which runs after the bridge is fully initialised.
/// The storyboard must set customClass="ViewController" (no customModule) for this to load.
class ViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // Explicitly register SayItOSBridge so JS can call it via
        //   registerPlugin("SayItOSBridge").login({ userId: "..." })
        // CAPBridgedPlugin auto-discovery is unreliable for app-local plugins;
        // explicit registration is guaranteed.
        bridge?.registerPluginInstance(SayItOSBridge())
    }
}
