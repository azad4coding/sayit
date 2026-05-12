package com.azad.sayit;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.onesignal.OneSignal;

@CapacitorPlugin(name = "OneSignalPlugin")
public class OneSignalPlugin extends Plugin {

    @PluginMethod
    public void login(PluginCall call) {
        String userId = call.getString("userId");
        if (userId == null || userId.isEmpty()) {
            call.reject("userId is required");
            return;
        }
        OneSignal.login(userId);
        call.resolve();
    }

    @PluginMethod
    public void logout(PluginCall call) {
        OneSignal.logout();
        call.resolve();
    }
}
