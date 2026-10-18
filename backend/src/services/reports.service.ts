// backend/src/services/reports.service.ts
// Jewel Suite Part 10: Reports Business Service & CSV Generation

import { reportsRepository } from '../repositories/reports.repository.js';
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
  StockMovementReportItem,
  ReceivableReportItem,
  PayableReportItem,
  CashBookReport,
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
import {
  formatWeight,
  formatFineWeight,
  formatCurrency,
  formatPercentage,
  formatMetalRate,
} from '../utils/precision.js';

export function resolveDatePreset(preset?: string): { fromDate?: string; toDate?: string } {
  if (!preset || preset === 'all') return {};

  const now = new Date();
  const format = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today': {
      const today = format(now);
      return { fromDate: today, toDate: today };
    }
    case 'yesterday': {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const str = format(yest);
      return { fromDate: str, toDate: str };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { fromDate: format(start), toDate: format(end) };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromDate: format(start), toDate: format(end) };
    }
    case 'this_fy': {
      // Indian Financial Year: April 1 to March 31
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed: 0 = Jan, 3 = April
      let fyStartYear = currentYear;
      let fyEndYear = currentYear + 1;
      if (currentMonth < 3) {
        fyStartYear = currentYear - 1;
        fyEndYear = currentYear;
      }
      return {
        fromDate: `${fyStartYear}-04-01`,
        toDate: `${fyEndYear}-03-31`,
      };
    }
    default:
      return {};
  }
}

export function arrayToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

export class ReportsService {
  // Sales
  getSalesSummary(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    customerId?: string;
    status?: string;
    metalId?: string;
    purityId?: string;
    paymentStatus?: string;
  }): SalesSummaryReport {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getSalesSummary({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getSalesRegister(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    customerId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: SalesRegisterItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getSalesRegister({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getCustomerSalesReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: CustomerSalesReportItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getCustomerSalesReport({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getProductSalesReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: ProductSalesReportItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getProductSalesReport({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getMetalSalesReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
  }): MetalSalesReportItem[] {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getMetalSalesReport({
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  // Purchases
  getPurchaseSummary(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    supplierId?: string;
    status?: string;
  }): PurchaseSummaryReport {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getPurchaseSummary({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getPurchaseRegister(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    supplierId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: PurchaseRegisterItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getPurchaseRegister({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getSupplierPurchaseReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: SupplierPurchaseReportItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getSupplierPurchaseReport({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  // Inventory
  getCurrentStockReport(filter: {
    metalId?: string;
    purityId?: string;
    categoryId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: CurrentStockReportItem[]; total: number } {
    return reportsRepository.getCurrentStockReport(filter);
  }

  getStockValuationReport(): StockValuationReport {
    return reportsRepository.getStockValuationReport();
  }

  getStockMovementReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    movementType?: string;
    tagNo?: string;
    page?: number;
    pageSize?: number;
  }): { items: StockMovementReportItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getStockMovementReport({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  // Finance
  getReceivablesReport(filter: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: ReceivableReportItem[]; total: number; totalOutstanding: number } {
    return reportsRepository.getReceivablesReport(filter);
  }

  getPayablesReport(filter: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: PayableReportItem[]; total: number; totalOutstanding: number } {
    return reportsRepository.getPayablesReport(filter);
  }

  getCashBookReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
  }): CashBookReport {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getCashBookReport({
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getPaymentCollectionReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    paymentMode?: string;
    partyType?: string;
    page?: number;
    pageSize?: number;
  }): { items: PaymentCollectionReportItem[]; total: number; summary: PaymentCollectionSummary } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getPaymentCollectionReport({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getLedgerReport(
    partyType: string,
    partyId: string,
    filter: { preset?: string; fromDate?: string; toDate?: string; page?: number; pageSize?: number }
  ): { entries: LedgerReportItem[]; total: number; openingBalance: number; closingBalance: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getLedgerReport(partyType, partyId, {
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  // Workshop
  getKarigarJobReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    karigarId?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: KarigarJobReportItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getKarigarJobReport({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getKarigarLabourReport(filter: { search?: string }): { items: KarigarLabourReportItem[]; total: number } {
    return reportsRepository.getKarigarLabourReport(filter);
  }

  getRepairReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
    ownership?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: RepairReportItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getRepairReport({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  // Girvi
  getGirviLoansReport(filter: {
    overdueOnly?: boolean;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: GirviLoanReportItem[]; total: number; totalPrincipal: number; totalOutstanding: number } {
    return reportsRepository.getGirviLoansReport(filter);
  }

  // Saving Schemes
  getSavingSchemeRegister(filter: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: SavingSchemeReportItem[]; total: number } {
    return reportsRepository.getSavingSchemeRegister(filter);
  }

  getSchemeInstallmentCollectionReport(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): { items: InstallmentCollectionReportItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getSchemeInstallmentCollectionReport({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  // GST
  getGstSalesSummary(filter: { preset?: string; fromDate?: string; toDate?: string }): GstSalesSummaryReport {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getGstSalesSummary({
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getGstPurchaseSummary(filter: { preset?: string; fromDate?: string; toDate?: string }): GstPurchaseSummaryReport {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getGstPurchaseSummary({
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getHsnSummary(filter: { preset?: string; fromDate?: string; toDate?: string }): HsnSummaryReportItem[] {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getHsnSummary({
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  getGstInvoiceRegister(filter: {
    preset?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: GstInvoiceRegisterItem[]; total: number } {
    const dates = filter.preset ? resolveDatePreset(filter.preset) : {};
    return reportsRepository.getGstInvoiceRegister({
      ...filter,
      fromDate: filter.fromDate || dates.fromDate,
      toDate: filter.toDate || dates.toDate,
    });
  }

  // Header & Print info
  getShopReportHeader(reportName: string, fromDate?: string, toDate?: string): ShopReportHeader {
    return reportsRepository.getShopReportHeader(reportName, fromDate, toDate);
  }

  // Dashboard Metrics
  getDashboardMetrics() {
    return reportsRepository.getDashboardMetrics();
  }

  // CSV Generator for full dataset
  exportReportCsv(reportType: string, filter: any): { filename: string; content: string } {
    const timestamp = new Date().toISOString().split('T')[0];
    switch (reportType) {
      case 'sales-register': {
        const { items } = this.getSalesRegister({ ...filter, page: 1, pageSize: 100000 });
        const headers = [
          'Invoice #',
          'Date',
          'Customer',
          'Phone',
          'Gross Total',
          'Discount',
          'Taxable Amount',
          'GST Amount',
          'Exchange Amount',
          'Net Total',
          'Paid',
          'Balance',
          'Status',
          'Created By',
        ];
        const rows = items.map((i) => [
          i.invoiceNumber,
          i.invoiceDate,
          i.customerName,
          i.customerPhone,
          i.grandTotal,
          i.discountAmount,
          i.taxableAmount,
          i.gstAmount,
          i.exchangeAmount,
          i.netPayable,
          i.amountPaid,
          i.balanceAmount,
          i.status,
          i.createdByUsername,
        ]);
        return { filename: `sales_register_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'customer-sales': {
        const { items } = this.getCustomerSalesReport({ ...filter, page: 1, pageSize: 100000 });
        const headers = ['Customer Name', 'Phone', 'Invoices Count', 'Total Sales', 'Total Paid', 'Outstanding'];
        const rows = items.map((i) => [
          i.customerName,
          i.customerPhone,
          i.invoiceCount,
          i.totalSales,
          i.totalPaid,
          i.outstanding,
        ]);
        return { filename: `customer_sales_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'product-sales': {
        const { items } = this.getProductSalesReport({ ...filter, page: 1, pageSize: 100000 });
        const headers = [
          'Product',
          'Category',
          'Qty Sold',
          'Gross Wt (g)',
          'Net Wt (g)',
          'Fine Wt (g)',
          'Metal Value',
          'Making Charge',
          'Total Sales',
        ];
        const rows = items.map((i) => [
          i.productName,
          i.categoryName,
          i.itemsCount,
          formatWeight(i.grossWeight),
          formatWeight(i.netWeight),
          formatFineWeight(i.fineWeight),
          formatCurrency(i.metalValue, false),
          formatCurrency(i.makingCharge, false),
          formatCurrency(i.totalSales, false),
        ]);
        return { filename: `product_sales_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'purchase-register': {
        const { items } = this.getPurchaseRegister({ ...filter, page: 1, pageSize: 100000 });
        const headers = [
          'Purchase #',
          'Date',
          'Supplier',
          'Supplier Inv #',
          'Taxable Amount',
          'GST Amount',
          'Grand Total',
          'Paid',
          'Balance',
          'Status',
        ];
        const rows = items.map((i) => [
          i.purchaseNumber,
          i.purchaseDate,
          i.supplierName,
          i.supplierInvoiceNumber,
          formatCurrency(i.taxableAmount, false),
          formatCurrency(i.gstAmount, false),
          formatCurrency(i.grandTotal, false),
          formatCurrency(i.amountPaid, false),
          formatCurrency(i.balanceAmount, false),
          i.status,
        ]);
        return { filename: `purchase_register_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'current-stock': {
        const { items } = this.getCurrentStockReport({ ...filter, page: 1, pageSize: 100000 });
        const headers = [
          'Tag #',
          'Product',
          'Category',
          'Metal',
          'Purity',
          'Gross Wt (g)',
          'Net Wt (g)',
          'Fine Wt (g)',
          'Tunch %',
          'Rate/g',
          'Stock Value',
          'Status',
          'HUID',
        ];
        const rows = items.map((i) => [
          i.tagNo,
          i.productName,
          i.categoryName,
          i.metalName,
          i.purityName,
          formatWeight(i.grossWeight),
          formatWeight(i.netWeight),
          formatFineWeight(i.fineWeight),
          formatPercentage(i.tunchPercent, false),
          formatMetalRate(i.ratePerGram, false),
          formatCurrency(i.currentValue, false),
          i.status,
          i.huid || '',
        ]);
        return { filename: `current_stock_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'stock-movements': {
        const { items } = this.getStockMovementReport({ ...filter, page: 1, pageSize: 100000 });
        const headers = [
          'Date/Time',
          'Tag #',
          'Product',
          'Movement Type',
          'Reference Type',
          'Ref #',
          'From Status',
          'To Status',
          'Gross Wt (g)',
          'Net Wt (g)',
          'Fine Wt (g)',
          'Created By',
        ];
        const rows = items.map((i) => [
          i.createdAt,
          i.tagNo,
          i.productName,
          i.movementType,
          i.referenceType || '',
          i.referenceId || '',
          i.fromStatus || '',
          i.toStatus,
          formatWeight(i.grossWeight),
          formatWeight(i.netWeight),
          formatFineWeight(i.fineWeight),
          i.createdByUsername || '',
        ]);
        return { filename: `stock_movements_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'receivables': {
        const { items } = this.getReceivablesReport({ ...filter, page: 1, pageSize: 100000 });
        const headers = ['Customer Name', 'Phone', 'Total Sales', 'Total Receipts', 'Outstanding Balance'];
        const rows = items.map((i) => [
          i.customerName,
          i.customerPhone || '',
          i.totalSales,
          i.totalReceipts,
          i.outstanding,
        ]);
        return { filename: `receivables_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'payables': {
        const { items } = this.getPayablesReport({ ...filter, page: 1, pageSize: 100000 });
        const headers = ['Supplier Name', 'Phone', 'Total Purchases', 'Total Payments', 'Outstanding Payable'];
        const rows = items.map((i) => [
          i.supplierName,
          i.supplierPhone || '',
          i.totalPurchases,
          i.totalPayments,
          i.outstanding,
        ]);
        return { filename: `payables_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'cash-book': {
        const report = this.getCashBookReport(filter);
        const headers = ['Date', 'Reference #', 'Type', 'Description', 'Cash In (₹)', 'Cash Out (₹)', 'Running Balance (₹)'];
        const rows = report.entries.map((e) => [
          e.date,
          e.referenceNumber || '',
          e.referenceType || '',
          e.description,
          e.cashIn,
          e.cashOut,
          e.runningBalance,
        ]);
        return { filename: `cash_book_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'payment-collection': {
        const { items } = this.getPaymentCollectionReport({ ...filter, page: 1, pageSize: 100000 });
        const headers = ['Date', 'Party Name', 'Party Type', 'Mode', 'Amount', 'Reference #', 'Ref Type', 'User'];
        const rows = items.map((i) => [
          i.date,
          i.partyName,
          i.partyType,
          i.paymentMode,
          i.amount,
          i.referenceNumber || '',
          i.referenceType || '',
          i.createdByUsername || '',
        ]);
        return { filename: `payment_collection_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'gst-invoice-register': {
        const { items } = this.getGstInvoiceRegister({ ...filter, page: 1, pageSize: 100000 });
        const headers = [
          'Invoice #',
          'Date',
          'Customer',
          'GSTIN',
          'HSN',
          'Taxable Value',
          'GST Rate %',
          'GST Amount',
          'Grand Total',
        ];
        const rows = items.map((i) => [
          i.invoiceNumber,
          i.date,
          i.customerName,
          i.gstin || '',
          i.hsnCode,
          i.taxableValue,
          i.gstRate,
          i.gstAmount,
          i.grandTotal,
        ]);
        return { filename: `gst_invoice_register_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'girvi-loans': {
        const { items } = this.getGirviLoansReport({ ...filter, page: 1, pageSize: 100000 });
        const headers = [
          'Loan #',
          'Customer',
          'Phone',
          'Loan Date',
          'Due Date',
          'Principal',
          'Interest Rate %',
          'Total Interest',
          'Charges',
          'Repaid',
          'Outstanding',
          'Status',
        ];
        const rows = items.map((i) => [
          i.loanNumber,
          i.customerName,
          i.customerPhone || '',
          i.loanDate,
          i.dueDate,
          i.principalAmount,
          i.interestRate,
          i.totalInterest,
          i.totalCharges,
          i.totalRepaid,
          i.outstandingAmount,
          i.status,
        ]);
        return { filename: `girvi_loans_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      case 'saving-schemes': {
        const { items } = this.getSavingSchemeRegister({ ...filter, page: 1, pageSize: 100000 });
        const headers = [
          'Scheme #',
          'Customer',
          'Phone',
          'Scheme Plan',
          'Start Date',
          'Maturity Date',
          'Installment (₹)',
          'Total Inst.',
          'Paid Inst.',
          'Paid Total',
          'Maturity Amt',
          'Status',
        ];
        const rows = items.map((i) => [
          i.schemeNumber,
          i.customerName,
          i.customerPhone || '',
          i.schemeName,
          i.startDate,
          i.maturityDate,
          i.installmentAmount,
          i.totalInstallments,
          i.paidInstallments,
          i.paidAmount,
          i.maturityAmount,
          i.status,
        ]);
        return { filename: `saving_schemes_${timestamp}.csv`, content: arrayToCsv(headers, rows) };
      }
      default:
        throw new Error(`Unsupported report type for CSV export: ${reportType}`);
    }
  }
}

export const reportsService = new ReportsService();
