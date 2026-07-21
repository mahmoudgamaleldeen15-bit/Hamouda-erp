// ==========================================================
// Firebase Configuration
// ==========================================================
// المشروع: hamouda-erp
// المنطقة: europe-west1 (أوروبا - أقرب لمصر)
// ==========================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDmn0TDZuSX5gSUDZuDHh_EVGUvaQNgDiY",
  authDomain: "hamouda-erp.firebaseapp.com",
  databaseURL: "https://hamouda-erp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "hamouda-erp",
  storageBucket: "hamouda-erp.firebasestorage.app",
  messagingSenderId: "849321298129",
  appId: "1:849321298129:web:a28013d68d3786ec581df0"
};

// ==========================================================
// إعدادات المزامنة الافتراضية
// ==========================================================
const SYNC_DEFAULTS = {
  auto_sync_interval_minutes: 5,
  sync_on_startup: true,
  sync_after_invoice: true,
  max_retry_attempts: 3,
  retry_delays_seconds: [5, 30, 300],
  background_retry_seconds: 30
};

// ==========================================================
// مسارات البيانات القابلة للمزامنة
// ==========================================================
const SYNC_PATHS = [
  'users',
  'warehouses',
  'products',
  'customers',
  'suppliers',
  'sales_invoices',
  'purchase_invoices',
  'inventory_txns',
  'payments',
  'sales_returns',
  'purchase_returns',
  'counters',
  'settings/company',
  'settings/payment_methods',
  'settings/permissions',
  'settings/system',
  'settings/whatsapp_templates',
  'settings/units',
  'settings/categories'
];
