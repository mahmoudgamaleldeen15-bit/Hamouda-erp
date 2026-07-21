// ==========================================================
// Suppliers Module
// ==========================================================

const SuppliersModule = {

  currentView: 'list', // list | detail
  currentSupplierId: null,
  searchQuery: '',

  render() {
    if (!requirePermission('suppliers_view', 'مشاهدة الموردين')) {
      return renderPlaceholder('🏭 الموردين', 'مش مصرح');
    }

    if (this.currentView === 'detail') {
      return this.renderDetail(this.currentSupplierId);
    }

    return this.renderList();
  },

  renderList() {
    const container = document.getElementById('moduleContainer');
    const suppliers = LocalStore.get('suppliers') || {};
    let list = Object.values(suppliers);

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.code || '').toLowerCase().includes(q)
      );
    }

    // احسب المديونية عليهم
    const totalDebt = list.reduce((sum, s) => sum + (s.cached_total_debt_to_them || 0), 0);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🏭 الموردين</div>
          <div class="page-subtitle">${list.length} مورد</div>
        </div>
        <div class="page-actions">
          ${hasPermission('suppliers_manage') ? `
          <button class="btn btn-primary" onclick="SuppliersModule.showAddForm()">
            ➕ مورد جديد
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-3" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">🏭 عدد الموردين</div>
          <div class="stat-value">${list.length}</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">💸 مستحقات علينا</div>
          <div class="stat-value">${fmtMoneyShort(totalDebt)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">✅ موردين نشطين</div>
          <div class="stat-value">${list.filter(s => s.status !== 'blocked').length}</div>
        </div>
      </div>

      <!-- Search -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="form-group" style="margin:0;">
          <input type="text" id="supplierSearch" placeholder="🔍 بحث بالاسم / التليفون / الكود..."
                 value="${this.searchQuery}"
                 oninput="SuppliersModule.search(this.value)">
        </div>
      </div>

      <!-- Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>الاسم</th>
              <th>التليفون</th>
              <th>المدينة</th>
              <th>مستحق عليه/ا</th>
              <th>إجمالي المشتريات</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `
              <tr><td colspan="8" style="text-align:center; padding:40px; color: var(--gray-500);">
                <div style="font-size:48px; margin-bottom:12px;">🏭</div>
                <div>لا يوجد موردين</div>
              </td></tr>
            ` : list.map(s => this.renderRow(s)).join('')}
          </tbody>
        </table>
      </div>

      ${this.renderModal()}
    `;
  },

  renderRow(s) {
    const statusBadge = s.status === 'blocked'
      ? '<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;">محظور</span>'
      : s.status === 'suspended'
      ? '<span class="txn-badge" style="background:#FEF3C7;color:#92400E;">متوقف</span>'
      : '<span class="txn-badge" style="background:#D1FAE5;color:#065F46;">نشط</span>';

    return `
      <tr onclick="SuppliersModule.viewDetail('${s._id}')" style="cursor:pointer;">
        <td><strong>${s.code || '—'}</strong></td>
        <td>${s.name}</td>
        <td>${s.phone || '—'}</td>
        <td>${s.city || '—'}</td>
        <td class="${(s.cached_total_debt_to_them || 0) > 0 ? 'negative' : ''}">
          ${fmtMoney(s.cached_total_debt_to_them || 0)} ج.م
        </td>
        <td>${fmtMoney(s.cached_lifetime_purchases || 0)} ج.م</td>
        <td>${statusBadge}</td>
        <td onclick="event.stopPropagation();">
          ${(s.cached_total_debt_to_them || 0) > 0 && currentUser.role === 'admin' ? `
            <button class="btn btn-ghost btn-sm" style="color:#2563EB;" onclick="BulkPaymentModule.openForSupplier('${s._id}')" title="دفع شامل">💵</button>
          ` : ''}
          ${hasPermission('suppliers_manage') ? `
            <button class="btn btn-ghost btn-sm" onclick="SuppliersModule.showEditForm('${s._id}')">✏️</button>
          ` : ''}
        </td>
      </tr>
    `;
  },

  renderDetail(id) {
    const container = document.getElementById('moduleContainer');
    const suppliers = LocalStore.get('suppliers') || {};
    const s = suppliers[id];
    if (!s) {
      showNotif('❌ المورد غير موجود', 'danger');
      this.currentView = 'list';
      return this.render();
    }

    // فواتير الشراء بتاعته
    const invoices = LocalStore.get('purchase_invoices') || {};
    const supplierInvoices = Object.values(invoices)
      .filter(inv => inv.supplier_id === id)
      .sort((a, b) => b.created_at - a.created_at);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🏭 ${s.name}</div>
          <div class="page-subtitle">كود: ${s.code}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="SuppliersModule.backToList()">← رجوع</button>
          ${(s.cached_total_debt_to_them || 0) > 0 && currentUser.role === 'admin' ? `
            <button class="btn btn-lg" style="background:#2563EB; color:white;" onclick="BulkPaymentModule.openForSupplier('${id}')">
              💵 دفع شامل
            </button>
          ` : ''}
          ${hasPermission('suppliers_manage') ? `
            <button class="btn btn-primary" onclick="SuppliersModule.showEditForm('${id}')">✏️ تعديل</button>
          ` : ''}
        </div>
      </div>

      <!-- Info Cards -->
      <div class="grid grid-2" style="margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 البيانات</div>
          </div>
          <div style="display:grid; gap:10px;">
            <div><strong>📞 التليفون:</strong> ${s.phone || '—'}</div>
            <div><strong>📍 العنوان:</strong> ${s.address || '—'}</div>
            <div><strong>🏙️ المدينة:</strong> ${s.city || '—'}</div>
            <div><strong>📝 ملاحظات:</strong> ${s.notes || '—'}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">💰 الحساب</div>
          </div>
          <div style="display:grid; gap:10px;">
            <div><strong>💸 المستحق عليه/ا:</strong>
              <span class="${(s.cached_total_debt_to_them || 0) > 0 ? 'negative' : ''}">
                ${fmtMoney(s.cached_total_debt_to_them || 0)} ج.م
              </span>
            </div>
            <div><strong>📦 إجمالي المشتريات:</strong> ${fmtMoney(s.cached_lifetime_purchases || 0)} ج.م</div>
            <div><strong>📄 عدد الفواتير:</strong> ${supplierInvoices.length}</div>
          </div>
        </div>
      </div>

      <!-- Invoices -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📄 فواتير الشراء</div>
          <div class="card-subtitle">${supplierInvoices.length} فاتورة</div>
        </div>

        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${supplierInvoices.length === 0 ? `
                <tr><td colspan="6" style="text-align:center; padding:30px; color:var(--gray-500);">
                  لا توجد فواتير
                </td></tr>
              ` : supplierInvoices.map(inv => `
                <tr onclick="PurchasesModule.viewInvoice('${inv._id}')" style="cursor:pointer;">
                  <td><strong>${inv.invoice_number}</strong></td>
                  <td>${fmtDate(inv.created_at)}</td>
                  <td>${fmtMoney(inv.grand_total)} ج.م</td>
                  <td>${fmtMoney(inv.paid)} ج.م</td>
                  <td class="${inv.remaining > 0 ? 'negative' : 'positive'}">${fmtMoney(inv.remaining)} ج.م</td>
                  <td>${this.getStatusBadge(inv.status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${this.renderModal()}
    `;
  },

  getStatusBadge(status) {
    const map = {
      'paid': '<span class="txn-badge" style="background:#D1FAE5;color:#065F46;">مدفوع</span>',
      'partial': '<span class="txn-badge" style="background:#FEF3C7;color:#92400E;">جزئي</span>',
      'unpaid': '<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;">غير مدفوع</span>',
      'cancelled': '<span class="txn-badge" style="background:#E5E7EB;color:#374151;">ملغى</span>'
    };
    return map[status] || status;
  },

  renderModal() {
    return `
      <div id="supplierModal" class="modal-overlay" style="display:none;">
        <div class="modal">
          <div class="modal-header">
            <h3 id="supplierModalTitle">إضافة مورد جديد</h3>
            <button class="modal-close" onclick="SuppliersModule.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="sup_id">

            <div class="grid grid-2">
              <div class="form-group">
                <label>الكود</label>
                <input type="text" id="sup_code" placeholder="S-001">
              </div>
              <div class="form-group">
                <label>الاسم *</label>
                <input type="text" id="sup_name" placeholder="اسم المورد">
              </div>
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label>التليفون</label>
                <input type="tel" id="sup_phone" placeholder="01xxxxxxxxx">
              </div>
              <div class="form-group">
                <label>المدينة</label>
                <input type="text" id="sup_city">
              </div>
            </div>

            <div class="form-group">
              <label>العنوان</label>
              <input type="text" id="sup_address">
            </div>

            <div class="form-group">
              <label>الحالة</label>
              <select id="sup_status">
                <option value="active">✅ نشط</option>
                <option value="suspended">⏸️ متوقف</option>
                <option value="blocked">🚫 محظور</option>
              </select>
            </div>

            <div class="form-group">
              <label>ملاحظات</label>
              <textarea id="sup_notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="SuppliersModule.closeModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="SuppliersModule.save()">💾 حفظ</button>
          </div>
        </div>
      </div>
    `;
  },

  search(q) {
    this.searchQuery = q;
    // إعادة رسم الجدول فقط
    const tbody = document.querySelector('#moduleContainer tbody');
    if (!tbody) return this.render();

    const suppliers = LocalStore.get('suppliers') || {};
    let list = Object.values(suppliers);
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(qq) ||
        (s.phone || '').includes(qq) ||
        (s.code || '').toLowerCase().includes(qq)
      );
    }
    tbody.innerHTML = list.length === 0
      ? '<tr><td colspan="8" style="text-align:center; padding:40px;">لا نتائج</td></tr>'
      : list.map(s => this.renderRow(s)).join('');
  },

  showAddForm() {
    if (!requirePermission('suppliers_manage', 'إضافة مورد')) return;

    // Auto-generate code
    const counters = LocalStore.get('counters') || {};
    const nextNum = String(counters.supplier || 1).padStart(3, '0');

    document.getElementById('supplierModalTitle').textContent = '➕ إضافة مورد جديد';
    document.getElementById('sup_id').value = '';
    document.getElementById('sup_code').value = 'S-' + nextNum;
    document.getElementById('sup_name').value = '';
    document.getElementById('sup_phone').value = '';
    document.getElementById('sup_city').value = '';
    document.getElementById('sup_address').value = '';
    document.getElementById('sup_status').value = 'active';
    document.getElementById('sup_notes').value = '';
    document.getElementById('supplierModal').style.display = 'flex';
    setTimeout(() => document.getElementById('sup_name').focus(), 100);
  },

  showEditForm(id) {
    if (!requirePermission('suppliers_manage', 'تعديل مورد')) return;
    const suppliers = LocalStore.get('suppliers') || {};
    const s = suppliers[id];
    if (!s) return showNotif('❌ المورد غير موجود', 'danger');

    document.getElementById('supplierModalTitle').textContent = '✏️ تعديل: ' + s.name;
    document.getElementById('sup_id').value = id;
    document.getElementById('sup_code').value = s.code || '';
    document.getElementById('sup_name').value = s.name || '';
    document.getElementById('sup_phone').value = s.phone || '';
    document.getElementById('sup_city').value = s.city || '';
    document.getElementById('sup_address').value = s.address || '';
    document.getElementById('sup_status').value = s.status || 'active';
    document.getElementById('sup_notes').value = s.notes || '';
    document.getElementById('supplierModal').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('supplierModal').style.display = 'none';
  },

  save() {
    const id = document.getElementById('sup_id').value;
    const name = document.getElementById('sup_name').value.trim();
    if (!name) return showNotif('❌ الاسم مطلوب', 'danger');

    const suppliers = LocalStore.get('suppliers') || {};

    const data = {
      code: document.getElementById('sup_code').value.trim(),
      name: name,
      phone: document.getElementById('sup_phone').value.trim(),
      city: document.getElementById('sup_city').value.trim(),
      address: document.getElementById('sup_address').value.trim(),
      status: document.getElementById('sup_status').value,
      notes: document.getElementById('sup_notes').value.trim()
    };

    if (id) {
      suppliers[id] = { ...suppliers[id], ...data, updated_at: Date.now() };
      logActivity('update', 'suppliers', id, name);
      showNotif('✅ تم التعديل', 'success');
    } else {
      const newId = genID('sup_');
      suppliers[newId] = {
        _id: newId,
        ...data,
        cached_total_debt_to_them: 0,
        cached_lifetime_purchases: 0,
        created_at: Date.now(),
        created_by: currentUser._id
      };

      const counters = LocalStore.get('counters') || {};
      counters.supplier = (counters.supplier || 1) + 1;
      LocalStore.set('counters', counters);

      logActivity('create', 'suppliers', newId, name);
      showNotif('✅ تم إضافة المورد', 'success');
    }

    LocalStore.set('suppliers', suppliers);
    this.closeModal();
    this.render();
  },

  viewDetail(id) {
    this.currentSupplierId = id;
    this.currentView = 'detail';
    this.render();
  },

  backToList() {
    this.currentView = 'list';
    this.currentSupplierId = null;
    this.render();
  },

  // للاستدعاء من الفواتير
  updateSupplierCache(supplierId, invoiceTotal, remaining, isNewInvoice) {
    const suppliers = LocalStore.get('suppliers') || {};
    const s = suppliers[supplierId];
    if (!s) return;

    if (isNewInvoice) {
      s.cached_lifetime_purchases = (s.cached_lifetime_purchases || 0) + invoiceTotal;
      s.cached_total_debt_to_them = (s.cached_total_debt_to_them || 0) + remaining;
    }

    suppliers[supplierId] = s;
    LocalStore.set('suppliers', suppliers);
  }
};
