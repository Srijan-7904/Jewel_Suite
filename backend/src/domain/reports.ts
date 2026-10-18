// backend/src/domain/reports.ts
// Jewel Suite Part 10: Reports and Analytics Domain Models

export interface ReportDateFilter {
  fromDate?: string;
  toDate?: string;
}

export interface PaginationFilter {
  page?: number;
  pageSize?: number;
  search?: string;
}

// 1. Sales Reports
export interface SalesSummaryReport {
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

export interface CustomerSalesReportItem {
  customerId: string;
  customerName: string;
  customerPhone: string;
  invoiceCount: number;
  totalSales: number;
  totalPaid: number;
  outstanding: number;
}

export interface ProductSalesReportItem {
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

export interface MetalSalesReportItem {
  metalId: string;
  metalName: string;
  itemsCount: number;
  grossWeight: number;
  netWeight: number;
  fineWeight: number;
  salesValue: number;
}

// 2. Purchase Reports
export interface PurchaseSummaryReport {
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

export interface SupplierPurchaseReportItem {
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  billsCount: number;
  purchaseAmount: number;
  amountPaid: number;
  outstanding: number;
}

// 3. Inventory Reports
export interface CurrentStockReportItem {
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

export interface StockValuationGroupItem {
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

export interface StockValuationReport {
  groups: StockValuationGroupItem[];
  totalItems: number;
  totalNetWeight: number;
  totalFineWeight: number;
  totalEstimatedMetalValue: number;
  totalStockValue: number;
}

export interface StockMovementReportItem {
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

// 4. Finance Reports
export interface ReceivableReportItem {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  totalSales: number;
  totalReceipts: number;
  outstanding: number;
}

export interface PayableReportItem {
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  totalPurchases: number;
  totalPayments: number;
  outstanding: number;
}

export interface CashBookEntryItem {
  id: string;
  date: string;
  referenceNumber: string | null;
  referenceType: string | null;
  description: string;
  partyName: string | null;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
}

export interface CashBookReport {
  openingBalance: number;
  entries: CashBookEntryItem[];
  totalCashIn: number;
  totalCashOut: number;
  closingBalance: number;
}

export interface PaymentCollectionReportItem {
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

// 5. Workshop & Karigar Reports
export interface KarigarJobReportItem {
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

export interface KarigarLabourReportItem {
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

// 6. Girvi Reports
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

// 7. Saving Schemes Reports
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

export interface InstallmentCollectionReportItem {
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

// 8. GST Reports
export interface GstSalesSummaryReport {
  invoicesCount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  totalValue: number;
}

export interface GstPurchaseSummaryReport {
  billsCount: number;
  taxablePurchase: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  totalPurchase: number;
}

export interface HsnSummaryReportItem {
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

// Shop Report Header (for printable views)
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
