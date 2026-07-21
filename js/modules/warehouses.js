// ==========================================================
// Warehouses Module
// ==========================================================

const WarehousesModule = {

  render() {
    if (!requirePermission('warehouses_view', 'مشاهدة المخازن')) {
      return renderPlaceholder('🏢 المخازن', 'مش مصرح');
    }

    const container = document.getElementById('moduleContainer');
    const warehouses = LocalStore.get('warehouses') || {};
    const list = Object.values(warehouses);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🏢 المخازن</div>
          <div class="page-subtitle">${list.length} مخزن</div>
        </div>
        <div class="page-actions">
          ${hasPermission('warehouses_manage') ? `
          <button class="btn btn-primary" onclick="WarehousesModule.showAddForm()">
            ➕ مخزن جديد
          </button>
          ` : ''}
        </div>
      </div>

      <div class="grid grid-3" id="warehousesList">
        ${list.map(wh => this.renderCard(wh)).join('')}
        ${list.length === 0 ? `
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="empty-icon">🏢</div>
            <h3>لا يوجد مخازن</h3>
            <p>ابدأ بإضافة مخزن جديد</p>
          </div>
        ` : ''}
      </div>

      <!-- Add/Edit Modal -->
      <div id="warehouseModal" class="modal-overlay" style="display:none;">
        <div class="modal">
          <div class="modal-header">
            <h3 id="warehouseModalTitle">إضافة مخزن جديد</h3>
            <button class="modal-close" onclick="WarehousesModule.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="wh_id">
            <div class="form-group">
              <label>اسم المخزن *</label>
              <input type="text" id="wh_name" placeholder="مثل: مخزن القاهرة">
            </div>
            <div class="form-group">
              <label>الموقع</label>
              <input type="text" id="wh_location" placeholder="العنوان أو المدينة">
            </div>
            <div class="form-group">
              <label>اسم المسؤول</label>
              <input type="text" id="wh_manager" placeholder="مسؤول المخزن">
            </div>
            <div class="form-group">
              <label>تليفون</label>
              <input type="tel" id="wh_phone" placeholder="01xxxxxxxxx">
            </div>
            <div class="form-group">
              <label>ملاحظات</label>
              <textarea id="wh_notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="WarehousesModule.closeModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="WarehousesModule.save()">💾 حفظ</button>
          </div>
        </div>
      </div>
    `;
  },

  renderCard(wh) {
    // احسب عدد الأصناف والقيمة الإجمالية
    const inventory = TxnEngine.getWarehouseInventory(wh._id || wh.id);
    const totalItems = inventory.filter(i => i.current_stock > 0).length;
    const totalValue = inventory.reduce((sum, i) => sum + i.stock_value, 0);

    return `
      <div class="card wh-card ${wh.active === false ? 'wh-inactive' : ''}">
        <div class="wh-header">
          <div class="wh-icon">🏢</div>
          <div class="wh-info">
            <div class="wh-name">${wh.name}</div>
            <div class="wh-location">📍 ${wh.location || '—'}</div>
          </div>
        </div>

        <div class="wh-stats">
          <div class="wh-stat">
            <div class="wh-stat-label">أصناف</div>
            <div class="wh-stat-value">${totalItems}</div>
          </div>
          <div class="wh-stat">
            <div class="wh-stat-label">قيمة المخزون</div>
            <div class="wh-stat-value">${fmtMoneyShort(totalValue)} <small>ج.م</small></div>
          </div>
        </div>

        <div class="wh-actions">
          <button class="btn btn-outline btn-sm" onclick="WarehousesModule.viewStock('${wh._id || wh.id}')">
            📦 المخزون
          </button>
          ${hasPermission('warehouses_manage') ? `
            <button class="btn btn-ghost btn-sm" onclick="WarehousesModule.showEditForm('${wh._id || wh.id}')">
              ✏️ تعديل
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  showAddForm() {
    document.getElementById('warehouseModalTitle').textContent = '➕ إضافة مخزن جديد';
    document.getElementById('wh_id').value = '';
    document.getElementById('wh_name').value = '';
    document.getElementById('wh_location').value = '';
    document.getElementById('wh_manager').value = '';
    document.getElementById('wh_phone').value = '';
    document.getElementById('wh_notes').value = '';
    document.getElementById('warehouseModal').style.display = 'flex';
  },

  showEditForm(id) {
    const warehouses = LocalStore.get('warehouses') || {};
    const wh = warehouses[id];
    if (!wh) return showNotif('❌ المخزن غير موجود', 'danger');

    document.getElementById('warehouseModalTitle').textContent = '✏️ تعديل: ' + wh.name;
    document.getElementById('wh_id').value = id;
    document.getElementById('wh_name').value = wh.name || '';
    document.getElementById('wh_location').value = wh.location || '';
    document.getElementById('wh_manager').value = wh.manager || '';
    document.getElementById('wh_phone').value = wh.phone || '';
    document.getElementById('wh_notes').value = wh.notes || '';
    document.getElementById('warehouseModal').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('warehouseModal').style.display = 'none';
  },

  save() {
    const id = document.getElementById('wh_id').value;
    const name = document.getElementById('wh_name').value.trim();
    const location = document.getElementById('wh_location').value.trim();
    const manager = document.getElementById('wh_manager').value.trim();
    const phone = document.getElementById('wh_phone').value.trim();
    const notes = document.getElementById('wh_notes').value.trim();

    if (!name) return showNotif('❌ الاسم مطلوب', 'danger');

    const warehouses = LocalStore.get('warehouses') || {};

    if (id) {
      // تعديل
      warehouses[id] = {
        ...warehouses[id],
        name, location, manager, phone, notes,
        updated_at: Date.now()
      };
      logActivity('update', 'warehouses', id, name, {});
      showNotif('✅ تم تعديل المخزن', 'success');
    } else {
      // إضافة
      const newId = genID('wh_');
      warehouses[newId] = {
        _id: newId,
        name, location, manager, phone, notes,
        active: true,
        created_at: Date.now(),
        created_by: currentUser._id
      };
      logActivity('create', 'warehouses', newId, name, {});
      showNotif('✅ تم إضافة المخزن', 'success');
    }

    LocalStore.set('warehouses', warehouses);
    this.closeModal();
    this.render();
  },

  viewStock(warehouseId) {
    // ننقل للـ inventory ونركز على المخزن ده
    switchModule('inventory');
    setTimeout(() => {
      if (typeof InventoryModule !== 'undefined' && InventoryModule.filterByWarehouse) {
        InventoryModule.filterByWarehouse(warehouseId);
      }
    }, 100);
  }
};
