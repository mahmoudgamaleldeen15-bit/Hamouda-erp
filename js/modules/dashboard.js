// ==========================================================
// Dashboard Module
// ==========================================================

const DashboardModule = {

  render() {
    const container = document.getElementById('moduleContainer');
    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;

    // احسب الإحصائيات
    const products = LocalStore.get('products') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const suppliers = LocalStore.get('suppliers') || {};
    const customers = LocalStore.get('customers') || {};
    const purInvoices = LocalStore.get('purchase_invoices') || {};
    const salInvoices = LocalStore.get('sales_invoices') || {};

    const productsCount = Object.values(products).filter(p => p.active !== false).length;
    const warehousesCount = Object.keys(warehouses).length;
    const suppliersCount = Object.keys(suppliers).length;
    const customersCount = Object.keys(customers).length;

    // اليوم
    const today = new Date().toDateString();

    // مبيعات اليوم
    const todaySales = Object.values(salInvoices)
      .filter(i => new Date(i.created_at).toDateString() === today && i.status !== 'cancelled');
    const todaySalesTotal = todaySales.reduce((sum, i) => sum + getInvoiceNet(i, 'sales').netTotal, 0);
    const todayProfit = todaySales.reduce((sum, i) => sum + (i.total_profit || 0), 0);

    // مشتريات اليوم
    const todayPurchases = Object.values(purInvoices)
      .filter(i => new Date(i.created_at).toDateString() === today && i.status !== 'cancelled');
    const todayPurchasesTotal = todayPurchases.reduce((sum, i) => sum + getInvoiceNet(i, 'purchase').netTotal, 0);

    // المديونيات
    const supplierDebt = Object.values(suppliers)
      .reduce((sum, s) => sum + (s.cached_total_debt_to_them || 0), 0);

    // مستحق من العملاء + متأخرات
    let customerDebt = 0;
    let customerOverdue = 0;
    Object.keys(customers).forEach(cid => {
      const d = CustomersModule.computeCustomerDebt(cid);
      customerDebt += d.totalDebt;
      customerOverdue += d.overdueAmount;
    });

    // قيمة المخزون
    let totalStockValue = 0;
    Object.keys(warehouses).forEach(whId => {
      const inv = TxnEngine.getWarehouseInventory(whId);
      totalStockValue += inv.reduce((sum, i) => sum + i.stock_value, 0);
    });

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">🏠 الرئيسية</div>
          <div class="page-subtitle">${company.name}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-outline btn-sm" onclick="DashboardModule.refresh()">
            🔄 تحديث
          </button>
        </div>
      </div>

      <!-- Install Banner (يظهر تلقائياً لو التطبيق مش مثبت) -->
      ${this.renderInstallBanner()}

      <!-- Welcome Card -->
      <div class="card" style="background: linear-gradient(135deg, var(--grape-600), var(--grape-800)); color: white; margin-bottom: 24px; border: none;">
        <h2 style="font-size: 22px; margin-bottom: 8px;">
          👋 أهلاً بحضرتك يا ${currentUser.name}
        </h2>
        <p style="opacity: 0.9; font-size: 14px;">
          ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-3" style="margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-label">💰 مبيعات اليوم</div>
          <div class="stat-value">${fmtMoneyShort(todaySalesTotal)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change positive">${todaySales.length} فاتورة</div>
        </div>

        <div class="stat-card stat-green">
          <div class="stat-label">🛒 مشتريات اليوم</div>
          <div class="stat-value">${fmtMoneyShort(todayPurchasesTotal)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change">${todayPurchases.length} فاتورة</div>
        </div>

        ${hasPermission('dashboard_view_profit') ? `
        <div class="stat-card stat-gold">
          <div class="stat-label">💎 أرباح اليوم</div>
          <div class="stat-value">${fmtMoneyShort(todayProfit)} <span class="stat-currency">ج.م</span></div>
          <div class="stat-change ${todayProfit >= 0 ? 'positive' : 'negative'}">
            ${todaySalesTotal > 0 ? Math.round((todayProfit / todaySalesTotal) * 100) + '% هامش' : ''}
          </div>
        </div>
        ` : ''}

        <div class="stat-card stat-red">
          <div class="stat-label">🔴 مستحق من العملاء</div>
          <div class="stat-value">${fmtMoneyShort(customerDebt)} <span class="stat-currency">ج.م</span></div>
          ${customerOverdue > 0 ? `<div class="stat-change negative">متأخر: ${fmtMoneyShort(customerOverdue)}</div>` : ''}
        </div>

        <div class="stat-card">
          <div class="stat-label">💸 مستحق للموردين</div>
          <div class="stat-value">${fmtMoneyShort(supplierDebt)} <span class="stat-currency">ج.م</span></div>
        </div>

        ${hasPermission('dashboard_view_profit') ? `
        <div class="stat-card stat-blue">
          <div class="stat-label">📦 قيمة المخزون</div>
          <div class="stat-value">${fmtMoneyShort(totalStockValue)} <span class="stat-currency">ج.م</span></div>
        </div>
        ` : ''}
      </div>

      <!-- Count row -->
      <div class="grid grid-4" style="margin-bottom: 24px;">
        <div class="card" style="padding:14px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:28px;">🍇</div>
            <div>
              <div style="font-size:20px; font-weight:800;">${productsCount}</div>
              <div style="font-size:12px; color:var(--gray-500);">أصناف</div>
            </div>
          </div>
        </div>
        <div class="card" style="padding:14px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:28px;">🏢</div>
            <div>
              <div style="font-size:20px; font-weight:800;">${warehousesCount}</div>
              <div style="font-size:12px; color:var(--gray-500);">مخازن</div>
            </div>
          </div>
        </div>
        <div class="card" style="padding:14px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:28px;">👥</div>
            <div>
              <div style="font-size:20px; font-weight:800;">${customersCount}</div>
              <div style="font-size:12px; color:var(--gray-500);">عملاء</div>
            </div>
          </div>
        </div>
        <div class="card" style="padding:14px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:28px;">🏭</div>
            <div>
              <div style="font-size:20px; font-weight:800;">${suppliersCount}</div>
              <div style="font-size:12px; color:var(--gray-500);">موردين</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Debtors Alerts -->
      ${this.renderDebtorsAlerts()}

      <!-- Quick Actions -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">⚡ إجراءات سريعة</div>
            <div class="card-subtitle">اختر ما تريد عمله</div>
          </div>
        </div>

        <div class="grid grid-4">
          ${hasPermission('sales_add_cash') ? `
          <button class="btn btn-primary btn-lg" onclick="switchModule('sales'); setTimeout(() => SalesModule.newInvoice(), 100);">
            💰 فاتورة بيع
          </button>
          ` : ''}

          ${hasPermission('purchases_add') ? `
          <button class="btn btn-secondary btn-lg" onclick="switchModule('purchases'); setTimeout(() => PurchasesModule.newInvoice(), 100);">
            🛒 فاتورة شراء
          </button>
          ` : ''}

          ${hasPermission('customers_add') ? `
          <button class="btn btn-outline btn-lg" onclick="switchModule('customers')">
            👥 العملاء
          </button>
          ` : ''}

          ${hasPermission('warehouses_view') ? `
          <button class="btn btn-gold btn-lg" onclick="switchModule('inventory')">
            📦 المخزون
          </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  // ==========================================================
  // 📲 Install Banner
  // ==========================================================
  renderInstallBanner() {
    // check لو التطبيق مثبت بالفعل
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches
                         || window.navigator.standalone === true;
    if (isInStandalone) return '';

    // check لو المستخدم رفض من قبل خلال آخر 7 أيام
    const dismissedAt = LocalStore.get('install_banner_dismissed_at');
    if (dismissedAt && (Date.now() - dismissedAt) < 7 * 86400000) return '';

    return `
      <div class="install-banner">
        <div class="install-banner-icon">📲</div>
        <div class="install-banner-text">
          <div class="install-banner-title">ثبت التطبيق على جهازك</div>
          <div class="install-banner-desc">
            استخدم النظام كتطبيق مستقل مع أيقونة على شاشتك الرئيسية — بدون فتح المتصفح
          </div>
        </div>
        <button class="install-banner-btn" onclick="installApp()">
          📲 تثبيت
        </button>
        <button class="install-banner-close" onclick="DashboardModule.dismissInstallBanner()" title="إخفاء لأسبوع">✕</button>
      </div>
    `;
  },

  dismissInstallBanner() {
    LocalStore.set('install_banner_dismissed_at', Date.now());
    this.render();
    showNotif('👍 تم الإخفاء - هيظهر تاني بعد أسبوع', 'info', 2500);
  },

  refresh() {
    this.render();
    showNotif('🔄 تم التحديث', 'info', 1500);
  },

  // ==========================================================
  // كارت تنبيهات المدينين — يظهر لو فيه فواتير مستحقة اليوم أو متأخرة
  // ==========================================================
  renderDebtorsAlerts() {
    if (!hasPermission('debtors_view')) return '';

    const outstanding = DebtorsModule.getOutstandingInvoices();
    const today = outstanding.filter(i => i._debt_color === 'red-light');
    const overdue = outstanding.filter(i => i._debt_color === 'red-dark');
    const critical = outstanding.filter(i => i._debt_color === 'purple-flash');

    // لو مفيش أي إشعار مهم، مانعرضش الكارت
    if (today.length === 0 && overdue.length === 0 && critical.length === 0) return '';

    const todayTotal = today.reduce((sum, i) => sum + i.remaining, 0);
    const overdueTotal = overdue.reduce((sum, i) => sum + i.remaining, 0);
    const criticalTotal = critical.reduce((sum, i) => sum + i.remaining, 0);

    return `
      <div class="card" style="margin-bottom: 24px; background: #FEF2F2; border: 2px solid #FCA5A5;">
        <div class="card-header">
          <div>
            <div class="card-title" style="color: #991B1B;">🚨 تنبيهات المدينين</div>
            <div class="card-subtitle">فيه فواتير تحتاج انتباهك النهاردة</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="switchModule('debtors')">
            🔴 فتح المدينين
          </button>
        </div>

        <div class="grid grid-3">
          ${critical.length > 0 ? `
            <div style="padding:12px; background: white; border-radius:var(--radius); border-right:4px solid #7C3AED;">
              <div style="color:#7C3AED; font-weight:700; font-size:13px;">🟣 حرج (>30 يوم)</div>
              <div style="font-size:20px; font-weight:800; margin-top:4px;">${fmtMoney(criticalTotal)} <small>ج.م</small></div>
              <div style="font-size:12px; color:var(--gray-600);">${critical.length} فاتورة</div>
            </div>
          ` : ''}
          ${overdue.length > 0 ? `
            <div style="padding:12px; background: white; border-radius:var(--radius); border-right:4px solid #DC2626;">
              <div style="color:#DC2626; font-weight:700; font-size:13px;">🔴 متأخر</div>
              <div style="font-size:20px; font-weight:800; margin-top:4px;">${fmtMoney(overdueTotal)} <small>ج.م</small></div>
              <div style="font-size:12px; color:var(--gray-600);">${overdue.length} فاتورة</div>
            </div>
          ` : ''}
          ${today.length > 0 ? `
            <div style="padding:12px; background: white; border-radius:var(--radius); border-right:4px solid #EF4444;">
              <div style="color:#EF4444; font-weight:700; font-size:13px;">🔴 مستحق اليوم</div>
              <div style="font-size:20px; font-weight:800; margin-top:4px;">${fmtMoney(todayTotal)} <small>ج.م</small></div>
              <div style="font-size:12px; color:var(--gray-600);">${today.length} فاتورة</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
};
