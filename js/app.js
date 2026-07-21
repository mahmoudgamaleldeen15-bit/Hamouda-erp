// ==========================================================
// Hamouda ERP — Entry Point
// ==========================================================

// ==========================================================
// 🔧 Migration: تحديث الفواتير القديمة اللي عليها مرتجعات
// (إضافة inv.total_returned + تصحيح inv.paid للـ cash refunds القديمة)
// ==========================================================
(function migrateReturnsData() {
  const flagKey = 'migration_returns_v2_done';
  if (typeof LocalStore === 'undefined' || LocalStore.get(flagKey)) return;

  try {
    // Sales invoices + returns
    const salesInvoices = LocalStore.get('sales_invoices') || {};
    const salesReturns = Object.values(LocalStore.get('sales_returns') || {});
    Object.keys(salesInvoices).forEach(invId => {
      const inv = salesInvoices[invId];
      const invReturns = salesReturns.filter(r => r.original_invoice_id === invId);
      const totalReturned = invReturns.reduce((s, r) => s + (r.total_returned || 0), 0);
      if (totalReturned > 0) {
        inv.total_returned = totalReturned;
        // للفواتير القديمة اللي فيها cash refund وما اتحدثش paid
        const cashRefunds = invReturns
          .filter(r => r.refund_method === 'cash')
          .reduce((s, r) => s + (r.total_returned || 0), 0);
        // فحص لو الـ paid لم يعكس الاسترداد بعد
        const expectedNetTotal = inv.grand_total - totalReturned;
        const currentEffective = (inv.paid || 0) + (inv.remaining || 0);
        // لو currentEffective > expectedNetTotal فمعنى ذلك أن cash refund لم يُطبَّق
        if (cashRefunds > 0 && currentEffective > expectedNetTotal + 1) {
          inv.paid = Math.max(0, (inv.paid || 0) - cashRefunds);
          inv.remaining = Math.max(0, expectedNetTotal - inv.paid);
          if (inv.remaining === 0 && inv.paid > 0) inv.status = 'paid';
          else if (inv.paid > 0 && inv.remaining > 0) inv.status = 'partial';
          else if (inv.paid === 0 && inv.remaining > 0) inv.status = 'unpaid';
        }
        salesInvoices[invId] = inv;
      }
    });
    LocalStore.set('sales_invoices', salesInvoices);

    // Purchase invoices + returns (نفس المنطق)
    const purchInvoices = LocalStore.get('purchase_invoices') || {};
    const purchReturns = Object.values(LocalStore.get('purchase_returns') || {});
    Object.keys(purchInvoices).forEach(invId => {
      const inv = purchInvoices[invId];
      const invReturns = purchReturns.filter(r => r.original_invoice_id === invId);
      const totalReturned = invReturns.reduce((s, r) => s + (r.total_returned || 0), 0);
      if (totalReturned > 0) {
        inv.total_returned = totalReturned;
        const cashRefunds = invReturns
          .filter(r => r.refund_method === 'cash')
          .reduce((s, r) => s + (r.total_returned || 0), 0);
        const expectedNetTotal = inv.grand_total - totalReturned;
        const currentEffective = (inv.paid || 0) + (inv.remaining || 0);
        if (cashRefunds > 0 && currentEffective > expectedNetTotal + 1) {
          inv.paid = Math.max(0, (inv.paid || 0) - cashRefunds);
          inv.remaining = Math.max(0, expectedNetTotal - inv.paid);
          if (inv.remaining === 0 && inv.paid > 0) inv.status = 'paid';
          else if (inv.paid > 0 && inv.remaining > 0) inv.status = 'partial';
          else if (inv.paid === 0 && inv.remaining > 0) inv.status = 'unpaid';
        }
        purchInvoices[invId] = inv;
      }
    });
    LocalStore.set('purchase_invoices', purchInvoices);

    LocalStore.set(flagKey, Date.now());
    console.log('✅ Migration returns_v2: تم تصحيح بيانات الفواتير مع المرتجعات');
  } catch(e) {
    console.error('❌ Migration returns_v2 failed:', e);
  }
})();

// Modules registry (لسه هنبنيهم في الأيام الجاية)
const MODULES = {
  dashboard:      { render: () => DashboardModule.render() },
  sales:          { render: () => SalesModule.render() },
  purchases:      { render: () => PurchasesModule.render() },
  inventory:      { render: () => InventoryModule.render() },
  customers:      { render: () => CustomersModule.render() },
  suppliers:      { render: () => SuppliersModule.render() },
  debtors:        { render: () => DebtorsModule.render() },
  returns:        { render: () => ReturnsModule.render() },
  'cloud-pending': { render: () => CloudPendingModule.render() },
  products:       { render: () => ProductsModule.render() },
  warehouses:     { render: () => WarehousesModule.render() },
  reports:        { render: () => ReportsModule.render() },
  users:          { render: () => UsersModule.render() },
  permissions:    { render: () => PermissionsUIModule.render() },
  settings:       { render: () => SettingsModule.render() },
  activity:       { render: () => ActivityModule.render() }
};

// ==========================================================
// Switch between modules
// ==========================================================
function switchModule(name) {
  const module = MODULES[name];
  if (!module) {
    showNotif('❌ Module غير موجود', 'danger');
    return;
  }

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`[data-module="${name}"]`);
  if (navItem) navItem.classList.add('active');

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }

  // Update debtors badge
  updateDebtorsBadge();

  // Render
  module.render();
}

// ==========================================================
// Debtors Badge (عدد فواتير المتأخرات + مستحق اليوم)
// ==========================================================
function updateDebtorsBadge() {
  const badge = document.getElementById('debtorsBadge');
  if (!badge || typeof DebtorsModule === 'undefined') return;

  try {
    const outstanding = DebtorsModule.getOutstandingInvoices();
    const urgent = outstanding.filter(i =>
      ['red-light', 'red-dark', 'purple-flash'].includes(i._debt_color)
    ).length;

    if (urgent > 0) {
      badge.style.display = '';
      badge.textContent = urgent;
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {
    badge.style.display = 'none';
  }
}

// ==========================================================
// Placeholder for unbuilt modules
// ==========================================================
function renderPlaceholder(title, day) {
  const container = document.getElementById('moduleContainer');
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">${title}</div>
        <div class="page-subtitle">قيد التطوير</div>
      </div>
    </div>

    <div class="under-construction">
      <div class="uc-icon">🚧</div>
      <div class="uc-title">${title}</div>
      <div class="uc-text">دي الميزة دي هيتم بناؤها في:</div>
      <span class="uc-day">${day}</span>
    </div>
  `;
}

// ==========================================================
// Toggle sidebar (mobile)
// ==========================================================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ==========================================================
// User menu (placeholder)
// ==========================================================
function showUserMenu() {
  const menu = `👤 ${currentUser.name}\n👔 ${getRoleDisplayName(currentUser.role)}\n📞 ${currentUser.phone || '—'}`;
  alert(menu);
}

function showNotifications() {
  showNotif('🔔 مركز التنبيهات - قيد التطوير', 'info');
}

// ==========================================================
// APP STARTUP
// ==========================================================
window.addEventListener('load', () => {
  // Reset any active screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Show splash
  showScreen('splash');

  // ☁️ Initialize Cloud Sync early
  setTimeout(() => {
    if (typeof CloudSync !== 'undefined') {
      CloudSync.init().catch(e => console.warn('Cloud init warning:', e));
    }
  }, 500);

  setTimeout(() => {
    if (isFirstRun()) {
      // أول مرة يفتح - نروح لشاشة الإعداد
      showScreen('firstRunScreen');
    } else {
      // العادي - Login
      showScreen('loginScreen');
      document.getElementById('login_username').focus();
    }
  }, 1500);
});

// ==========================================================
// Handle Enter key on login/first-run
// ==========================================================
document.addEventListener('keypress', (e) => {
  if (e.key !== 'Enter') return;

  const loginActive = document.getElementById('loginScreen').classList.contains('active');
  const frActive = document.getElementById('firstRunScreen').classList.contains('active');

  if (loginActive) doLogin();
  else if (frActive) doFirstRunSetup();
});

// ==========================================================
// 📲 PWA Install Prompt
// ==========================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // امنع المتصفح من عرض prompt تلقائي
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('📲 التطبيق قابل للتثبيت');

  // أظهر زر التثبيت
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'flex';
});

// لما المستخدم يثبت التطبيق فعلياً
window.addEventListener('appinstalled', () => {
  console.log('✅ التطبيق اتثبت بنجاح');
  deferredInstallPrompt = null;
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.style.display = 'none';
  if (typeof showNotif === 'function') {
    showNotif('🎉 تم تثبيت التطبيق على جهازك!', 'success', 4000);
  }
});

// دالة يتم استدعاؤها من الزر
function installApp() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isInStandalone = window.matchMedia('(display-mode: standalone)').matches
                       || window.navigator.standalone === true;

  if (isInStandalone) {
    if (typeof showNotif === 'function') {
      showNotif('✅ التطبيق مثبت بالفعل!', 'success');
    }
    return;
  }

  // ✅ iOS Safari
  if (isIOS) {
    showIOSInstallInstructions();
    return;
  }

  // ✅ عندنا prompt جاهز → نفذ
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        console.log('✅ المستخدم قبل التثبيت');
      }
      deferredInstallPrompt = null;
    });
    return;
  }

  // ✅ مفيش prompt - رسالة قصيرة بس
  if (typeof showNotif === 'function') {
    showNotif('التثبيت غير متاح حالياً', 'info', 3000);
  }
}

function showIOSInstallInstructions() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'iosInstallModal';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <div class="modal-header">
        <h3>📲 تثبيت التطبيق على iPhone/iPad</h3>
        <button class="modal-close" onclick="document.getElementById('iosInstallModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="padding:14px; background:#EDE9FE; border-radius:var(--radius); margin-bottom:16px; font-size:13px; text-align:center;">
          💡 لتثبيت التطبيق على شاشتك الرئيسية:
        </div>

        <div style="display:flex; gap:12px; padding:12px; background:#F9FAFB; border-radius:var(--radius); margin-bottom:8px;">
          <div style="font-size:28px; flex-shrink:0;">1️⃣</div>
          <div>
            <div style="font-weight:700;">افتح الموقع في Safari</div>
            <div style="color:var(--gray-600); font-size:13px;">مش هيشتغل من Chrome/Firefox على iPhone</div>
          </div>
        </div>

        <div style="display:flex; gap:12px; padding:12px; background:#F9FAFB; border-radius:var(--radius); margin-bottom:8px;">
          <div style="font-size:28px; flex-shrink:0;">2️⃣</div>
          <div>
            <div style="font-weight:700;">اضغط زر المشاركة <span style="background:#EDE9FE; padding:2px 8px; border-radius:6px;">⬆️</span></div>
            <div style="color:var(--gray-600); font-size:13px;">اللي تحت الشاشة في المنتصف</div>
          </div>
        </div>

        <div style="display:flex; gap:12px; padding:12px; background:#F9FAFB; border-radius:var(--radius); margin-bottom:8px;">
          <div style="font-size:28px; flex-shrink:0;">3️⃣</div>
          <div>
            <div style="font-weight:700;">اختار "إضافة إلى الشاشة الرئيسية"</div>
            <div style="color:var(--gray-600); font-size:13px;">"Add to Home Screen" لو الجهاز إنجليزي</div>
          </div>
        </div>

        <div style="display:flex; gap:12px; padding:12px; background:#F9FAFB; border-radius:var(--radius);">
          <div style="font-size:28px; flex-shrink:0;">4️⃣</div>
          <div>
            <div style="font-weight:700;">اضغط "إضافة"</div>
            <div style="color:var(--gray-600); font-size:13px;">هيظهر الأيقونة على شاشتك الرئيسية زي أي تطبيق</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary btn-full" onclick="document.getElementById('iosInstallModal').remove()">تمام ✓</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function showGenericInstallInstructions() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'genericInstallModal';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <div class="modal-header">
        <h3>📲 تثبيت التطبيق</h3>
        <button class="modal-close" onclick="document.getElementById('genericInstallModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="padding:14px; background:#EDE9FE; border-radius:var(--radius); margin-bottom:16px; font-size:13px;">
          💡 التطبيق قابل للتثبيت زي أي app عادي على جهازك.
        </div>

        <div style="font-weight:700; margin-bottom:8px;">🖥️ من كمبيوتر (Chrome/Edge):</div>
        <div style="padding:10px; background:#F9FAFB; border-radius:var(--radius); margin-bottom:12px; font-size:13px;">
          دور على أيقونة التثبيت <span style="background:#EDE9FE; padding:2px 8px; border-radius:6px;">⊕</span> في شريط العنوان (يمين اللينك)، أو من قائمة المتصفح → "تثبيت [اسم الموقع]"
        </div>

        <div style="font-weight:700; margin-bottom:8px;">📱 من Android (Chrome):</div>
        <div style="padding:10px; background:#F9FAFB; border-radius:var(--radius); margin-bottom:12px; font-size:13px;">
          اضغط ⋮ في الأعلى → "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"
        </div>

        <div style="font-weight:700; margin-bottom:8px;">🍎 من iPhone/iPad:</div>
        <div style="padding:10px; background:#F9FAFB; border-radius:var(--radius); font-size:13px;">
          افتح في Safari → زر المشاركة ⬆️ → "إضافة إلى الشاشة الرئيسية"
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary btn-full" onclick="document.getElementById('genericInstallModal').remove()">تمام ✓</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ==========================================================
// Check if running as installed PWA
// ==========================================================
window.addEventListener('load', () => {
  const isInStandalone = window.matchMedia('(display-mode: standalone)').matches
                       || window.navigator.standalone === true;
  if (isInStandalone) {
    console.log('✅ يعمل كتطبيق مثبت (Standalone Mode)');
    document.body.classList.add('pwa-installed');
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.style.display = 'none';
    return;
  }

  // ✅ لو التثبيت مش متاح (file://) - أخفي الزر تماماً
  // الزر هيظهر تلقائياً لو حصل beforeinstallprompt event
  const isFileProtocol = location.protocol === 'file:';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isFileProtocol && !isIOS) {
    // مافيش أي فرصة للتثبيت - أخفي الزر والبانر تماماً
    document.body.classList.add('install-not-available');
  }
});
