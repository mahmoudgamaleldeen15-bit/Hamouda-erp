// ==========================================================
// Sales Module - فواتير البيع
// ==========================================================

const SalesModule = {

  currentView: 'list',
  currentInvoiceId: null,
  formItems: [],

  render() {
    if (!requirePermission('sales_view', 'مشاهدة المبيعات')) {
      return renderPlaceholder('💰 المبيعات', 'مش مصرح');
    }

    if (this.currentView === 'form') return this.renderForm();
    if (this.currentView === 'detail') return this.renderDetail(this.currentInvoiceId);
    return this.renderList();
  },

  // ==========================================================
  // View 1: List
  // ==========================================================
  renderList() {
    const container = document.getElementById('moduleContainer');
    const invoices = LocalStore.get('sales_invoices') || {};
    let list = Object.values(invoices).sort((a, b) => b.created_at - a.created_at);

    // Salesman: بيشوف فواتيره بس
    if (currentUser.role === 'salesman') {
      list = list.filter(i => i.created_by === currentUser._id);
    }

    const today = new Date().toDateString();
    const todayInvoices = list.filter(i =>
      new Date(i.created_at).toDateString() === today && i.status !== 'cancelled'
    );
    const todayTotal = todayInvoices.reduce((sum, i) => sum + getInvoiceNet(i, 'sales').netTotal, 0);
    const totalOutstanding = list
      .filter(i => i.status !== 'cancelled')
      .reduce((sum, i) => sum + i.remaining, 0);

    // Profit اليوم (لو عنده صلاحية)
    let todayProfit = 0;
    if (hasPermission('dashboard_view_profit')) {
      todayInvoices.forEach(inv => todayProfit += (inv.total_profit || 0));
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">💰 المبيعات</div>
          <div class="page-subtitle">${list.length} فاتورة</div>
        </div>
        <div class="page-actions">
          ${hasPermission('sales_add_cash') ? `
          <button class="btn btn-primary" onclick="SalesModule.newInvoice()">
            ➕ فاتورة بيع جديدة
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-${hasPermission('dashboard_view_profit') ? '4' : '3'}" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">💰 مبيعات اليوم</div>
          <div class="stat-value">${fmtMoneyShort(todayTotal)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">📄 فواتير اليوم</div>
          <div class="stat-value">${todayInvoices.length}</div>
        </div>
        ${hasPermission('dashboard_view_profit') ? `
        <div class="stat-card stat-gold">
          <div class="stat-label">💎 أرباح اليوم</div>
          <div class="stat-value">${fmtMoneyShort(todayProfit)} <span class="stat-currency">ج.م</span></div>
        </div>
        ` : ''}
        <div class="stat-card stat-red">
          <div class="stat-label">🔴 مستحق من العملاء</div>
          <div class="stat-value">${fmtMoneyShort(totalOutstanding)} <span class="stat-currency">ج.م</span></div>
        </div>
      </div>

      <!-- Search -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="grid grid-2">
          <div class="form-group" style="margin:0;">
            <input type="text" id="salSearch" placeholder="🔍 بحث بالرقم / العميل..."
                   oninput="SalesModule.filterList()">
          </div>
          <div class="form-group" style="margin:0;">
            <select id="salStatusFilter" onchange="SalesModule.filterList()">
              <option value="all">كل الحالات</option>
              <option value="paid">مدفوع</option>
              <option value="partial">جزئي</option>
              <option value="unpaid">آجل</option>
              <option value="cancelled">ملغى</option>
              <option value="has_return">🔄 عليها مرتجع</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>الرقم</th>
              <th>التاريخ</th>
              <th>العميل</th>
              <th>الصنف</th>
              <th>المخزن</th>
              <th>الإجمالي</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
              <th>الاستحقاق</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody id="salTableBody">
            ${this.renderTableRows(list)}
          </tbody>
        </table>
      </div>
    `;
  },

  renderTableRows(list) {
    if (list.length === 0) {
      return `<tr><td colspan="10" style="text-align:center; padding:40px; color:var(--gray-500);">
        <div style="font-size:48px; margin-bottom:12px;">💰</div>
        <div>لا توجد فواتير</div>
      </td></tr>`;
    }

    const customers = LocalStore.get('customers') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const now = Date.now();

    return list.map(inv => {
      const cust = customers[inv.customer_id] || { name: inv.customer_name_snapshot || '—' };
      const wh = warehouses[inv.warehouse_id] || { name: '—' };
      const cancelled = inv.status === 'cancelled';
      const isOverdue = inv.due_date && new Date(inv.due_date).getTime() < now && inv.remaining > 0 && !cancelled;

      // ✅ ملخص الأصناف
      const items = inv.items || [];
      let productsSummary = '—';
      if (items.length > 0) {
        const firstName = items[0].product_name_snapshot || '—';
        if (items.length === 1) {
          productsSummary = `<strong>${firstName}</strong>`;
        } else {
          productsSummary = `<strong>${firstName}</strong> <span style="color:var(--gray-500); font-size:12px;">+ ${items.length - 1} صنف</span>`;
        }
      }

      // ✅ حساب الصافي بعد المرتجعات
      const net = getInvoiceNet(inv, 'sales');

      return `
        <tr onclick="SalesModule.viewInvoice('${inv._id}')"
            style="cursor:pointer; ${cancelled ? 'opacity:0.5; text-decoration:line-through;' : ''}">
          <td><strong>${inv.invoice_number}</strong></td>
          <td>${fmtDate(inv.created_at)}</td>
          <td>${cust.name}</td>
          <td>${productsSummary}</td>
          <td>${wh.name}</td>
          <td>
            ${net.hasReturns ? `
              <div style="text-decoration:line-through; color:var(--gray-400); font-size:11px;">${fmtMoney(net.originalTotal)}</div>
              <strong style="color:var(--grape-700);">${fmtMoney(net.netTotal)}</strong> ج.م
              <div style="font-size:10px; color:#DC2626;">🔄 -${fmtMoney(net.totalReturned)}</div>
            ` : `
              <strong>${fmtMoney(net.originalTotal)}</strong> ج.م
            `}
          </td>
          <td>${fmtMoney(net.paid)} ج.م</td>
          <td class="${net.remaining > 0 && !cancelled ? 'negative' : 'positive'}">
            ${fmtMoney(net.remaining)} ج.م
          </td>
          <td class="${isOverdue ? 'negative' : ''}">
            ${inv.due_date ? fmtDate(new Date(inv.due_date).getTime()) : '—'}
          </td>
          <td>${PurchasesModule.getStatusBadge(inv.status)}${PurchasesModule.getReturnBadge(inv._id, 'sales')}</td>
        </tr>
      `;
    }).join('');
  },

  filterList() {
    const q = (document.getElementById('salSearch')?.value || '').toLowerCase();
    const status = document.getElementById('salStatusFilter')?.value || 'all';

    const invoices = LocalStore.get('sales_invoices') || {};
    const customers = LocalStore.get('customers') || {};
    let list = Object.values(invoices).sort((a, b) => b.created_at - a.created_at);

    if (currentUser.role === 'salesman') {
      list = list.filter(i => i.created_by === currentUser._id);
    }

    if (q) {
      list = list.filter(inv => {
        const cust = customers[inv.customer_id] || {};
        return (inv.invoice_number || '').toLowerCase().includes(q) ||
               (cust.name || '').toLowerCase().includes(q);
      });
    }

    if (status !== 'all') {
      if (status === 'has_return') {
        // ✅ الفواتير اللي عليها مرتجعات
        const returns = Object.values(LocalStore.get('sales_returns') || {});
        const returnedInvoiceIds = new Set(returns.map(r => r.original_invoice_id));
        list = list.filter(inv => returnedInvoiceIds.has(inv._id));
      } else {
        list = list.filter(inv => inv.status === status);
      }
    }

    const tbody = document.getElementById('salTableBody');
    if (tbody) tbody.innerHTML = this.renderTableRows(list);
  },

  // ==========================================================
  // View 2: Form
  // ==========================================================
  newInvoice() {
    if (!requirePermission('sales_add_cash', 'إضافة فاتورة بيع')) return;
    this.formItems = [];
    this.currentView = 'form';
    this.render();
    setTimeout(() => this.addFormItem(), 100);
  },

  renderForm() {
    const container = document.getElementById('moduleContainer');
    const customers = Object.values(LocalStore.get('customers') || {})
      .filter(c => c.status !== 'blocked');
    const warehouses = Object.values(LocalStore.get('warehouses') || {})
      .filter(w => w.active !== false);
    const paymentMethods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;

    const previewNumber = previewInvoiceNumber('SAL');

    // Default due date = 30 days from today
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 30);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">💰 فاتورة بيع جديدة</div>
          <div class="page-subtitle">رقم مبدئي: ${previewNumber}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" onclick="SalesModule.backToList()">← إلغاء</button>
        </div>
      </div>

      <!-- Meta -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">📋 بيانات الفاتورة</div>
        </div>

        <div class="grid grid-3">
          <div class="form-group">
            <label>العميل *</label>
            <select id="sal_customer" onchange="SalesModule.onCustomerChange()">
              <option value="">اختر عميل...</option>
              ${customers.map(c => `<option value="${c._id}">${c.name}${c.credit_limit > 0 ? ' (حد: ' + fmtMoneyShort(c.credit_limit) + ')' : ''}</option>`).join('')}
            </select>
            ${customers.length === 0 ? '<small class="hint" style="color:var(--danger)">لا يوجد عملاء - أضف عميل أول</small>' : ''}
          </div>

          <div class="form-group">
            <label>المخزن *</label>
            <select id="sal_warehouse" onchange="SalesModule.onWarehouseChange()">
              <option value="">اختر مخزن...</option>
              ${warehouses.map(w => `<option value="${w._id || w.id}">${w.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>التاريخ</label>
            <input type="date" id="sal_date" value="${new Date().toISOString().slice(0,10)}">
          </div>
        </div>

        <!-- Customer Info Box (لما يختار عميل) -->
        <div id="customerInfoBox" style="display:none;"></div>
      </div>

      <!-- Items -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">📦 الأصناف</div>
          <button class="btn btn-primary btn-sm" onclick="SalesModule.addFormItem()">
            ➕ إضافة صنف
          </button>
        </div>

        <div id="itemsContainer"></div>

        <div style="margin-top:16px; padding-top:16px; border-top:2px dashed var(--gray-200);">
          <div class="grid grid-2">
            <div class="form-group">
              <label>خصم (ج.م)</label>
              <input type="number" id="sal_discount" step="0.01" value="0"
                     oninput="SalesModule.calcTotals()">
            </div>
            <div style="text-align:left; padding:10px;">
              <div style="font-size:14px; color:var(--gray-500);">الإجمالي:</div>
              <div style="font-size:28px; font-weight:800; color:var(--grape-700);" id="sal_grand_total">
                0.00 ج.م
              </div>
              <div style="font-size:12px; color:var(--gray-500);">
                (قبل الخصم: <span id="sal_subtotal">0.00</span> ج.م)
              </div>
              ${hasPermission('dashboard_view_profit') ? `
                <div style="font-size:13px; color:var(--leaf-700); margin-top:4px;">
                  💎 الربح المتوقع: <span id="sal_profit">0.00</span> ج.م
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Payment -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">💰 الدفع</div>
        </div>

        <div class="grid grid-3">
          <div class="form-group">
            <label>طريقة الدفع</label>
            <select id="sal_payment_method" onchange="SalesModule.showPaymentDetails(this.value)">
              ${Object.entries(paymentMethods).filter(([k,v]) => v.enabled).map(([k, v]) =>
                `<option value="${k}">${v.icon || ''} ${v.label}</option>`
              ).join('')}
              <option value="none">💳 آجل (بدون دفع)</option>
            </select>
          </div>
          <div class="form-group">
            <label>المبلغ المدفوع</label>
            <input type="number" id="sal_paid" step="0.01" value="0"
                   oninput="SalesModule.calcTotals()">
          </div>
          <div style="text-align:left; padding:10px;">
            <div style="font-size:14px; color:var(--gray-500);">المتبقي:</div>
            <div style="font-size:24px; font-weight:800;" id="sal_remaining">
              0.00 ج.م
            </div>
          </div>
        </div>

        <!-- Payment Transfer Details -->
        <div id="sal_payment_details_box" style="display:none;"></div>
        <script>setTimeout(() => SalesModule.showPaymentDetails(document.getElementById('sal_payment_method')?.value), 100);</script>

        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-outline btn-sm" onclick="SalesModule.setPaidFull()">💯 دفع كامل</button>
          <button class="btn btn-outline btn-sm" onclick="SalesModule.setPaidZero()">🔴 آجل بالكامل</button>
        </div>

        <div class="grid grid-2" style="margin-top:16px;">
          <div class="form-group">
            <label>📅 تاريخ الاستحقاق</label>
            <input type="date" id="sal_due_date" value="${defaultDue.toISOString().slice(0,10)}">
            <small class="hint">للفواتير الآجل فقط</small>
          </div>
          <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="sal_notes" placeholder="اختياري">
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="SalesModule.backToList()">إلغاء</button>
        <button class="btn btn-primary btn-lg" onclick="SalesModule.saveInvoice()">
          💾 حفظ الفاتورة
        </button>
      </div>
    `;

    this.renderFormItems();
  },

  onCustomerChange() {
    const custId = document.getElementById('sal_customer').value;
    const box = document.getElementById('customerInfoBox');
    if (!custId) {
      box.style.display = 'none';
      return;
    }

    const customers = LocalStore.get('customers') || {};
    const c = customers[custId];
    if (!c) return;

    const debt = CustomersModule.computeCustomerDebt(custId);
    const overCredit = c.credit_limit > 0 && debt.totalDebt >= c.credit_limit;
    const nearLimit = c.credit_limit > 0 && debt.totalDebt >= (c.credit_limit * 0.8);

    box.style.display = 'block';
    box.style.marginTop = '12px';
    box.innerHTML = `
      <div style="padding: 12px 16px; background: ${overCredit ? '#FEE2E2' : nearLimit ? '#FEF3C7' : '#F0FDF4'};
                  border-radius: var(--radius); border-right: 4px solid ${overCredit ? 'var(--danger)' : nearLimit ? 'var(--warning)' : 'var(--leaf-600)'};
                  font-size: 13px;">
        <div style="display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>📞 <strong>${c.phone || '—'}</strong></div>
          <div>💰 المديونية: <strong>${fmtMoney(debt.totalDebt)} ج.م</strong></div>
          <div>🎯 الحد: <strong>${c.credit_limit ? fmtMoney(c.credit_limit) + ' ج.م' : 'بدون حد'}</strong></div>
          ${debt.overdueAmount > 0 ? `<div style="color:var(--danger);">🔴 متأخر: <strong>${fmtMoney(debt.overdueAmount)}</strong></div>` : ''}
        </div>
        ${overCredit ? '<div style="margin-top:6px; color:var(--danger); font-weight:700;">⚠️ العميل تجاوز الحد الائتماني!</div>' : ''}
        ${nearLimit && !overCredit ? '<div style="margin-top:6px; color:var(--gold-700);">⚠️ العميل اقترب من الحد الائتماني</div>' : ''}
      </div>
    `;
  },

  onWarehouseChange() {
    // Refresh items to show correct stock
    this.renderFormItems();
  },

  addFormItem() {
    this.formItems.push(ItemHelper.newItem());
    this.renderFormItems();
  },

  removeFormItem(idx) {
    this.formItems.splice(idx, 1);
    this.renderFormItems();
    this.calcTotals();
  },

  renderFormItems() {
    const container = document.getElementById('itemsContainer');
    if (!container) return;

    const warehouse_id = document.getElementById('sal_warehouse')?.value;

    if (this.formItems.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:30px; color:var(--gray-500);">
          <div style="font-size:36px; margin-bottom:8px;">📦</div>
          <div>اضغط "➕ إضافة صنف" لبدء إضافة الأصناف</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.formItems.map((item, idx) =>
      ItemHelper.renderCard(item, idx, {
        moduleName: 'SalesModule',
        showStock: true,
        warehouseId: warehouse_id,
        priceLabel: 'سعر الكيلو (بيع)'
      })
    ).join('');
  },

  updateItem(idx, field, value) {
    const item = this.formItems[idx];
    if (!item) return;

    // حقول بتغير شكل الكارت (لازم re-render)
    const STRUCTURE_FIELDS = ['product_id', 'unit_type', 'carton_weight_mode'];

    if (field === 'product_id') {
      item.product_id = value;
      // اعرض سعر البيع الافتراضي
      const products = LocalStore.get('products') || {};
      const p = products[value];
      if (p && (!item.unit_price || item.unit_price === 0)) {
        item.unit_price = p.default_sale_price || 0;
      }
    } else if (field === 'unit_type') {
      item.unit_type = value;
      // Reset fields للنوع الآخر
      if (value === 'cartons') {
        item.car_number = '';
        item.total_weight = 0;
        item.empty_weight = 0;
        if (!item.carton_weight) item.carton_weight = 10;
      } else {
        item.cartons_count = 0;
      }
    } else if (field === 'carton_weight_mode') {
      // ✅ اختيار وضع وزن الكرتونة
      if (value === '10') item.carton_weight = 10;
      else if (value === '5') item.carton_weight = 5;
      else if (value === 'custom') item.carton_weight = 7; // قيمة مبدئية مؤقتة للـ custom input
      else if (value === 'none') item.carton_weight = 0;   // بلا وزن
    } else if (field === 'bayan' || field === 'car_number') {
      item[field] = value;
    } else {
      item[field] = Number(value) || 0;
    }

    ItemHelper.compute(item);

    // ⭐ تحديث ذكي: re-render فقط عند تغيير الشكل
    if (STRUCTURE_FIELDS.includes(field)) {
      this.renderFormItems();
    } else {
      // تحديث in-place بدون فقد focus
      const warehouse_id = document.getElementById('sal_warehouse')?.value;
      ItemHelper.updateItemUI(idx, item, {
        showStock: true,
        warehouseId: warehouse_id
      });
    }

    this.calcTotals();
  },

  calcTotals() {
    const subtotal = this.formItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const discount = Number(document.getElementById('sal_discount')?.value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    const paid = Number(document.getElementById('sal_paid')?.value) || 0;
    const remaining = Math.max(0, grandTotal - paid);

    document.getElementById('sal_subtotal').textContent = fmtMoney(subtotal);
    document.getElementById('sal_grand_total').textContent = fmtMoney(grandTotal) + ' ج.م';
    const remEl = document.getElementById('sal_remaining');
    remEl.textContent = fmtMoney(remaining) + ' ج.م';
    remEl.style.color = remaining > 0 ? 'var(--danger)' : 'var(--leaf-600)';

    // احسب الربح لحظياً
    if (hasPermission('dashboard_view_profit')) {
      const warehouse_id = document.getElementById('sal_warehouse')?.value;
      let profit = 0;
      if (warehouse_id) {
        this.formItems.forEach(item => {
          if (!item.product_id || !item.qty || !item.unit_price) return;
          const inv = TxnEngine.getInventory(warehouse_id, item.product_id);
          const cost = inv.average_cost || 0;
          profit += (item.unit_price - cost) * item.qty;
        });
      }
      const profitEl = document.getElementById('sal_profit');
      if (profitEl) {
        profitEl.textContent = fmtMoney(profit);
        profitEl.style.color = profit >= 0 ? 'var(--leaf-700)' : 'var(--danger)';
      }
    }
  },

  setPaidFull() {
    const subtotal = this.formItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const discount = Number(document.getElementById('sal_discount')?.value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    document.getElementById('sal_paid').value = grandTotal.toFixed(2);
    this.calcTotals();
  },

  setPaidZero() {
    document.getElementById('sal_paid').value = 0;
    document.getElementById('sal_payment_method').value = 'none';
    this.calcTotals();
  },

  // ==========================================================
  // ⭐ Save Invoice - المنطق الحساس
  // ==========================================================
  saveInvoice() {
    if (!requirePermission('sales_add_cash', 'حفظ فاتورة بيع')) return;

    const customer_id = document.getElementById('sal_customer').value;
    const warehouse_id = document.getElementById('sal_warehouse').value;
    const date = document.getElementById('sal_date').value;
    const due_date = document.getElementById('sal_due_date').value;
    const discount = Number(document.getElementById('sal_discount').value) || 0;
    const paid = Number(document.getElementById('sal_paid').value) || 0;
    const payment_method = document.getElementById('sal_payment_method').value;
    const notes = document.getElementById('sal_notes').value.trim();

    if (!customer_id) return showNotif('❌ اختر العميل', 'danger');
    if (!warehouse_id) return showNotif('❌ اختر المخزن', 'danger');

    // إعادة حساب كل الـ items (احتياطياً)
    this.formItems.forEach(i => ItemHelper.compute(i));

    if (this.formItems.length === 0) return showNotif('❌ أضف صنف على الأقل', 'danger');

    // فلترة items صحيحة (بأي نوع وحدة)
    const validItems = this.formItems.filter(i => {
      if (!i.product_id || !i.unit_price || i.unit_price <= 0) return false;
      if (i.unit_type === 'cartons') {
        return i.cartons_count > 0;
      } else {
        return i.total_weight > 0 && i.total_weight > i.empty_weight;
      }
    });

    if (validItems.length === 0) {
      return showNotif('❌ أكمل بيانات الأصناف (صنف / وحدة / كميات / سعر)', 'danger');
    }

    const subtotal = validItems.reduce((sum, i) => sum + i.total, 0);
    const grand_total = Math.max(0, subtotal - discount);
    const remaining = Math.max(0, grand_total - paid);

    if (paid > grand_total) {
      return showNotif('❌ المبلغ المدفوع أكبر من الإجمالي', 'danger');
    }

    // ⭐ 1. فحص الرصيد
    const customers = LocalStore.get('customers') || {};
    const customer = customers[customer_id];
    const warehouses = LocalStore.get('warehouses') || {};

    const insufficientItems = [];
    for (const item of validItems) {
      const inv = TxnEngine.getInventory(warehouse_id, item.product_id);
      if (inv.current_stock < item.qty) {
        const products = LocalStore.get('products') || {};
        const p = products[item.product_id];
        insufficientItems.push({
          name: p?.name || 'صنف',
          available: inv.current_stock,
          requested: item.qty
        });
      }
    }

    if (insufficientItems.length > 0) {
      // المندوب والمحاسب: يرفض
      if (!hasPermission('sales_override_stock')) {
        const msg = insufficientItems.map(i => `${i.name}: متاح ${fmtMoney(i.available)}, مطلوب ${fmtMoney(i.requested)}`).join('\n');
        return showNotif('❌ الرصيد غير كافٍ:\n' + msg, 'danger', 5000);
      }
      // الأدمن: يحذر ويسأل
      const msg = insufficientItems.map(i => `${i.name}: متاح ${i.available}, مطلوب ${i.requested}`).join('\n');
      if (!confirm(`⚠️ الرصيد غير كافٍ للأصناف التالية:\n${msg}\n\nهل تريد المتابعة (الرصيد سيصبح سالب)؟`)) {
        return;
      }
    }

    // ⭐ 2. فحص الحد الائتماني
    if (remaining > 0 && customer.credit_limit > 0) {
      const currentDebt = CustomersModule.computeCustomerDebt(customer_id).totalDebt;
      const newTotal = currentDebt + remaining;

      if (newTotal > customer.credit_limit) {
        const excess = newTotal - customer.credit_limit;

        if (!hasPermission('sales_override_credit_limit')) {
          return showNotif(
            `❌ العميل سيتجاوز الحد الائتماني بمبلغ ${fmtMoney(excess)} ج.م\nالمديونية الحالية: ${fmtMoney(currentDebt)}\nالحد: ${fmtMoney(customer.credit_limit)}`,
            'danger', 6000
          );
        }

        if (!confirm(`⚠️ العميل سيتجاوز الحد الائتماني!\n\nالمديونية الحالية: ${fmtMoney(currentDebt)} ج.م\nالحد: ${fmtMoney(customer.credit_limit)} ج.م\nالفاتورة الجديدة: ${fmtMoney(remaining)} ج.م\nالتجاوز: ${fmtMoney(excess)} ج.م\n\nهل تريد المتابعة؟`)) {
          return;
        }
      }
    }

    // ⭐ 3. Generate serial
    const numGen = generateInvoiceNumber('SAL');
    const invoice_number = numGen.number;
    const invoice_id = genID('inv_');
    const products = LocalStore.get('products') || {};

    // Status
    let status = 'unpaid';
    if (paid >= grand_total) status = 'paid';
    else if (paid > 0) status = 'partial';

    // ⭐ 4. items snapshot + احسب الربح
    let total_profit = 0;
    const items_snapshot = validItems.map(i => {
      const p = products[i.product_id] || {};
      const inv = TxnEngine.getInventory(warehouse_id, i.product_id);
      const cost = inv.average_cost || 0;
      const itemProfit = (i.unit_price - cost) * i.qty;
      total_profit += itemProfit;

      // Snapshot من ItemHelper يشمل نوع الوحدة والتفاصيل
      const snap = ItemHelper.buildSnapshot(i, p);
      // ✅ لو وضع "بلا" - الوحدة كرتونة، والسعر سعر كرتونة
      const isBala = i.unit_type === 'cartons' && Number(i.carton_weight) === 0;
      snap.unit_snapshot = isBala ? 'carton' : 'kg';
      snap.display_unit = isBala ? 'كرتونة' : 'كجم';
      snap.unit_cost_snapshot = cost;
      snap.profit = itemProfit;
      return snap;
    });

    const invoice = {
      _id: invoice_id,
      uuid: genUUID(),
      invoice_number: invoice_number,
      customer_id: customer_id,
      customer_name_snapshot: customer?.name || '',
      customer_phone_snapshot: customer?.phone || '',
      warehouse_id: warehouse_id,
      date: date,
      due_date: paid < grand_total ? due_date : '',
      items: items_snapshot,
      subtotal: subtotal,
      discount_total: discount,
      grand_total: grand_total,
      paid: paid,
      remaining: remaining,
      total_profit: total_profit,
      payment_method: paid > 0 ? payment_method : 'none',
      status: status,
      cancelled_at: 0,
      cancelled_by: '',
      cancel_reason: '',
      created_by: currentUser._id,
      created_by_name: currentUser.name,
      created_at: Date.now(),
      notes: notes,
      whatsapp_sent_to_customer: false
    };

    // ⭐ 5. Create sale transactions
    const createdTxns = [];
    for (const item of validItems) {
      const result = TxnEngine.addTransaction({
        type: 'sale',
        warehouse_id: warehouse_id,
        product_id: item.product_id,
        quantity: item.qty,
        allow_negative: hasPermission('sales_override_stock'),
        unit_price: item.unit_price,
        reference_type: 'sales_invoice',
        reference_id: invoice_id,
        reference_number: invoice_number,
        notes: `بيع - فاتورة ${invoice_number}`
      });

      if (!result.success) {
        this._rollbackTransactions(createdTxns);
        return showNotif('❌ فشل حفظ الحركة: ' + result.error, 'danger');
      }
      createdTxns.push(result.txn_id);
    }

    // ⭐ 6. Payment record
    if (paid > 0) {
      const paymentId = genID('pay_');
      const payments = LocalStore.get('payments') || {};
      payments[paymentId] = {
        _id: paymentId,
        type: 'sales_payment',
        customer_id: customer_id,
        invoice_id: invoice_id,
        invoice_number: invoice_number,
        amount: paid,
        method: payment_method,
        date: date,
        received_by: currentUser._id,
        notes: 'دفعة مع فاتورة البيع',
        created_at: Date.now()
      };
      LocalStore.set('payments', payments);
    }

    // ⭐ 7. Save invoice
    const invoices = LocalStore.get('sales_invoices') || {};
    invoices[invoice_id] = invoice;
    LocalStore.set('sales_invoices', invoices);

    // ⭐ 8. Update customer cache
    CustomersModule.updateCustomerCache(customer_id, grand_total, remaining, true);

    // ⭐ 9. Increment counter
    incrementInvoiceCounter(numGen.counterKey);

    // ⭐ 10. Activity log
    logActivity('create', 'sales', invoice_id, invoice_number, {
      customer: customer?.name,
      grand_total: grand_total,
      items_count: validItems.length
    });

    showNotif('✅ تم حفظ الفاتورة ' + invoice_number, 'success');

    this.currentView = 'detail';
    this.currentInvoiceId = invoice_id;
    this.render();
  },

  _rollbackTransactions(txnIds) {
    const txns = LocalStore.get('inventory_txns') || {};
    txnIds.forEach(id => {
      const txn = txns[id];
      if (txn) {
        TxnEngine.updateInventoryCache(txn.warehouse_id, txn.product_id, {
          current_stock: txn.stock_before
        });
        delete txns[id];
      }
    });
    LocalStore.set('inventory_txns', txns);
  },

  // ==========================================================
  // View 3: Detail
  // ==========================================================
  viewInvoice(id) {
    this.currentInvoiceId = id;
    this.currentView = 'detail';
    this.render();
  },

  renderDetail(id) {
    const container = document.getElementById('moduleContainer');
    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[id];
    if (!inv) {
      showNotif('❌ الفاتورة غير موجودة', 'danger');
      this.currentView = 'list';
      return this.render();
    }

    const customers = LocalStore.get('customers') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;

    const cust = customers[inv.customer_id] || { name: inv.customer_name_snapshot, phone: inv.customer_phone_snapshot };
    const wh = warehouses[inv.warehouse_id] || { name: '—' };
    const showProfit = hasPermission('dashboard_view_profit');

    container.innerHTML = `
      <div class="page-header no-print">
        <div>
          <div class="page-title">💰 ${inv.invoice_number}</div>
          <div class="page-subtitle">
            ${PurchasesModule.getStatusBadge(inv.status)}${PurchasesModule.getReturnBadge(inv._id, 'sales')}
            ${inv.status === 'cancelled' ? '<span style="margin-right:8px; color:var(--danger);">سبب: ' + inv.cancel_reason + '</span>' : ''}
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="SalesModule.backToList()">← رجوع</button>
          <button class="btn btn-outline" onclick="window.print()">🖨️ طباعة</button>
          ${inv.status !== 'cancelled' && hasPermission('sales_cancel') ? `
            <button class="btn btn-outline" onclick="switchModule('returns'); setTimeout(() => ReturnsModule.startFromInvoice('${id}', 'sales'), 50);" style="border-color:var(--danger); color:var(--danger);">
              🔄 إرجاع
            </button>
          ` : ''}
          ${inv.status !== 'cancelled' ? `
            <button class="btn btn-gold" onclick="SalesModule.sendToHaj('${id}')">
              📱 للحاج
            </button>
          ` : ''}
          ${inv.status !== 'cancelled' && cust.phone ? `
            <button class="btn btn-secondary" onclick="SalesModule.sendWhatsApp('${id}')">
              📱 للعميل
            </button>
          ` : ''}
          ${inv.status !== 'cancelled' && hasPermission('sales_cancel') ? `
            <button class="btn btn-danger" onclick="SalesModule.cancelInvoice('${id}')">
              ❌ إلغاء الفاتورة
            </button>
          ` : ''}
        </div>
      </div>

      <div class="invoice-print">
        <div class="invoice-header">
          <div class="invoice-brand">
            <img src="assets/logo.png" alt="حموده" class="invoice-logo">
            <div>
              <div class="invoice-company">${company.name}</div>
              <div class="invoice-phone">📞 ${company.owner_phone}</div>
            </div>
          </div>
          <div class="invoice-number-box">
            <div class="invoice-label">فاتورة بيع</div>
            <div class="invoice-number">${inv.invoice_number}</div>
            <div class="invoice-date">${fmtDate(inv.created_at)}</div>
          </div>
        </div>

        <div class="invoice-meta">
          <div><strong>العميل:</strong> ${cust.name}</div>
          <div><strong>التليفون:</strong> ${cust.phone || '—'}</div>
          <div><strong>المخزن:</strong> ${wh.name}</div>
          <div><strong>التاريخ:</strong> ${inv.date}</div>
          ${inv.due_date ? `<div style="grid-column: 1 / -1;"><strong>📅 تاريخ الاستحقاق:</strong> ${inv.due_date}</div>` : ''}
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>التفاصيل</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${inv.items.map((item, i) => {
              const productUnit = getProductUnitName(item.product_id) || 'كجم';

              const isBala = (
                item.display_unit === 'كرتونة' ||
                item.unit_snapshot === 'carton' ||
                (item.unit_type === 'cartons' && Number(item.carton_weight) === 0) ||
                (item.unit_type === 'cartons' && item.cartons_count > 0 && Number(item.qty) === Number(item.cartons_count))
              );

              // ✅ لو بلا → بوحدة الصنف. لو فيه وزن → بالكيلو
              const useProductUnit = isBala;
              const unitLabel = useProductUnit ? productUnit : 'كجم';
              const priceLabel = useProductUnit ? `ج.م / ${productUnit}` : 'ج.م / كجم';
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>
                    <strong>${item.product_name_snapshot}</strong>
                    ${item.sku_snapshot ? '<br><small style="color:var(--gray-500);">' + item.sku_snapshot + '</small>' : ''}
                    ${item.bayan ? '<br><small style="color:var(--grape-700);">📝 ' + item.bayan + '</small>' : ''}
                  </td>
                  <td style="font-size:13px;">
                    ${ItemHelper.renderItemDetail(item)}
                  </td>
                  <td><strong>${fmtMoney(item.qty)}</strong> ${unitLabel}</td>
                  <td>${fmtMoney(item.unit_price)} <small style="color:var(--gray-500);">${priceLabel}</small></td>
                  <td><strong>${fmtMoney(item.total)}</strong> ج.م</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="invoice-totals">
          <div class="invoice-total-row">
            <span>المجموع:</span>
            <span>${fmtMoney(inv.subtotal)} ج.م</span>
          </div>
          ${inv.discount_total > 0 ? `
            <div class="invoice-total-row">
              <span>خصم:</span>
              <span>${fmtMoney(inv.discount_total)} ج.م</span>
            </div>
          ` : ''}
          ${(() => {
            const net = getInvoiceNet(inv, 'sales');
            if (net.hasReturns) {
              return `
                <div class="invoice-total-row" style="color:var(--gray-500);">
                  <span>الإجمالي قبل المرتجع:</span>
                  <span style="text-decoration:line-through;">${fmtMoney(net.originalTotal)} ج.م</span>
                </div>
                <div class="invoice-total-row" style="color:#DC2626;">
                  <span>🔄 مرتجعات (${net.returnsCount}):</span>
                  <span>- ${fmtMoney(net.totalReturned)} ج.م</span>
                </div>
                <div class="invoice-total-row invoice-grand" style="background:#F0FDF4; padding:8px 12px; border-radius:6px;">
                  <span>💎 صافي الفاتورة:</span>
                  <span>${fmtMoney(net.netTotal)} ج.م</span>
                </div>
                <div class="invoice-total-row">
                  <span>المدفوع (${PurchasesModule.getPaymentMethodLabel(inv.payment_method)}):</span>
                  <span>${fmtMoney(net.paid)} ج.م</span>
                </div>
                <div class="invoice-total-row" style="color:${net.remaining > 0 ? 'var(--danger)' : 'var(--leaf-600)'};">
                  <span><strong>المتبقي:</strong></span>
                  <span><strong>${fmtMoney(net.remaining)} ج.م</strong></span>
                </div>
              `;
            }
            return `
              <div class="invoice-total-row invoice-grand">
                <span>الإجمالي:</span>
                <span>${fmtMoney(inv.grand_total)} ج.م</span>
              </div>
              <div class="invoice-total-row">
                <span>المدفوع (${PurchasesModule.getPaymentMethodLabel(inv.payment_method)}):</span>
                <span>${fmtMoney(inv.paid)} ج.م</span>
              </div>
              <div class="invoice-total-row" style="color:${inv.remaining > 0 ? 'var(--danger)' : 'var(--leaf-600)'};">
                <span><strong>المتبقي:</strong></span>
                <span><strong>${fmtMoney(inv.remaining)} ج.م</strong></span>
              </div>
            `;
          })()}
        </div>

        ${showProfit && inv.status !== 'cancelled' ? `
          <div class="no-print" style="padding: 12px 16px; background: #F0FDF4; border-radius: var(--radius); border-right: 4px solid var(--leaf-600); margin-bottom: 16px;">
            💎 <strong>ربح الفاتورة:</strong>
            <span style="color:${inv.total_profit >= 0 ? 'var(--leaf-700)' : 'var(--danger)'}; font-weight:700;">
              ${fmtMoney(inv.total_profit || 0)} ج.م
            </span>
            <small style="color:var(--gray-500); margin-right:8px;">(محسوب بمتوسط التكلفة)</small>
          </div>
        ` : ''}

        ${inv.notes ? `
          <div class="invoice-notes">
            <strong>ملاحظات:</strong> ${inv.notes}
          </div>
        ` : ''}

        ${(() => {
          const returns = Object.values(LocalStore.get('sales_returns') || {})
            .filter(r => r.original_invoice_id === inv._id)
            .sort((a, b) => b.created_at - a.created_at);
          if (returns.length === 0) return '';
          const total = returns.reduce((s, r) => s + (r.total_returned || 0), 0);
          return `
            <div class="no-print" style="margin-top:16px; padding:14px; background:#FEE2E2; border:2px solid #DC2626; border-radius:var(--radius);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-weight:800; color:#991B1B; font-size:15px;">
                  🔄 المرتجعات المرتبطة (${returns.length})
                </div>
                <div style="font-weight:700; color:#991B1B; font-size:16px;">
                  إجمالي: ${fmtMoney(total)} ج.م
                </div>
              </div>
              <div style="display:grid; gap:6px;">
                ${returns.map(r => `
                  <div onclick="ReturnsModule.viewDetail('${r._id}', 'sales'); switchModule('returns');"
                       style="cursor:pointer; padding:8px 12px; background:white; border-radius:var(--radius); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <strong>${r.return_number}</strong>
                      <span style="color:var(--gray-500); margin-right:8px; font-size:13px;">${fmtDate(r.created_at)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="font-weight:700; color:#991B1B;">${fmtMoney(r.total_returned)} ج.م</span>
                      <span style="font-size:12px; padding:2px 8px; background:${r.refund_method === 'cash' ? '#FEF3C7' : '#EDE9FE'}; border-radius:8px;">
                        ${r.refund_method === 'cash' ? '💵 كاش' : '📉 خصم من الحساب'}
                      </span>
                      <span style="color:#DC2626;">←</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        })()}

        <div class="invoice-footer">
          <div>البائع: ${inv.created_by_name || '—'}</div>
          <div>${fmtDateTime(inv.created_at)}</div>
        </div>
      </div>
    `;
  },

  // ==========================================================
  // WhatsApp
  // ==========================================================
  sendWhatsApp(invoiceId) {
    if (!requirePermission('whatsapp_send_invoice', 'إرسال واتساب')) return;

    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    if (!inv) return;

    const customers = LocalStore.get('customers') || {};
    const cust = customers[inv.customer_id];
    if (!cust || !cust.phone) return showNotif('❌ العميل ما عندوش تليفون', 'danger');

    const templates = LocalStore.get('settings/whatsapp_templates') || DEFAULT_WA_TEMPLATES;
    let template = templates.invoice_to_customer;

    // Build items list - بالوحدة الصحيحة لكل صنف
    const itemsList = inv.items.map(item => {
      const unitInfo = getItemUnitInfo(item);
      return `- ${item.product_name_snapshot}: ${fmtMoney(item.qty)} ${unitInfo.unitLabel} × ${fmtMoney(item.unit_price)} = ${fmtMoney(item.total)}`;
    }).join('\n');

    // Replace placeholders
    template = template
      .replace('{invoice_number}', inv.invoice_number)
      .replace('{date}', inv.date)
      .replace('{customer_name}', cust.name)
      .replace('{items_list}', itemsList)
      .replace('{grand_total}', fmtMoney(inv.grand_total))
      .replace('{paid}', fmtMoney(inv.paid))
      .replace('{remaining}', fmtMoney(inv.remaining))
      .replace('{due_date}', inv.due_date || '—');

    // ✅ إضافة تفاصيل التحويل لو المتبقي > 0
    if (inv.remaining > 0) {
      const paymentMethods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;
      const activeTransferMethods = Object.entries(paymentMethods)
        .filter(([k, m]) => m.enabled && m.requires_transfer && m.phone && m.recipient_name);

      if (activeTransferMethods.length > 0) {
        let transferInfo = '\n\n━━━━━━━━━━━━━━\n💳 *طرق السداد:*\n';
        activeTransferMethods.forEach(([k, m]) => {
          transferInfo += `\n${m.icon || '💰'} *${m.label}*\n📱 ${m.phone}\n👤 ${m.recipient_name}\n`;
          if (m.notes) transferInfo += `📝 ${m.notes}\n`;
        });
        transferInfo += '\n💵 أو كاش عند الاستلام';
        template += transferInfo;
      }
    }

    // Format phone (remove leading zero, add country code)
    let phone = cust.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone;
    else if (!phone.startsWith('2')) phone = '2' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(template)}`;

    // Mark as sent
    inv.whatsapp_sent_to_customer = true;
    inv.whatsapp_sent_at = Date.now();
    invoices[invoiceId] = inv;
    LocalStore.set('sales_invoices', invoices);

    logActivity('whatsapp', 'sales', invoiceId, inv.invoice_number, {
      customer: cust.name, phone: cust.phone
    });

    window.open(url, '_blank');
    showNotif('📱 جاري فتح واتساب...', 'info');
  },

  // ==========================================================
  // إرسال للحاج (مع إجمالي المخزن بعد العملية)
  // ==========================================================
  sendToHaj(invoiceId) {
    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[invoiceId];
    if (!inv) return;

    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;
    const hajPhone = company.owner_phone || '01004975602';

    const customers = LocalStore.get('customers') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const cust = customers[inv.customer_id] || { name: inv.customer_name_snapshot };
    const wh = warehouses[inv.warehouse_id] || { name: '—' };

    // احسب رصيد المخزن الحالي (اختياري للحاج)
    const whInventory = TxnEngine.getWarehouseInventory(inv.warehouse_id);
    const whTotalValue = whInventory.reduce((sum, i) => sum + i.stock_value, 0);
    const whTotalItems = whInventory.filter(i => i.current_stock > 0).length;

    // Build items detail
    const itemsDetail = inv.items.map((item, i) => {
      const unitInfo = getItemUnitInfo(item);
      let detail = `${i + 1}. ${item.product_name_snapshot}`;
      if (item.unit_type === 'cartons') {
        if (unitInfo.isBala) {
          detail += `\n   📦 ${item.cartons_count} ${unitInfo.productUnit}`;
        } else {
          // فيه وزن - بالكيلو
          detail += `\n   📦 ${item.cartons_count} ${unitInfo.vesselName} × ${item.carton_weight} كجم = ${fmtMoney(item.qty)} كجم`;
        }
      } else {
        detail += `\n   ⚖️ سيارة ${item.car_number || '—'}: ${fmtMoney(item.qty)} كجم صافي`;
      }
      detail += `\n   💰 ${fmtMoney(item.unit_price)} ج.م/${unitInfo.unitLabel} = ${fmtMoney(item.total)} ج.م`;
      return detail;
    }).join('\n\n');

    const msg = `📊 *فاتورة بيع* — ${inv.invoice_number}
━━━━━━━━━━━━━━
📅 ${fmtDateTime(inv.created_at)}

👤 العميل: ${cust.name}
📞 ${cust.phone || '—'}
🏢 المخزن: ${wh.name}

*الأصناف:*
${itemsDetail}
━━━━━━━━━━━━━━
${(() => {
  const _n = getInvoiceNet(inv, 'sales');
  if (_n.hasReturns) {
    return `💰 الإجمالي الأصلي: ${fmtMoney(_n.originalTotal)} ج.م
🔄 مرتجعات (${_n.returnsCount}): -${fmtMoney(_n.totalReturned)} ج.م
💎 الصافي: *${fmtMoney(_n.netTotal)} ج.م*
✅ المدفوع: ${fmtMoney(_n.paid)} ج.م (${PurchasesModule.getPaymentMethodLabel(inv.payment_method)})
🔴 المتبقي: *${fmtMoney(_n.remaining)} ج.م*`;
  }
  return `💰 الإجمالي: *${fmtMoney(inv.grand_total)} ج.م*
✅ المدفوع: ${fmtMoney(inv.paid)} ج.م (${PurchasesModule.getPaymentMethodLabel(inv.payment_method)})
🔴 المتبقي: *${fmtMoney(inv.remaining)} ج.م*`;
})()}
${inv.due_date ? '📅 استحقاق: ' + inv.due_date : ''}

━━━━━━━━━━━━━━
📦 *المخزن بعد العملية:*
🏢 ${wh.name}
📊 ${whTotalItems} صنف
💎 قيمة المخزون: ${fmtMoney(whTotalValue)} ج.م

━━━━━━━━━━━━━━
👤 البائع: ${inv.created_by_name || '—'}
${inv.notes ? '\n📝 ملاحظات: ' + inv.notes : ''}`;

    let phone = hajPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone;
    else if (!phone.startsWith('2')) phone = '2' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

    logActivity('whatsapp_haj', 'sales', invoiceId, inv.invoice_number, {});

    window.open(url, '_blank');
    showNotif('📱 جاري فتح واتساب للحاج...', 'info');
  },

  // ==========================================================
  // Cancel
  // ==========================================================
  cancelInvoice(id) {
    if (!requirePermission('sales_cancel', 'إلغاء فاتورة بيع')) return;

    const reason = prompt('سبب الإلغاء (مطلوب - على الأقل 5 حروف):');
    if (!reason || reason.trim().length < 5) {
      return showNotif('❌ سبب الإلغاء مطلوب', 'danger');
    }

    if (!confirm('⚠️ هل أنت متأكد؟ البضاعة سترجع للمخزن.')) return;

    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[id];
    if (!inv) return showNotif('❌ الفاتورة غير موجودة', 'danger');
    if (inv.status === 'cancelled') return showNotif('⚠️ الفاتورة ملغية بالفعل', 'warning');

    // Reverse transactions
    for (const item of inv.items) {
      const result = TxnEngine.addTransaction({
        type: 'sale_cancel',
        warehouse_id: inv.warehouse_id,
        product_id: item.product_id,
        quantity: item.qty,
        reference_type: 'sales_invoice_cancel',
        reference_id: id,
        reference_number: inv.invoice_number,
        notes: 'إلغاء فاتورة ' + inv.invoice_number + ' — ' + reason
      });

      if (!result.success) {
        return showNotif('❌ فشل في إلغاء حركة: ' + result.error, 'danger');
      }
    }

    // Update invoice
    const before = { ...inv };
    inv.status = 'cancelled';
    inv.cancelled_at = Date.now();
    inv.cancelled_by = currentUser._id;
    inv.cancel_reason = reason.trim();
    invoices[id] = inv;
    LocalStore.set('sales_invoices', invoices);

    // Update customer cache
    const customers = LocalStore.get('customers') || {};
    const cust = customers[inv.customer_id];
    if (cust) {
      cust.cached_lifetime_sales = Math.max(0, (cust.cached_lifetime_sales || 0) - inv.grand_total);
      cust.cached_total_debt = Math.max(0, (cust.cached_total_debt || 0) - inv.remaining);
      customers[inv.customer_id] = cust;
      LocalStore.set('customers', customers);
    }

    logActivity('cancel', 'sales', id, inv.invoice_number, {
      reason: reason.trim(),
      before_status: before.status
    });

    showNotif('✅ تم إلغاء الفاتورة', 'success');
    this.render();
  },

  backToList() {
    this.currentView = 'list';
    this.currentInvoiceId = null;
    this.formItems = [];
    this.render();
  },

  // ==========================================================
  // 💳 عرض تفاصيل التحويل عند اختيار طريقة الدفع
  // ==========================================================
  showPaymentDetails(methodKey) {
    const box = document.getElementById('sal_payment_details_box');
    if (!box) return;

    // إخفاء للكاش والآجل
    if (!methodKey || methodKey === 'cash' || methodKey === 'none') {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    const methods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;
    const method = methods[methodKey];
    if (!method || !method.requires_transfer) {
      box.style.display = 'none';
      return;
    }

    if (!method.phone || !method.recipient_name) {
      box.style.display = 'block';
      box.innerHTML = `
        <div style="padding:12px; background:#FEF3C7; border:1px solid #F59E0B; border-radius:var(--radius); margin-top:8px; font-size:13px;">
          ⚠️ <strong>${method.label} ما اتضبطش:</strong>
          محتاج تحدد رقم التحويل واسم المسؤول من
          <a href="#" onclick="switchModule('settings'); setTimeout(() => SettingsModule.switchTab('payment'), 100); return false;" style="color:var(--grape-700); font-weight:700;">الإعدادات → طرق الدفع</a>
        </div>
      `;
      return;
    }

    box.style.display = 'block';
    box.innerHTML = `
      <div style="padding:14px; background:#F0FDF4; border:1px solid var(--leaf-400); border-radius:var(--radius); margin-top:8px;">
        <div style="font-weight:700; color:var(--leaf-700); font-size:14px; margin-bottom:8px;">
          💳 بيانات التحويل - ${method.icon} ${method.label}
        </div>
        <div style="display:grid; gap:6px; font-size:14px;">
          <div>
            <span style="color:var(--gray-600);">📱 التليفون:</span>
            <strong style="direction:ltr; display:inline-block; font-size:16px; margin-right:8px; color:var(--grape-700);">${method.phone}</strong>
            <button type="button" class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${method.phone}'); showNotif('✅ اتنسخ الرقم','success')">📋</button>
          </div>
          <div>
            <span style="color:var(--gray-600);">👤 باسم:</span>
            <strong style="margin-right:8px;">${method.recipient_name}</strong>
          </div>
          ${method.notes ? `
            <div style="padding:8px; background:white; border-radius:var(--radius); margin-top:4px;">
              📝 ${method.notes}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
};
