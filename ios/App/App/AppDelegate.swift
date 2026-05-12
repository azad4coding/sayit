import UIKit
import Capacitor
import OneSignalFramework

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialise OneSignal — must happen before the app finishes launching
        OneSignal.initialize("6c42b899-7188-4e29-9056-b9c316bc0c74", withLaunchOptions: launchOptions)
        // Ask for notification permission (shows system dialog once)
        OneSignal.Notifications.requestPermission({ _ in }, fallbackToSettings: true)
        // Debug: check CapacitorStorage suite
        if let suite = UserDefaults(suiteName: "CapacitorStorage") {
            let suiteKeys = Array(suite.dictionaryRepresentation().keys)
            print("[DEBUG] CapacitorStorage suite keys:", suiteKeys)
        } else {
            print("[DEBUG] CapacitorStorage suite not found")
        }

        // Link the logged-in Supabase user to OneSignal
        linkOneSignalUser()
        return true
    }

    /// Reads the Supabase session from Capacitor Preferences (UserDefaults)
    /// and calls OneSignal.login() with the user's UUID — no JS bridge needed.
    private func linkOneSignalUser() {
        let key = "sb-yvsglotmanqmvcogbbkf-auth-token"
        // @capacitor/preferences v8 uses a UserDefaults suite named "CapacitorStorage"
        let prefs = UserDefaults(suiteName: "CapacitorStorage") ?? UserDefaults.standard
        guard
            let raw  = prefs.string(forKey: key),
            let data = raw.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let user = json["user"] as? [String: Any],
            let uid  = user["id"] as? String
        else {
            print("[OneSignal] no Supabase session found in CapacitorStorage suite")
            return
        }
        OneSignal.login(uid)
        print("[OneSignal] linked userId:", uid)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Re-link OneSignal user on every foreground (handles login after first launch)
        linkOneSignalUser()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
