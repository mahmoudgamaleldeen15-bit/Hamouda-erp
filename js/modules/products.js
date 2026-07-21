// ==========================================================
// Products Module
// ==========================================================

const ProductsModule = {

  currentSearch: '',
  currentCategory: 'all',

  render() {
    if (!requirePermission('products_view', 'مشاهدة الأصناف')) {
      return renderPlaceholder('🍇 الأصناف', 'مش مصرح');
    }

    const container = document.getElementById('moduleContainer');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🍇 الأصناف</div>
          <div class="page-subtitle" id="productsCount">جاري التحميل...</div>
        </div>
        <div class="page-actions">
          ${currentUser.role === 'admin' ? `
          <button class="btn btn-outline" onclick="ProductsModule.showUnitsManager()">
            🏷️ إدارة الوحدات
          </button>
          ` : ''}
          ${hasPermission('products_add') ? `
          <button class="btn btn-primary" onclick="ProductsModule.showAddForm()">
            ➕ صنف جديد
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Search & Filter -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="grid grid-3">
          <div class="form-group" style="margin:0;">
            <label>🔍 بحث</label>
            <input type="text" id="productSearch" placeholder="اسم الصنف أو الكود..."
                   oninput="ProductsModule.applyFilters()">
          </div>
          <div class="form-group" style="margin:0;">
            <label>التصنيف</label>
            <select id="productCategory" onchange="ProductsModule.applyFilters()">
              <option value="all">كل التصنيفات</option>
              ${getCategories().map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label>&nbsp;</label>
            <button class="btn btn-outline btn-full" onclick="ProductsModule.render()">
              🔄 تحديث
            </button>
          </div>
        </div>
      </div>

      <!-- Products table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>الصنف</th>
              <th>التصنيف</th>
              <th>الوحدة</th>
              ${hasPermission('products_view_purchase_prices') ? '<th>سعر الشراء</th>' : ''}
              <th>سعر البيع</th>
              <th>الرصيد الكلي</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody id="productsTableBody">
            <tr><td colspan="8" style="text-align:center; padding:40px;">جاري التحميل...</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      ${this.renderModal()}
    `;

    this.applyFilters();
  },

  renderModal() {
    const showPurchasePrice = hasPermission('products_view_purchase_prices');
    return `
      <div id="productModal" class="modal-overlay" style="display:none;">
        <div class="modal">
          <div class="modal-header">
            <h3 id="productModalTitle">إضافة صنف جديد</h3>
            <button class="modal-close" onclick="ProductsModule.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="pr_id">

            <div class="grid grid-2">
              <div class="form-group">
                <label>كود الصنف (SKU) *</label>
                <input type="text" id="pr_sku" placeholder="GRP-001">
              </div>
              <div class="form-group">
                <label>الباركود</label>
                <input type="text" id="pr_barcode" placeholder="اختياري">
              </div>
            </div>

            <div class="form-group">
              <label>اسم الصنف *</label>
              <input type="text" id="pr_name" placeholder="عنب أحمر">
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label>التصنيف</label>
                <select id="pr_category">
                  ${getCategories().map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>الوحدة</label>
                <select id="pr_unit">
                  ${getUnits().filter(u => u.active !== false).map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="grid grid-2">
              ${showPurchasePrice ? `
              <div class="form-group">
                <label>سعر الشراء الافتراضي</label>
                <input type="number" id="pr_purchase_price" step="0.01" placeholder="0.00">
              </div>
              ` : '<div></div>'}
              <div class="form-group">
                <label>سعر البيع الافتراضي</label>
                <input type="number" id="pr_sale_price" step="0.01" placeholder="0.00">
              </div>
            </div>

            <div class="form-group">
              <label>الحد الأدنى للتنبيه (Min Stock)</label>
              <input type="number" id="pr_min_stock" step="0.01" placeholder="0" value="0">
              <small class="hint">يظهر تنبيه لما الرصيد ينزل عن ده</small>
            </div>

            <div class="form-group">
              <label>ملاحظات</label>
              <textarea id="pr_notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="ProductsModule.closeModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="ProductsModule.save()">💾 حفظ</button>
          </div>
        </div>
      </div>
    `;
  },

  applyFilters() {
    const search = (document.getElementById('productSearch')?.value || '').toLowerCase().trim();
    const category = document.getElementById('productCategory')?.value || 'all';

    const products = LocalStore.get('products') || {};
    let list = Object.values(products);

    if (search) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(search) ||
        (p.sku || '').toLowerCase().includes(search) ||
        (p.barcode || '').toLowerCase().includes(search)
      );
    }

    if (category !== 'all') {
      list = list.filter(p => p.category === category);
    }

    document.getElementById('productsCount').textContent =
      list.length + ' صنف' + (list.length !== Object.keys(products).length ? ` (من إجمالي ${Object.keys(products).length})` : '');

    const tbody = document.getElementById('productsTableBody');
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="8" style="text-align:center; padding:40px; color: var(--gray-500);">
          <div style="font-size:48px; margin-bottom:12px;">📦</div>
          <div>لا يوجد أصناف</div>
        </td></tr>`;
      return;
    }

    const showPurchasePrice = hasPermission('products_view_purchase_prices');
    const canEdit = hasPermission('products_edit');
    const canDelete = hasPermission('products_delete');

    tbody.innerHTML = list.map(p => {
      const cats = getCategories();
      const units = getUnits();
      const catObj = cats.find(c => c.id === p.category) || cats[cats.length - 1] || { name: '—', icon: '' };
      const unitObj = units.find(u => u.id === p.unit) || units[0] || { name: 'وحدة' };
      const stock = TxnEngine.getProductStockAllWarehouses(p._id);
      const stockClass = stock.total <= (p.min_stock || 0) ? 'stock-low' : '';

      return `
        <tr>
          <td><strong>${p.sku || '—'}</strong></td>
          <td>${p.name}</td>
          <td>${catObj.icon || ''} ${catObj.name}</td>
          <td>${unitObj.name}</td>
          ${showPurchasePrice ? `<td>${fmtMoney(p.default_purchase_price)} ج.م</td>` : ''}
          <td>${fmtMoney(p.default_sale_price)} ج.م</td>
          <td class="${stockClass}"><strong>${fmtMoney(stock.total)}</strong> ${unitObj.name}</td>
          <td>
            <div style="display:flex; gap:4px;">
              ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="ProductsModule.showEditForm('${p._id}')">✏️</button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="ProductsModule.viewMovement('${p._id}')" title="حركة الصنف">📊</button>
              ${canDelete ? `<button class="btn btn-ghost btn-sm" onclick="ProductsModule.toggleActive('${p._id}')">🚫</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  showAddForm() {
    if (!requirePermission('products_add', 'إضافة صنف')) return;
    document.getElementById('productModalTitle').textContent = '➕ إضافة صنف جديد';
    document.getElementById('pr_id').value = '';
    ['pr_sku','pr_barcode','pr_name','pr_notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    // Auto-generate SKU
    const counters = LocalStore.get('counters') || {};
    const nextNum = String((counters.product || 1)).padStart(3, '0');
    document.getElementById('pr_sku').value = 'PRD-' + nextNum;
    document.getElementById('pr_purchase_price') && (document.getElementById('pr_purchase_price').value = '');
    document.getElementById('pr_sale_price').value = '';
    document.getElementById('pr_min_stock').value = '0';
    document.getElementById('productModal').style.display = 'flex';
    setTimeout(() => document.getElementById('pr_name').focus(), 100);
  },

  showEditForm(id) {
    if (!requirePermission('products_edit', 'تعديل صنف')) return;
    const products = LocalStore.get('products') || {};
    const p = products[id];
    if (!p) return showNotif('❌ الصنف غير موجود', 'danger');

    document.getElementById('productModalTitle').textContent = '✏️ تعديل: ' + p.name;
    document.getElementById('pr_id').value = id;
    document.getElementById('pr_sku').value = p.sku || '';
    document.getElementById('pr_barcode').value = p.barcode || '';
    document.getElementById('pr_name').value = p.name || '';
    document.getElementById('pr_category').value = p.category || 'other';
    document.getElementById('pr_unit').value = p.unit || 'kg';
    const pp = document.getElementById('pr_purchase_price');
    if (pp) pp.value = p.default_purchase_price || '';
    document.getElementById('pr_sale_price').value = p.default_sale_price || '';
    document.getElementById('pr_min_stock').value = p.min_stock || 0;
    document.getElementById('pr_notes').value = p.notes || '';
    document.getElementById('productModal').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('productModal').style.display = 'none';
  },

  save() {
    const id = document.getElementById('pr_id').value;
    const sku = document.getElementById('pr_sku').value.trim();
    const name = document.getElementById('pr_name').value.trim();

    if (!sku) return showNotif('❌ كود الصنف مطلوب', 'danger');
    if (!name) return showNotif('❌ اسم الصنف مطلوب', 'danger');

    const products = LocalStore.get('products') || {};

    // Check SKU duplicate
    const skuExists = Object.values(products).find(p => p.sku === sku && p._id !== id);
    if (skuExists) return showNotif('❌ الكود موجود بالفعل: ' + sku, 'danger');

    const pp = document.getElementById('pr_purchase_price');
    const data = {
      sku: sku,
      barcode: document.getElementById('pr_barcode').value.trim(),
      name: name,
      category: document.getElementById('pr_category').value,
      unit: document.getElementById('pr_unit').value,
      default_purchase_price: pp ? Number(pp.value) || 0 : 0,
      default_sale_price: Number(document.getElementById('pr_sale_price').value) || 0,
      min_stock: Number(document.getElementById('pr_min_stock').value) || 0,
      notes: document.getElementById('pr_notes').value.trim(),
      active: true
    };

    if (id) {
      // If purchase price hidden (no permission), keep old value
      if (!pp && products[id]) {
        data.default_purchase_price = products[id].default_purchase_price || 0;
      }
      products[id] = { ...products[id], ...data, updated_at: Date.now() };
      logActivity('update', 'products', id, name, {});
      showNotif('✅ تم تعديل الصنف', 'success');
    } else {
      const newId = genID('prd_');
      products[newId] = { _id: newId, ...data, created_at: Date.now(), created_by: currentUser._id };

      // Increment counter
      const counters = LocalStore.get('counters') || {};
      counters.product = (counters.product || 1) + 1;
      LocalStore.set('counters', counters);

      logActivity('create', 'products', newId, name, {});
      showNotif('✅ تم إضافة الصنف', 'success');
    }

    LocalStore.set('products', products);
    this.closeModal();
    this.applyFilters();
  },

  toggleActive(id) {
    const products = LocalStore.get('products') || {};
    const p = products[id];
    if (!p) return;
    if (!confirm(`هل تريد ${p.active ? 'تعطيل' : 'تفعيل'} الصنف "${p.name}"?`)) return;

    p.active = !p.active;
    products[id] = p;
    LocalStore.set('products', products);
    logActivity('update', 'products', id, p.name, { active: p.active });
    showNotif('✅ تم', 'success');
    this.applyFilters();
  },

  viewMovement(id) {
    switchModule('inventory');
    setTimeout(() => {
      if (typeof InventoryModule !== 'undefined' && InventoryModule.viewProductMovement) {
        InventoryModule.viewProductMovement(id);
      }
    }, 100);
  },

  // ==========================================================
  // 🏷️ إدارة الوحدات (Dynamic Units)
  // ==========================================================
  showUnitsManager() {
    if (currentUser.role !== 'admin') {
      return showNotif('❌ الأدمن فقط يقدر يدير الوحدات', 'danger');
    }

    this.renderUnitsModal();
  },

  renderUnitsModal() {
    const units = getUnits();
    const products = Object.values(LocalStore.get('products') || {});

    // احسب استخدام كل وحدة
    const usageMap = {};
    products.forEach(p => {
      if (p.unit) usageMap[p.unit] = (usageMap[p.unit] || 0) + 1;
    });

    const modalHtml = `
      <div id="unitsModal" class="modal-overlay">
        <div class="modal" style="max-width: 620px;">
          <div class="modal-header">
            <h3>🏷️ إدارة وحدات القياس</h3>
            <button class="modal-close" onclick="ProductsModule.closeUnitsModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:#EDE9FE; border-radius:var(--radius); margin-bottom:16px; font-size:13px;">
              <strong>💡 إزاي تشتغل:</strong>
              <div style="margin-top:6px; color:var(--gray-700);">
                • أضف أي وحدة جديدة (زي البرميل للزيت أو اللتر للسوائل)<br>
                • الوحدات المستخدمة في أصناف لا يمكن حذفها — نقدر نعطلها فقط<br>
                • الأصناف القديمة تفضل تشاور على وحدتها حتى لو غيرت اسمها
              </div>
            </div>

            <!-- Add New Unit -->
            <div style="padding:12px; background:var(--gray-50); border-radius:var(--radius); margin-bottom:16px;">
              <div style="font-weight:700; margin-bottom:10px;">➕ إضافة وحدة جديدة</div>
              <div class="grid grid-3" style="gap:8px;">
                <div>
                  <input type="text" id="new_unit_id" placeholder="ID (بالإنجليزي)"
                         style="padding:8px 12px;">
                  <small class="hint">مثل: barrel, liter</small>
                </div>
                <div>
                  <input type="text" id="new_unit_name" placeholder="الاسم بالعربي"
                         style="padding:8px 12px;">
                  <small class="hint">مثل: برميل، لتر</small>
                </div>
                <button class="btn btn-primary" onclick="ProductsModule.addUnit()">
                  ➕ إضافة
                </button>
              </div>
            </div>

            <!-- Units List -->
            <div class="table-container" style="box-shadow:none; border:1px solid var(--gray-200);">
              <table>
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>ID</th>
                    <th>الاستخدام</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${units.map(u => {
                    const usage = usageMap[u.id] || 0;
                    const isActive = u.active !== false;
                    return `
                      <tr style="${!isActive ? 'opacity:0.5;' : ''}">
                        <td>
                          <input type="text" value="${u.name}"
                                 style="padding:6px 10px; font-size:13px;"
                                 onchange="ProductsModule.updateUnitName('${u.id}', this.value)">
                        </td>
                        <td><code style="background:var(--gray-100); padding:2px 6px; border-radius:4px;">${u.id}</code></td>
                        <td>
                          ${usage > 0 ? `<strong>${usage}</strong> صنف` : '<span style="color:var(--gray-400);">لا يستخدم</span>'}
                        </td>
                        <td>
                          ${isActive
                            ? '<span class="txn-badge" style="background:#D1FAE5;color:#065F46;">✅ نشط</span>'
                            : '<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;">🚫 معطل</span>'
                          }
                        </td>
                        <td>
                          <div style="display:flex; gap:4px;">
                            <button class="btn btn-ghost btn-sm" onclick="ProductsModule.toggleUnit('${u.id}')" title="${isActive ? 'تعطيل' : 'تفعيل'}">
                              ${isActive ? '⏸️' : '▶️'}
                            </button>
                            ${usage === 0 ? `
                              <button class="btn btn-ghost btn-sm" onclick="ProductsModule.deleteUnit('${u.id}')"
                                      style="color:var(--danger);" title="حذف">🗑️</button>
                            ` : `
                              <button class="btn btn-ghost btn-sm" disabled title="مستخدمة في ${usage} صنف">🔒</button>
                            `}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="ProductsModule.resetUnitsDefault()">
              🔄 استرجاع الافتراضي
            </button>
            <button class="btn btn-primary" onclick="ProductsModule.closeUnitsModal()">
              ✅ خلاص
            </button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('unitsModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  closeUnitsModal() {
    document.getElementById('unitsModal')?.remove();
    // Refresh products view لو الأصناف مفتوحة
    this.render();
  },

  addUnit() {
    const idInput = document.getElementById('new_unit_id');
    const nameInput = document.getElementById('new_unit_name');
    const id = idInput.value.trim().toLowerCase();
    const name = nameInput.value.trim();

    if (!id) return showNotif('❌ الـ ID مطلوب', 'danger');
    if (!name) return showNotif('❌ الاسم مطلوب', 'danger');
    if (!/^[a-z0-9_]+$/.test(id)) {
      return showNotif('❌ الـ ID لازم يبقى إنجليزي (letters, numbers, _)', 'danger');
    }

    const units = getUnits();
    if (units.find(u => u.id === id)) {
      return showNotif('❌ الـ ID موجود بالفعل: ' + id, 'danger');
    }

    units.push({ id, name, active: true });
    LocalStore.set('settings/units', units);

    logActivity('add_unit', 'settings', id, name);
    showNotif('✅ تم إضافة الوحدة: ' + name, 'success');

    idInput.value = '';
    nameInput.value = '';
    this.renderUnitsModal();
  },

  updateUnitName(unitId, newName) {
    newName = newName.trim();
    if (!newName) return;

    const units = getUnits();
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    if (unit.name === newName) return;

    const oldName = unit.name;
    unit.name = newName;
    LocalStore.set('settings/units', units);

    logActivity('update_unit', 'settings', unitId, `${oldName} → ${newName}`);
    showNotif('✅ تم تحديث الاسم', 'success');
  },

  toggleUnit(unitId) {
    const units = getUnits();
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    unit.active = unit.active === false ? true : false;
    LocalStore.set('settings/units', units);

    logActivity('toggle_unit', 'settings', unitId, unit.name + ' → ' + (unit.active ? 'نشط' : 'معطل'));
    showNotif('✅ تم', 'success');
    this.renderUnitsModal();
  },

  deleteUnit(unitId) {
    const units = getUnits();
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    // فحص الاستخدام
    const products = Object.values(LocalStore.get('products') || {});
    const usage = products.filter(p => p.unit === unitId).length;
    if (usage > 0) {
      return showNotif('❌ الوحدة مستخدمة في ' + usage + ' صنف - لا يمكن حذفها', 'danger');
    }

    if (!confirm(`⚠️ هل تريد حذف وحدة "${unit.name}" نهائياً؟`)) return;

    const newUnits = units.filter(u => u.id !== unitId);
    LocalStore.set('settings/units', newUnits);

    logActivity('delete_unit', 'settings', unitId, unit.name);
    showNotif('✅ تم الحذف', 'success');
    this.renderUnitsModal();
  },

  resetUnitsDefault() {
    if (!confirm('⚠️ هل تريد استرجاع الوحدات الافتراضية؟\n\nالوحدات المضافة لن تُحذف، بس هترجع الوحدات الأصلية للنشاط.')) return;

    // ادمج الافتراضي مع الموجود
    const current = getUnits();
    const merged = [...DEFAULT_UNITS];
    current.forEach(u => {
      if (!merged.find(m => m.id === u.id)) merged.push(u);
    });

    LocalStore.set('settings/units', merged);
    logActivity('reset_units', 'settings', '', 'استرجاع افتراضي');
    showNotif('✅ تم الاسترجاع', 'success');
    this.renderUnitsModal();
  }
};
