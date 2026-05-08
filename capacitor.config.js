/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.azad.sayit",
  appName: "SayIt",
  webDir: "out",
  server: {
    url: "https://sayit-gamma.vercel.app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#FFF5F7",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "Light",
      backgroundColor: "#FFF5F7",
    },
  },
  ios: {
    // contentInset removed — viewportFit:cover in the web meta tag handles safe-area via CSS
    // The WKWebView now extends full-screen; env(safe-area-inset-top) works correctly
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

module.exports = config;
