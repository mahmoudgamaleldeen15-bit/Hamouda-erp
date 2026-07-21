// ==========================================================
// Permissions UI Module - إدارة صلاحيات الأدوار
// ==========================================================

const PermissionsUIModule = {

  currentRole: 'accountant', // الدور المعروض حالياً
  hasChanges: false,
  workingPermissions: null, // نسخة العمل (قبل الحفظ)

  // ==========================================================
  // Definition of all permissions organized by section
  // ==========================================================
  PERMISSION_SECTIONS: [
    {
      title: '📊 لوحة التحكم',
      icon: '📊',
      permissions: [
        { key: 'dashboard_view', label: 'عرض الرئيسية' },
        { key: 'dashboard_view_profit', label: 'عرض الأرباح', warning: true }
      ]
    },
    {
      title: '🍇 الأصناف',
      icon: '🍇',
      permissions: [
        { key: 'products_view', label: 'عرض الأصناف' },
        { key: 'products_add', label: 'إضافة صنف جديد' },
        { key: 'products_edit', label: 'تعديل صنف' },
        { key: 'products_delete', label: 'حذف/تعطيل صنف', warning: true },
        { key: 'products_view_purchase_price', label: 'عرض سعر الشراء', warning: true }
      ]
    },
    {
      title: '🏢 المخازن',
      icon: '🏢',
      permissions: [
        { key: 'warehouses_view', label: 'عرض المخازن' },
        { key: 'warehouses_manage', label: 'إدارة المخازن (إضافة/تعديل)' },
        { key: 'inventory_adjust', label: 'تسوية المخزون', warning: true },
        { key: 'inventory_transfer', label: 'نقل بين المخازن' }
      ]
    },
    {
      title: '👥 العملاء',
      icon: '👥',
      permissions: [
        { key: 'customers_view', label: 'عرض العملاء' },
        { key: 'customers_add', label: 'إضافة عميل' },
        { key: 'customers_edit_contact', label: 'تعديل التليفون والعنوان' },
        { key: 'customers_edit_full', label: 'تعديل كامل (كود، حالة، حد ائتماني)' },
        { key: 'customers_edit_credit_limit', label: 'تعديل الحد الائتماني', warning: true },
        { key: 'customers_view_lifetime', label: 'عرض إجمالي المبيعات التاريخي' }
      ]
    },
    {
      title: '🏭 الموردين',
      icon: '🏭',
      permissions: [
        { key: 'suppliers_view', label: 'عرض الموردين' },
        { key: 'suppliers_manage', label: 'إضافة / تعديل مورد' }
      ]
    },
    {
      title: '💰 المبيعات',
      icon: '💰',
      permissions: [
        { key: 'sales_view', label: 'عرض المبيعات' },
        { key: 'sales_add_cash', label: 'إضافة فاتورة كاش' },
        { key: 'sales_add_credit', label: 'إضافة فاتورة آجل' },
        { key: 'sales_cancel', label: 'إلغاء فاتورة', warning: true },
        { key: 'sales_override_stock', label: 'البيع بأكثر من المتاح (رصيد سالب)', warning: true },
        { key: 'sales_override_credit_limit', label: 'تجاوز الحد الائتماني', warning: true }
      ]
    },
    {
      title: '🛒 المشتريات',
      icon: '🛒',
      permissions: [
        { key: 'purchases_view', label: 'عرض المشتريات' },
        { key: 'purchases_add', label: 'إضافة فاتورة شراء' },
        { key: 'purchases_cancel', label: 'إلغاء فاتورة شراء', warning: true }
      ]
    },
    {
      title: '🔴 المدينين',
      icon: '🔴',
      permissions: [
        { key: 'debtors_view', label: 'عرض المدينين' },
        { key: 'debtors_collect_payment', label: 'تحصيل دفعة' },
        { key: 'debtors_full_settlement', label: 'التسوية الكاملة' },
        { key: 'debtors_waive', label: 'إعفاء من الديون', warning: true },
        { key: 'debtors_reschedule', label: 'إعادة جدولة الاستحقاق' }
      ]
    },
    {
      title: '📊 التقارير',
      icon: '📊',
      permissions: [
        { key: 'reports_sales', label: 'تقارير المبيعات' },
        { key: 'reports_purchases', label: 'تقارير المشتريات' },
        { key: 'reports_inventory', label: 'تقارير المخزون' },
        { key: 'reports_debtors', label: 'تقارير المدينين' },
        { key: 'reports_profit', label: 'تقارير الأرباح', warning: true },
        { key: 'reports_export', label: 'تصدير التقارير (PDF/Excel)' }
      ]
    },
    {
      title: '📱 الواتساب',
      icon: '📱',
      permissions: [
        { key: 'whatsapp_send_invoice', label: 'إرسال فاتورة للعميل' },
        { key: 'whatsapp_send_reminder', label: 'إرسال مطالبة مباشرة للعميل', warning: true },
        { key: 'whatsapp_send_to_haj', label: 'إرسال للحاج' }
      ]
    },
    {
      title: '📜 سجل العمليات',
      icon: '📜',
      permissions: [
        { key: 'activity_view', label: 'مشاهدة سجل العمليات' }
      ]
    }
  ],

  // ==========================================================
  // Render
  // ==========================================================
  render() {
    if (currentUser.role !== 'admin') {
      return renderPlaceholder('🔐 إدارة الصلاحيات', '⛔ للأدمن فقط');
    }

    // Load working copy
    if (!this.workingPermissions) {
      const stored = LocalStore.get('settings/permissions') || { roles: DEFAULT_ROLES };
      this.workingPermissions = JSON.parse(JSON.stringify(stored.roles));
      this.hasChanges = false;
    }

    const container = document.getElementById('moduleContainer');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🔐 إدارة الصلاحيات</div>
          <div class="page-subtitle">تحكم في اللي كل دور يقدر يعمله</div>
        </div>
        <div class="page-actions">
          ${this.hasChanges ? `
            <button class="btn btn-primary" onclick="PermissionsUIModule.saveChanges()">
              💾 حفظ التغييرات
            </button>
            <button class="btn btn-outline" onclick="PermissionsUIModule.discardChanges()">
              🔙 إلغاء
            </button>
          ` : `
            <button class="btn btn-primary" onclick="PermissionsUIModule.showAddRoleModal()">
              ➕ دور جديد
            </button>
            <button class="btn btn-outline" onclick="PermissionsUIModule.resetCurrentRole()">
              🔄 استرجاع الافتراضي
            </button>
          `}
        </div>
      </div>

      <!-- Alert -->
      ${this.hasChanges ? `
        <div class="card" style="background:#FEF3C7; border:1px solid #FCD34D; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:24px;">⚠️</div>
            <div style="flex:1;">
              <div style="font-weight:700; color:#92400E;">فيه تغييرات مش محفوظة</div>
              <div style="font-size:13px; color:#78350F;">التغييرات هتتفعل بعد الحفظ</div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Role Tabs -->
      <div class="tabs" style="margin-bottom: 16px;">
        <button class="tab-btn" style="opacity:0.6; cursor:not-allowed;" disabled title="الأدمن محمي - له كل الصلاحيات">
          👑 الأدمن (محمي)
        </button>
        ${Object.keys(this.workingPermissions).filter(k => k !== 'admin').map(roleKey => {
          const role = this.workingPermissions[roleKey];
          const isCustom = role.custom === true;
          const icon = isCustom ? '⚡' : (roleKey === 'accountant' ? '📊' : '💼');
          const isCurrent = this.currentRole === roleKey;
          return `
            <button class="tab-btn ${isCurrent ? 'active' : ''}"
                    onclick="PermissionsUIModule.switchRole('${roleKey}')">
              ${icon} ${role.name || roleKey}
              ${isCustom ? '<span style="font-size:10px; margin-right:6px; background:var(--grape-100); color:var(--grape-700); padding:2px 6px; border-radius:8px;">مخصص</span>' : ''}
            </button>
          `;
        }).join('')}
      </div>

      <!-- Role Info Card -->
      ${(() => {
        const role = this.workingPermissions[this.currentRole];
        if (!role) return '';
        const isCustom = role.custom === true;
        const roleUsers = Object.values(LocalStore.get('users') || {}).filter(u => u.role === this.currentRole).length;
        const icon = isCustom ? '⚡' : (this.currentRole === 'accountant' ? '📊' : '💼');
        return `
          <div class="card" style="margin-bottom: 16px; background: ${isCustom ? '#F5F3FF' : (this.currentRole === 'accountant' ? '#F0FDF4' : '#FEF3C7')};">
            <div style="display:flex; align-items:center; gap:16px;">
              <div style="font-size:48px;">${icon}</div>
              <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <div style="font-weight:800; font-size:18px; color:var(--gray-800);">
                    ${role.name || this.currentRole}
                  </div>
                  ${isCustom ? '<span style="font-size:11px; background:var(--grape-100); color:var(--grape-700); padding:3px 8px; border-radius:10px; font-weight:700;">دور مخصص</span>' : ''}
                </div>
                <div style="font-size:13px; color:var(--gray-600); margin-top:4px;">
                  ${isCustom ? 'دور أنشأته أنت - عدل صلاحياته زي ما تحب' : (this.currentRole === 'accountant' ? 'المحاسب مسؤول عن الفواتير والمخزون والتقارير.' : 'المندوب مسؤول عن البيع والتحصيل من العملاء.')}
                </div>
                <div style="font-size:12px; color:var(--gray-500); margin-top:4px;">
                  👥 ${roleUsers} مستخدم بهذا الدور
                </div>
              </div>
              <div style="display:flex; flex-direction:column; gap:8px; align-items:center;">
                <div style="text-align:center; padding:12px 20px; background:white; border-radius:var(--radius); font-weight:700;">
                  <div style="font-size:24px; color:var(--grape-700);">
                    ${Object.values(role.permissions || {}).filter(v => v === true).length}
                  </div>
                  <div style="font-size:11px; color:var(--gray-500);">صلاحية نشطة</div>
                </div>
                ${isCustom && roleUsers === 0 ? `
                  <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);"
                          onclick="PermissionsUIModule.deleteRole('${this.currentRole}')">
                    🗑️ حذف الدور
                  </button>
                ` : ''}
                ${isCustom && roleUsers > 0 ? `
                  <div style="font-size:11px; color:var(--gray-500); text-align:center;">
                    🔒 لا يمكن حذفه<br>(مستخدم في ${roleUsers} حساب)
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      })()}

      <!-- Permissions Sections -->
      <div class="permissions-grid">
        ${this.PERMISSION_SECTIONS.map(section => this.renderSection(section)).join('')}
      </div>
    `;
  },

  renderSection(section) {
    const rolePerms = this.workingPermissions[this.currentRole]?.permissions || {};

    const enabledInSection = section.permissions.filter(p => rolePerms[p.key] === true).length;
    const totalInSection = section.permissions.length;

    return `
      <div class="permission-section">
        <div class="permission-section-header">
          <div style="font-weight:700; font-size:15px; color:var(--gray-800);">
            ${section.title}
          </div>
          <div style="font-size:12px; color:var(--gray-500); background:var(--gray-100); padding:4px 10px; border-radius:12px;">
            ${enabledInSection} / ${totalInSection}
          </div>
        </div>

        <div class="permission-list">
          ${section.permissions.map(perm => {
            const isEnabled = rolePerms[perm.key] === true;
            return `
              <label class="permission-item ${isEnabled ? 'enabled' : ''} ${perm.warning ? 'has-warning' : ''}">
                <input type="checkbox" ${isEnabled ? 'checked' : ''}
                       onchange="PermissionsUIModule.togglePermission('${perm.key}', this.checked)">
                <div class="permission-info">
                  <div class="permission-label">
                    ${perm.warning ? '⚠️ ' : ''}${perm.label}
                  </div>
                  <div class="permission-key">${perm.key}</div>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  switchRole(role) {
    this.currentRole = role;
    this.render();
  },

  togglePermission(key, enabled) {
    if (!this.workingPermissions[this.currentRole].permissions) {
      this.workingPermissions[this.currentRole].permissions = {};
    }
    this.workingPermissions[this.currentRole].permissions[key] = enabled;
    this.hasChanges = true;
    this.render();
  },

  saveChanges() {
    if (!confirm('✅ حفظ التغييرات على صلاحيات "' + (this.currentRole === 'accountant' ? 'المحاسب' : 'المندوب') + '"؟\n\nكل المستخدمين اللي بهذا الدور، صلاحياتهم هتتحدث فوراً.')) return;

    const current = LocalStore.get('settings/permissions') || { roles: DEFAULT_ROLES };
    current.roles = this.workingPermissions;
    current.updated_at = Date.now();
    current.updated_by = currentUser._id;
    LocalStore.set('settings/permissions', current);

    logActivity('update_permissions', 'settings', this.currentRole, this.currentRole, {
      role: this.currentRole
    });

    this.hasChanges = false;
    showNotif('✅ تم حفظ الصلاحيات', 'success', 3000);
    this.render();
  },

  discardChanges() {
    if (!confirm('⚠️ إلغاء كل التغييرات ورجوع للنسخة المحفوظة؟')) return;
    this.workingPermissions = null;
    this.render();
  },

  resetCurrentRole() {
    const role = this.workingPermissions[this.currentRole];
    if (!role) return;

    // Custom roles - reset means clear all permissions
    if (role.custom) {
      if (!confirm(`⚠️ إفراغ كل صلاحيات "${role.name}"؟`)) return;
      this.workingPermissions[this.currentRole].permissions = {};
      this.hasChanges = true;
      showNotif('✅ تم الإفراغ - اضغط "💾 حفظ التغييرات" للتفعيل', 'info', 4000);
      this.render();
      return;
    }

    // Default roles - reset to DEFAULT_ROLES
    const roleName = this.currentRole === 'accountant' ? 'المحاسب' : 'المندوب';
    if (!confirm(`⚠️ استرجاع صلاحيات "${roleName}" للافتراضي؟\n\nكل التغييرات على هذا الدور هتتلغى.`)) return;

    this.workingPermissions[this.currentRole] = JSON.parse(JSON.stringify(DEFAULT_ROLES[this.currentRole]));
    this.hasChanges = true;
    showNotif('✅ تم استرجاع الافتراضي - اضغط "💾 حفظ التغييرات" للتفعيل', 'info', 4000);
    this.render();
  },

  // ==========================================================
  // Custom Roles Management
  // ==========================================================
  showAddRoleModal() {
    const modalHtml = `
      <div id="addRoleModal" class="modal-overlay">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3>➕ إضافة دور جديد</h3>
            <button class="modal-close" onclick="PermissionsUIModule.closeAddRoleModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:#EDE9FE; border-radius:var(--radius); margin-bottom:16px; font-size:13px;">
              <strong>💡 أمثلة على الأدوار المخصصة:</strong>
              <div style="margin-top:6px; color:var(--gray-700);">
                • مسؤول مخزن — يعرض المخزون بس مش بيبيع<br>
                • كاشير — يبيع كاش بس بدون آجل<br>
                • مسؤول تحصيل — يتابع المدينين ويحصل بس<br>
                • مساعد إداري — عرض التقارير فقط
              </div>
            </div>

            <div class="form-group">
              <label>اسم الدور بالعربي *</label>
              <input type="text" id="new_role_name" placeholder="مثل: مسؤول مخزن، كاشير..." autofocus>
            </div>

            <div class="form-group">
              <label>ID بالإنجليزي (اختياري) *</label>
              <input type="text" id="new_role_key" placeholder="warehouse_manager, cashier..."
                     oninput="this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')">
              <small class="hint">يُستخدم داخلياً - بدون مسافات - بالإنجليزي فقط</small>
            </div>

            <div class="form-group">
              <label>ابدأ الدور بـ:</label>
              <div class="unit-type-toggle">
                <label class="unit-type-option selected">
                  <input type="radio" name="role_start" value="empty" checked>
                  <span>🔓 صلاحيات فارغة (أنت تحدد)</span>
                </label>
                <label class="unit-type-option">
                  <input type="radio" name="role_start" value="accountant">
                  <span>📊 نسخة من المحاسب</span>
                </label>
                <label class="unit-type-option">
                  <input type="radio" name="role_start" value="salesman">
                  <span>💼 نسخة من المندوب</span>
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="PermissionsUIModule.closeAddRoleModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="PermissionsUIModule.createRole()">➕ إنشاء</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('addRoleModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Auto-generate key from name
    document.getElementById('new_role_name').addEventListener('input', function() {
      const keyInput = document.getElementById('new_role_key');
      if (!keyInput.dataset.touched) {
        // Simple transliteration for common Arabic role names
        const map = {
          'مسؤول': 'manager', 'مسئول': 'manager', 'كاشير': 'cashier',
          'مخزن': 'warehouse', 'محاسب': 'accountant', 'مبيعات': 'sales',
          'مشتريات': 'purchases', 'تحصيل': 'collector', 'مندوب': 'rep',
          'إداري': 'admin_asst', 'مدير': 'director'
        };
        let key = this.value.trim();
        Object.keys(map).forEach(ar => {
          key = key.replace(new RegExp(ar, 'g'), map[ar]);
        });
        key = key.toLowerCase().replace(/[^a-z0-9_\s]/g, '').replace(/\s+/g, '_');
        if (key) keyInput.value = 'custom_' + key;
      }
    });
    document.getElementById('new_role_key').addEventListener('input', function() {
      this.dataset.touched = 'true';
    });
  },

  closeAddRoleModal() {
    document.getElementById('addRoleModal')?.remove();
  },

  createRole() {
    const name = document.getElementById('new_role_name').value.trim();
    let key = document.getElementById('new_role_key').value.trim();
    const startFrom = document.querySelector('input[name="role_start"]:checked').value;

    // Validation
    if (!name) return showNotif('❌ اسم الدور مطلوب', 'danger');
    if (!key) {
      key = 'custom_' + Date.now();
    }

    // Ensure prefix
    if (!key.startsWith('custom_') && !['accountant', 'salesman', 'admin'].includes(key)) {
      key = 'custom_' + key;
    }

    // Check duplicate
    if (this.workingPermissions[key]) {
      return showNotif('❌ ID موجود بالفعل، اختار واحد تاني', 'danger');
    }

    // Build permissions based on start choice
    let permissions = {};
    if (startFrom === 'accountant' && this.workingPermissions.accountant) {
      permissions = JSON.parse(JSON.stringify(this.workingPermissions.accountant.permissions || {}));
    } else if (startFrom === 'salesman' && this.workingPermissions.salesman) {
      permissions = JSON.parse(JSON.stringify(this.workingPermissions.salesman.permissions || {}));
    }

    // Create role
    this.workingPermissions[key] = {
      name: name,
      permissions: permissions,
      custom: true,
      created_at: Date.now(),
      created_by: currentUser._id
    };

    this.currentRole = key;
    this.hasChanges = true;
    this.closeAddRoleModal();
    showNotif('✅ تم إنشاء الدور: ' + name + ' - اضغط "💾 حفظ" للتفعيل', 'success', 4000);
    this.render();
  },

  deleteRole(roleKey) {
    const role = this.workingPermissions[roleKey];
    if (!role || !role.custom) {
      return showNotif('❌ الأدوار الافتراضية لا تُحذف', 'danger');
    }

    // Double check no users
    const roleUsers = Object.values(LocalStore.get('users') || {}).filter(u => u.role === roleKey);
    if (roleUsers.length > 0) {
      return showNotif(`❌ الدور مستخدم في ${roleUsers.length} حساب - غير دورهم أولاً`, 'danger');
    }

    if (!confirm(`⚠️ حذف دور "${role.name}" نهائياً؟\n\nمش هينفع تسترجعه بعد كده.`)) return;

    delete this.workingPermissions[roleKey];
    this.currentRole = 'accountant'; // ارجع للمحاسب
    this.hasChanges = true;
    showNotif('✅ تم الحذف - اضغط "💾 حفظ" للتفعيل', 'info', 4000);
    this.render();
  }
};
