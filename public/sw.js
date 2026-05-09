// SayIt Service Worker — Web Push notification handler

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { data = { body: event.data.text() }; }

  const type  = data.type  || "card";
  const title = data.title || "SayIt";
  const url   = data.url   || "/history";

  // ── WhatsApp-style: sender/reactor name as the title, action as body ──
  // card:     title="Priya"   body="Sent you a card 💌"
  // reaction: title="Rahul"   body="Reacted ❤️ to your card"
  const options = {
    body:     data.body || (type === "reaction" ? "Reacted to your card" : "Sent you a card 💌"),
    icon:     "/Sayit.png",
    badge:    "/Sayit.png",
    vibrate:  [100, 50, 100],
    // tag groups: reactions per card, cards per card — each collapses separately
    tag:      type === "reaction" ? "reaction-" + url : "card-" + url,
    renotify: true,   // always vibrate even if tag matches an existing notification
    data:     { url },
    actions:  [
      { action: "open",    title: type === "reaction" ? "View Card" : "Open 💌" },
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
      // If the app is already open — focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      // App is closed — open it
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener("install",  ()      => self.skipWaiting());
self.addEventListener("activate", (event) => { event.waitUntil(clients.claim()); });
