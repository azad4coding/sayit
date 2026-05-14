package com.azad.sayit;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.ContactsContract;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.Continue;
import com.onesignal.notifications.INotificationClickEvent;
import com.onesignal.notifications.INotificationClickListener;
import getcapacitor.community.contacts.ContactsPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.LinkedHashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private static final String ONESIGNAL_APP_ID = "6c42b899-7188-4e29-9056-b9c316bc0c74";
    private static final int CONTACTS_PERMISSION_REQUEST = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register plugins before super.onCreate
        registerPlugin(OneSignalPlugin.class);
        registerPlugin(ContactsPlugin.class);

        super.onCreate(savedInstanceState);

        OneSignal.getDebug().setLogLevel(LogLevel.NONE);
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);

        // ── Notification tap handler ──────────────────────────────────────
        OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
            @Override
            public void onClick(INotificationClickEvent event) {
                try {
                    JSONObject data = event.getNotification().getAdditionalData();
                    if (data == null || !data.has("url")) return;
                    final String url = data.getString("url");
                    if (url == null || url.isEmpty()) return;

                    android.util.Log.d("SayIt", "Notification tapped → navigating to: " + url);

                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        try {
                            String safeUrl = url.replace("'", "\\'");
                            String js =
                                "window.__sayitNavPending = '" + safeUrl + "';" +
                                "if (typeof window.__sayitHandleNav === 'function') {" +
                                "  window.__sayitHandleNav('" + safeUrl + "');" +
                                "}";
                            getBridge().getWebView().evaluateJavascript(js, null);
                        } catch (Exception ex) {
                            android.util.Log.e("SayIt", "evaluateJavascript error", ex);
                        }
                    }, 1500);

                } catch (Exception e) {
                    android.util.Log.e("SayIt", "Notification click handler error", e);
                }
            }
        });

        // Request push notification permission on Android 13+
        OneSignal.getNotifications().requestPermission(true, Continue.with(r -> {
            if (r.isSuccess() && r.getData()) {
                android.util.Log.d("OneSignal", "Push permission granted");
            }
        }));

        // Contacts permission: request if not granted, or wait for page-ready then inject
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS)
                == PackageManager.PERMISSION_GRANTED) {
            // Permission already granted — wait for the JS page to signal readiness,
            // then inject. This avoids injecting into an unloaded WebView context.
            waitForPageReadyAndInject(0);
        } else {
            // Ask for permission — result handled in onRequestPermissionsResult
            ActivityCompat.requestPermissions(this,
                new String[]{ Manifest.permission.READ_CONTACTS },
                CONTACTS_PERMISSION_REQUEST);
        }
    }

    // ── Called when the user responds to the contacts permission dialog ──
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CONTACTS_PERMISSION_REQUEST
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            android.util.Log.d("SayIt", "Contacts permission granted — waiting for page ready");
            waitForPageReadyAndInject(0);
        }
    }

    // ── Poll until window.__sayitPageReady is true, then inject contacts ──
    // This ensures contacts are always injected into the live JS context,
    // not into an empty WebView before the Next.js page has loaded.
    private void waitForPageReadyAndInject(int attempt) {
        if (attempt > 40) {
            // Gave up after ~20 s — try injecting anyway as last resort
            android.util.Log.w("SayIt", "Page-ready timeout, injecting anyway");
            injectContactsIntoWebView();
            return;
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                getBridge().getWebView().evaluateJavascript(
                    "!!window.__sayitPageReady",
                    result -> {
                        if ("true".equals(result)) {
                            android.util.Log.d("SayIt", "Page ready after " + attempt + " polls — injecting contacts");
                            injectContactsIntoWebView();
                        } else {
                            waitForPageReadyAndInject(attempt + 1);
                        }
                    }
                );
            } catch (Exception ex) {
                android.util.Log.e("SayIt", "waitForPageReadyAndInject error", ex);
                waitForPageReadyAndInject(attempt + 1);
            }
        }, 500);
    }

    // ── Cached contacts JSON — built once, served instantly on every resume ──
    private String cachedContactsJson = null;

    // ── onResume: re-inject contacts every time app comes to foreground ──────
    // This covers: page reloads (cache-bust), client-side navigation, and
    // returning from WhatsApp/SMS. Uses cached JSON after the first build so
    // subsequent injections are instant (no ContentResolver query needed).
    @Override
    public void onResume() {
        super.onResume();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS)
                == PackageManager.PERMISSION_GRANTED) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (cachedContactsJson != null) {
                    pushContactsToWebView(cachedContactsJson);
                } else {
                    injectContactsIntoWebView();
                }
            }, 400);
        }
    }

    // ── Push already-built JSON into the WebView (instant, no I/O) ───────────
    private void pushContactsToWebView(String json) {
        try {
            String js =
                "window.__sayitContactsGranted = true;" +
                "window.__sayitNativeContacts = " + json + ";" +
                "if (typeof window.__sayitContactsReady === 'function') {" +
                "  window.__sayitContactsReady();" +
                "}";
            getBridge().getWebView().evaluateJavascript(js, null);
            android.util.Log.d("SayIt", "Re-injected contacts from cache");
        } catch (Exception ex) {
            android.util.Log.e("SayIt", "pushContactsToWebView error", ex);
        }
    }

    // ── Load contacts from Android ContentResolver and inject into WebView ──
    // This bypasses the Capacitor JS bridge entirely, which can be unreliable
    // when the app loads from a remote Vercel URL.
    private void injectContactsIntoWebView() {
        new Thread(() -> {
            try {
                JSONArray contactsArray = new JSONArray();

                String[] projection = {
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                };

                Cursor cur = getContentResolver().query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    projection,
                    null, null,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
                );

                if (cur != null) {
                    Map<String, JSONArray> phoneMap = new LinkedHashMap<>();
                    while (cur.moveToNext()) {
                        String name = cur.getString(0);
                        String phone = cur.getString(1);
                        if (name == null || name.isEmpty() || phone == null || phone.isEmpty()) continue;
                        if (!phoneMap.containsKey(name)) phoneMap.put(name, new JSONArray());
                        phoneMap.get(name).put(phone);
                    }
                    cur.close();

                    for (Map.Entry<String, JSONArray> entry : phoneMap.entrySet()) {
                        JSONObject contact = new JSONObject();
                        contact.put("displayName", entry.getKey());
                        contact.put("phones", entry.getValue());
                        contactsArray.put(contact);
                    }
                }

                final String json = contactsArray.toString();
                final int count = contactsArray.length();
                cachedContactsJson = json; // cache for instant re-injection on resume

                // Switch back to main thread to call evaluateJavascript
                new Handler(Looper.getMainLooper()).post(() -> pushContactsToWebView(json));
                android.util.Log.d("SayIt", "Built contacts cache: " + count + " contacts");

            } catch (Exception e) {
                android.util.Log.e("SayIt", "Error reading contacts", e);
            }
        }).start();
    }
}
