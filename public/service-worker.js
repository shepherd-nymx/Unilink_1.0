const BUILD_ID = self.__BUILD_ID__ || String(Date.now());
const CACHE_NAME = `unilink-${BUILD_ID}`;
const OFFLINE_NOTIF_QUEUE = 'unilink-notif-queue';

const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

const isNetworkOnly = (url) => {
  const pathname = new URL(url).pathname;
  return /\/(index\.html)?$/.test(pathname) || pathname === '/version.json';
};

const isHashedBundle = (url) => url.includes('/_expo/static/');

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(
          names.map((name) => {
            if (name.startsWith('unilink-') && name !== CACHE_NAME && name !== OFFLINE_NOTIF_QUEUE) {
              return caches.delete(name);
            }
          })
        )
      ),
      self.clients.claim(),
      flushQueuedNotifications(),
    ])
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  const url = request.url;

  if (isNetworkOnly(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (isHashedBundle(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ─── Notification Queue (IndexedDB-based for persistence) ─────────────────────

function openNotifDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('unilink-notif-db', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending')) {
        const store = db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function queueNotification(payload) {
  try {
    const db = await openNotifDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').add({ ...payload, createdAt: Date.now(), attempts: 0 });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('[SW] Failed to queue notification:', err);
  }
}

async function getPendingNotifications() {
  try {
    const db = await openNotifDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readonly');
      const req = tx.objectStore('pending').getAll();
      req.onsuccess = (e) => resolve(e.target.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch {
    return [];
  }
}

async function deleteQueuedNotification(id) {
  try {
    const db = await openNotifDB();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').delete(id);
      tx.oncomplete = () => resolve();
    });
  } catch {}
}

async function flushQueuedNotifications() {
  const pending = await getPendingNotifications();
  if (!pending.length) return;

  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const item of pending) {
    const ageMs = Date.now() - item.createdAt;
    if (ageMs > 24 * 60 * 60 * 1000) {
      await deleteQueuedNotification(item.id);
      continue;
    }

    if (clientList.length > 0) {
      for (const client of clientList) {
        client.postMessage({ type: 'QUEUED_NOTIFICATION_DELIVER', payload: item });
      }
    } else {
      await self.registration.showNotification(item.title, {
        body: item.body,
        icon: item.icon || '/icon-192.png',
        badge: item.badge || '/icon-192.png',
        data: item.data || {},
        vibrate: [200, 100, 200],
        requireInteraction: false,
        tag: (item.data && item.data.type) || 'unilink-notification',
        renotify: true,
      });
    }

    await deleteQueuedNotification(item.id);
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data, icon, badge, tag } = event.data.payload;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: icon || '/icon-192.png',
        badge: badge || '/icon-192.png',
        data: data || {},
        vibrate: [200, 100, 200],
        requireInteraction: false,
        tag: tag || (data && data.type) || 'unilink-notification',
        renotify: true,
      })
    );
    return;
  }

  if (event.data.type === 'FLUSH_QUEUE') {
    event.waitUntil(flushQueuedNotifications());
    return;
  }
});

// ─── Push Handler (background push from server) ───────────────────────────────

self.addEventListener('push', (event) => {
  let payload = { title: 'UniLink', body: 'You have a new notification', data: {} };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appIsVisible = clientList.some((c) => c.visibilityState === 'visible');

      if (!appIsVisible) {
        await self.registration.showNotification(payload.title, {
          body: payload.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: payload.data || {},
          vibrate: [200, 100, 200],
          requireInteraction: false,
          tag: (payload.data && payload.data.type) || 'unilink-notification',
          renotify: true,
          actions: getNotificationActions(payload.data),
        });
      } else {
        for (const client of clientList) {
          client.postMessage({ type: 'PUSH_NOTIFICATION', payload });
        }
      }
    })()
  );
});

function getNotificationActions(data) {
  if (!data) return [];
  if (data.type === 'new_delivery') {
    return [
      { action: 'view', title: 'View Order' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  }
  if (data.type === 'new_message') {
    return [
      { action: 'reply', title: 'View Chat' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  }
  return [];
}

// ─── Notification Click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  let targetUrl = '/';

  if (data.type === 'new_message' && data.customerId) {
    targetUrl = `/customer/chat?customerId=${data.customerId}`;
  } else if (data.type === 'new_message' && data.driverId) {
    targetUrl = `/driver/chat?driverId=${data.driverId}`;
  } else if (data.type === 'new_delivery' || data.type === 'order_status') {
    targetUrl = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (targetUrl !== '/') {
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Background Sync (for queued notifications) ───────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-notifications') {
    event.waitUntil(flushQueuedNotifications());
  }
});
