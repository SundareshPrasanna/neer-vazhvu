// Citizen reports: shows the notices a reporter turned on, and opens the page a notice points to. No caching, no fetch handling.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Neer Vazhvu", {
      body: data.body || "",
      icon: "/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let url = new URL("/for-citizens", self.location.origin);
  try {
    const asked = new URL(event.notification.data?.url || "/for-citizens", self.location.origin);
    // Only pages on this site.
    if (asked.origin === self.location.origin) url = asked;
  } catch {}
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const open = tabs.find((t) => new URL(t.url).pathname === url.pathname);
      if (open) return open.focus();
      return self.clients.openWindow(url.href);
    }),
  );
});
