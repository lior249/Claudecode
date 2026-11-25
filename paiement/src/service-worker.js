'use strict';

// Service worker de l'application Overmaxx (servi à /sw.js) : il affiche les notifications
// et ouvre la bonne page quand on les touche. Pas de cache : le site reste toujours à jour.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { corps: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Overmaxx', {
    body: d.corps || '',
    icon: '/static/icones/globe-192.png',
    badge: '/static/icones/globe-badge-96.png',
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    data: { url: d.url || '/app' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let url = (e.notification.data && e.notification.data.url) || '/app';
  try {
    const u = new URL(url, self.location.origin);
    url = u.protocol === 'https:' || u.origin === self.location.origin ? u.href : new URL('/app', self.location.origin).href;
  } catch (err) { url = new URL('/app', self.location.origin).href; }
  const interne = url.startsWith(self.location.origin);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
    // L'application déjà ouverte : on la ramène devant, sur la bonne page.
    for (const f of fenetres) {
      if (interne && f.url.startsWith(self.location.origin) && 'navigate' in f) return f.focus().then(() => f.navigate(url));
    }
    return self.clients.openWindow(url);
  }));
});

// Le navigateur a renouvelé l'abonnement : on prévient le site (connecté par son cookie).
self.addEventListener('pushsubscriptionchange', (e) => {
  const options = e.oldSubscription && e.oldSubscription.options;
  if (!options) return;
  e.waitUntil(self.registration.pushManager.subscribe(options).then((abonnement) => fetch('/api/notifications/abonnement', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abonnement: abonnement.toJSON(), appareil: 'renouvelé' }),
  })));
});
