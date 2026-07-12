const CACHE_NAME = 'relief-reminder-premium-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

let scheduledNotifications = {};

// ===== INSTALL =====
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Relief Reminder Cache dibuka');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.log('Cache error:', err))
    );
    self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Cache lama dipadam:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ===== FETCH (Offline Support) =====
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(fetchResponse => {
                    if (!fetchResponse || fetchResponse.status !== 200) {
                        return fetchResponse;
                    }
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return fetchResponse;
                }).catch(() => {
                    return caches.match('/index.html');
                });
            })
    );
});

// ===== MESSAGE HANDLER =====
self.addEventListener('message', event => {
    const { type, schedule, reminderTime, id } = event.data || {};
    
    if (type === 'SCHEDULE_NOTIFICATION') {
        // Batalkan timer lama jika ada
        if (scheduledNotifications[id]) {
            clearTimeout(scheduledNotifications[id]);
        }
        
        const delay = reminderTime - Date.now();
        
        if (delay > 0 && delay < 2147483647) { // Max setTimeout limit
            scheduledNotifications[id] = setTimeout(() => {
                showNotification(schedule);
                delete scheduledNotifications[id];
                
                // Maklumkan ke main app
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'NOTIFICATION_SENT',
                            id: id
                        });
                    });
                });
            }, delay);
            
            console.log(`⏰ Notifikasi dijadualkan dalam ${Math.round(delay/60000)} minit`);
        }
    }
    
    if (type === 'CANCEL_NOTIFICATION') {
        if (scheduledNotifications[id]) {
            clearTimeout(scheduledNotifications[id]);
            delete scheduledNotifications[id];
            console.log(`❌ Notifikasi ${id} dibatalkan`);
        }
    }
});

// ===== SHOW NOTIFICATION =====
function showNotification(schedule) {
    const dateParts = schedule.date.split('-');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    
    const options = {
        body: `Kelas: ${schedule.className}\nTarikh: ${formattedDate}\nSlot: ${schedule.slotDisplay}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: `schedule-${schedule.id}`,
        requireInteraction: true,
        renotify: true,
        data: { scheduleId: schedule.id },
        actions: [
            { action: 'open', title: 'Buka Aplikasi' },
            { action: 'close', title: 'Tutup' }
        ]
    };
    
    self.registration.showNotification(
        `📚 Relief Reminder: ${schedule.className}`, 
        options
    );
}

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
                for (let client of clients) {
                    if (client.url.includes('/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

// ===== PERIODIC SYNC (Untuk notifikasi tepat) =====
self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-schedules') {
        event.waitUntil(checkSchedules());
    }
});

async function checkSchedules() {
    console.log('🔍 Relief Reminder: Memeriksa jadual...');
}