package com.azad.sayit;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.Continue;

public class MainActivity extends BridgeActivity {

    private static final String ONESIGNAL_APP_ID = "6c42b899-7188-4e29-9056-b9c316bc0c74";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        OneSignal.getDebug().setLogLevel(LogLevel.NONE);
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);

        // Request push notification permission on Android 13+
        OneSignal.getNotifications().requestPermission(true, Continue.with(r -> {
            if (r.isSuccess() && r.getData()) {
                android.util.Log.d("OneSignal", "Push permission granted");
            }
        }));
    }
}
