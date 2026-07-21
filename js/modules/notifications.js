// ==========================================================
// Notification Center - مركز التنبيهات الذكية
// ==========================================================

const NotificationCenter = {

  isOpen: false,
  notifications: [],

  // ==========================================================
  // Compute all notifications dynamically
  // ==========================================================
  computeNotifications() {
    const notifs = [];
    const now = Date.now();
    const settings = LocalStore.get('settings/system') || DEFAULT_SETTINGS;

    // ⚠️ 1. Overdue debts (Red-dark + Purple-flash)
    try {
      const outstanding = (typeof DebtorsModule !== 'undefined') ? DebtorsModule.getOutstandingInvoices() : [];
      const overdue = outstanding.filter(i => ['red-dark', 'purple-flash'].includes(i._debt_color));
      const critical = outstanding.filter(i => i._debt_color === 'purple-flash');

      if (critical.length > 0) {
        const total = critical.reduce((s, i) => s + i.remaining, 0);
        notifs.push({
          id: 'debt_critical',
          severity: 'critical',
          icon: '🟣',
          title: `${critical.length} فاتورة حرجة (>30 يوم متأخرة)`,
          description: `إجمالي ${fmtMoney(total)} ج.م — تحتاج تحصيل فوري`,
          action: 'debtors',
          created_at: now
        });
      }
      if (overdue.length > critical.length) {
        const total = (overdue.length - critical.length) > 0 ?
          overdue.filter(i => i._debt_color === 'red-dark').reduce((s, i) => s + i.remaining, 0) : 0;
        if (total > 0) {
          notifs.push({
            id: 'debt_overdue',
            severity: 'high',
            icon: '🔴',
            title: `${overdue.length - critical.length} فاتورة متأخرة`,
            description: `إجمالي ${fmtMoney(total)} ج.م — تجاوزت موعد الاستحقاق`,
            action: 'debtors',
            created_at: now
          });
        }
      }

      // Due soon (Orange - Yellow)
      const soon = outstanding.filter(i => ['orange', 'yellow'].includes(i._debt_color));
      if (soon.length > 0 && hasPermission('debtors_view')) {
        const total = soon.reduce((s, i) => s + i.remaining, 0);
        notifs.push({
          id: 'debt_soon',
          severity: 'medium',
          icon: '🟡',
          title: `${soon.length} فاتورة قرب استحقاقها`,
          description: `إجمالي ${fmtMoney(total)} ج.م — استحقاق خلال أيام`,
          action: 'debtors',
          created_at: now
        });
      }
    } catch(e) { console.warn('Debtors check failed:', e); }

    // 📦 2. Low stock alerts
    try {
      const products = Object.values(LocalStore.get('products') || {}).filter(p => p.active !== false);
      const warehouses = LocalStore.get('warehouses') || {};

      // ✅ فصل المخازن: قائمة الأصناف اللي لها حركات في كل مخزن
      const txns = Object.values(LocalStore.get('inventory_txns') || {});
      const productsPerWarehouse = {};
      txns.forEach(t => {
        if (!productsPerWarehouse[t.warehouse_id]) productsPerWarehouse[t.warehouse_id] = new Set();
        productsPerWarehouse[t.warehouse_id].add(t.product_id);
      });

      const lowStockItems = [];
      const outOfStockItems = [];

      Object.keys(warehouses).forEach(whId => {
        const inv = TxnEngine.getWarehouseInventory(whId);
        const productsInHere = productsPerWarehouse[whId] || new Set();
        inv.forEach(item => {
          const p = products.find(pr => pr._id === item.product_id);
          if (!p) return;
          // ✅ اعرض بس الأصناف اللي عليها حركات في المخزن ده
          if (!productsInHere.has(item.product_id)) return;
          if (item.current_stock <= 0) {
            outOfStockItems.push({ product: p, warehouse: warehouses[whId] });
          } else if (item.current_stock <= (p.min_stock || 0)) {
            lowStockItems.push({ product: p, warehouse: warehouses[whId], stock: item.current_stock });
          }
        });
      });

      if (outOfStockItems.length > 0) {
        notifs.push({
          id: 'stock_out',
          severity: 'high',
          icon: '📦',
          title: `${outOfStockItems.length} صنف نافذ من المخزون`,
          description: outOfStockItems.slice(0, 3).map(i => i.product.name).join('، ') + (outOfStockItems.length > 3 ? '...' : ''),
          action: 'inventory',
          created_at: now
        });
      }

      if (lowStockItems.length > 0) {
        notifs.push({
          id: 'stock_low',
          severity: 'medium',
          icon: '⚠️',
          title: `${lowStockItems.length} صنف رصيده منخفض`,
          description: lowStockItems.slice(0, 3).map(i => `${i.product.name} (${fmtMoney(i.stock)})`).join('، '),
          action: 'inventory',
          created_at: now
        });
      }
    } catch(e) { console.warn('Stock check failed:', e); }

    // 💰 3. Recent big sales (today)
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();
      const bigThreshold = 10000;

      const invoices = Object.values(LocalStore.get('sales_invoices') || {})
        .filter(i => i.status !== 'cancelled' && i.created_at >= todayStart);

      const bigSales = invoices.filter(i => i.grand_total >= bigThreshold);
      if (bigSales.length > 0 && currentUser.role === 'admin') {
        const total = bigSales.reduce((s, i) => s + i.grand_total, 0);
        notifs.push({
          id: 'big_sales_today',
          severity: 'info',
          icon: '💰',
          title: `${bigSales.length} فاتورة كبيرة اليوم (>${fmtMoney(bigThreshold)} ج.م)`,
          description: `إجمالي ${fmtMoney(total)} ج.م`,
          action: 'sales',
          created_at: now
        });
      }
    } catch(e) { console.warn('Sales check failed:', e); }

    // 🔴 4. Cancelled invoices today (admin only)
    try {
      if (currentUser.role === 'admin') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();

        const salesInv = Object.values(LocalStore.get('sales_invoices') || {});
        const purchaseInv = Object.values(LocalStore.get('purchase_invoices') || {});
        const cancelled = [
          ...salesInv.filter(i => i.status === 'cancelled' && (i.cancelled_at || 0) >= todayStart),
          ...purchaseInv.filter(i => i.status === 'cancelled' && (i.cancelled_at || 0) >= todayStart)
        ];

        if (cancelled.length > 0) {
          notifs.push({
            id: 'cancelled_today',
            severity: 'medium',
            icon: '❌',
            title: `${cancelled.length} فاتورة اتلغت اليوم`,
            description: 'راجع سبب الإلغاء في سجل العمليات',
            action: 'activity',
            created_at: now
          });
        }
      }
    } catch(e) { console.warn('Cancelled check failed:', e); }

    // 🔄 5. Returns today (admin only)
    try {
      if (currentUser.role === 'admin') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();

        const salesRet = Object.values(LocalStore.get('sales_returns') || {})
          .filter(r => r.created_at >= todayStart);
        const purchaseRet = Object.values(LocalStore.get('purchase_returns') || {})
          .filter(r => r.created_at >= todayStart);

        if (salesRet.length + purchaseRet.length > 0) {
          const total = [...salesRet, ...purchaseRet].reduce((s, r) => s + r.total_returned, 0);
          notifs.push({
            id: 'returns_today',
            severity: 'info',
            icon: '🔄',
            title: `${salesRet.length + purchaseRet.length} مرتجع اليوم`,
            description: `إجمالي ${fmtMoney(total)} ج.م`,
            action: 'returns',
            created_at: now
          });
        }
      }
    } catch(e) { console.warn('Returns check failed:', e); }

    // 💾 6. Backup reminder (admin only)
    try {
      if (currentUser.role === 'admin') {
        const lastBackup = LocalStore.get('last_backup_at') || 0;
        const daysSince = Math.floor((now - lastBackup) / 86400000);

        if (lastBackup === 0) {
          notifs.push({
            id: 'no_backup',
            severity: 'high',
            icon: '💾',
            title: 'لم تعمل نسخة احتياطية أبداً',
            description: 'اعمل نسخة من الإعدادات → الأرشيف',
            action: 'settings',
            created_at: now
          });
        } else if (daysSince >= 7) {
          notifs.push({
            id: 'old_backup',
            severity: 'medium',
            icon: '💾',
            title: `آخر نسخة احتياطية من ${daysSince} يوم`,
            description: 'ينصح بنسخة أسبوعية على الأقل',
            action: 'settings',
            created_at: now
          });
        }
      }
    } catch(e) { console.warn('Backup check failed:', e); }

    return notifs;
  },

  // ==========================================================
  // Render badge on bell
  // ==========================================================
  updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const notifs = this.computeNotifications();
    const highPriority = notifs.filter(n => ['critical', 'high'].includes(n.severity)).length;

    if (highPriority > 0) {
      badge.textContent = highPriority > 9 ? '9+' : highPriority;
      badge.style.display = 'flex';
      badge.classList.remove('badge-info');
      badge.classList.add('badge-danger');
    } else if (notifs.length > 0) {
      badge.textContent = notifs.length > 9 ? '9+' : notifs.length;
      badge.style.display = 'flex';
      badge.classList.remove('badge-danger');
      badge.classList.add('badge-info');
    } else {
      badge.style.display = 'none';
    }
  },

  // ==========================================================
  // Open dropdown
  // ==========================================================
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    const notifs = this.computeNotifications();

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, info: 3 };
    notifs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const html = `
      <div id="notifPanel" class="notif-panel">
        <div class="notif-header">
          <div>
            <div style="font-weight:800; font-size:16px;">🔔 التنبيهات</div>
            <div style="font-size:12px; color:var(--gray-500);">${notifs.length} تنبيه نشط</div>
          </div>
          <button class="modal-close" onclick="NotificationCenter.close()">✕</button>
        </div>

        <div class="notif-body">
          ${notifs.length === 0 ? `
            <div style="text-align:center; padding:60px 20px; color:var(--gray-500);">
              <div style="font-size:56px; margin-bottom:12px;">🎉</div>
              <div style="font-weight:700; font-size:16px; color:var(--leaf-700);">كل شيء تحت السيطرة!</div>
              <div style="font-size:13px; margin-top:6px;">لا توجد تنبيهات نشطة</div>
            </div>
          ` : notifs.map(n => this.renderItem(n)).join('')}
        </div>

        ${notifs.length > 0 ? `
          <div class="notif-footer">
            <button class="btn btn-ghost btn-sm btn-full" onclick="NotificationCenter.close()">إغلاق</button>
          </div>
        ` : ''}
      </div>

      <div id="notifBackdrop" class="notif-backdrop" onclick="NotificationCenter.close()"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.isOpen = true;

    // Animate in
    setTimeout(() => {
      document.getElementById('notifPanel')?.classList.add('open');
    }, 10);
  },

  renderItem(n) {
    const severityColors = {
      critical: { bg: '#F5F3FF', border: '#7C3AED', text: '#5B21B6' },
      high:     { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B' },
      medium:   { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
      info:     { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' }
    };
    const colors = severityColors[n.severity] || severityColors.info;

    return `
      <div class="notif-item" onclick="NotificationCenter.handleClick('${n.action}')"
           style="background:${colors.bg}; border-right:4px solid ${colors.border};">
        <div style="font-size:28px; flex-shrink:0;">${n.icon}</div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; color:${colors.text}; font-size:14px; margin-bottom:4px;">
            ${n.title}
          </div>
          <div style="font-size:12px; color:var(--gray-700);">
            ${n.description}
          </div>
        </div>
        <div style="color:${colors.border}; font-size:20px; flex-shrink:0;">←</div>
      </div>
    `;
  },

  handleClick(action) {
    this.close();
    if (action && typeof switchModule === 'function') {
      switchModule(action);
    }
  },

  close() {
    const panel = document.getElementById('notifPanel');
    const backdrop = document.getElementById('notifBackdrop');
    if (panel) panel.classList.remove('open');
    setTimeout(() => {
      panel?.remove();
      backdrop?.remove();
      this.isOpen = false;
    }, 200);
  },

  // ==========================================================
  // Init - hook bell button
  // ==========================================================
  init() {
    const bellBtn = document.getElementById('notifBellBtn');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => this.toggle());
    }
    this.updateBadge();

    // Recheck every 60s
    setInterval(() => this.updateBadge(), 60000);
  }
};

// Auto-init when auth completes
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => NotificationCenter.init(), 500);
  });
}
