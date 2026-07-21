// ==========================================================
// Utility Functions
// ==========================================================

// توليد UUID بسيط
function genUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// توليد ID للحركات (رقمي فقط - آمن لـ Firebase)
function genID(prefix = '') {
  return prefix + String(Date.now()) + Math.floor(Math.random() * 1000);
}

// ==========================================================
// 🔢 توليد رقم فاتورة مع كود المستخدم (Prefix)
// نظام: {TYPE}-{YEAR}-{USER_CODE}-{SERIAL}
// مثال: PUR-2026-H-000001 (فاتورة شراء - الحاج - رقم 1)
//       SAL-2026-M-000042 (فاتورة بيع - المحاسب - رقم 42)
//
// ⭐ ذكي: يفحص كل الفواتير الموجودة محلياً + Firebase
//         ويجيب أعلى رقم +1 - عشان مفيش تعارض بين الأجهزة
// ==========================================================
function generateInvoiceNumber(type) {
  const year = new Date().getFullYear();

  // احصل على كود المستخدم الحالي
  let userCode = 'X';
  if (typeof currentUser !== 'undefined' && currentUser) {
    userCode = (currentUser.user_code || 'X').toUpperCase();
  }

  const counterKey = `${type}_${userCode}`;

  // 🔍 نتاكد إن الرقم مش مستخدم قبل كده
  // نفحص كل الفواتير من كل الأنواع الممكنة
  const searchPrefix = `${type}-${year}-${userCode}-`;
  let maxSerialUsed = 0;

  // اجمع الفواتير من كل المصادر
  const allInvoiceSources = [
    'sales_invoices',
    'purchase_invoices',
    'sales_returns',
    'purchase_returns'
  ];

  allInvoiceSources.forEach(source => {
    const invoices = LocalStore.get(source) || {};
    Object.values(invoices).forEach(inv => {
      const invNum = inv.invoice_number || inv.return_number || '';
      if (invNum.startsWith(searchPrefix)) {
        const serialPart = invNum.substring(searchPrefix.length);
        const serial = parseInt(serialPart, 10);
        if (!isNaN(serial) && serial > maxSerialUsed) {
          maxSerialUsed = serial;
        }
      }
    });
  });

  // الرقم الجديد = أعلى رقم موجود + 1
  const counters = LocalStore.get('counters') || {};
  const counterValue = counters[counterKey] || 0;
  const serial = Math.max(maxSerialUsed + 1, counterValue + 1, 1);

  // Format
  const number = `${type}-${year}-${userCode}-${String(serial).padStart(6, '0')}`;

  return { number, counterKey, serial };
}

// زيادة العداد (استخدمها بعد نجاح حفظ الفاتورة)
function incrementInvoiceCounter(counterKey) {
  const counters = LocalStore.get('counters') || {};
  counters[counterKey] = (counters[counterKey] || 1) + 1;
  LocalStore.set('counters', counters);
}

// معاينة الرقم القادم بدون زيادة
function previewInvoiceNumber(type) {
  return generateInvoiceNumber(type).number;
}

// تنسيق التاريخ
function fmtDate(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function fmtDateTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  const date = d.toLocaleDateString('ar-EG', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const time = d.toLocaleTimeString('ar-EG', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  return `${date} ${time}`;
}

// تنسيق العملة
function fmtMoney(amount) {
  if (amount === null || amount === undefined) return '0';
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtMoneyShort(amount) {
  // محمود يفضل الأرقام الصريحة (1,000 بدل 1.0K)
  if (amount === null || amount === undefined) return '0';
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

// Hash function - Murmur-inspired مع Salt خاص بحموده
function hashPassword(pw) {
  const salt = DEFAULT_SETTINGS.password_salt;
  const s = salt + '_' + String(pw);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0, ch; i < s.length; i++) {
    ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'hh_' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// ==========================================================
// Toast Notifications
// ==========================================================
function showNotif(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('notifContainer');
  if (!container) {
    console.log('[' + type + ']', msg);
    return;
  }

  const icons = {
    success: '✅',
    warning: '⚠️',
    danger:  '❌',
    info:    'ℹ️'
  };

  const notif = document.createElement('div');
  notif.className = 'notif notif-' + type;
  notif.innerHTML = `
    <span class="notif-icon">${icons[type] || 'ℹ️'}</span>
    <span class="notif-msg">${msg}</span>
  `;

  container.appendChild(notif);

  setTimeout(() => {
    notif.classList.add('fade-out');
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

// ==========================================================
// Show/Hide screens
// ==========================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ==========================================================
// Get device info for activity log
// ==========================================================
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'غير معروف';
  let os = 'غير معروف';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return browser + ' / ' + os;
}

// ==========================================================
// حساب لون المديونية
// ==========================================================
function getDebtColor(dueDate, totalDebt) {
  if (!totalDebt || totalDebt <= 0) return null;
  if (!dueDate) return 'blue';

  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const daysDiff = Math.floor((due - now) / (1000 * 60 * 60 * 24));

  if (daysDiff > 7) return 'blue';
  if (daysDiff > 3) return 'yellow';
  if (daysDiff > 0) return 'orange';
  if (daysDiff === 0) return 'red-light';
  if (daysDiff > -30) return 'red-dark';
  return 'purple-flash';
}

function getDebtLabel(color) {
  const labels = {
    'blue': '🔵 آمن',
    'yellow': '🟡 قريب',
    'orange': '🟠 تحذير',
    'red-light': '🔴 مستحق اليوم',
    'red-dark': '🔴 متأخر',
    'purple-flash': '🟣 متأخر جداً'
  };
  return labels[color] || '';
}
