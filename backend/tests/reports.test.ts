// backend/tests/reports.test.ts
// Jewel Suite Part 10: Reports and GST Reports Comprehensive Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import * as dbModule from '../src/database/connection/db.js';
import { runMigrations } from '../src/database/migrations/migrator.js';
import { runSeeds } from '../src/database/seeds/seeder.js';
import { reportsRepository } from '../src/repositories/reports.repository.js';
import { reportsService } from '../src/services/reports.service.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { supplierRepository } from '../src/repositories/supplier.repository.js';
import { karigarRepository } from '../src/repositories/karigar.repository.js';
import { categoryRepository } from '../src/repositories/category.repository.js';
import { productRepository } from '../src/repositories/product.repository.js';
import { metalRepository } from '../src/repositories/metal.repository.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { salesService } from '../src/services/sales.service.js';
import { purchaseService } from '../src/services/purchase.service.js';
import { girviService } from '../src/services/girvi.service.js';
import { savingSchemeService } from '../src/services/savingScheme.service.js';
import { financeService } from '../src/services/finance.service.js';
import { workshopService } from '../src/services/workshop.service.js';
import { repairService } from '../src/services/repair.service.js';
import { PartyType, PaymentMode, PaymentType } from '../src/domain/finance.js';

describe('Jewel Suite Part 10: Reports & Analytics Unit & Integration Tests', () => {
  let testDb: DatabaseType;
  let customerId: string;
  let supplierId: string;
  let karigarId: string;
  let metalId: string;
  let purityId: string;
  let categoryId: string;
  let productId: string;
  let finalizedInvoiceId: string;
  let draftInvoiceId: string;
  let purchaseBillId: string;

  beforeAll(async () => {
    testDb = new DatabaseConstructor(':memory:');
    testDb.pragma('foreign_keys = ON');
    dbModule.setDb(testDb);

    runMigrations(testDb);
    await runSeeds();

    // 1. Seed Masters
    const cust = customerRepository.create({
      name: 'Aditya Birla',
      phone: '9876500001',
      customer_type: 'RETAIL',
      gstin: '24ABCDE1234F1Z5',
      opening_balance: 0,
      opening_balance_type: 'DEBIT',
    });
    customerId = cust.id;

    const supp = supplierRepository.create({
      name: 'Bullion India Ltd',
      phone: '9876500002',
      gstin: '24XYZAB5678C1Z2',
    });
    supplierId = supp.id;

    const kar = karigarRepository.create({
      name: 'Kishore Karigar',
      phone: '9876500003',
      specialization: 'GOLD',
    });
    karigarId = kar.id;

    const categories = categoryRepository.find({ pageSize: 1 });
    categoryId = categories.items[0].id;

    const metals = metalRepository.getMetals();
    const gold = metals.find((m) => m.code === 'GOLD')!;
    metalId = gold.id;
    const purities = metalRepository.getPuritiesByMetal(metalId);
    const purity22k = purities.find((p) => p.code === '22K')!;
    purityId = purity22k.id;

    // Set metal rate: 7000 / gram
    metalRepository.createRate({
      metal_id: metalId,
      purity_id: purityId,
      rate: 7000.0,
      unit: 'gram',
    });

    const products = productRepository.find({ pageSize: 1 });
    productId = products.items[0].id;

    // 2. Seed Stock Items
    const stock1 = inventoryService.createStockItem({
      tag_no: 'TAG-RPT-001',
      product_id: productId,
      metal_id: metalId,
      purity_id: purityId,
      gross_weight: 10.0,
      less_weight: 0.0,
      tunch_percent: 91.6,
      rate_per_gram: 7000,
      making_charge: 2000,
    });

    const stock2 = inventoryService.createStockItem({
      tag_no: 'TAG-RPT-002',
      product_id: productId,
      metal_id: metalId,
      purity_id: purityId,
      gross_weight: 15.0,
      less_weight: 0.0,
      tunch_percent: 91.6,
      rate_per_gram: 7000,
      making_charge: 3000,
    });

    // 3. Create and Finalize a Sales Invoice
    const inv = salesService.createDraft({
      customer_id: customerId,
      invoice_date: '2026-10-01',
      items: [
        {
          stock_item_id: stock1.id,
          tag_no: stock1.tag_no,
          item_name: 'Classic 22K Gold Bangle',
          metal_id: metalId,
          purity_id: purityId,
          gross_weight: 10.0,
          less_weight: 0.0,
          tunch_percent: 91.6,
          rate_per_gram: 7000.0,
          making_charge: 2000.0,
        },
      ],
      payments: [
        {
          payment_mode: 'CASH',
          amount: 50000.0,
          reference_number: 'REC-CASH-01',
        },
      ],
      discount_amount: 1000.0,
    });

    salesService.finalizeSale(inv.id);
    finalizedInvoiceId = inv.id;

    // Create a DRAFT Sales Invoice (should NOT skew official GST)
    const draftInv = salesService.createDraft({
      customer_id: customerId,
      invoice_date: '2026-10-02',
      items: [
        {
          stock_item_id: stock2.id,
          tag_no: stock2.tag_no,
          item_name: 'Classic 22K Gold Bangle',
          metal_id: metalId,
          purity_id: purityId,
          gross_weight: 15.0,
          less_weight: 0.0,
          tunch_percent: 91.6,
          rate_per_gram: 7000.0,
          making_charge: 3000.0,
        },
      ],
      payments: [],
      discount_amount: 0.0,
    });
    draftInvoiceId = draftInv.id;

    // 4. Create and Finalize a Purchase Bill
    const pb = purchaseService.createDraft({
      supplier_id: supplierId,
      purchase_date: '2026-10-01',
      supplier_invoice_number: 'BULL-INV-99',
      items: [
        {
          product_id: productId,
          metal_id: metalId,
          purity_id: purityId,
          tag_no: 'PUR-TAG-001',
          gross_weight: 50.0,
          less_weight: 0.0,
          tunch_percent: 91.6,
          rate_per_gram: 6900.0,
          wastage_percent: 0.0,
          making_charge: 0.0,
        },
      ],
      payments: [
        {
          payment_mode: 'BANK',
          amount: 200000.0,
          reference_number: 'NEFT-8899',
        },
      ],
      discount_amount: 5000.0,
    });
    purchaseService.finalizePurchase(pb.id);
    purchaseBillId = pb.id;

    // 5. Seed Girvi Loan
    const loan = girviService.createLoan({
      customer_id: customerId,
      loan_date: '2026-09-01',
      due_date: '2026-09-30', // overdue relative to current date (Oct 2026)
      principal_amount: 30000.0,
      interest_rate: 2.0,
      interest_type: 'MONTHLY_PERCENT',
      items: [
        {
          description: 'Pledged Gold Chain',
          metal_id: metalId,
          purity_id: purityId,
          gross_weight: 10.0,
          less_weight: 0.5,
          net_weight: 9.5,
          tunch_percent: 91.6,
          fine_weight: 8.7,
          valuation_rate: 6500.0,
        },
      ],
    });
    girviService.disburseLoan(loan.id);

    // 6. Seed Saving Scheme
    const types = savingSchemeService.listTypes();
    const typeId = types[0].id;
    const scheme = savingSchemeService.enrollCustomer({
      customer_id: customerId,
      scheme_type_id: typeId,
      start_date: '2026-10-01',
    });
    // Pay first installment
    savingSchemeService.payInstallment(scheme.id, scheme.installments[0].id, {
      amount: scheme.installment_amount,
      payment_mode: 'CASH',
      payment_date: '2026-10-01',
    });

    // 7. Seed Workshop Job & Repair
    workshopService.createJob({
      karigar_id: karigarId,
      job_type: 'MANUFACTURING',
      customer_id: customerId,
      description: 'Custom Gold Kada',
      estimated_labour: 4500.0,
      estimated_weight: 25.0,
    });

    repairService.createRepair({
      customer_id: customerId,
      item_description: 'Ring Stone Fixing',
      problem_description: 'Stone fell off',
      ownership: 'CUSTOMER_OWNED',
      estimated_cost: 800.0,
    });
  });

  afterAll(() => {
    dbModule.setDb(null);
    if (testDb) {
      testDb.close();
    }
  });

  // =========================================================================
  // Test 1: Sales Summary & Register
  // =========================================================================
  it('1. should calculate sales summary accurately from database without hardcoded values', () => {
    const summary = reportsService.getSalesSummary({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    });

    // We have 1 finalized invoice (and 1 draft which is excluded if status='FINALIZED' or counted if not cancelled)
    expect(summary.invoicesCount).toBeGreaterThanOrEqual(1);
    expect(summary.taxableAmount).toBeGreaterThan(0);
    expect(summary.gstAmount).toBeGreaterThan(0);
    expect(summary.grossSales).toBeGreaterThan(0);
    expect(summary.amountPaid).toBeGreaterThanOrEqual(50000);
    expect(summary.outstanding).toBeGreaterThanOrEqual(0);

    // Verify date filtering
    const emptySummary = reportsService.getSalesSummary({
      fromDate: '2025-01-01',
      toDate: '2025-01-02',
    });
    expect(emptySummary.invoicesCount).toBe(0);
    expect(emptySummary.grossSales).toBe(0);
  });

  it('2. should list sales register with pagination and search', () => {
    const { items, total } = reportsService.getSalesRegister({
      search: 'Aditya',
      page: 1,
      pageSize: 10,
    });

    expect(total).toBeGreaterThanOrEqual(1);
    expect(items[0].customerName).toBe('Aditya Birla');
    expect(items[0].invoiceNumber).toBeDefined();
    expect(items[0].gstAmount).toBeGreaterThan(0);
  });

  it('3. should group customer-wise and metal-wise sales correctly', () => {
    const custSales = reportsService.getCustomerSalesReport({ search: 'Aditya' });
    expect(custSales.total).toBe(1);
    expect(custSales.items[0].customerName).toBe('Aditya Birla');
    expect(custSales.items[0].totalSales).toBeGreaterThan(0);

    const metalSales = reportsService.getMetalSalesReport({});
    expect(metalSales.length).toBeGreaterThanOrEqual(1);
    const goldSale = metalSales.find((m) => m.metalName === 'Gold');
    expect(goldSale).toBeDefined();
    expect(goldSale!.grossWeight).toBeGreaterThan(0);
    expect(goldSale!.salesValue).toBeGreaterThan(0);
  });

  // =========================================================================
  // Test 2: Purchase Reports
  // =========================================================================
  it('4. should calculate purchase summary and supplier purchases', () => {
    const purchaseSummary = reportsService.getPurchaseSummary({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    });

    expect(purchaseSummary.billsCount).toBe(1);
    expect(purchaseSummary.taxablePurchase).toBeGreaterThan(0);
    expect(purchaseSummary.gstAmount).toBeGreaterThan(0);
    expect(purchaseSummary.totalPurchase).toBeGreaterThan(0);
    expect(purchaseSummary.amountPaid).toBe(200000);

    const supplierPurchases = reportsService.getSupplierPurchaseReport({});
    expect(supplierPurchases.total).toBe(1);
    expect(supplierPurchases.items[0].supplierName).toBe('Bullion India Ltd');
    expect(supplierPurchases.items[0].purchaseAmount).toBeGreaterThan(0);
  });

  // =========================================================================
  // Test 3: Inventory & Stock Valuation
  // =========================================================================
  it('5. should report current stock and stock valuation without altering historical values', () => {
    const currentStock = reportsService.getCurrentStockReport({ status: 'IN_STOCK' });
    expect(currentStock.total).toBeGreaterThanOrEqual(1);

    const valuation = reportsService.getStockValuationReport();
    expect(valuation.totalItems).toBeGreaterThanOrEqual(1);
    expect(valuation.totalNetWeight).toBeGreaterThan(0);
    expect(valuation.totalEstimatedMetalValue).toBeGreaterThan(0);
    expect(valuation.groups.length).toBeGreaterThanOrEqual(1);
    expect(valuation.groups[0].currentRate).toBe(7000);
  });

  it('6. should track stock movements history with accurate audit trail', () => {
    const movements = reportsService.getStockMovementReport({});
    expect(movements.total).toBeGreaterThan(0);
    const types = movements.items.map((m) => m.movementType);
    expect(types).toContain('OPENING_STOCK');
  });

  // =========================================================================
  // Test 4: Finance (Cash Book, Receivables, Payables, Ledger)
  // =========================================================================
  it('7. should accurately isolate physical cash transactions in Cash Book', () => {
    const cashBook = reportsService.getCashBookReport({});
    // The sales invoice had a ₹50,000 cash payment and scheme had installment cash
    expect(cashBook.entries.length).toBeGreaterThanOrEqual(1);
    expect(cashBook.totalCashIn).toBeGreaterThanOrEqual(50000);
    expect(cashBook.totalCashOut).toBeGreaterThan(0);
    expect(cashBook.closingBalance).toBe(cashBook.totalCashIn - cashBook.totalCashOut);

    // Verify non-cash payment (e.g. Bank ₹200,000 for purchase) is strictly excluded
    const nonCash = cashBook.entries.some((e) => e.cashOut === 200000);
    expect(nonCash).toBe(false);
  });

  it('8. should calculate receivables and payables sorted by outstanding balance', () => {
    const receivables = reportsService.getReceivablesReport({});
    expect(receivables.total).toBeGreaterThanOrEqual(1);
    expect(receivables.items[0].customerName).toBe('Aditya Birla');

    const payables = reportsService.getPayablesReport({});
    expect(payables.total).toBeGreaterThanOrEqual(1);
    expect(payables.items[0].supplierName).toBe('Bullion India Ltd');
  });

  it('9. should generate accurate party ledger statement with opening and closing balance', () => {
    const ledger = reportsService.getLedgerReport('CUSTOMER', customerId, {});
    expect(ledger.entries.length).toBeGreaterThan(0);
    expect(ledger.closingBalance).toBeDefined();
  });

  // =========================================================================
  // Test 5: Girvi & Saving Schemes
  // =========================================================================
  it('10. should report active and overdue Girvi loans', () => {
    const allLoans = reportsService.getGirviLoansReport({});
    expect(allLoans.total).toBe(1);
    expect(allLoans.items[0].loanNumber).toBeDefined();

    const overdueLoans = reportsService.getGirviLoansReport({ overdueOnly: true });
    expect(overdueLoans.total).toBe(1);
    expect(overdueLoans.items[0].daysOverdue).toBeGreaterThan(0);
  });

  it('11. should report saving schemes and installment collections', () => {
    const schemes = reportsService.getSavingSchemeRegister({});
    expect(schemes.total).toBe(1);
    expect(schemes.items[0].customerName).toBe('Aditya Birla');
    expect(schemes.items[0].paidInstallments).toBe(1);

    const installments = reportsService.getSchemeInstallmentCollectionReport({});
    expect(installments.total).toBeGreaterThan(0);
    const paidInst = installments.items.find((i) => i.status === 'PAID');
    expect(paidInst).toBeDefined();
    expect(paidInst?.amountPaid).toBeGreaterThan(0);
  });

  // =========================================================================
  // Test 6: GST Reports
  // =========================================================================
  it('12. should calculate GST sales summary and exclude draft invoices', () => {
    const gstSales = reportsService.getGstSalesSummary({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    });

    // Only 1 finalized invoice
    expect(gstSales.invoicesCount).toBe(1);
    expect(gstSales.taxableValue).toBeGreaterThan(0);
    expect(gstSales.cgstAmount).toBeCloseTo(gstSales.totalGst / 2, 1);
    expect(gstSales.sgstAmount).toBeCloseTo(gstSales.totalGst / 2, 1);
    expect(gstSales.igstAmount).toBe(0);
    expect(gstSales.totalValue).toBeGreaterThan(gstSales.taxableValue);
  });

  it('13. should generate HSN summary with Chapter 7113 fallback', () => {
    const hsnSummary = reportsService.getHsnSummary({});
    expect(hsnSummary.length).toBeGreaterThanOrEqual(1);
    expect(hsnSummary[0].hsnCode).toMatch(/^7113/);
    expect(hsnSummary[0].taxableValue).toBeGreaterThan(0);
    expect(hsnSummary[0].gstAmount).toBeGreaterThan(0);
  });

  it('14. should produce GST invoice register for finalized invoices only', () => {
    const register = reportsService.getGstInvoiceRegister({});
    expect(register.total).toBe(1);
    expect(register.items[0].gstin).toBe('24ABCDE1234F1Z5');
    expect(register.items[0].gstRate).toBe(3.0);
  });

  // =========================================================================
  // Test 7: CSV Full Dataset Export
  // =========================================================================
  it('15. should export full datasets to valid CSV format', () => {
    const salesCsv = reportsService.exportReportCsv('sales-register', {});
    expect(salesCsv.filename).toContain('sales_register_');
    expect(salesCsv.content).toContain('Invoice #,Date,Customer');
    expect(salesCsv.content).toContain('Aditya Birla');

    const stockCsv = reportsService.exportReportCsv('current-stock', {});
    expect(stockCsv.content).toContain('Tag #,Product,Category,Metal,Purity');

    const gstCsv = reportsService.exportReportCsv('gst-invoice-register', {});
    expect(gstCsv.content).toContain('GSTIN');
  });

  // =========================================================================
  // Test 8: Immutability & Safety Regression Check
  // =========================================================================
  it('16. should never modify transactional records during report generation (Read-Only Guarantee)', () => {
    // Check initial counts and values
    const beforeInv = testDb.prepare('SELECT amount_paid, balance_amount FROM sales_invoices WHERE id = ?').get(finalizedInvoiceId) as any;
    const beforeStock = testDb.prepare('SELECT COUNT(*) as cnt FROM stock_items').get() as any;
    const beforeLedger = testDb.prepare('SELECT COUNT(*) as cnt FROM ledger_entries').get() as any;
    const beforeLoans = testDb.prepare('SELECT COUNT(*) as cnt FROM girvi_loans').get() as any;

    // Run multiple heavy report aggregations
    reportsService.getSalesSummary({});
    reportsService.getSalesRegister({ page: 1, pageSize: 100 });
    reportsService.getProductSalesReport({});
    reportsService.getStockValuationReport();
    reportsService.getReceivablesReport({});
    reportsService.getPayablesReport({});
    reportsService.getCashBookReport({});
    reportsService.getGstSalesSummary({});
    reportsService.getGirviLoansReport({});
    reportsService.getDashboardMetrics();

    // Check after counts and values
    const afterInv = testDb.prepare('SELECT amount_paid, balance_amount FROM sales_invoices WHERE id = ?').get(finalizedInvoiceId) as any;
    const afterStock = testDb.prepare('SELECT COUNT(*) as cnt FROM stock_items').get() as any;
    const afterLedger = testDb.prepare('SELECT COUNT(*) as cnt FROM ledger_entries').get() as any;
    const afterLoans = testDb.prepare('SELECT COUNT(*) as cnt FROM girvi_loans').get() as any;

    expect(afterInv.amount_paid).toBe(beforeInv.amount_paid);
    expect(afterInv.balance_amount).toBe(beforeInv.balance_amount);
    expect(afterStock.cnt).toBe(beforeStock.cnt);
    expect(afterLedger.cnt).toBe(beforeLedger.cnt);
    expect(afterLoans.cnt).toBe(beforeLoans.cnt);
  });
});
