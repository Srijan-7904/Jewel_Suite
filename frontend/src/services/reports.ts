// frontend/src/services/reports.ts
// Jewel Suite Part 10: Frontend Reports API Client

import { request, getStoredToken, getApiUrl } from './api';

export interface DateFilterParams {
  preset?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

// 1. Sales
export interface SalesSummaryData {
  invoicesCount: number;
  grossSales: number;
  discount: number;
  taxableAmount: number;
  gstAmount: number;
  exchangeAmount: number;
  roundOff: number;
  netSales: number;
  amountPaid: number;
  outstanding: number;
}

export interface SalesRegisterItem {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  exchangeAmount: number;
  grandTotal: number;
  netPayable: number;
  amountPaid: number;
  balanceAmount: number;
  status: string;
  createdByUsername: string | null;
}

export interface CustomerSalesItem {
  customerId: string;
  customerName: string;
  customerPhone: string;
  invoiceCount: number;
  totalSales: number;
  totalPaid: number;
  outstanding: number;
}

export interface ProductSalesItem {
  productId?: string;
  productName: string;
  categoryName: string;
  itemsCount: number;
  grossWeight: number;
  netWeight: number;
  fineWeight: number;
  metalValue: number;
  makingCharge: number;
  totalSales: number;
}

export interface MetalSalesItem {
  metalId: string;
  metalName: string;
  itemsCount: number;
  grossWeight: number;
  netWeight: number;
  fineWeight: number;
  salesValue: number;
}

// 2. Purchase
export interface PurchaseSummaryData {
  billsCount: number;
  grossPurchase: number;
  discount: number;
  taxablePurchase: number;
  gstAmount: number;
  totalPurchase: number;
  amountPaid: number;
  outstandingPayable: number;
}

export interface PurchaseRegisterItem {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNumber: string | null;
  taxableAmount: number;
  gstAmount: number;
  grandTotal: number;
  amountPaid: number;
  balanceAmount: number;
  status: string;
}

export interface SupplierPurchaseItem {
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  billsCount: number;
  purchaseAmount: number;
  amountPaid: number;
  outstanding: number;
}

// 3. Inventory
export interface CurrentStockItem {
  id: string;
  tagNo: string;
  productName: string;
  categoryName: string;
  metalName: string;
  purityName: string;
  grossWeight: number;
  lessWeight: number;
  netWeight: number;
  tunchPercent: number;
  fineWeight: number;
  wastagePercent: number;
  makingCharge: number;
  ratePerGram: number;
  currentValue: number;
  status: string;
  huid?: string | null;
}

export interface StockValuationGroup {
  metalName: string;
  purityName: string;
  itemsCount: number;
  grossWeight: number;
  netWeight: number;
  fineWeight: number;
  currentRate: number;
  estimatedMetalValue: number;
  currentStockValue: number;
}

export interface StockValuationData {
  groups: StockValuationGroup[];
  totalItems: number;
  totalNetWeight: number;
  totalFineWeight: number;
  totalEstimatedMetalValue: number;
  totalStockValue: number;
}

export interface StockMovementItem {
  id: string;
  createdAt: string;
  tagNo: string;
  productName: string;
  movementType: string;
  referenceType: string | null;
  referenceId: string | null;
  fromStatus: string | null;
  toStatus: string;
  grossWeight: number;
  netWeight: number;
  fineWeight: number;
  createdByUsername: string | null;
  notes: string | null;
}

// 4. Finance
export interface ReceivableItem {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  totalSales: number;
  totalReceipts: number;
  outstanding: number;
}

export interface PayableItem {
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  totalPurchases: number;
  totalPayments: number;
  outstanding: number;
}

export interface CashBookEntry {
  id: string;
  date: string;
  referenceNumber: string | null;
  referenceType: string | null;
  description: string;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
}

export interface CashBookData {
  openingBalance: number;
  entries: CashBookEntry[];
  totalCashIn: number;
  totalCashOut: number;
  closingBalance: number;
}

export interface PaymentCollectionItem {
  id: string;
  date: string;
  partyName: string;
  partyType: string;
  paymentMode: string;
  amount: number;
  referenceNumber: string | null;
  referenceType: string | null;
  createdByUsername: string | null;
}

export interface PaymentCollectionSummary {
  totalCollection: number;
  cash: number;
  upi: number;
  card: number;
  bank: number;
  creditOther: number;
}

// 5. Workshop
export interface KarigarJobItem {
  id: string;
  jobNumber: string;
  karigarName: string;
  jobType: string;
  customerName: string | null;
  issueDate: string | null;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  status: string;
  estimatedLabour: number;
  actualLabour: number;
}

export interface KarigarLabourItem {
  karigarId: string;
  karigarName: string;
  phone: string | null;
  jobsCount: number;
  labourAmount: number;
  paidAmount: number;
  outstanding: number;
}

export interface RepairReportItem {
  id: string;
  repairNumber: string;
  customerName: string;
  ownership: string;
  itemDescription: string;
  tagNo: string | null;
  receivedDate: string;
  expectedCompletion: string | null;
  deliveredDate: string | null;
  status: string;
  estimatedCost: number;
  actualCost: number;
}

// 6. Girvi
export interface GirviLoanReportItem {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone: string | null;
  loanDate: string;
  dueDate: string;
  principalAmount: number;
  interestRate: number;
  totalInterest: number;
  totalCharges: number;
  totalRepaid: number;
  outstandingAmount: number;
  status: string;
  daysOverdue?: number;
}

// 7. Saving Schemes
export interface SavingSchemeReportItem {
  id: string;
  schemeNumber: string;
  customerName: string;
  customerPhone: string | null;
  schemeName: string;
  startDate: string;
  maturityDate: string;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  paidAmount: number;
  maturityAmount: number;
  status: string;
}

export interface InstallmentCollectionItem {
  id: string;
  schemeNumber: string;
  customerName: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  paymentDate: string | null;
  paymentMode: string | null;
  status: string;
}

// 8. GST
export interface GstSalesSummaryData {
  invoicesCount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  totalValue: number;
}

export interface GstPurchaseSummaryData {
  billsCount: number;
  taxablePurchase: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  totalPurchase: number;
}

export interface HsnSummaryItem {
  hsnCode: string;
  description: string;
  productCount: number;
  taxableValue: number;
  gstAmount: number;
  totalValue: number;
}

export interface GstInvoiceRegisterItem {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  gstin: string | null;
  hsnCode: string;
  taxableValue: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
}

// Shop Header
export interface ShopReportHeader {
  shopName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  reportName: string;
  dateRange: string;
  generatedOn: string;
}

// Dashboard Metrics
export interface DashboardMetricsData {
  todaySales: number;
  monthlySales: number;
  receivables: number;
  payables: number;
  stockValuation: number;
  activeLoansCount: number;
  activeLoansAmount: number;
  monthlyGstCollected: number;
}

function buildQuery(params: Record<string, any>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });
  const str = query.toString();
  return str ? `?${str}` : '';
}

export const reportsApi = {
  // Sales
  getSalesSummary: (params: DateFilterParams & { customerId?: string; status?: string; paymentStatus?: string } = {}) =>
    request<SalesSummaryData>(`/api/reports/sales-summary${buildQuery(params)}`),

  getSalesRegister: (params: DateFilterParams & PaginationParams & { customerId?: string; status?: string } = {}) =>
    request<{ items: SalesRegisterItem[]; total: number }>(`/api/reports/sales-register${buildQuery(params)}`),

  getCustomerSales: (params: DateFilterParams & PaginationParams = {}) =>
    request<{ items: CustomerSalesItem[]; total: number }>(`/api/reports/customer-sales${buildQuery(params)}`),

  getProductSales: (params: DateFilterParams & PaginationParams = {}) =>
    request<{ items: ProductSalesItem[]; total: number }>(`/api/reports/product-sales${buildQuery(params)}`),

  getMetalSales: (params: DateFilterParams = {}) =>
    request<MetalSalesItem[]>(`/api/reports/metal-sales${buildQuery(params)}`),

  // Purchase
  getPurchaseSummary: (params: DateFilterParams & { supplierId?: string; status?: string } = {}) =>
    request<PurchaseSummaryData>(`/api/reports/purchase-summary${buildQuery(params)}`),

  getPurchaseRegister: (params: DateFilterParams & PaginationParams & { supplierId?: string; status?: string } = {}) =>
    request<{ items: PurchaseRegisterItem[]; total: number }>(`/api/reports/purchase-register${buildQuery(params)}`),

  getSupplierPurchases: (params: DateFilterParams & PaginationParams = {}) =>
    request<{ items: SupplierPurchaseItem[]; total: number }>(`/api/reports/supplier-purchases${buildQuery(params)}`),

  // Inventory
  getCurrentStock: (params: PaginationParams & { metalId?: string; purityId?: string; categoryId?: string; status?: string } = {}) =>
    request<{ items: CurrentStockItem[]; total: number }>(`/api/reports/current-stock${buildQuery(params)}`),

  getStockValuation: () =>
    request<StockValuationData>('/api/reports/stock-valuation'),

  getStockMovements: (params: DateFilterParams & PaginationParams & { movementType?: string; tagNo?: string } = {}) =>
    request<{ items: StockMovementItem[]; total: number }>(`/api/reports/stock-movements${buildQuery(params)}`),

  // Finance
  getReceivables: (params: PaginationParams = {}) =>
    request<{ items: ReceivableItem[]; total: number; totalOutstanding: number }>(`/api/reports/receivables${buildQuery(params)}`),

  getPayables: (params: PaginationParams = {}) =>
    request<{ items: PayableItem[]; total: number; totalOutstanding: number }>(`/api/reports/payables${buildQuery(params)}`),

  getCashBook: (params: DateFilterParams = {}) =>
    request<CashBookData>(`/api/reports/cash-book${buildQuery(params)}`),

  getPayments: (params: DateFilterParams & PaginationParams & { paymentMode?: string; partyType?: string } = {}) =>
    request<{ items: PaymentCollectionItem[]; total: number; summary: PaymentCollectionSummary }>(`/api/reports/payments${buildQuery(params)}`),

  // Workshop
  getKarigarJobs: (params: DateFilterParams & PaginationParams & { karigarId?: string; status?: string } = {}) =>
    request<{ items: KarigarJobItem[]; total: number }>(`/api/reports/karigar-jobs${buildQuery(params)}`),

  getKarigarLabour: (params: { search?: string } = {}) =>
    request<{ items: KarigarLabourItem[]; total: number }>(`/api/reports/karigar-labour${buildQuery(params)}`),

  getRepairs: (params: DateFilterParams & PaginationParams & { status?: string; ownership?: string } = {}) =>
    request<{ items: RepairReportItem[]; total: number }>(`/api/reports/repairs${buildQuery(params)}`),

  // Girvi
  getGirviLoans: (params: PaginationParams & { overdueOnly?: boolean; status?: string } = {}) =>
    request<{ items: GirviLoanReportItem[]; total: number; totalPrincipal: number; totalOutstanding: number }>(`/api/reports/girvi-loans${buildQuery(params)}`),

  // Saving Schemes
  getSavingSchemes: (params: PaginationParams & { status?: string } = {}) =>
    request<{ items: SavingSchemeReportItem[]; total: number }>(`/api/reports/saving-schemes${buildQuery(params)}`),

  getSavingInstallments: (params: DateFilterParams & PaginationParams & { status?: string } = {}) =>
    request<{ items: InstallmentCollectionItem[]; total: number }>(`/api/reports/saving-installments${buildQuery(params)}`),

  // GST
  getGstSales: (params: DateFilterParams = {}) =>
    request<GstSalesSummaryData>(`/api/reports/gst-sales${buildQuery(params)}`),

  getGstPurchases: (params: DateFilterParams = {}) =>
    request<GstPurchaseSummaryData>(`/api/reports/gst-purchases${buildQuery(params)}`),

  getHsnSummary: (params: DateFilterParams = {}) =>
    request<HsnSummaryItem[]>(`/api/reports/hsn-summary${buildQuery(params)}`),

  getGstInvoiceRegister: (params: DateFilterParams & PaginationParams = {}) =>
    request<{ items: GstInvoiceRegisterItem[]; total: number }>(`/api/reports/gst-invoice-register${buildQuery(params)}`),

  // Header & Dashboard
  getShopHeader: (reportName: string, fromDate?: string, toDate?: string) =>
    request<ShopReportHeader>(`/api/reports/shop-header${buildQuery({ reportName, fromDate, toDate })}`),

  getDashboardMetrics: () =>
    request<DashboardMetricsData>('/api/reports/dashboard-metrics'),

  // CSV Direct Download Helper
  downloadCsv: async (reportType: string, params: Record<string, any> = {}): Promise<void> => {
    const token = getStoredToken();
    const query = buildQuery(params);
    const url = getApiUrl(`/api/reports/export/${reportType}${query}`);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to download CSV export');

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${reportType}_report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};
