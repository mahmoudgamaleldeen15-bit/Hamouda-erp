// ==========================================================
// Users Module - إدارة المستخدمين
// ==========================================================

const UsersModule = {

  currentView: 'list',
  searchQuery: '',
  roleFilter: 'all',

  render() {
    if (!requirePermission('users_view', 'مشاهدة المستخدمين')) {
      return renderPlaceholder('👤 المستخدمين', 'مش مصرح');
    }

    return this.renderList();
  },

  // ==========================================================
  // Get role label
  // ==========================================================
  getRoleLabel(role) {
    const defaults = {
      'admin': { icon: '👑', name: 'الحاج (الأدمن)', color: '#7C3AED' },
      'accountant': { icon: '📊', name: 'المحاسب', color: '#059669' },
      'salesman': { icon: '💼', name: 'المندوب', color: '#D97706' }
    };

    // Default role
    if (defaults[role]) return defaults[role];

    // Custom role - read from settings
    const settings = LocalStore.get('settings/permissions') || { roles: DEFAULT_ROLES };
    const customRole = settings.roles?.[role];
    if (customRole) {
      return { icon: '⚡', name: customRole.name || role, color: '#7C3AED' };
    }

    return { icon: '❓', name: role, color: '#6B7280' };
  },

  // Get all roles for dropdown
  getAllRoles() {
    const settings = LocalStore.get('settings/permissions') || { roles: DEFAULT_ROLES };
    const roles = settings.roles || DEFAULT_ROLES;
    return Object.keys(roles).filter(k => k !== 'admin').map(key => ({
      key: key,
      name: roles[key].name || key,
      custom: roles[key].custom === true
    }));
  },

  // ==========================================================
  // List View
  // ==========================================================
  renderList() {
    const container = document.getElementById('moduleContainer');
    const users = LocalStore.get('users') || {};
    let list = Object.values(users);

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q)
      );
    }

    if (this.roleFilter !== 'all') {
      list = list.filter(u => u.role === this.roleFilter);
    }

    // Stats
    const admin = list.filter(u => u.role === 'admin').length;
    const accountants = list.filter(u => u.role === 'accountant').length;
    const salesmen = list.filter(u => u.role === 'salesman').length;
    const activeCount = list.filter(u => u.active !== false).length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">👤 المستخدمين</div>
          <div class="page-subtitle">${list.length} مستخدم — ${activeCount} نشط</div>
        </div>
        <div class="page-actions">
          ${hasPermission('users_add') ? `
          <button class="btn btn-primary" onclick="UsersModule.showAddForm()">
            ➕ مستخدم جديد
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-4" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-label">👑 الأدمن</div>
          <div class="stat-value">${admin}</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">📊 المحاسبين</div>
          <div class="stat-value">${accountants}</div>
        </div>
        <div class="stat-card stat-gold">
          <div class="stat-label">💼 المندوبين</div>
          <div class="stat-value">${salesmen}</div>
        </div>
        <div class="stat-card stat-blue">
          <div class="stat-label">✅ النشطين</div>
          <div class="stat-value">${activeCount}</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="grid grid-2">
          <div class="form-group" style="margin:0;">
            <input type="text" id="userSearch" placeholder="🔍 بحث بالاسم / اسم الدخول / التليفون..."
                   value="${this.searchQuery}"
                   oninput="UsersModule.search(this.value)">
          </div>
          <div class="form-group" style="margin:0;">
            <select id="userRole" onchange="UsersModule.filterRole(this.value)">
              <option value="all" ${this.roleFilter === 'all' ? 'selected' : ''}>كل الأدوار</option>
              <option value="admin" ${this.roleFilter === 'admin' ? 'selected' : ''}>👑 الأدمن</option>
              ${this.getAllRoles().map(r => `
                <option value="${r.key}" ${this.roleFilter === r.key ? 'selected' : ''}>
                  ${r.custom ? '⚡' : (r.key === 'accountant' ? '📊' : '💼')} ${r.name}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>اسم الدخول</th>
              <th>الكود</th>
              <th>الدور</th>
              <th>التليفون</th>
              <th>آخر دخول</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `
              <tr><td colspan="8" style="text-align:center; padding:40px; color:var(--gray-500);">
                <div style="font-size:48px; margin-bottom:12px;">👤</div>
                <div>لا يوجد مستخدمين</div>
              </td></tr>
            ` : list.map(u => this.renderRow(u)).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderRow(u) {
    const roleInfo = this.getRoleLabel(u.role);
    // ✅ الأدمن محمي - الفحص على الدور
    const isProtected = u.role === 'admin';
    const isCurrent = u._id === currentUser._id;
    const isActive = u.active !== false;

    const statusBadge = !isActive
      ? '<span class="txn-badge" style="background:#FEE2E2;color:#991B1B;">🚫 معطل</span>'
      : '<span class="txn-badge" style="background:#D1FAE5;color:#065F46;">✅ نشط</span>';

    const lastLogin = u.last_login
      ? fmtDateTime(u.last_login)
      : '<em style="color:var(--gray-400);">لم يدخل بعد</em>';

    return `
      <tr>
        <td>
          <strong>${u.name}</strong>
          ${isCurrent ? '<span style="font-size:11px; color:var(--grape-600); margin-right:6px;">(أنت)</span>' : ''}
        </td>
        <td><code style="background:var(--gray-100); padding:2px 6px; border-radius:4px;">${u.username}</code></td>
        <td>
          <span style="background:#7C3AED; color:white; padding:4px 10px; border-radius:6px; font-weight:800; font-family:monospace; font-size:13px;">
            ${u.user_code || '—'}
          </span>
        </td>
        <td>
          <span style="color:${roleInfo.color}; font-weight:700;">
            ${roleInfo.icon} ${roleInfo.name}
          </span>
        </td>
        <td>${u.phone || '—'}</td>
        <td style="font-size:13px;">${lastLogin}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap:4px;">
            ${hasPermission('users_edit') && (!isProtected || isCurrent) ? `
              <button class="btn btn-ghost btn-sm" onclick="UsersModule.showEditForm('${u._id}')" title="${isCurrent && isProtected ? 'تعديل بياناتك (اسم/تليفون)' : 'تعديل'}">✏️</button>
            ` : ''}
            ${hasPermission('users_reset_password') && !isCurrent && !isProtected ? `
              <button class="btn btn-ghost btn-sm" onclick="UsersModule.showResetPasswordModal('${u._id}')" title="إعادة تعيين كلمة السر">🔑</button>
            ` : ''}
            ${hasPermission('users_toggle_active') && !isProtected && !isCurrent ? `
              <button class="btn btn-ghost btn-sm" onclick="UsersModule.toggleActive('${u._id}')" title="${isActive ? 'تعطيل' : 'تفعيل'}">
                ${isActive ? '⏸️' : '▶️'}
              </button>
            ` : ''}
            ${hasPermission('users_delete') && !isProtected && !isCurrent ? `
              <button class="btn btn-ghost btn-sm" onclick="UsersModule.deleteUser('${u._id}')"
                      style="color:var(--danger);" title="حذف">🗑️</button>
            ` : ''}
            ${isProtected && !isCurrent ? '<span style="color:var(--gray-400); font-size:12px;">🔒 محمي</span>' : ''}
          </div>
        </td>
      </tr>
    `;
  },

  search(q) {
    this.searchQuery = q;
    this.render();
  },

  filterRole(role) {
    this.roleFilter = role;
    this.render();
  },

  // ==========================================================
  // Add / Edit Modal
  // ==========================================================
  showAddForm() {
    if (!requirePermission('users_add', 'إضافة مستخدم')) return;
    this.renderUserModal(null);
  },

  showEditForm(id) {
    if (!requirePermission('users_edit', 'تعديل مستخدم')) return;
    const users = LocalStore.get('users') || {};
    const user = users[id];
    if (!user) return showNotif('❌ المستخدم غير موجود', 'danger');

    // ✅ إصلاح الحماية: الفحص على الدور مش على الـ ID
    // الأدمن الوحيد الموجود لا يعدله حد إلا هو نفسه، وحتى هو مش يقدر يغير دوره
    if (user.role === 'admin' && user._id !== currentUser._id) {
      return showNotif('🔒 الأدمن محمي - لا يمكن تعديله من مستخدم آخر', 'warning');
    }

    this.renderUserModal(user);
  },

  renderUserModal(user) {
    const isEdit = !!user;
    const title = isEdit ? `✏️ تعديل: ${user.name}` : '➕ مستخدم جديد';

    const modalHtml = `
      <div id="userModal" class="modal-overlay">
        <div class="modal" style="max-width: 550px;">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="UsersModule.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="u_id" value="${user?._id || ''}">

            <div class="grid grid-2">
              <div class="form-group">
                <label>الاسم *</label>
                <input type="text" id="u_name" value="${user?.name || ''}" placeholder="اسم المستخدم">
              </div>
              <div class="form-group">
                <label>اسم الدخول *</label>
                <input type="text" id="u_username" value="${user?.username || ''}"
                       placeholder="username" ${isEdit ? 'readonly style="background:var(--gray-100);"' : ''}>
                ${isEdit ? '<small class="hint">لا يمكن تعديل اسم الدخول</small>' : '<small class="hint">بالإنجليزي فقط - بدون مسافات</small>'}
              </div>
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label>الدور *</label>
                ${user?.role === 'admin' ? `
                  <select id="u_role" disabled style="background:#F5F3FF; color:#7C3AED; font-weight:700;">
                    <option value="admin" selected>👑 الأدمن (محمي - لا يتغير)</option>
                  </select>
                  <small class="hint" style="color:var(--danger);">🔒 دور الأدمن محمي — لا يمكن تحويله لأي دور آخر</small>
                ` : `
                  <select id="u_role">
                    ${this.getAllRoles().map(r => `
                      <option value="${r.key}" ${user?.role === r.key ? 'selected' : ''}>
                        ${r.custom ? '⚡' : (r.key === 'accountant' ? '📊' : '💼')} ${r.name}
                        ${r.custom ? ' (مخصص)' : ''}
                      </option>
                    `).join('')}
                  </select>
                `}
              </div>
              <div class="form-group">
                <label>التليفون</label>
                <input type="tel" id="u_phone" value="${user?.phone || ''}" placeholder="01xxxxxxxxx">
              </div>
            </div>

            <div class="form-group">
              <label>🔤 كود المستخدم للفواتير * <span style="font-size:11px; color:var(--gray-500);">(حرف أو حرفين)</span></label>
              <input type="text" id="u_code" value="${user?.user_code || ''}"
                     placeholder="مثال: H للحاج، M للمحاسب، W للمخازن"
                     maxlength="3" style="text-transform:uppercase; font-weight:700; font-size:16px;"
                     oninput="this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '')">
              <small class="hint">هيظهر في أرقام الفواتير: PUR-2026-<strong>${user?.user_code || 'X'}</strong>-000001</small>
            </div>

            ${!isEdit ? `
              <div class="form-group">
                <label>كلمة السر *</label>
                <input type="password" id="u_password" placeholder="6 حروف على الأقل">
                <small class="hint">يقدر المستخدم يغيرها لاحقاً من الإعدادات</small>
              </div>

              <div class="form-group">
                <label>تأكيد كلمة السر *</label>
                <input type="password" id="u_password_confirm" placeholder="كلمة السر مرة أخرى">
              </div>
            ` : ''}

            ${isEdit ? `
              <div class="form-group">
                <label>الحالة</label>
                <select id="u_active">
                  <option value="true" ${user.active !== false ? 'selected' : ''}>✅ نشط</option>
                  <option value="false" ${user.active === false ? 'selected' : ''}>🚫 معطل</option>
                </select>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="UsersModule.closeModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="UsersModule.saveUser()">💾 حفظ</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('userModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('u_name')?.focus(), 100);
  },

  closeModal() {
    document.getElementById('userModal')?.remove();
  },

  saveUser() {
    const id = document.getElementById('u_id').value;
    const name = document.getElementById('u_name').value.trim();
    const username = document.getElementById('u_username').value.trim().toLowerCase();
    const phone = document.getElementById('u_phone').value.trim();
    const userCode = (document.getElementById('u_code')?.value || '').trim().toUpperCase();
    const isEdit = !!id;

    // Validation
    if (!name) return showNotif('❌ الاسم مطلوب', 'danger');
    if (!username) return showNotif('❌ اسم الدخول مطلوب', 'danger');
    if (!/^[a-z0-9_]+$/.test(username)) {
      return showNotif('❌ اسم الدخول لازم إنجليزي (letters, numbers, _)', 'danger');
    }

    // Validation للـ user_code
    if (!userCode) return showNotif('❌ كود المستخدم مطلوب (لأرقام الفواتير)', 'danger');
    if (!/^[A-Z]{1,3}$/.test(userCode)) {
      return showNotif('❌ الكود لازم حرف أو حرفين بالإنجليزي فقط', 'danger');
    }

    // فحص التكرار
    const users = LocalStore.get('users') || {};
    const duplicate = Object.values(users).find(u =>
      u.user_code === userCode && u._id !== id
    );
    if (duplicate) {
      return showNotif(`❌ الكود "${userCode}" مستخدم بالفعل لـ ${duplicate.name}`, 'danger');
    }

    if (isEdit) {
      // تعديل
      const user = users[id];
      if (!user) return showNotif('❌ المستخدم غير موجود', 'danger');

      // 🔒 حماية 1: لا يعدل الأدمن إلا هو نفسه
      if (user.role === 'admin' && user._id !== currentUser._id) {
        return showNotif('🔒 الأدمن محمي', 'danger');
      }

      // 🔒 حماية 2: الأدمن مايقدرش يغير دوره لدور تاني
      let role_final;
      if (user.role === 'admin') {
        role_final = 'admin'; // إجباري - لا يتغير أبداً
      } else {
        role_final = document.getElementById('u_role').value;
        // 🔒 حماية 3: لا يمكن ترقية حد لأدمن من هذه الشاشة
        if (role_final === 'admin') {
          return showNotif('❌ لا يمكن تعيين مستخدم كأدمن من هنا', 'danger');
        }
      }

      const activeVal = document.getElementById('u_active').value === 'true';

      // 🔒 حماية 4: منع تعطيل نفسك
      if (user._id === currentUser._id && !activeVal) {
        return showNotif('❌ ما تقدرش تعطل حسابك', 'danger');
      }

      // 🔒 حماية 5: منع تعطيل الأدمن أبداً (حتى لو مش نفسك)
      if (user.role === 'admin' && !activeVal) {
        return showNotif('❌ الأدمن ما يتعطلش', 'danger');
      }

      users[id] = {
        ...user,
        name: name,
        role: role_final,
        user_code: userCode,
        phone: phone,
        active: activeVal,
        updated_at: Date.now(),
        updated_by: currentUser._id
      };

      // لو الأدمن غير اسمه - حدث currentUser عشان يظهر الاسم الجديد
      if (user._id === currentUser._id) {
        currentUser.name = name;
        currentUser.user_code = userCode;
        currentUser.phone = phone;
      }

      logActivity('update', 'users', id, name);
      showNotif('✅ تم التعديل', 'success');
    } else {
      // إضافة جديد
      const role = document.getElementById('u_role').value;

      // 🔒 حماية: لا يمكن إنشاء أدمن ثاني من هذه الشاشة
      if (role === 'admin') {
        return showNotif('❌ لا يمكن إنشاء حساب أدمن جديد', 'danger');
      }

      const password = document.getElementById('u_password').value;
      const passwordConfirm = document.getElementById('u_password_confirm').value;

      if (!password || password.length < 6) {
        return showNotif('❌ كلمة السر لازم 6 حروف على الأقل', 'danger');
      }
      if (password !== passwordConfirm) {
        return showNotif('❌ كلمة السر ما تطابقتش', 'danger');
      }

      // فحص تكرار username
      const existingUser = Object.values(users).find(u => u.username === username);
      if (existingUser) {
        return showNotif('❌ اسم الدخول موجود بالفعل', 'danger');
      }

      const newId = genID('user_');
      const passwordHash = hashPassword(password);

      users[newId] = {
        _id: newId,
        name: name,
        username: username,
        password_hash: passwordHash,
        role: role,
        user_code: userCode,
        phone: phone,
        active: true,
        created_at: Date.now(),
        created_by: currentUser._id,
        last_login: 0,
        login_attempts: 0,
        locked_until: 0
      };

      logActivity('create', 'users', newId, name);
      showNotif('✅ تم إضافة المستخدم: ' + name, 'success');
    }

    LocalStore.set('users', users);
    this.closeModal();
    this.render();
  },

  // ==========================================================
  // Reset Password
  // ==========================================================
  showResetPasswordModal(id) {
    if (!requirePermission('users_reset_password', 'إعادة تعيين كلمة السر')) return;

    const users = LocalStore.get('users') || {};
    const user = users[id];
    if (!user) return;

    if (user._id === currentUser._id) {
      return showNotif('💡 لتغيير كلمة السر بتاعتك، روح للإعدادات', 'info');
    }

    const modalHtml = `
      <div id="resetPasswordModal" class="modal-overlay">
        <div class="modal" style="max-width: 450px;">
          <div class="modal-header">
            <h3>🔑 إعادة تعيين كلمة السر</h3>
            <button class="modal-close" onclick="UsersModule.closeResetModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:var(--gray-50); border-radius:var(--radius); margin-bottom:16px;">
              <div><strong>المستخدم:</strong> ${user.name}</div>
              <div><strong>اسم الدخول:</strong> ${user.username}</div>
            </div>

            <div class="form-group">
              <label>كلمة السر الجديدة *</label>
              <input type="password" id="new_password" placeholder="6 حروف على الأقل" autofocus>
            </div>

            <div class="form-group">
              <label>تأكيد كلمة السر *</label>
              <input type="password" id="new_password_confirm" placeholder="كلمة السر مرة أخرى">
            </div>

            <div style="padding:12px; background:#FEF3C7; border-radius:var(--radius); font-size:13px;">
              💡 <strong>تنبيه:</strong> بعد التغيير، المستخدم لازم يستخدم الكلمة الجديدة للدخول. الجلسات النشطة بتاعته مش هتنقطع دلوقتي.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="UsersModule.closeResetModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="UsersModule.resetPassword('${id}')">🔑 حفظ</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('resetPasswordModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  closeResetModal() {
    document.getElementById('resetPasswordModal')?.remove();
  },

  resetPassword(id) {
    const password = document.getElementById('new_password').value;
    const confirm = document.getElementById('new_password_confirm').value;

    if (!password || password.length < 6) {
      return showNotif('❌ كلمة السر لازم 6 حروف على الأقل', 'danger');
    }
    if (password !== confirm) {
      return showNotif('❌ كلمة السر ما تطابقتش', 'danger');
    }

    const users = LocalStore.get('users') || {};
    const user = users[id];
    if (!user) return;

    user.password_hash = hashPassword(password);
    user.password_reset_at = Date.now();
    user.password_reset_by = currentUser._id;
    user.login_attempts = 0;
    user.locked_until = 0;
    users[id] = user;
    LocalStore.set('users', users);

    logActivity('reset_password', 'users', id, user.name);
    showNotif('✅ تم تغيير كلمة السر لـ ' + user.name, 'success');
    this.closeResetModal();
  },

  // ==========================================================
  // Toggle Active
  // ==========================================================
  toggleActive(id) {
    if (!requirePermission('users_toggle_active', 'تعطيل/تفعيل')) return;

    const users = LocalStore.get('users') || {};
    const user = users[id];
    if (!user) return;

    // 🔒 حماية: الأدمن لا يتعطل أبداً
    if (user.role === 'admin') {
      return showNotif('🔒 الأدمن ما يتعطلش', 'warning');
    }

    if (user._id === currentUser._id) {
      return showNotif('❌ ما تقدرش تعطل حسابك', 'danger');
    }

    const willActivate = user.active === false;
    if (!confirm(`⚠️ هل تريد ${willActivate ? 'تفعيل' : 'تعطيل'} حساب "${user.name}"؟`)) return;

    user.active = willActivate;
    users[id] = user;
    LocalStore.set('users', users);

    logActivity(willActivate ? 'activate' : 'deactivate', 'users', id, user.name);
    showNotif(`✅ تم ${willActivate ? 'التفعيل' : 'التعطيل'}`, 'success');
    this.render();
  },

  // ==========================================================
  // Delete User
  // ==========================================================
  deleteUser(id) {
    if (!requirePermission('users_delete', 'حذف مستخدم')) return;

    const users = LocalStore.get('users') || {};
    const user = users[id];
    if (!user) return;

    // 🔒 حماية: الأدمن لا يتحذف أبداً
    if (user.role === 'admin') {
      return showNotif('🔒 الأدمن لا يمكن حذفه', 'danger');
    }

    if (user._id === currentUser._id) {
      return showNotif('❌ ما تقدرش تحذف حسابك', 'danger');
    }

    if (!confirm(`⚠️ هل تريد حذف حساب "${user.name}" نهائياً؟\n\nالبيانات اللي أنشأها المستخدم دا (فواتير، حركات) هتفضل موجودة، بس اسمه هيتشاور عليه في السجلات.`)) return;

    delete users[id];
    LocalStore.set('users', users);

    logActivity('delete', 'users', id, user.name);
    showNotif('✅ تم حذف المستخدم', 'success');
    this.render();
  }
};
