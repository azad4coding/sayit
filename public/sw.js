// SayIt Service Worker — handles Web Push notifications

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "SayIt 💌";
  const options = {
    body:    data.body    || "You have something waiting for you",
    icon:    "/Sayit.png",
    badge:   "/Sayit.png",
    vibrate: [100, 50, 100],
    data:    { url: data.url || "/history" },
    actions: [
      { action: "open", title: "Open Card 💌" },
      { action: "dismiss", title: "Later" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/history";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // If the app is already open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
