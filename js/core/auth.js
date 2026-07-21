// ==========================================================
// Authentication System
// ==========================================================

let currentUser = null;
let sessionTimer = null;

// ==========================================================
// First-Run Setup
// ==========================================================
function doFirstRunSetup() {
  const username = document.getElementById('fr_username').value.trim();
  const password = document.getElementById('fr_password').value;
  const confirm  = document.getElementById('fr_password_confirm').value;
  const errorEl = document.getElementById('fr_error');
  errorEl.style.display = 'none';

  // Validation
  if (!username) {
    return showFrError('اسم المستخدم مطلوب');
  }
  if (password.length < DEFAULT_SETTINGS.password_min_length) {
    return showFrError('كلمة السر على الأقل ' + DEFAULT_SETTINGS.password_min_length + ' حروف');
  }
  if (password !== confirm) {
    return showFrError('كلمة السر والتأكيد مش زي بعض');
  }

  // إنشاء الأدمن
  const adminId = 'user_admin_' + Date.now();
  const users = {};
  users[adminId] = {
    _id: adminId,
    username: username,
    password_hash: hashPassword(password),
    role: 'admin',
    user_code: 'H', // كود الحاج - يظهر في أرقام الفواتير: PUR-2026-H-000001
    name: 'الحاج ' + DEFAULT_COMPANY.owner_name,
    phone: DEFAULT_COMPANY.owner_phone,
    active: true,
    created_at: Date.now(),
    last_login: 0,
    failed_attempts: 0,
    locked_until: 0
  };
  LocalStore.set('users', users);

  // إنشاء إعدادات الشركة الافتراضية
  LocalStore.set('settings/company', DEFAULT_COMPANY);
  LocalStore.set('settings/payment_methods', DEFAULT_PAYMENT_METHODS);
  LocalStore.set('settings/permissions', { roles: DEFAULT_ROLES });
  LocalStore.set('settings/system', DEFAULT_SETTINGS);
  LocalStore.set('settings/whatsapp_templates', DEFAULT_WA_TEMPLATES);
  LocalStore.set('settings/units', DEFAULT_UNITS);
  LocalStore.set('settings/categories', DEFAULT_CATEGORIES);

  // إنشاء المخازن الافتراضية
  const warehouses = {};
  DEFAULT_WAREHOUSES.forEach(wh => {
    warehouses[wh.id] = { ...wh, created_at: Date.now(), created_by: adminId };
  });
  LocalStore.set('warehouses', warehouses);

  // Counters
  LocalStore.set('counters', {
    sales_invoice: 1,
    purchase_invoice: 1,
    payment: 1,
    customer: 1,
    supplier: 1,
    product: 1
  });

  showNotif('✅ تم إعداد النظام بنجاح', 'success');

  // Login تلقائي
  setTimeout(() => {
    document.getElementById('login_username').value = username;
    showScreen('loginScreen');
    document.getElementById('login_password').focus();
  }, 800);
}

function showFrError(msg) {
  const el = document.getElementById('fr_error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ==========================================================
// Login
// ==========================================================
function doLogin() {
  const username = document.getElementById('login_username').value.trim();
  const password = document.getElementById('login_password').value;
  const errorEl = document.getElementById('login_error');
  const lockedEl = document.getElementById('login_locked');
  errorEl.style.display = 'none';
  lockedEl.style.display = 'none';

  if (!username || !password) {
    return showLoginError('اسم المستخدم وكلمة السر مطلوبين');
  }

  const users = LocalStore.get('users') || {};
  const user = Object.values(users).find(u => u.username === username && u.active);

  if (!user) {
    return showLoginError('اسم مستخدم أو كلمة سر غلط');
  }

  // Check lockout
  if (user.locked_until && user.locked_until > Date.now()) {
    const mins = Math.ceil((user.locked_until - Date.now()) / 60000);
    lockedEl.textContent = '🔒 الحساب مقفول لمدة ' + mins + ' دقيقة';
    lockedEl.style.display = 'block';
    return;
  }

  // Check password
  if (user.password_hash !== hashPassword(password)) {
    user.failed_attempts = (user.failed_attempts || 0) + 1;

    if (user.failed_attempts >= DEFAULT_SETTINGS.max_failed_login_attempts) {
      user.locked_until = Date.now() + (DEFAULT_SETTINGS.account_lockout_minutes * 60 * 1000);
      user.failed_attempts = 0;
      users[user._id] = user;
      LocalStore.set('users', users);
      lockedEl.textContent = '🔒 كتير محاولات فاشلة - الحساب اتقفل ' + DEFAULT_SETTINGS.account_lockout_minutes + ' دقيقة';
      lockedEl.style.display = 'block';
      return;
    }

    users[user._id] = user;
    LocalStore.set('users', users);
    const remaining = DEFAULT_SETTINGS.max_failed_login_attempts - user.failed_attempts;
    return showLoginError('كلمة السر غلط. متبقي ' + remaining + ' محاولات');
  }

  // Success
  user.failed_attempts = 0;
  user.locked_until = 0;
  user.last_login = Date.now();
  users[user._id] = user;
  LocalStore.set('users', users);

  currentUser = user;

  // Log the login
  logActivity('login', 'auth', user._id, 'دخول', {});

  // Enter app
  showNotif('👋 أهلاً بحضرتك يا ' + user.name, 'success');
  setTimeout(() => enterApp(), 400);
}

function showLoginError(msg) {
  const el = document.getElementById('login_error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ==========================================================
// Enter main app
// ==========================================================
function enterApp() {
  document.getElementById('sidebarUserName').textContent = currentUser.name;
  document.getElementById('sidebarUserRole').textContent = getRoleDisplayName(currentUser.role);
  document.getElementById('userNameShort').textContent = currentUser.name.charAt(0);

  showScreen('mainApp');

  // Load permissions
  loadUserPermissions();

  // Apply role restrictions on menu
  applyRoleRestrictions();

  // Load default module (Dashboard)
  switchModule('dashboard');

  // Start session timer
  startSessionTimer();

  // ☁️ Trigger cloud sync after login - دائماً بدون شرط
  if (typeof CloudSync !== 'undefined') {
    // Force sync after 2 seconds
    setTimeout(async () => {
      // Wait for cloud init if not ready
      let attempts = 0;
      while (!CloudSync.isInitialized && attempts < 10) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }

      if (CloudSync.isInitialized) {
        console.log('☁️ Auto-sync after login...');
        try {
          await CloudSync.fullSync(true);
          // بعد الـ sync، refresh الشاشة الحالية عشان تظهر أي بيانات جديدة
          if (typeof currentModule !== 'undefined' && currentModule && MODULES[currentModule]) {
            MODULES[currentModule].render();
          }
        } catch (e) {
          console.warn('Post-login sync warning:', e);
        }
      }
    }, 2000);

    // Update UI
    setTimeout(() => CloudSync.updateUI && CloudSync.updateUI(), 100);
  }
}

// ==========================================================
// Logout
// ==========================================================
function doLogout() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;

  logActivity('logout', 'auth', currentUser._id, 'خروج', {});
  currentUser = null;
  stopSessionTimer();

  document.getElementById('login_username').value = '';
  document.getElementById('login_password').value = '';
  showScreen('loginScreen');
  showNotif('👋 تم تسجيل الخروج', 'info');
}

// ==========================================================
// Session Timer
// ==========================================================
function startSessionTimer() {
  stopSessionTimer();
  const timeout = DEFAULT_SETTINGS.session_timeout_minutes * 60 * 1000;
  sessionTimer = setTimeout(() => {
    showNotif('⏰ انتهت الجلسة، أعد تسجيل الدخول', 'warning');
    doLogout();
  }, timeout);
}

function stopSessionTimer() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

// Reset timer on any activity
document.addEventListener('click', () => { if (currentUser) startSessionTimer(); });
document.addEventListener('keypress', () => { if (currentUser) startSessionTimer(); });

// ==========================================================
// Helpers
// ==========================================================
function getRoleDisplayName(role) {
  const roles = LocalStore.get('settings/permissions')?.roles || DEFAULT_ROLES;
  return roles[role]?.display_name || role;
}

// ==========================================================
// Activity Log
// ==========================================================
function logActivity(action, module, entityId, label, extra = {}) {
  const log = LocalStore.get('activity_log') || {};
  const id = genID('log_');
  log[id] = {
    _id: id,
    user_id: currentUser?._id || 'system',
    username: currentUser?.username || 'system',
    action: action,
    module: module,
    entity_id: entityId,
    entity_label: label,
    device: getDeviceInfo(),
    timestamp: Date.now(),
    ...extra
  };
  LocalStore.set('activity_log', log);
}
