import Capacitor
import OneSignalFramework

/// Thin Capacitor plugin that lets JavaScript link a user to OneSignal.
/// Named SayItOSBridge internally to avoid ObjC conflict with OneSignalFramework.
/// Call from JS: Capacitor.Plugins.SayItOSBridge.login({ userId: "<supabase-uuid>" })
@objc(SayItOSBridge)
public class SayItOSBridge: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SayItOSBridge"
    public let jsName     = "SayItOSBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "login",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise),
    ]

    @objc func login(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }
        OneSignal.login(userId)
        print("[OneSignal] native login called for userId:", userId)
        call.resolve()
    }

    @objc func logout(_ call: CAPPluginCall) {
        OneSignal.logout()
        call.resolve()
    }
}
