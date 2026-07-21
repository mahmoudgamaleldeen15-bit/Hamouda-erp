// ==========================================================
// ⚠️⚠️⚠️ DEFAULT DATA — ممنوع منعاً باتاً مسح أي حاجة من هنا
// ==========================================================
// دي بيانات fallback أساسية لو localStorage/Firebase فاضية
// أي مسح هنا هيسبب مشاكل جسيمة في النظام
// ==========================================================

// معلومات الشركة الافتراضية
const DEFAULT_COMPANY = {
  name: "شركة حموده للمنتجات الغذائية",
  owner_name: "حموده",
  owner_phone: "01004975602",
  address: "",
  currency: "EGP",
  currency_symbol: "ج.م",
  logo_url: "",
  tax_number: ""
};

// طرق الدفع الافتراضية
const DEFAULT_PAYMENT_METHODS = {
  cash:          { enabled: true,  label: "كاش",         icon: "💵", requires_transfer: false },
  instapay:      { enabled: true,  label: "انستا باي",   icon: "🏦", requires_transfer: true, phone: "", recipient_name: "", notes: "" },
  vodafone_cash: { enabled: true,  label: "فودافون كاش", icon: "🔴", requires_transfer: true, phone: "", recipient_name: "", notes: "" },
  etisalat_cash: { enabled: true,  label: "اتصالات كاش", icon: "🟢", requires_transfer: true, phone: "", recipient_name: "", notes: "" },
  orange_cash:   { enabled: false, label: "أورانج كاش",  icon: "🟠", requires_transfer: true, phone: "", recipient_name: "", notes: "" }
};

// المخازن الافتراضية (بيتم إنشاؤها أول مرة)
const DEFAULT_WAREHOUSES = [
  { id: "wh_general", name: "المخزن العام", location: "المحلة الكبرى", active: true },
  { id: "wh_menia",   name: "مخزن المنيا",  location: "المنيا",       active: true }
];

// تصنيفات الأصناف
const DEFAULT_CATEGORIES = [
  { id: "grapes",  name: "عنب طازج", icon: "🍇" },
  { id: "raisins", name: "زبيب",     icon: "🍯" },
  { id: "other",   name: "أخرى",     icon: "📦" }
];

// وحدات القياس (يمكن للأدمن تعديلها من إدارة الوحدات)
const DEFAULT_UNITS = [
  { id: "kg",     name: "كيلو",    active: true },
  { id: "gram",   name: "جرام",   active: true },
  { id: "ton",    name: "طن",      active: true },
  { id: "box",    name: "كرتونة",  active: true },
  { id: "bag",    name: "شيكارة",  active: true },
  { id: "barrel", name: "برميل",   active: true },
  { id: "liter",  name: "لتر",     active: true },
  { id: "gallon", name: "جالون",   active: true },
  { id: "piece",  name: "قطعة",    active: true }
];

// ==========================================================
// الأدوار والصلاحيات الافتراضية
// ==========================================================
const DEFAULT_ROLES = {
  admin: {
    display_name: "الأدمن",
    protected: true,
    permissions: { "*": true }
  },
  accountant: {
    display_name: "المحاسب",
    protected: false,
    permissions: {
      // Dashboard
      dashboard_view: true,
      dashboard_view_profit: true,
      dashboard_view_kpis: true,

      // Products
      products_view: true,
      products_view_purchase_prices: true,
      products_add: true,
      products_edit: true,
      products_delete: false,

      // Warehouses
      warehouses_view: true,
      warehouses_manage: false,
      warehouses_transfer: true,
      warehouses_adjust: false,

      // Purchases
      purchases_view: true,
      purchases_add: true,
      purchases_edit_same_day: true,
      purchases_cancel: true,
      purchases_export: true,

      // Sales
      sales_view: true,
      sales_add_cash: true,
      sales_add_credit: true,
      sales_edit_same_day: true,
      sales_cancel: true,
      sales_override_stock: false,
      sales_override_credit_limit: false,
      sales_discount_manual: true,
      sales_export: true,

      // Customers
      customers_view: true,
      customers_view_lifetime: true,
      customers_add: true,
      customers_edit_full: true,
      customers_edit_credit_limit: true,
      customers_change_status: true,

      // Suppliers
      suppliers_view: true,
      suppliers_manage: true,

      // Debtors
      debtors_view: true,
      debtors_collect_payment: true,
      debtors_full_settlement: true,
      debtors_waive: false,
      debtors_reschedule: true,

      // Reports
      reports_sales: true,
      reports_purchases: true,
      reports_debtors: true,
      reports_inventory: true,
      reports_profit: true,
      reports_export_pdf: true,
      reports_export_excel: true,
      reports_send_to_haj_whatsapp: true,

      // WhatsApp
      whatsapp_send_invoice: true,
      whatsapp_request_reminder: true,
      whatsapp_approve_send: false,

      // System
      users_view: false,
      settings_company: false,
      settings_permissions: false,
      activity_view: false,
      backup_create: false
    }
  },
  salesman: {
    display_name: "المندوب",
    protected: false,
    permissions: {
      // Dashboard (محدود)
      dashboard_view: true,
      dashboard_view_profit: false,
      dashboard_view_kpis: false,

      // Products
      products_view: true,
      products_view_purchase_prices: false,

      // Warehouses
      warehouses_view: true,

      // Sales (main work)
      sales_view: true,
      sales_add_cash: true,
      sales_add_credit: true,
      sales_edit_same_day: true,
      sales_cancel: false,
      sales_discount_manual: true, // حد أقصى 5%
      sales_export: true,

      // Customers
      customers_view: true,
      customers_view_lifetime: false,
      customers_add: true,
      customers_edit_contact: true,
      customers_edit_full: false,

      // Debtors
      debtors_view: true,
      debtors_collect_payment: true,

      // Reports (بتاعه فقط)
      reports_sales: true,
      reports_debtors: true,
      reports_inventory: true,
      reports_export_pdf: true,

      // WhatsApp
      whatsapp_send_invoice: true,
      whatsapp_request_reminder: true
    }
  }
};

// ==========================================================
// إعدادات النظام الافتراضية
// ==========================================================
const DEFAULT_SETTINGS = {
  session_timeout_minutes: 30,
  max_failed_login_attempts: 5,
  account_lockout_minutes: 30,
  password_min_length: 6,
  low_stock_threshold: 10,
  auto_backup_enabled: false,
  sound_enabled: true,

  // Salt للـ hash — مختلف عن أي مشروع تاني
  password_salt: "HAMOUDA_ERP_SALT_2026_A7X9Z2K5"
};

// ==========================================================
// قوالب الواتساب الافتراضية
// ==========================================================
const DEFAULT_WA_TEMPLATES = {
  invoice_to_customer: `شركة حموده للمنتجات الغذائية

📄 فاتورة رقم: {invoice_number}
📅 التاريخ: {date}

👤 العميل: {customer_name}

الأصناف:
{items_list}

💰 الإجمالي: {grand_total} ج.م
✅ المدفوع: {paid} ج.م
🔴 المتبقي: {remaining} ج.م
📅 تاريخ الاستحقاق: {due_date}

شكراً لتعاملكم معنا 🌸
📞 01004975602`,

  debt_reminder: `السلام عليكم ورحمة الله

الأستاذ {customer_name} المحترم

نحيط سيادتكم علماً بوجود مبلغ مستحق:
- الفاتورة رقم: {invoice_number}
- القيمة: {amount} ج.م
- تاريخ الاستحقاق: {due_date}

نرجو التكرم بالسداد في أقرب وقت.
شكراً لتعاونكم 🌸

شركة حموده للمنتجات الغذائية
📞 01004975602`,

  daily_report_to_haj: `📊 تقرير يومي — شركة حموده
📅 {date}

💰 المبيعات: {total_sales} ج.م
🛒 المشتريات: {total_purchases} ج.م
✅ التحصيلات: {total_payments} ج.م
🔴 المتأخرات: {overdue_amount} ج.م

📦 عدد الفواتير: {invoices_count}
👥 عملاء جدد: {new_customers}`
};

// دالة مساعدة لإرجاع صلاحيات الدور الافتراضية
function getDefaultPermissions(role) {
  if (!DEFAULT_ROLES[role]) return {};
  return { ...DEFAULT_ROLES[role].permissions };
}

// ==========================================================
// Helper: احصل على الوحدات من storage أو fallback على default
// ==========================================================
function getUnits() {
  const stored = LocalStore.get('settings/units');
  if (stored && Array.isArray(stored) && stored.length > 0) return stored;
  return DEFAULT_UNITS;
}

// ==========================================================
// Helper: احصل على تصنيف بـ ID
// ==========================================================
function getUnitById(unitId) {
  const units = getUnits();
  return units.find(u => u.id === unitId) || units[0] || { id: 'kg', name: 'كيلو' };
}

// ==========================================================
// Helper: احصل على اسم وحدة صنف من ID الصنف (المرجع الموحد للنظام)
// ==========================================================
function getProductUnitName(productIdOrObj) {
  let product;
  if (typeof productIdOrObj === 'string') {
    const products = LocalStore.get('products') || {};
    product = products[productIdOrObj];
  } else {
    product = productIdOrObj;
  }
  if (!product) return 'كجم';
  const unit = getUnitById(product.unit);
  return unit?.name || 'كجم';
}

// ==========================================================
// Helper: صيغة الجمع لاسم الوحدة
// ==========================================================
const UNIT_PLURALS = {
  'كرتونة': 'الكراتين',
  'برميل': 'البراميل',
  'شيكارة': 'الشكاير',
  'شوال': 'الشوالات',
  'كيلو': 'الكيلوجرامات',
  'كيلوجرام': 'الكيلوجرامات',
  'قطعة': 'القطع',
  'طن': 'الأطنان',
  'جرام': 'الجرامات',
  'لتر': 'اللترات',
  'جالون': 'الجالونات',
  'صندوق': 'الصناديق',
  'علبة': 'العلب',
  'زجاجة': 'الزجاجات',
  'كيس': 'الأكياس',
  'دلو': 'الدلاء',
  'عبوة': 'العبوات'
};

function getProductUnitPlural(productIdOrObj) {
  const unitName = getProductUnitName(productIdOrObj);
  return UNIT_PLURALS[unitName] || `ال${unitName}`;
}

// ==========================================================
// Helper: احصل على القيم الصافية للفاتورة بعد أي مرتجعات
// type: 'sales' | 'purchase'
// Returns:
//   originalTotal - القيمة الأصلية للفاتورة قبل أي مرتجعات
//   totalReturned - إجمالي المرتجعات
//   netTotal - الصافي = originalTotal - totalReturned
//   paid - المدفوع فعلياً (بعد أي استرداد كاش)
//   remaining - المتبقي = netTotal - paid
//   hasReturns - هل عليها مرتجعات
//   returnsCount - عدد المرتجعات
//   returns - قائمة المرتجعات
// ==========================================================
function getInvoiceNet(inv, type) {
  const returnsKey = type === 'sales' ? 'sales_returns' : 'purchase_returns';
  const allReturns = Object.values(LocalStore.get(returnsKey) || {});
  const returns = allReturns.filter(r => r.original_invoice_id === inv._id);

  const totalReturned = returns.reduce((sum, r) => sum + (r.total_returned || 0), 0);
  const originalTotal = Number(inv.grand_total) || 0;
  const netTotal = originalTotal - totalReturned;
  const paid = Number(inv.paid) || 0;
  const remaining = Math.max(0, netTotal - paid);

  return {
    originalTotal,
    totalReturned,
    netTotal,
    paid,
    remaining,
    hasReturns: totalReturned > 0,
    returnsCount: returns.length,
    returns
  };
}

// ==========================================================
// Helper: احصل على معلومات وحدة item محفوظ في فاتورة
// يرجع:
//   - unitLabel: الوحدة المعروضة (كجم / برميل / كرتونة ...)
//   - isBala: هل الوضع "بلا وزن"
//   - vesselName: اسم الوعاء (كرتونة / برميل / شيكارة)
//   - productUnit: الوحدة الأصلية للصنف
// ==========================================================
function getItemUnitInfo(item) {
  const productUnit = item.product_id ? getProductUnitName(item.product_id) : 'كجم';
  const isWeightBased = item.product_id ? isWeightBasedProduct(item.product_id) : true;
  const vesselName = isWeightBased ? 'كرتونة' : productUnit;

  const isBala = (
    item.display_unit === 'كرتونة' ||
    item.display_unit === productUnit ||
    item.unit_snapshot === 'carton' ||
    (item.unit_type === 'cartons' && Number(item.carton_weight) === 0) ||
    (item.unit_type === 'cartons' && item.cartons_count > 0 && Number(item.qty) === Number(item.cartons_count))
  );

  // بلا → بوحدة الصنف الأصلية
  // فيه وزن → بالكيلو
  const unitLabel = isBala ? productUnit : 'كجم';

  return { unitLabel, isBala, vesselName, productUnit, isWeightBased };
}

// ==========================================================
// Helper: آخر سعر شراء / بيع لصنف
// type: 'purchase' | 'sale'
// return: { price, invoice_number, date, invoice_id } | null
// ==========================================================
function getLastPriceForProduct(productId, type = 'purchase') {
  if (!productId) return null;
  const invKey = type === 'purchase' ? 'purchase_invoices' : 'sales_invoices';
  const invoices = Object.values(LocalStore.get(invKey) || {})
    .filter(inv => inv.status !== 'cancelled')
    .sort((a, b) => b.created_at - a.created_at);

  for (const inv of invoices) {
    if (!inv.items) continue;
    const item = inv.items.find(it => it.product_id === productId);
    if (item && item.unit_price > 0) {
      return {
        price: Number(item.unit_price),
        invoice_number: inv.invoice_number,
        date: inv.date || inv.created_at,
        invoice_id: inv._id,
        // ملاحظات مهمة للمقارنة
        was_bala: item.display_unit === 'كرتونة' || item.unit_snapshot === 'carton' ||
                  (item.unit_type === 'cartons' && Number(item.carton_weight) === 0)
      };
    }
  }
  return null;
}

// ==========================================================
// Helper: هل الصنف بيتحسب بالوزن (كيلو، جرام، طن)؟
// ==========================================================
function isWeightBasedProduct(productIdOrObj) {
  let product;
  if (typeof productIdOrObj === 'string') {
    const products = LocalStore.get('products') || {};
    product = products[productIdOrObj];
  } else {
    product = productIdOrObj;
  }
  if (!product) return true; // default = weight
  const weightUnits = ['kg', 'gram', 'ton'];
  return weightUnits.includes(product.unit);
}

// ==========================================================
// Helper: احصل على التصنيفات
// ==========================================================
function getCategories() {
  const stored = LocalStore.get('settings/categories');
  if (stored && Array.isArray(stored) && stored.length > 0) return stored;
  return DEFAULT_CATEGORIES;
}
