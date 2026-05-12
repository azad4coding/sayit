import Foundation
import Capacitor
import Contacts

// ── Inline Contacts plugin ────────────────────────────────────────────────────
// Replaces @capacitor-community/contacts (which requires CocoaPods, incompatible
// with Capacitor 8 SPM). Registered as jsName "Contacts" so the existing
// contacts.ts dynamic import routes here via the Capacitor bridge.

@objc(ContactsPlugin)
public class ContactsPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier   = "ContactsPlugin"
    public let jsName       = "Contacts"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermissions",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getContacts",        returnType: CAPPluginReturnPromise),
    ]

    // ── Permission check ─────────────────────────────────────────────────────

    @objc func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["contacts": statusString(CNContactStore.authorizationStatus(for: .contacts))])
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        CNContactStore().requestAccess(for: .contacts) { granted, _ in
            call.resolve(["contacts": granted ? "granted" : "denied"])
        }
    }

    // ── Fetch contacts ───────────────────────────────────────────────────────

    @objc func getContacts(_ call: CAPPluginCall) {
        guard CNContactStore.authorizationStatus(for: .contacts) == .authorized else {
            call.resolve(["contacts": []])
            return
        }

        let keys: [CNKeyDescriptor] = [
            CNContactGivenNameKey   as CNKeyDescriptor,
            CNContactFamilyNameKey  as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
        ]

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                var results: [[String: Any]] = []
                let request = CNContactFetchRequest(keysToFetch: keys)
                try CNContactStore().enumerateContacts(with: request) { contact, _ in
                    let given  = contact.givenName
                    let family = contact.familyName
                    let display = "\(given) \(family)".trimmingCharacters(in: .whitespaces)
                    guard !display.isEmpty else { return }

                    let phones = contact.phoneNumbers.map { ["number": $0.value.stringValue] }
                    guard !phones.isEmpty else { return }

                    results.append([
                        "contactId": contact.identifier,
                        "name": [
                            "display": display,
                            "given":   given,
                            "family":  family,
                        ],
                        "phones": phones,
                    ])
                }
                call.resolve(["contacts": results])
            } catch {
                call.reject("Failed to fetch contacts: \(error.localizedDescription)")
            }
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private func statusString(_ status: CNAuthorizationStatus) -> String {
        switch status {
        case .authorized:                return "granted"
        case .denied, .restricted:       return "denied"
        case .notDetermined:             return "prompt"
        @unknown default:                return "denied"
        }
    }
}
