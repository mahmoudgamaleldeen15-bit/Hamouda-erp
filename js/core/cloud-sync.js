// ==========================================================
// ☁️ Cloud Sync Module - الرفع اللحظي للسحابة
// ==========================================================
// النظام:
//   1. عند فتح البرنامج → auto-sync (تحميل آخر بيانات)
//   2. بعد كل عملية → auto-upload (رفع تلقائي)
//   3. كل X دقيقة → auto-sync دوري
//   4. زرار "☁️ رفع الآن" في الهيدر
//   5. تاب "☁️ لم يتم الرفع" للفواتير المعلقة
// ==========================================================

const CloudSync = {

  // حالة النظام
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncAt: null,
  lastSyncStatus: null, // 'success' | 'error' | 'partial'
  db: null,
  isInitialized: false,
  autoSyncTimer: null,

  // Queue للعمليات المعلقة
  pendingUploads: [], // [{ path, key, data, attempts, last_error, added_at }]

  // Statistics
  stats: {
    totalUploaded: 0,
    totalDownloaded: 0,
    totalErrors: 0,
    lastError: null
  },

  // ==========================================================
  // 🔧 Initialization
  // ==========================================================
  async init() {
    if (this.isInitialized) return;

    try {
      // تفعيل Firebase
      if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase SDK غير محمل');
        return false;
      }

      // Initialize app لو مش متفعل
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      this.db = firebase.database();

      // تحميل الـ pending queue من التخزين المحلي
      this.pendingUploads = LocalStore.get('_cloud_pending') || [];
      this.lastSyncAt = LocalStore.get('_cloud_last_sync') || null;

      // Listen للاتصال
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());

      // Firebase connection state
      this.db.ref('.info/connected').on('value', (snap) => {
        this.isOnline = snap.val() === true && navigator.onLine;
        this.updateUI();
      });

      this.isInitialized = true;
      console.log('✅ Cloud Sync جاهز');

      // Start auto sync
      this.startAutoSync();

      // Sync on startup لو مطلوب
      const settings = this.getSettings();
      if (settings.sync_on_startup) {
        setTimeout(() => this.fullSync(), 2000);
      }

      // Try to flush pending queue
      setTimeout(() => this.flushPendingQueue(), 5000);

      return true;
    } catch (e) {
      console.error('❌ Cloud Sync init failed:', e);
      return false;
    }
  },

  getSettings() {
    return LocalStore.get('settings/cloud_sync') || SYNC_DEFAULTS;
  },

  saveSettings(settings) {
    LocalStore.set('settings/cloud_sync', settings);
    this.restartAutoSync();
  },

  // ==========================================================
  // 🔄 Auto Sync Timer
  // ==========================================================
  startAutoSync() {
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);

    const settings = this.getSettings();
    const minutes = settings.auto_sync_interval_minutes || 5;

    if (minutes <= 0) return; // معطل

    this.autoSyncTimer = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        console.log('🔄 Auto sync...');
        this.fullSync(true); // silent = true
      }
    }, minutes * 60 * 1000);
  },

  restartAutoSync() {
    this.startAutoSync();
  },

  // ==========================================================
  // ⬆️ Upload single item to cloud
  // ==========================================================
  async uploadItem(path, key, data) {
    if (!this.isInitialized || !this.db) {
      this.addToPending(path, key, data, 'Not initialized');
      return { success: false, error: 'Not initialized' };
    }

    if (!this.isOnline) {
      this.addToPending(path, key, data, 'Offline');
      return { success: false, error: 'Offline' };
    }

    try {
      // Prepare data with sync metadata
      const now = Date.now();
      const dataWithMeta = {
        ...data,
        _synced_at: now,
        _synced_by: (typeof currentUser !== 'undefined' && currentUser) ? currentUser._id : 'unknown'
      };

      // Upload to Firebase
      const ref = key
        ? this.db.ref(`${path}/${key}`)
        : this.db.ref(path);

      await ref.set(dataWithMeta);

      // Mark as synced locally
      this.markLocalAsSynced(path, key, now);

      // Remove from pending
      this.removeFromPending(path, key);

      this.stats.totalUploaded++;
      this.updateUI();

      return { success: true, synced_at: now };
    } catch (e) {
      console.error(`❌ Upload failed: ${path}/${key}`, e);
      this.addToPending(path, key, data, e.message);
      this.stats.totalErrors++;
      this.stats.lastError = e.message;
      return { success: false, error: e.message };
    }
  },

  // ==========================================================
  // ⬇️ Download from cloud
  // ==========================================================
  async downloadPath(path) {
    if (!this.isInitialized || !this.db || !this.isOnline) {
      return { success: false, error: 'Not available' };
    }

    try {
      const snap = await this.db.ref(path).once('value');
      const data = snap.val() || {};

      // Merge with local
      const localData = LocalStore.get(path) || {};
      const merged = this.mergeData(localData, data);

      // Save merged
      LocalStore.set(path, merged);

      this.stats.totalDownloaded++;
      return { success: true, data: merged };
    } catch (e) {
      console.error(`❌ Download failed: ${path}`, e);
      return { success: false, error: e.message };
    }
  },

  // ==========================================================
  // 🔀 Merge data - Last Write Wins by timestamp
  // ==========================================================
  mergeData(local, remote) {
    // للـ objects
    if (typeof remote !== 'object' || remote === null) return remote;

    const merged = { ...local };

    Object.keys(remote).forEach(key => {
      const remoteItem = remote[key];
      const localItem = local[key];

      if (!localItem) {
        // العنصر مش موجود محلياً → خد الريموت
        merged[key] = remoteItem;
      } else if (typeof remoteItem !== 'object' || remoteItem === null) {
        // primitive value → last one wins
        merged[key] = remoteItem;
      } else {
        // Compare timestamps
        const remoteTime = remoteItem._synced_at || remoteItem.updated_at || remoteItem.created_at || 0;
        const localTime = localItem._synced_at || localItem.updated_at || localItem.created_at || 0;

        if (remoteTime >= localTime) {
          merged[key] = remoteItem;
        } else {
          merged[key] = localItem;
        }
      }
    });

    return merged;
  },

  // ==========================================================
  // 🔄 Full Sync - Download all then upload pending
  // ==========================================================
  async fullSync(silent = false) {
    if (!this.isInitialized) {
      if (!silent) this.showNotif('⚠️ الرفع للسحابة غير مهيأ', 'warning');
      return { success: false };
    }

    if (this.isSyncing) {
      if (!silent) this.showNotif('⏳ جاري المزامنة بالفعل...', 'info');
      return { success: false };
    }

    if (!this.isOnline) {
      if (!silent) this.showNotif('🔴 لا يوجد اتصال بالنت', 'warning');
      return { success: false };
    }

    this.isSyncing = true;
    this.updateUI();

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      // 1. Download all paths
      for (const path of SYNC_PATHS) {
        const result = await this.downloadPath(path);
        if (result.success) successCount++;
        else {
          errorCount++;
          errors.push({ path, error: result.error });
        }
      }

      // 2. Upload pending queue
      await this.flushPendingQueue();

      // 3. Update last sync
      this.lastSyncAt = Date.now();
      this.lastSyncStatus = errorCount === 0 ? 'success' : 'partial';
      LocalStore.set('_cloud_last_sync', this.lastSyncAt);

      if (!silent) {
        if (errorCount === 0) {
          this.showNotif('✅ تم التحديث بنجاح', 'success');
        } else {
          this.showNotif(`⚠️ تحديث جزئي - ${errorCount} فشل`, 'warning');
        }
      }

      // Refresh UI if needed
      this.refreshCurrentPage();

      return { success: true, successCount, errorCount, errors };
    } catch (e) {
      this.lastSyncStatus = 'error';
      if (!silent) this.showNotif('❌ فشل التحديث: ' + e.message, 'danger');
      return { success: false, error: e.message };
    } finally {
      this.isSyncing = false;
      this.updateUI();
    }
  },

  // ==========================================================
  // 📋 Pending Queue Management
  // ==========================================================
  addToPending(path, key, data, error) {
    // Remove existing entry for same path/key
    this.pendingUploads = this.pendingUploads.filter(
      p => !(p.path === path && p.key === key)
    );

    // Add new entry
    this.pendingUploads.push({
      id: `${path}_${key}_${Date.now()}`,
      path,
      key,
      data,
      attempts: 0,
      last_error: error,
      added_at: Date.now(),
      last_attempt_at: null
    });

    // Cap the queue at 500 items
    if (this.pendingUploads.length > 500) {
      this.pendingUploads = this.pendingUploads.slice(-500);
    }

    // Persist
    LocalStore.set('_cloud_pending', this.pendingUploads);
    this.updateUI();
  },

  removeFromPending(path, key) {
    this.pendingUploads = this.pendingUploads.filter(
      p => !(p.path === path && p.key === key)
    );
    LocalStore.set('_cloud_pending', this.pendingUploads);
    this.updateUI();
  },

  async flushPendingQueue() {
    if (!this.isOnline || this.pendingUploads.length === 0) return;

    const queue = [...this.pendingUploads];
    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      if (item.attempts >= (this.getSettings().max_retry_attempts || 3)) {
        continue; // Skip - too many failures
      }

      item.attempts++;
      item.last_attempt_at = Date.now();

      try {
        const ref = item.key
          ? this.db.ref(`${item.path}/${item.key}`)
          : this.db.ref(item.path);
        await ref.set({ ...item.data, _synced_at: Date.now() });
        this.removeFromPending(item.path, item.key);
        successCount++;
      } catch (e) {
        item.last_error = e.message;
        failedCount++;
      }
    }

    LocalStore.set('_cloud_pending', this.pendingUploads);
    return { successCount, failedCount };
  },

  // ==========================================================
  // 📤 Upload All Pending (User-triggered)
  // ==========================================================
  async uploadAllPending() {
    if (!this.isOnline) {
      this.showNotif('🔴 لا يوجد اتصال بالنت', 'warning');
      return { success: false };
    }

    if (this.pendingUploads.length === 0) {
      this.showNotif('✅ مفيش فواتير معلقة للرفع', 'success');
      return { success: true, count: 0 };
    }

    // Reset attempts for user-triggered
    this.pendingUploads.forEach(p => { p.attempts = 0; });

    const total = this.pendingUploads.length;
    const result = await this.flushPendingQueue();

    if (result.failedCount === 0) {
      this.showNotif(`✅ تم رفع ${total} عملية بنجاح`, 'success');
    } else {
      this.showNotif(
        `⚠️ نجح: ${result.successCount} - فشل: ${result.failedCount}`,
        'warning'
      );
    }

    this.refreshCurrentPage();
    return result;
  },

  // ==========================================================
  // 🏷️ Mark item as synced locally
  // ==========================================================
  markLocalAsSynced(path, key, timestamp) {
    const data = LocalStore.get(path);
    if (!data) return;

    if (key && data[key]) {
      data[key]._synced_at = timestamp;
      LocalStore.set(path, data);
    }
  },

  // ==========================================================
  // 🔍 Get pending items grouped by type
  // ==========================================================
  getPendingGrouped() {
    const groups = {
      sales_invoices: [],
      purchase_invoices: [],
      payments: [],
      sales_returns: [],
      purchase_returns: [],
      customers: [],
      suppliers: [],
      products: [],
      other: []
    };

    this.pendingUploads.forEach(item => {
      const group = groups[item.path] || groups.other;
      group.push(item);
    });

    return groups;
  },

  getPendingCount() {
    return this.pendingUploads.length;
  },

  isItemSynced(path, key) {
    const data = LocalStore.get(path);
    if (!data || !data[key]) return true;
    return !!data[key]._synced_at;
  },

  // ==========================================================
  // 🌐 Online/Offline handlers
  // ==========================================================
  handleOnline() {
    this.isOnline = true;
    console.log('🟢 النت رجع');
    this.showNotif('🟢 النت رجع - جاري رفع البيانات المعلقة...', 'info', 3000);
    this.updateUI();

    // Try to flush pending
    setTimeout(() => this.flushPendingQueue(), 2000);
  },

  handleOffline() {
    this.isOnline = false;
    console.log('🔴 النت مقطوع');
    this.updateUI();
  },

  // ==========================================================
  // 🎨 UI Updates
  // ==========================================================
  updateUI() {
    // Update sync button in header
    const syncBtn = document.getElementById('cloudSyncBtn');
    if (syncBtn) {
      const badge = syncBtn.querySelector('.cloud-badge');
      const icon = syncBtn.querySelector('.cloud-icon');
      const count = this.getPendingCount();

      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      if (icon) {
        if (this.isSyncing) {
          icon.textContent = '🔄';
          syncBtn.classList.add('syncing');
        } else if (!this.isOnline) {
          icon.textContent = '🔴';
          syncBtn.classList.remove('syncing');
          syncBtn.classList.add('offline');
        } else if (count > 0) {
          icon.textContent = '🟡';
          syncBtn.classList.remove('syncing', 'offline');
          syncBtn.classList.add('pending');
        } else {
          icon.textContent = '☁️';
          syncBtn.classList.remove('syncing', 'offline', 'pending');
        }
      }
    }

    // Update sidebar pending badge
    const pendingBadge = document.getElementById('pendingSyncBadge');
    if (pendingBadge) {
      const count = this.getPendingCount();
      if (count > 0) {
        pendingBadge.textContent = count;
        pendingBadge.style.display = 'inline-flex';
      } else {
        pendingBadge.style.display = 'none';
      }
    }
  },

  refreshCurrentPage() {
    // Trigger re-render of current module if possible
    if (typeof currentModule !== 'undefined' && currentModule) {
      try {
        if (MODULES[currentModule] && MODULES[currentModule].render) {
          MODULES[currentModule].render();
        }
      } catch (e) {
        // Silent fail
      }
    }
  },

  // ==========================================================
  // 🔔 Notification helper
  // ==========================================================
  showNotif(msg, type = 'info', duration = 2500) {
    if (typeof showNotif === 'function') {
      showNotif(msg, type, duration);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  },

  // ==========================================================
  // 📅 Format last sync time
  // ==========================================================
  formatLastSync() {
    if (!this.lastSyncAt) return 'لم يتم الرفع بعد';

    const diff = Date.now() - this.lastSyncAt;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `منذ ${seconds} ثانية`;
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  }
};
