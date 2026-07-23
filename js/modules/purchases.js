// ==========================================================
// Purchases Module - فواتير الشراء
// ==========================================================

const PurchasesModule = {

  currentView: 'list', // list | form | detail
  currentInvoiceId: null,
  formItems: [], // Items في الفورم الجارية

  render() {
    if (!requirePermission('purchases_view', 'مشاهدة المشتريات')) {
      return renderPlaceholder('🛒 المشتريات', 'مش مصرح');
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
    const invoices = LocalStore.get('purchase_invoices') || {};
    const suppliers = LocalStore.get('suppliers') || {};
    const list = Object.values(invoices).sort((a, b) => b.created_at - a.created_at);

    // Stats
    const today = new Date().toDateString();
    const todayInvoices = list.filter(i =>
      new Date(i.created_at).toDateString() === today && i.status !== 'cancelled'
    );
    const todayTotal = todayInvoices.reduce((sum, i) => sum + getInvoiceNet(i, 'purchase').netTotal, 0);
    const totalDebt = list
      .filter(i => i.status !== 'cancelled')
      .reduce((sum, i) => sum + i.remaining, 0);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🛒 المشتريات</div>
          <div class="page-subtitle">${list.length} فاتورة</div>
        </div>
        <div class="page-actions">
          ${hasPermission('purchases_add') ? `
          <button class="btn btn-primary" onclick="PurchasesModule.newInvoice()">
            ➕ فاتورة شراء جديدة
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-3" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">📊 مشتريات اليوم</div>
          <div class="stat-value">${fmtMoneyShort(todayTotal)} <span class="stat-currency">ج.م</span></div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">📄 فواتير اليوم</div>
          <div class="stat-value">${todayInvoices.length}</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">💸 مستحق للموردين</div>
          <div class="stat-value">${fmtMoneyShort(totalDebt)} <span class="stat-currency">ج.م</span></div>
        </div>
      </div>

      <!-- Search -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="grid grid-2">
          <div class="form-group" style="margin:0;">
            <input type="text" id="purSearch" placeholder="🔍 بحث بالرقم / المورد..."
                   oninput="PurchasesModule.filterList()">
          </div>
          <div class="form-group" style="margin:0;">
            <select id="purStatusFilter" onchange="PurchasesModule.filterList()">
              <option value="all">كل الحالات</option>
              <option value="paid">مدفوع</option>
              <option value="partial">جزئي</option>
              <option value="unpaid">غير مدفوع</option>
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
              <th>المورد</th>
              <th>الصنف</th>
              <th>المخزن</th>
              <th>الإجمالي</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody id="purTableBody">
            ${this.renderTableRows(list)}
          </tbody>
        </table>
      </div>
    `;
  },

  renderTableRows(list) {
    if (list.length === 0) {
      return `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--gray-500);">
        <div style="font-size:48px; margin-bottom:12px;">🛒</div>
        <div>لا توجد فواتير</div>
      </td></tr>`;
    }

    const suppliers = LocalStore.get('suppliers') || {};
    const warehouses = LocalStore.get('warehouses') || {};

    return list.map(inv => {
      const sup = suppliers[inv.supplier_id] || { name: inv.supplier_name_snapshot || '—' };
      const wh = warehouses[inv.warehouse_id] || { name: '—' };
      const cancelled = inv.status === 'cancelled';

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
      const net = getInvoiceNet(inv, 'purchase');

      return `
        <tr onclick="PurchasesModule.viewInvoice('${inv._id}')"
            style="cursor:pointer; ${cancelled ? 'opacity:0.6; text-decoration:line-through;' : ''}">
          <td><strong>${inv.invoice_number}</strong></td>
          <td>${fmtDate(inv.created_at)}</td>
          <td>${sup.name}</td>
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
          <td>${this.getStatusBadge(inv.status)}${this.getReturnBadge(inv._id, 'purchase')}</td>
        </tr>
      `;
    }).join('');
  },

  getStatusBadge(status) {
    const map = {
      'paid': '<span class="txn-badge" style="background:#D1FAE5;color:#065F46;">✅ مدفوع</span>',
      'partial': '<span class="txn-badge" style="background:#FEF3C7;color:#92400E;">⚠️ جزئي</span>',
      'unpaid': '<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;">🔴 غير مدفوع</span>',
      'cancelled': '<span class="txn-badge" style="background:#E5E7EB;color:#374151;">❌ ملغى</span>'
    };
    return map[status] || status;
  },

  // ==========================================================
  // ✅ Return status badge - يبين لو فاتورة عليها مرتجع
  // ==========================================================
  getReturnBadge(invoiceId, type = 'sales') {
    const returnsKey = type === 'sales' ? 'sales_returns' : 'purchase_returns';
    const returns = Object.values(LocalStore.get(returnsKey) || {})
      .filter(r => r.original_invoice_id === invoiceId);

    if (returns.length === 0) return '';

    const totalReturned = returns.reduce((sum, r) => sum + (r.total_returned || 0), 0);
    const label = returns.length === 1 ? 'مرتجع' : `${returns.length} مرتجعات`;

    return `<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;margin-right:4px;" title="إجمالي: ${fmtMoney(totalReturned)} ج.م">🔄 ${label}</span>`;
  },

  filterList() {
    const q = (document.getElementById('purSearch')?.value || '').toLowerCase();
    const status = document.getElementById('purStatusFilter')?.value || 'all';

    const invoices = LocalStore.get('purchase_invoices') || {};
    const suppliers = LocalStore.get('suppliers') || {};

    let list = Object.values(invoices).sort((a, b) => b.created_at - a.created_at);

    if (q) {
      list = list.filter(inv => {
        const sup = suppliers[inv.supplier_id] || {};
        return (inv.invoice_number || '').toLowerCase().includes(q) ||
               (sup.name || '').toLowerCase().includes(q);
      });
    }

    if (status !== 'all') {
      if (status === 'has_return') {
        // ✅ الفواتير اللي عليها مرتجعات
        const returns = Object.values(LocalStore.get('purchase_returns') || {});
        const returnedInvoiceIds = new Set(returns.map(r => r.original_invoice_id));
        list = list.filter(inv => returnedInvoiceIds.has(inv._id));
      } else {
        list = list.filter(inv => inv.status === status);
      }
    }

    const tbody = document.getElementById('purTableBody');
    if (tbody) tbody.innerHTML = this.renderTableRows(list);
  },

  // ==========================================================
  // View 2: Form (إضافة فاتورة جديدة)
  // ==========================================================
  newInvoice() {
    if (!requirePermission('purchases_add', 'إضافة فاتورة شراء')) return;
    this.formItems = [];
    this.currentView = 'form';
    this.render();
    setTimeout(() => this.addFormItem(), 100);
  },

  renderForm() {
    const container = document.getElementById('moduleContainer');
    const suppliers = Object.values(LocalStore.get('suppliers') || {})
      .filter(s => s.status !== 'blocked');
    const warehouses = Object.values(LocalStore.get('warehouses') || {})
      .filter(w => w.active !== false);
    const paymentMethods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;

    const previewNumber = previewInvoiceNumber('PUR');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🛒 فاتورة شراء جديدة</div>
          <div class="page-subtitle">رقم مبدئي: ${previewNumber}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" onclick="PurchasesModule.backToList()">← إلغاء</button>
        </div>
      </div>

      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">📋 بيانات الفاتورة</div>
        </div>

        <div class="grid grid-3">
          <div class="form-group">
            <label>المورد *</label>
            <select id="pur_supplier">
              <option value="">اختر مورد...</option>
              ${suppliers.map(s => `<option value="${s._id}">${s.name}</option>`).join('')}
            </select>
            ${suppliers.length === 0 ? '<small class="hint" style="color:var(--danger)">لا يوجد موردين - أضف مورد أول</small>' : ''}
          </div>

          <div class="form-group">
            <label>المخزن *</label>
            <select id="pur_warehouse">
              <option value="">اختر مخزن...</option>
              ${warehouses.map(w => `<option value="${w._id || w.id}">${w.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>التاريخ</label>
            <input type="date" id="pur_date" value="${new Date().toISOString().slice(0,10)}">
          </div>
        </div>
      </div>

      <!-- Items -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">📦 الأصناف</div>
          <button class="btn btn-primary btn-sm" onclick="PurchasesModule.addFormItem()">
            ➕ إضافة صنف
          </button>
        </div>

        <div id="itemsContainer"></div>

        <div style="margin-top:16px; padding-top:16px; border-top:2px dashed var(--gray-200);">
          <div class="grid grid-2">
            <div class="form-group">
              <label>خصم (ج.م)</label>
              <input type="number" id="pur_discount" step="0.01" value="0"
                     oninput="PurchasesModule.calcTotals()">
            </div>
            <div style="text-align:left; padding:10px;">
              <div style="font-size:14px; color:var(--gray-500);">الإجمالي:</div>
              <div style="font-size:28px; font-weight:800; color:var(--grape-700);" id="pur_grand_total">
                0.00 ج.م
              </div>
              <div style="font-size:12px; color:var(--gray-500);">
                (قبل الخصم: <span id="pur_subtotal">0.00</span> ج.م)
              </div>
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
            <select id="pur_payment_method" onchange="PurchasesModule.showPaymentDetails(this.value)">
              ${Object.entries(paymentMethods).filter(([k,v]) => v.enabled).map(([k, v]) =>
                `<option value="${k}">${v.icon || ''} ${v.label}</option>`
              ).join('')}
              <option value="none">💳 آجل (بدون دفع)</option>
            </select>
          </div>
          <div class="form-group">
            <label>المبلغ المدفوع</label>
            <input type="number" id="pur_paid" step="0.01" value="0"
                   oninput="PurchasesModule.calcTotals()">
          </div>
          <div style="text-align:left; padding:10px;">
            <div style="font-size:14px; color:var(--gray-500);">المتبقي:</div>
            <div style="font-size:24px; font-weight:800;" id="pur_remaining">
              0.00 ج.م
            </div>
          </div>
        </div>

        <!-- Payment Transfer Details -->
        <div id="pur_payment_details_box" style="display:none;"></div>
        <script>setTimeout(() => PurchasesModule.showPaymentDetails(document.getElementById('pur_payment_method')?.value), 100);</script>

        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-outline btn-sm" onclick="PurchasesModule.setPaidFull()">
            💯 دفع كامل
          </button>
          <button class="btn btn-outline btn-sm" onclick="PurchasesModule.setPaidZero()">
            🔴 آجل بالكامل
          </button>
        </div>

        <div class="form-group" style="margin-top:16px;">
          <label>ملاحظات</label>
          <textarea id="pur_notes" rows="2" placeholder="اختياري"></textarea>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="PurchasesModule.backToList()">إلغاء</button>
        <button class="btn btn-primary btn-lg" onclick="PurchasesModule.saveInvoice()">
          💾 حفظ الفاتورة
        </button>
      </div>
    `;

    // Render current items
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
        moduleName: 'PurchasesModule',
        showStock: false,          // في الشراء ما نحتاجش رصيد
        priceLabel: 'سعر الكيلو (شراء)'
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
      // سعر الشراء الافتراضي
      const products = LocalStore.get('products') || {};
      const p = products[value];
      if (p && (!item.unit_price || item.unit_price === 0)) {
        item.unit_price = p.default_purchase_price || 0;
      }
    } else if (field === 'unit_type') {
      item.unit_type = value;
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
      else if (value === 'custom') item.carton_weight = 7;
      else if (value === 'none') item.carton_weight = 0;
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
      ItemHelper.updateItemUI(idx, item, { showStock: false });
    }

    this.calcTotals();
  },

  calcTotals() {
    const subtotal = this.formItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const discount = Number(document.getElementById('pur_discount')?.value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    const paid = Number(document.getElementById('pur_paid')?.value) || 0;
    const remaining = Math.max(0, grandTotal - paid);

    document.getElementById('pur_subtotal').textContent = fmtMoney(subtotal);
    document.getElementById('pur_grand_total').textContent = fmtMoney(grandTotal) + ' ج.م';
    const remEl = document.getElementById('pur_remaining');
    remEl.textContent = fmtMoney(remaining) + ' ج.م';
    remEl.style.color = remaining > 0 ? 'var(--danger)' : 'var(--leaf-600)';
  },

  setPaidFull() {
    const subtotal = this.formItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const discount = Number(document.getElementById('pur_discount')?.value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    document.getElementById('pur_paid').value = grandTotal.toFixed(2);
    this.calcTotals();
  },

  setPaidZero() {
    document.getElementById('pur_paid').value = 0;
    document.getElementById('pur_payment_method').value = 'none';
    this.calcTotals();
  },

  // ==========================================================
  // Save Invoice (Core Business Logic)
  // ==========================================================
  saveInvoice() {
    if (!requirePermission('purchases_add', 'حفظ فاتورة شراء')) return;

    const supplier_id = document.getElementById('pur_supplier').value;
    const warehouse_id = document.getElementById('pur_warehouse').value;
    const date = document.getElementById('pur_date').value;
    const discount = Number(document.getElementById('pur_discount').value) || 0;
    const paid = Number(document.getElementById('pur_paid').value) || 0;
    const payment_method = document.getElementById('pur_payment_method').value;
    const notes = document.getElementById('pur_notes').value.trim();

    // Validation
    if (!supplier_id) return showNotif('❌ اختر المورد', 'danger');
    if (!warehouse_id) return showNotif('❌ اختر المخزن', 'danger');

    // إعادة حساب كل الـ items
    this.formItems.forEach(i => ItemHelper.compute(i));

    if (this.formItems.length === 0) return showNotif('❌ أضف صنف على الأقل', 'danger');

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

    // Generate serial number with user prefix
    const numGen = generateInvoiceNumber('PUR');
    const invoice_number = numGen.number;
    const invoice_id = genID('pur_');

    // Snapshots للـ rollback
    const suppliers = LocalStore.get('suppliers') || {};
    const supplier = suppliers[supplier_id];
    const products = LocalStore.get('products') || {};

    // Determine status
    let status = 'unpaid';
    if (paid >= grand_total) status = 'paid';
    else if (paid > 0) status = 'partial';

    // 1. أنشئ الفاتورة
    const items_snapshot = validItems.map(i => {
      const p = products[i.product_id] || {};
      const snap = ItemHelper.buildSnapshot(i, p);
      // ✅ لو وضع "بلا" - الوحدة كرتونة
      const isBala = i.unit_type === 'cartons' && Number(i.carton_weight) === 0;
      snap.unit_snapshot = isBala ? 'carton' : 'kg';
      snap.display_unit = isBala ? 'كرتونة' : 'كجم';
      return snap;
    });

    const invoice = {
      _id: invoice_id,
      uuid: genUUID(),
      invoice_number: invoice_number,
      supplier_id: supplier_id,
      supplier_name_snapshot: supplier?.name || '',
      warehouse_id: warehouse_id,
      date: date,
      items: items_snapshot,
      subtotal: subtotal,
      discount_total: discount,
      grand_total: grand_total,
      paid: paid,
      remaining: remaining,
      payment_method: paid > 0 ? payment_method : 'none',
      // ✅ بيانات الشيك (لو الدفع بشيك)
      cheque_number: (paid > 0 && payment_method === 'cheque') ? (document.getElementById('pur_cheque_number')?.value.trim() || '') : '',
      cheque_recipient: (paid > 0 && payment_method === 'cheque') ? (document.getElementById('pur_cheque_recipient')?.value.trim() || '') : '',
      cheque_due_date: (paid > 0 && payment_method === 'cheque') ? (document.getElementById('pur_cheque_due_date')?.value || '') : '',
      // ✅ مرجع التحويل البنكي
      bank_reference: (paid > 0 && payment_method === 'bank_account') ? (document.getElementById('pur_payment_ref')?.value.trim() || '') : '',
      status: status,
      cancelled_at: 0,
      cancelled_by: '',
      cancel_reason: '',
      created_by: currentUser._id,
      created_by_name: currentUser.name,
      created_at: Date.now(),
      updated_at: Date.now(),
      notes: notes
    };

    // 2. أنشئ transactions لكل صنف
    const createdTxns = [];
    for (const item of validItems) {
      const result = TxnEngine.addTransaction({
        type: 'purchase',
        warehouse_id: warehouse_id,
        product_id: item.product_id,
        quantity: item.qty,
        unit_cost: item.unit_price,
        reference_type: 'purchase_invoice',
        reference_id: invoice_id,
        reference_number: invoice_number,
        notes: `شراء - فاتورة ${invoice_number}`
      });

      if (!result.success) {
        // Rollback
        this._rollbackTransactions(createdTxns);
        return showNotif('❌ فشل حفظ الحركة: ' + result.error, 'danger');
      }
      createdTxns.push(result.txn_id);
    }

    // 3. سجل الدفعة (لو في)
    if (paid > 0) {
      const paymentId = genID('pay_');
      const payments = LocalStore.get('payments') || {};
      payments[paymentId] = {
        _id: paymentId,
        type: 'purchase_payment',
        supplier_id: supplier_id,
        invoice_id: invoice_id,
        invoice_number: invoice_number,
        amount: paid,
        method: payment_method,
        date: date,
        received_by: currentUser._id,
        notes: 'دفعة مع فاتورة الشراء',
        created_at: Date.now()
      };
      LocalStore.set('payments', payments);
    }

    // 4. احفظ الفاتورة
    const invoices = LocalStore.get('purchase_invoices') || {};
    invoices[invoice_id] = invoice;
    LocalStore.set('purchase_invoices', invoices);

    // 5. حدث المورد
    if (supplier) {
      supplier.cached_lifetime_purchases = (supplier.cached_lifetime_purchases || 0) + grand_total;
      supplier.cached_total_debt_to_them = (supplier.cached_total_debt_to_them || 0) + remaining;
      suppliers[supplier_id] = supplier;
      LocalStore.set('suppliers', suppliers);
    }

    // 6. زيادة العداد
    incrementInvoiceCounter(numGen.counterKey);

    // 7. Activity log
    logActivity('create', 'purchases', invoice_id, invoice_number, {
      supplier: supplier?.name,
      grand_total: grand_total,
      items_count: validItems.length
    });

    showNotif('✅ تم حفظ الفاتورة ' + invoice_number, 'success');

    // اذهب للتفاصيل
    this.currentView = 'detail';
    this.currentInvoiceId = invoice_id;
    this.render();
  },

  _rollbackTransactions(txnIds) {
    const txns = LocalStore.get('inventory_txns') || {};
    txnIds.forEach(id => {
      const txn = txns[id];
      if (txn) {
        // ارجع الرصيد للـ before
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
    const invoices = LocalStore.get('purchase_invoices') || {};
    const inv = invoices[id];
    if (!inv) {
      showNotif('❌ الفاتورة غير موجودة', 'danger');
      this.currentView = 'list';
      return this.render();
    }

    const suppliers = LocalStore.get('suppliers') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;

    const sup = suppliers[inv.supplier_id] || { name: inv.supplier_name_snapshot };
    const wh = warehouses[inv.warehouse_id] || { name: '—' };

    container.innerHTML = `
      <div class="page-header no-print">
        <div>
          <div class="page-title">🛒 ${inv.invoice_number}</div>
          <div class="page-subtitle">
            ${this.getStatusBadge(inv.status)}${this.getReturnBadge(inv._id, 'purchase')}
            ${inv.status === 'cancelled' ? '<span style="margin-right:8px; color:var(--danger);">سبب: ' + inv.cancel_reason + '</span>' : ''}
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="PurchasesModule.backToList()">← رجوع</button>
          <button class="btn btn-outline" onclick="window.print()">🖨️ طباعة</button>
          ${inv.status !== 'cancelled' && hasPermission('purchases_cancel') ? `
            <button class="btn btn-outline" onclick="switchModule('returns'); setTimeout(() => ReturnsModule.startFromInvoice('${id}', 'purchase'), 50);" style="border-color:var(--danger); color:var(--danger);">
              🔄 إرجاع
            </button>
          ` : ''}
          ${inv.status !== 'cancelled' ? `
            <button class="btn btn-gold" onclick="PurchasesModule.sendToHaj('${id}')">
              📱 للحاج
            </button>
          ` : ''}
          ${inv.status !== 'cancelled' && hasPermission('purchases_cancel') ? `
            <button class="btn btn-danger" onclick="PurchasesModule.cancelInvoice('${id}')">
              ❌ إلغاء الفاتورة
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Invoice Print View -->
      <div class="invoice-print">
        <!-- Header -->
        <div class="invoice-header">
          <div class="invoice-brand">
            <img src="assets/logo.png" alt="حموده" class="invoice-logo">
            <div>
              <div class="invoice-company">${company.name}</div>
              <div class="invoice-phone">📞 ${company.owner_phone}</div>
            </div>
          </div>
          <div class="invoice-number-box">
            <div class="invoice-label">فاتورة شراء</div>
            <div class="invoice-number">${inv.invoice_number}</div>
            <div class="invoice-date">${fmtDate(inv.created_at)}</div>
          </div>
        </div>

        <!-- Meta -->
        <div class="invoice-meta">
          <div><strong>المورد:</strong> ${sup.name}</div>
          <div><strong>التليفون:</strong> ${sup.phone || '—'}</div>
          <div><strong>المخزن:</strong> ${wh.name}</div>
          <div><strong>التاريخ:</strong> ${inv.date}</div>
        </div>

        <!-- Items table -->
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

        <!-- Totals -->
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
            const net = getInvoiceNet(inv, 'purchase');
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
                  <span>المدفوع (${this.getPaymentFullDescription(inv)}):</span>
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
                <span>المدفوع (${this.getPaymentFullDescription(inv)}):</span>
                <span>${fmtMoney(inv.paid)} ج.م</span>
              </div>
              <div class="invoice-total-row" style="color:${inv.remaining > 0 ? 'var(--danger)' : 'var(--leaf-600)'};">
                <span><strong>المتبقي:</strong></span>
                <span><strong>${fmtMoney(inv.remaining)} ج.م</strong></span>
              </div>
            `;
          })()}
        </div>

        ${inv.notes ? `
          <div class="invoice-notes">
            <strong>ملاحظات:</strong> ${inv.notes}
          </div>
        ` : ''}

        ${(() => {
          const returns = Object.values(LocalStore.get('purchase_returns') || {})
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
                  <div onclick="ReturnsModule.viewDetail('${r._id}', 'purchase'); switchModule('returns');"
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

        <!-- Footer -->
        <div class="invoice-footer">
          <div>سجل بواسطة: ${inv.created_by_name || '—'}</div>
          <div>${fmtDateTime(inv.created_at)}</div>
        </div>
      </div>
    `;
  },

  getPaymentMethodLabel(method) {
    const methods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;
    if (method === 'none') return 'آجل';
    const m = methods[method];
    if (!m) return method;
    return `${m.icon || ''} ${m.label}`.trim();
  },

  // ✅ وصف كامل للدفع - يشمل رقم الشيك أو مرجع التحويل
  getPaymentFullDescription(inv) {
    const method = inv.payment_method;
    if (!method || method === 'none') return 'آجل';

    const label = this.getPaymentMethodLabel(method);

    if (method === 'cheque' && inv.cheque_number) {
      let desc = `${label} رقم ${inv.cheque_number}`;
      if (inv.cheque_recipient) desc += ` - ${inv.cheque_recipient}`;
      if (inv.cheque_due_date) desc += ` (استحقاق: ${inv.cheque_due_date})`;
      return desc;
    }

    if (method === 'bank_account' && inv.bank_reference) {
      return `${label} - مرجع: ${inv.bank_reference}`;
    }

    return label;
  },

  // ==========================================================
  // إرسال للحاج (فاتورة شراء + رصيد المخزن)
  // ==========================================================
  sendToHaj(invoiceId) {
    const invoices = LocalStore.get('purchase_invoices') || {};
    const inv = invoices[invoiceId];
    if (!inv) return;

    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;
    const hajPhone = company.owner_phone || '01004975602';

    const suppliers = LocalStore.get('suppliers') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const sup = suppliers[inv.supplier_id] || { name: inv.supplier_name_snapshot };
    const wh = warehouses[inv.warehouse_id] || { name: '—' };

    // رصيد المخزن الحالي
    const whInventory = TxnEngine.getWarehouseInventory(inv.warehouse_id);
    const whTotalValue = whInventory.reduce((sum, i) => sum + i.stock_value, 0);
    const whTotalItems = whInventory.filter(i => i.current_stock > 0).length;

    const itemsDetail = inv.items.map((item, i) => {
      const unitInfo = getItemUnitInfo(item);
      let detail = `${i + 1}. ${item.product_name_snapshot}`;
      if (item.unit_type === 'cartons') {
        if (unitInfo.isBala) {
          detail += `\n   📦 ${item.cartons_count} ${unitInfo.productUnit}`;
        } else {
          detail += `\n   📦 ${item.cartons_count} ${unitInfo.vesselName} × ${item.carton_weight} كجم = ${fmtMoney(item.qty)} كجم`;
        }
      } else {
        detail += `\n   ⚖️ سيارة ${item.car_number || '—'}: ${fmtMoney(item.qty)} كجم صافي`;
      }
      detail += `\n   💰 ${fmtMoney(item.unit_price)} ج.م/${unitInfo.unitLabel} = ${fmtMoney(item.total)} ج.م`;
      return detail;
    }).join('\n\n');

    const msg = `🛒 *فاتورة شراء* — ${inv.invoice_number}
━━━━━━━━━━━━━━
📅 ${fmtDateTime(inv.created_at)}

🏭 المورد: ${sup.name}
📞 ${sup.phone || '—'}
🏢 المخزن: ${wh.name}

*الأصناف:*
${itemsDetail}
━━━━━━━━━━━━━━
${(() => {
  const _n = getInvoiceNet(inv, 'purchase');
  if (_n.hasReturns) {
    return `💰 الإجمالي الأصلي: ${fmtMoney(_n.originalTotal)} ج.م
🔄 مرتجعات (${_n.returnsCount}): -${fmtMoney(_n.totalReturned)} ج.م
💎 الصافي: *${fmtMoney(_n.netTotal)} ج.م*
✅ المدفوع: ${fmtMoney(_n.paid)} ج.م (${this.getPaymentFullDescription(inv)})
🔴 المتبقي: *${fmtMoney(_n.remaining)} ج.م*`;
  }
  return `💰 الإجمالي: *${fmtMoney(inv.grand_total)} ج.م*
✅ المدفوع: ${fmtMoney(inv.paid)} ج.م (${this.getPaymentFullDescription(inv)})
🔴 المتبقي: *${fmtMoney(inv.remaining)} ج.م*`;
})()}

━━━━━━━━━━━━━━
📦 *المخزن بعد العملية:*
🏢 ${wh.name}
📊 ${whTotalItems} صنف
💎 قيمة المخزون: ${fmtMoney(whTotalValue)} ج.م

━━━━━━━━━━━━━━
👤 سجل بواسطة: ${inv.created_by_name || '—'}
${inv.notes ? '\n📝 ملاحظات: ' + inv.notes : ''}`;

    let phone = hajPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone;
    else if (!phone.startsWith('2')) phone = '2' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

    logActivity('whatsapp_haj', 'purchases', invoiceId, inv.invoice_number, {});

    window.open(url, '_blank');
    showNotif('📱 جاري فتح واتساب للحاج...', 'info');
  },

  // ==========================================================
  // Cancel Invoice
  // ==========================================================
  cancelInvoice(id) {
    if (!requirePermission('purchases_cancel', 'إلغاء فاتورة')) return;

    const reason = prompt('سبب الإلغاء (مطلوب - على الأقل 5 حروف):');
    if (!reason || reason.trim().length < 5) {
      return showNotif('❌ سبب الإلغاء مطلوب', 'danger');
    }

    if (!confirm('⚠️ هل أنت متأكد؟ سيتم إرجاع البضاعة من المخزون.')) return;

    const invoices = LocalStore.get('purchase_invoices') || {};
    const inv = invoices[id];
    if (!inv) return showNotif('❌ الفاتورة غير موجودة', 'danger');
    if (inv.status === 'cancelled') return showNotif('⚠️ الفاتورة ملغية بالفعل', 'warning');

    // Reverse transactions لكل item
    for (const item of inv.items) {
      const result = TxnEngine.addTransaction({
        type: 'purchase_cancel',
        warehouse_id: inv.warehouse_id,
        product_id: item.product_id,
        quantity: item.qty,
        reference_type: 'purchase_invoice_cancel',
        reference_id: id,
        reference_number: inv.invoice_number,
        notes: 'إلغاء فاتورة ' + inv.invoice_number + ' — ' + reason
      });

      if (!result.success && !result.insufficient_stock) {
        return showNotif('❌ فشل في إلغاء حركة: ' + result.error, 'danger');
      }
      // لو الرصيد أقل من المطلوب، نسمح بالإلغاء (allow_negative)
      if (result.insufficient_stock) {
        TxnEngine.addTransaction({
          type: 'purchase_cancel',
          warehouse_id: inv.warehouse_id,
          product_id: item.product_id,
          quantity: item.qty,
          allow_negative: true,
          reference_type: 'purchase_invoice_cancel',
          reference_id: id,
          reference_number: inv.invoice_number,
          notes: 'إلغاء (رصيد قد يصبح سالب) - ' + reason
        });
      }
    }

    // حدث الفاتورة
    const before = { ...inv };
    inv.status = 'cancelled';
    inv.cancelled_at = Date.now();
    inv.cancelled_by = currentUser._id;
    inv.cancel_reason = reason.trim();
    invoices[id] = inv;
    LocalStore.set('purchase_invoices', invoices);

    // حدث المورد
    const suppliers = LocalStore.get('suppliers') || {};
    const sup = suppliers[inv.supplier_id];
    if (sup) {
      sup.cached_lifetime_purchases = Math.max(0, (sup.cached_lifetime_purchases || 0) - inv.grand_total);
      sup.cached_total_debt_to_them = Math.max(0, (sup.cached_total_debt_to_them || 0) - inv.remaining);
      suppliers[inv.supplier_id] = sup;
      LocalStore.set('suppliers', suppliers);
    }

    logActivity('cancel', 'purchases', id, inv.invoice_number, {
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
  // ==========================================================
  // 💳 عرض تفاصيل التحويل عند اختيار طريقة الدفع
  // ==========================================================
  showPaymentDetails(methodKey) {
    const box = document.getElementById('pur_payment_details_box');
    if (!box) return;

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

    const isBank = method.is_bank;
    const isCheque = method.is_cheque;

    // فحص لو الطريقة مضبوطة
    let isConfigured;
    if (isBank) isConfigured = method.bank_name && method.account_number && method.recipient_name;
    else if (isCheque) isConfigured = method.recipient_name;
    else isConfigured = method.phone && method.recipient_name;

    if (!isConfigured) {
      box.style.display = 'block';
      box.innerHTML = `
        <div style="padding:12px; background:#FEF3C7; border:1px solid #F59E0B; border-radius:var(--radius); margin-top:8px; font-size:13px;">
          ⚠️ <strong>${method.label} ما اتضبطش:</strong>
          محتاج تحدد البيانات من
          <a href="#" onclick="switchModule('settings'); setTimeout(() => SettingsModule.switchTab('payment'), 100); return false;" style="color:var(--grape-700); font-weight:700;">الإعدادات → طرق الدفع</a>
        </div>
      `;
      return;
    }

    box.style.display = 'block';

    // 🏛️ حساب بنكي
    if (isBank) {
      box.innerHTML = `
        <div style="padding:14px; background:#F0FDF4; border:1px solid var(--leaf-400); border-radius:var(--radius); margin-top:8px;">
          <div style="font-weight:700; color:var(--leaf-700); font-size:14px; margin-bottom:8px;">
            💳 بيانات التحويل - ${method.icon} ${method.label}
          </div>
          <div style="display:grid; gap:6px; font-size:14px;">
            <div>
              <span style="color:var(--gray-600);">🏛️ البنك:</span>
              <strong style="margin-right:8px;">${method.bank_name}</strong>
            </div>
            <div>
              <span style="color:var(--gray-600);">🔢 الحساب:</span>
              <strong style="direction:ltr; display:inline-block; font-size:16px; margin-right:8px; color:var(--grape-700);">${method.account_number}</strong>
              <button type="button" class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${method.account_number}'); showNotif('✅ اتنسخ الرقم','success')">📋</button>
            </div>
            <div>
              <span style="color:var(--gray-600);">👤 المستفيد:</span>
              <strong style="margin-right:8px;">${method.recipient_name}</strong>
            </div>
            ${method.notes ? `
              <div style="padding:8px; background:white; border-radius:var(--radius); margin-top:4px;">
                📝 ${method.notes}
              </div>
            ` : ''}
          </div>
          <div class="form-group" style="margin-top:12px; margin-bottom:0;">
            <label>📌 مرجع التحويل (اختياري)</label>
            <input type="text" id="pur_payment_ref" placeholder="رقم مرجع التحويل البنكي"
                   style="width:100%; padding:8px 12px; border:1px solid var(--gray-300); border-radius:6px;">
          </div>
        </div>
      `;
      return;
    }

    // 📄 شيك
    if (isCheque) {
      box.innerHTML = `
        <div style="padding:14px; background:#FEF3C7; border:1px solid #F59E0B; border-radius:var(--radius); margin-top:8px;">
          <div style="font-weight:700; color:#92400E; font-size:14px; margin-bottom:8px;">
            📄 بيانات الشيك
          </div>
          <div style="display:grid; gap:10px; font-size:14px;">
            <div class="form-group" style="margin:0;">
              <label>🔢 رقم الشيك *</label>
              <input type="text" id="pur_cheque_number" placeholder="رقم الشيك"
                     style="width:100%; padding:10px 12px; border:1px solid var(--gray-300); border-radius:6px; font-size:15px;">
            </div>
            <div class="form-group" style="margin:0;">
              <label>👤 اسم المستفيد</label>
              <input type="text" id="pur_cheque_recipient" value="${method.recipient_name || ''}" placeholder="اسم المستفيد"
                     style="width:100%; padding:10px 12px; border:1px solid var(--gray-300); border-radius:6px; font-size:15px;">
            </div>
            <div class="form-group" style="margin:0;">
              <label>📅 تاريخ استحقاق الشيك (اختياري)</label>
              <input type="date" id="pur_cheque_due_date"
                     style="width:100%; padding:10px 12px; border:1px solid var(--gray-300); border-radius:6px; font-size:15px;">
            </div>
            ${method.notes ? `
              <div style="padding:8px; background:white; border-radius:var(--radius); font-size:13px;">
                📝 ${method.notes}
              </div>
            ` : ''}
          </div>
        </div>
      `;
      return;
    }

    // 🏦 المحافظ الإلكترونية
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
