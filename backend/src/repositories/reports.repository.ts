// backend/src/repositories/reports.repository.ts
// Jewel Suite Part 10: Reports Repository (Read-only Database Aggregations)

import { getDb } from '../database/connection/db.js';
import {
  SalesSummaryReport,
  SalesRegisterItem,
  CustomerSalesReportItem,
  ProductSalesReportItem,
  MetalSalesReportItem,
  PurchaseSummaryReport,
  PurchaseRegisterItem,
  SupplierPurchaseReportItem,
  CurrentStockReportItem,
  StockValuationReport,
  StockValuationGroupItem,
  StockMovementReportItem,
  ReceivableReportItem,
  PayableReportItem,
  CashBookReport,
  CashBookEntryItem,
  PaymentCollectionReportItem,
  PaymentCollectionSummary,
  LedgerReportItem,
  KarigarJobReportItem,
  KarigarLabourReportItem,
  RepairReportItem,
  GirviLoanReportItem,
  SavingSchemeReportItem,
  InstallmentCollectionReportItem,
  GstSalesSummaryReport,
  GstPurchaseSummaryReport,
  HsnSummaryReportItem,
  GstInvoiceRegisterItem,
  ShopReportHeader,
} from '../domain/reports.js';
import { roundWeight, roundFineWeight, roundCurrency } from '../utils/jewelleryMath.js';
import { toDecimal } from '../utils/precision.js';

export class ReportsRepository {
  // =========================================================================
  // 1. SALES REPORTS
  // =========================================================================

  getSalesSummary(filter: {
    fromDate?: string;
    toDate?: string;
    customerId?: string;
    status?: string;
    metalId?: string;
    purityId?: string;
    paymentStatus?: string;
  }): SalesSummaryReport {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    // Official reports default to FINALIZED if not specified
    if (filter.status) {
      conditions.push('si.status = ?');
      params.push(filter.status);
    } else {
      conditions.push("si.status != 'CANCELLED'");
    }

    if (filter.fromDate) {
      conditions.push('si.invoice_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('si.invoice_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.customerId) {
      conditions.push('si.customer_id = ?');
      params.push(filter.customerId);
    }

    if (filter.paymentStatus === 'PAID') {
      conditions.push('si.balance_amount <= 0');
    } else if (filter.paymentStatus === 'UNPAID') {
      conditions.push('si.amount_paid = 0');
    } else if (filter.paymentStatus === 'PARTIAL') {
      conditions.push('si.balance_amount > 0 AND si.amount_paid > 0');
    }

    let joinItems = '';
    if (filter.metalId || filter.purityId) {
      joinItems = 'JOIN sales_invoice_items sii ON sii.sales_invoice_id = si.id';
      if (filter.metalId) {
        conditions.push('sii.metal_id = ?');
        params.push(filter.metalId);
      }
      if (filter.purityId) {
        conditions.push('sii.purity_id = ?');
        params.push(filter.purityId);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        COUNT(DISTINCT si.id) as invoices_count,
        COALESCE(SUM(si.grand_total), 0) as gross_sales,
        COALESCE(SUM(si.discount_amount), 0) as discount,
        COALESCE(SUM(si.taxable_amount), 0) as taxable_amount,
        COALESCE(SUM(si.gst_amount), 0) as gst_amount,
        COALESCE(SUM(si.exchange_amount), 0) as exchange_amount,
        COALESCE(SUM(si.round_off), 0) as round_off,
        COALESCE(SUM(si.net_payable), 0) as net_sales,
        COALESCE(SUM(si.amount_paid), 0) as amount_paid,
        COALESCE(SUM(si.balance_amount), 0) as outstanding
      FROM sales_invoices si
      ${joinItems}
      ${whereClause}
    `;

    const row = db.prepare(sql).get(...params) as any;

    return {
      invoicesCount: Number(row?.invoices_count || 0),
      grossSales: Number(row?.gross_sales || 0),
      discount: Number(row?.discount || 0),
      taxableAmount: Number(row?.taxable_amount || 0),
      gstAmount: Number(row?.gst_amount || 0),
      exchangeAmount: Number(row?.exchange_amount || 0),
      roundOff: Number(row?.round_off || 0),
      netSales: Number(row?.net_sales || 0),
      amountPaid: Number(row?.amount_paid || 0),
      outstanding: Number(row?.outstanding || 0),
    };
  }

  getSalesRegister(filter: {
    fromDate?: string;
    toDate?: string;
    customerId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: SalesRegisterItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      conditions.push('si.status = ?');
      params.push(filter.status);
    }
    if (filter.fromDate) {
      conditions.push('si.invoice_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('si.invoice_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.customerId) {
      conditions.push('si.customer_id = ?');
      params.push(filter.customerId);
    }
    if (filter.search) {
      conditions.push('(si.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        si.id,
        si.invoice_number as invoiceNumber,
        si.invoice_date as invoiceDate,
        si.customer_id as customerId,
        c.name as customerName,
        c.phone as customerPhone,
        si.subtotal,
        si.discount_amount as discountAmount,
        si.taxable_amount as taxableAmount,
        si.gst_amount as gstAmount,
        si.exchange_amount as exchangeAmount,
        si.grand_total as grandTotal,
        si.net_payable as netPayable,
        si.amount_paid as amountPaid,
        si.balance_amount as balanceAmount,
        si.status,
        u.username as createdByUsername
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      LEFT JOIN users u ON u.id = si.created_by
      ${whereClause}
      ORDER BY si.invoice_date DESC, si.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as SalesRegisterItem[];

    return { items: rows, total };
  }

  getCustomerSalesReport(filter: {
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: CustomerSalesReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = ["si.status != 'CANCELLED'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('si.invoice_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('si.invoice_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.search) {
      conditions.push('(c.name LIKE ? OR c.phone LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(DISTINCT si.customer_id) as cnt
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        c.id as customerId,
        c.name as customerName,
        c.phone as customerPhone,
        COUNT(si.id) as invoiceCount,
        COALESCE(SUM(si.grand_total), 0) as totalSales,
        COALESCE(SUM(si.amount_paid), 0) as totalPaid,
        COALESCE(SUM(si.balance_amount), 0) as outstanding
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      ${whereClause}
      GROUP BY c.id, c.name, c.phone
      ORDER BY totalSales DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as CustomerSalesReportItem[];

    return { items: rows, total };
  }

  getProductSalesReport(filter: {
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: ProductSalesReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = ["si.status != 'CANCELLED'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('si.invoice_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('si.invoice_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.search) {
      conditions.push('(sii.item_name LIKE ? OR p.name LIKE ? OR cat.name LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(DISTINCT COALESCE(p.id, sii.item_name)) as cnt
      FROM sales_invoice_items sii
      JOIN sales_invoices si ON si.id = sii.sales_invoice_id
      LEFT JOIN stock_items stk ON stk.id = sii.stock_item_id
      LEFT JOIN products p ON p.id = stk.product_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        p.id as productId,
        COALESCE(p.name, sii.item_name) as productName,
        COALESCE(cat.name, 'General') as categoryName,
        COUNT(sii.id) as itemsCount,
        COALESCE(SUM(sii.gross_weight), 0) as grossWeight,
        COALESCE(SUM(sii.net_weight), 0) as netWeight,
        COALESCE(SUM(sii.fine_weight), 0) as fineWeight,
        COALESCE(SUM(sii.metal_value), 0) as metalValue,
        COALESCE(SUM(sii.making_charge), 0) as makingCharge,
        COALESCE(SUM(sii.item_amount), 0) as totalSales
      FROM sales_invoice_items sii
      JOIN sales_invoices si ON si.id = sii.sales_invoice_id
      LEFT JOIN stock_items stk ON stk.id = sii.stock_item_id
      LEFT JOIN products p ON p.id = stk.product_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      ${whereClause}
      GROUP BY COALESCE(p.id, sii.item_name), COALESCE(p.name, sii.item_name), COALESCE(cat.name, 'General')
      ORDER BY totalSales DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as ProductSalesReportItem[];

    return { items: rows, total };
  }

  getMetalSalesReport(filter: { fromDate?: string; toDate?: string }): MetalSalesReportItem[] {
    const db = getDb();
    const conditions: string[] = ["si.status != 'CANCELLED'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('si.invoice_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('si.invoice_date <= ?');
      params.push(filter.toDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT 
        m.id as metalId,
        m.name as metalName,
        COUNT(sii.id) as itemsCount,
        COALESCE(SUM(sii.gross_weight), 0) as grossWeight,
        COALESCE(SUM(sii.net_weight), 0) as netWeight,
        COALESCE(SUM(sii.fine_weight), 0) as fineWeight,
        COALESCE(SUM(sii.item_amount), 0) as salesValue
      FROM sales_invoice_items sii
      JOIN sales_invoices si ON si.id = sii.sales_invoice_id
      JOIN metals m ON m.id = sii.metal_id
      ${whereClause}
      GROUP BY m.id, m.name
      ORDER BY salesValue DESC
    `;

    return db.prepare(sql).all(...params) as MetalSalesReportItem[];
  }

  // =========================================================================
  // 2. PURCHASE REPORTS
  // =========================================================================

  getPurchaseSummary(filter: {
    fromDate?: string;
    toDate?: string;
    supplierId?: string;
    status?: string;
  }): PurchaseSummaryReport {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      conditions.push('pb.status = ?');
      params.push(filter.status);
    } else {
      conditions.push("pb.status != 'CANCELLED'");
    }

    if (filter.fromDate) {
      conditions.push('pb.purchase_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('pb.purchase_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.supplierId) {
      conditions.push('pb.supplier_id = ?');
      params.push(filter.supplierId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        COUNT(pb.id) as bills_count,
        COALESCE(SUM(pb.subtotal), 0) as gross_purchase,
        COALESCE(SUM(pb.discount_amount), 0) as discount,
        COALESCE(SUM(pb.taxable_amount), 0) as taxable_purchase,
        COALESCE(SUM(pb.gst_amount), 0) as gst_amount,
        COALESCE(SUM(pb.grand_total), 0) as total_purchase,
        COALESCE(SUM(pb.amount_paid), 0) as amount_paid,
        COALESCE(SUM(pb.balance_amount), 0) as outstanding_payable
      FROM purchase_bills pb
      ${whereClause}
    `;

    const row = db.prepare(sql).get(...params) as any;

    return {
      billsCount: Number(row?.bills_count || 0),
      grossPurchase: Number(row?.gross_purchase || 0),
      discount: Number(row?.discount || 0),
      taxablePurchase: Number(row?.taxable_purchase || 0),
      gstAmount: Number(row?.gst_amount || 0),
      totalPurchase: Number(row?.total_purchase || 0),
      amountPaid: Number(row?.amount_paid || 0),
      outstandingPayable: Number(row?.outstanding_payable || 0),
    };
  }

  getPurchaseRegister(filter: {
    fromDate?: string;
    toDate?: string;
    supplierId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: PurchaseRegisterItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      conditions.push('pb.status = ?');
      params.push(filter.status);
    }
    if (filter.fromDate) {
      conditions.push('pb.purchase_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('pb.purchase_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.supplierId) {
      conditions.push('pb.supplier_id = ?');
      params.push(filter.supplierId);
    }
    if (filter.search) {
      conditions.push('(pb.purchase_number LIKE ? OR pb.supplier_invoice_number LIKE ? OR s.name LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM purchase_bills pb
      JOIN suppliers s ON s.id = pb.supplier_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        pb.id,
        pb.purchase_number as purchaseNumber,
        pb.purchase_date as purchaseDate,
        pb.supplier_id as supplierId,
        s.name as supplierName,
        pb.supplier_invoice_number as supplierInvoiceNumber,
        pb.taxable_amount as taxableAmount,
        pb.gst_amount as gstAmount,
        pb.grand_total as grandTotal,
        pb.amount_paid as amountPaid,
        pb.balance_amount as balanceAmount,
        pb.status
      FROM purchase_bills pb
      JOIN suppliers s ON s.id = pb.supplier_id
      ${whereClause}
      ORDER BY pb.purchase_date DESC, pb.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as PurchaseRegisterItem[];

    return { items: rows, total };
  }

  getSupplierPurchaseReport(filter: {
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: SupplierPurchaseReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = ["pb.status != 'CANCELLED'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('pb.purchase_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('pb.purchase_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.search) {
      conditions.push('(s.name LIKE ? OR s.phone LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(DISTINCT pb.supplier_id) as cnt
      FROM purchase_bills pb
      JOIN suppliers s ON s.id = pb.supplier_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        s.id as supplierId,
        s.name as supplierName,
        s.phone as supplierPhone,
        COUNT(pb.id) as billsCount,
        COALESCE(SUM(pb.grand_total), 0) as purchaseAmount,
        COALESCE(SUM(pb.amount_paid), 0) as amountPaid,
        COALESCE(SUM(pb.balance_amount), 0) as outstanding
      FROM purchase_bills pb
      JOIN suppliers s ON s.id = pb.supplier_id
      ${whereClause}
      GROUP BY s.id, s.name, s.phone
      ORDER BY purchaseAmount DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as SupplierPurchaseReportItem[];

    return { items: rows, total };
  }

  // =========================================================================
  // 3. INVENTORY & STOCK REPORTS
  // =========================================================================

  getCurrentStockReport(filter: {
    metalId?: string;
    purityId?: string;
    categoryId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: CurrentStockReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    // Default to IN_STOCK if not specified
    if (filter.status) {
      conditions.push('stk.status = ?');
      params.push(filter.status);
    } else {
      conditions.push("stk.status = 'IN_STOCK'");
    }

    if (filter.metalId) {
      conditions.push('stk.metal_id = ?');
      params.push(filter.metalId);
    }
    if (filter.purityId) {
      conditions.push('stk.purity_id = ?');
      params.push(filter.purityId);
    }
    if (filter.categoryId) {
      conditions.push('p.category_id = ?');
      params.push(filter.categoryId);
    }
    if (filter.search) {
      conditions.push('(stk.tag_no LIKE ? OR p.name LIKE ? OR stk.huid LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM stock_items stk
      JOIN products p ON p.id = stk.product_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        stk.id,
        stk.tag_no as tagNo,
        p.name as productName,
        cat.name as categoryName,
        m.name as metalName,
        mp.name as purityName,
        stk.gross_weight as grossWeight,
        stk.less_weight as lessWeight,
        stk.net_weight as netWeight,
        stk.tunch_percent as tunchPercent,
        stk.fine_weight as fineWeight,
        stk.wastage_percent as wastagePercent,
        stk.making_charge as makingCharge,
        stk.rate_per_gram as ratePerGram,
        COALESCE(stk.current_value, stk.metal_value, 0) as currentValue,
        stk.status,
        stk.huid
      FROM stock_items stk
      JOIN products p ON p.id = stk.product_id
      JOIN categories cat ON cat.id = p.category_id
      JOIN metals m ON m.id = stk.metal_id
      JOIN metal_purities mp ON mp.id = stk.purity_id
      ${whereClause}
      ORDER BY stk.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as CurrentStockReportItem[];

    return { items: rows, total };
  }

  getStockValuationReport(): StockValuationReport {
    const db = getDb();

    // Group only IN_STOCK items by metal and purity
    const sql = `
      SELECT 
        m.name as metalName,
        mp.name as purityName,
        m.id as metalId,
        mp.id as purityId,
        COUNT(stk.id) as itemsCount,
        COALESCE(SUM(stk.gross_weight), 0) as grossWeight,
        COALESCE(SUM(stk.net_weight), 0) as netWeight,
        COALESCE(SUM(stk.fine_weight), 0) as fineWeight,
        COALESCE(SUM(stk.current_value), SUM(stk.metal_value), 0) as currentStockValue,
        (
          SELECT mr.rate 
          FROM metal_rates mr 
          WHERE mr.metal_id = m.id AND mr.purity_id = mp.id 
          ORDER BY mr.effective_from DESC, mr.created_at DESC 
          LIMIT 1
        ) as currentRate
      FROM stock_items stk
      JOIN metals m ON m.id = stk.metal_id
      JOIN metal_purities mp ON mp.id = stk.purity_id
      WHERE stk.status = 'IN_STOCK'
      GROUP BY m.id, m.name, mp.id, mp.name
      ORDER BY m.name ASC, mp.name ASC
    `;

    const rawRows = db.prepare(sql).all() as any[];

    let totalItems = 0;
    let totalNetWeight = 0;
    let totalFineWeight = 0;
    let totalEstimatedMetalValue = 0;
    let totalStockValue = 0;

    const groups: StockValuationGroupItem[] = rawRows.map((r) => {
      const currentRate = Number(r.currentRate || 0);
      const fineWeight = Number(r.fineWeight || 0);
      const netWeight = Number(r.netWeight || 0);
      const itemsCount = Number(r.itemsCount || 0);
      const currentStockValue = Number(r.currentStockValue || 0);

      // Estimated metal value uses current metal rate x net weight (or fine weight if rate is 24K pure equivalent)
      const estimatedMetalValue = currentRate > 0
        ? roundCurrency(toDecimal(netWeight).times(toDecimal(currentRate)))
        : currentStockValue;

      totalItems += itemsCount;
      totalNetWeight = toDecimal(totalNetWeight).plus(toDecimal(netWeight)).toNumber();
      totalFineWeight = toDecimal(totalFineWeight).plus(toDecimal(fineWeight)).toNumber();
      totalEstimatedMetalValue = toDecimal(totalEstimatedMetalValue).plus(toDecimal(estimatedMetalValue)).toNumber();
      totalStockValue = toDecimal(totalStockValue).plus(toDecimal(currentStockValue)).toNumber();

      return {
        metalName: r.metalName,
        purityName: r.purityName,
        itemsCount,
        grossWeight: roundWeight(r.grossWeight || 0),
        netWeight: roundWeight(netWeight),
        fineWeight: roundFineWeight(fineWeight),
        currentRate,
        estimatedMetalValue,
        currentStockValue,
      };
    });

    return {
      groups,
      totalItems,
      totalNetWeight: roundWeight(totalNetWeight),
      totalFineWeight: roundFineWeight(totalFineWeight),
      totalEstimatedMetalValue: roundCurrency(totalEstimatedMetalValue),
      totalStockValue: roundCurrency(totalStockValue),
    };
  }

  getStockMovementReport(filter: {
    fromDate?: string;
    toDate?: string;
    movementType?: string;
    tagNo?: string;
    page?: number;
    pageSize?: number;
  }): { items: StockMovementReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.movementType) {
      conditions.push('sm.movement_type = ?');
      params.push(filter.movementType);
    }
    if (filter.tagNo) {
      conditions.push('stk.tag_no LIKE ?');
      params.push(`%${filter.tagNo}%`);
    }
    if (filter.fromDate) {
      conditions.push("sm.created_at >= ? || ' 00:00:00'");
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push("sm.created_at <= ? || ' 23:59:59'");
      params.push(filter.toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM stock_movements sm
      JOIN stock_items stk ON stk.id = sm.stock_item_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        sm.id,
        sm.created_at as createdAt,
        stk.tag_no as tagNo,
        COALESCE(p.name, 'Item') as productName,
        sm.movement_type as movementType,
        sm.reference_type as referenceType,
        sm.reference_id as referenceId,
        sm.from_status as fromStatus,
        sm.to_status as toStatus,
        sm.gross_weight as grossWeight,
        sm.net_weight as netWeight,
        sm.fine_weight as fineWeight,
        u.username as createdByUsername,
        sm.notes
      FROM stock_movements sm
      JOIN stock_items stk ON stk.id = sm.stock_item_id
      LEFT JOIN products p ON p.id = stk.product_id
      LEFT JOIN users u ON u.id = sm.created_by
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as StockMovementReportItem[];

    return { items: rows, total };
  }

  // =========================================================================
  // 4. FINANCE REPORTS
  // =========================================================================

  getReceivablesReport(filter: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: ReceivableReportItem[]; total: number; totalOutstanding: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.search) {
      conditions.push('(c.name LIKE ? OR c.phone LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Calculate customer balances from sales & payments / finance
    const baseSql = `
      SELECT 
        c.id as customerId,
        c.name as customerName,
        c.phone as customerPhone,
        COALESCE(sales.total_sales, 0) as totalSales,
        COALESCE(receipts.total_receipts, 0) as totalReceipts,
        (COALESCE(sales.total_sales, 0) - COALESCE(receipts.total_receipts, 0) + 
          CASE WHEN c.opening_balance_type = 'DEBIT' THEN c.opening_balance ELSE -c.opening_balance END
        ) as outstanding
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, SUM(grand_total) as total_sales 
        FROM sales_invoices 
        WHERE status != 'CANCELLED' 
        GROUP BY customer_id
      ) sales ON sales.customer_id = c.id
      LEFT JOIN (
        SELECT party_id, SUM(amount) as total_receipts 
        FROM payments 
        WHERE party_type = 'CUSTOMER' AND payment_type = 'RECEIPT' 
        GROUP BY party_id
      ) receipts ON receipts.party_id = c.id
      ${whereClause}
    `;

    const countSql = `SELECT COUNT(*) as cnt FROM (${baseSql})`;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const totalSumSql = `SELECT COALESCE(SUM(outstanding), 0) as sum_out FROM (${baseSql})`;
    const totalSumRow = db.prepare(totalSumSql).get(...params) as { sum_out: number };
    const totalOutstanding = Number(totalSumRow?.sum_out || 0);

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const dataSql = `
      SELECT * FROM (${baseSql})
      ORDER BY outstanding DESC, customerName ASC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(dataSql).all(...params, pageSize, offset) as ReceivableReportItem[];

    return { items: rows, total, totalOutstanding };
  }

  getPayablesReport(filter: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: PayableReportItem[]; total: number; totalOutstanding: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.search) {
      conditions.push('(s.name LIKE ? OR s.phone LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseSql = `
      SELECT 
        s.id as supplierId,
        s.name as supplierName,
        s.phone as supplierPhone,
        COALESCE(purchases.total_purchases, 0) as totalPurchases,
        COALESCE(pmts.total_payments, 0) as totalPayments,
        (COALESCE(purchases.total_purchases, 0) - COALESCE(pmts.total_payments, 0)) as outstanding
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, SUM(grand_total) as total_purchases 
        FROM purchase_bills 
        WHERE status != 'CANCELLED' 
        GROUP BY supplier_id
      ) purchases ON purchases.supplier_id = s.id
      LEFT JOIN (
        SELECT party_id, SUM(amount) as total_payments 
        FROM payments 
        WHERE party_type = 'SUPPLIER' AND payment_type = 'PAYMENT' 
        GROUP BY party_id
      ) pmts ON pmts.party_id = s.id
      ${whereClause}
    `;

    const countSql = `SELECT COUNT(*) as cnt FROM (${baseSql})`;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const totalSumSql = `SELECT COALESCE(SUM(outstanding), 0) as sum_out FROM (${baseSql})`;
    const totalSumRow = db.prepare(totalSumSql).get(...params) as { sum_out: number };
    const totalOutstanding = Number(totalSumRow?.sum_out || 0);

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const dataSql = `
      SELECT * FROM (${baseSql})
      ORDER BY outstanding DESC, supplierName ASC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(dataSql).all(...params, pageSize, offset) as PayableReportItem[];

    return { items: rows, total, totalOutstanding };
  }

  getCashBookReport(filter: { fromDate?: string; toDate?: string }): CashBookReport {
    const db = getDb();

    // 1. Calculate opening cash balance prior to fromDate
    let openingBalance = 0;
    if (filter.fromDate) {
      const priorSql = `
        SELECT 
          COALESCE(SUM(CASE WHEN payment_type = 'RECEIPT' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN payment_type = 'PAYMENT' THEN amount ELSE 0 END), 0) as prior_balance
        FROM payments
        WHERE payment_mode = 'CASH' AND payment_date < ?
      `;
      const priorRow = db.prepare(priorSql).get(filter.fromDate) as any;
      openingBalance = Number(priorRow?.prior_balance || 0);
    }

    // 2. Fetch cash entries within date range
    const conditions: string[] = ["p.payment_mode = 'CASH'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('p.payment_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('p.payment_date <= ?');
      params.push(filter.toDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT 
        p.id,
        p.payment_date as date,
        p.payment_number as referenceNumber,
        p.reference_type as referenceType,
        COALESCE(p.notes, p.payment_type || ' VOUCHER') as description,
        p.party_type as partyType,
        p.party_id as partyId,
        p.payment_type as paymentType,
        p.amount
      FROM payments p
      ${whereClause}
      ORDER BY p.payment_date ASC, p.created_at ASC
    `;

    const rawRows = db.prepare(sql).all(...params) as any[];

    let running = openingBalance;
    let totalCashIn = 0;
    let totalCashOut = 0;

    const entries: CashBookEntryItem[] = rawRows.map((r) => {
      const isReceipt = r.paymentType === 'RECEIPT';
      const cashIn = isReceipt ? Number(r.amount) : 0;
      const cashOut = !isReceipt ? Number(r.amount) : 0;

      totalCashIn += cashIn;
      totalCashOut += cashOut;
      running += (cashIn - cashOut);

      return {
        id: r.id,
        date: r.date,
        referenceNumber: r.referenceNumber,
        referenceType: r.referenceType,
        description: r.description,
        partyName: null,
        cashIn,
        cashOut,
        runningBalance: roundCurrency(running),
      };
    });

    return {
      openingBalance: roundCurrency(openingBalance),
      entries,
      totalCashIn: roundCurrency(totalCashIn),
      totalCashOut: roundCurrency(totalCashOut),
      closingBalance: roundCurrency(running),
    };
  }

  getPaymentCollectionReport(filter: {
    fromDate?: string;
    toDate?: string;
    paymentMode?: string;
    partyType?: string;
    page?: number;
    pageSize?: number;
  }): { items: PaymentCollectionReportItem[]; total: number; summary: PaymentCollectionSummary } {
    const db = getDb();
    const conditions: string[] = ["p.payment_type = 'RECEIPT'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('p.payment_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('p.payment_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.paymentMode) {
      conditions.push('p.payment_mode = ?');
      params.push(filter.paymentMode);
    }
    if (filter.partyType) {
      conditions.push('p.party_type = ?');
      params.push(filter.partyType);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Calculate Summary Cards
    const summarySql = `
      SELECT 
        COALESCE(SUM(amount), 0) as totalCollection,
        COALESCE(SUM(CASE WHEN payment_mode = 'CASH' THEN amount ELSE 0 END), 0) as cash,
        COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN amount ELSE 0 END), 0) as upi,
        COALESCE(SUM(CASE WHEN payment_mode = 'CARD' THEN amount ELSE 0 END), 0) as card,
        COALESCE(SUM(CASE WHEN payment_mode = 'BANK' THEN amount ELSE 0 END), 0) as bank,
        COALESCE(SUM(CASE WHEN payment_mode = 'CREDIT' THEN amount ELSE 0 END), 0) as creditOther
      FROM payments p
      ${whereClause}
    `;
    const summaryRow = db.prepare(summarySql).get(...params) as any;
    const summary: PaymentCollectionSummary = {
      totalCollection: Number(summaryRow?.totalCollection || 0),
      cash: Number(summaryRow?.cash || 0),
      upi: Number(summaryRow?.upi || 0),
      card: Number(summaryRow?.card || 0),
      bank: Number(summaryRow?.bank || 0),
      creditOther: Number(summaryRow?.creditOther || 0),
    };

    const countSql = `SELECT COUNT(*) as cnt FROM payments p ${whereClause}`;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        p.id,
        p.payment_date as date,
        CASE 
          WHEN p.party_type = 'CUSTOMER' THEN (SELECT name FROM customers WHERE id = p.party_id)
          WHEN p.party_type = 'SUPPLIER' THEN (SELECT name FROM suppliers WHERE id = p.party_id)
          WHEN p.party_type = 'KARIGAR' THEN (SELECT name FROM karigars WHERE id = p.party_id)
          ELSE 'Other'
        END as partyName,
        p.party_type as partyType,
        p.payment_mode as paymentMode,
        p.amount,
        p.reference_number as referenceNumber,
        p.reference_type as referenceType,
        u.username as createdByUsername
      FROM payments p
      LEFT JOIN users u ON u.id = p.created_by
      ${whereClause}
      ORDER BY p.payment_date DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as PaymentCollectionReportItem[];

    return { items: rows, total, summary };
  }

  getLedgerReport(
    partyType: string,
    partyId: string,
    filter: { fromDate?: string; toDate?: string; page?: number; pageSize?: number }
  ): { entries: LedgerReportItem[]; total: number; openingBalance: number; closingBalance: number } {
    const db = getDb();

    // 1. Calculate opening balance prior to fromDate
    let openingBalance = 0;
    if (filter.fromDate) {
      const priorSql = `
        SELECT balance_after 
        FROM ledger_entries 
        WHERE party_type = ? AND party_id = ? AND created_at < ? || ' 00:00:00'
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const priorRow = db.prepare(priorSql).get(partyType, partyId, filter.fromDate) as any;
      if (priorRow) {
        openingBalance = Number(priorRow.balance_after);
      }
    }

    const conditions: string[] = ['party_type = ?', 'party_id = ?'];
    const params: any[] = [partyType, partyId];

    if (filter.fromDate) {
      conditions.push("created_at >= ? || ' 00:00:00'");
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push("created_at <= ? || ' 23:59:59'");
      params.push(filter.toDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as cnt FROM ledger_entries ${whereClause}`;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    // Get closing balance
    const lastRowSql = `SELECT balance_after FROM ledger_entries ${whereClause} ORDER BY created_at DESC LIMIT 1`;
    const lastRow = db.prepare(lastRowSql).get(...params) as any;
    const closingBalance = lastRow ? Number(lastRow.balance_after) : openingBalance;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        id,
        created_at as date,
        reference_number as referenceNumber,
        reference_type as referenceType,
        description,
        CASE WHEN debit_credit = 'DEBIT' THEN amount ELSE 0 END as debit,
        CASE WHEN debit_credit = 'CREDIT' THEN amount ELSE 0 END as credit,
        balance_after as balance
      FROM ledger_entries
      ${whereClause}
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `;

    const entries = db.prepare(sql).all(...params, pageSize, offset) as LedgerReportItem[];

    return { entries, total, openingBalance, closingBalance };
  }

  // =========================================================================
  // 5. WORKSHOP & REPAIR REPORTS
  // =========================================================================

  getKarigarJobReport(filter: {
    fromDate?: string;
    toDate?: string;
    karigarId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: KarigarJobReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      conditions.push('wj.status = ?');
      params.push(filter.status);
    }
    if (filter.karigarId) {
      conditions.push('wj.karigar_id = ?');
      params.push(filter.karigarId);
    }
    if (filter.fromDate) {
      conditions.push('wj.issue_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('wj.issue_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.search) {
      conditions.push('(wj.job_number LIKE ? OR k.name LIKE ? OR c.name LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM workshop_jobs wj
      JOIN karigars k ON k.id = wj.karigar_id
      LEFT JOIN customers c ON c.id = wj.customer_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        wj.id,
        wj.job_number as jobNumber,
        k.name as karigarName,
        wj.job_type as jobType,
        c.name as customerName,
        wj.issue_date as issueDate,
        wj.expected_return_date as expectedReturnDate,
        wj.actual_return_date as actualReturnDate,
        wj.status,
        wj.estimated_labour as estimatedLabour,
        wj.actual_labour as actualLabour
      FROM workshop_jobs wj
      JOIN karigars k ON k.id = wj.karigar_id
      LEFT JOIN customers c ON c.id = wj.customer_id
      ${whereClause}
      ORDER BY wj.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as KarigarJobReportItem[];

    return { items: rows, total };
  }

  getKarigarLabourReport(filter: { search?: string }): { items: KarigarLabourReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.search) {
      conditions.push('(k.name LIKE ? OR k.phone LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        k.id as karigarId,
        k.name as karigarName,
        k.phone,
        COUNT(wj.id) as jobsCount,
        COALESCE(SUM(wj.actual_labour), 0) as labourAmount,
        COALESCE(pmts.total_paid, 0) as paidAmount,
        (COALESCE(SUM(wj.actual_labour), 0) - COALESCE(pmts.total_paid, 0)) as outstanding
      FROM karigars k
      LEFT JOIN workshop_jobs wj ON wj.karigar_id = k.id AND wj.status != 'CANCELLED'
      LEFT JOIN (
        SELECT party_id, SUM(amount) as total_paid
        FROM payments 
        WHERE party_type = 'KARIGAR' AND payment_type = 'PAYMENT'
        GROUP BY party_id
      ) pmts ON pmts.party_id = k.id
      ${whereClause}
      GROUP BY k.id, k.name, k.phone
      ORDER BY labourAmount DESC
    `;

    const rows = db.prepare(sql).all(...params) as KarigarLabourReportItem[];

    return { items: rows, total: rows.length };
  }

  getRepairReport(filter: {
    fromDate?: string;
    toDate?: string;
    status?: string;
    ownership?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: RepairReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      conditions.push('r.status = ?');
      params.push(filter.status);
    }
    if (filter.ownership) {
      conditions.push('r.ownership = ?');
      params.push(filter.ownership);
    }
    if (filter.fromDate) {
      conditions.push('r.received_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('r.received_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.search) {
      conditions.push('(r.repair_number LIKE ? OR r.item_description LIKE ? OR c.name LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM repairs r
      LEFT JOIN customers c ON c.id = r.customer_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        r.id,
        r.repair_number as repairNumber,
        COALESCE(c.name, 'Walk-in Customer') as customerName,
        r.ownership,
        r.item_description as itemDescription,
        stk.tag_no as tagNo,
        r.received_date as receivedDate,
        r.expected_completion as expectedCompletion,
        r.delivered_date as deliveredDate,
        r.status,
        r.estimated_cost as estimatedCost,
        r.actual_cost as actualCost
      FROM repairs r
      LEFT JOIN customers c ON c.id = r.customer_id
      LEFT JOIN stock_items stk ON stk.id = r.stock_item_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as RepairReportItem[];

    return { items: rows, total };
  }

  // =========================================================================
  // 6. GIRVI LOAN REPORTS
  // =========================================================================

  getGirviLoansReport(filter: {
    overdueOnly?: boolean;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: GirviLoanReportItem[]; total: number; totalPrincipal: number; totalOutstanding: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.overdueOnly) {
      conditions.push("gl.due_date < date('now')");
      conditions.push('gl.outstanding_amount > 0');
      conditions.push("gl.status NOT IN ('CLOSED', 'CANCELLED', 'DRAFT')");
    } else if (filter.status) {
      conditions.push('gl.status = ?');
      params.push(filter.status);
    } else {
      conditions.push("gl.status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE')");
    }

    if (filter.search) {
      conditions.push('(gl.loan_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT 
        COUNT(*) as cnt,
        COALESCE(SUM(gl.principal_amount), 0) as sum_principal,
        COALESCE(SUM(gl.outstanding_amount), 0) as sum_outstanding
      FROM girvi_loans gl
      JOIN customers c ON c.id = gl.customer_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as any;
    const total = countRow?.cnt || 0;
    const totalPrincipal = Number(countRow?.sum_principal || 0);
    const totalOutstanding = Number(countRow?.sum_outstanding || 0);

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        gl.id,
        gl.loan_number as loanNumber,
        c.name as customerName,
        c.phone as customerPhone,
        gl.loan_date as loanDate,
        gl.due_date as dueDate,
        gl.principal_amount as principalAmount,
        gl.interest_rate as interestRate,
        gl.total_interest as totalInterest,
        gl.total_charges as totalCharges,
        gl.total_repaid as totalRepaid,
        gl.outstanding_amount as outstandingAmount,
        gl.status,
        CASE 
          WHEN gl.due_date < date('now') THEN CAST((julianday('now') - julianday(gl.due_date)) AS INTEGER)
          ELSE 0
        END as daysOverdue
      FROM girvi_loans gl
      JOIN customers c ON c.id = gl.customer_id
      ${whereClause}
      ORDER BY gl.due_date ASC, gl.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as GirviLoanReportItem[];

    return { items: rows, total, totalPrincipal, totalOutstanding };
  }

  // =========================================================================
  // 7. SAVING SCHEMES REPORTS
  // =========================================================================

  getSavingSchemeRegister(filter: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: SavingSchemeReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      conditions.push('ss.status = ?');
      params.push(filter.status);
    }
    if (filter.search) {
      conditions.push('(ss.scheme_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM saving_schemes ss
      JOIN customers c ON c.id = ss.customer_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        ss.id,
        ss.scheme_number as schemeNumber,
        c.name as customerName,
        c.phone as customerPhone,
        sst.name as schemeName,
        ss.start_date as startDate,
        ss.maturity_date as maturityDate,
        ss.installment_amount as installmentAmount,
        ss.total_installments as totalInstallments,
        ss.paid_installments as paidInstallments,
        ss.paid_amount as paidAmount,
        ss.maturity_amount as maturityAmount,
        ss.status
      FROM saving_schemes ss
      JOIN customers c ON c.id = ss.customer_id
      JOIN saving_scheme_types sst ON sst.id = ss.scheme_type_id
      ${whereClause}
      ORDER BY ss.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as SavingSchemeReportItem[];

    return { items: rows, total };
  }

  getSchemeInstallmentCollectionReport(filter: {
    fromDate?: string;
    toDate?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): { items: InstallmentCollectionReportItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      conditions.push('ssi.status = ?');
      params.push(filter.status);
    }
    if (filter.fromDate) {
      conditions.push('ssi.due_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('ssi.due_date <= ?');
      params.push(filter.toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM saving_scheme_installments ssi
      JOIN saving_schemes ss ON ss.id = ssi.saving_scheme_id
      JOIN customers c ON c.id = ss.customer_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        ssi.id,
        ss.scheme_number as schemeNumber,
        c.name as customerName,
        ssi.installment_number as installmentNumber,
        ssi.due_date as dueDate,
        ssi.amount_due as amountDue,
        ssi.amount_paid as amountPaid,
        ssi.payment_date as paymentDate,
        ssi.payment_mode as paymentMode,
        ssi.status
      FROM saving_scheme_installments ssi
      JOIN saving_schemes ss ON ss.id = ssi.saving_scheme_id
      JOIN customers c ON c.id = ss.customer_id
      ${whereClause}
      ORDER BY ssi.due_date DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as InstallmentCollectionReportItem[];

    return { items: rows, total };
  }

  // =========================================================================
  // 8. GST REPORTS
  // =========================================================================

  getGstSalesSummary(filter: { fromDate?: string; toDate?: string }): GstSalesSummaryReport {
    const db = getDb();
    const conditions: string[] = ["status = 'FINALIZED'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('invoice_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('invoice_date <= ?');
      params.push(filter.toDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT 
        COUNT(id) as invoices_count,
        COALESCE(SUM(taxable_amount), 0) as taxable_value,
        COALESCE(SUM(gst_amount), 0) as total_gst,
        COALESCE(SUM(grand_total), 0) as total_value
      FROM sales_invoices
      ${whereClause}
    `;

    const row = db.prepare(sql).get(...params) as any;
    const totalGst = Number(row?.total_gst || 0);

    // Standard intra-state GST calculation (CGST = 50%, SGST = 50%)
    const cgstAmount = roundCurrency(totalGst / 2.0);
    const sgstAmount = roundCurrency(totalGst - cgstAmount);
    const igstAmount = 0.0;

    return {
      invoicesCount: Number(row?.invoices_count || 0),
      taxableValue: Number(row?.taxable_value || 0),
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalGst,
      totalValue: Number(row?.total_value || 0),
    };
  }

  getGstPurchaseSummary(filter: { fromDate?: string; toDate?: string }): GstPurchaseSummaryReport {
    const db = getDb();
    const conditions: string[] = ["status = 'FINALIZED'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('purchase_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('purchase_date <= ?');
      params.push(filter.toDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT 
        COUNT(id) as bills_count,
        COALESCE(SUM(taxable_amount), 0) as taxable_purchase,
        COALESCE(SUM(gst_amount), 0) as total_gst,
        COALESCE(SUM(grand_total), 0) as total_purchase
      FROM purchase_bills
      ${whereClause}
    `;

    const row = db.prepare(sql).get(...params) as any;
    const totalGst = Number(row?.total_gst || 0);
    const cgstAmount = roundCurrency(totalGst / 2.0);
    const sgstAmount = roundCurrency(totalGst - cgstAmount);
    const igstAmount = 0.0;

    return {
      billsCount: Number(row?.bills_count || 0),
      taxablePurchase: Number(row?.taxable_purchase || 0),
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalGst,
      totalPurchase: Number(row?.total_purchase || 0),
    };
  }

  getHsnSummary(filter: { fromDate?: string; toDate?: string }): HsnSummaryReportItem[] {
    const db = getDb();
    const conditions: string[] = ["si.status = 'FINALIZED'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('si.invoice_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('si.invoice_date <= ?');
      params.push(filter.toDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT 
        COALESCE(p.hsn_code, '7113') as hsnCode,
        'Articles of Jewellery and parts thereof' as description,
        COUNT(sii.id) as productCount,
        COALESCE(SUM(sii.item_amount), 0) as taxableValue,
        COALESCE(SUM(ROUND(sii.item_amount * (si.gst_rate / 100.0), 2)), 0) as gstAmount,
        COALESCE(SUM(ROUND(sii.item_amount * (1.0 + (si.gst_rate / 100.0)), 2)), 0) as totalValue
      FROM sales_invoice_items sii
      JOIN sales_invoices si ON si.id = sii.sales_invoice_id
      LEFT JOIN stock_items stk ON stk.id = sii.stock_item_id
      LEFT JOIN products p ON p.id = stk.product_id
      ${whereClause}
      GROUP BY COALESCE(p.hsn_code, '7113')
      ORDER BY taxableValue DESC
    `;

    return db.prepare(sql).all(...params) as HsnSummaryReportItem[];
  }

  getGstInvoiceRegister(filter: {
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: GstInvoiceRegisterItem[]; total: number } {
    const db = getDb();
    const conditions: string[] = ["si.status = 'FINALIZED'"];
    const params: any[] = [];

    if (filter.fromDate) {
      conditions.push('si.invoice_date >= ?');
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push('si.invoice_date <= ?');
      params.push(filter.toDate);
    }
    if (filter.search) {
      conditions.push('(si.invoice_number LIKE ? OR c.name LIKE ? OR c.gstin LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*) as cnt 
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const page = Math.max(1, Number(filter.page || 1));
    const pageSize = Math.max(1, Number(filter.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT 
        si.id,
        si.invoice_number as invoiceNumber,
        si.invoice_date as date,
        c.name as customerName,
        c.gstin as gstin,
        '7113' as hsnCode,
        si.taxable_amount as taxableValue,
        si.gst_rate as gstRate,
        si.gst_amount as gstAmount,
        si.grand_total as grandTotal
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      ${whereClause}
      ORDER BY si.invoice_date DESC, si.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset) as GstInvoiceRegisterItem[];

    return { items: rows, total };
  }

  // =========================================================================
  // 9. SHOP DETAILS & HEADER
  // =========================================================================

  getShopReportHeader(reportName: string, fromDate?: string, toDate?: string): ShopReportHeader {
    const db = getDb();
    const shopRow = db.prepare('SELECT * FROM shops LIMIT 1').get() as any;
    const gstinSetting = db.prepare("SELECT value FROM settings WHERE key IN ('gstin', 'shop_gstin') LIMIT 1").get() as any;

    let dateRange = 'All Time';
    if (fromDate && toDate) {
      dateRange = `${fromDate} to ${toDate}`;
    } else if (fromDate) {
      dateRange = `From ${fromDate}`;
    } else if (toDate) {
      dateRange = `Up to ${toDate}`;
    }

    return {
      shopName: shopRow?.name || 'Jewel Suite Jewellers',
      address: shopRow?.address || 'Main Bazaar, Jewellery Market',
      phone: shopRow?.phone || '+91 98765 43210',
      email: shopRow?.email || 'contact@jewelsuite.com',
      gstin: gstinSetting?.value || '24AAAAA0000A1Z5',
      reportName,
      dateRange,
      generatedOn: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };
  }

  // =========================================================================
  // 10. REAL DASHBOARD METRICS AGGREGATION
  // =========================================================================

  getDashboardMetrics(): {
    todaySales: number;
    monthlySales: number;
    receivables: number;
    payables: number;
    stockValuation: number;
    activeLoansCount: number;
    activeLoansAmount: number;
    monthlyGstCollected: number;
  } {
    const db = getDb();

    // Today's finalized sales
    const todaySql = `
      SELECT COALESCE(SUM(grand_total), 0) as today_sales 
      FROM sales_invoices 
      WHERE status = 'FINALIZED' AND invoice_date = date('now')
    `;
    const todayRow = db.prepare(todaySql).get() as any;

    // Monthly finalized sales
    const monthSql = `
      SELECT 
        COALESCE(SUM(grand_total), 0) as monthly_sales,
        COALESCE(SUM(gst_amount), 0) as monthly_gst
      FROM sales_invoices 
      WHERE status = 'FINALIZED' AND strftime('%Y-%m', invoice_date) = strftime('%Y-%m', 'now')
    `;
    const monthRow = db.prepare(monthSql).get() as any;

    // Receivables
    const recSql = `
      SELECT COALESCE(SUM(balance_amount), 0) as receivables 
      FROM sales_invoices 
      WHERE status = 'FINALIZED' AND balance_amount > 0
    `;
    const recRow = db.prepare(recSql).get() as any;

    // Payables
    const paySql = `
      SELECT COALESCE(SUM(balance_amount), 0) as payables 
      FROM purchase_bills 
      WHERE status = 'FINALIZED' AND balance_amount > 0
    `;
    const payRow = db.prepare(paySql).get() as any;

    // Stock valuation
    const stockValuation = this.getStockValuationReport().totalStockValue;

    // Girvi loans
    const girviSql = `
      SELECT 
        COUNT(id) as cnt,
        COALESCE(SUM(outstanding_amount), 0) as outstanding
      FROM girvi_loans 
      WHERE status IN ('ACTIVE', 'PARTIALLY_PAID', 'OVERDUE')
    `;
    const girviRow = db.prepare(girviSql).get() as any;

    return {
      todaySales: Number(todayRow?.today_sales || 0),
      monthlySales: Number(monthRow?.monthly_sales || 0),
      receivables: Number(recRow?.receivables || 0),
      payables: Number(payRow?.payables || 0),
      stockValuation,
      activeLoansCount: Number(girviRow?.cnt || 0),
      activeLoansAmount: Number(girviRow?.outstanding || 0),
      monthlyGstCollected: Number(monthRow?.monthly_gst || 0),
    };
  }
}

export const reportsRepository = new ReportsRepository();
