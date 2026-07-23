// ==========================================================
// Bulk Payment Module - تحصيل / دفع شامل بضغطة واحدة
// ==========================================================

const BulkPaymentModule = {

  currentEntity: null, // { id, type: 'customer'|'supplier', name }
  currentInvoices: [], // فواتير الطرف
  distribution: [],    // { invoice_id, amount }

  // ==========================================================
  // فتح modal تحصيل من عميل
  // ==========================================================
  openForCustomer(customerId) {
    if (!requirePermission('debtors_collect_payment', 'تحصيل دفعات')) return;

    const customers = LocalStore.get('customers') || {};
    const cust = customers[customerId];
    if (!cust) return showNotif('❌ العميل غير موجود', 'danger');

    // كل فواتير البيع اللي عليه متبقي
    const invoices = Object.values(LocalStore.get('sales_invoices') || {})
      .filter(i => i.customer_id === customerId
                && i.status !== 'cancelled'
                && (i.remaining || 0) > 0)
      .sort((a, b) => a.created_at - b.created_at); // الأقدم أولاً

    if (invoices.length === 0) {
      return showNotif('✅ العميل ما عليهش أي مديونية', 'success');
    }

    this.currentEntity = {
      id: customerId,
      type: 'customer',
      name: cust.name,
      phone: cust.phone
    };
    this.currentInvoices = invoices;
    this.distribution = [];

    this.renderModal();
  },

  // ==========================================================
  // فتح modal دفع لمورد
  // ==========================================================
  openForSupplier(supplierId) {
    if (!requirePermission('suppliers_pay', 'دفع للموردين') && currentUser.role !== 'admin') {
      // fallback - لو مفيش صلاحية خاصة، نعتمد على debtors_collect_payment أو admin
      if (!hasPermission('debtors_collect_payment') && currentUser.role !== 'admin') {
        return showNotif('⛔ مش مصرح', 'danger');
      }
    }

    const suppliers = LocalStore.get('suppliers') || {};
    const sup = suppliers[supplierId];
    if (!sup) return showNotif('❌ المورد غير موجود', 'danger');

    const invoices = Object.values(LocalStore.get('purchase_invoices') || {})
      .filter(i => i.supplier_id === supplierId
                && i.status !== 'cancelled'
                && (i.remaining || 0) > 0)
      .sort((a, b) => a.created_at - b.created_at);

    if (invoices.length === 0) {
      return showNotif('✅ مفيش مستحقات على المورد ده', 'success');
    }

    this.currentEntity = {
      id: supplierId,
      type: 'supplier',
      name: sup.name,
      phone: sup.phone
    };
    this.currentInvoices = invoices;
    this.distribution = [];

    this.renderModal();
  },

  // ==========================================================
  // Render Modal
  // ==========================================================
  renderModal() {
    const isCustomer = this.currentEntity.type === 'customer';
    const totalOwed = this.currentInvoices.reduce((sum, i) => sum + (i.remaining || 0), 0);
    const paymentMethods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;

    const modalHtml = `
      <div id="bulkPaymentModal" class="modal-overlay">
        <div class="modal" style="max-width: 720px;">
          <div class="modal-header">
            <h3>${isCustomer ? '💰 تحصيل شامل من العميل' : '💵 دفع شامل للمورد'}</h3>
            <button class="modal-close" onclick="BulkPaymentModule.close()">✕</button>
          </div>
          <div class="modal-body" style="max-height:70vh; overflow-y:auto;">

            <!-- Entity Header -->
            <div style="padding:14px; background:${isCustomer ? '#FEF3C7' : '#DBEAFE'}; border-radius:var(--radius); margin-bottom:16px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="font-size:36px;">${isCustomer ? '👤' : '🏭'}</div>
                <div style="flex:1;">
                  <div style="font-weight:800; font-size:16px;">${this.currentEntity.name}</div>
                  <div style="font-size:13px; color:var(--gray-600);">
                    📞 ${this.currentEntity.phone || '—'} — ${this.currentInvoices.length} فاتورة مستحقة
                  </div>
                </div>
                <div style="text-align:left;">
                  <div style="font-size:11px; color:var(--gray-500);">${isCustomer ? 'إجمالي المديونية' : 'إجمالي المستحق'}</div>
                  <div style="font-size:22px; font-weight:800; color:${isCustomer ? '#DC2626' : '#059669'};">
                    ${fmtMoney(totalOwed)} ج.م
                  </div>
                </div>
              </div>
            </div>

            <!-- Amount + Method -->
            <div class="grid grid-2" style="margin-bottom:14px;">
              <div class="form-group" style="margin:0;">
                <label>💰 المبلغ الإجمالي *</label>
                <input type="number" id="bp_amount" step="0.01" placeholder="المبلغ المدفوع"
                       value="${totalOwed.toFixed(2)}"
                       oninput="BulkPaymentModule.recalculate()"
                       style="font-size:20px; font-weight:800; text-align:left;">
                <div style="display:flex; gap:6px; margin-top:6px;">
                  <button class="btn btn-outline btn-sm" onclick="BulkPaymentModule.setAmount(${totalOwed})">💯 الكل (${fmtMoney(totalOwed)})</button>
                  <button class="btn btn-outline btn-sm" onclick="BulkPaymentModule.setAmount(${totalOwed / 2})">نص</button>
                </div>
              </div>
              <div class="form-group" style="margin:0;">
                <label>💳 طريقة الدفع</label>
                <select id="bp_method" onchange="BulkPaymentModule.showPaymentDetails(this.value)">
                  ${Object.entries(paymentMethods).filter(([k,v]) => v.enabled).map(([k, v]) =>
                    `<option value="${k}">${v.icon || ''} ${v.label}</option>`
                  ).join('')}
                </select>
                <div id="bp_method_details" style="margin-top:6px;"></div>
              </div>
            </div>

            <div class="grid grid-2" style="margin-bottom:14px;">
              <div class="form-group" style="margin:0;">
                <label>📅 التاريخ</label>
                <input type="date" id="bp_date" value="${new Date().toISOString().slice(0,10)}">
              </div>
              <div class="form-group" style="margin:0;">
                <label>🔄 طريقة التوزيع</label>
                <select id="bp_strategy" onchange="BulkPaymentModule.applyStrategy(this.value)">
                  <option value="fifo" selected>📅 الأقدم أولاً (FIFO)</option>
                  <option value="lifo">🆕 الأحدث أولاً (LIFO)</option>
                  <option value="highest">📈 الأعلى مبلغاً أولاً</option>
                  <option value="proportional">⚖️ توزيع نسبي</option>
                </select>
              </div>
            </div>

            <!-- Distribution Preview -->
            <div style="margin-top:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-weight:700; font-size:14px;">📋 توزيع المبلغ على الفواتير:</div>
                <div style="font-size:12px; color:var(--gray-500);">اضغط ✏️ لتعديل يدوي</div>
              </div>
              <div id="bp_distribution" style="border:1px solid var(--gray-200); border-radius:var(--radius); overflow:hidden;">
                ${this.renderDistribution()}
              </div>
            </div>

            <!-- Summary -->
            <div id="bp_summary" style="margin-top:14px;">
              ${this.renderSummary()}
            </div>

            <!-- Notes -->
            <div class="form-group" style="margin-top:14px; margin-bottom:0;">
              <label>📝 ملاحظات (اختياري)</label>
              <textarea id="bp_notes" rows="2" placeholder="ملاحظات إضافية على الدفعة..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="BulkPaymentModule.close()">إلغاء</button>
            <button class="btn btn-primary btn-lg" onclick="BulkPaymentModule.execute()" id="bp_execute_btn">
              ${isCustomer ? '💰 تنفيذ التحصيل' : '💵 تنفيذ الدفع'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('bulkPaymentModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // احسب التوزيع الافتراضي
    this.applyStrategy('fifo');

    setTimeout(() => {
      document.getElementById('bp_amount')?.focus();
      document.getElementById('bp_amount')?.select();
    }, 100);
  },

  // ==========================================================
  // Distribution strategies
  // ==========================================================
  applyStrategy(strategy) {
    const amount = Number(document.getElementById('bp_amount')?.value) || 0;
    let invoices = [...this.currentInvoices];

    if (strategy === 'fifo') {
      invoices.sort((a, b) => a.created_at - b.created_at);
    } else if (strategy === 'lifo') {
      invoices.sort((a, b) => b.created_at - a.created_at);
    } else if (strategy === 'highest') {
      invoices.sort((a, b) => b.remaining - a.remaining);
    } else if (strategy === 'proportional') {
      const totalOwed = invoices.reduce((sum, i) => sum + i.remaining, 0);
      this.distribution = invoices.map(inv => ({
        invoice_id: inv._id,
        amount: totalOwed > 0 ? Number(((inv.remaining / totalOwed) * amount).toFixed(2)) : 0
      }));
      this.updateDistributionUI();
      return;
    }

    // FIFO / LIFO / highest - fill in order
    let remaining = amount;
    this.distribution = invoices.map(inv => {
      if (remaining <= 0) return { invoice_id: inv._id, amount: 0 };
      const applied = Math.min(remaining, inv.remaining);
      remaining -= applied;
      return { invoice_id: inv._id, amount: applied };
    });

    this.updateDistributionUI();
  },

  updateDistributionUI() {
    const container = document.getElementById('bp_distribution');
    const summary = document.getElementById('bp_summary');
    if (container) container.innerHTML = this.renderDistribution();
    if (summary) summary.innerHTML = this.renderSummary();
  },

  recalculate() {
    const strategy = document.getElementById('bp_strategy')?.value || 'fifo';
    this.applyStrategy(strategy);
  },

  setAmount(amount) {
    const input = document.getElementById('bp_amount');
    if (input) {
      input.value = amount.toFixed(2);
      this.recalculate();
    }
  },

  // ==========================================================
  // Render distribution table
  // ==========================================================
  renderDistribution() {
    // Map invoice_id -> distribution
    const distMap = {};
    this.distribution.forEach(d => distMap[d.invoice_id] = d.amount);

    // اعرض بترتيب الفواتير الأصلي (الأقدم أولاً في العرض)
    const displayInvoices = [...this.currentInvoices].sort((a, b) => a.created_at - b.created_at);

    return `
      <table style="width:100%; font-size:13px;">
        <thead>
          <tr style="background:var(--gray-50);">
            <th style="padding:8px; text-align:right;">رقم الفاتورة</th>
            <th style="padding:8px; text-align:right;">التاريخ</th>
            <th style="padding:8px; text-align:right;">${this.currentEntity.type === 'customer' ? 'المتبقي' : 'المستحق'}</th>
            <th style="padding:8px; text-align:right;">المدفوع دلوقتي</th>
            <th style="padding:8px; text-align:right;">بعد الدفع</th>
          </tr>
        </thead>
        <tbody>
          ${displayInvoices.map(inv => {
            const applied = distMap[inv._id] || 0;
            const after = Math.max(0, inv.remaining - applied);
            const isFull = applied >= inv.remaining && applied > 0;
            const isPartial = applied > 0 && applied < inv.remaining;
            return `
              <tr style="border-top:1px solid var(--gray-100); ${applied > 0 ? 'background:#F0FDF4;' : ''}">
                <td style="padding:8px;"><strong>${inv.invoice_number}</strong></td>
                <td style="padding:8px; color:var(--gray-600);">${fmtDate(inv.created_at)}</td>
                <td style="padding:8px; color:var(--danger); font-weight:700;">${fmtMoney(inv.remaining)}</td>
                <td style="padding:8px;">
                  <input type="number" step="0.01" min="0" max="${inv.remaining}"
                         value="${applied.toFixed(2)}"
                         data-invoice-id="${inv._id}"
                         onchange="BulkPaymentModule.updateInvoiceAmount('${inv._id}', this.value)"
                         style="width:110px; padding:4px 8px; border:1px solid var(--gray-300); border-radius:6px; font-weight:700; text-align:left;">
                </td>
                <td style="padding:8px; font-weight:700;">
                  <span style="color:${after === 0 ? '#059669' : 'var(--danger)'};">${fmtMoney(after)}</span>
                  ${isFull ? '<span style="margin-right:4px; font-size:10px; background:#D1FAE5; color:#065F46; padding:2px 6px; border-radius:8px;">✅ مسدد</span>' : ''}
                  ${isPartial ? '<span style="margin-right:4px; font-size:10px; background:#FEF3C7; color:#92400E; padding:2px 6px; border-radius:8px;">⚠️ جزئي</span>' : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  // ==========================================================
  // Summary
  // ==========================================================
  renderSummary() {
    const targetAmount = Number(document.getElementById('bp_amount')?.value) || 0;
    const distributedTotal = this.distribution.reduce((sum, d) => sum + d.amount, 0);
    const unapplied = targetAmount - distributedTotal;
    const invoicesAffected = this.distribution.filter(d => d.amount > 0).length;

    const totalOwed = this.currentInvoices.reduce((sum, i) => sum + i.remaining, 0);
    const remainingDebt = totalOwed - distributedTotal;

    let alertBox = '';
    if (Math.abs(unapplied) > 0.01) {
      if (unapplied > 0) {
        alertBox = `
          <div style="padding:10px 14px; background:#FEF3C7; border:1px solid #F59E0B; border-radius:8px; margin-bottom:8px; font-size:13px; color:#92400E;">
            ⚠️ فيه <strong>${fmtMoney(unapplied)} ج.م</strong> مش موزعة على الفواتير. المبلغ أكبر من المطلوب.
          </div>
        `;
      } else {
        alertBox = `
          <div style="padding:10px 14px; background:#FEE2E2; border:1px solid #DC2626; border-radius:8px; margin-bottom:8px; font-size:13px; color:#991B1B;">
            ❌ توزيع الفواتير <strong>${fmtMoney(Math.abs(unapplied))} ج.م</strong> أكبر من المبلغ المدفوع!
          </div>
        `;
      }
    }

    return `
      ${alertBox}
      <div style="padding:12px 16px; background:linear-gradient(135deg, #EDE9FE, #DDD6FE); border-radius:8px;">
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; text-align:center;">
          <div>
            <div style="font-size:11px; color:var(--gray-600);">📄 فواتير هتتأثر</div>
            <div style="font-size:20px; font-weight:800; color:var(--grape-700);">${invoicesAffected}</div>
          </div>
          <div>
            <div style="font-size:11px; color:var(--gray-600);">💰 موزع فعلاً</div>
            <div style="font-size:20px; font-weight:800; color:#059669;">${fmtMoney(distributedTotal)}</div>
          </div>
          <div>
            <div style="font-size:11px; color:var(--gray-600);">${this.currentEntity.type === 'customer' ? '🔴 المتبقي بعد الدفع' : '🔴 مستحق بعد الدفع'}</div>
            <div style="font-size:20px; font-weight:800; color:${remainingDebt === 0 ? '#059669' : 'var(--danger)'};">
              ${fmtMoney(remainingDebt)}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  updateInvoiceAmount(invoiceId, newAmount) {
    newAmount = Number(newAmount) || 0;
    const inv = this.currentInvoices.find(i => i._id === invoiceId);
    if (!inv) return;
    if (newAmount > inv.remaining) newAmount = inv.remaining;
    if (newAmount < 0) newAmount = 0;

    const idx = this.distribution.findIndex(d => d.invoice_id === invoiceId);
    if (idx >= 0) {
      this.distribution[idx].amount = newAmount;
    } else {
      this.distribution.push({ invoice_id: invoiceId, amount: newAmount });
    }
    this.updateDistributionUI();
  },

  showPaymentDetails(methodKey) {
    const box = document.getElementById('bp_method_details');
    if (!box) return;
    if (!methodKey || methodKey === 'cash') {
      box.innerHTML = '';
      return;
    }
    const methods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;
    const method = methods[methodKey];
    if (!method || !method.requires_transfer || !method.phone) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = `
      <div style="padding:8px 10px; background:#F0FDF4; border:1px solid var(--leaf-400); border-radius:6px; font-size:12px;">
        📱 <strong style="direction:ltr; display:inline-block;">${method.phone}</strong>
        — 👤 ${method.recipient_name}
      </div>
    `;
  },

  // ==========================================================
  // 🎯 Execute Bulk Payment
  // ==========================================================
  execute() {
    const targetAmount = Number(document.getElementById('bp_amount')?.value) || 0;
    const method = document.getElementById('bp_method').value;
    const date = document.getElementById('bp_date').value;
    const notes = document.getElementById('bp_notes').value.trim();

    if (targetAmount <= 0) return showNotif('❌ المبلغ لازم أكبر من صفر', 'danger');

    const distributedTotal = this.distribution.reduce((sum, d) => sum + d.amount, 0);
    const activeDistributions = this.distribution.filter(d => d.amount > 0);

    if (activeDistributions.length === 0) {
      return showNotif('❌ لازم توزع المبلغ على فاتورة واحدة على الأقل', 'danger');
    }

    if (distributedTotal > targetAmount + 0.01) {
      return showNotif('❌ التوزيع أكبر من المبلغ - عدل الأرقام', 'danger');
    }

    const isCustomer = this.currentEntity.type === 'customer';
    const confirmMsg = `${isCustomer ? '💰 تحصيل' : '💵 دفع'} إجمالي: ${fmtMoney(distributedTotal)} ج.م\n` +
                     `على ${activeDistributions.length} فاتورة\n` +
                     `${isCustomer ? 'من العميل' : 'للمورد'}: ${this.currentEntity.name}\n\n` +
                     `متأكد؟`;
    if (!confirm(confirmMsg)) return;

    // Bulk reference لتجميع الدفعات
    const bulkRef = `BULK-${Date.now()}`;

    let successCount = 0;
    const errors = [];

    activeDistributions.forEach(dist => {
      try {
        if (isCustomer) {
          this._applyCustomerPayment(dist, method, date, notes, bulkRef);
        } else {
          this._applySupplierPayment(dist, method, date, notes, bulkRef);
        }
        successCount++;
      } catch (e) {
        console.error('Payment failed for', dist.invoice_id, e);
        errors.push(dist.invoice_id);
      }
    });

    logActivity(
      isCustomer ? 'payment_received' : 'payment_out',
      isCustomer ? 'debtors' : 'suppliers',
      bulkRef,
      `${isCustomer ? 'تحصيل شامل من' : 'دفع شامل لـ'} ${this.currentEntity.name}`,
      {
        total: distributedTotal,
        invoices_count: successCount,
        method: method
      }
    );

    this.close();

    if (errors.length === 0) {
      showNotif(`✅ تم ${isCustomer ? 'تحصيل' : 'دفع'} ${fmtMoney(distributedTotal)} ج.م على ${successCount} فاتورة`, 'success', 4000);
    } else {
      showNotif(`⚠️ تم ${successCount} من ${activeDistributions.length} - راجع السجل`, 'warning', 5000);
    }

    // Refresh whatever's on screen
    if (typeof DebtorsModule !== 'undefined' && document.querySelector('.debtors-page')) {
      DebtorsModule.render();
    }
    if (typeof CustomersModule !== 'undefined' && document.getElementById('moduleContainer')?.querySelector('.customers-page')) {
      CustomersModule.render();
    }
    if (typeof SuppliersModule !== 'undefined') {
      try { SuppliersModule.render(); } catch(e) {}
    }
  },

  _applyCustomerPayment(dist, method, date, notes, bulkRef) {
    const invoices = LocalStore.get('sales_invoices') || {};
    const inv = invoices[dist.invoice_id];
    if (!inv) throw new Error('Invoice not found');

    if (dist.amount > inv.remaining + 0.01) {
      throw new Error('Amount > remaining');
    }

    const paymentId = genID('pay_');
    const payments = LocalStore.get('payments') || {};
    payments[paymentId] = {
      _id: paymentId,
      type: 'sales_payment',
      customer_id: inv.customer_id,
      invoice_id: dist.invoice_id,
      invoice_number: inv.invoice_number,
      amount: dist.amount,
      method: method,
      date: date,
      received_by: currentUser._id,
      notes: notes || 'تحصيل شامل',
      bulk_reference: bulkRef,
      created_at: Date.now()
    };
    LocalStore.set('payments', payments);

    // Update invoice
    inv.paid = (inv.paid || 0) + dist.amount;
    inv.remaining = Math.max(0, inv.grand_total - inv.paid);
    inv.status = inv.remaining === 0 ? 'paid' : 'partial';

    // ✅ تحديث updated_at عشان الرفع يشتغل
    inv.updated_at = Date.now();
    inv.updated_by = currentUser._id;
    delete inv._synced_at;

    if (!inv.payments) inv.payments = [];
    inv.payments.push({
      amount: dist.amount,
      method: method,
      date: date,
      notes: notes || 'تحصيل شامل',
      recorded_at: Date.now(),
      bulk_reference: bulkRef
    });

    invoices[dist.invoice_id] = inv;
    LocalStore.set('sales_invoices', invoices);

    // Update customer cache
    const customers = LocalStore.get('customers') || {};
    const cust = customers[inv.customer_id];
    if (cust) {
      cust.cached_total_debt = Math.max(0, (cust.cached_total_debt || 0) - dist.amount);
      cust.updated_at = Date.now();
      delete cust._synced_at;
      customers[inv.customer_id] = cust;
      LocalStore.set('customers', customers);
    }
  },

  _applySupplierPayment(dist, method, date, notes, bulkRef) {
    const invoices = LocalStore.get('purchase_invoices') || {};
    const inv = invoices[dist.invoice_id];
    if (!inv) throw new Error('Invoice not found');

    if (dist.amount > inv.remaining + 0.01) {
      throw new Error('Amount > remaining');
    }

    const paymentId = genID('pay_');
    const payments = LocalStore.get('payments') || {};
    payments[paymentId] = {
      _id: paymentId,
      type: 'purchase_payment',
      supplier_id: inv.supplier_id,
      invoice_id: dist.invoice_id,
      invoice_number: inv.invoice_number,
      amount: dist.amount,
      method: method,
      date: date,
      paid_by: currentUser._id,
      notes: notes || 'دفع شامل',
      bulk_reference: bulkRef,
      created_at: Date.now()
    };
    LocalStore.set('payments', payments);

    // Update invoice
    inv.paid = (inv.paid || 0) + dist.amount;
    inv.remaining = Math.max(0, inv.grand_total - inv.paid);
    inv.status = inv.remaining === 0 ? 'paid' : 'partial';

    // ✅ تحديث updated_at عشان الرفع يشتغل
    inv.updated_at = Date.now();
    inv.updated_by = currentUser._id;
    delete inv._synced_at;

    if (!inv.payments) inv.payments = [];
    inv.payments.push({
      amount: dist.amount,
      method: method,
      date: date,
      notes: notes || 'دفع شامل',
      recorded_at: Date.now(),
      bulk_reference: bulkRef
    });

    invoices[dist.invoice_id] = inv;
    LocalStore.set('purchase_invoices', invoices);

    // Update supplier cache
    const suppliers = LocalStore.get('suppliers') || {};
    const sup = suppliers[inv.supplier_id];
    if (sup) {
      sup.cached_total_debt_to_them = Math.max(0, (sup.cached_total_debt_to_them || 0) - dist.amount);
      sup.updated_at = Date.now();
      delete sup._synced_at;
      suppliers[inv.supplier_id] = sup;
      LocalStore.set('suppliers', suppliers);
    }
  },

  close() {
    document.getElementById('bulkPaymentModal')?.remove();
    this.currentEntity = null;
    this.currentInvoices = [];
    this.distribution = [];
  }
};
