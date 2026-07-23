const CACHE_NAME = 'hamouda-erp-v3.3.1';
const ASSETS = [
  './', './index.html', './manifest.json',
  './assets/logo.png', './assets/logo-sm.png', './assets/mg-apphouse.png',
  './css/main.css', './css/components.css', './css/notifications.css',
  './css/modules.css', './css/invoice.css', './css/item-card.css', './css/day7.css',
  './js/core/firebase-config.js', './js/core/default-data.js', './js/core/utils.js',
  './js/core/storage.js', './js/core/cloud-sync.js',
  './js/core/auth.js', './js/core/permissions.js',
  './js/shared/transactions.js', './js/shared/item-helper.js',
  './js/modules/dashboard.js', './js/modules/warehouses.js', './js/modules/products.js',
  './js/modules/inventory.js', './js/modules/suppliers.js', './js/modules/purchases.js',
  './js/modules/customers.js', './js/modules/sales.js', './js/modules/debtors.js',
  './js/modules/returns.js', './js/modules/users.js', './js/modules/permissions.js',
  './js/modules/settings.js', './js/modules/reports.js',
  './js/modules/activity.js', './js/modules/notifications.js',
  './js/modules/bulk-payment.js',
  './js/modules/cloud-pending.js',
  './js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
  )));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
