package com.azad.sayit;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;
import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.Continue;
import com.onesignal.notifications.INotificationClickEvent;
import com.onesignal.notifications.INotificationClickListener;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final String ONESIGNAL_APP_ID = "6c42b899-7188-4e29-9056-b9c316bc0c74";

    // URL waiting to be dispatched once the WebView is ready (cold-start case)
    private String pendingNavUrl = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register OneSignal plugin before super.onCreate
        registerPlugin(OneSignalPlugin.class);

        super.onCreate(savedInstanceState);

        OneSignal.getDebug().setLogLevel(LogLevel.NONE);
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);

        // ── Notification tap handler ──────────────────────────────────────
        // When the user taps a push notification, read the "url" field from
        // the notification's additionalData and navigate the Capacitor WebView
        // to that in-app route.
        OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
            @Override
            public void onClick(INotificationClickEvent event) {
                try {
                    JSONObject data = event.getNotification().getAdditionalData();
                    if (data == null || !data.has("url")) return;
                    final String url = data.getString("url");
                    if (url == null || url.isEmpty()) return;

                    android.util.Log.d("SayIt", "Notification tapped → navigating to: " + url);

                    // Post on the main thread — WebView methods must run there.
                    // Delay 1.5 s to let the WebView finish loading after the app
                    // is brought to the foreground (cold-start or background wakeup).
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        try {
                            // Escape single quotes so the JS string literal is safe
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
    }
}
