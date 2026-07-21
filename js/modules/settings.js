// ==========================================================
// Settings Module - إعدادات النظام
// ==========================================================

const SettingsModule = {

  currentTab: 'company',

  render() {
    const container = document.getElementById('moduleContainer');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">⚙️ الإعدادات</div>
          <div class="page-subtitle">تخصيص النظام حسب احتياج شركتك</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs" style="margin-bottom: 16px;">
        ${hasPermission('settings_company') ? `
          <button class="tab-btn ${this.currentTab === 'company' ? 'active' : ''}"
                  onclick="SettingsModule.switchTab('company')">
            🏢 الشركة
          </button>
        ` : ''}
        ${hasPermission('settings_company') ? `
          <button class="tab-btn ${this.currentTab === 'payment' ? 'active' : ''}"
                  onclick="SettingsModule.switchTab('payment')">
            💳 طرق الدفع
          </button>
        ` : ''}
        ${hasPermission('settings_whatsapp') ? `
          <button class="tab-btn ${this.currentTab === 'whatsapp' ? 'active' : ''}"
                  onclick="SettingsModule.switchTab('whatsapp')">
            📱 قوالب الواتساب
          </button>
        ` : ''}
        <button class="tab-btn ${this.currentTab === 'password' ? 'active' : ''}"
                onclick="SettingsModule.switchTab('password')">
          🔐 كلمة السر
        </button>
        <button class="tab-btn ${this.currentTab === 'cloud' ? 'active' : ''}"
                onclick="SettingsModule.switchTab('cloud')">
          ☁️ الرفع اللحظي للسحابة
        </button>
        ${currentUser.role === 'admin' ? `
          <button class="tab-btn ${this.currentTab === 'system' ? 'active' : ''}"
                  onclick="SettingsModule.switchTab('system')">
            🔧 إعدادات النظام
          </button>
          <button class="tab-btn ${this.currentTab === 'archive' ? 'active' : ''}"
                  onclick="SettingsModule.switchTab('archive')">
            🗂️ الأرشيف
          </button>
          <button class="tab-btn ${this.currentTab === 'danger' ? 'active' : ''}"
                  onclick="SettingsModule.switchTab('danger')"
                  style="color:var(--danger);">
            ⚠️ منطقة الخطر
          </button>
        ` : ''}
      </div>

      <div id="settingsContent">
        ${this.renderCurrentTab()}
      </div>
    `;
  },

  renderCurrentTab() {
    switch (this.currentTab) {
      case 'company': return this.renderCompanyTab();
      case 'payment': return this.renderPaymentTab();
      case 'whatsapp': return this.renderWhatsAppTab();
      case 'password': return this.renderPasswordTab();
      case 'cloud': return this.renderCloudTab();
      case 'system': return this.renderSystemTab();
      case 'archive': return this.renderArchiveTab();
      case 'danger': return this.renderDangerTab();
      default: return this.renderCompanyTab();
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render();
  },

  // ==========================================================
  // Tab 1: Company
  // ==========================================================
  renderCompanyTab() {
    if (!hasPermission('settings_company')) {
      return '<div class="card"><div style="text-align:center; padding:40px; color:var(--gray-500);">⛔ مش مصرح</div></div>';
    }

    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏢 بيانات الشركة</div>
          <div class="card-subtitle">تظهر في الفواتير المطبوعة والواتساب</div>
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label>اسم الشركة *</label>
            <input type="text" id="cmp_name" value="${company.name || ''}">
          </div>
          <div class="form-group">
            <label>الاسم المختصر</label>
            <input type="text" id="cmp_short_name" value="${company.short_name || ''}">
          </div>
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label>📞 تليفون الحاج *</label>
            <input type="tel" id="cmp_owner_phone" value="${company.owner_phone || ''}"
                   placeholder="01004975602">
            <small class="hint">التليفون اللي بيروحله رسائل الواتساب</small>
          </div>
          <div class="form-group">
            <label>📞 تليفون الشركة</label>
            <input type="tel" id="cmp_phone" value="${company.phone || ''}">
          </div>
        </div>

        <div class="form-group">
          <label>📍 العنوان</label>
          <input type="text" id="cmp_address" value="${company.address || ''}">
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label>🏙️ المدينة</label>
            <input type="text" id="cmp_city" value="${company.city || ''}">
          </div>
          <div class="form-group">
            <label>📧 الإيميل</label>
            <input type="email" id="cmp_email" value="${company.email || ''}">
          </div>
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label>🏛️ السجل التجاري</label>
            <input type="text" id="cmp_commercial_register" value="${company.commercial_register || ''}">
          </div>
          <div class="form-group">
            <label>🧾 البطاقة الضريبية</label>
            <input type="text" id="cmp_tax_id" value="${company.tax_id || ''}">
          </div>
        </div>

        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:20px;">
          <button class="btn btn-primary btn-lg" onclick="SettingsModule.saveCompany()">
            💾 حفظ بيانات الشركة
          </button>
        </div>
      </div>
    `;
  },

  saveCompany() {
    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;

    const name = document.getElementById('cmp_name').value.trim();
    if (!name) return showNotif('❌ اسم الشركة مطلوب', 'danger');

    const owner_phone = document.getElementById('cmp_owner_phone').value.trim();
    if (!owner_phone) return showNotif('❌ تليفون الحاج مطلوب', 'danger');

    const updated = {
      ...company,
      name: name,
      short_name: document.getElementById('cmp_short_name').value.trim(),
      owner_phone: owner_phone,
      phone: document.getElementById('cmp_phone').value.trim(),
      address: document.getElementById('cmp_address').value.trim(),
      city: document.getElementById('cmp_city').value.trim(),
      email: document.getElementById('cmp_email').value.trim(),
      commercial_register: document.getElementById('cmp_commercial_register').value.trim(),
      tax_id: document.getElementById('cmp_tax_id').value.trim(),
      updated_at: Date.now(),
      updated_by: currentUser._id
    };

    LocalStore.set('settings/company', updated);
    logActivity('update_company', 'settings', 'company', name);
    showNotif('✅ تم حفظ بيانات الشركة', 'success');
  },

  // ==========================================================
  // Tab 2: Payment Methods
  // ==========================================================
  renderPaymentTab() {
    if (!hasPermission('settings_company')) {
      return '<div class="card"><div style="text-align:center; padding:40px; color:var(--gray-500);">⛔ مش مصرح</div></div>';
    }

    const methods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;

    // ✅ Migration: لو الـ structure قديم، عبيه بالجديد
    let migrated = false;
    Object.keys(methods).forEach(key => {
      if (!methods[key].hasOwnProperty('requires_transfer')) {
        const def = DEFAULT_PAYMENT_METHODS[key] || {};
        methods[key] = {
          enabled: methods[key].enabled,
          label: methods[key].label,
          icon: def.icon || '💰',
          requires_transfer: def.requires_transfer !== false && key !== 'cash',
          phone: methods[key].number || methods[key].account_number || '',
          recipient_name: methods[key].account_name || '',
          notes: methods[key].notes || ''
        };
        migrated = true;
      }
    });
    if (migrated) LocalStore.set('settings/payment_methods', methods);

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">💳 طرق الدفع المفعّلة</div>
          <div class="card-subtitle">فعّل الطرق اللي تستخدمها + أضف تفاصيل التحويل عشان تظهر للعملاء</div>
        </div>

        <div style="display:grid; gap:16px;">
          ${Object.entries(methods).map(([key, method]) => this.renderPaymentMethodCard(key, method)).join('')}
        </div>

        <div style="padding:12px; background:#FEF3C7; border-radius:var(--radius); margin-top:16px; font-size:13px;">
          💡 <strong>ملاحظة:</strong> بيانات التحويل بتظهر في واجهة الفاتورة لما تختار الطريقة دي، والعميل يقدر يراها في رسالة الواتساب.
        </div>
      </div>
    `;
  },

  renderPaymentMethodCard(key, method) {
    const isCash = key === 'cash';
    const hasDetails = method.requires_transfer;
    const isConfigured = !hasDetails || (method.phone && method.recipient_name);

    return `
      <div class="payment-method-card ${method.enabled ? 'enabled' : ''}" style="flex-direction:column; align-items:stretch;">
        <!-- Header -->
        <div style="display:flex; align-items:center; gap:12px; width:100%; padding-bottom:12px; ${method.enabled && hasDetails ? 'border-bottom:1px solid var(--gray-200); margin-bottom:12px;' : ''}">
          <div style="font-size:32px;">${method.icon || '💰'}</div>
          <div style="flex:1;">
            <div style="font-weight:800; font-size:17px;">${method.label}</div>
            <div style="font-size:13px; color:var(--gray-500);">
              ${isCash ? 'مقبوض في اليد - لا يحتاج تفاصيل تحويل' :
                method.enabled ? (isConfigured ? '✅ جاهز' : '⚠️ محتاج تحدد رقم التحويل') : 'غير مفعّل'}
            </div>
          </div>

          <label class="toggle-switch">
            <input type="checkbox" ${method.enabled ? 'checked' : ''}
                   onchange="SettingsModule.togglePaymentMethod('${key}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <!-- Transfer Details (visible only for enabled + requires_transfer) -->
        ${method.enabled && hasDetails ? `
          <div class="grid grid-2" style="gap:12px;">
            <div class="form-group" style="margin:0;">
              <label>📱 رقم التحويل *</label>
              <input type="tel" id="pm_${key}_phone" value="${method.phone || ''}"
                     placeholder="01xxxxxxxxx"
                     oninput="SettingsModule.updatePaymentField('${key}', 'phone', this.value)">
              <small class="hint">الرقم اللي العميل يحول عليه</small>
            </div>

            <div class="form-group" style="margin:0;">
              <label>👤 اسم المسؤول *</label>
              <input type="text" id="pm_${key}_recipient" value="${method.recipient_name || ''}"
                     placeholder="مثل: الحاج حموده"
                     oninput="SettingsModule.updatePaymentField('${key}', 'recipient_name', this.value)">
              <small class="hint">الاسم اللي هيظهر للعميل عشان يتأكد</small>
            </div>
          </div>

          <div class="form-group" style="margin:12px 0 0 0;">
            <label>📝 ملاحظات إضافية (اختياري)</label>
            <input type="text" id="pm_${key}_notes" value="${method.notes || ''}"
                   placeholder="مثل: أرسل صورة السند بعد التحويل"
                   oninput="SettingsModule.updatePaymentField('${key}', 'notes', this.value)">
          </div>

          <!-- Preview -->
          ${isConfigured ? `
            <div style="margin-top:12px; padding:10px 12px; background:#F0FDF4; border:1px solid var(--leaf-400); border-radius:var(--radius); font-size:13px;">
              <div style="font-weight:700; color:var(--leaf-700); margin-bottom:4px;">👁️ معاينة اللي هيظهر للعميل:</div>
              <div style="background:white; padding:8px 12px; border-radius:var(--radius); margin-top:6px;">
                ${method.icon} <strong>${method.label}</strong><br>
                📱 حول على: <strong style="direction:ltr; display:inline-block;">${method.phone}</strong><br>
                👤 باسم: <strong>${method.recipient_name}</strong>
                ${method.notes ? `<br>📝 ${method.notes}` : ''}
              </div>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  },

  updatePaymentField(key, field, value) {
    const methods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;
    if (!methods[key]) return;
    methods[key][field] = value.trim();
    LocalStore.set('settings/payment_methods', methods);
    // No notification here - too noisy while typing

    // Update the preview live (without re-rendering entire tab)
    if (field === 'phone' || field === 'recipient_name') {
      // Trigger only when both are filled to update preview
      const method = methods[key];
      if (method.phone && method.recipient_name) {
        // Debounced re-render (لعرض المعاينة)
        clearTimeout(this._paymentUpdateTimer);
        this._paymentUpdateTimer = setTimeout(() => this.render(), 800);
      }
    }
  },

  togglePaymentMethod(key, enabled) {
    const methods = LocalStore.get('settings/payment_methods') || DEFAULT_PAYMENT_METHODS;
    if (!methods[key]) return;

    // منع تعطيل الكاش (الحد الأدنى المطلوب)
    if (key === 'cash' && !enabled) {
      showNotif('❌ ما تقدرش تعطل الكاش - لازم يكون في طريقة دفع واحدة على الأقل', 'danger');
      this.render();
      return;
    }

    methods[key].enabled = enabled;
    LocalStore.set('settings/payment_methods', methods);
    logActivity('toggle_payment', 'settings', key, `${methods[key].label} → ${enabled ? 'مفعل' : 'معطل'}`);
    showNotif(`✅ ${methods[key].label}: ${enabled ? 'تم التفعيل' : 'تم التعطيل'}`, 'success');

    // Re-render to show/hide transfer details
    this.render();
  },

  // ==========================================================
  // Tab 3: WhatsApp Templates
  // ==========================================================
  renderWhatsAppTab() {
    if (!hasPermission('settings_whatsapp')) {
      return '<div class="card"><div style="text-align:center; padding:40px; color:var(--gray-500);">⛔ مش مصرح</div></div>';
    }

    const templates = LocalStore.get('settings/whatsapp_templates') || DEFAULT_WA_TEMPLATES;

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📱 قوالب رسائل الواتساب</div>
          <div class="card-subtitle">النصوص اللي بتتبعت للعملاء - استخدم {placeholders} للبيانات الديناميكية</div>
        </div>

        <!-- Invoice Template -->
        <div class="form-group">
          <label>💰 قالب الفاتورة للعميل</label>
          <textarea id="wa_invoice" rows="10" style="font-family: monospace; font-size:13px; direction:ltr; text-align:right;">${templates.invoice_to_customer || ''}</textarea>
          <small class="hint">
            متاح: {invoice_number}، {date}، {customer_name}، {items_list}، {grand_total}، {paid}، {remaining}، {due_date}
          </small>
        </div>

        <!-- Reminder Template -->
        <div class="form-group">
          <label>🔴 قالب مطالبة العميل بالمديونية</label>
          <textarea id="wa_reminder" rows="8" style="font-family: monospace; font-size:13px; direction:ltr; text-align:right;">${templates.debt_reminder || ''}</textarea>
          <small class="hint">
            متاح: {customer_name}، {invoice_number}، {amount}، {due_date}
          </small>
        </div>

        <div style="display:flex; gap:8px; justify-content:space-between; margin-top:20px;">
          <button class="btn btn-outline" onclick="SettingsModule.resetWATemplates()">
            🔄 استرجاع الافتراضي
          </button>
          <button class="btn btn-primary btn-lg" onclick="SettingsModule.saveWATemplates()">
            💾 حفظ القوالب
          </button>
        </div>
      </div>
    `;
  },

  saveWATemplates() {
    const templates = LocalStore.get('settings/whatsapp_templates') || DEFAULT_WA_TEMPLATES;

    templates.invoice_to_customer = document.getElementById('wa_invoice').value;
    templates.debt_reminder = document.getElementById('wa_reminder').value;
    templates.updated_at = Date.now();

    LocalStore.set('settings/whatsapp_templates', templates);
    logActivity('update_wa_templates', 'settings', 'templates', 'قوالب الواتساب');
    showNotif('✅ تم حفظ القوالب', 'success');
  },

  resetWATemplates() {
    if (!confirm('⚠️ استرجاع القوالب الافتراضية؟\n\nالتخصيصات الحالية هتتلغى.')) return;
    LocalStore.set('settings/whatsapp_templates', DEFAULT_WA_TEMPLATES);
    logActivity('reset_wa_templates', 'settings', 'templates', 'استرجاع افتراضي');
    showNotif('✅ تم الاسترجاع', 'success');
    this.render();
  },

  // ==========================================================
  // Tab: ☁️ Cloud Sync
  // ==========================================================
  renderCloudTab() {
    const settings = CloudSync.getSettings();
    const pendingCount = CloudSync.getPendingCount();
    const isOnline = CloudSync.isOnline;
    const isInit = CloudSync.isInitialized;
    const lastSync = CloudSync.formatLastSync();
    const stats = CloudSync.stats;

    return `
      <!-- Status Card -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">☁️ حالة الرفع اللحظي للسحابة</div>
        </div>

        <div class="grid grid-3" style="margin-bottom:16px;">
          <div style="padding:16px; background:${isOnline && isInit ? '#F0FDF4' : '#FEF2F2'}; border-radius:12px; text-align:center;">
            <div style="font-size:40px; margin-bottom:8px;">${isOnline && isInit ? '🟢' : '🔴'}</div>
            <div style="font-size:12px; color:var(--gray-600);">حالة الاتصال</div>
            <div style="font-size:16px; font-weight:800; color:${isOnline && isInit ? '#059669' : '#DC2626'};">
              ${!isInit ? 'غير مهيأ' : isOnline ? 'متصل بالسحابة' : 'غير متصل'}
            </div>
          </div>

          <div style="padding:16px; background:#F5F3FF; border-radius:12px; text-align:center;">
            <div style="font-size:40px; margin-bottom:8px;">📅</div>
            <div style="font-size:12px; color:var(--gray-600);">آخر تحديث</div>
            <div style="font-size:16px; font-weight:800; color:var(--grape-700);">
              ${lastSync}
            </div>
          </div>

          <div style="padding:16px; background:${pendingCount > 0 ? '#FEF3C7' : '#F0FDF4'}; border-radius:12px; text-align:center;">
            <div style="font-size:40px; margin-bottom:8px;">${pendingCount > 0 ? '⏳' : '✅'}</div>
            <div style="font-size:12px; color:var(--gray-600);">عمليات معلقة</div>
            <div style="font-size:20px; font-weight:800; color:${pendingCount > 0 ? '#D97706' : '#059669'};">
              ${pendingCount}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-lg" onclick="CloudSync.fullSync()" ${!isOnline || !isInit ? 'disabled' : ''}>
            ☁️ رفع وتحميل الآن
          </button>
          ${pendingCount > 0 ? `
            <button class="btn btn-gold btn-lg" onclick="CloudSync.uploadAllPending()" ${!isOnline || !isInit ? 'disabled' : ''}>
              ⬆️ رفع ${pendingCount} عملية معلقة
            </button>
          ` : ''}
          <button class="btn btn-outline btn-lg" onclick="switchModule('cloud-pending')">
            📋 عرض العمليات المعلقة
          </button>
        </div>
      </div>

      <!-- Auto Sync Settings -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">⚙️ الرفع التلقائي</div>
          <div class="card-subtitle">اختر كم دقيقة يعمل رفع تلقائي</div>
        </div>

        <div style="display:grid; gap:10px; margin-bottom:16px;">
          ${[
            { val: 0, label: '⏸️ إيقاف (يدوي فقط)', desc: 'إنت بتضغط الرفع لما تحب' },
            { val: 5, label: '⚡ كل 5 دقايق (مقترح)', desc: 'أسرع تحديث بين الأجهزة' },
            { val: 10, label: '🕐 كل 10 دقايق', desc: 'متوسط' },
            { val: 15, label: '🕒 كل 15 دقيقة', desc: 'أقل استهلاك للنت' },
            { val: 30, label: '🕕 كل 30 دقيقة', desc: 'للنت الضعيف' },
            { val: 60, label: '🕐 كل ساعة', desc: 'الحد الأدنى' }
          ].map(opt => `
            <label style="display:flex; align-items:center; gap:12px; padding:12px; border:2px solid ${settings.auto_sync_interval_minutes === opt.val ? 'var(--grape-500)' : 'var(--gray-200)'}; border-radius:8px; cursor:pointer; background:${settings.auto_sync_interval_minutes === opt.val ? 'var(--grape-50)' : 'white'};">
              <input type="radio" name="sync_interval" value="${opt.val}"
                     ${settings.auto_sync_interval_minutes === opt.val ? 'checked' : ''}
                     onchange="SettingsModule.updateSyncInterval(${opt.val})">
              <div style="flex:1;">
                <div style="font-weight:700;">${opt.label}</div>
                <div style="font-size:12px; color:var(--gray-600);">${opt.desc}</div>
              </div>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Auto Behavior Settings -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">🎯 السلوك التلقائي</div>
        </div>

        <div style="display:grid; gap:10px;">
          <label style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--gray-200); border-radius:8px; cursor:pointer;">
            <input type="checkbox" ${settings.sync_on_startup ? 'checked' : ''}
                   onchange="SettingsModule.toggleSyncOption('sync_on_startup', this.checked)"
                   style="width:20px; height:20px;">
            <div>
              <div style="font-weight:700;">🚀 تحديث تلقائي عند فتح النظام</div>
              <div style="font-size:12px; color:var(--gray-600);">تحميل آخر البيانات بمجرد الدخول</div>
            </div>
          </label>

          <label style="display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--gray-200); border-radius:8px; cursor:pointer;">
            <input type="checkbox" ${settings.sync_after_invoice ? 'checked' : ''}
                   onchange="SettingsModule.toggleSyncOption('sync_after_invoice', this.checked)"
                   style="width:20px; height:20px;">
            <div>
              <div style="font-weight:700;">📤 رفع تلقائي بعد كل فاتورة</div>
              <div style="font-size:12px; color:var(--gray-600);">كل فاتورة جديدة تترفع للسحابة فوراً</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Statistics -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">📊 إحصائيات</div>
        </div>

        <div class="grid grid-3">
          <div style="padding:14px; background:#F0FDF4; border-radius:8px; text-align:center;">
            <div style="font-size:11px; color:var(--gray-600);">تم رفعها</div>
            <div style="font-size:22px; font-weight:800; color:#059669;">${stats.totalUploaded}</div>
          </div>
          <div style="padding:14px; background:#EFF6FF; border-radius:8px; text-align:center;">
            <div style="font-size:11px; color:var(--gray-600);">تم تحميلها</div>
            <div style="font-size:22px; font-weight:800; color:#2563EB;">${stats.totalDownloaded}</div>
          </div>
          <div style="padding:14px; background:#FEF2F2; border-radius:8px; text-align:center;">
            <div style="font-size:11px; color:var(--gray-600);">أخطاء</div>
            <div style="font-size:22px; font-weight:800; color:#DC2626;">${stats.totalErrors}</div>
          </div>
        </div>

        ${stats.lastError ? `
          <div style="margin-top:12px; padding:10px; background:#FEF2F2; border-radius:8px; font-size:12px;">
            <strong>آخر خطأ:</strong> ${stats.lastError}
          </div>
        ` : ''}
      </div>

      <!-- Info -->
      <div style="padding:14px; background:#EFF6FF; border-radius:8px; font-size:13px;">
        💡 <strong>ملاحظة:</strong>
        كل البيانات محفوظة محلياً على جهازك أولاً، ثم بيتم رفعها للسحابة.
        لو النت مقطوع، البيانات هتفضل محفوظة وهيتم رفعها لما النت يرجع.
      </div>
    `;
  },

  updateSyncInterval(minutes) {
    const settings = CloudSync.getSettings();
    settings.auto_sync_interval_minutes = minutes;
    CloudSync.saveSettings(settings);
    showNotif(`✅ تم تغيير الوقت إلى ${minutes === 0 ? 'يدوي فقط' : 'كل ' + minutes + ' دقيقة'}`, 'success');
    this.render();
  },

  toggleSyncOption(option, value) {
    const settings = CloudSync.getSettings();
    settings[option] = value;
    CloudSync.saveSettings(settings);
    showNotif('✅ تم الحفظ', 'success', 1500);
  },

  // ==========================================================
  // Tab 4: Personal Password
  // ==========================================================
  renderPasswordTab() {
    return `
      <div class="card" style="max-width: 600px;">
        <div class="card-header">
          <div class="card-title">🔐 تغيير كلمة السر</div>
          <div class="card-subtitle">كلمة السر الشخصية بتاعتك: ${currentUser.name}</div>
        </div>

        <div style="padding:12px; background:#EDE9FE; border-radius:var(--radius); margin-bottom:16px; font-size:13px;">
          💡 <strong>ملاحظة:</strong> بعد التغيير هتحتاج تسجل دخول تاني بكلمة السر الجديدة.
        </div>

        <div class="form-group">
          <label>كلمة السر الحالية *</label>
          <input type="password" id="pwd_current" placeholder="كلمة السر الحالية" autocomplete="current-password">
        </div>

        <div class="form-group">
          <label>كلمة السر الجديدة *</label>
          <input type="password" id="pwd_new" placeholder="6 حروف على الأقل" autocomplete="new-password">
        </div>

        <div class="form-group">
          <label>تأكيد كلمة السر الجديدة *</label>
          <input type="password" id="pwd_confirm" placeholder="كلمة السر مرة أخرى" autocomplete="new-password">
        </div>

        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:20px;">
          <button class="btn btn-primary btn-lg" onclick="SettingsModule.changePassword()">
            🔐 تغيير كلمة السر
          </button>
        </div>
      </div>
    `;
  },

  changePassword() {
    const current = document.getElementById('pwd_current').value;
    const newPwd = document.getElementById('pwd_new').value;
    const confirmPwd = document.getElementById('pwd_confirm').value;

    if (!current) return showNotif('❌ كلمة السر الحالية مطلوبة', 'danger');
    if (!newPwd || newPwd.length < 6) return showNotif('❌ كلمة السر الجديدة لازم 6 حروف على الأقل', 'danger');
    if (newPwd !== confirmPwd) return showNotif('❌ كلمة السر ما تطابقتش', 'danger');

    // تحقق من كلمة السر الحالية
    const currentHash = hashPassword(current);
    if (currentHash !== currentUser.password_hash) {
      return showNotif('❌ كلمة السر الحالية غير صحيحة', 'danger');
    }

    // احفظ كلمة السر الجديدة
    const users = LocalStore.get('users') || {};
    const user = users[currentUser._id];
    if (!user) return showNotif('❌ خطأ في تحديث المستخدم', 'danger');

    user.password_hash = hashPassword(newPwd);
    user.password_changed_at = Date.now();
    users[currentUser._id] = user;
    LocalStore.set('users', users);

    // حدث الـ currentUser
    currentUser.password_hash = user.password_hash;

    logActivity('change_password', 'settings', currentUser._id, currentUser.name);

    // إفراغ الحقول
    document.getElementById('pwd_current').value = '';
    document.getElementById('pwd_new').value = '';
    document.getElementById('pwd_confirm').value = '';

    showNotif('✅ تم تغيير كلمة السر بنجاح - لن يتم تسجيل خروجك الآن', 'success', 4000);
  },

  // ==========================================================
  // Tab 5: System (Admin Only)
  // ==========================================================
  renderSystemTab() {
    if (currentUser.role !== 'admin') {
      return '<div class="card"><div style="text-align:center; padding:40px; color:var(--gray-500);">⛔ للأدمن فقط</div></div>';
    }

    const settings = LocalStore.get('settings/system') || DEFAULT_SETTINGS;
    const stats = {
      users: Object.keys(LocalStore.get('users') || {}).length,
      products: Object.keys(LocalStore.get('products') || {}).length,
      customers: Object.keys(LocalStore.get('customers') || {}).length,
      suppliers: Object.keys(LocalStore.get('suppliers') || {}).length,
      warehouses: Object.keys(LocalStore.get('warehouses') || {}).length,
      salesInvoices: Object.keys(LocalStore.get('sales_invoices') || {}).length,
      purchaseInvoices: Object.keys(LocalStore.get('purchase_invoices') || {}).length,
      transactions: Object.keys(LocalStore.get('inventory_txns') || {}).length
    };

    return `
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-header">
          <div class="card-title">🔧 إعدادات النظام</div>
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label>افتراضي أيام السداد</label>
            <input type="number" id="sys_default_due_days"
                   value="${settings.default_due_days || 30}" min="1" max="365">
            <small class="hint">تاريخ الاستحقاق الافتراضي للفواتير الآجل</small>
          </div>
          <div class="form-group">
            <label>حد التنبيه للمخزون الحرج (كجم)</label>
            <input type="number" id="sys_critical_stock"
                   value="${settings.critical_stock_alert || 100}" min="0">
            <small class="hint">لما الرصيد يقل عن ده، ينبه</small>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label>أيام تنبيه انتهاء الصلاحية</label>
            <input type="number" id="sys_expiry_days"
                   value="${settings.expiry_alert_days || 30}" min="1">
            <small class="hint">قبل انتهاء الصلاحية بكام يوم</small>
          </div>
          <div class="form-group">
            <label>الحد الأقصى لمحاولات الدخول</label>
            <input type="number" id="sys_max_login_attempts"
                   value="${settings.max_login_attempts || 5}" min="1" max="10">
            <small class="hint">بعد كام محاولة يقفل الحساب مؤقتاً</small>
          </div>
        </div>

        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:20px;">
          <button class="btn btn-primary" onclick="SettingsModule.saveSystemSettings()">
            💾 حفظ الإعدادات
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 إحصائيات النظام</div>
          <div class="card-subtitle">بيانات مخزنة على الجهاز حالياً</div>
        </div>

        <div class="grid grid-4">
          <div class="stat-card" style="padding:14px;">
            <div class="stat-label">👤 المستخدمين</div>
            <div class="stat-value">${stats.users}</div>
          </div>
          <div class="stat-card" style="padding:14px;">
            <div class="stat-label">🍇 الأصناف</div>
            <div class="stat-value">${stats.products}</div>
          </div>
          <div class="stat-card" style="padding:14px;">
            <div class="stat-label">🏢 المخازن</div>
            <div class="stat-value">${stats.warehouses}</div>
          </div>
          <div class="stat-card" style="padding:14px;">
            <div class="stat-label">👥 العملاء</div>
            <div class="stat-value">${stats.customers}</div>
          </div>
          <div class="stat-card" style="padding:14px;">
            <div class="stat-label">🏭 الموردين</div>
            <div class="stat-value">${stats.suppliers}</div>
          </div>
          <div class="stat-card" style="padding:14px;">
            <div class="stat-label">💰 فواتير بيع</div>
            <div class="stat-value">${stats.salesInvoices}</div>
          </div>
          <div class="stat-card" style="padding:14px;">
            <div class="stat-label">🛒 فواتير شراء</div>
            <div class="stat-value">${stats.purchaseInvoices}</div>
          </div>
          <div class="stat-card" style="padding:14px;">
            <div class="stat-label">📊 حركات مخزون</div>
            <div class="stat-value">${stats.transactions}</div>
          </div>
        </div>
      </div>
    `;
  },

  saveSystemSettings() {
    const settings = LocalStore.get('settings/system') || DEFAULT_SETTINGS;

    settings.default_due_days = Number(document.getElementById('sys_default_due_days').value) || 30;
    settings.critical_stock_alert = Number(document.getElementById('sys_critical_stock').value) || 100;
    settings.expiry_alert_days = Number(document.getElementById('sys_expiry_days').value) || 30;
    settings.max_login_attempts = Number(document.getElementById('sys_max_login_attempts').value) || 5;
    settings.updated_at = Date.now();

    LocalStore.set('settings/system', settings);
    logActivity('update_system_settings', 'settings', 'system', 'إعدادات النظام');
    showNotif('✅ تم حفظ الإعدادات', 'success');
  },

  // ==========================================================
  // Tab: Archive (النسخ الاحتياطي والأرشيف)
  // ==========================================================
  renderArchiveTab() {
    if (currentUser.role !== 'admin') {
      return '<div class="card"><div style="text-align:center; padding:40px; color:var(--gray-500);">⛔ للأدمن فقط</div></div>';
    }

    // Get stats
    const stats = {
      sales: Object.keys(LocalStore.get('sales_invoices') || {}).length,
      purchases: Object.keys(LocalStore.get('purchase_invoices') || {}).length,
      transactions: Object.keys(LocalStore.get('inventory_txns') || {}).length,
      payments: Object.keys(LocalStore.get('payments') || {}).length,
      returns: Object.keys(LocalStore.get('sales_returns') || {}).length + Object.keys(LocalStore.get('purchase_returns') || {}).length
    };

    // Storage size
    let totalSize = 0;
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('hamouda_')) {
          totalSize += localStorage.getItem(key).length;
        }
      });
    } catch(e) {}
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

    return `
      <!-- Info Card -->
      <div class="card" style="margin-bottom:16px; background:#EDE9FE;">
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="font-size:48px;">🗂️</div>
          <div style="flex:1;">
            <div style="font-weight:800; font-size:16px;">النسخ الاحتياطي والأرشيف</div>
            <div style="font-size:13px; color:var(--gray-600); margin-top:4px;">
              احفظ نسخة احتياطية من كل بيانات الشركة، أو ارشف الفواتير القديمة لتفريغ مساحة على الجهاز.
            </div>
          </div>
          <div style="text-align:center; padding:12px 16px; background:white; border-radius:var(--radius);">
            <div style="font-size:20px; font-weight:800; color:var(--grape-700);">${sizeMB} MB</div>
            <div style="font-size:11px; color:var(--gray-500);">حجم البيانات الحالي</div>
          </div>
        </div>
      </div>

      <!-- Export Full Backup -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">📤 تصدير نسخة احتياطية كاملة</div>
          <div class="card-subtitle">كل البيانات: الفواتير، الأصناف، العملاء، الموردين، المخزون، الإعدادات</div>
        </div>

        <div class="grid grid-4" style="margin-bottom:16px;">
          <div style="text-align:center; padding:12px; background:var(--gray-50); border-radius:var(--radius);">
            <div style="font-size:24px;">💰</div>
            <div style="font-weight:700; font-size:18px;">${stats.sales}</div>
            <div style="font-size:12px; color:var(--gray-500);">فاتورة بيع</div>
          </div>
          <div style="text-align:center; padding:12px; background:var(--gray-50); border-radius:var(--radius);">
            <div style="font-size:24px;">🛒</div>
            <div style="font-weight:700; font-size:18px;">${stats.purchases}</div>
            <div style="font-size:12px; color:var(--gray-500);">فاتورة شراء</div>
          </div>
          <div style="text-align:center; padding:12px; background:var(--gray-50); border-radius:var(--radius);">
            <div style="font-size:24px;">📊</div>
            <div style="font-weight:700; font-size:18px;">${stats.transactions}</div>
            <div style="font-size:12px; color:var(--gray-500);">حركة مخزون</div>
          </div>
          <div style="text-align:center; padding:12px; background:var(--gray-50); border-radius:var(--radius);">
            <div style="font-size:24px;">💵</div>
            <div style="font-weight:700; font-size:18px;">${stats.payments}</div>
            <div style="font-size:12px; color:var(--gray-500);">دفعة</div>
          </div>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-lg" onclick="SettingsModule.exportFullBackup()" style="flex:1; min-width:200px;">
            📤 تنزيل JSON (نسخة احتياطية فنية)
          </button>
          <button class="btn btn-gold btn-lg" onclick="SettingsModule.exportFullBackupExcel()" style="flex:1; min-width:200px;">
            📊 تنزيل Excel (للمحاسب)
          </button>
        </div>

        <div style="padding:12px; background:#FEF3C7; border-radius:var(--radius); margin-top:12px; font-size:13px;">
          💡 <strong>الفرق:</strong>
          <br>• <strong>JSON</strong> — لاسترجاع كل البيانات على النظام مرة تانية (احتفظ بيه للطوارئ)
          <br>• <strong>Excel</strong> — قابل للفتح والقراءة والطباعة بسهولة (المحاسب يفتحه ويراجع)
        </div>
      </div>

      <!-- Import Backup -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">📥 استرجاع من ملف احتياطي</div>
          <div class="card-subtitle">ارفع ملف JSON اللي عملت له تصدير قبل كده</div>
        </div>

        <div style="padding:12px; background:#FEE2E2; border-radius:var(--radius); margin-bottom:12px; font-size:13px; color:#991B1B;">
          ⚠️ <strong>تحذير:</strong> استرجاع النسخة هيستبدل كل البيانات الحالية. اعمل نسخة احتياطية جديدة أولاً لو عندك بيانات مهمة.
        </div>

        <input type="file" id="backup_file" accept=".json" style="margin-bottom:12px;">

        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline btn-lg" onclick="SettingsModule.importBackup()" style="flex:1;">
            📥 استرجاع الآن
          </button>
        </div>
      </div>

      <!-- Archive Old Invoices -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🗄️ أرشفة فواتير قديمة</div>
          <div class="card-subtitle">صدّر فواتير فترة معينة كملف مستقل + امسحها من الجهاز لتوفير مساحة</div>
        </div>

        <div class="grid grid-2" style="margin-bottom:12px;">
          <div class="form-group" style="margin:0;">
            <label>من تاريخ</label>
            <input type="date" id="archive_from"
                   value="${new Date(Date.now() - 365*86400000).toISOString().slice(0,10)}">
          </div>
          <div class="form-group" style="margin:0;">
            <label>إلى تاريخ</label>
            <input type="date" id="archive_to"
                   value="${new Date(Date.now() - 90*86400000).toISOString().slice(0,10)}">
          </div>
        </div>

        <div style="padding:12px; background:#FEF3C7; border-radius:var(--radius); margin-bottom:12px; font-size:13px;">
          💡 <strong>الخطوات:</strong>
          <ol style="margin:6px 0 0 20px; padding:0;">
            <li>حدد الفترة اللي عاوز تأرشفها (يفضل تسيب آخر 90 يوم على الأقل)</li>
            <li>اضغط "معاينة" — هيوريك عدد الفواتير</li>
            <li>اضغط "تحميل ومسح" — الملف ينزل والفواتير تتشال من الجهاز</li>
            <li>احفظ الملف - المحاسب يقدر يفتحه أي وقت بـ "معاينة أرشيف" في الأسفل</li>
          </ol>
        </div>

        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline" onclick="SettingsModule.previewArchive()">
            👁️ معاينة
          </button>
          <button class="btn btn-danger" onclick="SettingsModule.downloadAndArchive()" style="flex:1;">
            📥 تحميل + مسح من الجهاز
          </button>
        </div>

        <div id="archivePreview" style="margin-top:12px;"></div>
      </div>

      <!-- View Archive File -->
      <div class="card" style="margin-top:16px;">
        <div class="card-header">
          <div class="card-title">👁️ معاينة ملف أرشيف</div>
          <div class="card-subtitle">افتح ملف أرشيف قديم للاطلاع على محتوياته (بدون استرجاع)</div>
        </div>

        <input type="file" id="archive_view_file" accept=".json" style="margin-bottom:12px;">

        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline btn-lg" onclick="SettingsModule.viewArchiveFile()" style="flex:1;">
            👁️ فتح للمعاينة
          </button>
        </div>

        <div id="archiveViewResult" style="margin-top:12px;"></div>
      </div>
    `;
  },

  exportFullBackup() {
    const backup = {
      version: '1.0',
      type: 'full_backup',
      created_at: Date.now(),
      created_by: currentUser._id,
      created_by_name: currentUser.name,
      company: LocalStore.get('settings/company')?.name || 'Hamouda',
      data: {}
    };

    // Read all keys
    const allKeys = [
      'users', 'warehouses', 'products', 'customers', 'suppliers',
      'sales_invoices', 'purchase_invoices', 'inventory_txns',
      'payments', 'sales_returns', 'purchase_returns', 'counters',
      'settings/company', 'settings/payment_methods', 'settings/permissions',
      'settings/system', 'settings/whatsapp_templates', 'settings/units', 'settings/categories'
    ];

    allKeys.forEach(key => {
      const val = LocalStore.get(key);
      if (val !== null && val !== undefined) {
        backup.data[key] = val;
      }
    });

    const json = JSON.stringify(backup, null, 2);
    this._downloadFile(json, `hamouda_backup_${new Date().toISOString().slice(0,10)}.json`, 'application/json');

    logActivity('export_backup', 'settings', 'backup', 'نسخة احتياطية كاملة (JSON)');
    LocalStore.set('last_backup_at', Date.now());
    showNotif('✅ تم تحميل النسخة الاحتياطية (JSON)', 'success');
  },

  // ==========================================================
  // 📊 Excel export - للمحاسب (نسخة قابلة للقراءة)
  // ==========================================================
  exportFullBackupExcel() {
    const backup = { data: {} };
    const allKeys = [
      'users', 'warehouses', 'products', 'customers', 'suppliers',
      'sales_invoices', 'purchase_invoices', 'inventory_txns',
      'payments', 'sales_returns', 'purchase_returns'
    ];
    allKeys.forEach(key => {
      backup.data[key] = LocalStore.get(key) || {};
    });

    const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;
    const html = this._buildBackupExcelHTML(backup, company, {
      title: 'نسخة احتياطية كاملة',
      periodLabel: 'كل البيانات'
    });

    this._downloadFile(
      html,
      `hamouda_backup_${new Date().toISOString().slice(0,10)}.xls`,
      'application/vnd.ms-excel'
    );

    logActivity('export_backup', 'settings', 'backup_excel', 'نسخة احتياطية Excel');
    LocalStore.set('last_backup_at', Date.now());
    showNotif('✅ تم تحميل ملف Excel', 'success');
  },

  // ==========================================================
  // Helper: تنزيل ملف
  // ==========================================================
  _downloadFile(content, filename, mimeType) {
    const BOM = '\uFEFF'; // UTF-8 BOM لدعم العربي في Excel
    const blob = new Blob([BOM + content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ==========================================================
  // بناء Excel كـ HTML - Excel يفتحه ك sheet
  // ==========================================================
  _buildBackupExcelHTML(backup, company, meta) {
    const data = backup.data || {};
    const styles = `
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial; direction: rtl; }
        .doc-header { text-align: center; padding: 16px; background: #7C3AED; color: white; }
        .doc-header h1 { margin: 0; font-size: 22px; }
        .doc-header p { margin: 4px 0; font-size: 13px; opacity: 0.9; }
        .section-title { font-size: 18px; font-weight: bold; padding: 12px; margin-top: 20px; background: #F5F3FF; color: #5B21B6; border-right: 4px solid #7C3AED; }
        table { border-collapse: collapse; width: 100%; margin-top: 4px; font-size: 12px; }
        th { background: #EDE9FE; color: #4C1D95; padding: 8px; border: 1px solid #C4B5FD; font-weight: bold; text-align: right; }
        td { padding: 6px 8px; border: 1px solid #E5E7EB; text-align: right; }
        tr:nth-child(even) td { background: #FAFAFA; }
        .num { text-align: left; font-weight: 600; }
        .status-paid { color: #059669; font-weight: bold; }
        .status-partial { color: #D97706; font-weight: bold; }
        .status-unpaid { color: #DC2626; font-weight: bold; }
        .status-cancelled { color: #6B7280; text-decoration: line-through; }
      </style>
    `;

    const getStatusClass = (s) => `status-${s || 'unpaid'}`;
    const getStatusLabel = (s) => {
      const m = { paid: '✅ مدفوع', partial: '⚠️ جزئي', unpaid: '🔴 غير مدفوع', cancelled: '❌ ملغى' };
      return m[s] || s;
    };
    const getMethodLabel = (m) => {
      const map = { cash: '💵 كاش', instapay: '🏦 انستا باي', vodafone_cash: '🔴 فودافون كاش',
                    etisalat_cash: '🟢 اتصالات كاش', orange_cash: '🟠 أورانج كاش', none: '💳 آجل' };
      return map[m] || m;
    };

    // Products lookup
    const products = data.products || {};
    const customers = data.customers || {};
    const suppliers = data.suppliers || {};
    const warehouses = data.warehouses || {};
    const users = data.users || {};

    const getProdName = (id) => products[id]?.name || '—';
    const getCustName = (id) => customers[id]?.name || '—';
    const getSuppName = (id) => suppliers[id]?.name || '—';
    const getWhName = (id) => warehouses[id]?.name || '—';
    const getUserName = (id) => users[id]?.name || '—';

    let html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>${meta.title}</title>
${styles}
</head>
<body>

<div class="doc-header">
  <h1>${company.name || 'Hamouda'}</h1>
  <p>${meta.title} — ${meta.periodLabel}</p>
  <p>📅 تاريخ التصدير: ${fmtDateTime(Date.now())}</p>
  <p>👤 صادر بواسطة: ${currentUser.name}</p>
</div>
`;

    // ==================== فواتير المبيعات ====================
    const salesInv = Object.values(data.sales_invoices || {}).sort((a, b) => b.created_at - a.created_at);
    if (salesInv.length > 0) {
      const totalSales = salesInv.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.grand_total || 0), 0);
      const totalPaid = salesInv.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.paid || 0), 0);
      html += `
      <div class="section-title">💰 فواتير المبيعات (${salesInv.length}) — إجمالي: ${fmtMoney(totalSales)} ج.م — محصل: ${fmtMoney(totalPaid)} ج.م</div>
      <table>
        <thead>
          <tr>
            <th>الرقم</th><th>التاريخ</th><th>العميل</th><th>المخزن</th>
            <th>الأصناف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th>
            <th>طريقة الدفع</th><th>الحالة</th><th>البائع</th><th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${salesInv.map(inv => {
            const itemsCount = (inv.items || []).length;
            const itemsText = (inv.items || []).map(it => {
              const unitName = getProductUnitName(it.product_id) || 'كجم';
              return `${it.product_name_snapshot || getProdName(it.product_id)} (${fmtMoney(it.qty)} ${unitName})`;
            }).join(' • ');
            return `
              <tr>
                <td><strong>${inv.invoice_number || '—'}</strong></td>
                <td>${fmtDate(inv.created_at)}</td>
                <td>${inv.customer_name_snapshot || getCustName(inv.customer_id)}</td>
                <td>${getWhName(inv.warehouse_id)}</td>
                <td title="${itemsText.replace(/"/g, '&quot;')}">${itemsCount} صنف</td>
                <td class="num">${fmtMoney(inv.grand_total)}</td>
                <td class="num">${fmtMoney(inv.paid)}</td>
                <td class="num">${fmtMoney(inv.remaining)}</td>
                <td>${getMethodLabel(inv.payment_method)}</td>
                <td class="${getStatusClass(inv.status)}">${getStatusLabel(inv.status)}</td>
                <td>${inv.created_by_name || getUserName(inv.created_by)}</td>
                <td>${inv.notes || ''}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>`;
    }

    // ==================== فواتير المشتريات ====================
    const purchaseInv = Object.values(data.purchase_invoices || {}).sort((a, b) => b.created_at - a.created_at);
    if (purchaseInv.length > 0) {
      const totalPurch = purchaseInv.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.grand_total || 0), 0);
      html += `
      <div class="section-title">🛒 فواتير المشتريات (${purchaseInv.length}) — إجمالي: ${fmtMoney(totalPurch)} ج.م</div>
      <table>
        <thead>
          <tr>
            <th>الرقم</th><th>التاريخ</th><th>المورد</th><th>المخزن</th>
            <th>الأصناف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th>
            <th>الحالة</th><th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${purchaseInv.map(inv => `
            <tr>
              <td><strong>${inv.invoice_number || '—'}</strong></td>
              <td>${fmtDate(inv.created_at)}</td>
              <td>${inv.supplier_name_snapshot || getSuppName(inv.supplier_id)}</td>
              <td>${getWhName(inv.warehouse_id)}</td>
              <td>${(inv.items || []).length} صنف</td>
              <td class="num">${fmtMoney(inv.grand_total)}</td>
              <td class="num">${fmtMoney(inv.paid)}</td>
              <td class="num">${fmtMoney(inv.remaining)}</td>
              <td class="${getStatusClass(inv.status)}">${getStatusLabel(inv.status)}</td>
              <td>${inv.notes || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    }

    // ==================== المدفوعات ====================
    const payments = Object.values(data.payments || {}).sort((a, b) => b.created_at - a.created_at);
    if (payments.length > 0) {
      const totalPay = payments.reduce((s, p) => s + (p.amount || 0), 0);
      html += `
      <div class="section-title">💵 المدفوعات (${payments.length}) — إجمالي: ${fmtMoney(totalPay)} ج.م</div>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>المرجع</th><th>النوع</th><th>المبلغ</th><th>طريقة الدفع</th><th>بواسطة</th><th>ملاحظات</th></tr>
        </thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td>${fmtDate(p.created_at)}</td>
              <td>${p.invoice_number_snapshot || p.reference_id || '—'}</td>
              <td>${p.type === 'payment_in' ? '📥 دخل' : '📤 خارج'}</td>
              <td class="num">${fmtMoney(p.amount)}</td>
              <td>${getMethodLabel(p.method)}</td>
              <td>${getUserName(p.created_by)}</td>
              <td>${p.notes || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    }

    // ==================== المرتجعات ====================
    const salesReturns = Object.values(data.sales_returns || {}).sort((a, b) => b.created_at - a.created_at);
    const purchaseReturns = Object.values(data.purchase_returns || {}).sort((a, b) => b.created_at - a.created_at);
    if (salesReturns.length > 0 || purchaseReturns.length > 0) {
      html += `
      <div class="section-title">🔄 المرتجعات (${salesReturns.length + purchaseReturns.length})</div>
      <table>
        <thead>
          <tr><th>الرقم</th><th>التاريخ</th><th>النوع</th><th>الفاتورة الأصلية</th><th>القيمة</th><th>طريقة الاسترداد</th></tr>
        </thead>
        <tbody>
          ${salesReturns.map(r => `
            <tr>
              <td><strong>${r.return_number}</strong></td>
              <td>${fmtDate(r.created_at)}</td>
              <td>🔴 مرتجع مبيعات</td>
              <td>${r.original_invoice_number || '—'}</td>
              <td class="num">${fmtMoney(r.total_returned)}</td>
              <td>${r.refund_method === 'cash' ? '💵 كاش' : '📉 خصم من الحساب'}</td>
            </tr>
          `).join('')}
          ${purchaseReturns.map(r => `
            <tr>
              <td><strong>${r.return_number}</strong></td>
              <td>${fmtDate(r.created_at)}</td>
              <td>🟢 مرتجع مشتريات</td>
              <td>${r.original_invoice_number || '—'}</td>
              <td class="num">${fmtMoney(r.total_returned)}</td>
              <td>${r.refund_method === 'cash' ? '💵 كاش' : '📉 خصم من الحساب'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    }

    // ==================== العملاء ====================
    const custList = Object.values(customers);
    if (custList.length > 0) {
      const totalDebt = custList.reduce((s, c) => s + (c.cached_total_debt || 0), 0);
      html += `
      <div class="section-title">👥 العملاء (${custList.length}) — إجمالي المديونية: ${fmtMoney(totalDebt)} ج.م</div>
      <table>
        <thead>
          <tr><th>الاسم</th><th>التليفون</th><th>المديونية الحالية</th><th>إجمالي المبيعات</th></tr>
        </thead>
        <tbody>
          ${custList.map(c => `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.phone || '—'}</td>
              <td class="num">${fmtMoney(c.cached_total_debt || 0)}</td>
              <td class="num">${fmtMoney(c.cached_lifetime_sales || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    }

    // ==================== الموردين ====================
    const suppList = Object.values(suppliers);
    if (suppList.length > 0) {
      const totalOwed = suppList.reduce((s, sup) => s + (sup.cached_total_debt_to_them || 0), 0);
      html += `
      <div class="section-title">🏭 الموردين (${suppList.length}) — مستحق لهم: ${fmtMoney(totalOwed)} ج.م</div>
      <table>
        <thead>
          <tr><th>الاسم</th><th>التليفون</th><th>المستحق لهم</th><th>إجمالي المشتريات</th></tr>
        </thead>
        <tbody>
          ${suppList.map(sup => `
            <tr>
              <td><strong>${sup.name}</strong></td>
              <td>${sup.phone || '—'}</td>
              <td class="num">${fmtMoney(sup.cached_total_debt_to_them || 0)}</td>
              <td class="num">${fmtMoney(sup.cached_lifetime_purchases || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    }

    // ==================== الأصناف ====================
    const prodList = Object.values(products);
    if (prodList.length > 0) {
      html += `
      <div class="section-title">🍇 الأصناف (${prodList.length})</div>
      <table>
        <thead>
          <tr><th>الكود</th><th>الاسم</th><th>الوحدة</th><th>سعر البيع</th><th>الحد الأدنى</th></tr>
        </thead>
        <tbody>
          ${prodList.map(p => `
            <tr>
              <td>${p.sku || '—'}</td>
              <td><strong>${p.name}</strong></td>
              <td>${getProductUnitName(p)}</td>
              <td class="num">${fmtMoney(p.default_sale_price || 0)}</td>
              <td class="num">${fmtMoney(p.min_stock || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    }

    html += `
      <div style="text-align:center; padding:20px; margin-top:30px; color:#6B7280; font-size:11px; border-top:1px dashed #C4B5FD;">
        <div style="font-size:10px; color:#6D28D9; letter-spacing:1.5px; font-weight:700;">DESIGNED BY</div>
        <div style="font-size:16px; font-weight:900; color:#1E40AF; letter-spacing:2px; margin-top:4px;">MG APPHOUSE</div>
        <div style="font-size:11px; color:#5B21B6; margin-top:6px; font-weight:600;">Programmer &amp; Developer</div>
        <div style="font-size:13px; color:#4C1D95; margin-top:2px; font-weight:800;">Mahmoud Gamal Eldeen</div>
        <div style="font-size:12px; color:#6D28D9; margin-top:4px; font-weight:700;">📞 01508613866</div>
      </div>
    </body>
    </html>`;

    return html;
  },

  importBackup() {
    const fileInput = document.getElementById('backup_file');
    if (!fileInput.files.length) {
      return showNotif('❌ اختار الملف الأول', 'danger');
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result);

        if (!backup.version || !backup.data) {
          return showNotif('❌ ملف غير صالح', 'danger');
        }

        const stats = {
          sales: Object.keys(backup.data.sales_invoices || {}).length,
          purchases: Object.keys(backup.data.purchase_invoices || {}).length,
          products: Object.keys(backup.data.products || {}).length,
          customers: Object.keys(backup.data.customers || {}).length
        };

        const confirmMsg = `⚠️ استرجاع النسخة الاحتياطية؟

📅 تاريخ النسخة: ${fmtDateTime(backup.created_at)}
👤 من: ${backup.created_by_name || '—'}
🏢 الشركة: ${backup.company || '—'}

📊 المحتوى:
- ${stats.sales} فاتورة بيع
- ${stats.purchases} فاتورة شراء
- ${stats.products} صنف
- ${stats.customers} عميل

⚠️ كل البيانات الحالية هتتستبدل!`;

        if (!confirm(confirmMsg)) return;

        // ✅ Password via modal instead of prompt
        this.showPasswordConfirmModal({
          title: '🔐 تأكيد استرجاع النسخة الاحتياطية',
          description: 'كل البيانات الحالية هتتستبدل بمحتوى الملف. متأكد؟',
          severity: 'warning',
          onConfirm: () => {
            // Import
            Object.keys(backup.data).forEach(key => {
              LocalStore.set(key, backup.data[key]);
            });

            logActivity('import_backup', 'settings', 'restore', 'استرجاع نسخة احتياطية');
            showNotif('✅ تم الاسترجاع - سيتم إعادة تحميل الصفحة', 'success', 3000);
            setTimeout(() => location.reload(), 2000);
          }
        });

      } catch (err) {
        console.error(err);
        showNotif('❌ خطأ في قراءة الملف: ' + err.message, 'danger');
      }
    };
    reader.readAsText(file);
  },

  previewArchive() {
    const from = new Date(document.getElementById('archive_from').value).getTime();
    const to = new Date(document.getElementById('archive_to').value).getTime() + 86400000 - 1;

    if (!from || !to || from >= to) {
      return showNotif('❌ حدد فترة صحيحة', 'danger');
    }

    const sales = Object.values(LocalStore.get('sales_invoices') || {})
      .filter(inv => inv.created_at >= from && inv.created_at <= to);
    const purchases = Object.values(LocalStore.get('purchase_invoices') || {})
      .filter(inv => inv.created_at >= from && inv.created_at <= to);
    const txns = Object.values(LocalStore.get('inventory_txns') || {})
      .filter(t => t.created_at >= from && t.created_at <= to);
    const payments = Object.values(LocalStore.get('payments') || {})
      .filter(p => p.created_at >= from && p.created_at <= to);
    const salesReturns = Object.values(LocalStore.get('sales_returns') || {})
      .filter(r => r.created_at >= from && r.created_at <= to);
    const purchaseReturns = Object.values(LocalStore.get('purchase_returns') || {})
      .filter(r => r.created_at >= from && r.created_at <= to);

    const totalSales = sales.reduce((sum, i) => sum + i.grand_total, 0);
    const totalPurchases = purchases.reduce((sum, i) => sum + i.grand_total, 0);

    document.getElementById('archivePreview').innerHTML = `
      <div class="card" style="background:#F0FDF4; border:1px solid var(--leaf-400);">
        <div style="font-weight:700; color:var(--leaf-700); margin-bottom:12px;">
          👁️ معاينة الأرشيف
        </div>
        <div class="grid grid-3" style="gap:8px;">
          <div style="padding:10px; background:white; border-radius:var(--radius);">
            <div style="font-size:12px; color:var(--gray-500);">فواتير البيع</div>
            <div style="font-weight:700; font-size:20px;">${sales.length}</div>
            <div style="font-size:12px; color:var(--grape-700);">${fmtMoney(totalSales)} ج.م</div>
          </div>
          <div style="padding:10px; background:white; border-radius:var(--radius);">
            <div style="font-size:12px; color:var(--gray-500);">فواتير الشراء</div>
            <div style="font-weight:700; font-size:20px;">${purchases.length}</div>
            <div style="font-size:12px; color:var(--grape-700);">${fmtMoney(totalPurchases)} ج.م</div>
          </div>
          <div style="padding:10px; background:white; border-radius:var(--radius);">
            <div style="font-size:12px; color:var(--gray-500);">حركات مخزون</div>
            <div style="font-weight:700; font-size:20px;">${txns.length}</div>
          </div>
          <div style="padding:10px; background:white; border-radius:var(--radius);">
            <div style="font-size:12px; color:var(--gray-500);">مدفوعات</div>
            <div style="font-weight:700; font-size:20px;">${payments.length}</div>
          </div>
          <div style="padding:10px; background:white; border-radius:var(--radius);">
            <div style="font-size:12px; color:var(--gray-500);">مرتجعات بيع</div>
            <div style="font-weight:700; font-size:20px;">${salesReturns.length}</div>
          </div>
          <div style="padding:10px; background:white; border-radius:var(--radius);">
            <div style="font-size:12px; color:var(--gray-500);">مرتجعات شراء</div>
            <div style="font-weight:700; font-size:20px;">${purchaseReturns.length}</div>
          </div>
        </div>
      </div>
    `;
  },

  downloadAndArchive() {
    const from = new Date(document.getElementById('archive_from').value).getTime();
    const to = new Date(document.getElementById('archive_to').value).getTime() + 86400000 - 1;

    if (!from || !to || from >= to) {
      return showNotif('❌ حدد فترة صحيحة', 'danger');
    }

    // Save for callback
    this._pendingArchive = { from, to };

    this.showPasswordConfirmModal({
      title: '🗄️ أرشفة فواتير الفترة',
      description: `هيتم تصدير الفواتير من ${fmtDate(from)} إلى ${fmtDate(to)} كملف + مسحها من الجهاز.`,
      confirmWord: 'أرشف',
      severity: 'danger',
      onConfirm: () => this._performArchive(from, to)
    });
  },

  _performArchive(from, to) {
    // Filter data
    const salesInv = LocalStore.get('sales_invoices') || {};
    const purchaseInv = LocalStore.get('purchase_invoices') || {};
    const txns = LocalStore.get('inventory_txns') || {};
    const payments = LocalStore.get('payments') || {};
    const salesRet = LocalStore.get('sales_returns') || {};
    const purchaseRet = LocalStore.get('purchase_returns') || {};

    const archive = {
      version: '1.0',
      type: 'partial_archive',
      period: { from: from, to: to },
      created_at: Date.now(),
      created_by: currentUser._id,
      created_by_name: currentUser.name,
      company: LocalStore.get('settings/company')?.name || 'Hamouda',
      master_data: {
        customers: LocalStore.get('customers'),
        suppliers: LocalStore.get('suppliers'),
        products: LocalStore.get('products'),
        warehouses: LocalStore.get('warehouses'),
        users: LocalStore.get('users')
      },
      data: {
        sales_invoices: {},
        purchase_invoices: {},
        inventory_txns: {},
        payments: {},
        sales_returns: {},
        purchase_returns: {}
      }
    };

    // Collect + remove
    let archivedCount = 0;
    Object.entries(salesInv).forEach(([id, inv]) => {
      if (inv.created_at >= from && inv.created_at <= to) {
        archive.data.sales_invoices[id] = inv;
        delete salesInv[id];
        archivedCount++;
      }
    });
    Object.entries(purchaseInv).forEach(([id, inv]) => {
      if (inv.created_at >= from && inv.created_at <= to) {
        archive.data.purchase_invoices[id] = inv;
        delete purchaseInv[id];
        archivedCount++;
      }
    });
    Object.entries(txns).forEach(([id, t]) => {
      if (t.created_at >= from && t.created_at <= to) {
        archive.data.inventory_txns[id] = t;
        delete txns[id];
      }
    });
    Object.entries(payments).forEach(([id, p]) => {
      if (p.created_at >= from && p.created_at <= to) {
        archive.data.payments[id] = p;
        delete payments[id];
      }
    });
    Object.entries(salesRet).forEach(([id, r]) => {
      if (r.created_at >= from && r.created_at <= to) {
        archive.data.sales_returns[id] = r;
        delete salesRet[id];
      }
    });
    Object.entries(purchaseRet).forEach(([id, r]) => {
      if (r.created_at >= from && r.created_at <= to) {
        archive.data.purchase_returns[id] = r;
        delete purchaseRet[id];
      }
    });

    if (archivedCount === 0) {
      return showNotif('⚠️ لا توجد فواتير في هذه الفترة', 'warning');
    }

    const fromStr = new Date(from).toISOString().slice(0,10);
    const toStr = new Date(to).toISOString().slice(0,10);

    // 1️⃣ Download JSON (للاسترجاع الفني)
    const json = JSON.stringify(archive, null, 2);
    this._downloadFile(json, `hamouda_archive_${fromStr}_to_${toStr}.json`, 'application/json');

    // 2️⃣ Download Excel (للمحاسب - قابل للقراءة)
    setTimeout(() => {
      const company = LocalStore.get('settings/company') || DEFAULT_COMPANY;
      // نضمن master_data في الـ backup لتفسير IDs
      const excelBackup = {
        data: {
          ...archive.data,
          products: archive.master_data.products || {},
          customers: archive.master_data.customers || {},
          suppliers: archive.master_data.suppliers || {},
          warehouses: archive.master_data.warehouses || {},
          users: archive.master_data.users || {}
        }
      };
      const html = this._buildBackupExcelHTML(excelBackup, company, {
        title: 'أرشيف فترة',
        periodLabel: `من ${fmtDate(from)} إلى ${fmtDate(to)}`
      });
      this._downloadFile(
        html,
        `hamouda_archive_${fromStr}_to_${toStr}.xls`,
        'application/vnd.ms-excel'
      );
    }, 500);

    // Save the reduced data back
    LocalStore.set('sales_invoices', salesInv);
    LocalStore.set('purchase_invoices', purchaseInv);
    LocalStore.set('inventory_txns', txns);
    LocalStore.set('payments', payments);
    LocalStore.set('sales_returns', salesRet);
    LocalStore.set('purchase_returns', purchaseRet);

    logActivity('archive_period', 'settings', 'archive', `${fromStr} إلى ${toStr}`, { count: archivedCount });
    showNotif(`✅ تم أرشفة ${archivedCount} فاتورة (تم تحميل JSON + Excel)`, 'success', 4000);

    // Refresh
    this.render();
  },

  viewArchiveFile() {
    const fileInput = document.getElementById('archive_view_file');
    if (!fileInput.files.length) {
      return showNotif('❌ اختار الملف الأول', 'danger');
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const archive = JSON.parse(e.target.result);
        if (!archive.version) {
          return showNotif('❌ ملف غير صالح', 'danger');
        }

        const isFull = archive.type === 'full_backup';
        const sales = Object.values(archive.data?.sales_invoices || {});
        const purchases = Object.values(archive.data?.purchase_invoices || {});
        const totalSales = sales.reduce((sum, i) => sum + (i.grand_total || 0), 0);
        const totalPurchases = purchases.reduce((sum, i) => sum + (i.grand_total || 0), 0);

        const period = archive.period
          ? `من ${fmtDate(archive.period.from)} إلى ${fmtDate(archive.period.to)}`
          : 'نسخة كاملة';

        document.getElementById('archiveViewResult').innerHTML = `
          <div class="card" style="background:#EDE9FE; border:1px solid var(--grape-400);">
            <div style="font-weight:700; color:var(--grape-700); margin-bottom:12px; font-size:15px;">
              📦 محتوى الملف
            </div>

            <div style="margin-bottom:12px; padding:10px; background:white; border-radius:var(--radius); font-size:13px;">
              <div><strong>النوع:</strong> ${isFull ? 'نسخة احتياطية كاملة' : 'أرشيف فترة'}</div>
              <div><strong>الفترة:</strong> ${period}</div>
              <div><strong>تاريخ التصدير:</strong> ${fmtDateTime(archive.created_at)}</div>
              <div><strong>صادر بواسطة:</strong> ${archive.created_by_name || '—'}</div>
              <div><strong>الشركة:</strong> ${archive.company || '—'}</div>
            </div>

            <div class="grid grid-2" style="gap:8px; margin-bottom:12px;">
              <div style="padding:10px; background:white; border-radius:var(--radius);">
                <div style="font-size:12px; color:var(--gray-500);">فواتير البيع</div>
                <div style="font-weight:700; font-size:20px;">${sales.length}</div>
                <div style="font-size:12px; color:var(--grape-700);">${fmtMoney(totalSales)} ج.م</div>
              </div>
              <div style="padding:10px; background:white; border-radius:var(--radius);">
                <div style="font-size:12px; color:var(--gray-500);">فواتير الشراء</div>
                <div style="font-weight:700; font-size:20px;">${purchases.length}</div>
                <div style="font-size:12px; color:var(--grape-700);">${fmtMoney(totalPurchases)} ج.م</div>
              </div>
            </div>

            ${sales.length > 0 ? `
              <div style="max-height:300px; overflow-y:auto; background:white; border-radius:var(--radius);">
                <table style="width:100%; font-size:12px;">
                  <thead style="position:sticky; top:0; background:var(--gray-100);">
                    <tr><th>الرقم</th><th>التاريخ</th><th>الإجمالي</th></tr>
                  </thead>
                  <tbody>
                    ${sales.slice(0, 100).map(inv => `
                      <tr>
                        <td>${inv.invoice_number || '—'}</td>
                        <td>${fmtDate(inv.created_at)}</td>
                        <td>${fmtMoney(inv.grand_total)} ج.م</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                ${sales.length > 100 ? `<div style="text-align:center; padding:8px; color:var(--gray-500); font-size:12px;">... ${sales.length - 100} أخرى</div>` : ''}
              </div>
            ` : ''}

            <div style="padding:10px; background:#FEF3C7; border-radius:var(--radius); margin-top:12px; font-size:12px;">
              💡 <strong>ملحوظة:</strong> ده عرض للاطلاع فقط. لو عاوز ترجع البيانات فعلياً، استخدم "📥 استرجاع من ملف احتياطي" في الأعلى.
            </div>
          </div>
        `;
        showNotif('✅ تم تحميل الأرشيف للمعاينة', 'success');
      } catch (err) {
        showNotif('❌ خطأ: ' + err.message, 'danger');
      }
    };
    reader.readAsText(file);
  },

  // ==========================================================
  // Shared Password Confirmation Modal
  // ==========================================================
  showPasswordConfirmModal(config) {
    // config = { title, description, confirmWord, severity, onConfirm }
    const severityColors = {
      danger: { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B' },
      warning: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' }
    };
    const colors = severityColors[config.severity || 'danger'];

    const modalHtml = `
      <div id="pwdConfirmModal" class="modal-overlay">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3>${config.title}</h3>
            <button class="modal-close" onclick="SettingsModule.closePasswordConfirm()">✕</button>
          </div>
          <div class="modal-body">
            <div style="padding:12px; background:${colors.bg}; border:2px solid ${colors.border}; border-radius:var(--radius); margin-bottom:16px; font-size:13px; color:${colors.text};">
              ⚠️ <strong>تنبيه:</strong> ${config.description}
            </div>

            <div class="form-group">
              <label>🔐 كلمة سر الأدمن *</label>
              <input type="password" id="pwd_confirm_input" placeholder="كلمة السر بتاعتك" autocomplete="current-password">
              <small class="hint">أدخل كلمة السر بتاعت حسابك الحالي (${currentUser.name})</small>
            </div>

            ${config.confirmWord ? `
              <div class="form-group">
                <label>✍️ اكتب الكلمة التالية للتأكيد النهائي:</label>
                <div style="padding:12px; background:var(--gray-100); border-radius:var(--radius); margin-bottom:8px; text-align:center; font-size:20px; font-weight:800; color:var(--danger);">
                  ${config.confirmWord}
                </div>
                <input type="text" id="pwd_confirm_word" placeholder="اكتب الكلمة أعلاه بالظبط" autocomplete="off">
              </div>
            ` : ''}

            <div id="pwd_confirm_error" style="display:none; padding:10px; background:#FEE2E2; color:#991B1B; border-radius:var(--radius); font-size:13px; margin-top:8px;"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="SettingsModule.closePasswordConfirm()">إلغاء</button>
            <button class="btn btn-danger" onclick="SettingsModule.executePasswordConfirm()">
              ✅ تأكيد ومتابعة
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('pwdConfirmModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Save config for later
    this._pwdConfirmConfig = config;

    // Focus input
    setTimeout(() => document.getElementById('pwd_confirm_input')?.focus(), 100);
  },

  closePasswordConfirm() {
    document.getElementById('pwdConfirmModal')?.remove();
    this._pwdConfirmConfig = null;
  },

  executePasswordConfirm() {
    const errorDiv = document.getElementById('pwd_confirm_error');
    const showError = (msg) => {
      errorDiv.textContent = msg;
      errorDiv.style.display = 'block';
    };

    try {
      const config = this._pwdConfirmConfig;
      if (!config) {
        return showError('❌ خطأ داخلي - أعد فتح النافذة');
      }

      const password = document.getElementById('pwd_confirm_input').value;
      if (!password) return showError('❌ أدخل كلمة السر');

      // ✅ اقرأ الباسورد من users store مباشرة (مش من session)
      const users = LocalStore.get('users') || {};
      const freshUser = users[currentUser._id];

      if (!freshUser) {
        console.error('❌ user not found in store:', currentUser._id);
        return showError('❌ خطأ - المستخدم الحالي غير موجود في السجلات');
      }

      if (!freshUser.password_hash) {
        console.error('❌ user has no password_hash:', freshUser);
        return showError('❌ خطأ - المستخدم ما عندوش باسورد محفوظ');
      }

      // Hash & compare
      let inputHash;
      try {
        inputHash = hashPassword(password);
      } catch (e) {
        console.error('❌ hashPassword failed:', e);
        return showError('❌ خطأ في تشفير كلمة السر - جرب Ctrl+Shift+R لتحديث الصفحة');
      }

      if (inputHash !== freshUser.password_hash) {
        console.warn('Password mismatch');
        return showError('❌ كلمة السر غير صحيحة');
      }

      // Confirm word check
      if (config.confirmWord) {
        const word = document.getElementById('pwd_confirm_word').value.trim();
        if (word !== config.confirmWord) {
          return showError(`❌ اكتب الكلمة "${config.confirmWord}" بالظبط`);
        }
      }

      // ✅ Everything passed - execute the callback
      this.closePasswordConfirm();

      // Call the actual action
      if (typeof config.onConfirm === 'function') {
        try {
          config.onConfirm();
        } catch (e) {
          console.error('❌ onConfirm callback failed:', e);
          showNotif('❌ حصل خطأ أثناء التنفيذ: ' + e.message, 'danger', 6000);
        }
      }
    } catch (e) {
      console.error('❌ executePasswordConfirm failed:', e);
      showError('❌ خطأ غير متوقع: ' + e.message);
    }
  },

  // ==========================================================
  // Tab: Danger Zone
  // ==========================================================
  renderDangerTab() {
    if (currentUser.role !== 'admin') {
      return '<div class="card"><div style="text-align:center; padding:40px; color:var(--gray-500);">⛔ للأدمن فقط</div></div>';
    }

    const stats = {
      sales: Object.keys(LocalStore.get('sales_invoices') || {}).length,
      purchases: Object.keys(LocalStore.get('purchase_invoices') || {}).length,
      transactions: Object.keys(LocalStore.get('inventory_txns') || {}).length,
      payments: Object.keys(LocalStore.get('payments') || {}).length,
      returns: Object.keys(LocalStore.get('sales_returns') || {}).length + Object.keys(LocalStore.get('purchase_returns') || {}).length
    };

    return `
      <div class="card" style="border:2px solid var(--danger); background:#FEF2F2;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <div style="font-size:48px;">⚠️</div>
          <div>
            <div style="font-weight:800; font-size:18px; color:#991B1B;">منطقة الخطر</div>
            <div style="font-size:13px; color:#7F1D1D;">
              العمليات هنا لا يمكن التراجع عنها. اعمل نسخة احتياطية أولاً!
            </div>
          </div>
        </div>

        <div style="padding:12px; background:white; border-radius:var(--radius); margin-bottom:16px; font-size:13px;">
          💡 <strong>نصيحة:</strong> قبل أي عملية حذف، اعمل "📤 نسخة احتياطية كاملة" من tab "🗂️ الأرشيف".
        </div>

        <!-- Delete All Invoices -->
        <div style="padding:16px; background:white; border:2px solid var(--danger); border-radius:var(--radius); margin-bottom:16px;">
          <div style="font-weight:700; font-size:16px; color:#991B1B; margin-bottom:8px;">
            🗑️ مسح كل الفواتير والحركات
          </div>
          <div style="font-size:13px; color:var(--gray-700); margin-bottom:12px;">
            هيتم مسح:
            <div style="margin-top:6px; padding:8px; background:var(--gray-50); border-radius:var(--radius);">
              • <strong>${stats.sales}</strong> فاتورة بيع<br>
              • <strong>${stats.purchases}</strong> فاتورة شراء<br>
              • <strong>${stats.transactions}</strong> حركة مخزون<br>
              • <strong>${stats.payments}</strong> دفعة<br>
              • <strong>${stats.returns}</strong> مرتجع
            </div>
            <div style="margin-top:8px; color:var(--leaf-700); font-weight:600;">
              ✅ الأصناف والعملاء والموردين والمخازن والمستخدمين والإعدادات مش هتتشال
            </div>
          </div>
          <button class="btn btn-danger btn-lg" style="width:100%;" onclick="SettingsModule.deleteAllInvoices()">
            🗑️ مسح كل الفواتير والحركات
          </button>
        </div>

        <!-- Reset Everything -->
        <div style="padding:16px; background:white; border:2px solid var(--danger); border-radius:var(--radius);">
          <div style="font-weight:700; font-size:16px; color:#991B1B; margin-bottom:8px;">
            💣 إعادة تعيين كاملة (المسح النهائي)
          </div>
          <div style="font-size:13px; color:var(--gray-700); margin-bottom:12px;">
            هيتم مسح <strong>كل بيانات النظام</strong> بما فيها الأصناف والعملاء والموردين والمستخدمين، والرجوع لصفحة التثبيت من الصفر.
          </div>
          <button class="btn btn-danger btn-lg" style="width:100%; background:#7F1D1D;" onclick="SettingsModule.factoryReset()">
            💣 إعادة تعيين المصنع (مسح كل شيء)
          </button>
        </div>
      </div>
    `;
  },

  deleteAllInvoices() {
    this.showPasswordConfirmModal({
      title: '🗑️ مسح كل الفواتير',
      description: 'هيتم مسح كل الفواتير والحركات والمدفوعات نهائياً. الأصناف والعملاء والموردين والمخازن هتفضل موجودة.',
      confirmWord: 'امسح الفواتير',
      severity: 'danger',
      onConfirm: () => this._performDeleteAllInvoices()
    });
  },

  _performDeleteAllInvoices() {
    const stats = {
      sales: Object.keys(LocalStore.get('sales_invoices') || {}).length,
      purchases: Object.keys(LocalStore.get('purchase_invoices') || {}).length,
      transactions: Object.keys(LocalStore.get('inventory_txns') || {}).length,
      payments: Object.keys(LocalStore.get('payments') || {}).length
    };

    LocalStore.set('sales_invoices', {});
    LocalStore.set('purchase_invoices', {});
    LocalStore.set('inventory_txns', {});
    LocalStore.set('payments', {});
    LocalStore.set('sales_returns', {});
    LocalStore.set('purchase_returns', {});

    const products = LocalStore.get('products') || {};
    const warehouses = LocalStore.get('warehouses') || {};
    const inventory = {};
    Object.keys(warehouses).forEach(whId => {
      inventory[whId] = {};
      Object.keys(products).forEach(pid => {
        inventory[whId][pid] = {
          current_stock: 0, reserved: 0, average_cost: 0,
          last_purchase_cost: 0, stock_value: 0, last_updated: Date.now()
        };
      });
    });
    LocalStore.set('inventory_cache', inventory);

    // Reset counters - المسح بيبدأ من صفر مع النظام الجديد
    LocalStore.set('counters', {});
    LocalStore.set('_cloud_pending', []);
    if (typeof CloudSync !== 'undefined') {
      CloudSync.pendingUploads = [];
      CloudSync.updateUI();
    }

    const customers = LocalStore.get('customers') || {};
    Object.keys(customers).forEach(cid => {
      customers[cid].cached_total_debt = 0;
      customers[cid].cached_lifetime_sales = 0;
      customers[cid].cached_lifetime_returns = 0;
    });
    LocalStore.set('customers', customers);

    const suppliers = LocalStore.get('suppliers') || {};
    Object.keys(suppliers).forEach(sid => {
      suppliers[sid].cached_total_debt_to_them = 0;
      suppliers[sid].cached_lifetime_purchases = 0;
    });
    LocalStore.set('suppliers', suppliers);

    // ☁️ مسح الفواتير من Firebase كمان
    if (typeof CloudSync !== 'undefined' && CloudSync.isInitialized && CloudSync.isOnline && CloudSync.db) {
      const cloudPathsToClear = [
        'sales_invoices', 'purchase_invoices',
        'inventory_txns', 'payments',
        'sales_returns', 'purchase_returns',
        'counters'
      ];

      Promise.all(cloudPathsToClear.map(path =>
        CloudSync.db.ref(path).set(null).catch(e => console.warn(`Failed to clear ${path}:`, e))
      )).then(() => {
        console.log('✅ Cloud invoices cleared');
      });
    }

    logActivity('delete_all_invoices', 'danger', 'delete', 'مسح كل الفواتير', stats);
    showNotif(`✅ تم مسح ${stats.sales + stats.purchases} فاتورة و ${stats.transactions} حركة و ${stats.payments} دفعة`, 'success', 5000);

    setTimeout(() => {
      showNotif('🔄 جاري إعادة تحميل الصفحة...', 'info');
      setTimeout(() => location.reload(), 2000);
    }, 3000);
  },

  factoryReset() {
    const companyName = LocalStore.get('settings/company')?.name || 'الشركة';
    this.showPasswordConfirmModal({
      title: '💣 إعادة تعيين المصنع',
      description: `⚠️ هيتم مسح كل بيانات النظام (${companyName}) بما فيها الأصناف والعملاء والموردين والمستخدمين، والرجوع لصفحة التثبيت من الصفر.\n\n☁️ هيتم المسح من السحابة كمان (من كل الأجهزة)!`,
      confirmWord: 'امسح كل شيء',
      severity: 'danger',
      onConfirm: () => this._performFactoryReset()
    });
  },

  async _performFactoryReset() {
    showNotif('⏳ جاري المسح الشامل...', 'info', 5000);

    // ☁️ مسح من السحابة أولاً (لو متصل)
    let cloudCleared = false;
    if (typeof CloudSync !== 'undefined' && CloudSync.isInitialized && CloudSync.isOnline && CloudSync.db) {
      try {
        // امسح كل شيء من Firebase (root)
        await CloudSync.db.ref('/').set(null);
        cloudCleared = true;
        console.log('✅ Firebase data cleared');
      } catch(e) {
        console.error('Firebase clear failed:', e);
        // نكمل حتى لو فشل مسح السحابة
      }
    }

    // 🗑️ مسح البيانات المحلية
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('hamouda_'));
      keys.forEach(k => localStorage.removeItem(k));

      // امسح pending queue من CloudSync
      if (typeof CloudSync !== 'undefined') {
        CloudSync.pendingUploads = [];
      }
    } catch(e) {
      console.error('Local reset failed:', e);
      return showNotif('❌ فشل الحذف: ' + e.message, 'danger');
    }

    if (cloudCleared) {
      showNotif('✅ تم المسح من الجهاز والسحابة - جاري إعادة التشغيل', 'success', 3000);
    } else {
      showNotif('✅ تم المسح المحلي (السحابة مش متصلة) - جاري إعادة التشغيل', 'warning', 3000);
    }

    setTimeout(() => location.reload(), 2500);
  }
};
