// ==========================================================
// Storage Layer
// ==========================================================
// طبقة تخزين محلي + طبقة رفع تلقائي للسحابة
// ==========================================================

const STORAGE_PREFIX = 'hamouda_';

// المسارات اللي تتم مزامنتها مع السحابة
const SYNC_PATHS_SET = new Set([
  'users', 'warehouses', 'products', 'customers', 'suppliers',
  'sales_invoices', 'purchase_invoices', 'inventory_txns',
  'payments', 'sales_returns', 'purchase_returns', 'counters',
  'settings/company', 'settings/payment_methods', 'settings/permissions',
  'settings/system', 'settings/whatsapp_templates', 'settings/units',
  'settings/categories', 'settings/cloud_sync'
]);

// ==========================================================
// LOCAL STORAGE
// ==========================================================
const LocalStore = {
  get(path) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + path);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },

  set(path, data, skipSync = false) {
    try {
      localStorage.setItem(STORAGE_PREFIX + path, JSON.stringify(data));

      // ☁️ Auto-upload to cloud
      if (!skipSync && SYNC_PATHS_SET.has(path)) {
        this._scheduleUpload(path, data);
      }

      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  },

  update(path, updates) {
    const current = this.get(path) || {};
    return this.set(path, { ...current, ...updates });
  },

  push(path, data) {
    const id = genID();
    const list = this.get(path) || {};
    list[id] = { ...data, _id: id };
    this.set(path, list);
    return id;
  },

  remove(path) {
    localStorage.removeItem(STORAGE_PREFIX + path);
    return true;
  },

  keys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        keys.push(k.substring(STORAGE_PREFIX.length));
      }
    }
    return keys;
  },

  clearAll() {
    const keys = this.keys();
    keys.forEach(k => localStorage.removeItem(STORAGE_PREFIX + k));
  },

  // ==========================================================
  // ☁️ Schedule upload (debounced)
  // ==========================================================
  _uploadTimers: {},
  _scheduleUpload(path, data) {
    // Debounce - لو حصل كذا set في وقت قصير، ارفع مرة واحدة
    if (this._uploadTimers[path]) {
      clearTimeout(this._uploadTimers[path]);
    }

    this._uploadTimers[path] = setTimeout(() => {
      delete this._uploadTimers[path];

      // Only upload if CloudSync is ready
      if (typeof CloudSync === 'undefined' || !CloudSync.isInitialized) {
        return;
      }

      // Try to upload
      this._uploadPath(path, data);
    }, 800); // 800ms debounce
  },

  async _uploadPath(path, data) {
    if (!data || typeof data !== 'object') {
      // Simple value - upload as-is
      await CloudSync.uploadItem(path, null, data);
      return;
    }

    // For objects with keys, upload each key
    // But if the object is big, upload whole
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    // Check if this is a "list" (dictionary of records)
    const firstItem = data[keys[0]];
    const isRecordDict = firstItem && typeof firstItem === 'object' && (firstItem._id || firstItem.id);

    if (isRecordDict) {
      // Upload each record separately
      for (const key of keys) {
        const item = data[key];
        // Skip if already synced
        if (item._synced_at) continue;
        await CloudSync.uploadItem(path, key, item);
      }
    } else {
      // Upload as whole
      await CloudSync.uploadItem(path, null, data);
    }
  }
};

// Alias
const Store = LocalStore;

// ==========================================================
// Helper: هل النظام اتنصب لأول مرة؟
// ==========================================================
function isFirstRun() {
  const users = LocalStore.get('users');
  return !users || Object.keys(users).length === 0;
}

// ==========================================================
// Helper: ريست كامل (للأدمن فقط)
// ==========================================================
function resetSystem() {
  if (!confirm('⚠️ ده هيمسح كل البيانات المحلية! متأكد؟')) return;
  LocalStore.clearAll();
  location.reload();
}
