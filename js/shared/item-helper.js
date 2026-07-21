// ==========================================================
// Invoice Item Helper - Shared بين المبيعات والمشتريات
// ==========================================================
// كل item ممكن يكون:
// 1. Cartons: عدد الكراتين × وزن الكرتونة × سعر الكيلو
// 2. Weight (ميزان): (إجمالي الميزان - فارغ البسكول) × سعر الكيلو
// ==========================================================

const ItemHelper = {

  // إنشاء item جديد فاضي
  newItem() {
    return {
      product_id: '',
      unit_type: 'cartons',        // cartons | weight
      // Cartons fields
      cartons_count: 0,
      carton_weight: 10,           // 10 كيلو افتراضي
      // Weight fields
      car_number: '',
      total_weight: 0,
      empty_weight: 0,
      // Common
      qty: 0,                      // بالكيلو دائماً (للمخزون)
      unit_price: 0,               // سعر الكيلو
      total: 0,
      bayan: ''                    // البيان
    };
  },

  // احسب الكمية (بالكيلو) والإجمالي
  compute(item) {
    if (item.unit_type === 'cartons') {
      const cw = Number(item.carton_weight) || 0;
      const count = Number(item.cartons_count) || 0;
      if (cw === 0) {
        // وضع "بلا وزن" - كل كرتونة = وحدة (بدون ضرب في الوزن)
        // الحساب: عدد الكراتين × سعر الكيلو (السعر هنا سعر الكرتونة نفسها)
        item.qty = count;
        item.total = count * (Number(item.unit_price) || 0);
        return item;
      }
      item.qty = count * cw;
    } else {
      item.qty = Math.max(0, (Number(item.total_weight) || 0) - (Number(item.empty_weight) || 0));
    }
    item.total = item.qty * (Number(item.unit_price) || 0);
    return item;
  },

  // Render item card (form)
  renderCard(item, idx, options = {}) {
    const {
      moduleName = 'SalesModule',       // SalesModule | PurchasesModule
      showStock = false,                // عرض الرصيد المتاح
      warehouseId = null,               // للحصول على الرصيد
      priceLabel = 'سعر الكيلو'
    } = options;

    const products = Object.values(LocalStore.get('products') || {}).filter(p => p.active !== false);

    // معلومات الرصيد
    let stockInfo = '';
    if (showStock && item.product_id && warehouseId) {
      const inv = TxnEngine.getInventory(warehouseId, item.product_id);
      const isEnough = inv.current_stock >= (item.qty || 0);
      const stockUnit = getProductUnitName(item.product_id) || 'كجم';
      stockInfo = `
        <div class="js-item-stock" style="font-size:11px; color:${isEnough ? 'var(--leaf-700)' : 'var(--danger)'}; margin-top:4px;">
          ${isEnough ? '✅' : '⚠️'} المتاح في المخزن: ${fmtMoney(inv.current_stock)} ${stockUnit}
        </div>
      `;
    }

    return `
      <div class="invoice-item-card" data-item-idx="${idx}" data-module="${moduleName}">
        <!-- Header -->
        <div class="item-card-header">
          <div class="item-num">${idx + 1}</div>
          <div style="flex:1;">
            <label style="font-size:12px; color:var(--gray-600);">الصنف</label>
            <select onchange="${moduleName}.updateItem(${idx}, 'product_id', this.value)">
              <option value="">اختر صنف...</option>
              ${products.map(p => `
                <option value="${p._id}" ${item.product_id === p._id ? 'selected' : ''}>
                  ${p.sku} — ${p.name}
                </option>
              `).join('')}
            </select>
            ${stockInfo}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="${moduleName}.removeFormItem(${idx})"
                  style="color:var(--danger); align-self:flex-start;">🗑️</button>
        </div>

        <!-- Unit Type Toggle -->
        ${(() => {
          const vesselName = item.product_id ? getProductUnitName(item.product_id) : 'كرتونة';
          const isWeightBased = item.product_id ? isWeightBasedProduct(item.product_id) : true;
          const finalVessel = isWeightBased ? 'كرتونة' : vesselName;
          const vesselIcon = isWeightBased ? '📦' : (vesselName === 'برميل' ? '🛢️' : vesselName === 'شيكارة' ? '🎒' : '📦');
          return `
            <div class="unit-type-toggle">
              <label class="unit-type-option ${item.unit_type === 'cartons' ? 'selected' : ''}">
                <input type="radio" name="unit_type_${idx}" value="cartons"
                       ${item.unit_type === 'cartons' ? 'checked' : ''}
                       onchange="${moduleName}.updateItem(${idx}, 'unit_type', 'cartons')">
                <span>${vesselIcon} ${finalVessel}</span>
              </label>
              <label class="unit-type-option ${item.unit_type === 'weight' ? 'selected' : ''}">
                <input type="radio" name="unit_type_${idx}" value="weight"
                       ${item.unit_type === 'weight' ? 'checked' : ''}
                       onchange="${moduleName}.updateItem(${idx}, 'unit_type', 'weight')">
                <span>⚖️ ميزان سيارة (طن)</span>
              </label>
            </div>
          `;
        })()}

        ${item.unit_type === 'cartons' ? this.renderCartonsFields(item, idx, moduleName) : this.renderWeightFields(item, idx, moduleName)}

        ${(() => {
          // ✅ الوحدة الأصلية للصنف (product.unit)
          const productUnit = item.product_id ? getProductUnitName(item.product_id) : 'كجم';

          // القاعدة: لو فيه وزن (10/5/مخصص) → بالكيلو دايماً
          //         لو بلا → بوحدة الصنف الأصلية (كرتونة/برميل/شيكارة)
          //         لو الصنف مش وزن (كرتونة/برميل) + كرتونة عادي → لسه بالكيلو (لأن هو حدد وزن)
          const isBala = item.unit_type === 'cartons' && Number(item.carton_weight) === 0;
          const useProductUnit = isBala;

          const dynamicUnitLabel = useProductUnit ? productUnit : 'كجم';
          const dynamicPriceLabel = useProductUnit
            ? priceLabel.replace('الكيلو', productUnit)
            : priceLabel;
          const dynamicQtyLabel = useProductUnit
            ? `الكمية بال${productUnit}:`
            : 'الكمية بالكيلو:';
          return `
            <!-- السعر + البيان -->
            <div class="grid grid-2" style="margin-top: 10px;">
              <div class="form-group" style="margin:0;">
                <label>💰 ${dynamicPriceLabel}</label>
                <input type="number" step="0.01" placeholder="${dynamicPriceLabel}" value="${item.unit_price || ''}"
                       oninput="${moduleName}.updateItem(${idx}, 'unit_price', this.value)">
                <!-- ✅ تنبيه فرق السعر -->
                <div class="js-price-alert" style="margin-top:6px;">
                  ${this.renderPriceAlert(item, moduleName)}
                </div>
              </div>
              <div class="form-group" style="margin:0;">
                <label>📝 البيان</label>
                <input type="text" placeholder="بيان الصنف (اختياري)" value="${item.bayan || ''}"
                       oninput="${moduleName}.updateItem(${idx}, 'bayan', this.value)">
              </div>
            </div>

            <!-- Totals -->
            <div class="item-totals">
              <div>
                <span style="color:var(--gray-500); font-size:13px;">${dynamicQtyLabel}</span>
                <strong style="color:var(--gray-800); margin-right:6px;" class="js-item-qty">${fmtMoney(item.qty || 0)}</strong>
                <span style="color:var(--gray-500); font-size:13px;" class="js-item-unit-label">${dynamicUnitLabel}</span>
              </div>
              <div>
                <span style="color:var(--gray-500); font-size:13px;">الإجمالي:</span>
                <strong style="color:var(--grape-700); font-size:18px; margin-right:6px;" class="js-item-total">
                  ${fmtMoney(item.total || 0)}
                </strong>
                <span style="color:var(--gray-500); font-size:13px;">ج.م</span>
              </div>
            </div>
          `;
        })()}
      </div>
    `;
  },

  // ==========================================================
  // ⭐ تحديث القيم المحسوبة في مكانها بدون إعادة بناء
  // ==========================================================
  // ==========================================================
  // 💡 تنبيه فرق السعر عن آخر مرة
  // ==========================================================
  renderPriceAlert(item, moduleName) {
    if (!item.product_id || !item.unit_price || item.unit_price <= 0) return '';

    // نوع الفاتورة
    const isSales = moduleName === 'SalesModule';
    const type = isSales ? 'sale' : 'purchase';
    const currentPrice = Number(item.unit_price);

    const lastPriceData = getLastPriceForProduct(item.product_id, type);
    if (!lastPriceData) return `
      <div style="padding:6px 10px; background:#EDE9FE; border-radius:6px; font-size:12px; color:var(--grape-700);">
        ℹ️ أول مرة يتم ${isSales ? 'بيع' : 'شراء'} الصنف
      </div>
    `;

    const lastPrice = lastPriceData.price;
    const diff = currentPrice - lastPrice;
    const diffPct = (diff / lastPrice) * 100;

    // مساواة
    if (Math.abs(diff) < 0.01) {
      return `
        <div style="padding:6px 10px; background:#F3F4F6; border-radius:6px; font-size:12px; color:var(--gray-700);">
          ✓ نفس آخر سعر (${fmtMoney(lastPrice)} ج.م) — فاتورة ${lastPriceData.invoice_number}
        </div>
      `;
    }

    // منطق الألوان:
    // - مشتريات: أعلى = أحمر (بتخسر)، أقل = أخضر (بتوفر)
    // - مبيعات: أعلى = أخضر (بتكسب أكتر)، أقل = أحمر (خسرت من ربحك)
    const isUp = diff > 0;
    let color, bg, border, icon, msg;

    if (type === 'purchase') {
      if (isUp) {
        color = '#991B1B'; bg = '#FEE2E2'; border = '#DC2626';
        icon = '🔴';
        msg = `أعلى بـ ${fmtMoney(Math.abs(diff))} ج.م (${Math.abs(diffPct).toFixed(1)}%↑) — الشراء أغلى`;
      } else {
        color = '#065F46'; bg = '#D1FAE5'; border = '#059669';
        icon = '🟢';
        msg = `أقل بـ ${fmtMoney(Math.abs(diff))} ج.م (${Math.abs(diffPct).toFixed(1)}%↓) — وفرت في الشراء`;
      }
    } else { // sales
      if (isUp) {
        color = '#065F46'; bg = '#D1FAE5'; border = '#059669';
        icon = '🟢';
        msg = `أعلى بـ ${fmtMoney(Math.abs(diff))} ج.م (${Math.abs(diffPct).toFixed(1)}%↑) — بتربح أكتر`;
      } else {
        color = '#991B1B'; bg = '#FEE2E2'; border = '#DC2626';
        icon = '🔴';
        msg = `أقل بـ ${fmtMoney(Math.abs(diff))} ج.م (${Math.abs(diffPct).toFixed(1)}%↓) — بعت بأرخص`;
      }
    }

    return `
      <div style="padding:6px 10px; background:${bg}; border:1px solid ${border}; border-radius:6px; font-size:12px; color:${color};">
        <div style="font-weight:700;">${icon} ${msg}</div>
        <div style="font-size:11px; margin-top:2px; opacity:0.85;">
          آخر سعر: ${fmtMoney(lastPrice)} ج.م — فاتورة ${lastPriceData.invoice_number}
        </div>
      </div>
    `;
  },

  updateItemUI(idx, item, options = {}) {
    const { warehouseId = null, showStock = false } = options;
    const card = document.querySelector(`.invoice-item-card[data-item-idx="${idx}"]`);
    if (!card) return;

    // ✅ Detect isBala
    const isBala = item.unit_type === 'cartons' && Number(item.carton_weight) === 0;

    // الكمية
    const qtyEl = card.querySelector('.js-item-qty');
    if (qtyEl) qtyEl.textContent = fmtMoney(item.qty || 0);

    // ✅ الوحدة (كجم أو كرتونة)
    const unitLabelEl = card.querySelector('.js-item-unit-label');
    if (unitLabelEl) unitLabelEl.textContent = isBala ? 'كرتونة' : 'كجم';

    // الإجمالي
    const totalEl = card.querySelector('.js-item-total');
    if (totalEl) totalEl.textContent = fmtMoney(item.total || 0);

    // صافي الميزان (لو ميزان)
    const netEl = card.querySelector('.js-item-net-weight');
    if (netEl) netEl.textContent = fmtMoney(item.qty || 0);

    // إجمالي كيلو الكراتين (لو كرتونة عادي)
    const cartonsKgEl = card.querySelector('.js-item-cartons-kg');
    if (cartonsKgEl) cartonsKgEl.textContent = fmtMoney(item.qty || 0);

    // ✅ تحديث تنبيه فرق السعر
    const priceAlertEl = card.querySelector('.js-price-alert');
    if (priceAlertEl) {
      const moduleName = card.dataset.module;
      if (moduleName) {
        priceAlertEl.innerHTML = this.renderPriceAlert(item, moduleName);
      }
    }

    // الرصيد المتاح
    if (showStock && item.product_id && warehouseId) {
      const stockEl = card.querySelector('.js-item-stock');
      if (stockEl) {
        const inv = TxnEngine.getInventory(warehouseId, item.product_id);
        const isEnough = inv.current_stock >= (item.qty || 0);
        stockEl.style.color = isEnough ? 'var(--leaf-700)' : 'var(--danger)';
        const stockUnit = isBala ? 'كرتونة' : 'كجم';
        stockEl.textContent = `${isEnough ? '✅' : '⚠️'} المتاح في المخزن: ${fmtMoney(inv.current_stock)} ${stockUnit}`;
      }
    }
  },

  // حقول الكرتونة (اسم الوعاء يتغير حسب وحدة الصنف: كرتونة/برميل/شيكارة/إلخ)
  renderCartonsFields(item, idx, moduleName) {
    // Detect current mode
    const cw = item.carton_weight;
    let mode = 'none';
    if (cw == 10) mode = '10';
    else if (cw == 5) mode = '5';
    else if (cw > 0 && cw != 10 && cw != 5) mode = 'custom';
    else if (cw == 0 || cw === '' || cw == null) mode = 'none';

    // ✅ اسم الوعاء ديناميكي حسب وحدة الصنف
    const vesselName = item.product_id ? getProductUnitName(item.product_id) : 'كرتونة';
    const vesselPlural = item.product_id ? getProductUnitPlural(item.product_id) : 'الكراتين';
    // fallback للأصناف اللي وحدتها وزن (كجم/جرام/طن): استخدم "كرتونة"
    const isWeightBased = item.product_id ? isWeightBasedProduct(item.product_id) : true;
    const finalVessel = isWeightBased ? 'كرتونة' : vesselName;
    const finalPlural = isWeightBased ? 'الكراتين' : vesselPlural;

    // Calc qty
    const cartonsInKg = mode === 'none'
      ? (Number(item.cartons_count) || 0)
      : (Number(item.cartons_count) || 0) * (Number(item.carton_weight) || 0);

    return `
      <div class="unit-fields cartons-fields">
        <div class="grid grid-3">
          <div class="form-group" style="margin:0;">
            <label>عدد ${finalPlural}</label>
            <input type="number" step="1" placeholder="عدد ${finalPlural}" value="${item.cartons_count || ''}"
                   oninput="${moduleName}.updateItem(${idx}, 'cartons_count', this.value)">
          </div>
          <div class="form-group" style="margin:0;">
            <label>وزن ال${finalVessel}</label>
            <select onchange="${moduleName}.updateItem(${idx}, 'carton_weight_mode', this.value)">
              <option value="10"     ${mode === '10' ? 'selected' : ''}>10 كيلو</option>
              <option value="5"      ${mode === '5' ? 'selected' : ''}>5 كيلو</option>
              <option value="custom" ${mode === 'custom' ? 'selected' : ''}>مخصص ⚙️</option>
              <option value="none"   ${mode === 'none' ? 'selected' : ''}>ــــ بلا (بدون وزن)</option>
            </select>
          </div>
          ${mode !== 'none' ? `
            <div style="padding:10px; text-align:center; background:#EDE9FE; border-radius:var(--radius);">
              <div style="font-size:11px; color:var(--gray-600);">إجمالي الكيلو</div>
              <div style="font-size:16px; font-weight:800; color:var(--grape-700); margin-top:2px;">
                <span class="js-item-cartons-kg">${fmtMoney(cartonsInKg)}</span> كجم
              </div>
            </div>
          ` : `
            <div style="padding:10px; text-align:center; background:#FEF3C7; border-radius:var(--radius);">
              <div style="font-size:11px; color:var(--gray-600);">وضع: بدون وزن</div>
              <div style="font-size:13px; font-weight:700; color:#92400E; margin-top:2px;">
                السعر × عدد ${finalPlural}
              </div>
            </div>
          `}
        </div>

        ${mode === 'custom' ? `
          <div class="form-group" style="margin-top:10px;">
            <label>⚖️ الوزن المخصص لل${finalVessel} (كجم) *</label>
            <input type="number" step="0.01" min="0" placeholder="مثل: 7، 12، 15..."
                   value="${cw > 0 && cw != 10 && cw != 5 ? cw : ''}"
                   oninput="${moduleName}.updateItem(${idx}, 'carton_weight', this.value)"
                   style="font-size:16px; font-weight:700;">
            <small class="hint">أدخل وزن ال${finalVessel} الفعلي — بيتضرب في العدد × سعر الكيلو</small>
          </div>
        ` : ''}
      </div>
    `;
  },

  // حقول الميزان
  renderWeightFields(item, idx, moduleName) {
    const netWeight = Math.max(0, (Number(item.total_weight) || 0) - (Number(item.empty_weight) || 0));
    return `
      <div class="unit-fields weight-fields">
        <div class="form-group" style="margin-bottom:10px;">
          <label>🚛 رقم السيارة</label>
          <input type="text" placeholder="مثل: أ ب ج 1234" value="${item.car_number || ''}"
                 oninput="${moduleName}.updateItem(${idx}, 'car_number', this.value)">
        </div>
        <div class="grid grid-3">
          <div class="form-group" style="margin:0;">
            <label>إجمالي الميزان (كجم)</label>
            <input type="number" step="0.01" placeholder="إجمالي الميزان" value="${item.total_weight || ''}"
                   oninput="${moduleName}.updateItem(${idx}, 'total_weight', this.value)">
          </div>
          <div class="form-group" style="margin:0;">
            <label>فارغ البسكول (كجم)</label>
            <input type="number" step="0.01" placeholder="فارغ البسكول" value="${item.empty_weight || ''}"
                   oninput="${moduleName}.updateItem(${idx}, 'empty_weight', this.value)">
          </div>
          <div style="padding:10px; text-align:center; background:#F0FDF4; border-radius:var(--radius);">
            <div style="font-size:11px; color:var(--gray-600);">صافي الميزان</div>
            <div style="font-size:16px; font-weight:800; color:var(--leaf-700); margin-top:2px;">
              <span class="js-item-net-weight">${fmtMoney(netWeight)}</span> كجم
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Snapshot للحفظ في الفاتورة
  buildSnapshot(item, product) {
    const snap = {
      product_id: item.product_id,
      product_name_snapshot: product?.name || '',
      sku_snapshot: product?.sku || '',
      unit_type: item.unit_type,
      qty: item.qty,
      unit_price: item.unit_price,
      total: item.total,
      bayan: item.bayan || ''
    };

    if (item.unit_type === 'cartons') {
      snap.cartons_count = Number(item.cartons_count) || 0;
      // ✅ نحفظ carton_weight زي ما هو (بما فيه 0 لوضع بلا) - مش نستبدله بـ 10
      snap.carton_weight = Number(item.carton_weight) || 0;
    } else {
      snap.car_number = item.car_number || '';
      snap.total_weight = Number(item.total_weight) || 0;
      snap.empty_weight = Number(item.empty_weight) || 0;
      snap.net_weight = snap.qty;
    }

    return snap;
  },

  // عرض تفاصيل item في الفاتورة المطبوعة
  renderItemDetail(item) {
    if (item.unit_type === 'cartons') {
      // ✅ اسم الوعاء الصحيح حسب وحدة الصنف
      const productUnit = item.product_id ? getProductUnitName(item.product_id) : 'كرتونة';
      const isWeightBased = item.product_id ? isWeightBasedProduct(item.product_id) : true;
      const vesselName = isWeightBased ? 'كرتونة' : productUnit;

      // Detect وضع "بلا" بأي علامة موجودة
      const isBala = (
        item.display_unit === 'كرتونة' ||
        item.display_unit === productUnit ||
        item.unit_snapshot === 'carton' ||
        Number(item.carton_weight) === 0 ||
        (item.cartons_count > 0 && Number(item.qty) === Number(item.cartons_count))
      );

      if (isBala) {
        return `📦 <strong>${item.cartons_count || 0} ${vesselName}</strong>`;
      }
      return `📦 ${item.cartons_count || 0} ${vesselName} × ${item.carton_weight || 10} كجم = ${fmtMoney(item.qty)} كجم`;
    } else {
      return `
        ⚖️ ${item.car_number ? 'سيارة: ' + item.car_number + ' — ' : ''}
        إجمالي: ${fmtMoney(item.total_weight)} - فارغ: ${fmtMoney(item.empty_weight)} = <strong>${fmtMoney(item.qty)} كجم</strong>
      `;
    }
  }
};
