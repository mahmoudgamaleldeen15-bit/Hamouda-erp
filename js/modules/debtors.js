// ==========================================================
// Debtors Module - إدارة المدينين
// ==========================================================

const DebtorsModule = {

  currentView: 'list',       // list | customer
  currentCustomerId: null,
  currentFilter: 'all',      // all | today | overdue | critical | safe

  render() {
    if (!requirePermission('debtors_view', 'مشاهدة المدينين')) {
      return renderPlaceholder('🔴 المدينين', 'مش مصرح');
    }

    if (this.currentView === 'customer') return this.renderCustomerView(this.currentCustomerId);
    return this.renderList();
  },

  // ==========================================================
  // Helper: احسب لون الفاتورة حسب استحقاقها
  // ==========================================================
  getInvoiceDebtColor(invoice) {
    if (invoice.status === 'cancelled' || invoice.remaining <= 0) return null;
    if (!invoice.due_date) return 'blue';

    const now = Date.now();
    const dueTime = new Date(invoice.due_date).getTime();
    const daysDiff = Math.floor((dueTime - now) / (1000 * 60 * 60 * 24));

    if (daysDiff > 7) return 'blue';
    if (daysDiff > 3) return 'yellow';
    if (daysDiff > 0) return 'orange';
    if (daysDiff === 0) return 'red-light';
    if (daysDiff > -30) return 'red-dark';
    return 'purple-flash';
  },

  getDebtColorInfo(color) {
    const info = {
      'blue': { label: 'آمن', hex: '#3B82F6', bg: '#DBEAFE', textColor: '#1E40AF', icon: '🔵' },
      'yellow': { label: 'قريب - 7 أيام', hex: '#EAB308', bg: '#FEF3C7', textColor: '#92400E', icon: '🟡' },
      'orange': { label: 'تحذير - 3 أيام', hex: '#F97316', bg: '#FED7AA', textColor: '#9A3412', icon: '🟠' },
      'red-light': { label: 'مستحق اليوم', hex: '#EF4444', bg: '#FEE2E2', textColor: '#991B1B', icon: '🔴' },
      'red-dark': { label: 'متأخر', hex: '#DC2626', bg: '#DC2626', textColor: '#FFFFFF', icon: '🔴' },
      'purple-flash': { label: 'متأخر أكثر من شهر', hex: '#7C3AED', bg: '#7C3AED', textColor: '#FFFFFF', icon: '🟣' }
    };
    return info[color] || info['blue'];
  },

  // ==========================================================
  // اجمع كل الفواتير المستحقة مع بيانات العميل
  // ==========================================================
  getOutstandingInvoices() {
    const invoices = LocalStore.get('sales_invoices') || {};
    const customers = LocalStore.get('customers') || {};

    return Object.values(invoices)
      .filter(inv => inv.status !== 'cancelled' && inv.remaining > 0)
      .map(inv => {
        const cust = customers[inv.customer_id] || { name: inv.customer_name_snapshot || '—' };
        return {
          ...inv,
          _customer: cust,
          _debt_color: this.getInvoiceDebtColor(inv)
        };
      });
  },

  // ==========================================================
  // Dashboard View
  // ==========================================================
  renderList() {
    const container = document.getElementById('moduleContainer');
    const allOutstanding = this.getOutstandingInvoices();

    // إحصائيات بالألوان
    const byColor = {
      'blue': [], 'yellow': [], 'orange': [],
      'red-light': [], 'red-dark': [], 'purple-flash': []
    };
    allOutstanding.forEach(inv => {
      if (inv._debt_color) byColor[inv._debt_color].push(inv);
    });

    const totalDebt = allOutstanding.reduce((sum, i) => sum + i.remaining, 0);
    const todayDue = byColor['red-light'].reduce((sum, i) => sum + i.remaining, 0);
    const overdue = [...byColor['red-dark'], ...byColor['purple-flash']].reduce((sum, i) => sum + i.remaining, 0);
    const critical = byColor['purple-flash'].reduce((sum, i) => sum + i.remaining, 0);

    // فلترة
    let filtered = allOutstanding;
    if (this.currentFilter === 'today') filtered = byColor['red-light'];
    else if (this.currentFilter === 'overdue') filtered = [...byColor['red-dark'], ...byColor['purple-flash']];
    else if (this.currentFilter === 'critical') filtered = byColor['purple-flash'];
    else if (this.currentFilter === 'safe') filtered = byColor['blue'];
    else if (this.currentFilter === 'warning') filtered = [...byColor['yellow'], ...byColor['orange']];

    // ترتيب: الأكثر إلحاحاً أولاً
    const colorOrder = ['purple-flash', 'red-dark', 'red-light', 'orange', 'yellow', 'blue'];
    filtered.sort((a, b) => colorOrder.indexOf(a._debt_color) - colorOrder.indexOf(b._debt_color));

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🔴 المدينين</div>
          <div class="page-subtitle">${allOutstanding.length} فاتورة مستحقة — إجمالي ${fmtMoney(totalDebt)} ج.م</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" onclick="DebtorsModule.showOnAccountModal()">
            💵 دفع على الحساب
          </button>
          <button class="btn btn-outline btn-sm" onclick="DebtorsModule.render()">
            🔄 تحديث
          </button>
        </div>
      </div>

      <!-- Alert Cards -->
      <div class="grid grid-4" style="margin-bottom: 20px;">
        <div class="stat-card" style="border-right-color: #EF4444; ${todayDue > 0 ? 'background: #FEF2F2;' : ''}">
          <div class="stat-label">🔴 مستحق اليوم</div>
          <div class="stat-value">${fmtMoney(todayDue)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${byColor['red-light'].length} فاتورة</div>
        </div>

        <div class="stat-card" style="border-right-color: #DC2626; ${overdue > 0 ? 'background: #FEF2F2;' : ''}">
          <div class="stat-label">⚠️ متأخر</div>
          <div class="stat-value">${fmtMoney(overdue)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${byColor['red-dark'].length + byColor['purple-flash'].length} فاتورة</div>
        </div>

        <div class="stat-card" style="border-right-color: #7C3AED; ${critical > 0 ? 'background: #F5F3FF;' : ''}">
          <div class="stat-label">🟣 حرج (>30 يوم)</div>
          <div class="stat-value">${fmtMoney(critical)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${byColor['purple-flash'].length} فاتورة</div>
        </div>

        <div class="stat-card stat-gold">
          <div class="stat-label">💰 إجمالي المستحق</div>
          <div class="stat-value">${fmtMoney(totalDebt)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${allOutstanding.length} فاتورة</div>
        </div>
      </div>

      <!-- Color Legend / Filters -->
      <div class="card" style="margin-bottom: 16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div style="font-weight:700; color:var(--gray-700);">📊 توزيع المديونية بالحالة</div>
          <div style="font-size:13px; color:var(--gray-500);">اضغط أي لون للفلترة</div>
        </div>
        <div class="debt-filters">
          ${this.renderFilterChip('all', 'الكل', allOutstanding.length, null)}
          ${this.renderFilterChip('critical', '🟣 حرج', byColor['purple-flash'].length, 'purple-flash')}
          ${this.renderFilterChip('overdue', '🔴 متأخر', byColor['red-dark'].length + byColor['purple-flash'].length, 'red-dark')}
          ${this.renderFilterChip('today', '🔴 مستحق اليوم', byColor['red-light'].length, 'red-light')}
          ${this.renderFilterChip('warning', '🟠 تحذير', byColor['yellow'].length + byColor['orange'].length, 'orange')}
          ${this.renderFilterChip('safe', '🔵 آمن', byColor['blue'].length, 'blue')}
        </div>
      </div>

      <!-- Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>الحالة</th>
              <th>الفاتورة</th>
              <th>العميل</th>
              <th>التليفون</th>
              <th>تاريخ الفاتورة</th>
              <th>الاستحقاق</th>
              <th>الأيام</th>
              <th>المتبقي</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr><td colspan="9" style="text-align:center; padding:60px; color:var(--gray-500);">
                <div style="font-size:56px; margin-bottom:12px;">🎉</div>
                <div style="font-size:16px; font-weight:600;">ولا فاتورة في التصنيف ده!</div>
              </td></tr>
            ` : filtered.map(inv => this.renderRow(inv)).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderFilterChip(filter, label, count, color) {
    const isActive = this.currentFilter === filter;
    const colorInfo = color ? this.getDebtColorInfo(color) : null;
    const bgStyle = isActive && colorInfo
      ? `background: ${colorInfo.hex}; color: white; border-color: ${colorInfo.hex};`
      : isActive
      ? 'background: var(--grape-600); color: white; border-color: var(--grape-600);'
      : '';

    return `
      <button class="debt-filter-chip ${isActive ? 'active' : ''}"
              onclick="DebtorsModule.setFilter('${filter}')"
              style="${bgStyle}">
        ${label} <span class="chip-count">${count}</span>
      </button>
    `;
  },

  setFilter(filter) {
    this.currentFilter = filter;
    this.render();
  },

  renderRow(inv) {
    const colorInfo = this.getDebtColorInfo(inv._debt_color);
    const now = Date.now();
    const daysDiff = inv.due_date ? Math.floor((new Date(inv.due_date).getTime() - now) / (1000 * 60 * 60 * 24)) : null;

    let daysText = '—';
    if (daysDiff !== null) {
      if (daysDiff > 0) daysText = `<span style="color:var(--gray-600);">قبل ${daysDiff} يوم</span>`;
      else if (daysDiff === 0) daysText = '<strong style="color:var(--danger);">اليوم!</strong>';
      else daysText = `<strong style="color:var(--danger);">متأخر ${Math.abs(daysDiff)} يوم</strong>`;
    }

    const flashStyle = inv._debt_color === 'purple-flash' ? 'animation: flashPurple 2s ease-in-out infinite;' : '';

    return `
      <tr style="${flashStyle}">
        <td>
          <span class="debt-chip debt-${inv._debt_color}">
            ${colorInfo.icon} ${colorInfo.label}
          </span>
        </td>
        <td onclick="SalesModule.viewInvoice('${inv._id}')" style="cursor:pointer;">
          <strong>${inv.invoice_number}</strong>
        </td>
        <td onclick="DebtorsModule.viewCustomer('${inv.customer_id}')" style="cursor:pointer; color:var(--grape-700); font-weight:600;">
          ${inv._customer.name}
        </td>
        <td>${inv._customer.phone || '—'}</td>
        <td>${fmtDate(inv.created_at)}</td>
        <td>${inv.due_date ? fmtDate(new Date(inv.due_date).getTime()) : '—'}</td>
        <td>${daysText}</td>
        <td><strong style="color:var(--danger); font-size:15px;">${fmtMoney(inv.remaining)}</strong> ج.م</td>
        <td>
          <div style="display:flex; gap:4px;">
            ${hasPermission('debtors_collect_payment') ? `
              <button class="btn btn-secondary btn-sm" onclick="DebtorsModule.showPaymentModal('${inv._id}')" title="تحصيل">
                💵
              </button>
            ` : ''}
            <button class="btn btn-outline btn-sm" onclick="DebtorsModule.showReminderOptions('${inv._id}')" title="مطالبة">
              📱
            </button>
            ${hasPermission('debtors_reschedule') ? `
              <button class="btn btn-ghost btn-sm" onclick="DebtorsModule.showRescheduleModal('${inv._id}')" title="إعادة جدولة">
                📅
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  },

  // ==========================================================
  // Customer View
  // ==========================================================
  viewCustomer(id) {
    this.currentCustomerId = id;
    this.currentView = 'customer';
    this.render();
  },

  renderCustomerView(customerId) {
    const customers = LocalStore.get('customers') || {};
    const cust = customers[customerId];
    if (!cust) {
      showNotif('❌ العميل غير موجود', 'danger');
      this.currentView = 'list';
      return this.render();
    }

    const container = document.getElementById('moduleContainer');
    const allOutstanding = this.getOutstandingInvoices()
      .filter(inv => inv.customer_id === customerId);

    // ترتيب: الأكثر إلحاحاً أولاً
    const colorOrder = ['purple-flash', 'red-dark', 'red-light', 'orange', 'yellow', 'blue'];
    allOutstanding.sort((a, b) => colorOrder.indexOf(a._debt_color) - colorOrder.indexOf(b._debt_color));

    const totalDebt = allOutstanding.reduce((sum, i) => sum + i.remaining, 0);
    const overdueAmount = allOutstanding
      .filter(i => ['red-dark', 'purple-flash', 'red-light'].includes(i._debt_color))
      .reduce((sum, i) => sum + i.remaining, 0);

    // آخر دفعات
    const payments = LocalStore.get('payments') || {};
    const custPayments = Object.values(payments)
      .filter(p => p.customer_id === customerId && p.type !== 'purchase_payment')
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 10);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🔴 مدينية: ${cust.name}</div>
          <div class="page-subtitle">${allOutstanding.length} فاتورة مستحقة</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="DebtorsModule.backToList()">← رجوع</button>
          ${totalDebt > 0 && hasPermission('debtors_collect_payment') ? `
            <button class="btn btn-primary" onclick="DebtorsModule.showOnAccountModal('${customerId}')">
              💵 دفع على الحساب
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Info Header -->
      <div class="grid grid-3" style="margin-bottom: 20px;">
        <div class="card">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:36px;">📞</div>
            <div>
              <div style="font-size:12px; color:var(--gray-500);">التليفون</div>
              <div style="font-weight:700; font-size:16px;">${cust.phone || '—'}</div>
              ${cust.phone_alt ? '<div style="font-size:13px; color:var(--gray-600);">/ ' + cust.phone_alt + '</div>' : ''}
            </div>
          </div>
        </div>
        <div class="card">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:36px;">🎯</div>
            <div>
              <div style="font-size:12px; color:var(--gray-500);">الحد الائتماني</div>
              <div style="font-weight:700; font-size:16px;">${cust.credit_limit ? fmtMoney(cust.credit_limit) + ' ج.م' : 'بدون حد'}</div>
              <div style="font-size:12px; color:${totalDebt > cust.credit_limit && cust.credit_limit > 0 ? 'var(--danger)' : 'var(--gray-500)'};">
                استخدام: ${cust.credit_limit ? Math.round((totalDebt / cust.credit_limit) * 100) + '%' : '—'}
              </div>
            </div>
          </div>
        </div>
        <div class="card ${overdueAmount > 0 ? 'card-danger' : ''}">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:36px;">💸</div>
            <div>
              <div style="font-size:12px; color:var(--gray-500);">إجمالي المستحق</div>
              <div style="font-weight:800; font-size:20px; color:var(--danger);">${fmtMoney(totalDebt)} ج.م</div>
              ${overdueAmount > 0 ? '<div style="font-size:12px; color:var(--danger);">🔴 متأخر: ' + fmtMoney(overdueAmount) + ' ج.م</div>' : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Outstanding Invoices -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="card-title">📄 الفواتير المستحقة</div>
            <div class="card-subtitle">مرتبة حسب الأولوية</div>
          </div>
          ${hasPermission('debtors_collect_payment') || currentUser.role === 'admin' ? `
            <button class="btn btn-lg" style="background:#059669; color:white;" onclick="BulkPaymentModule.openForCustomer('${customerId}')">
              💰 تحصيل شامل
            </button>
          ` : ''}
        </div>

        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>الحالة</th>
                <th>الرقم</th>
                <th>تاريخ الفاتورة</th>
                <th>الاستحقاق</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${allOutstanding.length === 0 ? `
                <tr><td colspan="8" style="text-align:center; padding:40px; color:var(--leaf-700);">
                  <div style="font-size:36px; margin-bottom:8px;">🎉</div>
                  <div>مفيش مستحقات على هذا العميل!</div>
                </td></tr>
              ` : allOutstanding.map(inv => {
                const colorInfo = this.getDebtColorInfo(inv._debt_color);
                return `
                  <tr>
                    <td>
                      <span class="debt-chip debt-${inv._debt_color}">
                        ${colorInfo.icon} ${colorInfo.label}
                      </span>
                    </td>
                    <td onclick="SalesModule.viewInvoice('${inv._id}')" style="cursor:pointer;">
                      <strong>${inv.invoice_number}</strong>
                    </td>
                    <td>${fmtDate(inv.created_at)}</td>
                    <td>${inv.due_date ? fmtDate(new Date(inv.due_date).getTime()) : '—'}</td>
                    <td>${fmtMoney(inv.grand_total)} ج.م</td>
                    <td>${fmtMoney(inv.paid)} ج.م</td>
                    <td><strong style="color:var(--danger);">${fmtMoney(inv.remaining)}</strong> ج.م</td>
                    <td>
                      <div style="display:flex; gap:4px;">
                        ${hasPermission('debtors_collect_payment') ? `
                          <button class="btn btn-secondary btn-sm" onclick="DebtorsModule.showPaymentModal('${inv._id}')">💵</button>
                        ` : ''}
                        <button class="btn btn-outline btn-sm" onclick="DebtorsModule.showReminderOptions('${inv._id}')">📱</button>
                        ${hasPermission('debtors_reschedule') ? `
                          <button class="btn btn-ghost btn-sm" onclick="DebtorsModule.showRescheduleModal('${inv._id}')">📅</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Payments -->
      ${custPayments.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">💵 آخر التحصيلات</div>
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
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${custPayments.map(p => `
                <tr>
                  <td>${fmtDateTime(p.created_at)}</td>
                  <td>${p.invoice_number || '<em style="color:var(--gray-500);">على الحساب</em>'}</td>
                  <td><strong style="color:var(--leaf-700); font-size:15px;">+${fmtMoney(p.amount)}</strong> ج.م</td>
                  <td>${PurchasesModule.getPaymentMethodLabel(p.method)}</td>
                  <td>${p.notes || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
    `;
  },

  backToList() {
    this.currentView = 'list';
    this.currentCustomerId = null;
    this.render();
  },

  // ==========================================================
  // Modal 1: تحصيل دفعة على فاتورة
  // ==========================================================
  showPaymentModal(invoiceId) {
    if (!requirePermission('debtors_collect_payment', 'تحصيل دفعة')) return;

    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    if (!inv) return showNotif('❌ الفاتورة غير موجودة', 'danger');
    if (inv.remaining <= 0) return showNotif('✅ الفاتورة مدفوعة بالكامل', 'success');

    const customers = LocalStore.get('customers') || {};
    const cust = customers[inv.customer_id] || {};
    const paymentMethods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;

    // Modal HTML
    const modalHtml = `
      <div id="paymentModal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3>💵 تحصيل دفعة</h3>
            <button class="modal-close" onclick="DebtorsModule.closePaymentModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:var(--gray-50); border-radius:var(--radius); margin-bottom:16px;">
              <div style="display:grid; gap:6px; font-size:14px;">
                <div><strong>الفاتورة:</strong> ${inv.invoice_number}</div>
                <div><strong>العميل:</strong> ${cust.name || inv.customer_name_snapshot}</div>
                <div><strong>الإجمالي:</strong> ${fmtMoney(inv.grand_total)} ج.م</div>
                <div><strong>المدفوع سابقاً:</strong> ${fmtMoney(inv.paid)} ج.م</div>
                <div style="color:var(--danger); font-weight:700;">
                  <strong>المتبقي:</strong> ${fmtMoney(inv.remaining)} ج.م
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>المبلغ المدفوع *</label>
              <input type="number" id="pay_amount" step="0.01" max="${inv.remaining}"
                     placeholder="0.00" autofocus>
              <small class="hint">الأقصى: ${fmtMoney(inv.remaining)} ج.م</small>
            </div>

            <div style="display:flex; gap:8px; margin-bottom:16px;">
              <button class="btn btn-outline btn-sm" onclick="document.getElementById('pay_amount').value='${inv.remaining}'">
                💯 تسوية كاملة
              </button>
              <button class="btn btn-outline btn-sm" onclick="document.getElementById('pay_amount').value='${(inv.remaining / 2).toFixed(2)}'">
                ½ نصف
              </button>
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label>طريقة الدفع</label>
                <select id="pay_method" onchange="DebtorsModule.showPaymentDetails(this.value)">
                  ${Object.entries(paymentMethods).filter(([k,v]) => v.enabled).map(([k, v]) =>
                    `<option value="${k}">${v.icon || ''} ${v.label}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>التاريخ</label>
                <input type="date" id="pay_date" value="${new Date().toISOString().slice(0,10)}">
              </div>
            </div>

            <!-- Payment Transfer Details -->
            <div id="debt_payment_details_box" style="display:none;"></div>

            <div class="form-group" style="margin-top:12px;">
              <label>ملاحظات</label>
              <textarea id="pay_notes" rows="2" placeholder="اختياري"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="DebtorsModule.closePaymentModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="DebtorsModule.savePayment('${invoiceId}')">
              💵 حفظ التحصيل
            </button>
          </div>
        </div>
      </div>
    `;

    // Append modal
    const existing = document.getElementById('paymentModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
      document.getElementById('pay_amount')?.focus();
      this.showPaymentDetails(document.getElementById('pay_method')?.value);
    }, 100);
  },

  showPaymentDetails(methodKey) {
    const box = document.getElementById('debt_payment_details_box');
    if (!box) return;
    if (!methodKey || methodKey === 'cash') {
      box.style.display = 'none';
      return;
    }
    const methods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;
    const method = methods[methodKey];
    if (!method || !method.requires_transfer || !method.phone) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    box.innerHTML = `
      <div style="padding:12px; background:#F0FDF4; border:1px solid var(--leaf-400); border-radius:var(--radius); font-size:13px;">
        <div style="font-weight:700; color:var(--leaf-700); margin-bottom:6px;">
          💳 ${method.icon} ${method.label}
        </div>
        <div>📱 <strong style="direction:ltr; display:inline-block;">${method.phone}</strong></div>
        <div>👤 ${method.recipient_name}</div>
      </div>
    `;
  },

  closePaymentModal() {
    document.getElementById('paymentModal')?.remove();
  },

  savePayment(invoiceId) {
    const amount = Number(document.getElementById('pay_amount').value);
    const method = document.getElementById('pay_method').value;
    const date = document.getElementById('pay_date').value;
    const notes = document.getElementById('pay_notes').value.trim();

    if (!amount || amount <= 0) return showNotif('❌ المبلغ لازم أكبر من صفر', 'danger');

    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    if (!inv) return showNotif('❌ الفاتورة غير موجودة', 'danger');

    if (amount > inv.remaining) {
      return showNotif('❌ المبلغ أكبر من المتبقي (' + fmtMoney(inv.remaining) + ')', 'danger');
    }

    // احفظ الدفعة
    const paymentId = genID('pay_');
    const payments = LocalStore.get('payments') || {};
    payments[paymentId] = {
      _id: paymentId,
      type: 'sales_payment',
      customer_id: inv.customer_id,
      invoice_id: invoiceId,
      invoice_number: inv.invoice_number,
      amount: amount,
      method: method,
      date: date,
      received_by: currentUser._id,
      notes: notes,
      created_at: Date.now()
    };
    LocalStore.set('payments', payments);

    // حدث الفاتورة
    const before = { paid: inv.paid, remaining: inv.remaining, status: inv.status };
    inv.paid += amount;
    inv.remaining = Math.max(0, inv.grand_total - inv.paid);
    if (inv.remaining === 0) inv.status = 'paid';
    else inv.status = 'partial';

    // اضف الدفعة لـ payments array في الفاتورة (لو موجودة)
    if (!inv.payments) inv.payments = [];
    inv.payments.push({
      amount: amount,
      method: method,
      date: date,
      notes: notes,
      recorded_at: Date.now()
    });

    invoices[invoiceId] = inv;
    LocalStore.set('sales_invoices', invoices);

    // حدث كاش العميل
    const customers = LocalStore.get('customers') || {};
    const cust = customers[inv.customer_id];
    if (cust) {
      cust.cached_total_debt = Math.max(0, (cust.cached_total_debt || 0) - amount);
      customers[inv.customer_id] = cust;
      LocalStore.set('customers', customers);
    }

    // Activity log
    logActivity('payment_received', 'debtors', invoiceId, inv.invoice_number, {
      amount: amount, method: method,
      before_paid: before.paid, after_paid: inv.paid,
      customer: cust?.name
    });

    showNotif(`✅ تم تحصيل ${fmtMoney(amount)} ج.م`, 'success');
    this.closePaymentModal();
    this.render();
  },

  // ==========================================================
  // Modal 2: دفع على الحساب (FIFO)
  // ==========================================================
  showOnAccountModal(preselectCustomerId = null) {
    if (!requirePermission('debtors_collect_payment', 'تحصيل دفعة')) return;

    const customers = Object.values(LocalStore.get('customers') || {});
    const paymentMethods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;

    // فقط العملاء اللي عليهم مديونية
    const customersWithDebt = customers
      .map(c => ({
        ...c,
        _debt: CustomersModule.computeCustomerDebt(c._id).totalDebt
      }))
      .filter(c => c._debt > 0)
      .sort((a, b) => b._debt - a._debt);

    const modalHtml = `
      <div id="onAccountModal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3>💵 دفع على الحساب</h3>
            <button class="modal-close" onclick="DebtorsModule.closeOnAccountModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:#EDE9FE; border-radius:var(--radius); margin-bottom:16px; font-size:13px;">
              <strong>💡 كيف يعمل الدفع على الحساب:</strong>
              <div style="margin-top:6px; color:var(--gray-700);">
                المبلغ يتم خصمه من أقدم فاتورة مستحقة تلقائياً (FIFO). لو المبلغ زيادة، ينتقل للفاتورة اللي بعدها.
              </div>
            </div>

            <div class="form-group">
              <label>العميل *</label>
              <select id="oa_customer" onchange="DebtorsModule.previewOnAccount()">
                <option value="">اختر عميل...</option>
                ${customersWithDebt.map(c =>
                  `<option value="${c._id}" ${preselectCustomerId === c._id ? 'selected' : ''}>
                    ${c.name} — مديونية: ${fmtMoney(c._debt)} ج.م
                  </option>`
                ).join('')}
              </select>
              ${customersWithDebt.length === 0 ? '<small class="hint" style="color:var(--leaf-700);">🎉 مفيش عملاء عليهم مديونية</small>' : ''}
            </div>

            <div class="form-group">
              <label>المبلغ *</label>
              <input type="number" id="oa_amount" step="0.01" placeholder="0.00"
                     oninput="DebtorsModule.previewOnAccount()">
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label>طريقة الدفع</label>
                <select id="oa_method">
                  ${Object.entries(paymentMethods).filter(([k,v]) => v.enabled).map(([k, v]) =>
                    `<option value="${k}">${v.label}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>التاريخ</label>
                <input type="date" id="oa_date" value="${new Date().toISOString().slice(0,10)}">
              </div>
            </div>

            <div class="form-group">
              <label>ملاحظات</label>
              <textarea id="oa_notes" rows="2" placeholder="اختياري"></textarea>
            </div>

            <!-- Preview -->
            <div id="oa_preview" style="display:none;"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="DebtorsModule.closeOnAccountModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="DebtorsModule.saveOnAccount()">
              💵 حفظ التوزيع
            </button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('onAccountModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    if (preselectCustomerId) setTimeout(() => this.previewOnAccount(), 100);
  },

  closeOnAccountModal() {
    document.getElementById('onAccountModal')?.remove();
  },

  previewOnAccount() {
    const customerId = document.getElementById('oa_customer').value;
    const amount = Number(document.getElementById('oa_amount').value) || 0;
    const preview = document.getElementById('oa_preview');

    if (!customerId || amount <= 0) {
      preview.style.display = 'none';
      return;
    }

    // جيب فواتير العميل غير المدفوعة (مرتبة بالأقدم)
    const invoices = Object.values(LocalStore.get('sales_invoices') || {})
      .filter(inv => inv.customer_id === customerId &&
                     inv.status !== 'cancelled' &&
                     inv.remaining > 0)
      .sort((a, b) => a.created_at - b.created_at);

    let remaining = amount;
    const distribution = [];
    for (const inv of invoices) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, inv.remaining);
      distribution.push({
        invoice_id: inv._id,
        invoice_number: inv.invoice_number,
        remaining_before: inv.remaining,
        allocated: alloc,
        remaining_after: inv.remaining - alloc,
        due_date: inv.due_date
      });
      remaining -= alloc;
    }

    // Render preview
    preview.style.display = 'block';
    preview.innerHTML = `
      <div style="margin-top:12px; padding:14px; background:#F0FDF4; border-radius:var(--radius); border-right:4px solid var(--leaf-600);">
        <div style="font-weight:700; margin-bottom:10px; color:var(--leaf-800);">
          📊 توزيع المبلغ ${fmtMoney(amount)} ج.م:
        </div>
        ${distribution.length === 0 ? `
          <div style="color:var(--gray-500);">لا توجد فواتير مستحقة على هذا العميل</div>
        ` : distribution.map(d => `
          <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed var(--gray-200); font-size:13px;">
            <div>
              <strong>${d.invoice_number}</strong>
              ${d.due_date ? '<small style="color:var(--gray-500); margin-right:6px;">استحقاق: ' + d.due_date + '</small>' : ''}
            </div>
            <div>
              <span style="color:var(--leaf-700); font-weight:700;">+${fmtMoney(d.allocated)}</span>
              <small style="color:var(--gray-500); margin-right:6px;">
                (متبقي: ${fmtMoney(d.remaining_after)})
              </small>
            </div>
          </div>
        `).join('')}
        ${remaining > 0 ? `
          <div style="margin-top:8px; padding:8px; background:#FEF3C7; border-radius:var(--radius); font-size:13px; color:#92400E;">
            ⚠️ فيه ${fmtMoney(remaining)} ج.م لسه بدون توزيع (المديونية أقل من المبلغ)
          </div>
        ` : ''}
      </div>
    `;
  },

  saveOnAccount() {
    const customerId = document.getElementById('oa_customer').value;
    const amount = Number(document.getElementById('oa_amount').value);
    const method = document.getElementById('oa_method').value;
    const date = document.getElementById('oa_date').value;
    const notes = document.getElementById('oa_notes').value.trim();

    if (!customerId) return showNotif('❌ اختر العميل', 'danger');
    if (!amount || amount <= 0) return showNotif('❌ المبلغ لازم أكبر من صفر', 'danger');

    // جيب الفواتير المستحقة
    const invoicesObj = LocalStore.get('sales_invoices') || {};
    const outstandingInvs = Object.values(invoicesObj)
      .filter(inv => inv.customer_id === customerId &&
                     inv.status !== 'cancelled' &&
                     inv.remaining > 0)
      .sort((a, b) => a.created_at - b.created_at);

    if (outstandingInvs.length === 0) {
      return showNotif('⚠️ لا توجد فواتير مستحقة على هذا العميل', 'warning');
    }

    const payments = LocalStore.get('payments') || {};
    let remainingAmount = amount;
    let totalAllocated = 0;
    const affectedInvoices = [];

    // FIFO
    for (const inv of outstandingInvs) {
      if (remainingAmount <= 0) break;

      const alloc = Math.min(remainingAmount, inv.remaining);

      // احفظ payment record
      const paymentId = genID('pay_');
      payments[paymentId] = {
        _id: paymentId,
        type: 'sales_payment',
        customer_id: customerId,
        invoice_id: inv._id,
        invoice_number: inv.invoice_number,
        amount: alloc,
        method: method,
        date: date,
        received_by: currentUser._id,
        notes: (notes ? notes + ' — ' : '') + 'دفع على الحساب',
        on_account: true,
        created_at: Date.now()
      };

      // حدث الفاتورة
      inv.paid += alloc;
      inv.remaining = Math.max(0, inv.grand_total - inv.paid);
      if (inv.remaining === 0) inv.status = 'paid';
      else inv.status = 'partial';

      if (!inv.payments) inv.payments = [];
      inv.payments.push({
        amount: alloc,
        method: method,
        date: date,
        notes: 'على الحساب',
        recorded_at: Date.now()
      });

      invoicesObj[inv._id] = inv;
      affectedInvoices.push({ number: inv.invoice_number, amount: alloc });

      remainingAmount -= alloc;
      totalAllocated += alloc;
    }

    LocalStore.set('sales_invoices', invoicesObj);
    LocalStore.set('payments', payments);

    // حدث العميل
    const customers = LocalStore.get('customers') || {};
    const cust = customers[customerId];
    if (cust) {
      cust.cached_total_debt = Math.max(0, (cust.cached_total_debt || 0) - totalAllocated);
      customers[customerId] = cust;
      LocalStore.set('customers', customers);
    }

    // Activity log
    logActivity('payment_on_account', 'debtors', customerId, cust?.name || '', {
      amount: amount,
      allocated: totalAllocated,
      unallocated: remainingAmount,
      invoices_affected: affectedInvoices.length,
      details: affectedInvoices
    });

    if (remainingAmount > 0) {
      showNotif(`✅ تم توزيع ${fmtMoney(totalAllocated)} على ${affectedInvoices.length} فاتورة، وباقي ${fmtMoney(remainingAmount)} لسه`, 'success', 5000);
    } else {
      showNotif(`✅ تم توزيع ${fmtMoney(totalAllocated)} على ${affectedInvoices.length} فاتورة`, 'success');
    }

    this.closeOnAccountModal();
    this.render();
  },

  // ==========================================================
  // Modal 3: إعادة جدولة
  // ==========================================================
  showRescheduleModal(invoiceId) {
    if (!requirePermission('debtors_reschedule', 'إعادة الجدولة')) return;

    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    if (!inv) return;

    const currentDue = inv.due_date || new Date().toISOString().slice(0,10);
    const newDue = new Date();
    newDue.setDate(newDue.getDate() + 30);

    const modalHtml = `
      <div id="rescheduleModal" class="modal-overlay">
        <div class="modal" style="max-width: 450px;">
          <div class="modal-header">
            <h3>📅 إعادة جدولة</h3>
            <button class="modal-close" onclick="DebtorsModule.closeRescheduleModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:var(--gray-50); border-radius:var(--radius); margin-bottom:16px;">
              <div><strong>الفاتورة:</strong> ${inv.invoice_number}</div>
              <div><strong>المتبقي:</strong> ${fmtMoney(inv.remaining)} ج.م</div>
              <div><strong>الاستحقاق الحالي:</strong> ${currentDue}</div>
            </div>

            <div class="form-group">
              <label>تاريخ الاستحقاق الجديد *</label>
              <input type="date" id="new_due_date" value="${newDue.toISOString().slice(0,10)}">
            </div>

            <div class="form-group">
              <label>سبب إعادة الجدولة *</label>
              <textarea id="reschedule_reason" rows="3" placeholder="مثل: العميل طلب مهلة لأسبوع"></textarea>
              <small class="hint">على الأقل 5 حروف</small>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="DebtorsModule.closeRescheduleModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="DebtorsModule.saveReschedule('${invoiceId}')">
              📅 حفظ
            </button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('rescheduleModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  closeRescheduleModal() {
    document.getElementById('rescheduleModal')?.remove();
  },

  saveReschedule(invoiceId) {
    const newDate = document.getElementById('new_due_date').value;
    const reason = document.getElementById('reschedule_reason').value.trim();

    if (!newDate) return showNotif('❌ اختر التاريخ الجديد', 'danger');
    if (reason.length < 5) return showNotif('❌ السبب مطلوب (5 حروف على الأقل)', 'danger');

    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    if (!inv) return;

    const oldDue = inv.due_date;
    inv.due_date = newDate;

    if (!inv.reschedule_history) inv.reschedule_history = [];
    inv.reschedule_history.push({
      from: oldDue,
      to: newDate,
      reason: reason,
      by: currentUser._id,
      by_name: currentUser.name,
      at: Date.now()
    });

    invoices[invoiceId] = inv;
    LocalStore.set('sales_invoices', invoices);

    logActivity('reschedule', 'debtors', invoiceId, inv.invoice_number, {
      from: oldDue, to: newDate, reason
    });

    showNotif('✅ تم إعادة الجدولة', 'success');
    this.closeRescheduleModal();
    this.render();
  },

  // ==========================================================
  // Modal 4: خيارات المطالبة (واتساب)
  // ==========================================================
  showReminderOptions(invoiceId) {
    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    if (!inv) return;

    const customers = LocalStore.get('customers') || {};
    const cust = customers[inv.customer_id];
    if (!cust || !cust.phone) return showNotif('❌ العميل ما عندوش تليفون', 'danger');

    // الأدمن يقدر يبعت مباشرة، غير كده يعدي على الحاج
    const isAdmin = currentUser.role === 'admin';

    const modalHtml = `
      <div id="reminderModal" class="modal-overlay">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3>📱 مطالبة العميل</h3>
            <button class="modal-close" onclick="DebtorsModule.closeReminderModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:var(--gray-50); border-radius:var(--radius); margin-bottom:16px; font-size:14px;">
              <div><strong>العميل:</strong> ${cust.name}</div>
              <div><strong>التليفون:</strong> ${cust.phone}</div>
              <div><strong>الفاتورة:</strong> ${inv.invoice_number}</div>
              <div style="color:var(--danger); font-weight:700;">
                <strong>المستحق:</strong> ${fmtMoney(inv.remaining)} ج.م
              </div>
            </div>

            <div style="display:grid; gap:10px;">
              ${isAdmin ? `
                <button class="btn btn-secondary btn-lg" onclick="DebtorsModule.sendReminderToCustomer('${invoiceId}')"
                        style="justify-content:flex-start; padding:14px; text-align:right;">
                  <div style="font-size:24px; margin-left:12px;">👤</div>
                  <div style="flex:1;">
                    <div style="font-weight:700;">إرسال مباشر للعميل</div>
                    <div style="font-size:12px; opacity:0.9;">يفتح واتساب على تليفون العميل بالمطالبة</div>
                  </div>
                </button>
              ` : ''}

              <button class="btn btn-gold btn-lg" onclick="DebtorsModule.sendReminderToHaj('${invoiceId}')"
                      style="justify-content:flex-start; padding:14px; text-align:right;">
                <div style="font-size:24px; margin-left:12px;">📱</div>
                <div style="flex:1;">
                  <div style="font-weight:700;">إرسال للحاج للموافقة</div>
                  <div style="font-size:12px; opacity:0.9;">${isAdmin ? 'الحاج يشوف الرسالة قبل ما تبعتها للعميل' : 'الحاج يوافق قبل الإرسال للعميل'}</div>
                </div>
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost btn-full" onclick="DebtorsModule.closeReminderModal()">إغلاق</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('reminderModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  closeReminderModal() {
    document.getElementById('reminderModal')?.remove();
  },

  buildReminderText(inv, cust) {
    const templates = LocalStore.get('settings/whatsapp_templates') || DEFAULT_WA_TEMPLATES;
    let text = templates.debt_reminder;

    return text
      .replace('{customer_name}', cust.name)
      .replace('{invoice_number}', inv.invoice_number)
      .replace('{amount}', fmtMoney(inv.remaining))
      .replace('{due_date}', inv.due_date || '—');
  },

  sendReminderToCustomer(invoiceId) {
    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    const customers = LocalStore.get('customers') || {};
    const cust = customers[inv.customer_id];

    const text = this.buildReminderText(inv, cust);

    let phone = cust.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone;
    else if (!phone.startsWith('2')) phone = '2' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

    logActivity('reminder_sent_customer', 'debtors', invoiceId, inv.invoice_number, {
      customer: cust.name, phone: cust.phone, method: 'direct'
    });

    window.open(url, '_blank');
    this.closeReminderModal();
    showNotif('📱 جاري فتح واتساب للعميل...', 'info');
  },

  sendReminderToHaj(invoiceId) {
    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    const customers = LocalStore.get('customers') || {};
    const cust = customers[inv.customer_id];
    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;

    const now = Date.now();
    const dueTime = inv.due_date ? new Date(inv.due_date).getTime() : now;
    const daysDiff = Math.floor((dueTime - now) / (1000 * 60 * 60 * 24));
    const daysText = daysDiff === 0 ? 'مستحق اليوم'
                    : daysDiff > 0 ? `مستحق قبل ${daysDiff} يوم`
                    : `متأخر ${Math.abs(daysDiff)} يوم`;

    // احسب إجمالي مديونية العميل
    const totalDebt = CustomersModule.computeCustomerDebt(inv.customer_id).totalDebt;

    // نص المطالبة اللي هيروح للعميل (بعد موافقة الحاج)
    const reminderText = this.buildReminderText(inv, cust);

    // رسالة للحاج فيها كل التفاصيل + نص المطالبة
    const msg = `📱 *طلب موافقة على مطالبة*
━━━━━━━━━━━━━━
👤 من: ${currentUser.name}
━━━━━━━━━━━━━━

📋 *بيانات المطالبة:*
👥 العميل: ${cust.name}
📞 تليفونه: ${cust.phone}
📄 الفاتورة: ${inv.invoice_number}
📅 تاريخ الفاتورة: ${fmtDate(inv.created_at)}
📅 الاستحقاق: ${inv.due_date || '—'}
⏰ الحالة: *${daysText}*

💰 *مبلغ الفاتورة:*
- الإجمالي: ${fmtMoney(inv.grand_total)} ج.م
- المدفوع: ${fmtMoney(inv.paid)} ج.م
- المتبقي: *${fmtMoney(inv.remaining)} ج.م*

💸 إجمالي مديونية العميل: *${fmtMoney(totalDebt)} ج.م*

━━━━━━━━━━━━━━
📝 *نص الرسالة اللي هتروح للعميل:*
━━━━━━━━━━━━━━
${reminderText}
━━━━━━━━━━━━━━

للموافقة، ابعت الرسالة اللي فوق دي لتليفون العميل: ${cust.phone}`;

    let phone = company.owner_phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone;
    else if (!phone.startsWith('2')) phone = '2' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

    // احفظ في queue
    const queue = LocalStore.get('whatsapp_queue') || {};
    const qid = genID('wq_');
    queue[qid] = {
      _id: qid,
      type: 'debt_reminder',
      invoice_id: invoiceId,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id,
      customer_name: cust.name,
      customer_phone: cust.phone,
      message_text: reminderText,
      status: 'pending_approval',
      created_by: currentUser._id,
      created_at: Date.now()
    };
    LocalStore.set('whatsapp_queue', queue);

    logActivity('reminder_sent_haj', 'debtors', invoiceId, inv.invoice_number, {
      customer: cust.name, queue_id: qid
    });

    window.open(url, '_blank');
    this.closeReminderModal();
    showNotif('📱 جاري فتح واتساب للحاج - في انتظار موافقته', 'info', 4000);
  }
};

// ==========================================================
// Add debtors_view permission to default (auto-added on first run)
// ==========================================================
if (typeof DEFAULT_ROLES !== 'undefined') {
  if (DEFAULT_ROLES.accountant && !DEFAULT_ROLES.accountant.permissions.debtors_view) {
    DEFAULT_ROLES.accountant.permissions.debtors_view = true;
  }
  if (DEFAULT_ROLES.salesman && !DEFAULT_ROLES.salesman.permissions.debtors_view) {
    DEFAULT_ROLES.salesman.permissions.debtors_view = true;
  }
}
