self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Bet+AI';
  const options = {
    body: data.body || 'Nowy alert przedmeczowy',
    icon: '/betai-coin-icon.png',
    badge: '/betai-coin-icon.png',
    tag: data.fixtureId ? `betai-fixture-${data.fixtureId}-${data.type || 'alert'}` : 'betai-alert',
    renotify: true,
    data: { url: data.url || '/', fixtureId: data.fixtureId || '' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) { if ('focus' in client) { client.navigate(target).catch(()=>{}); return client.focus(); } }
    return clients.openWindow ? clients.openWindow(target) : null;
  }));
});
