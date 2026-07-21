// ==========================================================
// Activity Log Module - سجل العمليات
// ==========================================================

const ActivityModule = {

  currentFilters: {
    userId: 'all',
    module: 'all',
    action: 'all',
    dateFrom: null,
    dateTo: null,
    searchQuery: ''
  },
  currentPage: 1,
  perPage: 50,

  render() {
    if (!requirePermission('activity_view', 'مشاهدة سجل العمليات') && currentUser.role !== 'admin') {
      return renderPlaceholder('📜 سجل العمليات', '⛔ مش مصرح');
    }

    this.renderList();
  },

  // ==========================================================
  // Get action metadata (icon + label + color)
  // ==========================================================
  getActionMeta(action) {
    const map = {
      // Auth
      'login':               { icon: '🔓', label: 'تسجيل دخول', color: '#059669' },
      'logout':              { icon: '🔒', label: 'تسجيل خروج', color: '#6B7280' },
      'login_failed':        { icon: '⛔', label: 'محاولة دخول فاشلة', color: '#DC2626' },
      // CRUD
      'create':              { icon: '➕', label: 'إنشاء', color: '#059669' },
      'update':              { icon: '✏️', label: 'تعديل', color: '#D97706' },
      'delete':              { icon: '🗑️', label: 'حذف', color: '#DC2626' },
      'activate':            { icon: '▶️', label: 'تفعيل', color: '#059669' },
      'deactivate':          { icon: '⏸️', label: 'تعطيل', color: '#D97706' },
      // Invoices
      'invoice_created':     { icon: '📄', label: 'فاتورة جديدة', color: '#7C3AED' },
      'invoice_cancelled':   { icon: '❌', label: 'إلغاء فاتورة', color: '#DC2626' },
      'payment_received':    { icon: '💰', label: 'تحصيل دفعة', color: '#059669' },
      'payment_reschedule':  { icon: '📅', label: 'إعادة جدولة', color: '#D97706' },
      // Returns
      'return_created':      { icon: '🔄', label: 'مرتجع جديد', color: '#DC2626' },
      // Inventory
      'inventory_adjust':    { icon: '⚖️', label: 'تسوية مخزون', color: '#D97706' },
      'inventory_transfer':  { icon: '🚚', label: 'نقل بين المخازن', color: '#7C3AED' },
      // Users & Permissions
      'reset_password':      { icon: '🔑', label: 'إعادة تعيين كلمة سر', color: '#D97706' },
      'change_password':     { icon: '🔐', label: 'تغيير كلمة السر', color: '#059669' },
      'update_permissions':  { icon: '🔐', label: 'تعديل صلاحيات', color: '#7C3AED' },
      // Settings
      'update_company':      { icon: '🏢', label: 'تعديل بيانات الشركة', color: '#D97706' },
      'toggle_payment':      { icon: '💳', label: 'تفعيل/تعطيل طريقة دفع', color: '#D97706' },
      'update_wa_templates': { icon: '📱', label: 'تعديل قوالب واتساب', color: '#D97706' },
      'update_system_settings': { icon: '🔧', label: 'إعدادات النظام', color: '#D97706' },
      // Archive & Danger
      'export_backup':       { icon: '📤', label: 'تصدير نسخة احتياطية', color: '#059669' },
      'import_backup':       { icon: '📥', label: 'استرجاع نسخة احتياطية', color: '#7C3AED' },
      'archive_period':      { icon: '🗄️', label: 'أرشفة فترة', color: '#7C3AED' },
      'delete_all_invoices': { icon: '💥', label: 'مسح كل الفواتير', color: '#DC2626' },
      // Units & Categories
      'add_unit':            { icon: '➕', label: 'إضافة وحدة', color: '#059669' },
      'update_unit':         { icon: '✏️', label: 'تعديل وحدة', color: '#D97706' },
      'delete_unit':         { icon: '🗑️', label: 'حذف وحدة', color: '#DC2626' },
      'toggle_unit':         { icon: '🔀', label: 'تفعيل/تعطيل وحدة', color: '#D97706' },
      // Reports & WhatsApp
      'export_report':       { icon: '📊', label: 'تصدير تقرير', color: '#059669' },
      'report_to_haj':       { icon: '📱', label: 'تقرير للحاج', color: '#059669' },
      'whatsapp_haj':        { icon: '📱', label: 'واتساب للحاج', color: '#25D366' },
      'whatsapp_customer':   { icon: '📱', label: 'واتساب للعميل', color: '#25D366' },
      // Debtors
      'debtor_reminder':     { icon: '📞', label: 'مطالبة عميل', color: '#DC2626' },
      'debt_waived':         { icon: '💚', label: 'إعفاء من مديونية', color: '#059669' }
    };
    return map[action] || { icon: '📋', label: action, color: '#6B7280' };
  },

  getModuleLabel(module) {
    const map = {
      'auth': '🔓 المصادقة',
      'users': '👤 المستخدمين',
      'products': '🍇 الأصناف',
      'warehouses': '🏢 المخازن',
      'customers': '👥 العملاء',
      'suppliers': '🏭 الموردين',
      'sales': '💰 المبيعات',
      'purchases': '🛒 المشتريات',
      'inventory': '📦 المخزون',
      'debtors': '🔴 المدينين',
      'returns': '🔄 المرتجعات',
      'reports': '📊 التقارير',
      'settings': '⚙️ الإعدادات',
      'danger': '⚠️ منطقة الخطر'
    };
    return map[module] || module;
  },

  // ==========================================================
  // List View
  // ==========================================================
  renderList() {
    const container = document.getElementById('moduleContainer');
    const logs = this.getFilteredLogs();
    const users = LocalStore.get('users') || {};

    // Stats
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === today).length;
    const totalUsers = new Set(logs.map(l => l.user_id)).size;
    const uniqueActions = new Set(logs.map(l => l.action)).size;

    // Pagination
    const totalPages = Math.ceil(logs.length / this.perPage);
    const start = (this.currentPage - 1) * this.perPage;
    const pageItems = logs.slice(start, start + this.perPage);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">📜 سجل العمليات</div>
          <div class="page-subtitle">${logs.length} عملية مسجلة</div>
        </div>
        <div class="page-actions">
          ${hasPermission('reports_export') || currentUser.role === 'admin' ? `
            <button class="btn btn-outline" onclick="ActivityModule.exportCSV()">📥 Excel</button>
          ` : ''}
          ${currentUser.role === 'admin' ? `
            <button class="btn btn-outline" onclick="ActivityModule.showCleanupModal()" style="color:var(--danger);">
              🗑️ تنظيف قديم
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-4" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">📅 عمليات اليوم</div>
          <div class="stat-value">${todayLogs}</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">📊 الإجمالي</div>
          <div class="stat-value">${logs.length}</div>
        </div>
        <div class="stat-card stat-gold">
          <div class="stat-label">👥 مستخدمين نشطين</div>
          <div class="stat-value">${totalUsers}</div>
        </div>
        <div class="stat-card stat-blue">
          <div class="stat-label">📋 أنواع العمليات</div>
          <div class="stat-value">${uniqueActions}</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="grid grid-4">
          <div class="form-group" style="margin:0;">
            <label>🔍 بحث</label>
            <input type="text" id="log_search" value="${this.currentFilters.searchQuery}"
                   placeholder="ابحث بأي كلمة..."
                   oninput="ActivityModule.updateFilter('searchQuery', this.value)">
          </div>
          <div class="form-group" style="margin:0;">
            <label>المستخدم</label>
            <select onchange="ActivityModule.updateFilter('userId', this.value)">
              <option value="all">كل المستخدمين</option>
              ${Object.values(users).map(u =>
                `<option value="${u._id}" ${this.currentFilters.userId === u._id ? 'selected' : ''}>${u.name}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label>القسم</label>
            <select onchange="ActivityModule.updateFilter('module', this.value)">
              <option value="all">كل الأقسام</option>
              ${['auth','users','sales','purchases','inventory','customers','suppliers','products','warehouses','debtors','returns','settings','reports','danger'].map(m =>
                `<option value="${m}" ${this.currentFilters.module === m ? 'selected' : ''}>${this.getModuleLabel(m)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label>&nbsp;</label>
            <button class="btn btn-outline btn-full" onclick="ActivityModule.resetFilters()">
              🔄 مسح الفلاتر
            </button>
          </div>
        </div>

        <div class="grid grid-2" style="margin-top:12px;">
          <div class="form-group" style="margin:0;">
            <label>من تاريخ</label>
            <input type="date" value="${this.currentFilters.dateFrom ? new Date(this.currentFilters.dateFrom).toISOString().slice(0,10) : ''}"
                   onchange="ActivityModule.updateDateFilter('from', this.value)">
          </div>
          <div class="form-group" style="margin:0;">
            <label>إلى تاريخ</label>
            <input type="date" value="${this.currentFilters.dateTo ? new Date(this.currentFilters.dateTo).toISOString().slice(0,10) : ''}"
                   onchange="ActivityModule.updateDateFilter('to', this.value)">
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>الوقت</th>
                <th>المستخدم</th>
                <th>النوع</th>
                <th>القسم</th>
                <th>التفاصيل</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr><td colspan="6" style="text-align:center; padding:40px; color:var(--gray-500);">
                  <div style="font-size:48px; margin-bottom:12px;">📜</div>
                  <div>لا توجد عمليات مطابقة</div>
                </td></tr>
              ` : pageItems.map(log => this.renderRow(log)).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        ${totalPages > 1 ? `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; border-top:1px solid var(--gray-200);">
            <div style="font-size:13px; color:var(--gray-600);">
              عرض ${start + 1} - ${Math.min(start + this.perPage, logs.length)} من ${logs.length}
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-outline btn-sm" ${this.currentPage === 1 ? 'disabled' : ''}
                      onclick="ActivityModule.goToPage(${this.currentPage - 1})">← السابق</button>
              <div style="padding:6px 12px; background:var(--grape-50); border-radius:var(--radius); font-weight:700;">
                ${this.currentPage} / ${totalPages}
              </div>
              <button class="btn btn-outline btn-sm" ${this.currentPage === totalPages ? 'disabled' : ''}
                      onclick="ActivityModule.goToPage(${this.currentPage + 1})">التالي →</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  renderRow(log) {
    const meta = this.getActionMeta(log.action);
    const now = Date.now();
    const diffMin = Math.floor((now - log.created_at) / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    let timeAgo = '';
    if (diffMin < 1) timeAgo = 'الآن';
    else if (diffMin < 60) timeAgo = `منذ ${diffMin} دق`;
    else if (diffHour < 24) timeAgo = `منذ ${diffHour} س`;
    else if (diffDay < 7) timeAgo = `منذ ${diffDay} يوم`;
    else timeAgo = fmtDate(log.created_at);

    return `
      <tr>
        <td>
          <div style="font-size:13px;"><strong>${timeAgo}</strong></div>
          <div style="font-size:11px; color:var(--gray-500);">${fmtDateTime(log.created_at)}</div>
        </td>
        <td>
          <div style="font-weight:600;">${log.user_name || log.username || '—'}</div>
          <div style="font-size:11px; color:var(--gray-500);">${log.username || ''}</div>
        </td>
        <td>
          <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:${meta.color}20; color:${meta.color}; border-radius:12px; font-size:12px; font-weight:700;">
            ${meta.icon} ${meta.label}
          </span>
        </td>
        <td>
          <span style="font-size:13px; color:var(--gray-700);">${this.getModuleLabel(log.module)}</span>
        </td>
        <td>
          <div style="font-weight:600;">${log.entity_name || log.entity_id || '—'}</div>
          ${log.metadata && Object.keys(log.metadata).length > 0 ? `
            <div style="font-size:11px; color:var(--gray-500); margin-top:2px;">
              ${Object.entries(log.metadata).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' • ')}
            </div>
          ` : ''}
        </td>
        <td>
          ${log.metadata && Object.keys(log.metadata).length > 0 ? `
            <button class="btn btn-ghost btn-sm" onclick="ActivityModule.viewDetails('${log._id || log.created_at}')">👁️</button>
          ` : ''}
        </td>
      </tr>
    `;
  },

  // ==========================================================
  // Filters
  // ==========================================================
  getFilteredLogs() {
    let logs = Object.values(LocalStore.get('activity_log') || {})
      .sort((a, b) => b.created_at - a.created_at);

    if (this.currentFilters.userId !== 'all') {
      logs = logs.filter(l => l.user_id === this.currentFilters.userId);
    }
    if (this.currentFilters.module !== 'all') {
      logs = logs.filter(l => l.module === this.currentFilters.module);
    }
    if (this.currentFilters.action !== 'all') {
      logs = logs.filter(l => l.action === this.currentFilters.action);
    }
    if (this.currentFilters.dateFrom) {
      logs = logs.filter(l => l.created_at >= this.currentFilters.dateFrom);
    }
    if (this.currentFilters.dateTo) {
      logs = logs.filter(l => l.created_at <= this.currentFilters.dateTo);
    }
    if (this.currentFilters.searchQuery) {
      const q = this.currentFilters.searchQuery.toLowerCase();
      logs = logs.filter(l =>
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.username || '').toLowerCase().includes(q) ||
        (l.entity_name || '').toLowerCase().includes(q) ||
        (l.entity_id || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.module || '').toLowerCase().includes(q)
      );
    }

    return logs;
  },

  updateFilter(field, value) {
    this.currentFilters[field] = value;
    this.currentPage = 1;
    this.render();
  },

  updateDateFilter(field, value) {
    if (!value) {
      this.currentFilters[field === 'from' ? 'dateFrom' : 'dateTo'] = null;
    } else {
      const d = new Date(value);
      if (field === 'to') d.setHours(23, 59, 59, 999);
      this.currentFilters[field === 'from' ? 'dateFrom' : 'dateTo'] = d.getTime();
    }
    this.currentPage = 1;
    this.render();
  },

  resetFilters() {
    this.currentFilters = {
      userId: 'all', module: 'all', action: 'all',
      dateFrom: null, dateTo: null, searchQuery: ''
    };
    this.currentPage = 1;
    this.render();
  },

  goToPage(page) {
    this.currentPage = page;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ==========================================================
  // View details modal
  // ==========================================================
  viewDetails(logId) {
    const logs = Object.values(LocalStore.get('activity_log') || {});
    const log = logs.find(l => (l._id || l.created_at) == logId);
    if (!log) return;

    const meta = this.getActionMeta(log.action);

    const modalHtml = `
      <div id="logDetailsModal" class="modal-overlay">
        <div class="modal" style="max-width: 550px;">
          <div class="modal-header">
            <h3>${meta.icon} تفاصيل العملية</h3>
            <button class="modal-close" onclick="document.getElementById('logDetailsModal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:var(--gray-50); border-radius:var(--radius); margin-bottom:16px;">
              <div><strong>الوقت:</strong> ${fmtDateTime(log.created_at)}</div>
              <div><strong>المستخدم:</strong> ${log.user_name || '—'} (${log.username || '—'})</div>
              <div><strong>القسم:</strong> ${this.getModuleLabel(log.module)}</div>
              <div><strong>النوع:</strong> ${meta.label}</div>
              <div><strong>الكيان:</strong> ${log.entity_name || log.entity_id || '—'}</div>
            </div>

            ${log.metadata && Object.keys(log.metadata).length > 0 ? `
              <div style="font-weight:700; margin-bottom:8px;">📋 التفاصيل الإضافية:</div>
              <div style="background:#F5F3FF; padding:12px; border-radius:var(--radius);">
                ${Object.entries(log.metadata).map(([k, v]) => `
                  <div style="padding:4px 0; border-bottom:1px solid #E9D5FF;">
                    <span style="color:var(--grape-700); font-weight:600;">${k}:</span>
                    <span style="margin-right:8px;">${typeof v === 'object' ? JSON.stringify(v) : v}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="document.getElementById('logDetailsModal').remove()">حسناً</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('logDetailsModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // ==========================================================
  // Export CSV
  // ==========================================================
  exportCSV() {
    const logs = this.getFilteredLogs();
    if (logs.length === 0) return showNotif('❌ لا توجد بيانات للتصدير', 'warning');

    const BOM = '\uFEFF';
    let csv = 'التاريخ,الوقت,المستخدم,اسم الدخول,القسم,النوع,الكيان,التفاصيل\n';

    logs.forEach(log => {
      const meta = this.getActionMeta(log.action);
      const dateStr = fmtDate(log.created_at);
      const timeStr = new Date(log.created_at).toLocaleTimeString('ar-EG');
      const details = log.metadata ? Object.entries(log.metadata).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | ') : '';
      csv += `"${dateStr}","${timeStr}","${log.user_name || ''}","${log.username || ''}","${this.getModuleLabel(log.module)}","${meta.label}","${log.entity_name || log.entity_id || ''}","${details}"\n`;
    });

    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_log_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotif('✅ تم تنزيل السجل', 'success');
  },

  // ==========================================================
  // Cleanup old logs
  // ==========================================================
  showCleanupModal() {
    if (currentUser.role !== 'admin') return;

    const logs = Object.values(LocalStore.get('activity_log') || {});
    const now = Date.now();
    const older30 = logs.filter(l => now - l.created_at > 30 * 86400000).length;
    const older60 = logs.filter(l => now - l.created_at > 60 * 86400000).length;
    const older90 = logs.filter(l => now - l.created_at > 90 * 86400000).length;
    const older180 = logs.filter(l => now - l.created_at > 180 * 86400000).length;

    const modalHtml = `
      <div id="cleanupModal" class="modal-overlay">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3>🗑️ تنظيف السجل القديم</h3>
            <button class="modal-close" onclick="document.getElementById('cleanupModal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:#FEF3C7; border-radius:var(--radius); margin-bottom:16px; font-size:13px;">
              💡 <strong>لماذا:</strong> السجل الكبير بيبطئ البرنامج وياخد مساحة. مسح العمليات القديمة يفضي المساحة.
            </div>

            <div style="margin-bottom:12px; font-weight:700;">📊 عمليات أقدم من:</div>

            <div style="display:grid; gap:8px;">
              ${[
                { days: 30, count: older30 },
                { days: 60, count: older60 },
                { days: 90, count: older90 },
                { days: 180, count: older180 }
              ].map(opt => `
                <button class="btn btn-outline" ${opt.count === 0 ? 'disabled' : ''}
                        onclick="ActivityModule.cleanupOlderThan(${opt.days})"
                        style="text-align:right; padding:12px;">
                  <div style="display:flex; justify-content:space-between;">
                    <span>🗑️ مسح أقدم من ${opt.days} يوم</span>
                    <strong style="color:${opt.count === 0 ? 'var(--gray-400)' : 'var(--danger)'};">${opt.count} عملية</strong>
                  </div>
                </button>
              `).join('')}
            </div>

            <div style="padding:12px; background:#FEE2E2; border-radius:var(--radius); margin-top:16px; font-size:12px; color:#991B1B;">
              ⚠️ العمليات الممسوحة لا يمكن استرجاعها. اعمل تصدير Excel أولاً لو محتاج الاحتفاظ بها.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="document.getElementById('cleanupModal').remove()">إلغاء</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('cleanupModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  cleanupOlderThan(days) {
    if (!confirm(`⚠️ مسح كل العمليات الأقدم من ${days} يوم؟\n\nمش هيمكن الاسترجاع.`)) return;

    const cutoff = Date.now() - days * 86400000;
    const logs = LocalStore.get('activity_log') || {};
    let deleted = 0;

    Object.keys(logs).forEach(key => {
      if (logs[key].created_at < cutoff) {
        delete logs[key];
        deleted++;
      }
    });

    LocalStore.set('activity_log', logs);
    document.getElementById('cleanupModal')?.remove();
    showNotif(`✅ تم مسح ${deleted} عملية`, 'success');
    this.render();
  }
};
