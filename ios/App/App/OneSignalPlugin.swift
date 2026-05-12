import Capacitor
import OneSignalFramework

/// Thin Capacitor plugin that lets JavaScript link a user to OneSignal.
/// Call from JS: Capacitor.Plugins.OneSignalPlugin.login({ userId: "<supabase-uuid>" })
@objc(OneSignalPlugin)
public class OneSignalPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OneSignalPlugin"
    public let jsName     = "OneSignalPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "login",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise),
    ]

    /// login({ userId: string }) — sets OneSignal external_id to the Supabase UUID
    @objc func login(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("userId is required")
            return
        }
        OneSignal.login(userId)
        call.resolve()
    }

    /// logout() — clears the external_id (called on sign-out)
    @objc func logout(_ call: CAPPluginCall) {
        OneSignal.logout()
        call.resolve()
    }
}
