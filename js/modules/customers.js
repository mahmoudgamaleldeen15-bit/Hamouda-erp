// ==========================================================
// Customers Module
// ==========================================================

const CustomersModule = {

  currentView: 'list',
  currentCustomerId: null,
  searchQuery: '',
  statusFilter: 'all',

  render() {
    if (!requirePermission('customers_view', 'مشاهدة العملاء')) {
      return renderPlaceholder('👥 العملاء', 'مش مصرح');
    }

    if (this.currentView === 'detail') return this.renderDetail(this.currentCustomerId);
    return this.renderList();
  },

  // ==========================================================
  // Helper: احسب المديونية والمتأخرات لحظياً
  // ==========================================================
  computeCustomerDebt(customerId) {
    const invoices = LocalStore.get('sales_invoices') || {};
    let totalDebt = 0;
    let overdueAmount = 0;
    const now = Date.now();

    Object.values(invoices).forEach(inv => {
      if (inv.customer_id !== customerId || inv.status === 'cancelled') return;
      if (inv.remaining <= 0) return;

      totalDebt += inv.remaining;

      // متأخر؟
      if (inv.due_date) {
        const dueTime = new Date(inv.due_date).getTime();
        if (dueTime < now) overdueAmount += inv.remaining;
      }
    });

    return { totalDebt, overdueAmount };
  },

  // ==========================================================
  // List View
  // ==========================================================
  renderList() {
    const container = document.getElementById('moduleContainer');
    const customers = LocalStore.get('customers') || {};
    let list = Object.values(customers);

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.code || '').toLowerCase().includes(q)
      );
    }

    if (this.statusFilter !== 'all') {
      list = list.filter(c => (c.status || 'active') === this.statusFilter);
    }

    // Refresh cached values لحظياً
    list.forEach(c => {
      const debt = this.computeCustomerDebt(c._id);
      c._live_debt = debt.totalDebt;
      c._live_overdue = debt.overdueAmount;
    });

    const totalDebt = list.reduce((sum, c) => sum + (c._live_debt || 0), 0);
    const totalOverdue = list.reduce((sum, c) => sum + (c._live_overdue || 0), 0);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">👥 العملاء</div>
          <div class="page-subtitle">${list.length} عميل</div>
        </div>
        <div class="page-actions">
          ${hasPermission('customers_add') ? `
          <button class="btn btn-primary" onclick="CustomersModule.showAddForm()">
            ➕ عميل جديد
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-3" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">👥 عدد العملاء</div>
          <div class="stat-value">${list.length}</div>
        </div>
        <div class="stat-card stat-gold">
          <div class="stat-label">💰 إجمالي المديونية</div>
          <div class="stat-value">${fmtMoneyShort(totalDebt)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">🔴 المتأخرات</div>
          <div class="stat-value">${fmtMoneyShort(totalOverdue)} <span class="stat-currency">ج.م</span></div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="grid grid-2">
          <div class="form-group" style="margin:0;">
            <input type="text" id="custSearch" placeholder="🔍 بحث بالاسم / التليفون / الكود..."
                   value="${this.searchQuery}"
                   oninput="CustomersModule.search(this.value)">
          </div>
          <div class="form-group" style="margin:0;">
            <select id="custStatus" onchange="CustomersModule.filterStatus(this.value)">
              <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>كل الحالات</option>
              <option value="active" ${this.statusFilter === 'active' ? 'selected' : ''}>نشط</option>
              <option value="suspended" ${this.statusFilter === 'suspended' ? 'selected' : ''}>متوقف</option>
              <option value="blocked" ${this.statusFilter === 'blocked' ? 'selected' : ''}>محظور</option>
            </select>
          </div>
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
              <th>الحد الائتماني</th>
              <th>المديونية</th>
              <th>المتأخر</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `
              <tr><td colspan="9" style="text-align:center; padding:40px; color: var(--gray-500);">
                <div style="font-size:48px; margin-bottom:12px;">👥</div>
                <div>لا يوجد عملاء</div>
              </td></tr>
            ` : list.map(c => this.renderRow(c)).join('')}
          </tbody>
        </table>
      </div>

      ${this.renderModal()}
    `;
  },

  renderRow(c) {
    const showLifetime = hasPermission('customers_view_lifetime');
    const status = c.status || 'active';
    const statusBadge = status === 'blocked'
      ? '<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;">🚫 محظور</span>'
      : status === 'suspended'
      ? '<span class="txn-badge" style="background:#FEF3C7;color:#92400E;">⏸️ متوقف</span>'
      : '<span class="txn-badge" style="background:#D1FAE5;color:#065F46;">✅ نشط</span>';

    const debt = c._live_debt || 0;
    const overdue = c._live_overdue || 0;
    const overCredit = c.credit_limit > 0 && debt > c.credit_limit;

    return `
      <tr onclick="CustomersModule.viewDetail('${c._id}')" style="cursor:pointer;">
        <td><strong>${c.code || '—'}</strong></td>
        <td>${c.name}</td>
        <td>${c.phone || '—'}</td>
        <td>${c.city || '—'}</td>
        <td>${c.credit_limit ? fmtMoney(c.credit_limit) + ' ج.م' : '—'}</td>
        <td class="${overCredit ? 'negative' : ''}">
          <strong>${fmtMoney(debt)}</strong> ج.م
          ${overCredit ? '<div style="font-size:11px;color:var(--danger);">⚠️ تجاوز الحد</div>' : ''}
        </td>
        <td class="${overdue > 0 ? 'negative' : ''}">
          ${overdue > 0 ? '<strong>' + fmtMoney(overdue) + '</strong> ج.م' : '—'}
        </td>
        <td>${statusBadge}</td>
        <td onclick="event.stopPropagation();">
          ${debt > 0 && (hasPermission('debtors_collect_payment') || currentUser.role === 'admin') ? `
            <button class="btn btn-ghost btn-sm" style="color:#059669;" onclick="BulkPaymentModule.openForCustomer('${c._id}')" title="تحصيل شامل">💰</button>
          ` : ''}
          ${hasPermission('customers_edit_full') || hasPermission('customers_edit_contact') ? `
            <button class="btn btn-ghost btn-sm" onclick="CustomersModule.showEditForm('${c._id}')">✏️</button>
          ` : ''}
        </td>
      </tr>
    `;
  },

  // ==========================================================
  // Detail View
  // ==========================================================
  renderDetail(id) {
    const container = document.getElementById('moduleContainer');
    const customers = LocalStore.get('customers') || {};
    const c = customers[id];
    if (!c) {
      showNotif('❌ العميل غير موجود', 'danger');
      this.currentView = 'list';
      return this.render();
    }

    // فواتير المبيعات
    const invoices = LocalStore.get('sales_invoices') || {};
    const custInvoices = Object.values(invoices)
      .filter(inv => inv.customer_id === id)
      .sort((a, b) => b.created_at - a.created_at);

    // المدفوعات
    const payments = LocalStore.get('payments') || {};
    const custPayments = Object.values(payments)
      .filter(p => p.customer_id === id && p.type !== 'purchase_payment')
      .sort((a, b) => b.created_at - a.created_at);

    // المديونية
    const debt = this.computeCustomerDebt(id);
    const overCredit = c.credit_limit > 0 && debt.totalDebt > c.credit_limit;
    const showLifetime = hasPermission('customers_view_lifetime');

    // آخر عملية شراء
    const lastPurchase = custInvoices[0]?.created_at || 0;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">👤 ${c.name}</div>
          <div class="page-subtitle">كود: ${c.code || '—'}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="CustomersModule.backToList()">← رجوع</button>
          ${(cust.cached_total_debt || 0) > 0 && (hasPermission('debtors_collect_payment') || currentUser.role === 'admin') ? `
            <button class="btn btn-lg" style="background:#059669; color:white;" onclick="BulkPaymentModule.openForCustomer('${id}')">
              💰 تحصيل شامل
            </button>
          ` : ''}
          ${hasPermission('customers_edit_full') || hasPermission('customers_edit_contact') ? `
            <button class="btn btn-primary" onclick="CustomersModule.showEditForm('${id}')">✏️ تعديل</button>
          ` : ''}
        </div>
      </div>

      <!-- Info Cards -->
      <div class="grid grid-2" style="margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 البيانات</div>
          </div>
          <div style="display:grid; gap:10px; font-size:14px;">
            <div><strong>📞 التليفون:</strong> ${c.phone || '—'} ${c.phone_alt ? ' / ' + c.phone_alt : ''}</div>
            <div><strong>📍 العنوان:</strong> ${c.address || '—'}</div>
            <div><strong>🏙️ المدينة:</strong> ${c.city || '—'}</div>
            <div><strong>📅 آخر شراء:</strong> ${lastPurchase ? fmtDate(lastPurchase) : 'لم يشتري بعد'}</div>
            <div><strong>📝 ملاحظات:</strong> ${c.notes || '—'}</div>
          </div>
        </div>

        <div class="card ${overCredit ? 'card-danger' : ''}">
          <div class="card-header">
            <div class="card-title">💰 الحساب</div>
          </div>
          <div style="display:grid; gap:10px; font-size:14px;">
            <div><strong>🎯 الحد الائتماني:</strong> ${c.credit_limit ? fmtMoney(c.credit_limit) + ' ج.م' : 'غير محدد'}</div>
            <div><strong>⏰ أقصى مدة سداد:</strong> ${c.max_payment_days || 30} يوم</div>
            <div>
              <strong>💰 المديونية الحالية:</strong>
              <span class="${overCredit ? 'negative' : ''}" style="font-weight:700;">
                ${fmtMoney(debt.totalDebt)} ج.م
              </span>
              ${overCredit ? '<span style="color:var(--danger); font-size:12px; margin-right:8px;">⚠️ تجاوز الحد</span>' : ''}
            </div>
            <div>
              <strong>🔴 المتأخرات:</strong>
              <span class="${debt.overdueAmount > 0 ? 'negative' : 'positive'}" style="font-weight:700;">
                ${fmtMoney(debt.overdueAmount)} ج.م
              </span>
            </div>
            ${showLifetime ? `
              <div><strong>📈 إجمالي المبيعات:</strong> ${fmtMoney(c.cached_lifetime_sales || 0)} ج.م</div>
            ` : ''}
            <div><strong>📄 عدد الفواتير:</strong> ${custInvoices.length}</div>
          </div>
        </div>
      </div>

      <!-- Invoices -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div class="card-title">📄 فواتير المبيعات</div>
          <div class="card-subtitle">${custInvoices.length} فاتورة</div>
        </div>

        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>الاستحقاق</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${custInvoices.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding:30px; color:var(--gray-500);">
                  لا توجد فواتير
                </td></tr>
              ` : custInvoices.map(inv => {
                const cancelled = inv.status === 'cancelled';
                const now = Date.now();
                const isOverdue = inv.due_date && new Date(inv.due_date).getTime() < now && inv.remaining > 0;
                return `
                  <tr onclick="SalesModule.viewInvoice('${inv._id}')"
                      style="cursor:pointer; ${cancelled ? 'opacity:0.5; text-decoration:line-through;' : ''}">
                    <td><strong>${inv.invoice_number}</strong></td>
                    <td>${fmtDate(inv.created_at)}</td>
                    <td class="${isOverdue ? 'negative' : ''}">${inv.due_date ? fmtDate(new Date(inv.due_date).getTime()) : '—'}</td>
                    <td>${fmtMoney(inv.grand_total)} ج.م</td>
                    <td>${fmtMoney(inv.paid)} ج.م</td>
                    <td class="${inv.remaining > 0 && !cancelled ? 'negative' : 'positive'}">
                      ${fmtMoney(inv.remaining)} ج.م
                    </td>
                    <td>${PurchasesModule.getStatusBadge(inv.status)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Payments -->
      ${custPayments.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">💵 المدفوعات</div>
          <div class="card-subtitle">${custPayments.length} دفعة</div>
        </div>

        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الفاتورة</th>
                <th>المبلغ</th>
                <th>الطريقة</th>
              </tr>
            </thead>
            <tbody>
              ${custPayments.slice(0, 20).map(p => `
                <tr>
                  <td>${fmtDate(p.created_at)}</td>
                  <td>${p.invoice_number || 'دفعة على الحساب'}</td>
                  <td><strong style="color:var(--leaf-700);">${fmtMoney(p.amount)}</strong> ج.م</td>
                  <td>${PurchasesModule.getPaymentMethodLabel(p.method)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      ${this.renderModal()}
    `;
  },

  // ==========================================================
  // Modal
  // ==========================================================
  renderModal() {
    const canEditFull = hasPermission('customers_edit_full');
    const canEditCredit = hasPermission('customers_edit_credit_limit');

    return `
      <div id="customerModal" class="modal-overlay" style="display:none;">
        <div class="modal">
          <div class="modal-header">
            <h3 id="customerModalTitle">إضافة عميل جديد</h3>
            <button class="modal-close" onclick="CustomersModule.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="cust_id">

            <div class="grid grid-2">
              <div class="form-group">
                <label>الكود</label>
                <input type="text" id="cust_code" placeholder="C-001">
              </div>
              <div class="form-group">
                <label>الاسم *</label>
                <input type="text" id="cust_name" placeholder="اسم العميل">
              </div>
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label>التليفون *</label>
                <input type="tel" id="cust_phone" placeholder="01xxxxxxxxx">
              </div>
              <div class="form-group">
                <label>تليفون احتياطي</label>
                <input type="tel" id="cust_phone_alt">
              </div>
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label>المدينة</label>
                <input type="text" id="cust_city">
              </div>
              <div class="form-group">
                <label>الحالة</label>
                <select id="cust_status">
                  <option value="active">✅ نشط</option>
                  <option value="suspended">⏸️ متوقف</option>
                  <option value="blocked">🚫 محظور</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>العنوان</label>
              <input type="text" id="cust_address">
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label>الحد الائتماني (ج.م) ${!canEditCredit ? '<small>(للأدمن/المحاسب)</small>' : ''}</label>
                <input type="number" id="cust_credit_limit" step="0.01" value="0" ${!canEditCredit ? 'disabled' : ''}>
                <small class="hint">0 = بدون حد</small>
              </div>
              <div class="form-group">
                <label>أقصى مدة سداد (يوم)</label>
                <input type="number" id="cust_max_days" value="30" ${!canEditCredit ? 'disabled' : ''}>
              </div>
            </div>

            <div class="form-group">
              <label>ملاحظات</label>
              <textarea id="cust_notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="CustomersModule.closeModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="CustomersModule.save()">💾 حفظ</button>
          </div>
        </div>
      </div>
    `;
  },

  search(q) {
    this.searchQuery = q;
    this.render();
  },

  filterStatus(status) {
    this.statusFilter = status;
    this.render();
  },

  showAddForm() {
    if (!requirePermission('customers_add', 'إضافة عميل')) return;

    const counters = LocalStore.get('counters') || {};
    const nextNum = String(counters.customer || 1).padStart(3, '0');

    document.getElementById('customerModalTitle').textContent = '➕ إضافة عميل جديد';
    document.getElementById('cust_id').value = '';
    document.getElementById('cust_code').value = 'C-' + nextNum;
    ['cust_name','cust_phone','cust_phone_alt','cust_city','cust_address','cust_notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('cust_status').value = 'active';
    document.getElementById('cust_credit_limit').value = '0';
    document.getElementById('cust_max_days').value = '30';
    document.getElementById('customerModal').style.display = 'flex';
    setTimeout(() => document.getElementById('cust_name').focus(), 100);
  },

  showEditForm(id) {
    const canEditFull = hasPermission('customers_edit_full');
    const canEditContact = hasPermission('customers_edit_contact');
    if (!canEditFull && !canEditContact) {
      return showNotif('❌ ما عندكش صلاحية التعديل', 'danger');
    }

    const customers = LocalStore.get('customers') || {};
    const c = customers[id];
    if (!c) return showNotif('❌ العميل غير موجود', 'danger');

    document.getElementById('customerModalTitle').textContent = '✏️ تعديل: ' + c.name;
    document.getElementById('cust_id').value = id;
    document.getElementById('cust_code').value = c.code || '';
    document.getElementById('cust_name').value = c.name || '';
    document.getElementById('cust_phone').value = c.phone || '';
    document.getElementById('cust_phone_alt').value = c.phone_alt || '';
    document.getElementById('cust_city').value = c.city || '';
    document.getElementById('cust_address').value = c.address || '';
    document.getElementById('cust_status').value = c.status || 'active';
    document.getElementById('cust_credit_limit').value = c.credit_limit || 0;
    document.getElementById('cust_max_days').value = c.max_payment_days || 30;
    document.getElementById('cust_notes').value = c.notes || '';

    // Restrict fields for salesman
    if (!canEditFull && canEditContact) {
      ['cust_code','cust_name','cust_city','cust_status','cust_credit_limit','cust_max_days','cust_notes','cust_address'].forEach(id => {
        const el = document.getElementById(id); if (el) el.disabled = true;
      });
    }

    document.getElementById('customerModal').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('customerModal').style.display = 'none';
    // Re-enable all inputs
    ['cust_code','cust_name','cust_city','cust_status','cust_credit_limit','cust_max_days','cust_notes','cust_address','cust_phone','cust_phone_alt'].forEach(id => {
      const el = document.getElementById(id); if (el) el.disabled = false;
    });
  },

  save() {
    const id = document.getElementById('cust_id').value;
    const name = document.getElementById('cust_name').value.trim();
    if (!name) return showNotif('❌ الاسم مطلوب', 'danger');

    const customers = LocalStore.get('customers') || {};

    const data = {
      code: document.getElementById('cust_code').value.trim(),
      name: name,
      phone: document.getElementById('cust_phone').value.trim(),
      phone_alt: document.getElementById('cust_phone_alt').value.trim(),
      city: document.getElementById('cust_city').value.trim(),
      address: document.getElementById('cust_address').value.trim(),
      status: document.getElementById('cust_status').value,
      credit_limit: Number(document.getElementById('cust_credit_limit').value) || 0,
      max_payment_days: Number(document.getElementById('cust_max_days').value) || 30,
      notes: document.getElementById('cust_notes').value.trim()
    };

    if (id) {
      customers[id] = { ...customers[id], ...data, updated_at: Date.now() };
      logActivity('update', 'customers', id, name);
      showNotif('✅ تم التعديل', 'success');
    } else {
      const newId = genID('cust_');
      customers[newId] = {
        _id: newId,
        ...data,
        cached_total_debt: 0,
        cached_overdue_amount: 0,
        cached_lifetime_sales: 0,
        last_purchase_at: 0,
        created_at: Date.now(),
        created_by: currentUser._id
      };

      const counters = LocalStore.get('counters') || {};
      counters.customer = (counters.customer || 1) + 1;
      LocalStore.set('counters', counters);

      logActivity('create', 'customers', newId, name);
      showNotif('✅ تم إضافة العميل', 'success');
    }

    LocalStore.set('customers', customers);
    this.closeModal();
    this.render();
  },

  viewDetail(id) {
    this.currentCustomerId = id;
    this.currentView = 'detail';
    this.render();
  },

  backToList() {
    this.currentView = 'list';
    this.currentCustomerId = null;
    this.render();
  },

  // Helper للاستدعاء من مبيعات
  updateCustomerCache(customerId, invoiceTotal, remaining, isNewInvoice) {
    const customers = LocalStore.get('customers') || {};
    const c = customers[customerId];
    if (!c) return;

    if (isNewInvoice) {
      c.cached_lifetime_sales = (c.cached_lifetime_sales || 0) + invoiceTotal;
      c.cached_total_debt = (c.cached_total_debt || 0) + remaining;
      c.last_purchase_at = Date.now();
    }

    customers[customerId] = c;
    LocalStore.set('customers', customers);
  }
};
