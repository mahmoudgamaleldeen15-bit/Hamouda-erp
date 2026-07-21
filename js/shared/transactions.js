// ==========================================================
// ⭐ TRANSACTIONS ENGINE - قلب النظام كله
// ==========================================================
// كل حركة على المخزون (شراء/بيع/تسوية/تحويل) لازم تعدي من هنا
// ممنوع منعاً باتاً تعديل inventory/current_stock مباشرة
// ==========================================================

const TxnEngine = {

  // ==========================================================
  // إضافة حركة جديدة
  // ==========================================================
  addTransaction(txnData) {
    const {
      type,          // purchase | sale | sale_cancel | purchase_cancel | adjustment_in | adjustment_out | transfer_in | transfer_out
      warehouse_id,
      product_id,
      quantity,      // موجب دائماً
      unit_cost,     // سعر الشراء (لحساب التكلفة)
      unit_price,    // سعر البيع (لو بيع)
      reference_type, // sales_invoice | purchase_invoice | adjustment | transfer
      reference_id,
      reference_number,
      notes
    } = txnData;

    // Validation
    if (!type || !warehouse_id || !product_id || !quantity) {
      console.error('Invalid transaction data', txnData);
      return { success: false, error: 'بيانات ناقصة' };
    }

    if (quantity <= 0) {
      return { success: false, error: 'الكمية لازم تكون أكبر من صفر' };
    }

    // اقرأ الرصيد الحالي
    const currentInv = this.getInventory(warehouse_id, product_id);
    const stockBefore = currentInv.current_stock;

    // احسب الرصيد الجديد
    const isIncoming = ['purchase', 'sale_cancel', 'adjustment_in', 'transfer_in'].includes(type);
    const isOutgoing = ['sale', 'purchase_cancel', 'adjustment_out', 'transfer_out'].includes(type);

    let stockAfter;
    if (isIncoming) {
      stockAfter = stockBefore + Number(quantity);
    } else if (isOutgoing) {
      stockAfter = stockBefore - Number(quantity);
      if (stockAfter < 0 && !txnData.allow_negative) {
        return {
          success: false,
          error: `الرصيد المتاح: ${stockBefore}. المطلوب: ${quantity}`,
          insufficient_stock: true,
          available: stockBefore
        };
      }
    } else {
      return { success: false, error: 'نوع حركة غير معروف: ' + type };
    }

    // احسب متوسط التكلفة الجديد (لو شراء بس)
    let newAvgCost = currentInv.average_cost;
    if (type === 'purchase' && unit_cost) {
      if (stockBefore > 0) {
        newAvgCost = ((stockBefore * currentInv.average_cost) + (quantity * unit_cost)) / stockAfter;
      } else {
        newAvgCost = unit_cost;
      }
    }

    // خزّن الحركة
    const txnId = genID('txn_');
    const txn = {
      _id: txnId,
      type: type,
      warehouse_id: warehouse_id,
      product_id: product_id,
      quantity: isOutgoing ? -Number(quantity) : Number(quantity),
      unit_cost: unit_cost || currentInv.average_cost,
      unit_price: unit_price || 0,
      reference_type: reference_type || '',
      reference_id: reference_id || '',
      reference_number: reference_number || '',
      stock_before: stockBefore,
      stock_after: stockAfter,
      user_id: currentUser?._id || 'system',
      username: currentUser?.username || 'system',
      timestamp: Date.now(),
      notes: notes || ''
    };

    const txns = LocalStore.get('inventory_txns') || {};
    txns[txnId] = txn;
    LocalStore.set('inventory_txns', txns);

    // حدث الـ inventory cache
    this.updateInventoryCache(warehouse_id, product_id, {
      current_stock: stockAfter,
      average_cost: newAvgCost,
      last_purchase_price: type === 'purchase' ? unit_cost : currentInv.last_purchase_price,
      last_sale_price: type === 'sale' ? unit_price : currentInv.last_sale_price,
      last_updated: Date.now()
    });

    return { success: true, txn_id: txnId, stock_after: stockAfter };
  },

  // ==========================================================
  // اقرأ رصيد صنف في مخزن
  // ==========================================================
  getInventory(warehouse_id, product_id) {
    const inv = LocalStore.get(`inventory/${warehouse_id}/${product_id}`);
    return inv || {
      current_stock: 0,
      average_cost: 0,
      last_purchase_price: 0,
      last_sale_price: 0,
      last_updated: 0
    };
  },

  // ==========================================================
  // حدث الـ cache
  // ==========================================================
  updateInventoryCache(warehouse_id, product_id, data) {
    const current = this.getInventory(warehouse_id, product_id);
    LocalStore.set(`inventory/${warehouse_id}/${product_id}`, { ...current, ...data });
  },

  // ==========================================================
  // اقرأ كل الأرصدة لصنف معين (في كل المخازن)
  // ==========================================================
  getProductStockAllWarehouses(product_id) {
    const warehouses = LocalStore.get('warehouses') || {};
    const result = {};
    let totalStock = 0;

    Object.keys(warehouses).forEach(whId => {
      const inv = this.getInventory(whId, product_id);
      result[whId] = inv.current_stock;
      totalStock += inv.current_stock;
    });

    return { total: totalStock, byWarehouse: result };
  },

  // ==========================================================
  // اقرأ كل الأرصدة لمخزن (كل الأصناف)
  // ==========================================================
  getWarehouseInventory(warehouse_id) {
    const products = LocalStore.get('products') || {};
    const result = [];

    Object.values(products).forEach(product => {
      const inv = this.getInventory(warehouse_id, product._id);
      result.push({
        product_id: product._id,
        product_name: product.name,
        sku: product.sku,
        unit: product.unit,
        current_stock: inv.current_stock,
        average_cost: inv.average_cost,
        stock_value: inv.current_stock * inv.average_cost
      });
    });

    return result;
  },

  // ==========================================================
  // كل الحركات لصنف
  // ==========================================================
  getProductTransactions(product_id, warehouse_id = null) {
    const txns = LocalStore.get('inventory_txns') || {};
    let list = Object.values(txns).filter(t => t.product_id === product_id);
    if (warehouse_id) {
      list = list.filter(t => t.warehouse_id === warehouse_id);
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  },

  // ==========================================================
  // إعادة حساب الرصيد من الحركات (recovery)
  // ==========================================================
  recomputeStock(warehouse_id, product_id) {
    const txns = LocalStore.get('inventory_txns') || {};
    const relevant = Object.values(txns).filter(
      t => t.warehouse_id === warehouse_id && t.product_id === product_id
    );

    const total = relevant.reduce((sum, t) => sum + Number(t.quantity), 0);

    this.updateInventoryCache(warehouse_id, product_id, {
      current_stock: total,
      last_updated: Date.now()
    });

    return total;
  },

  // ==========================================================
  // تحويل بين مخازن (atomic - الاتنين معاً أو مفيش)
  // ==========================================================
  transfer(fromWh, toWh, product_id, quantity, notes) {
    // Snapshot للـ rollback
    const invFromBefore = this.getInventory(fromWh, product_id);
    const invToBefore = this.getInventory(toWh, product_id);

    // الحركة الأولى: خصم من المصدر
    const out = this.addTransaction({
      type: 'transfer_out',
      warehouse_id: fromWh,
      product_id: product_id,
      quantity: quantity,
      reference_type: 'transfer',
      notes: `تحويل إلى ${toWh}` + (notes ? ' - ' + notes : '')
    });

    if (!out.success) return out;

    // الحركة الثانية: إضافة للهدف
    const inTxn = this.addTransaction({
      type: 'transfer_in',
      warehouse_id: toWh,
      product_id: product_id,
      quantity: quantity,
      unit_cost: invFromBefore.average_cost, // نقل التكلفة
      reference_type: 'transfer',
      reference_id: out.txn_id,
      notes: `تحويل من ${fromWh}` + (notes ? ' - ' + notes : '')
    });

    if (!inTxn.success) {
      // Rollback الحركة الأولى
      LocalStore.set(`inventory/${fromWh}/${product_id}`, invFromBefore);
      const txns = LocalStore.get('inventory_txns') || {};
      delete txns[out.txn_id];
      LocalStore.set('inventory_txns', txns);
      return inTxn;
    }

    return { success: true, out_txn: out.txn_id, in_txn: inTxn.txn_id };
  }
};
