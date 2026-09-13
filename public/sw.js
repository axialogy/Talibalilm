/*
 * The service worker, and nothing more than it has to be.
 *
 * It exists for one reason: a browser will not deliver a push notification
 * except to a service worker. So this handles `push` and `notificationclick`
 * and STOPS THERE.
 *
 * It deliberately does NOT listen for `fetch` and never touches `caches`. A
 * caching service worker in front of a Next app is its own category of bug —
 * the one where somebody is served last week's page and no amount of reloading
 * fixes it, because the worker is answering before the network is consulted.
 * Nothing here needs offline support, so nothing here takes that risk.
 *
 * `skipWaiting` + `clients.claim` so a corrected worker replaces the old one on
 * the next visit rather than waiting for every tab to close.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  // A push with no body is legal and some services send one to wake the worker.
  // Falling back to a generic message beats showing nothing, because on most
  // platforms a push event that shows no notification is a permission strike
  // against the site.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Institut Talib Alim';
  const options = {
    body: payload.body || '',
    icon: '/branding/icon-192.png',
    badge: '/branding/icon-192.png',
    tag: payload.tag || undefined,
    // Replace an earlier notification carrying the same tag rather than
    // stacking a second identical one.
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/admin' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/admin', self.location.origin).href;

  // Focus a tab that is already open on this site instead of opening a fourth
  // copy of the admin panel every time a notification is tapped.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      for (const client of clientList) {
        if ('navigate' in client) return client.navigate(target).then((c) => c && c.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});
