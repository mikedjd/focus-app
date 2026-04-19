// Legacy service worker cleanup.
// We intentionally unregister any prior Focus service worker so GitHub Pages
// serves the latest Expo export instead of stale cached bundles.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

async function clearFocusCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith('focus-'))
      .map((key) => caches.delete(key))
  );
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await clearFocusCaches();
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
