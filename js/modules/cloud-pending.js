// ==========================================================
// ☁️ Cloud Pending Module - الفواتير المعلقة للرفع
// ==========================================================

const CloudPendingModule = {

  filter: 'all', // all | sales | purchases | payments | returns
  isUploading: false,

  render() {
    const container = document.getElementById('moduleContainer');
    if (!container) return;

    const pending = CloudSync.pendingUploads;
    const grouped = CloudSync.getPendingGrouped();
    const isOnline = CloudSync.isOnline;
    const lastSync = CloudSync.formatLastSync();

    // Stats
    const totalPending = pending.length;
    const salesCount = grouped.sales_invoices.length;
    const purchasesCount = grouped.purchase_invoices.length;
    const paymentsCount = grouped.payments.length;
    const returnsCount = grouped.sales_returns.length + grouped.purchase_returns.length;
    const otherCount = grouped.other.length + grouped.customers.length + grouped.suppliers.length + grouped.products.length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">☁️ لم يتم الرفع للسحابة</div>
          <div class="page-subtitle">${totalPending} عملية معلقة</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="CloudPendingModule.render()">🔄 تحديث</button>
        </div>
      </div>

      <!-- Status Card -->
      <div class="card" style="margin-bottom:16px; background:${isOnline ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'linear-gradient(135deg, #FEF2F2, #FEE2E2)'};">
        <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:16px; align-items:center;">
          <div>
            <div style="font-size:12px; color:var(--gray-600); margin-bottom:4px;">حالة الاتصال</div>
            <div style="font-size:20px; font-weight:800; color:${isOnline ? '#059669' : '#DC2626'};">
              ${isOnline ? '🟢 متصل بالنت' : '🔴 لا يوجد اتصال'}
            </div>
          </div>
          <div>
            <div style="font-size:12px; color:var(--gray-600); margin-bottom:4px;">آخر تحديث</div>
            <div style="font-size:16px; font-weight:700; color:var(--gray-800);">
              📅 ${lastSync}
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            ${totalPending > 0 && isOnline ? `
              <button class="btn btn-primary btn-lg" onclick="CloudPendingModule.uploadAll()" ${this.isUploading ? 'disabled' : ''}>
                ${this.isUploading ? '⏳ جاري الرفع...' : `☁️ ارفع الكل (${totalPending})`}
              </button>
            ` : ''}
            <button class="btn btn-outline btn-lg" onclick="CloudPendingModule.diagnose()">
              🩺 تشخيص
            </button>
          </div>
        </div>
      </div>

      ${totalPending === 0 ? `
        <div class="card" style="padding:60px; text-align:center;">
          <div style="font-size:80px; margin-bottom:20px;">✅</div>
          <h2 style="color:#059669; margin-bottom:12px;">كل حاجة مرفوعة على السحابة</h2>
          <p style="color:var(--gray-600); font-size:16px;">
            مفيش عمليات معلقة. البيانات كلها متزامنة مع السحابة.
          </p>
        </div>
      ` : `

        <!-- Stats Cards -->
        <div class="grid grid-4" style="margin-bottom:16px;">
          <div class="stat-card" onclick="CloudPendingModule.setFilter('all')" style="cursor:pointer; ${this.filter === 'all' ? 'border:2px solid var(--grape-500);' : ''}">
            <div class="stat-label">📊 الإجمالي</div>
            <div class="stat-value">${totalPending}</div>
          </div>
          <div class="stat-card stat-blue" onclick="CloudPendingModule.setFilter('sales')" style="cursor:pointer; ${this.filter === 'sales' ? 'border:2px solid #2563EB;' : ''}">
            <div class="stat-label">💰 مبيعات</div>
            <div class="stat-value">${salesCount}</div>
          </div>
          <div class="stat-card stat-green" onclick="CloudPendingModule.setFilter('purchases')" style="cursor:pointer; ${this.filter === 'purchases' ? 'border:2px solid #059669;' : ''}">
            <div class="stat-label">🛒 مشتريات</div>
            <div class="stat-value">${purchasesCount}</div>
          </div>
          <div class="stat-card stat-gold" onclick="CloudPendingModule.setFilter('payments')" style="cursor:pointer; ${this.filter === 'payments' ? 'border:2px solid #D97706;' : ''}">
            <div class="stat-label">💵 تحصيلات</div>
            <div class="stat-value">${paymentsCount}</div>
          </div>
        </div>

        <!-- Filters -->
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn ${this.filter === 'all' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="CloudPendingModule.setFilter('all')">📊 الكل (${totalPending})</button>
            <button class="btn ${this.filter === 'sales' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="CloudPendingModule.setFilter('sales')">💰 مبيعات (${salesCount})</button>
            <button class="btn ${this.filter === 'purchases' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="CloudPendingModule.setFilter('purchases')">🛒 مشتريات (${purchasesCount})</button>
            <button class="btn ${this.filter === 'payments' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="CloudPendingModule.setFilter('payments')">💵 تحصيلات (${paymentsCount})</button>
            <button class="btn ${this.filter === 'returns' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="CloudPendingModule.setFilter('returns')">🔄 مرتجعات (${returnsCount})</button>
            <button class="btn ${this.filter === 'other' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="CloudPendingModule.setFilter('other')">📁 أخرى (${otherCount})</button>
          </div>
        </div>

        <!-- Table -->
        <div class="card">
          <div class="table-container" style="box-shadow:none; border:none;">
            <table>
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>البيانات</th>
                  <th>المحاولات</th>
                  <th>آخر خطأ</th>
                  <th>الوقت</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${this.renderPendingRows(pending)}
              </tbody>
            </table>
          </div>
        </div>
      `}
    `;
  },

  renderPendingRows(pending) {
    const filtered = this.getFilteredPending(pending);

    if (filtered.length === 0) {
      return `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--gray-500);">
        <div>لا توجد عمليات معلقة في هذه الفئة</div>
      </td></tr>`;
    }

    return filtered.map(item => {
      const typeInfo = this.getTypeInfo(item.path);
      const data = item.data || {};
      let description = '';

      // Type-specific description
      if (item.path === 'sales_invoices' || item.path === 'purchase_invoices') {
        const partyName = data.customer_name_snapshot || data.supplier_name_snapshot || '—';
        description = `<strong>${data.invoice_number || '—'}</strong><br><small>${partyName} - ${fmtMoney(data.grand_total || 0)} ج.م</small>`;
      } else if (item.path === 'payments') {
        description = `<strong>${data.invoice_number || 'دفعة'}</strong><br><small>${fmtMoney(data.amount || 0)} ج.م</small>`;
      } else if (item.path === 'sales_returns' || item.path === 'purchase_returns') {
        description = `<strong>${data.return_number || '—'}</strong><br><small>${fmtMoney(data.total_returned || 0)} ج.م</small>`;
      } else if (item.path === 'customers' || item.path === 'suppliers') {
        description = `<strong>${data.name || '—'}</strong>`;
      } else if (item.path === 'products') {
        description = `<strong>${data.name || '—'}</strong>`;
      } else {
        description = `<small>${item.key || item.path}</small>`;
      }

      const attemptsColor = item.attempts >= 3 ? '#DC2626' : item.attempts > 0 ? '#D97706' : '#059669';

      return `
        <tr>
          <td>
            <span style="background:${typeInfo.color}20; color:${typeInfo.color}; padding:4px 10px; border-radius:6px; font-weight:700; font-size:12px;">
              ${typeInfo.icon} ${typeInfo.label}
            </span>
          </td>
          <td>${description}</td>
          <td>
            <span style="color:${attemptsColor}; font-weight:700;">
              ${item.attempts} / 3
            </span>
          </td>
          <td style="font-size:12px; color:var(--gray-600); max-width:200px; overflow:hidden; text-overflow:ellipsis;">
            ${item.last_error || '—'}
          </td>
          <td style="font-size:12px;">${fmtDateTime(item.added_at)}</td>
          <td>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-primary btn-sm" onclick="CloudPendingModule.retryItem('${item.id}')" title="حاول رفع دي بس">
                🔄 رفع
              </button>
              <button class="btn btn-ghost btn-sm" onclick="CloudPendingModule.removeItem('${item.id}')" title="إزالة من القائمة">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  getTypeInfo(path) {
    const types = {
      'sales_invoices': { icon: '💰', label: 'فاتورة بيع', color: '#2563EB' },
      'purchase_invoices': { icon: '🛒', label: 'فاتورة شراء', color: '#059669' },
      'payments': { icon: '💵', label: 'دفعة', color: '#D97706' },
      'sales_returns': { icon: '🔄', label: 'مرتجع بيع', color: '#DC2626' },
      'purchase_returns': { icon: '🔄', label: 'مرتجع شراء', color: '#DC2626' },
      'customers': { icon: '👤', label: 'عميل', color: '#7C3AED' },
      'suppliers': { icon: '🏭', label: 'مورد', color: '#7C3AED' },
      'products': { icon: '🍇', label: 'صنف', color: '#7C3AED' },
      'inventory_txns': { icon: '📦', label: 'حركة مخزون', color: '#6B7280' }
    };
    return types[path] || { icon: '📁', label: path, color: '#6B7280' };
  },

  getFilteredPending(pending) {
    if (this.filter === 'all') return pending;
    if (this.filter === 'sales') return pending.filter(p => p.path === 'sales_invoices');
    if (this.filter === 'purchases') return pending.filter(p => p.path === 'purchase_invoices');
    if (this.filter === 'payments') return pending.filter(p => p.path === 'payments');
    if (this.filter === 'returns') return pending.filter(p => p.path === 'sales_returns' || p.path === 'purchase_returns');
    if (this.filter === 'other') {
      return pending.filter(p => !['sales_invoices', 'purchase_invoices', 'payments', 'sales_returns', 'purchase_returns'].includes(p.path));
    }
    return pending;
  },

  setFilter(filter) {
    this.filter = filter;
    this.render();
  },

  // ==========================================================
  // ⬆️ Upload All
  // ==========================================================
  async uploadAll() {
    if (this.isUploading) return;
    if (!CloudSync.isOnline) {
      return showNotif('🔴 لا يوجد اتصال بالنت', 'warning');
    }

    this.isUploading = true;
    this.render();

    try {
      await CloudSync.uploadAllPending();
    } finally {
      this.isUploading = false;
      this.render();
    }
  },

  // ==========================================================
  // 🔄 Retry single item
  // ==========================================================
  async retryItem(itemId) {
    const item = CloudSync.pendingUploads.find(p => p.id === itemId);
    if (!item) return showNotif('❌ العملية غير موجودة', 'danger');

    if (!CloudSync.isOnline) {
      return showNotif('🔴 لا يوجد اتصال بالنت', 'warning');
    }

    // Reset attempts
    item.attempts = 0;
    item.last_attempt_at = Date.now();

    try {
      const ref = item.key
        ? CloudSync.db.ref(`${item.path}/${item.key}`)
        : CloudSync.db.ref(item.path);
      await ref.set({ ...item.data, _synced_at: Date.now() });
      CloudSync.removeFromPending(item.path, item.key);
      showNotif('✅ تم الرفع بنجاح', 'success');
      this.render();
    } catch (e) {
      item.last_error = e.message;
      item.attempts++;
      LocalStore.set('_cloud_pending', CloudSync.pendingUploads);
      showNotif('❌ فشل الرفع: ' + e.message, 'danger');
      this.render();
    }
  },

  // ==========================================================
  // 🗑️ Remove item from queue
  // ==========================================================
  removeItem(itemId) {
    const item = CloudSync.pendingUploads.find(p => p.id === itemId);
    if (!item) return;

    if (!confirm('⚠️ إزالة العملية من قائمة الانتظار؟\n\nملحوظة: البيانات ستبقى محفوظة محلياً، لكن لن يتم رفعها للسحابة.')) return;

    CloudSync.pendingUploads = CloudSync.pendingUploads.filter(p => p.id !== itemId);
    LocalStore.set('_cloud_pending', CloudSync.pendingUploads);
    CloudSync.updateUI();
    showNotif('🗑️ تم الإزالة', 'info');
    this.render();
  },

  // ==========================================================
  // 🩺 Diagnose
  // ==========================================================
  async diagnose() {
    const results = [];

    // 1. Check internet
    results.push({
      test: 'الاتصال بالنت',
      status: navigator.onLine ? 'success' : 'error',
      message: navigator.onLine ? '🟢 متصل' : '🔴 لا يوجد اتصال'
    });

    // 2. Check Firebase SDK
    results.push({
      test: 'Firebase SDK',
      status: typeof firebase !== 'undefined' ? 'success' : 'error',
      message: typeof firebase !== 'undefined' ? '✅ محمل' : '❌ غير محمل'
    });

    // 3. Check Firebase init
    results.push({
      test: 'Firebase Init',
      status: CloudSync.isInitialized ? 'success' : 'error',
      message: CloudSync.isInitialized ? '✅ مهيأ' : '❌ غير مهيأ'
    });

    // 4. Check connection
    if (CloudSync.db) {
      try {
        const snap = await CloudSync.db.ref('.info/connected').once('value');
        results.push({
          test: 'الاتصال بـ Firebase',
          status: snap.val() ? 'success' : 'error',
          message: snap.val() ? '🟢 متصل' : '🔴 غير متصل'
        });
      } catch (e) {
        results.push({
          test: 'الاتصال بـ Firebase',
          status: 'error',
          message: '❌ ' + e.message
        });
      }
    }

    // 5. Check pending
    results.push({
      test: 'عمليات معلقة',
      status: CloudSync.getPendingCount() === 0 ? 'success' : 'warning',
      message: `${CloudSync.getPendingCount()} عملية`
    });

    // 6. Test write
    try {
      const testRef = CloudSync.db.ref('_diagnostic_test');
      await testRef.set({ timestamp: Date.now(), test: true });
      await testRef.remove();
      results.push({
        test: 'اختبار الكتابة',
        status: 'success',
        message: '✅ يمكن الكتابة'
      });
    } catch (e) {
      results.push({
        test: 'اختبار الكتابة',
        status: 'error',
        message: '❌ ' + e.message
      });
    }

    // Show results
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'diagnosticModal';
    modal.innerHTML = `
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h3>🩺 نتيجة التشخيص</h3>
          <button class="modal-close" onclick="document.getElementById('diagnosticModal').remove()">✕</button>
        </div>
        <div class="modal-body">
          ${results.map(r => `
            <div style="padding:12px; margin-bottom:8px; border-radius:8px; background:${r.status === 'success' ? '#F0FDF4' : r.status === 'warning' ? '#FEF3C7' : '#FEF2F2'}; border-right:4px solid ${r.status === 'success' ? '#059669' : r.status === 'warning' ? '#D97706' : '#DC2626'};">
              <div style="font-weight:700; margin-bottom:4px;">${r.test}</div>
              <div style="font-size:13px;">${r.message}</div>
            </div>
          `).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="document.getElementById('diagnosticModal').remove()">تمام</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
};
