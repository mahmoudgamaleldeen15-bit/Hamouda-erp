// ==========================================================
// Permissions System
// ==========================================================

let _cachedPermissions = null;

// ==========================================================
// Load permissions for current user
// ==========================================================
function loadUserPermissions() {
  if (!currentUser) return;

  // الأدمن دايماً كل الصلاحيات
  if (currentUser.role === 'admin') {
    _cachedPermissions = { '*': true };
    return;
  }

  // من Firebase/Storage
  const settings = LocalStore.get('settings/permissions');
  const rolePerms = settings?.roles?.[currentUser.role]?.permissions;

  if (rolePerms) {
    _cachedPermissions = { ...rolePerms };
  } else {
    // Fallback على القيم الافتراضية
    _cachedPermissions = getDefaultPermissions(currentUser.role);
  }
}

// ==========================================================
// Check permission
// ==========================================================
function hasPermission(permKey) {
  if (!currentUser) return false;
  if (!_cachedPermissions) loadUserPermissions();

  // الأدمن كل حاجة
  if (_cachedPermissions['*'] === true) return true;

  return _cachedPermissions[permKey] === true;
}

// ==========================================================
// Apply role restrictions on menu
// ==========================================================
function applyRoleRestrictions() {
  // إخفاء الـ nav items اللي محتاجة صلاحيات مش موجودة
  document.querySelectorAll('[data-permission]').forEach(el => {
    const perm = el.getAttribute('data-permission');
    if (!hasPermission(perm)) {
      el.style.display = 'none';
    } else {
      el.style.display = '';
    }
  });
}

// ==========================================================
// Guard function - يستخدم قبل أي عملية حساسة
// ==========================================================
function requirePermission(permKey, action = 'ده') {
  if (!hasPermission(permKey)) {
    showNotif('❌ ما عندكش صلاحية ' + action, 'danger');
    return false;
  }
  return true;
}

// ==========================================================
// Update permission (للأدمن)
// ==========================================================
function updateRolePermission(role, permKey, value) {
  if (!hasPermission('settings_permissions')) {
    return showNotif('❌ ما عندكش صلاحية تعديل الصلاحيات', 'danger');
  }

  if (role === 'admin') {
    return showNotif('❌ صلاحيات الأدمن مقفولة', 'warning');
  }

  if (currentUser.role === role) {
    return showNotif('⚠️ ما تقدرش تعدل صلاحيات الدور بتاعك', 'warning');
  }

  const settings = LocalStore.get('settings/permissions') || { roles: DEFAULT_ROLES };
  if (!settings.roles[role]) settings.roles[role] = { ...DEFAULT_ROLES[role] };
  if (!settings.roles[role].permissions) settings.roles[role].permissions = {};

  settings.roles[role].permissions[permKey] = value;
  settings.last_modified = Date.now();
  settings.last_modified_by = currentUser._id;

  LocalStore.set('settings/permissions', settings);
  logActivity('update', 'permissions', role, 'تعديل صلاحيات ' + role, {
    permission: permKey,
    new_value: value
  });

  showNotif('✅ تم حفظ التعديل', 'success');
}

// ==========================================================
// Reset role permissions to default
// ==========================================================
function resetRolePermissions(role) {
  if (!hasPermission('settings_permissions')) return;

  if (role === 'admin') return;

  if (!confirm('هل تريد استرجاع الصلاحيات الافتراضية لدور ' + getRoleDisplayName(role) + '؟')) return;

  const settings = LocalStore.get('settings/permissions') || { roles: DEFAULT_ROLES };
  settings.roles[role] = { ...DEFAULT_ROLES[role] };
  settings.last_modified = Date.now();
  settings.last_modified_by = currentUser._id;

  LocalStore.set('settings/permissions', settings);
  logActivity('reset', 'permissions', role, 'استرجاع افتراضي ' + role, {});

  showNotif('✅ تم استرجاع الافتراضي', 'success');
}
