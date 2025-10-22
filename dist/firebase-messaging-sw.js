/* Placeholder Firebase Messaging service worker. Replace with your messaging implementation. */
self.addEventListener('push', (event) => {
  const data = event.data?.json?.() ?? { title: 'This is Us', body: 'New photo shared.' };
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'This is Us', {
      body: data.body ?? 'Open the app to view it.',
      icon: '/favicon.svg'
    })
  );
});
