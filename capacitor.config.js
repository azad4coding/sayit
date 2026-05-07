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
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

module.exports = config;
