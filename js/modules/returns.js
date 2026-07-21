// ==========================================================
// Returns Module - المرتجعات (مبيعات + مشتريات)
// ==========================================================

const ReturnsModule = {

  currentView: 'list',           // list | form | detail
  currentReturnId: null,
  currentReturnType: null,       // 'sales' | 'purchase'
  currentSourceInvoiceId: null,
  formItems: [],                 // items being returned
  refundMethod: 'cash',          // cash | credit_deducted
  filterType: 'all',             // all | sales | purchase

  render() {
    if (!requirePermission('purchases_view', 'مشاهدة المرتجعات') && !requirePermission('sales_view', 'مشاهدة المرتجعات')) {
      return renderPlaceholder('🔄 المرتجعات', 'مش مصرح');
    }

    if (this.currentView === 'form') return this.renderForm();
    if (this.currentView === 'detail') return this.renderDetail(this.currentReturnId);
    return this.renderList();
  },

  // ==========================================================
  // View 1: List — كل المرتجعات
  // ==========================================================
  renderList() {
    const container = document.getElementById('moduleContainer');
    const salesReturns = Object.values(LocalStore.get('sales_returns') || {});
    const purchaseReturns = Object.values(LocalStore.get('purchase_returns') || {});

    // اجمع كل المرتجعات مع تحديد النوع
    let all = [
      ...salesReturns.map(r => ({ ...r, _type: 'sales' })),
      ...purchaseReturns.map(r => ({ ...r, _type: 'purchase' }))
    ].sort((a, b) => b.created_at - a.created_at);

    // فلترة
    if (this.filterType !== 'all') {
      all = all.filter(r => r._type === this.filterType);
    }

    // إحصائيات
    const today = new Date().toDateString();
    const todayReturns = all.filter(r => new Date(r.created_at).toDateString() === today);
    const totalSalesReturns = salesReturns.reduce((sum, r) => sum + (r.total_returned || 0), 0);
    const totalPurchaseReturns = purchaseReturns.reduce((sum, r) => sum + (r.total_returned || 0), 0);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🔄 المرتجعات</div>
          <div class="page-subtitle">${all.length} مرتجع</div>
        </div>
        <div class="page-actions">
          ${hasPermission('sales_cancel') ? `
          <button class="btn btn-primary" onclick="ReturnsModule.chooseSourceInvoice('sales')">
            💰 مرتجع بيع
          </button>
          ` : ''}
          ${hasPermission('purchases_cancel') ? `
          <button class="btn btn-secondary" onclick="ReturnsModule.chooseSourceInvoice('purchase')">
            🛒 مرتجع شراء
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-3" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">📊 مرتجعات اليوم</div>
          <div class="stat-value">${todayReturns.length}</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">💰 مرتجعات مبيعات</div>
          <div class="stat-value">${fmtMoney(totalSalesReturns)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${salesReturns.length} مرتجع</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">🛒 مرتجعات مشتريات</div>
          <div class="stat-value">${fmtMoney(totalPurchaseReturns)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${purchaseReturns.length} مرتجع</div>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="tabs" style="margin-bottom: 16px;">
        <button class="tab-btn ${this.filterType === 'all' ? 'active' : ''}"
                onclick="ReturnsModule.setFilter('all')">
          🌐 الكل (${salesReturns.length + purchaseReturns.length})
        </button>
        <button class="tab-btn ${this.filterType === 'sales' ? 'active' : ''}"
                onclick="ReturnsModule.setFilter('sales')">
          💰 مرتجعات مبيعات (${salesReturns.length})
        </button>
        <button class="tab-btn ${this.filterType === 'purchase' ? 'active' : ''}"
                onclick="ReturnsModule.setFilter('purchase')">
          🛒 مرتجعات مشتريات (${purchaseReturns.length})
        </button>
      </div>

      <!-- Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>الرقم</th>
              <th>النوع</th>
              <th>التاريخ</th>
              <th>الطرف الآخر</th>
              <th>المخزن</th>
              <th>الفاتورة الأصلية</th>
              <th>الأصناف</th>
              <th>الإجمالي</th>
              <th>طريقة الاسترداد</th>
            </tr>
          </thead>
          <tbody>
            ${all.length === 0 ? `
              <tr><td colspan="9" style="text-align:center; padding:40px; color:var(--gray-500);">
                <div style="font-size:48px; margin-bottom:12px;">🔄</div>
                <div>لا توجد مرتجعات</div>
              </td></tr>
            ` : all.map(r => this.renderRow(r)).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderRow(r) {
    const customers = LocalStore.get('customers') || {};
    const suppliers = LocalStore.get('suppliers') || {};
    const warehouses = LocalStore.get('warehouses') || {};

    const otherParty = r._type === 'sales'
      ? (customers[r.customer_id]?.name || r.customer_name_snapshot || '—')
      : (suppliers[r.supplier_id]?.name || r.supplier_name_snapshot || '—');

    const wh = warehouses[r.warehouse_id] || { name: '—' };

    const typeBadge = r._type === 'sales'
      ? '<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;">💰 مرتجع بيع</span>'
      : '<span class="txn-badge" style="background:#D1FAE5;color:#065F46;">🛒 مرتجع شراء</span>';

    const refundLabel = r.refund_method === 'cash' ? '💵 كاش' : '📉 خصم من المديونية';

    // ✅ ملخص الأصناف - يعرض الاسم بدل العدد
    const items = r.items || [];
    let productsSummary = '—';
    if (items.length > 0) {
      const firstName = items[0].product_name_snapshot || '—';
      if (items.length === 1) {
        productsSummary = `<strong>${firstName}</strong>`;
      } else {
        productsSummary = `<strong>${firstName}</strong> <span style="color:var(--gray-500); font-size:12px;">+ ${items.length - 1} صنف</span>`;
      }
    }

    return `
      <tr onclick="ReturnsModule.viewDetail('${r._id}', '${r._type}')" style="cursor:pointer;">
        <td><strong>${r.return_number}</strong></td>
        <td>${typeBadge}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td>${otherParty}</td>
        <td>${wh.name}</td>
        <td>${r.original_invoice_number || '—'}</td>
        <td>${productsSummary}</td>
        <td><strong>${fmtMoney(r.total_returned)}</strong> ج.م</td>
        <td>${refundLabel}</td>
      </tr>
    `;
  },

  setFilter(type) {
    this.filterType = type;
    this.render();
  },

  // ==========================================================
  // اختيار الفاتورة الأصلية للمرتجع
  // ==========================================================
  chooseSourceInvoice(type) {
    const invoicesObj = LocalStore.get(type === 'sales' ? 'sales_invoices' : 'purchase_invoices') || {};
    const invoices = Object.values(invoicesObj)
      .filter(inv => inv.status !== 'cancelled')
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 100); // آخر 100 فاتورة

    const customers = LocalStore.get('customers') || {};
    const suppliers = LocalStore.get('suppliers') || {};

    const modalHtml = `
      <div id="chooseInvoiceModal" class="modal-overlay">
        <div class="modal" style="max-width: 700px;">
          <div class="modal-header">
            <h3>${type === 'sales' ? '💰 اختر فاتورة البيع' : '🛒 اختر فاتورة الشراء'}</h3>
            <button class="modal-close" onclick="ReturnsModule.closeChooseModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <input type="text" id="inv_search"
                     placeholder="🔍 ابحث برقم الفاتورة أو اسم ${type === 'sales' ? 'العميل' : 'المورد'}..."
                     oninput="ReturnsModule.filterInvoiceChoices('${type}')">
            </div>

            <div class="table-container" style="max-height:400px; overflow-y:auto; box-shadow:none; border:1px solid var(--gray-200);">
              <table>
                <thead>
                  <tr>
                    <th>الرقم</th>
                    <th>التاريخ</th>
                    <th>${type === 'sales' ? 'العميل' : 'المورد'}</th>
                    <th>الإجمالي</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="invoiceChoicesBody">
                  ${invoices.map(inv => {
                    const party = type === 'sales'
                      ? (customers[inv.customer_id]?.name || inv.customer_name_snapshot || '—')
                      : (suppliers[inv.supplier_id]?.name || inv.supplier_name_snapshot || '—');
                    return `
                      <tr class="inv-choice-row" data-search="${inv.invoice_number} ${party}">
                        <td><strong>${inv.invoice_number}</strong></td>
                        <td>${fmtDate(inv.created_at)}</td>
                        <td>${party}</td>
                        <td>${fmtMoney(inv.grand_total)} ج.م</td>
                        <td>
                          <button class="btn btn-primary btn-sm" onclick="ReturnsModule.startFromInvoice('${inv._id}', '${type}')">
                            🔄 مرتجع من هذه
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              ${invoices.length === 0 ? '<div style="text-align:center; padding:30px; color:var(--gray-500);">لا توجد فواتير</div>' : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost btn-full" onclick="ReturnsModule.closeChooseModal()">إلغاء</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('chooseInvoiceModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  closeChooseModal() {
    document.getElementById('chooseInvoiceModal')?.remove();
  },

  filterInvoiceChoices(type) {
    const q = (document.getElementById('inv_search').value || '').toLowerCase().trim();
    document.querySelectorAll('.inv-choice-row').forEach(row => {
      const search = row.getAttribute('data-search').toLowerCase();
      row.style.display = search.includes(q) ? '' : 'none';
    });
  },

  // ==========================================================
  // Start Return Form
  // ==========================================================
  startFromInvoice(invoiceId, type) {
    this.closeChooseModal();

    const storageKey = type === 'sales' ? 'sales_invoices' : 'purchase_invoices';
    const invoices = LocalStore.get(storageKey) || {};
    const inv = invoices[invoiceId];
    if (!inv) return showNotif('❌ الفاتورة غير موجودة', 'danger');

    // تحقق: كام رجع فعلاً من كل صنف قبل كده؟
    const previousReturns = this.getReturnsForInvoice(invoiceId, type);
    const returnedMap = {};
    previousReturns.forEach(r => {
      r.items.forEach(item => {
        returnedMap[item.product_id] = (returnedMap[item.product_id] || 0) + item.qty_returned;
      });
    });

    // احسب الكميات المتاحة للمرتجع
    this.currentReturnType = type;
    this.currentSourceInvoiceId = invoiceId;
    this.formItems = inv.items.map(item => ({
      product_id: item.product_id,
      product_name_snapshot: item.product_name_snapshot,
      sku_snapshot: item.sku_snapshot,
      unit_snapshot: item.unit_snapshot || 'kg',
      original_qty: item.qty,
      already_returned: returnedMap[item.product_id] || 0,
      max_returnable: item.qty - (returnedMap[item.product_id] || 0),
      qty_to_return: 0,
      unit_price: item.unit_price,
      total: 0,
      reason: '',
      selected: false
    }));
    this.refundMethod = inv.remaining > 0 ? 'credit_deducted' : 'cash';
    this.currentView = 'form';
    this.render();
  },

  getReturnsForInvoice(invoiceId, type) {
    const returns = Object.values(LocalStore.get(type === 'sales' ? 'sales_returns' : 'purchase_returns') || {});
    return returns.filter(r => r.original_invoice_id === invoiceId);
  },

  // ==========================================================
  // View 2: Form
  // ==========================================================
  renderForm() {
    const container = document.getElementById('moduleContainer');
    const type = this.currentReturnType;
    const storageKey = type === 'sales' ? 'sales_invoices' : 'purchase_invoices';
    const invoices = LocalStore.get(storageKey) || {};
    const inv = invoices[this.currentSourceInvoiceId];

    if (!inv) {
      showNotif('❌ الفاتورة الأصلية غير موجودة', 'danger');
      this.currentView = 'list';
      return this.render();
    }

    const customers = LocalStore.get('customers') || {};
    const suppliers = LocalStore.get('suppliers') || {};
    const warehouses = LocalStore.get('warehouses') || {};

    const otherParty = type === 'sales'
      ? customers[inv.customer_id]
      : suppliers[inv.supplier_id];
    const wh = warehouses[inv.warehouse_id] || { name: '—' };

    const previewNumber = previewInvoiceNumber(type === 'sales' ? 'RTS' : 'RTP');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🔄 ${type === 'sales' ? 'مرتجع بيع' : 'مرتجع شراء'}</div>
          <div class="page-subtitle">رقم مبدئي: ${previewNumber}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" onclick="ReturnsModule.backToList()">← إلغاء</button>
        </div>
      </div>

      <!-- Original Invoice Info -->
      <div class="card" style="margin-bottom: 16px; background: linear-gradient(135deg, #F5F3FF, #FAFAFA);">
        <div class="card-header">
          <div class="card-title">📄 الفاتورة الأصلية: ${inv.invoice_number}</div>
        </div>
        <div class="grid grid-4" style="font-size:14px;">
          <div><strong>${type === 'sales' ? 'العميل' : 'المورد'}:</strong> ${otherParty?.name || '—'}</div>
          <div><strong>التليفون:</strong> ${otherParty?.phone || '—'}</div>
          <div><strong>المخزن:</strong> ${wh.name}</div>
          <div><strong>تاريخ الفاتورة:</strong> ${fmtDate(inv.created_at)}</div>
          <div><strong>الإجمالي:</strong> ${fmtMoney(inv.grand_total)} ج.م</div>
          <div><strong>المدفوع:</strong> ${fmtMoney(inv.paid)} ج.م</div>
          <div><strong>المتبقي:</strong> ${fmtMoney(inv.remaining)} ج.م</div>
          <div><strong>الحالة:</strong> ${PurchasesModule.getStatusBadge(inv.status)}</div>
        </div>
      </div>

      <!-- Items to Return -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">📦 اختر الأصناف والكميات المرتجعة</div>
          <div class="card-subtitle">حدد الأصناف اللي بترجع + الكمية</div>
        </div>

        <div id="returnItemsContainer">
          ${this.renderFormItems()}
        </div>

        <div style="margin-top:16px; padding-top:16px; border-top:2px dashed var(--gray-200); text-align:left;">
          <div style="font-size:14px; color:var(--gray-500);">إجمالي المرتجع:</div>
          <div style="font-size:28px; font-weight:800; color:var(--danger);" id="returnGrandTotal">
            0.00 ج.م
          </div>
        </div>
      </div>

      <!-- Refund Method -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">💵 طريقة الاسترداد</div>
        </div>

        <div class="unit-type-toggle" style="max-width:500px;">
          <label class="unit-type-option ${this.refundMethod === 'cash' ? 'selected' : ''}">
            <input type="radio" name="refund_method" value="cash"
                   ${this.refundMethod === 'cash' ? 'checked' : ''}
                   onchange="ReturnsModule.setRefundMethod('cash')">
            <span>💵 استرداد كاش</span>
          </label>
          <label class="unit-type-option ${this.refundMethod === 'credit_deducted' ? 'selected' : ''}">
            <input type="radio" name="refund_method" value="credit_deducted"
                   ${this.refundMethod === 'credit_deducted' ? 'checked' : ''}
                   onchange="ReturnsModule.setRefundMethod('credit_deducted')">
            <span>📉 خصم من ${type === 'sales' ? 'مديونية العميل' : 'مستحقات المورد'}</span>
          </label>
        </div>

        <div style="padding:12px; background:${this.refundMethod === 'cash' ? '#FEF3C7' : '#EDE9FE'}; border-radius:var(--radius); margin-top:12px; font-size:13px;">
          ${this.refundMethod === 'cash'
            ? `💡 <strong>استرداد كاش:</strong> المبلغ ${type === 'sales' ? 'يرجع للعميل نقداً' : 'يرجعه المورد لك نقداً'} - يتسجل payment refund`
            : `💡 <strong>خصم من ${type === 'sales' ? 'المديونية' : 'المستحقات'}:</strong> يقلل ${type === 'sales' ? 'مديونية العميل' : 'مستحقك عند المورد'} بمقدار المرتجع`
          }
        </div>

        <div class="form-group" style="margin-top:16px;">
          <label>ملاحظات عامة</label>
          <textarea id="return_notes" rows="2" placeholder="سبب عام للمرتجع (اختياري)"></textarea>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="ReturnsModule.backToList()">إلغاء</button>
        <button class="btn btn-danger btn-lg" onclick="ReturnsModule.saveReturn()">
          🔄 حفظ المرتجع
        </button>
      </div>
    `;
  },

  renderFormItems() {
    if (this.formItems.length === 0) {
      return '<div style="text-align:center; padding:30px; color:var(--gray-500);">لا توجد أصناف</div>';
    }

    return this.formItems.map((item, idx) => {
      const isDisabled = item.max_returnable <= 0;
      return `
        <div class="return-item-card ${item.selected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
             data-return-idx="${idx}">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div style="flex:0 0 auto; padding-top:6px;">
              <input type="checkbox" ${item.selected ? 'checked' : ''}
                     ${isDisabled ? 'disabled' : ''}
                     onchange="ReturnsModule.toggleItem(${idx}, this.checked)"
                     style="width:20px; height:20px;">
            </div>

            <div style="flex:1;">
              <div style="font-weight:700; font-size:15px; color:var(--gray-800);">
                ${item.product_name_snapshot}
                ${item.sku_snapshot ? '<small style="color:var(--gray-500); margin-right:8px;">' + item.sku_snapshot + '</small>' : ''}
              </div>

              <div style="display:flex; gap:16px; margin-top:6px; font-size:13px; flex-wrap:wrap;">
                <div>
                  <span style="color:var(--gray-500);">الكمية الأصلية:</span>
                  <strong>${fmtMoney(item.original_qty)}</strong> ${getProductUnitName(item.product_id) || 'كجم'}
                </div>
                ${item.already_returned > 0 ? `
                  <div>
                    <span style="color:var(--gray-500);">رجع قبل كده:</span>
                    <strong style="color:var(--warning);">${fmtMoney(item.already_returned)}</strong> ${getProductUnitName(item.product_id) || 'كجم'}
                  </div>
                ` : ''}
                <div>
                  <span style="color:var(--gray-500);">المتاح للإرجاع:</span>
                  <strong style="color:${item.max_returnable > 0 ? 'var(--leaf-700)' : 'var(--danger)'};">
                    ${fmtMoney(item.max_returnable)}
                  </strong> ${getProductUnitName(item.product_id) || 'كجم'}
                </div>
                <div>
                  <span style="color:var(--gray-500);">السعر:</span>
                  <strong>${fmtMoney(item.unit_price)}</strong> ج.م/${getProductUnitName(item.product_id) || 'كجم'}
                </div>
              </div>

              ${item.selected && !isDisabled ? `
                <div class="grid grid-2" style="margin-top:10px;">
                  <div class="form-group" style="margin:0;">
                    <label>الكمية المرتجعة (${getProductUnitName(item.product_id) || 'كجم'})</label>
                    <div style="display:flex; gap:6px;">
                      <input type="number" step="0.01" max="${item.max_returnable}"
                             value="${item.qty_to_return || ''}"
                             placeholder="الكمية"
                             oninput="ReturnsModule.updateReturnQty(${idx}, this.value)">
                      <button class="btn btn-outline btn-sm" style="white-space:nowrap;"
                              onclick="ReturnsModule.setMaxQty(${idx})">
                        كامل
                      </button>
                    </div>
                    <small class="hint">الأقصى: ${fmtMoney(item.max_returnable)} ${getProductUnitName(item.product_id) || 'كجم'}</small>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label>سبب الإرجاع</label>
                    <input type="text" value="${item.reason || ''}"
                           placeholder="مثل: تالف، مش مطابق للمواصفات..."
                           oninput="ReturnsModule.updateReturnReason(${idx}, this.value)">
                  </div>
                </div>

                <div style="text-align:left; margin-top:10px; padding:8px; background:#FEE2E2; border-radius:var(--radius);">
                  <span style="color:var(--gray-600); font-size:13px;">قيمة المرتجع لهذا الصنف:</span>
                  <strong style="color:var(--danger); font-size:16px; margin-right:8px;">
                    ${fmtMoney(item.total || 0)} ج.م
                  </strong>
                </div>
              ` : ''}

              ${isDisabled ? `
                <div style="margin-top:8px; padding:8px; background:#FEF3C7; border-radius:var(--radius); font-size:13px; color:#92400E;">
                  ⚠️ الكمية اترجعت بالكامل من قبل
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleItem(idx, selected) {
    const item = this.formItems[idx];
    if (!item) return;
    item.selected = selected;
    if (!selected) {
      item.qty_to_return = 0;
      item.total = 0;
      item.reason = '';
    }
    this.rerenderItems();
    this.updateGrandTotal();
  },

  updateReturnQty(idx, value) {
    const item = this.formItems[idx];
    if (!item) return;
    let qty = Number(value) || 0;
    if (qty > item.max_returnable) qty = item.max_returnable;
    item.qty_to_return = qty;
    item.total = qty * item.unit_price;
    this.updateItemTotalDisplay(idx);
    this.updateGrandTotal();
  },

  setMaxQty(idx) {
    const item = this.formItems[idx];
    if (!item) return;
    item.qty_to_return = item.max_returnable;
    item.total = item.max_returnable * item.unit_price;
    this.rerenderItems();
    this.updateGrandTotal();
  },

  updateReturnReason(idx, value) {
    if (this.formItems[idx]) this.formItems[idx].reason = value;
  },

  rerenderItems() {
    const container = document.getElementById('returnItemsContainer');
    if (container) container.innerHTML = this.renderFormItems();
  },

  updateItemTotalDisplay(idx) {
    const card = document.querySelector(`[data-return-idx="${idx}"]`);
    if (!card) return;
    const totalEl = card.querySelector('strong[style*="font-size:16px"]');
    if (totalEl && this.formItems[idx]) {
      totalEl.textContent = fmtMoney(this.formItems[idx].total || 0) + ' ج.م';
    }
  },

  updateGrandTotal() {
    const total = this.formItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const el = document.getElementById('returnGrandTotal');
    if (el) el.textContent = fmtMoney(total) + ' ج.م';
  },

  setRefundMethod(method) {
    this.refundMethod = method;
    this.render();
  },

  // ==========================================================
  // Save Return (Core Business Logic)
  // ==========================================================
  saveReturn() {
    const type = this.currentReturnType;
    const validItems = this.formItems.filter(i => i.selected && i.qty_to_return > 0);

    if (validItems.length === 0) {
      return showNotif('❌ اختر صنف واحد على الأقل وحدد كمية للإرجاع', 'danger');
    }

    const notes = document.getElementById('return_notes')?.value.trim() || '';
    const totalReturned = validItems.reduce((sum, i) => sum + i.total, 0);

    const storageKey = type === 'sales' ? 'sales_invoices' : 'purchase_invoices';
    const invoices = LocalStore.get(storageKey) || {};
    const inv = invoices[this.currentSourceInvoiceId];
    if (!inv) return showNotif('❌ الفاتورة الأصلية غير موجودة', 'danger');

    // Generate number with user prefix
    const numGen = generateInvoiceNumber(type === 'sales' ? 'RTS' : 'RTP');
    const returnNumber = numGen.number;
    const returnId = genID('ret_');

    // ⭐ 1. Reverse transactions لكل item
    const txnEngine = TxnEngine;
    const createdTxns = [];

    for (const item of validItems) {
      const result = txnEngine.addTransaction({
        type: type === 'sales' ? 'sale_cancel' : 'purchase_cancel',
        warehouse_id: inv.warehouse_id,
        product_id: item.product_id,
        quantity: item.qty_to_return,
        unit_cost: item.unit_price,
        allow_negative: type === 'purchase',  // مرتجع شراء ممكن يخلي الرصيد سالب
        reference_type: type === 'sales' ? 'sales_return' : 'purchase_return',
        reference_id: returnId,
        reference_number: returnNumber,
        notes: `مرتجع ${returnNumber} - ${item.reason || 'بدون سبب'}`
      });

      if (!result.success) {
        // Rollback
        createdTxns.forEach(txnId => {
          const txns = LocalStore.get('inventory_txns') || {};
          const t = txns[txnId];
          if (t) {
            txnEngine.updateInventoryCache(t.warehouse_id, t.product_id, {
              current_stock: t.stock_before
            });
            delete txns[txnId];
            LocalStore.set('inventory_txns', txns);
          }
        });
        return showNotif('❌ فشل حفظ حركة المرتجع: ' + result.error, 'danger');
      }
      createdTxns.push(result.txn_id);
    }

    // ⭐ 2. Build return record
    const returnRecord = {
      _id: returnId,
      return_number: returnNumber,
      type: type === 'sales' ? 'sales_return' : 'purchase_return',
      original_invoice_id: inv._id,
      original_invoice_number: inv.invoice_number,
      warehouse_id: inv.warehouse_id,
      items: validItems.map(i => ({
        product_id: i.product_id,
        product_name_snapshot: i.product_name_snapshot,
        sku_snapshot: i.sku_snapshot,
        original_qty: i.original_qty,
        qty_returned: i.qty_to_return,
        unit_price: i.unit_price,
        total: i.total,
        reason: i.reason || ''
      })),
      total_returned: totalReturned,
      refund_method: this.refundMethod,
      notes: notes,
      created_by: currentUser._id,
      created_by_name: currentUser.name,
      created_at: Date.now()
    };

    // Sales-specific
    if (type === 'sales') {
      returnRecord.customer_id = inv.customer_id;
      returnRecord.customer_name_snapshot = inv.customer_name_snapshot;
    } else {
      returnRecord.supplier_id = inv.supplier_id;
      returnRecord.supplier_name_snapshot = inv.supplier_name_snapshot;
    }

    // ⭐ 3. Apply refund
    if (this.refundMethod === 'cash') {
      // Payment refund
      const paymentId = genID('pay_');
      const payments = LocalStore.get('payments') || {};
      payments[paymentId] = {
        _id: paymentId,
        type: type === 'sales' ? 'sales_refund' : 'purchase_refund',
        [type === 'sales' ? 'customer_id' : 'supplier_id']: type === 'sales' ? inv.customer_id : inv.supplier_id,
        invoice_id: inv._id,
        invoice_number: inv.invoice_number,
        return_id: returnId,
        return_number: returnNumber,
        amount: -totalReturned, // سالب لأنه استرداد
        method: 'cash',
        date: new Date().toISOString().slice(0, 10),
        received_by: currentUser._id,
        notes: `استرداد مرتجع ${returnNumber}`,
        created_at: Date.now()
      };
      LocalStore.set('payments', payments);
      returnRecord.refund_amount = totalReturned;

      // ✅ إصلاح محاسبي: قلل inv.paid لأن الفلوس رجعت للطرف التاني
      inv.paid = Math.max(0, (inv.paid || 0) - totalReturned);

      // ✅ Track إجمالي المرتجعات في الفاتورة
      inv.total_returned = (inv.total_returned || 0) + totalReturned;

      // تحديث الحالة بناءً على net_total والمدفوع
      const netTotal = inv.grand_total - inv.total_returned;
      inv.remaining = Math.max(0, netTotal - inv.paid);
      if (inv.remaining === 0 && inv.paid > 0) inv.status = 'paid';
      else if (inv.paid > 0 && inv.remaining > 0) inv.status = 'partial';
      else if (inv.paid === 0 && inv.remaining > 0) inv.status = 'unpaid';

      invoices[inv._id] = inv;
      LocalStore.set(storageKey, invoices);
    } else {
      // Deduct from credit
      // ✅ Track إجمالي المرتجعات في الفاتورة (في الحالتين cash / credit)
      inv.total_returned = (inv.total_returned || 0) + totalReturned;

      if (type === 'sales') {
        // اقلل مديونية العميل
        const customers = LocalStore.get('customers') || {};
        const cust = customers[inv.customer_id];
        if (cust) {
          cust.cached_total_debt = Math.max(0, (cust.cached_total_debt || 0) - totalReturned);
          customers[inv.customer_id] = cust;
          LocalStore.set('customers', customers);
        }

        // اقلل remaining من الفاتورة (وحدث الحالة)
        const originalRemaining = inv.remaining;
        inv.remaining = Math.max(0, inv.remaining - totalReturned);
        // إذا remaining=0 والفاتورة كانت مدفوعة جزئي → مدفوعة
        if (inv.remaining === 0 && inv.paid > 0) inv.status = 'paid';
        else if (inv.remaining < (inv.grand_total - inv.total_returned)) inv.status = 'partial';
        invoices[inv._id] = inv;
        LocalStore.set(storageKey, invoices);

        returnRecord.credit_deducted = Math.min(totalReturned, originalRemaining);
      } else {
        // مرتجع شراء - اقلل مستحقات المورد
        const suppliers = LocalStore.get('suppliers') || {};
        const sup = suppliers[inv.supplier_id];
        if (sup) {
          sup.cached_total_debt_to_them = Math.max(0, (sup.cached_total_debt_to_them || 0) - totalReturned);
          suppliers[inv.supplier_id] = sup;
          LocalStore.set('suppliers', suppliers);
        }

        inv.remaining = Math.max(0, inv.remaining - totalReturned);
        if (inv.remaining === 0 && inv.paid > 0) inv.status = 'paid';
        else if (inv.remaining < (inv.grand_total - inv.total_returned)) inv.status = 'partial';
        invoices[inv._id] = inv;
        LocalStore.set(storageKey, invoices);

        returnRecord.credit_deducted = totalReturned;
      }
    }

    // ⭐ 4. Save return record
    const returnsKey = type === 'sales' ? 'sales_returns' : 'purchase_returns';
    const returns = LocalStore.get(returnsKey) || {};
    returns[returnId] = returnRecord;
    LocalStore.set(returnsKey, returns);

    // ⭐ 5. Update counter
    incrementInvoiceCounter(numGen.counterKey);

    // ⭐ 6. Also reduce lifetime sales/purchases (اختياري - محاسبياً الأصح)
    if (type === 'sales') {
      const customers = LocalStore.get('customers') || {};
      const cust = customers[inv.customer_id];
      if (cust) {
        // لا نقلل lifetime_sales لأنها stats تاريخية
        // بس نضيف field جديد
        cust.cached_lifetime_returns = (cust.cached_lifetime_returns || 0) + totalReturned;
        customers[inv.customer_id] = cust;
        LocalStore.set('customers', customers);
      }
    }

    // ⭐ 7. Activity log
    logActivity('return_created', 'returns', returnId, returnNumber, {
      type: type,
      original_invoice: inv.invoice_number,
      total: totalReturned,
      items_count: validItems.length,
      refund_method: this.refundMethod
    });

    showNotif(`✅ تم حفظ ${returnNumber}`, 'success');

    this.currentView = 'detail';
    this.currentReturnId = returnId;
    this.render();
  },

  // ==========================================================
  // View 3: Detail
  // ==========================================================
  viewDetail(id, type) {
    this.currentReturnId = id;
    this.currentReturnType = type;
    this.currentView = 'detail';
    this.render();
  },

  renderDetail(id) {
    const container = document.getElementById('moduleContainer');
    const type = this.currentReturnType;
    const returnsKey = type === 'sales' ? 'sales_returns' : 'purchase_returns';
    const returns = LocalStore.get(returnsKey) || {};
    const ret = returns[id];

    if (!ret) {
      showNotif('❌ المرتجع غير موجود', 'danger');
      this.currentView = 'list';
      return this.render();
    }

    const customers = LocalStore.get('customers') || {};
    const suppliers = LocalStore.get('suppliers') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;

    const otherParty = type === 'sales'
      ? customers[ret.customer_id]
      : suppliers[ret.supplier_id];
    const wh = warehouses[ret.warehouse_id] || { name: '—' };

    const typeLabel = type === 'sales' ? 'مرتجع بيع' : 'مرتجع شراء';
    const partyLabel = type === 'sales' ? 'العميل' : 'المورد';
    const refundLabel = ret.refund_method === 'cash' ? '💵 استرداد كاش' : '📉 خصم من ' + (type === 'sales' ? 'المديونية' : 'المستحقات');

    container.innerHTML = `
      <div class="page-header no-print">
        <div>
          <div class="page-title">🔄 ${ret.return_number}</div>
          <div class="page-subtitle">${typeLabel} — إجمالي ${fmtMoney(ret.total_returned)} ج.م</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="ReturnsModule.backToList()">← رجوع</button>
          <button class="btn btn-outline" onclick="window.print()">🖨️ طباعة</button>
          <button class="btn btn-gold" onclick="ReturnsModule.sendReturnToHaj('${id}', '${type}')">
            📱 للحاج
          </button>
        </div>
      </div>

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
          <div class="invoice-number-box" style="background: #FEE2E2; border-right-color: #DC2626;">
            <div class="invoice-label" style="color:#991B1B;">${typeLabel}</div>
            <div class="invoice-number" style="color:#991B1B;">${ret.return_number}</div>
            <div class="invoice-date">${fmtDate(ret.created_at)}</div>
          </div>
        </div>

        <!-- Meta -->
        <div class="invoice-meta">
          <div><strong>${partyLabel}:</strong> ${otherParty?.name || '—'}</div>
          <div><strong>التليفون:</strong> ${otherParty?.phone || '—'}</div>
          <div><strong>المخزن:</strong> ${wh.name}</div>
          <div><strong>الفاتورة الأصلية:</strong> ${ret.original_invoice_number}</div>
          <div style="grid-column: 1 / -1;"><strong>طريقة الاسترداد:</strong> ${refundLabel}</div>
        </div>

        <!-- Items -->
        <table class="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>الكمية الأصلية</th>
              <th>الكمية المرتجعة</th>
              <th>السعر</th>
              <th>القيمة</th>
              <th>السبب</th>
            </tr>
          </thead>
          <tbody>
            ${ret.items.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>
                  <strong>${item.product_name_snapshot}</strong>
                  ${item.sku_snapshot ? '<br><small style="color:var(--gray-500);">' + item.sku_snapshot + '</small>' : ''}
                </td>
                <td>${fmtMoney(item.original_qty)} ${getProductUnitName(item.product_id) || 'كجم'}</td>
                <td><strong style="color:var(--danger);">${fmtMoney(item.qty_returned)}</strong> ${getProductUnitName(item.product_id) || 'كجم'}</td>
                <td>${fmtMoney(item.unit_price)} ج.م</td>
                <td><strong>${fmtMoney(item.total)}</strong> ج.م</td>
                <td style="font-size:13px;">${item.reason || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Total -->
        <div class="invoice-totals" style="background:#FEE2E2;">
          <div class="invoice-total-row invoice-grand" style="color:#991B1B;">
            <span>إجمالي المرتجع:</span>
            <span>${fmtMoney(ret.total_returned)} ج.م</span>
          </div>
          <div class="invoice-total-row">
            <span>طريقة الاسترداد:</span>
            <span><strong>${refundLabel}</strong></span>
          </div>
        </div>

        ${ret.notes ? `
          <div class="invoice-notes">
            <strong>ملاحظات:</strong> ${ret.notes}
          </div>
        ` : ''}

        <div class="invoice-footer">
          <div>سجل بواسطة: ${ret.created_by_name || '—'}</div>
          <div>${fmtDateTime(ret.created_at)}</div>
        </div>
      </div>
    `;
  },

  sendReturnToHaj(id, type) {
    const returnsKey = type === 'sales' ? 'sales_returns' : 'purchase_returns';
    const returns = LocalStore.get(returnsKey) || {};
    const ret = returns[id];
    if (!ret) return;

    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;
    const customers = LocalStore.get('customers') || {};
    const suppliers = LocalStore.get('suppliers') || {};
    const warehouses = LocalStore.get('warehouses') || {};

    const otherParty = type === 'sales'
      ? customers[ret.customer_id]
      : suppliers[ret.supplier_id];
    const wh = warehouses[ret.warehouse_id] || { name: '—' };
    const typeLabel = type === 'sales' ? 'مرتجع بيع' : 'مرتجع شراء';
    const refundLabel = ret.refund_method === 'cash' ? '💵 كاش' : '📉 خصم من الحساب';

    const itemsDetail = ret.items.map((item, i) => {
      const unitName = getProductUnitName(item.product_id) || 'كجم';
      return `${i + 1}. ${item.product_name_snapshot}\n   ↩️ ${fmtMoney(item.qty_returned)} ${unitName} × ${fmtMoney(item.unit_price)} = ${fmtMoney(item.total)} ج.م${item.reason ? '\n   📝 ' + item.reason : ''}`;
    }).join('\n\n');

    const msg = `🔄 *${typeLabel}* — ${ret.return_number}
━━━━━━━━━━━━━━
📅 ${fmtDateTime(ret.created_at)}

📄 الفاتورة الأصلية: ${ret.original_invoice_number}
${type === 'sales' ? '👤' : '🏭'} ${type === 'sales' ? 'العميل' : 'المورد'}: ${otherParty?.name || '—'}
📞 ${otherParty?.phone || '—'}
🏢 المخزن: ${wh.name}

*الأصناف المرتجعة:*
${itemsDetail}

━━━━━━━━━━━━━━
💰 إجمالي المرتجع: *${fmtMoney(ret.total_returned)} ج.م*
💵 طريقة الاسترداد: ${refundLabel}

━━━━━━━━━━━━━━
👤 سجل بواسطة: ${ret.created_by_name}
${ret.notes ? '\n📝 ' + ret.notes : ''}`;

    let phone = company.owner_phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone;
    else if (!phone.startsWith('2')) phone = '2' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    logActivity('whatsapp_haj', 'returns', id, ret.return_number, {});
    window.open(url, '_blank');
    showNotif('📱 جاري فتح واتساب للحاج...', 'info');
  },

  backToList() {
    this.currentView = 'list';
    this.currentReturnId = null;
    this.currentReturnType = null;
    this.currentSourceInvoiceId = null;
    this.formItems = [];
    this.render();
  }
};

// ==========================================================
// Add sales_return counter to default counters
// ==========================================================
if (typeof LocalStore !== 'undefined') {
  const counters = LocalStore.get('counters');
  if (counters && !counters.sales_return) {
    counters.sales_return = 1;
    counters.purchase_return = 1;
    LocalStore.set('counters', counters);
  }
}
