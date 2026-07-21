// ==========================================================
// Inventory Module
// ==========================================================

const InventoryModule = {

  currentWarehouse: 'all',
  currentView: 'stock', // stock | movements

  render() {
    if (!requirePermission('warehouses_view', 'مشاهدة المخزون')) {
      return renderPlaceholder('📦 المخزون', 'مش مصرح');
    }

    const container = document.getElementById('moduleContainer');
    const warehouses = LocalStore.get('warehouses') || {};

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">📦 المخزون</div>
          <div class="page-subtitle">إدارة الأرصدة وحركات المخزون</div>
        </div>
        <div class="page-actions">
          ${hasPermission('warehouses_transfer') ? `
          <button class="btn btn-secondary" onclick="InventoryModule.showTransferModal()">
            🔀 تحويل بين مخازن
          </button>
          ` : ''}
          ${hasPermission('warehouses_adjust') ? `
          <button class="btn btn-gold" onclick="InventoryModule.showAdjustModal()">
            ⚖️ تسوية جرد
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Warehouse Tabs -->
      <div class="tabs" style="margin-bottom: 16px;">
        <button class="tab-btn ${this.currentWarehouse === 'all' ? 'active' : ''}"
                onclick="InventoryModule.filterByWarehouse('all')">
          🌐 كل المخازن
        </button>
        ${Object.values(warehouses).map(wh => `
          <button class="tab-btn ${this.currentWarehouse === (wh._id || wh.id) ? 'active' : ''}"
                  onclick="InventoryModule.filterByWarehouse('${wh._id || wh.id}')">
            🏢 ${wh.name}
          </button>
        `).join('')}
      </div>

      <!-- View Toggle -->
      <div class="segmented" style="margin-bottom: 16px;">
        <button class="seg-btn ${this.currentView === 'stock' ? 'active' : ''}"
                onclick="InventoryModule.setView('stock')">
          📊 الأرصدة
        </button>
        <button class="seg-btn ${this.currentView === 'movements' ? 'active' : ''}"
                onclick="InventoryModule.setView('movements')">
          📜 حركة المخزون
        </button>
      </div>

      <div id="inventoryContent">
        ${this.currentView === 'stock' ? this.renderStockView() : this.renderMovementsView()}
      </div>

      ${this.renderTransferModal()}
      ${this.renderAdjustModal()}
    `;
  },

  renderStockView() {
    const products = LocalStore.get('products') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    let productList = Object.values(products).filter(p => p.active !== false);

    // ✅ فصل المخازن: لو مخزن محدد، اعرض بس الأصناف اللي فيها حركات في هذا المخزن
    if (this.currentWarehouse !== 'all') {
      const txns = Object.values(LocalStore.get('inventory_txns') || {});
      const productsInThisWarehouse = new Set(
        txns.filter(t => t.warehouse_id === this.currentWarehouse).map(t => t.product_id)
      );
      productList = productList.filter(p => productsInThisWarehouse.has(p._id));
    }

    if (productList.length === 0) {
      return `<div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>${this.currentWarehouse === 'all' ? 'لا يوجد أصناف' : 'مفيش أصناف في المخزن ده'}</h3>
        <p>${this.currentWarehouse === 'all' ? 'أضف أصناف أول' : 'الصنف بيبقى ظاهر في مخزن معين لما يبقى فيه حركة (شراء/تحويل) عليه في المخزن ده'}</p>
      </div>`;
    }

    let totalValue = 0;

    const rows = productList.map(p => {
      const unitObj = DEFAULT_UNITS.find(u => u.id === p.unit) || DEFAULT_UNITS[0];

      if (this.currentWarehouse === 'all') {
        const stock = TxnEngine.getProductStockAllWarehouses(p._id);
        const inv = TxnEngine.getInventory(Object.keys(warehouses)[0] || 'wh_general', p._id);
        const value = stock.total * (inv.average_cost || 0);
        totalValue += value;

        const isLow = stock.total <= (p.min_stock || 0);
        const showCost = hasPermission('products_view_purchase_prices');

        return `
          <tr class="${isLow ? 'stock-low-row' : ''}">
            <td><strong>${p.sku}</strong></td>
            <td>${p.name}</td>
            <td>${fmtMoney(stock.total)} ${unitObj.name}</td>
            ${Object.values(warehouses).map(wh => `
              <td>${fmtMoney(stock.byWarehouse[wh._id || wh.id] || 0)}</td>
            `).join('')}
            ${showCost ? `<td>${fmtMoney(inv.average_cost)} ج.م</td>` : ''}
            ${showCost ? `<td>${fmtMoney(value)} ج.م</td>` : ''}
            <td>
              <button class="btn btn-ghost btn-sm" onclick="InventoryModule.viewProductMovement('${p._id}')">
                📊 الحركة
              </button>
            </td>
          </tr>
        `;
      } else {
        const inv = TxnEngine.getInventory(this.currentWarehouse, p._id);
        const value = inv.current_stock * (inv.average_cost || 0);
        totalValue += value;
        const isLow = inv.current_stock <= (p.min_stock || 0);
        const showCost = hasPermission('products_view_purchase_prices');

        return `
          <tr class="${isLow ? 'stock-low-row' : ''}">
            <td><strong>${p.sku}</strong></td>
            <td>${p.name}</td>
            <td>${fmtMoney(inv.current_stock)} ${unitObj.name}</td>
            ${showCost ? `<td>${fmtMoney(inv.average_cost)} ج.م</td>` : ''}
            ${showCost ? `<td>${fmtMoney(value)} ج.م</td>` : ''}
            <td>${fmtDate(inv.last_updated) || '—'}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="InventoryModule.viewProductMovement('${p._id}')">
                📊
              </button>
            </td>
          </tr>
        `;
      }
    }).join('');

    const showCost = hasPermission('products_view_purchase_prices');

    return `
      ${showCost ? `
        <div class="stat-card stat-gold" style="margin-bottom: 16px;">
          <div class="stat-label">💎 إجمالي قيمة المخزون ${this.currentWarehouse !== 'all' ? '(' + (warehouses[this.currentWarehouse]?.name || '') + ')' : '(كل المخازن)'}</div>
          <div class="stat-value">${fmtMoney(totalValue)} <span class="stat-currency">ج.م</span></div>
        </div>
      ` : ''}

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>الصنف</th>
              <th>${this.currentWarehouse === 'all' ? 'الرصيد الكلي' : 'الرصيد'}</th>
              ${this.currentWarehouse === 'all' ? Object.values(warehouses).map(wh => `<th>${wh.name}</th>`).join('') : ''}
              ${showCost ? '<th>متوسط التكلفة</th>' : ''}
              ${showCost ? '<th>القيمة</th>' : ''}
              ${this.currentWarehouse !== 'all' ? '<th>آخر تحديث</th>' : ''}
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  renderMovementsView() {
    const txns = LocalStore.get('inventory_txns') || {};
    let list = Object.values(txns);

    if (this.currentWarehouse !== 'all') {
      list = list.filter(t => t.warehouse_id === this.currentWarehouse);
    }

    list = list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100); // آخر 100

    if (list.length === 0) {
      return `<div class="empty-state">
        <div class="empty-icon">📜</div>
        <h3>لا توجد حركات</h3>
        <p>الحركات هتظهر بعد أول عملية شراء أو بيع</p>
      </div>`;
    }

    const products = LocalStore.get('products') || {};
    const warehouses = LocalStore.get('warehouses') || {};

    return `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>الصنف</th>
              <th>المخزن</th>
              <th>الكمية</th>
              <th>قبل</th>
              <th>بعد</th>
              <th>المرجع</th>
              <th>المستخدم</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(t => {
              const p = products[t.product_id] || { name: '—', sku: '—' };
              const wh = warehouses[t.warehouse_id] || { name: '—' };
              const typeLabel = this.getTypeLabel(t.type);
              const isPositive = t.quantity > 0;

              return `
                <tr>
                  <td>${fmtDateTime(t.timestamp)}</td>
                  <td><span class="txn-badge txn-${t.type}">${typeLabel}</span></td>
                  <td>${p.name}</td>
                  <td>${wh.name}</td>
                  <td class="${isPositive ? 'positive' : 'negative'}">
                    <strong>${isPositive ? '+' : ''}${fmtMoney(t.quantity)}</strong>
                  </td>
                  <td>${fmtMoney(t.stock_before)}</td>
                  <td><strong>${fmtMoney(t.stock_after)}</strong></td>
                  <td>${t.reference_number || '—'}</td>
                  <td>${t.username || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  getTypeLabel(type) {
    const labels = {
      'purchase': '🛒 شراء',
      'sale': '💰 بيع',
      'sale_cancel': '↩️ إلغاء بيع',
      'purchase_cancel': '↩️ إلغاء شراء',
      'adjustment_in': '⚖️ تسوية (+)',
      'adjustment_out': '⚖️ تسوية (-)',
      'transfer_in': '↙️ تحويل وارد',
      'transfer_out': '↗️ تحويل صادر'
    };
    return labels[type] || type;
  },

  filterByWarehouse(id) {
    this.currentWarehouse = id;
    this.render();
  },

  setView(view) {
    this.currentView = view;
    this.render();
  },

  viewProductMovement(productId) {
    const products = LocalStore.get('products') || {};
    const p = products[productId];
    if (!p) return;

    const txns = TxnEngine.getProductTransactions(productId).slice(0, 50);
    const warehouses = LocalStore.get('warehouses') || {};

    const container = document.getElementById('moduleContainer');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">📊 حركة: ${p.name}</div>
          <div class="page-subtitle">آخر ${txns.length} حركة</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline" onclick="switchModule('inventory')">
            ← رجوع
          </button>
        </div>
      </div>

      <!-- Product summary -->
      <div class="grid grid-3" style="margin-bottom: 24px;">
        ${Object.values(warehouses).map(wh => {
          const inv = TxnEngine.getInventory(wh._id || wh.id, productId);
          return `
            <div class="stat-card">
              <div class="stat-label">🏢 ${wh.name}</div>
              <div class="stat-value">${fmtMoney(inv.current_stock)}</div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Transactions -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>المخزن</th>
              <th>الكمية</th>
              <th>قبل</th>
              <th>بعد</th>
              <th>المرجع</th>
              <th>المستخدم</th>
            </tr>
          </thead>
          <tbody>
            ${txns.map(t => {
              const wh = warehouses[t.warehouse_id] || { name: '—' };
              const isPositive = t.quantity > 0;
              return `
                <tr>
                  <td>${fmtDateTime(t.timestamp)}</td>
                  <td><span class="txn-badge txn-${t.type}">${this.getTypeLabel(t.type)}</span></td>
                  <td>${wh.name}</td>
                  <td class="${isPositive ? 'positive' : 'negative'}">
                    <strong>${isPositive ? '+' : ''}${fmtMoney(t.quantity)}</strong>
                  </td>
                  <td>${fmtMoney(t.stock_before)}</td>
                  <td><strong>${fmtMoney(t.stock_after)}</strong></td>
                  <td>${t.reference_number || '—'}</td>
                  <td>${t.username}</td>
                </tr>
              `;
            }).join('')}
            ${txns.length === 0 ? `<tr><td colspan="8" style="text-align:center; padding:40px;">لا توجد حركات</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;
  },

  // ==========================================================
  // Transfer Modal
  // ==========================================================
  renderTransferModal() {
    const warehouses = Object.values(LocalStore.get('warehouses') || {});
    const products = Object.values(LocalStore.get('products') || {}).filter(p => p.active !== false);

    return `
      <div id="transferModal" class="modal-overlay" style="display:none;">
        <div class="modal">
          <div class="modal-header">
            <h3>🔀 تحويل بين مخازن</h3>
            <button class="modal-close" onclick="InventoryModule.closeTransferModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="grid grid-2">
              <div class="form-group">
                <label>من مخزن *</label>
                <select id="tr_from" onchange="InventoryModule.updateTransferMax()">
                  <option value="">اختر...</option>
                  ${warehouses.map(w => `<option value="${w._id || w.id}">${w.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>إلى مخزن *</label>
                <select id="tr_to">
                  <option value="">اختر...</option>
                  ${warehouses.map(w => `<option value="${w._id || w.id}">${w.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>الصنف *</label>
              <select id="tr_product" onchange="InventoryModule.updateTransferMax()">
                <option value="">اختر...</option>
                ${products.map(p => `<option value="${p._id}">${p.sku} — ${p.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>الكمية *</label>
              <input type="number" id="tr_qty" step="0.01" placeholder="0.00">
              <small class="hint" id="tr_available">اختر مخزن وصنف لعرض المتاح</small>
            </div>

            <div class="form-group">
              <label>ملاحظات</label>
              <textarea id="tr_notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="InventoryModule.closeTransferModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="InventoryModule.doTransfer()">🔀 تحويل</button>
          </div>
        </div>
      </div>
    `;
  },

  showTransferModal() {
    if (!requirePermission('warehouses_transfer', 'التحويل بين المخازن')) return;
    document.getElementById('transferModal').style.display = 'flex';
  },

  closeTransferModal() {
    document.getElementById('transferModal').style.display = 'none';
    ['tr_from','tr_to','tr_product','tr_qty','tr_notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  },

  updateTransferMax() {
    const from = document.getElementById('tr_from').value;
    const product = document.getElementById('tr_product').value;
    const hint = document.getElementById('tr_available');
    if (!from || !product) {
      hint.textContent = 'اختر مخزن وصنف لعرض المتاح';
      return;
    }
    const inv = TxnEngine.getInventory(from, product);
    hint.textContent = `المتاح: ${fmtMoney(inv.current_stock)}`;
    document.getElementById('tr_qty').max = inv.current_stock;
  },

  doTransfer() {
    const from = document.getElementById('tr_from').value;
    const to = document.getElementById('tr_to').value;
    const product = document.getElementById('tr_product').value;
    const qty = Number(document.getElementById('tr_qty').value);
    const notes = document.getElementById('tr_notes').value;

    if (!from || !to || !product || !qty) return showNotif('❌ املأ كل الحقول', 'danger');
    if (from === to) return showNotif('❌ المخزن المصدر والهدف نفس المخزن', 'danger');
    if (qty <= 0) return showNotif('❌ الكمية لازم أكبر من صفر', 'danger');

    const result = TxnEngine.transfer(from, to, product, qty, notes);
    if (!result.success) {
      return showNotif('❌ ' + result.error, 'danger');
    }

    const products = LocalStore.get('products') || {};
    const p = products[product];
    logActivity('transfer', 'inventory', product, `تحويل ${qty} ${p?.name}`, {
      from_warehouse: from,
      to_warehouse: to,
      quantity: qty
    });

    showNotif('✅ تم التحويل بنجاح', 'success');
    this.closeTransferModal();
    this.render();
  },

  // ==========================================================
  // Adjust Modal
  // ==========================================================
  renderAdjustModal() {
    const warehouses = Object.values(LocalStore.get('warehouses') || {});
    const products = Object.values(LocalStore.get('products') || {}).filter(p => p.active !== false);

    return `
      <div id="adjustModal" class="modal-overlay" style="display:none;">
        <div class="modal">
          <div class="modal-header">
            <h3>⚖️ تسوية جرد</h3>
            <button class="modal-close" onclick="InventoryModule.closeAdjustModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="grid grid-2">
              <div class="form-group">
                <label>المخزن *</label>
                <select id="adj_warehouse" onchange="InventoryModule.updateAdjustCurrent()">
                  <option value="">اختر...</option>
                  ${warehouses.map(w => `<option value="${w._id || w.id}">${w.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>الصنف *</label>
                <select id="adj_product" onchange="InventoryModule.updateAdjustCurrent()">
                  <option value="">اختر...</option>
                  ${products.map(p => `<option value="${p._id}">${p.sku} — ${p.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>الرصيد الحالي (دفتري)</label>
              <input type="text" id="adj_current" disabled placeholder="اختر مخزن وصنف">
            </div>

            <div class="form-group">
              <label>الرصيد الفعلي (بعد الجرد) *</label>
              <input type="number" id="adj_actual" step="0.01" placeholder="الكمية الفعلية">
            </div>

            <div class="form-group">
              <label>سبب التسوية *</label>
              <textarea id="adj_reason" rows="2" placeholder="مثل: جرد شهري - وجود فرق تلف"></textarea>
              <small class="hint">مطلوب على الأقل 5 حروف</small>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="InventoryModule.closeAdjustModal()">إلغاء</button>
            <button class="btn btn-gold" onclick="InventoryModule.doAdjust()">⚖️ حفظ التسوية</button>
          </div>
        </div>
      </div>
    `;
  },

  showAdjustModal() {
    if (!requirePermission('warehouses_adjust', 'تسوية الجرد')) return;
    document.getElementById('adjustModal').style.display = 'flex';
  },

  closeAdjustModal() {
    document.getElementById('adjustModal').style.display = 'none';
    ['adj_warehouse','adj_product','adj_current','adj_actual','adj_reason'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  },

  updateAdjustCurrent() {
    const wh = document.getElementById('adj_warehouse').value;
    const prd = document.getElementById('adj_product').value;
    if (!wh || !prd) {
      document.getElementById('adj_current').value = '';
      return;
    }
    const inv = TxnEngine.getInventory(wh, prd);
    document.getElementById('adj_current').value = fmtMoney(inv.current_stock);
  },

  doAdjust() {
    const wh = document.getElementById('adj_warehouse').value;
    const prd = document.getElementById('adj_product').value;
    const actual = Number(document.getElementById('adj_actual').value);
    const reason = document.getElementById('adj_reason').value.trim();

    if (!wh || !prd) return showNotif('❌ اختر مخزن وصنف', 'danger');
    if (isNaN(actual) || actual < 0) return showNotif('❌ الرصيد الفعلي غير صحيح', 'danger');
    if (reason.length < 5) return showNotif('❌ السبب على الأقل 5 حروف', 'danger');

    const inv = TxnEngine.getInventory(wh, prd);
    const diff = actual - inv.current_stock;

    if (diff === 0) return showNotif('✅ لا فرق - الرصيد صحيح', 'info');

    const result = TxnEngine.addTransaction({
      type: diff > 0 ? 'adjustment_in' : 'adjustment_out',
      warehouse_id: wh,
      product_id: prd,
      quantity: Math.abs(diff),
      reference_type: 'adjustment',
      notes: reason
    });

    if (!result.success) return showNotif('❌ ' + result.error, 'danger');

    const products = LocalStore.get('products') || {};
    const p = products[prd];
    logActivity('adjustment', 'inventory', prd, `تسوية ${p?.name} ${diff > 0 ? '+' : ''}${diff}`, {
      warehouse: wh, diff, reason
    });

    showNotif(`✅ تم - الفرق: ${diff > 0 ? '+' : ''}${fmtMoney(diff)}`, 'success');
    this.closeAdjustModal();
    this.render();
  }
};
