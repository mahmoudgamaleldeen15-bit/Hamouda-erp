// ==========================================================
// Reports Module - التقارير الكاملة
// ==========================================================

const ReportsModule = {

  currentReport: null,  // null = home | 'sales' | 'purchases' | 'inventory' | 'debtors' | 'profit'
  filters: {
    dateFrom: null,
    dateTo: null,
    dateRange: 'month', // today | yesterday | week | month | year | custom
    warehouseId: 'all',
    customerId: 'all',
    supplierId: 'all',
    userId: 'all',
    groupBy: 'day'
  },

  render() {
    if (!this.currentReport) return this.renderHome();
    return this.renderReport(this.currentReport);
  },

  // ==========================================================
  // Home: كل التقارير
  // ==========================================================
  renderHome() {
    const container = document.getElementById('moduleContainer');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">📊 التقارير</div>
          <div class="page-subtitle">تحليل شامل لكل جوانب الشركة</div>
        </div>
      </div>

      <div class="grid grid-2" style="gap:16px;">
        ${hasPermission('reports_sales') ? `
          <div class="report-card" onclick="ReportsModule.openReport('sales')">
            <div class="report-icon" style="background:#DBEAFE;">💰</div>
            <div class="report-info">
              <div class="report-title">تقرير المبيعات</div>
              <div class="report-desc">إجماليات، فواتير، أفضل عملاء، أفضل مندوبين</div>
            </div>
            <div class="report-arrow">←</div>
          </div>
        ` : ''}

        ${hasPermission('reports_purchases') ? `
          <div class="report-card" onclick="ReportsModule.openReport('purchases')">
            <div class="report-icon" style="background:#D1FAE5;">🛒</div>
            <div class="report-info">
              <div class="report-title">تقرير المشتريات</div>
              <div class="report-desc">إجماليات المشتريات، أكبر الموردين</div>
            </div>
            <div class="report-arrow">←</div>
          </div>
        ` : ''}

        ${hasPermission('reports_inventory') ? `
          <div class="report-card" onclick="ReportsModule.openReport('inventory')">
            <div class="report-icon" style="background:#FEF3C7;">📦</div>
            <div class="report-info">
              <div class="report-title">تقرير المخزون</div>
              <div class="report-desc">قيمة المخزون، الأصناف قليلة الرصيد، حركة الأصناف</div>
            </div>
            <div class="report-arrow">←</div>
          </div>
        ` : ''}

        ${hasPermission('reports_debtors') ? `
          <div class="report-card" onclick="ReportsModule.openReport('debtors')">
            <div class="report-icon" style="background:#FEE2E2;">🔴</div>
            <div class="report-info">
              <div class="report-title">تقرير المدينين</div>
              <div class="report-desc">كل المستحقات، متأخرات، توزيع بلون المديونية</div>
            </div>
            <div class="report-arrow">←</div>
          </div>
        ` : ''}

        ${hasPermission('reports_profit') ? `
          <div class="report-card" onclick="ReportsModule.openReport('profit')">
            <div class="report-icon" style="background:#EDE9FE;">💎</div>
            <div class="report-info">
              <div class="report-title">تقرير الأرباح</div>
              <div class="report-desc">الأرباح، هامش الربح، أفضل الأصناف ربحاً</div>
            </div>
            <div class="report-arrow">←</div>
          </div>
        ` : ''}
      </div>
    `;
  },

  openReport(type) {
    this.currentReport = type;
    // Reset filters to defaults
    this.filters = {
      dateFrom: null,
      dateTo: null,
      dateRange: 'month',
      warehouseId: 'all',
      customerId: 'all',
      supplierId: 'all',
      userId: 'all',
      groupBy: 'day'
    };
    this.applyDateRange('month');
    this.render();
  },

  backToHome() {
    this.currentReport = null;
    this.render();
  },

  // ==========================================================
  // Date Range Helpers
  // ==========================================================
  applyDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrow = today + 86400000 - 1;

    this.filters.dateRange = range;

    switch (range) {
      case 'today':
        this.filters.dateFrom = today;
        this.filters.dateTo = tomorrow;
        break;
      case 'yesterday':
        this.filters.dateFrom = today - 86400000;
        this.filters.dateTo = today - 1;
        break;
      case 'week':
        this.filters.dateFrom = today - (7 * 86400000);
        this.filters.dateTo = tomorrow;
        break;
      case 'month':
        this.filters.dateFrom = today - (30 * 86400000);
        this.filters.dateTo = tomorrow;
        break;
      case 'year':
        this.filters.dateFrom = today - (365 * 86400000);
        this.filters.dateTo = tomorrow;
        break;
      case 'custom':
        // keep as-is
        break;
    }
  },

  fmtDateInput(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toISOString().slice(0, 10);
  },

  parseDateInput(str, isEnd) {
    if (!str) return null;
    const d = new Date(str);
    if (isEnd) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d.getTime();
  },

  updateDateFilter(field, value) {
    if (field === 'from') this.filters.dateFrom = this.parseDateInput(value, false);
    if (field === 'to') this.filters.dateTo = this.parseDateInput(value, true);
    this.filters.dateRange = 'custom';
    this.render();
  },

  updateFilter(field, value) {
    this.filters[field] = value;
    this.render();
  },

  // ==========================================================
  // Filter Bar (shared across reports)
  // ==========================================================
  renderFilterBar(options = {}) {
    const {
      showWarehouse = true,
      showCustomer = false,
      showSupplier = false,
      showUser = false
    } = options;

    const warehouses = LocalStore.get('warehouses') || {};
    const customers = LocalStore.get('customers') || {};
    const suppliers = LocalStore.get('suppliers') || {};
    const users = LocalStore.get('users') || {};

    return `
      <div class="card" style="margin-bottom: 16px;">
        <!-- Date Range Presets -->
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
          ${['today', 'yesterday', 'week', 'month', 'year'].map(r => {
            const labels = { today: 'اليوم', yesterday: 'أمس', week: 'أسبوع', month: 'شهر', year: 'سنة' };
            return `
              <button class="btn btn-outline btn-sm ${this.filters.dateRange === r ? 'btn-primary' : ''}"
                      onclick="ReportsModule.applyDateRange('${r}'); ReportsModule.render();">
                ${labels[r]}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Filters Grid -->
        <div class="grid grid-4">
          <div class="form-group" style="margin:0;">
            <label>من تاريخ</label>
            <input type="date" value="${this.fmtDateInput(this.filters.dateFrom)}"
                   onchange="ReportsModule.updateDateFilter('from', this.value)">
          </div>
          <div class="form-group" style="margin:0;">
            <label>إلى تاريخ</label>
            <input type="date" value="${this.fmtDateInput(this.filters.dateTo)}"
                   onchange="ReportsModule.updateDateFilter('to', this.value)">
          </div>

          ${showWarehouse ? `
            <div class="form-group" style="margin:0;">
              <label>المخزن</label>
              <select onchange="ReportsModule.updateFilter('warehouseId', this.value)">
                <option value="all">كل المخازن</option>
                ${Object.values(warehouses).map(w =>
                  `<option value="${w._id || w.id}" ${this.filters.warehouseId === (w._id || w.id) ? 'selected' : ''}>${w.name}</option>`
                ).join('')}
              </select>
            </div>
          ` : ''}

          ${showCustomer ? `
            <div class="form-group" style="margin:0;">
              <label>العميل</label>
              <select onchange="ReportsModule.updateFilter('customerId', this.value)">
                <option value="all">كل العملاء</option>
                ${Object.values(customers).map(c =>
                  `<option value="${c._id}" ${this.filters.customerId === c._id ? 'selected' : ''}>${c.name}</option>`
                ).join('')}
              </select>
            </div>
          ` : ''}

          ${showSupplier ? `
            <div class="form-group" style="margin:0;">
              <label>المورد</label>
              <select onchange="ReportsModule.updateFilter('supplierId', this.value)">
                <option value="all">كل الموردين</option>
                ${Object.values(suppliers).map(s =>
                  `<option value="${s._id}" ${this.filters.supplierId === s._id ? 'selected' : ''}>${s.name}</option>`
                ).join('')}
              </select>
            </div>
          ` : ''}

          ${showUser ? `
            <div class="form-group" style="margin:0;">
              <label>البائع</label>
              <select onchange="ReportsModule.updateFilter('userId', this.value)">
                <option value="all">كل البائعين</option>
                ${Object.values(users).filter(u => u.role !== 'admin').map(u =>
                  `<option value="${u._id}" ${this.filters.userId === u._id ? 'selected' : ''}>${u.name}</option>`
                ).join('')}
              </select>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  // ==========================================================
  // Report Actions Bar (Print + Export + WhatsApp)
  // ==========================================================
  renderActionsBar(reportType) {
    return `
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-bottom:16px;" class="no-print">
        <button class="btn btn-outline" onclick="ReportsModule.backToHome()">← رجوع</button>
        <button class="btn btn-outline" onclick="window.print()">🖨️ طباعة</button>
        ${hasPermission('reports_export') ? `
          <button class="btn btn-outline" onclick="ReportsModule.exportCSV('${reportType}')">📥 Excel</button>
        ` : ''}
        <button class="btn btn-gold" onclick="ReportsModule.sendReportToHaj('${reportType}')">
          📱 للحاج
        </button>
      </div>
    `;
  },

  // ==========================================================
  // Report Router
  // ==========================================================
  renderReport(type) {
    switch (type) {
      case 'sales': return this.renderSalesReport();
      case 'purchases': return this.renderPurchasesReport();
      case 'inventory': return this.renderInventoryReport();
      case 'debtors': return this.renderDebtorsReport();
      case 'profit': return this.renderProfitReport();
      default: return this.renderHome();
    }
  },

  // ==========================================================
  // 1. تقرير المبيعات
  // ==========================================================
  getSalesData() {
    const invoices = Object.values(LocalStore.get('sales_invoices') || {})
      .filter(inv => {
        if (inv.status === 'cancelled') return false;
        if (this.filters.dateFrom && inv.created_at < this.filters.dateFrom) return false;
        if (this.filters.dateTo && inv.created_at > this.filters.dateTo) return false;
        if (this.filters.warehouseId !== 'all' && inv.warehouse_id !== this.filters.warehouseId) return false;
        if (this.filters.customerId !== 'all' && inv.customer_id !== this.filters.customerId) return false;
        if (this.filters.userId !== 'all' && inv.created_by !== this.filters.userId) return false;
        return true;
      })
      .sort((a, b) => b.created_at - a.created_at);

    return invoices;
  },

  renderSalesReport() {
    const container = document.getElementById('moduleContainer');
    const invoices = this.getSalesData();
    const customers = LocalStore.get('customers') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const users = LocalStore.get('users') || {};
    const showProfit = hasPermission('reports_profit');

    // Totals
    const total = invoices.reduce((sum, i) => sum + getInvoiceNet(i, 'sales').netTotal, 0);
    const totalPaid = invoices.reduce((sum, i) => sum + i.paid, 0);
    const totalRemaining = invoices.reduce((sum, i) => sum + i.remaining, 0);
    const totalProfit = showProfit ? invoices.reduce((sum, i) => sum + (i.total_profit || 0), 0) : 0;
    const avgInvoice = invoices.length > 0 ? total / invoices.length : 0;

    // Top customers
    const byCustomer = {};
    invoices.forEach(inv => {
      const cid = inv.customer_id;
      if (!byCustomer[cid]) byCustomer[cid] = { total: 0, count: 0 };
      byCustomer[cid].total += getInvoiceNet(inv, 'sales').netTotal;
      byCustomer[cid].count++;
    });
    const topCustomers = Object.entries(byCustomer)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    // Top sellers
    const bySeller = {};
    invoices.forEach(inv => {
      const uid = inv.created_by;
      if (!bySeller[uid]) bySeller[uid] = { total: 0, count: 0, name: inv.created_by_name };
      bySeller[uid].total += getInvoiceNet(inv, 'sales').netTotal;
      bySeller[uid].count++;
    });
    const topSellers = Object.entries(bySeller)
      .sort((a, b) => b[1].total - a[1].total);

    container.innerHTML = `
      ${this.renderActionsBar('sales')}

      <div class="page-header no-print">
        <div>
          <div class="page-title">💰 تقرير المبيعات</div>
          <div class="page-subtitle">
            من ${fmtDate(this.filters.dateFrom)} إلى ${fmtDate(this.filters.dateTo)}
          </div>
        </div>
      </div>

      ${this.renderFilterBar({ showWarehouse: true, showCustomer: true, showUser: true })}

      <!-- Print Header -->
      <div class="report-print-header" style="display:none;">
        ${this.renderPrintHeader('💰 تقرير المبيعات')}
      </div>

      <!-- Summary -->
      <div class="grid grid-${showProfit ? '4' : '3'}" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">📄 عدد الفواتير</div>
          <div class="stat-value">${invoices.length}</div>
          <div class="stat-change">متوسط: ${fmtMoney(avgInvoice)} ج.م</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">💰 إجمالي المبيعات</div>
          <div class="stat-value">${fmtMoney(total)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">🔴 المتبقي (آجل)</div>
          <div class="stat-value">${fmtMoney(totalRemaining)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${totalPaid > 0 ? Math.round((totalPaid / total) * 100) + '% محصل' : '—'}</div>
        </div>
        ${showProfit ? `
          <div class="stat-card stat-gold">
            <div class="stat-label">💎 الأرباح</div>
            <div class="stat-value">${fmtMoney(totalProfit)} <span class="stat-currency">ج.م</span></div>
            <div class="stat-change">${total > 0 ? Math.round((totalProfit / total) * 100) + '% هامش' : '—'}</div>
          </div>
        ` : ''}
      </div>

      <!-- Top Customers & Sellers -->
      <div class="grid grid-2" style="margin-bottom: 16px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">🏆 أفضل العملاء</div>
          </div>
          <div style="display:grid; gap:6px;">
            ${topCustomers.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--gray-500);">لا بيانات</div>' :
              topCustomers.map(([cid, data], i) => {
                const c = customers[cid] || { name: '—' };
                return `
                  <div style="display:flex; justify-content:space-between; padding:8px 12px; background:${i === 0 ? '#FEF3C7' : 'var(--gray-50)'}; border-radius:var(--radius);">
                    <div>
                      <span style="font-weight:700; color:var(--gray-500);">#${i+1}</span>
                      <span style="margin-right:8px;">${c.name}</span>
                      <small style="color:var(--gray-500);">(${data.count} فاتورة)</small>
                    </div>
                    <strong style="color:var(--grape-700);">${fmtMoney(data.total)} ج.م</strong>
                  </div>
                `;
              }).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">🏅 أفضل البائعين</div>
          </div>
          <div style="display:grid; gap:6px;">
            ${topSellers.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--gray-500);">لا بيانات</div>' :
              topSellers.map(([uid, data], i) => `
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:${i === 0 ? '#FEF3C7' : 'var(--gray-50)'}; border-radius:var(--radius);">
                  <div>
                    <span style="font-weight:700; color:var(--gray-500);">#${i+1}</span>
                    <span style="margin-right:8px;">${data.name || '—'}</span>
                    <small style="color:var(--gray-500);">(${data.count} فاتورة)</small>
                  </div>
                  <strong style="color:var(--grape-700);">${fmtMoney(data.total)} ج.م</strong>
                </div>
              `).join('')}
          </div>
        </div>
      </div>

      <!-- Detailed Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📄 تفاصيل الفواتير (${invoices.length})</div>
        </div>
        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>العميل</th>
                <th>المخزن</th>
                <th>البائع</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                ${showProfit ? '<th>الربح</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${invoices.length === 0 ? `
                <tr><td colspan="${showProfit ? 9 : 8}" style="text-align:center; padding:30px; color:var(--gray-500);">لا يوجد فواتير في هذه الفترة</td></tr>
              ` : invoices.slice(0, 100).map(inv => {
                const cust = customers[inv.customer_id] || { name: inv.customer_name_snapshot };
                const wh = warehouses[inv.warehouse_id] || { name: '—' };
                return `
                  <tr onclick="SalesModule.viewInvoice('${inv._id}')" style="cursor:pointer;">
                    <td><strong>${inv.invoice_number}</strong></td>
                    <td>${fmtDate(inv.created_at)}</td>
                    <td>${cust.name}</td>
                    <td>${wh.name}</td>
                    <td>${inv.created_by_name || '—'}</td>
                    <td>${(() => {
                      const _n = getInvoiceNet(inv, 'sales');
                      return _n.hasReturns
                        ? `<div style="text-decoration:line-through; color:#9CA3AF; font-size:11px;">${fmtMoney(_n.originalTotal)}</div><strong>${fmtMoney(_n.netTotal)}</strong>`
                        : `${fmtMoney(_n.originalTotal)}`;
                    })()} ج.م</td>
                    <td>${fmtMoney(inv.paid)} ج.م</td>
                    <td class="${getInvoiceNet(inv, 'sales').remaining > 0 ? 'negative' : 'positive'}">${fmtMoney(getInvoiceNet(inv, 'sales').remaining)} ج.م</td>
                    ${showProfit ? `<td class="${(inv.total_profit || 0) >= 0 ? 'positive' : 'negative'}">${fmtMoney(inv.total_profit || 0)} ج.م</td>` : ''}
                  </tr>
                `;
              }).join('')}
              ${invoices.length > 100 ? `
                <tr><td colspan="${showProfit ? 9 : 8}" style="text-align:center; padding:16px; color:var(--gray-500);">
                  عرض أول 100 فاتورة — ${invoices.length - 100} أخرى في الملف المصدر
                </td></tr>
              ` : ''}
            </tbody>
            ${invoices.length > 0 ? `
              <tfoot>
                <tr style="background:var(--grape-50); font-weight:700;">
                  <td colspan="5">الإجماليات:</td>
                  <td>${fmtMoney(total)} ج.م</td>
                  <td>${fmtMoney(totalPaid)} ج.م</td>
                  <td>${fmtMoney(totalRemaining)} ج.م</td>
                  ${showProfit ? `<td>${fmtMoney(totalProfit)} ج.م</td>` : ''}
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================================
  // 2. تقرير المشتريات
  // ==========================================================
  getPurchasesData() {
    return Object.values(LocalStore.get('purchase_invoices') || {})
      .filter(inv => {
        if (inv.status === 'cancelled') return false;
        if (this.filters.dateFrom && inv.created_at < this.filters.dateFrom) return false;
        if (this.filters.dateTo && inv.created_at > this.filters.dateTo) return false;
        if (this.filters.warehouseId !== 'all' && inv.warehouse_id !== this.filters.warehouseId) return false;
        if (this.filters.supplierId !== 'all' && inv.supplier_id !== this.filters.supplierId) return false;
        return true;
      })
      .sort((a, b) => b.created_at - a.created_at);
  },

  renderPurchasesReport() {
    const container = document.getElementById('moduleContainer');
    const invoices = this.getPurchasesData();
    const suppliers = LocalStore.get('suppliers') || {};
    const warehouses = LocalStore.get('warehouses') || {};

    const total = invoices.reduce((sum, i) => sum + getInvoiceNet(i, 'purchase').netTotal, 0);
    const totalPaid = invoices.reduce((sum, i) => sum + i.paid, 0);
    const totalRemaining = invoices.reduce((sum, i) => sum + i.remaining, 0);
    const avgInvoice = invoices.length > 0 ? total / invoices.length : 0;

    // Top suppliers
    const bySupplier = {};
    invoices.forEach(inv => {
      const sid = inv.supplier_id;
      if (!bySupplier[sid]) bySupplier[sid] = { total: 0, count: 0 };
      bySupplier[sid].total += getInvoiceNet(inv, 'purchase').netTotal;
      bySupplier[sid].count++;
    });
    const topSuppliers = Object.entries(bySupplier)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    container.innerHTML = `
      ${this.renderActionsBar('purchases')}

      <div class="page-header no-print">
        <div>
          <div class="page-title">🛒 تقرير المشتريات</div>
          <div class="page-subtitle">من ${fmtDate(this.filters.dateFrom)} إلى ${fmtDate(this.filters.dateTo)}</div>
        </div>
      </div>

      ${this.renderFilterBar({ showWarehouse: true, showSupplier: true })}

      <div class="report-print-header" style="display:none;">
        ${this.renderPrintHeader('🛒 تقرير المشتريات')}
      </div>

      <!-- Summary -->
      <div class="grid grid-3" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">📄 عدد الفواتير</div>
          <div class="stat-value">${invoices.length}</div>
          <div class="stat-change">متوسط: ${fmtMoney(avgInvoice)} ج.م</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">🛒 إجمالي المشتريات</div>
          <div class="stat-value">${fmtMoney(total)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">💸 المستحق للموردين</div>
          <div class="stat-value">${fmtMoney(totalRemaining)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${totalPaid > 0 ? Math.round((totalPaid / total) * 100) + '% مدفوع' : '—'}</div>
        </div>
      </div>

      <!-- Top Suppliers -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">🏆 أكبر الموردين</div>
        </div>
        <div style="display:grid; gap:6px;">
          ${topSuppliers.length === 0 ? '<div style="text-align:center; padding:20px; color:var(--gray-500);">لا بيانات</div>' :
            topSuppliers.map(([sid, data], i) => {
              const s = suppliers[sid] || { name: '—' };
              return `
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:${i === 0 ? '#FEF3C7' : 'var(--gray-50)'}; border-radius:var(--radius);">
                  <div>
                    <span style="font-weight:700; color:var(--gray-500);">#${i+1}</span>
                    <span style="margin-right:8px;">${s.name}</span>
                    <small style="color:var(--gray-500);">(${data.count} فاتورة)</small>
                  </div>
                  <strong style="color:var(--grape-700);">${fmtMoney(data.total)} ج.م</strong>
                </div>
              `;
            }).join('')}
        </div>
      </div>

      <!-- Detailed Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📄 تفاصيل الفواتير (${invoices.length})</div>
        </div>
        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>المورد</th>
                <th>المخزن</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding:30px; color:var(--gray-500);">لا يوجد فواتير</td></tr>
              ` : invoices.slice(0, 100).map(inv => {
                const sup = suppliers[inv.supplier_id] || { name: inv.supplier_name_snapshot };
                const wh = warehouses[inv.warehouse_id] || { name: '—' };
                return `
                  <tr onclick="PurchasesModule.viewInvoice('${inv._id}')" style="cursor:pointer;">
                    <td><strong>${inv.invoice_number}</strong></td>
                    <td>${fmtDate(inv.created_at)}</td>
                    <td>${sup.name}</td>
                    <td>${wh.name}</td>
                    <td>${(() => {
                      const _n = getInvoiceNet(inv, 'purchase');
                      return _n.hasReturns
                        ? `<div style="text-decoration:line-through; color:#9CA3AF; font-size:11px;">${fmtMoney(_n.originalTotal)}</div><strong>${fmtMoney(_n.netTotal)}</strong>`
                        : `${fmtMoney(_n.originalTotal)}`;
                    })()} ج.م</td>
                    <td>${fmtMoney(inv.paid)} ج.م</td>
                    <td class="${getInvoiceNet(inv, 'purchase').remaining > 0 ? 'negative' : 'positive'}">${fmtMoney(getInvoiceNet(inv, 'purchase').remaining)} ج.م</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            ${invoices.length > 0 ? `
              <tfoot>
                <tr style="background:var(--grape-50); font-weight:700;">
                  <td colspan="4">الإجماليات:</td>
                  <td>${fmtMoney(total)} ج.م</td>
                  <td>${fmtMoney(totalPaid)} ج.م</td>
                  <td>${fmtMoney(totalRemaining)} ج.م</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================================
  // 3. تقرير المخزون
  // ==========================================================
  renderInventoryReport() {
    const container = document.getElementById('moduleContainer');
    const products = Object.values(LocalStore.get('products') || {}).filter(p => p.active !== false);
    const warehouses = LocalStore.get('warehouses') || {};

    // اجمع بيانات المخزون
    // ✅ فصل المخازن: قائمة الأصناف اللي لها transactions في كل مخزن
    const txns = Object.values(LocalStore.get('inventory_txns') || {});
    const productsPerWarehouse = {};
    txns.forEach(t => {
      if (!productsPerWarehouse[t.warehouse_id]) productsPerWarehouse[t.warehouse_id] = new Set();
      productsPerWarehouse[t.warehouse_id].add(t.product_id);
    });

    let allStocks = [];
    Object.keys(warehouses).forEach(whId => {
      if (this.filters.warehouseId !== 'all' && whId !== this.filters.warehouseId) return;
      const wh = warehouses[whId];
      const inv = TxnEngine.getWarehouseInventory(whId);
      const productsInHere = productsPerWarehouse[whId] || new Set();
      inv.forEach(item => {
        const p = products.find(pr => pr._id === item.product_id);
        if (!p) return;
        // ✅ اعرض بس لو الصنف عليه حركة في المخزن ده
        if (!productsInHere.has(item.product_id)) return;
        allStocks.push({
          product: p,
          warehouse: wh,
          current_stock: item.current_stock,
          average_cost: item.average_cost || 0,
          stock_value: item.stock_value,
          min_stock: p.min_stock || 0,
          is_low: item.current_stock <= (p.min_stock || 0)
        });
      });
    });

    // ترتيب بالقيمة
    allStocks.sort((a, b) => b.stock_value - a.stock_value);

    const totalValue = allStocks.reduce((sum, s) => sum + s.stock_value, 0);
    const totalQty = allStocks.reduce((sum, s) => sum + s.current_stock, 0);
    const lowStock = allStocks.filter(s => s.is_low).length;
    const outOfStock = allStocks.filter(s => s.current_stock <= 0).length;

    container.innerHTML = `
      ${this.renderActionsBar('inventory')}

      <div class="page-header no-print">
        <div>
          <div class="page-title">📦 تقرير المخزون</div>
          <div class="page-subtitle">لحظة عرض التقرير: ${fmtDateTime(Date.now())}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 16px;">
        <div class="grid grid-2">
          <div class="form-group" style="margin:0;">
            <label>المخزن</label>
            <select onchange="ReportsModule.updateFilter('warehouseId', this.value)">
              <option value="all">كل المخازن</option>
              ${Object.values(warehouses).map(w =>
                `<option value="${w._id || w.id}" ${this.filters.warehouseId === (w._id || w.id) ? 'selected' : ''}>${w.name}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="report-print-header" style="display:none;">
        ${this.renderPrintHeader('📦 تقرير المخزون')}
      </div>

      <!-- Summary -->
      <div class="grid grid-4" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">📦 عدد الأصناف</div>
          <div class="stat-value">${allStocks.length}</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">📊 عدد السجلات</div>
          <div class="stat-value">${allStocks.length}</div>
          <div class="stat-change">كل صنف بوحدته</div>
        </div>
        <div class="stat-card stat-gold">
          <div class="stat-label">💎 قيمة المخزون</div>
          <div class="stat-value">${fmtMoney(totalValue)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">⚠️ رصيد منخفض</div>
          <div class="stat-value">${lowStock}</div>
          <div class="stat-change">نفذ: ${outOfStock}</div>
        </div>
      </div>

      <!-- Low Stock Alert -->
      ${lowStock > 0 ? `
        <div class="card" style="background:#FEF3C7; border:1px solid #FCD34D; margin-bottom:16px;">
          <div class="card-header">
            <div class="card-title" style="color:#92400E;">⚠️ تنبيه: أصناف تحتاج شراء</div>
          </div>
          <div style="display:grid; gap:6px;">
            ${allStocks.filter(s => s.is_low).slice(0, 5).map(s => {
              const unitName = getProductUnitName(s.product);
              return `
              <div style="display:flex; justify-content:space-between; padding:8px 12px; background:white; border-radius:var(--radius);">
                <div>
                  <strong>${s.product.name}</strong>
                  <small style="color:var(--gray-500); margin-right:8px;">في ${s.warehouse.name}</small>
                </div>
                <div>
                  <span style="color:var(--danger); font-weight:700;">${fmtMoney(s.current_stock)} ${unitName}</span>
                  <small style="color:var(--gray-500);"> / الحد الأدنى: ${fmtMoney(s.min_stock)} ${unitName}</small>
                </div>
              </div>
            `;}).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 تفاصيل الأصناف (${allStocks.length})</div>
        </div>
        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الكود</th>
                <th>المخزن</th>
                <th>الرصيد الحالي</th>
                <th>الحد الأدنى</th>
                <th>متوسط التكلفة</th>
                <th>قيمة المخزون</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${allStocks.length === 0 ? `
                <tr><td colspan="8" style="text-align:center; padding:30px; color:var(--gray-500);">لا بيانات</td></tr>
              ` : allStocks.slice(0, 200).map(s => {
                const unitName = getProductUnitName(s.product);
                return `
                <tr onclick="ProductsModule.viewMovement('${s.product._id}')" style="cursor:pointer;">
                  <td><strong>${s.product.name}</strong></td>
                  <td>${s.product.sku || '—'}</td>
                  <td>${s.warehouse.name}</td>
                  <td class="${s.is_low ? 'negative' : ''}"><strong>${fmtMoney(s.current_stock)}</strong> ${unitName}</td>
                  <td>${fmtMoney(s.min_stock)} ${unitName}</td>
                  <td>${fmtMoney(s.average_cost)} ج.م</td>
                  <td><strong>${fmtMoney(s.stock_value)}</strong> ج.م</td>
                  <td>
                    ${s.current_stock <= 0
                      ? '<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;">🔴 نفذ</span>'
                      : s.is_low
                      ? '<span class="txn-badge" style="background:#FEF3C7;color:#92400E;">⚠️ منخفض</span>'
                      : '<span class="txn-badge" style="background:#D1FAE5;color:#065F46;">✅ متاح</span>'
                    }
                  </td>
                </tr>
              `;}).join('')}
            </tbody>
            ${allStocks.length > 0 ? `
              <tfoot>
                <tr style="background:var(--grape-50); font-weight:700;">
                  <td colspan="6">إجمالي القيمة:</td>
                  <td>${fmtMoney(totalValue)} ج.م</td>
                  <td></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================================
  // 4. تقرير المدينين
  // ==========================================================
  renderDebtorsReport() {
    const container = document.getElementById('moduleContainer');
    const outstanding = DebtorsModule.getOutstandingInvoices();

    // Group by color
    const byColor = { blue: [], yellow: [], orange: [], 'red-light': [], 'red-dark': [], 'purple-flash': [] };
    outstanding.forEach(inv => {
      if (inv._debt_color) byColor[inv._debt_color].push(inv);
    });

    // Group by customer
    const byCustomer = {};
    outstanding.forEach(inv => {
      const cid = inv.customer_id;
      if (!byCustomer[cid]) byCustomer[cid] = { total: 0, count: 0, name: inv._customer.name, invoices: [] };
      byCustomer[cid].total += inv.remaining;
      byCustomer[cid].count++;
      byCustomer[cid].invoices.push(inv);
    });
    const customersList = Object.entries(byCustomer)
      .sort((a, b) => b[1].total - a[1].total);

    const totalDebt = outstanding.reduce((sum, i) => sum + i.remaining, 0);
    const overdueTotal = [...byColor['red-dark'], ...byColor['purple-flash']].reduce((sum, i) => sum + i.remaining, 0);
    const criticalTotal = byColor['purple-flash'].reduce((sum, i) => sum + i.remaining, 0);

    container.innerHTML = `
      ${this.renderActionsBar('debtors')}

      <div class="page-header no-print">
        <div>
          <div class="page-title">🔴 تقرير المدينين</div>
          <div class="page-subtitle">لحظة عرض التقرير: ${fmtDateTime(Date.now())}</div>
        </div>
      </div>

      <div class="report-print-header" style="display:none;">
        ${this.renderPrintHeader('🔴 تقرير المدينين')}
      </div>

      <!-- Summary -->
      <div class="grid grid-4" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">📄 فواتير مستحقة</div>
          <div class="stat-value">${outstanding.length}</div>
        </div>
        <div class="stat-card stat-gold">
          <div class="stat-label">💰 إجمالي المستحق</div>
          <div class="stat-value">${fmtMoney(totalDebt)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">⚠️ متأخر</div>
          <div class="stat-value">${fmtMoney(overdueTotal)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${byColor['red-dark'].length + byColor['purple-flash'].length} فاتورة</div>
        </div>
        <div class="stat-card" style="background:#F5F3FF; border-right-color:#7C3AED;">
          <div class="stat-label">🟣 حرج (>30 يوم)</div>
          <div class="stat-value">${fmtMoney(criticalTotal)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${byColor['purple-flash'].length} فاتورة</div>
        </div>
      </div>

      <!-- Distribution -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">📊 توزيع المديونية بالحالة</div>
        </div>
        <div class="grid grid-3">
          ${['blue', 'yellow', 'orange', 'red-light', 'red-dark', 'purple-flash'].map(color => {
            const info = DebtorsModule.getDebtColorInfo(color);
            const items = byColor[color];
            const total = items.reduce((sum, i) => sum + i.remaining, 0);
            return `
              <div style="padding:12px; background:white; border-right:4px solid ${info.hex}; border-radius:var(--radius); border:1px solid var(--gray-200);">
                <div style="font-weight:700; color:${info.hex};">${info.icon} ${info.label}</div>
                <div style="font-size:20px; font-weight:800; margin-top:4px;">${fmtMoney(total)} ج.م</div>
                <div style="font-size:12px; color:var(--gray-500);">${items.length} فاتورة</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- By Customer -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">👥 العملاء المدينين (${customersList.length})</div>
        </div>
        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>العميل</th>
                <th>عدد الفواتير</th>
                <th>إجمالي المديونية</th>
                <th>أقدم فاتورة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${customersList.length === 0 ? `
                <tr><td colspan="5" style="text-align:center; padding:30px; color:var(--leaf-700);">🎉 مفيش مدينين!</td></tr>
              ` : customersList.map(([cid, data]) => {
                const oldestInv = data.invoices.reduce((oldest, i) =>
                  !oldest || i.created_at < oldest.created_at ? i : oldest, null);
                const worstColor = ['purple-flash', 'red-dark', 'red-light', 'orange', 'yellow', 'blue']
                  .find(c => data.invoices.some(i => i._debt_color === c));
                const info = DebtorsModule.getDebtColorInfo(worstColor || 'blue');
                return `
                  <tr onclick="DebtorsModule.viewCustomer('${cid}'); switchModule('debtors');" style="cursor:pointer;">
                    <td><strong>${data.name}</strong></td>
                    <td>${data.count}</td>
                    <td><strong style="color:var(--danger);">${fmtMoney(data.total)}</strong> ج.م</td>
                    <td>${fmtDate(oldestInv.created_at)}</td>
                    <td><span class="debt-chip debt-${worstColor}">${info.icon} ${info.label}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================================
  // 5. تقرير الأرباح
  // ==========================================================
  renderProfitReport() {
    const container = document.getElementById('moduleContainer');
    const invoices = this.getSalesData();
    const products = LocalStore.get('products') || {};
    const customers = LocalStore.get('customers') || {};

    const totalSales = invoices.reduce((sum, i) => sum + getInvoiceNet(i, 'sales').netTotal, 0);
    const totalProfit = invoices.reduce((sum, i) => sum + (i.total_profit || 0), 0);
    const totalCost = totalSales - totalProfit;
    const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    // Group by product
    const byProduct = {};
    invoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const pid = item.product_id;
        if (!byProduct[pid]) byProduct[pid] = {
          product_id: pid,
          name: item.product_name_snapshot,
          qty: 0, revenue: 0, cost: 0, profit: 0
        };
        byProduct[pid].qty += item.qty || 0;
        byProduct[pid].revenue += item.total || 0;
        const cost = (item.unit_cost_snapshot || 0) * (item.qty || 0);
        byProduct[pid].cost += cost;
        byProduct[pid].profit += (item.profit || (item.total - cost));
      });
    });
    const topProducts = Object.values(byProduct)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 20);

    container.innerHTML = `
      ${this.renderActionsBar('profit')}

      <div class="page-header no-print">
        <div>
          <div class="page-title">💎 تقرير الأرباح</div>
          <div class="page-subtitle">من ${fmtDate(this.filters.dateFrom)} إلى ${fmtDate(this.filters.dateTo)}</div>
        </div>
      </div>

      ${this.renderFilterBar({ showWarehouse: true, showCustomer: true, showUser: true })}

      <div class="report-print-header" style="display:none;">
        ${this.renderPrintHeader('💎 تقرير الأرباح')}
      </div>

      <!-- Summary -->
      <div class="grid grid-4" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">💰 إجمالي المبيعات</div>
          <div class="stat-value">${fmtMoney(totalSales)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">📉 إجمالي التكلفة</div>
          <div class="stat-value">${fmtMoney(totalCost)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-gold">
          <div class="stat-label">💎 صافي الأرباح</div>
          <div class="stat-value">${fmtMoney(totalProfit)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">📊 هامش الربح</div>
          <div class="stat-value">${margin.toFixed(1)}<span class="stat-currency">%</span></div>
        </div>
      </div>

      <!-- Top Products -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏆 أفضل الأصناف ربحاً</div>
        </div>
        <div class="table-container" style="box-shadow:none; border:none;">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>الصنف</th>
                <th>الكميات المباعة</th>
                <th>الإيرادات</th>
                <th>التكلفة</th>
                <th>الربح</th>
                <th>الهامش</th>
              </tr>
            </thead>
            <tbody>
              ${topProducts.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding:30px; color:var(--gray-500);">لا بيانات</td></tr>
              ` : topProducts.map((p, i) => {
                const productMargin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                return `
                  <tr>
                    <td><strong style="color:${i < 3 ? 'var(--gold-600)' : 'var(--gray-500)'};">#${i + 1}</strong></td>
                    <td><strong>${p.name}</strong></td>
                    <td>${fmtMoney(p.qty)} ${getProductUnitName(p.product_id) || "كجم"}</td>
                    <td>${fmtMoney(p.revenue)} ج.م</td>
                    <td>${fmtMoney(p.cost)} ج.م</td>
                    <td><strong style="color:var(--leaf-700);">${fmtMoney(p.profit)}</strong> ج.م</td>
                    <td>${productMargin.toFixed(1)}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ==========================================================
  // Print Header
  // ==========================================================
  renderPrintHeader(title) {
    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-bottom:2px solid var(--grape-600); margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="assets/logo.png" style="width:60px; height:60px;">
          <div>
            <div style="font-size:18px; font-weight:800; color:var(--grape-800);">${company.name}</div>
            <div style="font-size:12px; color:var(--gray-600);">${company.owner_phone}</div>
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:16px; font-weight:800;">${title}</div>
          <div style="font-size:12px; color:var(--gray-600);">
            ${this.filters.dateFrom ? 'من ' + fmtDate(this.filters.dateFrom) + ' إلى ' + fmtDate(this.filters.dateTo) : ''}
          </div>
          <div style="font-size:11px; color:var(--gray-500);">تم التوليد: ${fmtDateTime(Date.now())}</div>
        </div>
      </div>
    `;
  },

  // ==========================================================
  // Export CSV
  // ==========================================================
  exportCSV(reportType) {
    if (!hasPermission('reports_export')) {
      return showNotif('❌ ما عندكش صلاحية التصدير', 'danger');
    }

    let csv = '';
    let filename = 'report';
    const BOM = '\uFEFF'; // للعربي في Excel

    if (reportType === 'sales') {
      const invoices = this.getSalesData();
      const customers = LocalStore.get('customers') || {};
      const warehouses = LocalStore.get('warehouses') || {};
      csv = 'رقم الفاتورة,التاريخ,العميل,المخزن,البائع,الإجمالي الأصلي,المرتجعات,الصافي,المدفوع,المتبقي,الربح\n';
      invoices.forEach(inv => {
        const cust = customers[inv.customer_id] || { name: inv.customer_name_snapshot };
        const wh = warehouses[inv.warehouse_id] || { name: '—' };
        const net = getInvoiceNet(inv, 'sales');
        csv += `"${inv.invoice_number}","${fmtDate(inv.created_at)}","${cust.name}","${wh.name}","${inv.created_by_name || ''}",${net.originalTotal},${net.totalReturned},${net.netTotal},${net.paid},${net.remaining},${inv.total_profit || 0}\n`;
      });
      filename = 'sales_report';
    }
    else if (reportType === 'purchases') {
      const invoices = this.getPurchasesData();
      const suppliers = LocalStore.get('suppliers') || {};
      const warehouses = LocalStore.get('warehouses') || {};
      csv = 'رقم الفاتورة,التاريخ,المورد,المخزن,الإجمالي الأصلي,المرتجعات,الصافي,المدفوع,المتبقي\n';
      invoices.forEach(inv => {
        const sup = suppliers[inv.supplier_id] || { name: inv.supplier_name_snapshot };
        const wh = warehouses[inv.warehouse_id] || { name: '—' };
        const net = getInvoiceNet(inv, 'purchase');
        csv += `"${inv.invoice_number}","${fmtDate(inv.created_at)}","${sup.name}","${wh.name}",${net.originalTotal},${net.totalReturned},${net.netTotal},${net.paid},${net.remaining}\n`;
      });
      filename = 'purchases_report';
    }
    else if (reportType === 'inventory') {
      const products = LocalStore.get('products') || {};
      const warehouses = LocalStore.get('warehouses') || {};
      csv = 'الصنف,الكود,المخزن,الرصيد,الوحدة,متوسط التكلفة,قيمة المخزون\n';
      Object.keys(warehouses).forEach(whId => {
        if (this.filters.warehouseId !== 'all' && whId !== this.filters.warehouseId) return;
        const wh = warehouses[whId];
        const inv = TxnEngine.getWarehouseInventory(whId);
        inv.forEach(item => {
          const p = products[item.product_id];
          if (!p) return;
          const unitName = getProductUnitName(p) || 'كجم';
          csv += `"${p.name}","${p.sku || ''}","${wh.name}",${item.current_stock},"${unitName}",${item.average_cost || 0},${item.stock_value}\n`;
        });
      });
      filename = 'inventory_report';
    }
    else if (reportType === 'debtors') {
      const outstanding = DebtorsModule.getOutstandingInvoices();
      csv = 'رقم الفاتورة,العميل,التليفون,تاريخ الفاتورة,الاستحقاق,الإجمالي,المدفوع,المتبقي,الحالة\n';
      outstanding.forEach(inv => {
        const info = DebtorsModule.getDebtColorInfo(inv._debt_color);
        csv += `"${inv.invoice_number}","${inv._customer.name}","${inv._customer.phone || ''}","${fmtDate(inv.created_at)}","${inv.due_date || ''}",${inv.grand_total},${inv.paid},${inv.remaining},"${info.label}"\n`;
      });
      filename = 'debtors_report';
    }
    else if (reportType === 'profit') {
      const invoices = this.getSalesData();
      csv = 'الصنف,الكمية,الوحدة,الإيرادات,التكلفة,الربح,الهامش\n';
      const byProduct = {};
      invoices.forEach(inv => {
        (inv.items || []).forEach(item => {
          const pid = item.product_id;
          if (!byProduct[pid]) byProduct[pid] = { product_id: pid, name: item.product_name_snapshot, qty: 0, revenue: 0, cost: 0, profit: 0 };
          byProduct[pid].qty += item.qty || 0;
          byProduct[pid].revenue += item.total || 0;
          const cost = (item.unit_cost_snapshot || 0) * (item.qty || 0);
          byProduct[pid].cost += cost;
          byProduct[pid].profit += (item.profit || (item.total - cost));
        });
      });
      Object.values(byProduct).sort((a, b) => b.profit - a.profit).forEach(p => {
        const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
        const unitName = getProductUnitName(p.product_id) || 'كجم';
        csv += `"${p.name}",${p.qty},"${unitName}",${p.revenue},${p.cost},${p.profit},${margin.toFixed(2)}%\n`;
      });
      filename = 'profit_report';
    }

    // Download
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '_' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logActivity('export_report', 'reports', reportType, filename);
    showNotif('✅ تم تنزيل الملف', 'success');
  },

  // ==========================================================
  // Send Report to Haj (WhatsApp)
  // ==========================================================
  sendReportToHaj(reportType) {
    // 🔔 تشخيص فوري - يثبت إن الزر بيضغط
    console.log('📱 sendReportToHaj called with:', reportType);

    try {
      const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;

      // ✅ فحص التليفون
      const phoneRaw = company.owner_phone;
      if (!phoneRaw || String(phoneRaw).trim().length < 5) {
        return showNotif('❌ تليفون الحاج مش مضبوط - سجله من الإعدادات → 🏢 بيانات الشركة', 'danger', 5000);
      }

      const from = this.filters?.dateFrom ? fmtDate(this.filters.dateFrom) : '—';
      const to = this.filters?.dateTo ? fmtDate(this.filters.dateTo) : '—';

      let msg = '';

      // ========== SALES ==========
      if (reportType === 'sales') {
        try {
          const invoices = this.getSalesData();
          const total = invoices.reduce((sum, i) => sum + getInvoiceNet(i, i._is_purchase ? 'purchase' : 'sales').netTotal, 0);
          const totalPaid = invoices.reduce((sum, i) => sum + (i.paid || 0), 0);
          const totalRemaining = invoices.reduce((sum, i) => sum + (i.remaining || 0), 0);
          const totalProfit = invoices.reduce((sum, i) => sum + (i.total_profit || 0), 0);
          const marginPct = total > 0 ? ((totalProfit/total)*100).toFixed(1) : 0;

          msg = `📊 *تقرير المبيعات*\n━━━━━━━━━━━━━━\n📅 من ${from} إلى ${to}\n━━━━━━━━━━━━━━\n\n📄 عدد الفواتير: *${invoices.length}*\n💰 إجمالي المبيعات: *${fmtMoney(total)} ج.م*\n✅ محصل: ${fmtMoney(totalPaid)} ج.م\n🔴 آجل: ${fmtMoney(totalRemaining)} ج.م\n💎 الأرباح: *${fmtMoney(totalProfit)} ج.م*\n📈 هامش الربح: ${marginPct}%\n\n━━━━━━━━━━━━━━\n👤 من: ${currentUser.name}\n⏰ ${fmtDateTime(Date.now())}`;
        } catch(e) { console.error('sales msg err:', e); }
      }
      // ========== PURCHASES ==========
      else if (reportType === 'purchases') {
        try {
          const invoices = this.getPurchasesData();
          const total = invoices.reduce((sum, i) => sum + getInvoiceNet(i, i._is_purchase ? 'purchase' : 'sales').netTotal, 0);
          const totalPaid = invoices.reduce((sum, i) => sum + (i.paid || 0), 0);
          const totalRemaining = invoices.reduce((sum, i) => sum + (i.remaining || 0), 0);

          msg = `🛒 *تقرير المشتريات*\n━━━━━━━━━━━━━━\n📅 من ${from} إلى ${to}\n━━━━━━━━━━━━━━\n\n📄 عدد الفواتير: *${invoices.length}*\n💰 إجمالي المشتريات: *${fmtMoney(total)} ج.م*\n✅ مدفوع: ${fmtMoney(totalPaid)} ج.م\n💸 مستحق للموردين: *${fmtMoney(totalRemaining)} ج.م*\n\n━━━━━━━━━━━━━━\n👤 من: ${currentUser.name}\n⏰ ${fmtDateTime(Date.now())}`;
        } catch(e) { console.error('purchases msg err:', e); }
      }
      // ========== INVENTORY ==========
      else if (reportType === 'inventory') {
        try {
          const products = Object.values(LocalStore.get('products') || {}).filter(p => p.active !== false);
          const warehouses = LocalStore.get('warehouses') || {};
          const txns = Object.values(LocalStore.get('inventory_txns') || {});
          const productsPerWarehouse = {};
          txns.forEach(t => {
            if (!productsPerWarehouse[t.warehouse_id]) productsPerWarehouse[t.warehouse_id] = new Set();
            productsPerWarehouse[t.warehouse_id].add(t.product_id);
          });

          let totalValue = 0, itemCount = 0, lowStock = 0, outOfStock = 0;
          Object.keys(warehouses).forEach(whId => {
            if (this.filters?.warehouseId !== 'all' && whId !== this.filters?.warehouseId) return;
            const inv = TxnEngine.getWarehouseInventory(whId);
            const productsInHere = productsPerWarehouse[whId] || new Set();
            inv.forEach(item => {
              const p = products.find(pr => pr._id === item.product_id);
              if (!p) return;
              if (!productsInHere.has(item.product_id)) return;
              totalValue += item.stock_value || 0;
              itemCount++;
              if (item.current_stock <= 0) outOfStock++;
              else if (item.current_stock <= (p.min_stock || 0)) lowStock++;
            });
          });

          msg = `📦 *تقرير المخزون*\n━━━━━━━━━━━━━━\n⏰ ${fmtDateTime(Date.now())}\n━━━━━━━━━━━━━━\n\n📦 عدد السجلات: *${itemCount}*\n💎 قيمة المخزون: *${fmtMoney(totalValue)} ج.م*\n⚠️ رصيد منخفض: ${lowStock} صنف\n🔴 نافذ: ${outOfStock} صنف\n\n━━━━━━━━━━━━━━\n👤 من: ${currentUser.name}`;
        } catch(e) { console.error('inventory msg err:', e); }
      }
      // ========== DEBTORS ==========
      else if (reportType === 'debtors') {
        try {
          const outstanding = (typeof DebtorsModule !== 'undefined' && DebtorsModule.getOutstandingInvoices)
            ? DebtorsModule.getOutstandingInvoices() : [];
          const total = outstanding.reduce((sum, i) => sum + (i.remaining || 0), 0);
          const overdue = outstanding.filter(i => ['red-dark', 'purple-flash'].includes(i._debt_color));
          const overdueTotal = overdue.reduce((sum, i) => sum + (i.remaining || 0), 0);
          const critical = outstanding.filter(i => i._debt_color === 'purple-flash');
          const criticalTotal = critical.reduce((sum, i) => sum + (i.remaining || 0), 0);

          msg = `🔴 *تقرير المدينين*\n━━━━━━━━━━━━━━\n⏰ ${fmtDateTime(Date.now())}\n━━━━━━━━━━━━━━\n\n📄 فواتير مستحقة: *${outstanding.length}*\n💰 إجمالي المديونية: *${fmtMoney(total)} ج.م*\n\n⚠️ متأخر: *${fmtMoney(overdueTotal)} ج.م* (${overdue.length} فاتورة)\n🟣 حرج (>30 يوم): *${fmtMoney(criticalTotal)} ج.م* (${critical.length} فاتورة)\n\n━━━━━━━━━━━━━━\n👤 من: ${currentUser.name}`;
        } catch(e) { console.error('debtors msg err:', e); }
      }
      // ========== PROFIT ==========
      else if (reportType === 'profit') {
        try {
          const invoices = this.getSalesData();
          const totalSales = invoices.reduce((sum, i) => sum + getInvoiceNet(i, 'sales').netTotal, 0);
          const totalProfit = invoices.reduce((sum, i) => sum + (i.total_profit || 0), 0);
          const totalCost = totalSales - totalProfit;
          const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

          msg = `💎 *تقرير الأرباح*\n━━━━━━━━━━━━━━\n📅 من ${from} إلى ${to}\n━━━━━━━━━━━━━━\n\n💰 إجمالي المبيعات: *${fmtMoney(totalSales)} ج.م*\n📉 إجمالي التكلفة: ${fmtMoney(totalCost)} ج.م\n💎 صافي الأرباح: *${fmtMoney(totalProfit)} ج.م*\n📊 هامش الربح: *${margin.toFixed(1)}%*\n\n━━━━━━━━━━━━━━\n👤 من: ${currentUser.name}\n⏰ ${fmtDateTime(Date.now())}`;
        } catch(e) { console.error('profit msg err:', e); }
      }

      // Fallback رسالة عامة لو أي حاجة فشلت
      if (!msg || msg.trim().length === 0) {
        console.warn('⚠️ Empty msg - using fallback');
        msg = `📊 *تقرير من ${company.name || 'حموده'}*\n━━━━━━━━━━━━━━\n📅 ${from} إلى ${to}\n⏰ ${fmtDateTime(Date.now())}\n👤 من: ${currentUser.name}`;
      }

      // Prepare phone
      let phone = String(phoneRaw).replace(/[^0-9]/g, '');
      if (!phone || phone.length < 8) {
        return showNotif('❌ تليفون الحاج غير صحيح: "' + phoneRaw + '"', 'danger');
      }
      if (phone.startsWith('0')) phone = '2' + phone;
      else if (!phone.startsWith('2')) phone = '2' + phone;

      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      console.log('📱 Opening:', url);

      logActivity('report_to_haj', 'reports', reportType, reportType);

      // فتح واتساب
      const opened = window.open(url, '_blank');
      if (!opened) {
        // popup blocker
        showNotif('⚠️ المتصفح منع فتح النافذة - اسمح للـ pop-ups من الإعدادات، أو انسخ الرقم: ' + phone, 'warning', 8000);
      } else {
        showNotif('📱 جاري فتح واتساب للحاج...', 'info');
      }
    } catch (err) {
      console.error('❌ sendReportToHaj FATAL:', err);
      showNotif('❌ حصل خطأ: ' + err.message, 'danger', 6000);
    }
  }
};
