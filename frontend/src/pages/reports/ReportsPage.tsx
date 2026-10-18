// frontend/src/pages/reports/ReportsPage.tsx
// Jewel Suite Part 10: Unified Reports & GST Analytics Dashboard

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  reportsApi,
  SalesSummaryData,
  SalesRegisterItem,
  CustomerSalesItem,
  ProductSalesItem,
  MetalSalesItem,
  PurchaseSummaryData,
  PurchaseRegisterItem,
  SupplierPurchaseItem,
  CurrentStockItem,
  StockValuationData,
  StockMovementItem,
  ReceivableItem,
  PayableItem,
  CashBookData,
  PaymentCollectionItem,
  PaymentCollectionSummary,
  KarigarJobItem,
  KarigarLabourItem,
  RepairReportItem,
  GirviLoanReportItem,
  SavingSchemeReportItem,
  InstallmentCollectionItem,
  GstSalesSummaryData,
  GstPurchaseSummaryData,
  HsnSummaryItem,
  GstInvoiceRegisterItem,
} from '../../services/reports';
import { ReportHeader } from './ReportHeader';
import { ReportFilters, FilterValues } from './ReportFilters';
import { ReportSummaryCards, SummaryCardItem } from './ReportSummaryCards';
import { ReportTable, ColumnDef } from './ReportTable';
import { ReportPrintView } from './ReportPrintView';
import {
  TrendingUp,
  Receipt,
  ShoppingCart,
  Boxes,
  Landmark,
  Hammer,
  BadgePercent,
  Coins,
  AlertCircle,
} from 'lucide-react';
import './ReportsPage.css';

type ReportCategory =
  | 'SALES'
  | 'PURCHASE'
  | 'INVENTORY'
  | 'FINANCE'
  | 'WORKSHOP'
  | 'GIRVI'
  | 'SAVING_SCHEMES'
  | 'GST';

export const ReportsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCategory = searchParams.get('category')?.toUpperCase() as ReportCategory | null;
  const urlReport = searchParams.get('report') || null;
  const urlPreset = (searchParams.get('preset') as any) || null;

  // Navigation State
  const [activeCategory, setActiveCategory] = useState<ReportCategory>(urlCategory || 'SALES');
  const [activeReportKey, setActiveReportKey] = useState<string>(urlReport || 'sales-summary');

  // Filter State
  const [filters, setFilters] = useState<FilterValues>({
    preset: urlPreset || 'this_month',
    fromDate: '',
    toDate: '',
    search: '',
  });

  // Keep state synchronized with URL query params
  useEffect(() => {
    const cat = searchParams.get('category')?.toUpperCase() as ReportCategory | null;
    const rep = searchParams.get('report');
    const preset = searchParams.get('preset') as any;

    if (cat && cat !== activeCategory) {
      setActiveCategory(cat);
    }
    if (rep && rep !== activeReportKey) {
      setActiveReportKey(rep);
    }
    if (preset && preset !== filters.preset) {
      setFilters((prev) => ({ ...prev, preset }));
    }
  }, [searchParams]);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Report Specific Data Containers
  const [salesSummary, setSalesSummary] = useState<SalesSummaryData | null>(null);
  const [salesRegister, setSalesRegister] = useState<SalesRegisterItem[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSalesItem[]>([]);
  const [productSales, setProductSales] = useState<ProductSalesItem[]>([]);
  const [metalSales, setMetalSales] = useState<MetalSalesItem[]>([]);

  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummaryData | null>(null);
  const [purchaseRegister, setPurchaseRegister] = useState<PurchaseRegisterItem[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchaseItem[]>([]);

  const [currentStock, setCurrentStock] = useState<CurrentStockItem[]>([]);
  const [stockValuation, setStockValuation] = useState<StockValuationData | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovementItem[]>([]);

  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [payables, setPayables] = useState<PayableItem[]>([]);
  const [cashBook, setCashBook] = useState<CashBookData | null>(null);
  const [payments, setPayments] = useState<PaymentCollectionItem[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentCollectionSummary | null>(null);

  const [karigarJobs, setKarigarJobs] = useState<KarigarJobItem[]>([]);
  const [karigarLabour, setKarigarLabour] = useState<KarigarLabourItem[]>([]);
  const [repairs, setRepairs] = useState<RepairReportItem[]>([]);

  const [girviLoans, setGirviLoans] = useState<GirviLoanReportItem[]>([]);
  const [savingSchemes, setSavingSchemes] = useState<SavingSchemeReportItem[]>([]);
  const [savingInstallments, setSavingInstallments] = useState<InstallmentCollectionItem[]>([]);

  const [gstSales, setGstSales] = useState<GstSalesSummaryData | null>(null);
  const [gstPurchases, setGstPurchases] = useState<GstPurchaseSummaryData | null>(null);
  const [hsnSummary, setHsnSummary] = useState<HsnSummaryItem[]>([]);
  const [gstInvoices, setGstInvoices] = useState<GstInvoiceRegisterItem[]>([]);

  // Format currency
  const fmt = (n?: number) =>
    `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Format weight
  const fmtWt = (n?: number) =>
    `${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;

  // Reset pagination when report or filters change
  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleReportSelect = (reportKey: string) => {
    setActiveReportKey(reportKey);
    setPage(1);
    setSearchParams({ category: activeCategory, report: reportKey, preset: filters.preset });
  };

  const handleCategorySelect = (category: ReportCategory, defaultReport: string) => {
    setActiveCategory(category);
    setActiveReportKey(defaultReport);
    setPage(1);
    setSearchParams({ category, report: defaultReport, preset: filters.preset });
  };

  // Fetch Report Data
  const loadReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const baseParams = {
        preset: filters.preset !== 'custom' ? filters.preset : undefined,
        fromDate: filters.preset === 'custom' ? filters.fromDate : undefined,
        toDate: filters.preset === 'custom' ? filters.toDate : undefined,
        search: filters.search || undefined,
        page,
        pageSize,
      };

      switch (activeReportKey) {
        // Sales
        case 'sales-summary': {
          const res = await reportsApi.getSalesSummary(baseParams);
          setSalesSummary(res);
          break;
        }
        case 'sales-register': {
          const res = await reportsApi.getSalesRegister(baseParams);
          setSalesRegister(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'customer-sales': {
          const res = await reportsApi.getCustomerSales(baseParams);
          setCustomerSales(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'product-sales': {
          const res = await reportsApi.getProductSales(baseParams);
          setProductSales(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'metal-sales': {
          const res = await reportsApi.getMetalSales(baseParams);
          setMetalSales(res);
          break;
        }

        // Purchase
        case 'purchase-summary': {
          const res = await reportsApi.getPurchaseSummary(baseParams);
          setPurchaseSummary(res);
          break;
        }
        case 'purchase-register': {
          const res = await reportsApi.getPurchaseRegister(baseParams);
          setPurchaseRegister(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'supplier-purchase': {
          const res = await reportsApi.getSupplierPurchases(baseParams);
          setSupplierPurchases(res.items);
          setTotalCount(res.total);
          break;
        }

        // Inventory
        case 'current-stock': {
          const res = await reportsApi.getCurrentStock(baseParams);
          setCurrentStock(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'stock-valuation': {
          const res = await reportsApi.getStockValuation();
          setStockValuation(res);
          break;
        }
        case 'stock-movements': {
          const res = await reportsApi.getStockMovements(baseParams);
          setStockMovements(res.items);
          setTotalCount(res.total);
          break;
        }

        // Finance
        case 'receivables': {
          const res = await reportsApi.getReceivables(baseParams);
          setReceivables(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'payables': {
          const res = await reportsApi.getPayables(baseParams);
          setPayables(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'cash-book': {
          const res = await reportsApi.getCashBook(baseParams);
          setCashBook(res);
          break;
        }
        case 'payments': {
          const res = await reportsApi.getPayments(baseParams);
          setPayments(res.items);
          setTotalCount(res.total);
          setPaymentSummary(res.summary);
          break;
        }

        // Workshop
        case 'karigar-jobs': {
          const res = await reportsApi.getKarigarJobs(baseParams);
          setKarigarJobs(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'karigar-labour': {
          const res = await reportsApi.getKarigarLabour({ search: filters.search });
          setKarigarLabour(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'repairs': {
          const res = await reportsApi.getRepairs(baseParams);
          setRepairs(res.items);
          setTotalCount(res.total);
          break;
        }

        // Girvi
        case 'active-loans': {
          const res = await reportsApi.getGirviLoans({ ...baseParams, overdueOnly: false });
          setGirviLoans(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'overdue-loans': {
          const res = await reportsApi.getGirviLoans({ ...baseParams, overdueOnly: true });
          setGirviLoans(res.items);
          setTotalCount(res.total);
          break;
        }

        // Saving Schemes
        case 'saving-schemes': {
          const res = await reportsApi.getSavingSchemes(baseParams);
          setSavingSchemes(res.items);
          setTotalCount(res.total);
          break;
        }
        case 'saving-installments': {
          const res = await reportsApi.getSavingInstallments(baseParams);
          setSavingInstallments(res.items);
          setTotalCount(res.total);
          break;
        }

        // GST
        case 'gst-sales': {
          const res = await reportsApi.getGstSales(baseParams);
          setGstSales(res);
          break;
        }
        case 'gst-purchases': {
          const res = await reportsApi.getGstPurchases(baseParams);
          setGstPurchases(res);
          break;
        }
        case 'hsn-summary': {
          const res = await reportsApi.getHsnSummary(baseParams);
          setHsnSummary(res);
          break;
        }
        case 'gst-invoice-register': {
          const res = await reportsApi.getGstInvoiceRegister(baseParams);
          setGstInvoices(res.items);
          setTotalCount(res.total);
          break;
        }
      }
    } catch (err: any) {
      console.error('Report fetch error:', err);
      setError(err.message || 'Failed to generate report data.');
    } finally {
      setLoading(false);
    }
  }, [activeReportKey, filters, page, pageSize]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Handle CSV Export
  const handleExportCsv = () => {
    const csvMapping: Record<string, string> = {
      'sales-register': 'sales-register',
      'customer-sales': 'customer-sales',
      'product-sales': 'product-sales',
      'purchase-register': 'purchase-register',
      'current-stock': 'current-stock',
      'stock-movements': 'stock-movements',
      'receivables': 'receivables',
      'payables': 'payables',
      'cash-book': 'cash-book',
      'payments': 'payment-collection',
      'gst-invoice-register': 'gst-invoice-register',
      'active-loans': 'girvi-loans',
      'overdue-loans': 'girvi-loans',
      'saving-schemes': 'saving-schemes',
    };

    const targetType = csvMapping[activeReportKey];
    if (!targetType) {
      alert('CSV export is currently available for registers and detail tables.');
      return;
    }

    reportsApi.downloadCsv(targetType, {
      preset: filters.preset !== 'custom' ? filters.preset : undefined,
      fromDate: filters.preset === 'custom' ? filters.fromDate : undefined,
      toDate: filters.preset === 'custom' ? filters.toDate : undefined,
      search: filters.search || undefined,
      overdueOnly: activeReportKey === 'overdue-loans' ? 'true' : undefined,
    });
  };

  // Helper metadata for active report
  const getReportMeta = () => {
    switch (activeReportKey) {
      case 'sales-summary':
        return {
          title: 'Sales Summary',
          category: 'Sales',
          desc: 'High-level commercial turnover, discounts, taxable value, GST, old gold exchange, and cash collections.',
        };
      case 'sales-register':
        return {
          title: 'Sales Register',
          category: 'Sales',
          desc: 'Comprehensive invoice register with party details, tax breakdown, settlement, and clerk audit.',
        };
      case 'customer-sales':
        return {
          title: 'Customer-wise Sales',
          category: 'Sales',
          desc: 'Sales performance, order frequency, and outstanding customer balances.',
        };
      case 'product-sales':
        return {
          title: 'Product-wise Sales',
          category: 'Sales',
          desc: 'Jewellery sales by product category, gross weight, net weight, fine weight, and making charge value.',
        };
      case 'metal-sales':
        return {
          title: 'Metal-wise Sales',
          category: 'Sales',
          desc: 'Turnover and total fine metal volume distributed across Gold, Silver, Platinum, and Diamonds.',
        };
      case 'purchase-summary':
        return {
          title: 'Purchase Summary',
          category: 'Purchase',
          desc: 'Inward bullion and jewellery acquisitions, supplier invoice totals, and input GST.',
        };
      case 'purchase-register':
        return {
          title: 'Purchase Register',
          category: 'Purchase',
          desc: 'Detailed procurement bills, supplier invoice references, tax payments, and payables.',
        };
      case 'supplier-purchase':
        return {
          title: 'Supplier-wise Purchases',
          category: 'Purchase',
          desc: 'Volume of gold/silver received per refiner/wholesaler with payment settlements.',
        };
      case 'current-stock':
        return {
          title: 'Current Stock Report',
          category: 'Inventory',
          desc: 'Live shop inventory with gross, less, net, and fine weights, tunch %, making charges, and status.',
        };
      case 'stock-valuation':
        return {
          title: 'Stock Valuation Report',
          category: 'Inventory',
          desc: 'Current metal valuation of all physical in-stock inventory computed using real-time market board rates.',
        };
      case 'stock-movements':
        return {
          title: 'Stock Movements Audit',
          category: 'Inventory',
          desc: 'Complete immutable audit log of inward, sale, exchange, repair, karigar issue, and adjustment movements.',
        };
      case 'receivables':
        return {
          title: 'Accounts Receivable',
          category: 'Finance',
          desc: 'Outstanding customer balances ranked from highest balance to lowest.',
        };
      case 'payables':
        return {
          title: 'Accounts Payable',
          category: 'Finance',
          desc: 'Outstanding supplier and refiner debts ranked from highest payable to lowest.',
        };
      case 'cash-book':
        return {
          title: 'Physical Cash Book',
          category: 'Finance',
          desc: 'Strict drawer cash book containing physical cash only (UPI, Card, and Bank entries excluded).',
        };
      case 'payments':
        return {
          title: 'Payment Collection Report',
          category: 'Finance',
          desc: 'Daily payment vouchers and collections classified by payment mode (Cash, UPI, Card, Bank).',
        };
      case 'karigar-jobs':
        return {
          title: 'Karigar Jobs Register',
          category: 'Workshop',
          desc: 'Jewellery manufacturing and repair orders currently assigned to or returned by artisans.',
        };
      case 'karigar-labour':
        return {
          title: 'Karigar Labour Report',
          category: 'Workshop',
          desc: 'Making charges earned, paid, and outstanding payable to each workshop artisan.',
        };
      case 'repairs':
        return {
          title: 'Repair Register',
          category: 'Workshop',
          desc: 'Customer repair jobs clearly separating customer-owned articles from shop inventory.',
        };
      case 'active-loans':
        return {
          title: 'Active Girvi Loans',
          category: 'Girvi Loans',
          desc: 'Active and partially paid pledged jewellery loans with customer and interest information.',
        };
      case 'overdue-loans':
        return {
          title: 'Overdue Girvi Loans',
          category: 'Girvi Loans',
          desc: 'Loans exceeding their maturity due date with pending principal and interest balances.',
        };
      case 'saving-schemes':
        return {
          title: 'Saving Schemes Register',
          category: 'Saving Schemes',
          desc: 'Active customer jewellery chits, paid installments, accumulated value, and maturity dates.',
        };
      case 'saving-installments':
        return {
          title: 'Installment Collections',
          category: 'Saving Schemes',
          desc: 'Monthly customer chit collections, due dates, paid dates, and payment modes.',
        };
      case 'gst-sales':
        return {
          title: 'GST Sales Summary',
          category: 'GST & Compliance',
          desc: 'Official GST tax liability summary for finalized sales (CGST & SGST intra-state distribution).',
        };
      case 'gst-purchases':
        return {
          title: 'GST Purchase Summary',
          category: 'GST & Compliance',
          desc: 'Input tax credit (ITC) summary on bullion and inventory purchases.',
        };
      case 'hsn-summary':
        return {
          title: 'HSN Summary',
          category: 'GST & Compliance',
          desc: 'Harmonized System of Nomenclature (HSN Chapter 7113) sales, tax, and invoice quantities.',
        };
      case 'gst-invoice-register':
        return {
          title: 'GST Invoice Register',
          category: 'GST & Compliance',
          desc: 'B2B and B2C finalized tax invoices formatted for GSTR-1 audit and compliance filing.',
        };
      default:
        return { title: 'Business Report', category: 'Reports', desc: 'Authoritative data from SQLite.' };
    }
  };

  const meta = getReportMeta();

  // Generate Summary Cards based on active report
  const renderSummaryCards = (): SummaryCardItem[] => {
    if (activeReportKey === 'sales-summary' && salesSummary) {
      return [
        { label: 'Invoices Count', value: salesSummary.invoicesCount, icon: <Receipt size={18} /> },
        { label: 'Gross Sales', value: fmt(salesSummary.grossSales), highlight: 'neutral' },
        { label: 'Discount', value: fmt(salesSummary.discount), highlight: 'red' },
        { label: 'Taxable Amount', value: fmt(salesSummary.taxableAmount), highlight: 'blue' },
        { label: 'GST (3%)', value: fmt(salesSummary.gstAmount), highlight: 'purple' },
        { label: 'Old Gold Exchanged', value: fmt(salesSummary.exchangeAmount), highlight: 'gold' },
        { label: 'Net Sales', value: fmt(salesSummary.netSales), highlight: 'green' },
        { label: 'Amount Received', value: fmt(salesSummary.amountPaid), highlight: 'green' },
        { label: 'Outstanding Balance', value: fmt(salesSummary.outstanding), highlight: 'red' },
      ];
    }

    if (activeReportKey === 'purchase-summary' && purchaseSummary) {
      return [
        { label: 'Purchase Bills', value: purchaseSummary.billsCount, icon: <ShoppingCart size={18} /> },
        { label: 'Gross Purchases', value: fmt(purchaseSummary.grossPurchase), highlight: 'neutral' },
        { label: 'Discount', value: fmt(purchaseSummary.discount), highlight: 'green' },
        { label: 'Taxable Purchase', value: fmt(purchaseSummary.taxablePurchase), highlight: 'blue' },
        { label: 'Input GST', value: fmt(purchaseSummary.gstAmount), highlight: 'purple' },
        { label: 'Total Purchases', value: fmt(purchaseSummary.totalPurchase), highlight: 'neutral' },
        { label: 'Paid to Suppliers', value: fmt(purchaseSummary.amountPaid), highlight: 'green' },
        { label: 'Outstanding Payable', value: fmt(purchaseSummary.outstandingPayable), highlight: 'red' },
      ];
    }

    if (activeReportKey === 'stock-valuation' && stockValuation) {
      return [
        { label: 'Physical Items', value: stockValuation.totalItems, icon: <Boxes size={18} /> },
        { label: 'Total Net Weight', value: fmtWt(stockValuation.totalNetWeight), highlight: 'gold' },
        { label: 'Pure Fine Weight', value: fmtWt(stockValuation.totalFineWeight), highlight: 'gold' },
        { label: 'Estimated Market Value', value: fmt(stockValuation.totalEstimatedMetalValue), highlight: 'green' },
        { label: 'Historical Stock Value', value: fmt(stockValuation.totalStockValue), highlight: 'blue' },
      ];
    }

    if (activeReportKey === 'cash-book' && cashBook) {
      return [
        { label: 'Opening Physical Cash', value: fmt(cashBook.openingBalance), highlight: 'neutral' },
        { label: 'Total Cash Receipts (+)', value: fmt(cashBook.totalCashIn), highlight: 'green' },
        { label: 'Total Cash Payments (-)', value: fmt(cashBook.totalCashOut), highlight: 'red' },
        { label: 'Closing Drawer Cash', value: fmt(cashBook.closingBalance), highlight: 'gold' },
      ];
    }

    if (activeReportKey === 'payments' && paymentSummary) {
      return [
        { label: 'Total Collections', value: fmt(paymentSummary.totalCollection), highlight: 'green' },
        { label: 'Cash in Hand', value: fmt(paymentSummary.cash), highlight: 'gold' },
        { label: 'UPI QR Codes', value: fmt(paymentSummary.upi), highlight: 'blue' },
        { label: 'POS Cards', value: fmt(paymentSummary.card), highlight: 'purple' },
        { label: 'Bank Transfers', value: fmt(paymentSummary.bank), highlight: 'neutral' },
      ];
    }

    if (activeReportKey === 'gst-sales' && gstSales) {
      return [
        { label: 'Finalized Invoices', value: gstSales.invoicesCount, icon: <Receipt size={18} /> },
        { label: 'Taxable Turnover', value: fmt(gstSales.taxableValue), highlight: 'blue' },
        { label: 'CGST (1.5%)', value: fmt(gstSales.cgstAmount), highlight: 'purple' },
        { label: 'SGST (1.5%)', value: fmt(gstSales.sgstAmount), highlight: 'purple' },
        { label: 'Total GST Liability', value: fmt(gstSales.totalGst), highlight: 'red' },
        { label: 'Gross Invoice Value', value: fmt(gstSales.totalValue), highlight: 'green' },
      ];
    }

    if (activeReportKey === 'gst-purchases' && gstPurchases) {
      return [
        { label: 'Purchase Bills', value: gstPurchases.billsCount, icon: <ShoppingCart size={18} /> },
        { label: 'Taxable Purchases', value: fmt(gstPurchases.taxablePurchase), highlight: 'blue' },
        { label: 'CGST Input (1.5%)', value: fmt(gstPurchases.cgstAmount), highlight: 'purple' },
        { label: 'SGST Input (1.5%)', value: fmt(gstPurchases.sgstAmount), highlight: 'purple' },
        { label: 'Total ITC Claimable', value: fmt(gstPurchases.totalGst), highlight: 'green' },
        { label: 'Total Purchase Cost', value: fmt(gstPurchases.totalPurchase), highlight: 'neutral' },
      ];
    }

    return [];
  };

  // Render Table Content based on active report
  const renderTableContent = () => {
    switch (activeReportKey) {
      case 'sales-register': {
        const columns: ColumnDef<SalesRegisterItem>[] = [
          { header: 'Invoice #', render: (r) => <span className="font-mono font-bold text-gold">{r.invoiceNumber}</span> },
          { header: 'Date', render: (r) => <span className="font-mono">{r.invoiceDate}</span> },
          {
            header: 'Customer',
            render: (r) => (
              <div>
                <div className="font-bold">{r.customerName}</div>
                <div className="text-xs text-muted font-mono">{r.customerPhone}</div>
              </div>
            ),
          },
          { header: 'Taxable Value', render: (r) => <span className="font-mono">{fmt(r.taxableAmount)}</span>, align: 'right' },
          { header: 'GST', render: (r) => <span className="font-mono text-purple">{fmt(r.gstAmount)}</span>, align: 'right' },
          { header: 'Exchange', render: (r) => <span className="font-mono text-gold">{fmt(r.exchangeAmount)}</span>, align: 'right' },
          { header: 'Grand Total', render: (r) => <span className="font-mono font-bold">{fmt(r.grandTotal)}</span>, align: 'right' },
          { header: 'Paid', render: (r) => <span className="font-mono text-green">{fmt(r.amountPaid)}</span>, align: 'right' },
          {
            header: 'Balance',
            render: (r) => (
              <span className={`font-mono font-bold ${r.balanceAmount > 0 ? 'text-red' : 'text-muted'}`}>
                {fmt(r.balanceAmount)}
              </span>
            ),
            align: 'right',
          },
          {
            header: 'Status',
            render: (r) => <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>,
            align: 'center',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={salesRegister}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'customer-sales': {
        const columns: ColumnDef<CustomerSalesItem>[] = [
          {
            header: 'Customer',
            render: (r) => (
              <div>
                <div className="font-bold text-gold">{r.customerName}</div>
                <div className="text-xs text-muted font-mono">{r.customerPhone}</div>
              </div>
            ),
          },
          { header: 'Invoices', render: (r) => <span className="font-mono">{r.invoiceCount}</span>, align: 'center' },
          { header: 'Total Sales', render: (r) => <span className="font-mono font-bold">{fmt(r.totalSales)}</span>, align: 'right' },
          { header: 'Total Paid', render: (r) => <span className="font-mono text-green">{fmt(r.totalPaid)}</span>, align: 'right' },
          {
            header: 'Outstanding Balance',
            render: (r) => (
              <span className={`font-mono font-bold ${r.outstanding > 0 ? 'text-red' : 'text-muted'}`}>
                {fmt(r.outstanding)}
              </span>
            ),
            align: 'right',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={customerSales}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'product-sales': {
        const columns: ColumnDef<ProductSalesItem>[] = [
          { header: 'Product Name', render: (r) => <span className="font-bold">{r.productName}</span> },
          { header: 'Category', render: (r) => <span className="text-muted">{r.categoryName}</span> },
          { header: 'Sold Qty', render: (r) => <span className="font-mono">{r.itemsCount}</span>, align: 'center' },
          { header: 'Gross Weight', render: (r) => <span className="font-mono">{fmtWt(r.grossWeight)}</span>, align: 'right' },
          { header: 'Net Weight', render: (r) => <span className="font-mono font-bold text-gold">{fmtWt(r.netWeight)}</span>, align: 'right' },
          { header: 'Fine Weight', render: (r) => <span className="font-mono text-muted">{fmtWt(r.fineWeight)}</span>, align: 'right' },
          { header: 'Metal Value', render: (r) => <span className="font-mono">{fmt(r.metalValue)}</span>, align: 'right' },
          { header: 'Making Charges', render: (r) => <span className="font-mono">{fmt(r.makingCharge)}</span>, align: 'right' },
          { header: 'Total Sales', render: (r) => <span className="font-mono font-bold text-green">{fmt(r.totalSales)}</span>, align: 'right' },
        ];
        return (
          <ReportTable
            columns={columns}
            data={productSales}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'metal-sales': {
        const columns: ColumnDef<MetalSalesItem>[] = [
          { header: 'Precious Metal', render: (r) => <span className="font-bold text-gold">{r.metalName}</span> },
          { header: 'Items Sold', render: (r) => <span className="font-mono">{r.itemsCount}</span>, align: 'center' },
          { header: 'Gross Weight', render: (r) => <span className="font-mono">{fmtWt(r.grossWeight)}</span>, align: 'right' },
          { header: 'Net Weight', render: (r) => <span className="font-mono font-bold">{fmtWt(r.netWeight)}</span>, align: 'right' },
          { header: 'Pure Fine Weight', render: (r) => <span className="font-mono text-gold">{fmtWt(r.fineWeight)}</span>, align: 'right' },
          { header: 'Total Sales Value', render: (r) => <span className="font-mono font-bold text-green">{fmt(r.salesValue)}</span>, align: 'right' },
        ];
        return <ReportTable columns={columns} data={metalSales} loading={loading} />;
      }

      case 'purchase-register': {
        const columns: ColumnDef<PurchaseRegisterItem>[] = [
          { header: 'Bill #', render: (r) => <span className="font-mono font-bold text-gold">{r.purchaseNumber}</span> },
          { header: 'Date', render: (r) => <span className="font-mono">{r.purchaseDate}</span> },
          { header: 'Supplier', render: (r) => <span className="font-bold">{r.supplierName}</span> },
          { header: 'Supplier Inv #', render: (r) => <span className="font-mono text-muted">{r.supplierInvoiceNumber || '-'}</span> },
          { header: 'Taxable Amount', render: (r) => <span className="font-mono">{fmt(r.taxableAmount)}</span>, align: 'right' },
          { header: 'GST Amount', render: (r) => <span className="font-mono text-purple">{fmt(r.gstAmount)}</span>, align: 'right' },
          { header: 'Grand Total', render: (r) => <span className="font-mono font-bold">{fmt(r.grandTotal)}</span>, align: 'right' },
          { header: 'Paid', render: (r) => <span className="font-mono text-green">{fmt(r.amountPaid)}</span>, align: 'right' },
          {
            header: 'Payable Balance',
            render: (r) => (
              <span className={`font-mono font-bold ${r.balanceAmount > 0 ? 'text-red' : 'text-muted'}`}>
                {fmt(r.balanceAmount)}
              </span>
            ),
            align: 'right',
          },
          {
            header: 'Status',
            render: (r) => <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>,
            align: 'center',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={purchaseRegister}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'supplier-purchase': {
        const columns: ColumnDef<SupplierPurchaseItem>[] = [
          {
            header: 'Supplier / Refiner',
            render: (r) => (
              <div>
                <div className="font-bold text-gold">{r.supplierName}</div>
                <div className="text-xs text-muted font-mono">{r.supplierPhone || ''}</div>
              </div>
            ),
          },
          { header: 'Purchase Bills', render: (r) => <span className="font-mono">{r.billsCount}</span>, align: 'center' },
          { header: 'Total Purchases', render: (r) => <span className="font-mono font-bold">{fmt(r.purchaseAmount)}</span>, align: 'right' },
          { header: 'Paid Amount', render: (r) => <span className="font-mono text-green">{fmt(r.amountPaid)}</span>, align: 'right' },
          {
            header: 'Outstanding Payable',
            render: (r) => (
              <span className={`font-mono font-bold ${r.outstanding > 0 ? 'text-red' : 'text-muted'}`}>
                {fmt(r.outstanding)}
              </span>
            ),
            align: 'right',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={supplierPurchases}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'current-stock': {
        const columns: ColumnDef<CurrentStockItem>[] = [
          { header: 'Tag #', render: (r) => <span className="font-mono font-bold text-gold">{r.tagNo}</span> },
          { header: 'Product', render: (r) => <span className="font-bold">{r.productName}</span> },
          { header: 'Category', render: (r) => <span className="text-muted">{r.categoryName}</span> },
          { header: 'Metal / Purity', render: (r) => <span>{r.metalName} ({r.purityName})</span> },
          { header: 'Gross Wt', render: (r) => <span className="font-mono">{fmtWt(r.grossWeight)}</span>, align: 'right' },
          { header: 'Net Wt', render: (r) => <span className="font-mono font-bold text-gold">{fmtWt(r.netWeight)}</span>, align: 'right' },
          { header: 'Tunch %', render: (r) => <span className="font-mono">{r.tunchPercent}%</span>, align: 'right' },
          { header: 'Fine Wt', render: (r) => <span className="font-mono text-muted">{fmtWt(r.fineWeight)}</span>, align: 'right' },
          { header: 'Rate/g', render: (r) => <span className="font-mono">{fmt(r.ratePerGram)}</span>, align: 'right' },
          { header: 'Stock Value', render: (r) => <span className="font-mono font-bold text-green">{fmt(r.currentValue)}</span>, align: 'right' },
          {
            header: 'Status',
            render: (r) => <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>,
            align: 'center',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={currentStock}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'stock-valuation': {
        const columns: ColumnDef<any>[] = [
          { header: 'Metal & Purity', render: (r) => <span className="font-bold text-gold">{r.metalName} ({r.purityName})</span> },
          { header: 'Physical Items', render: (r) => <span className="font-mono">{r.itemsCount}</span>, align: 'center' },
          { header: 'Total Gross Wt', render: (r) => <span className="font-mono">{fmtWt(r.grossWeight)}</span>, align: 'right' },
          { header: 'Total Net Wt', render: (r) => <span className="font-mono font-bold">{fmtWt(r.netWeight)}</span>, align: 'right' },
          { header: 'Pure Fine Wt', render: (r) => <span className="font-mono text-gold">{fmtWt(r.fineWeight)}</span>, align: 'right' },
          { header: 'Live Metal Rate', render: (r) => <span className="font-mono text-purple">{fmt(r.currentRate)}/g</span>, align: 'right' },
          { header: 'Estimated Metal Value', render: (r) => <span className="font-mono font-bold text-green">{fmt(r.estimatedMetalValue)}</span>, align: 'right' },
          { header: 'Historical Acquisition Value', render: (r) => <span className="font-mono text-muted">{fmt(r.currentStockValue)}</span>, align: 'right' },
        ];
        return <ReportTable columns={columns} data={stockValuation?.groups || []} loading={loading} />;
      }

      case 'stock-movements': {
        const columns: ColumnDef<StockMovementItem>[] = [
          { header: 'Date & Time', render: (r) => <span className="font-mono text-xs">{r.createdAt}</span> },
          { header: 'Tag #', render: (r) => <span className="font-mono font-bold text-gold">{r.tagNo}</span> },
          { header: 'Product', render: (r) => <span>{r.productName}</span> },
          {
            header: 'Movement Type',
            render: (r) => <span className="movement-pill font-mono text-xs">{r.movementType}</span>,
            align: 'center',
          },
          { header: 'From State', render: (r) => <span className="text-muted">{r.fromStatus || '-'}</span> },
          { header: 'To State', render: (r) => <span className="font-bold">{r.toStatus}</span> },
          { header: 'Net Wt', render: (r) => <span className="font-mono">{fmtWt(r.netWeight)}</span>, align: 'right' },
          { header: 'Fine Wt', render: (r) => <span className="font-mono text-gold">{fmtWt(r.fineWeight)}</span>, align: 'right' },
          { header: 'User', render: (r) => <span className="text-muted text-xs">{r.createdByUsername || 'System'}</span> },
        ];
        return (
          <ReportTable
            columns={columns}
            data={stockMovements}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'receivables': {
        const columns: ColumnDef<ReceivableItem>[] = [
          {
            header: 'Customer',
            render: (r) => (
              <div>
                <div className="font-bold text-gold">{r.customerName}</div>
                <div className="text-xs text-muted font-mono">{r.customerPhone || ''}</div>
              </div>
            ),
          },
          { header: 'Total Invoiced Sales', render: (r) => <span className="font-mono font-bold">{fmt(r.totalSales)}</span>, align: 'right' },
          { header: 'Total Receipts Paid', render: (r) => <span className="font-mono text-green">{fmt(r.totalReceipts)}</span>, align: 'right' },
          {
            header: 'Outstanding Balance',
            render: (r) => (
              <span className={`font-mono font-bold ${r.outstanding > 0 ? 'text-red' : 'text-muted'}`}>
                {fmt(r.outstanding)}
              </span>
            ),
            align: 'right',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={receivables}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'payables': {
        const columns: ColumnDef<PayableItem>[] = [
          {
            header: 'Supplier / Refiner',
            render: (r) => (
              <div>
                <div className="font-bold text-gold">{r.supplierName}</div>
                <div className="text-xs text-muted font-mono">{r.supplierPhone || ''}</div>
              </div>
            ),
          },
          { header: 'Total Purchases Inward', render: (r) => <span className="font-mono font-bold">{fmt(r.totalPurchases)}</span>, align: 'right' },
          { header: 'Total Payments Made', render: (r) => <span className="font-mono text-green">{fmt(r.totalPayments)}</span>, align: 'right' },
          {
            header: 'Outstanding Payable',
            render: (r) => (
              <span className={`font-mono font-bold ${r.outstanding > 0 ? 'text-red' : 'text-muted'}`}>
                {fmt(r.outstanding)}
              </span>
            ),
            align: 'right',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={payables}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'cash-book': {
        const columns: ColumnDef<any>[] = [
          { header: 'Date', render: (r) => <span className="font-mono">{r.date}</span> },
          { header: 'Voucher #', render: (r) => <span className="font-mono text-gold">{r.referenceNumber || '-'}</span> },
          { header: 'Description', render: (r) => <span>{r.description}</span> },
          {
            header: 'Cash Received (+)',
            render: (r) => (
              <span className={`font-mono ${r.cashIn > 0 ? 'text-green font-bold' : 'text-muted'}`}>
                {r.cashIn > 0 ? fmt(r.cashIn) : '-'}
              </span>
            ),
            align: 'right',
          },
          {
            header: 'Cash Paid (-)',
            render: (r) => (
              <span className={`font-mono ${r.cashOut > 0 ? 'text-red font-bold' : 'text-muted'}`}>
                {r.cashOut > 0 ? fmt(r.cashOut) : '-'}
              </span>
            ),
            align: 'right',
          },
          { header: 'Running Physical Cash', render: (r) => <span className="font-mono font-bold text-gold">{fmt(r.runningBalance)}</span>, align: 'right' },
        ];
        return <ReportTable columns={columns} data={cashBook?.entries || []} loading={loading} />;
      }

      case 'payments': {
        const columns: ColumnDef<PaymentCollectionItem>[] = [
          { header: 'Date', render: (r) => <span className="font-mono">{r.date}</span> },
          {
            header: 'Party',
            render: (r) => (
              <div>
                <div className="font-bold">{r.partyName}</div>
                <div className="text-xs text-muted">{r.partyType}</div>
              </div>
            ),
          },
          {
            header: 'Payment Mode',
            render: (r) => <span className={`mode-badge ${r.paymentMode.toLowerCase()}`}>{r.paymentMode}</span>,
            align: 'center',
          },
          { header: 'Amount', render: (r) => <span className="font-mono font-bold text-green">{fmt(r.amount)}</span>, align: 'right' },
          { header: 'Voucher / Ref #', render: (r) => <span className="font-mono text-muted">{r.referenceNumber || '-'}</span> },
          { header: 'Clerk', render: (r) => <span className="text-muted text-xs">{r.createdByUsername || 'Admin'}</span> },
        ];
        return (
          <ReportTable
            columns={columns}
            data={payments}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'karigar-jobs': {
        const columns: ColumnDef<KarigarJobItem>[] = [
          { header: 'Job #', render: (r) => <span className="font-mono font-bold text-gold">{r.jobNumber}</span> },
          { header: 'Artisan / Karigar', render: (r) => <span className="font-bold">{r.karigarName}</span> },
          { header: 'Job Type', render: (r) => <span className="status-badge manufacturing">{r.jobType}</span>, align: 'center' },
          { header: 'Customer', render: (r) => <span>{r.customerName || 'Shop Stock'}</span> },
          { header: 'Issue Date', render: (r) => <span className="font-mono">{r.issueDate || '-'}</span> },
          { header: 'Expected Return', render: (r) => <span className="font-mono">{r.expectedReturnDate || '-'}</span> },
          { header: 'Actual Labour', render: (r) => <span className="font-mono text-green">{fmt(r.actualLabour || r.estimatedLabour)}</span>, align: 'right' },
          {
            header: 'Status',
            render: (r) => <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>,
            align: 'center',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={karigarJobs}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'karigar-labour': {
        const columns: ColumnDef<KarigarLabourItem>[] = [
          {
            header: 'Artisan / Karigar',
            render: (r) => (
              <div>
                <div className="font-bold text-gold">{r.karigarName}</div>
                <div className="text-xs text-muted font-mono">{r.phone || ''}</div>
              </div>
            ),
          },
          { header: 'Completed Jobs', render: (r) => <span className="font-mono">{r.jobsCount}</span>, align: 'center' },
          { header: 'Total Labour Billed', render: (r) => <span className="font-mono font-bold">{fmt(r.labourAmount)}</span>, align: 'right' },
          { header: 'Amount Paid', render: (r) => <span className="font-mono text-green">{fmt(r.paidAmount)}</span>, align: 'right' },
          {
            header: 'Labour Outstanding',
            render: (r) => (
              <span className={`font-mono font-bold ${r.outstanding > 0 ? 'text-red' : 'text-muted'}`}>
                {fmt(r.outstanding)}
              </span>
            ),
            align: 'right',
          },
        ];
        return <ReportTable columns={columns} data={karigarLabour} loading={loading} />;
      }

      case 'repairs': {
        const columns: ColumnDef<RepairReportItem>[] = [
          { header: 'Repair #', render: (r) => <span className="font-mono font-bold text-gold">{r.repairNumber}</span> },
          { header: 'Customer', render: (r) => <span className="font-bold">{r.customerName}</span> },
          {
            header: 'Ownership',
            render: (r) => (
              <span className={`ownership-pill ${r.ownership === 'CUSTOMER_OWNED' ? 'customer' : 'shop'}`}>
                {r.ownership === 'CUSTOMER_OWNED' ? 'Customer Owned' : 'Shop Stock'}
              </span>
            ),
            align: 'center',
          },
          { header: 'Description', render: (r) => <span>{r.itemDescription}</span> },
          { header: 'Received Date', render: (r) => <span className="font-mono">{r.receivedDate}</span> },
          { header: 'Cost Charged', render: (r) => <span className="font-mono text-green">{fmt(r.actualCost || r.estimatedCost)}</span>, align: 'right' },
          {
            header: 'Status',
            render: (r) => <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>,
            align: 'center',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={repairs}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'active-loans':
      case 'overdue-loans': {
        const columns: ColumnDef<GirviLoanReportItem>[] = [
          { header: 'Loan #', render: (r) => <span className="font-mono font-bold text-gold">{r.loanNumber}</span> },
          {
            header: 'Customer',
            render: (r) => (
              <div>
                <div className="font-bold">{r.customerName}</div>
                <div className="text-xs text-muted font-mono">{r.customerPhone || ''}</div>
              </div>
            ),
          },
          { header: 'Loan Date', render: (r) => <span className="font-mono">{r.loanDate}</span> },
          {
            header: 'Due Date',
            render: (r) => (
              <span className={`font-mono font-bold ${(r.daysOverdue || 0) > 0 ? 'text-red' : ''}`}>
                {r.dueDate}
                {(r.daysOverdue || 0) > 0 && ` (${r.daysOverdue}d overdue)`}
              </span>
            ),
          },
          { header: 'Principal', render: (r) => <span className="font-mono font-bold">{fmt(r.principalAmount)}</span>, align: 'right' },
          { header: 'Interest Rate', render: (r) => <span className="font-mono">{r.interestRate}%/mo</span>, align: 'right' },
          { header: 'Total Repaid', render: (r) => <span className="font-mono text-green">{fmt(r.totalRepaid)}</span>, align: 'right' },
          { header: 'Outstanding Due', render: (r) => <span className="font-mono font-bold text-red">{fmt(r.outstandingAmount)}</span>, align: 'right' },
          {
            header: 'Status',
            render: (r) => <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>,
            align: 'center',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={girviLoans}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'saving-schemes': {
        const columns: ColumnDef<SavingSchemeReportItem>[] = [
          { header: 'Scheme #', render: (r) => <span className="font-mono font-bold text-gold">{r.schemeNumber}</span> },
          {
            header: 'Customer',
            render: (r) => (
              <div>
                <div className="font-bold">{r.customerName}</div>
                <div className="text-xs text-muted font-mono">{r.customerPhone || ''}</div>
              </div>
            ),
          },
          { header: 'Scheme Plan', render: (r) => <span className="font-bold text-gold">{r.schemeName}</span> },
          { header: 'Monthly Inst.', render: (r) => <span className="font-mono">{fmt(r.installmentAmount)}</span>, align: 'right' },
          {
            header: 'Installments Paid',
            render: (r) => (
              <span className="font-mono">
                {r.paidInstallments} / {r.totalInstallments}
              </span>
            ),
            align: 'center',
          },
          { header: 'Total Accumulated', render: (r) => <span className="font-mono font-bold text-green">{fmt(r.paidAmount)}</span>, align: 'right' },
          { header: 'Maturity Date', render: (r) => <span className="font-mono">{r.maturityDate}</span> },
          {
            header: 'Status',
            render: (r) => <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>,
            align: 'center',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={savingSchemes}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'saving-installments': {
        const columns: ColumnDef<InstallmentCollectionItem>[] = [
          { header: 'Scheme #', render: (r) => <span className="font-mono text-gold">{r.schemeNumber}</span> },
          { header: 'Customer', render: (r) => <span className="font-bold">{r.customerName}</span> },
          { header: 'Inst. No.', render: (r) => <span className="font-mono">{r.installmentNumber}</span>, align: 'center' },
          { header: 'Due Date', render: (r) => <span className="font-mono">{r.dueDate}</span> },
          { header: 'Amount Due', render: (r) => <span className="font-mono">{fmt(r.amountDue)}</span>, align: 'right' },
          { header: 'Amount Paid', render: (r) => <span className="font-mono text-green font-bold">{fmt(r.amountPaid)}</span>, align: 'right' },
          { header: 'Paid Date', render: (r) => <span className="font-mono">{r.paymentDate || '-'}</span> },
          { header: 'Mode', render: (r) => <span className="text-muted">{r.paymentMode || '-'}</span>, align: 'center' },
          {
            header: 'Status',
            render: (r) => <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>,
            align: 'center',
          },
        ];
        return (
          <ReportTable
            columns={columns}
            data={savingInstallments}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      case 'hsn-summary': {
        const columns: ColumnDef<HsnSummaryItem>[] = [
          { header: 'HSN Code', render: (r) => <span className="font-mono font-bold text-gold">{r.hsnCode}</span> },
          { header: 'Commodity Description', render: (r) => <span>{r.description}</span> },
          { header: 'Product Count', render: (r) => <span className="font-mono">{r.productCount}</span>, align: 'center' },
          { header: 'Taxable Turnover', render: (r) => <span className="font-mono font-bold">{fmt(r.taxableValue)}</span>, align: 'right' },
          { header: 'GST Collected', render: (r) => <span className="font-mono text-purple">{fmt(r.gstAmount)}</span>, align: 'right' },
          { header: 'Gross Value', render: (r) => <span className="font-mono font-bold text-green">{fmt(r.totalValue)}</span>, align: 'right' },
        ];
        return <ReportTable columns={columns} data={hsnSummary} loading={loading} />;
      }

      case 'gst-invoice-register': {
        const columns: ColumnDef<GstInvoiceRegisterItem>[] = [
          { header: 'Invoice #', render: (r) => <span className="font-mono font-bold text-gold">{r.invoiceNumber}</span> },
          { header: 'Date', render: (r) => <span className="font-mono">{r.date}</span> },
          {
            header: 'Customer',
            render: (r) => (
              <div>
                <div className="font-bold">{r.customerName}</div>
                <div className="text-xs text-muted font-mono">{r.gstin ? `GSTIN: ${r.gstin}` : 'Consumer (URP)'}</div>
              </div>
            ),
          },
          { header: 'HSN', render: (r) => <span className="font-mono">{r.hsnCode}</span>, align: 'center' },
          { header: 'Taxable Value', render: (r) => <span className="font-mono">{fmt(r.taxableValue)}</span>, align: 'right' },
          { header: 'Rate', render: (r) => <span className="font-mono">{r.gstRate}%</span>, align: 'center' },
          { header: 'GST Amount', render: (r) => <span className="font-mono text-purple font-bold">{fmt(r.gstAmount)}</span>, align: 'right' },
          { header: 'Grand Total', render: (r) => <span className="font-mono font-bold text-green">{fmt(r.grandTotal)}</span>, align: 'right' },
        ];
        return (
          <ReportTable
            columns={columns}
            data={gstInvoices}
            loading={loading}
            total={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        );
      }

      // Summary pages when viewed directly
      case 'sales-summary':
      case 'purchase-summary':
      case 'gst-sales':
      case 'gst-purchases': {
        return (
          <div className="summary-cards-full-view">
            <div className="summary-info-callout">
              <span className="font-bold text-gold">Summary Aggregation Complete</span>
              <p className="text-muted text-xs mt-1">
                Calculated in real-time from active SQLite transactions without modification of historical rates or balances.
              </p>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="reports-page-container">
      {/* Category Tabs Bar */}
      <div className="reports-category-tabs">
        <button
          className={`category-tab ${activeCategory === 'SALES' ? 'active' : ''}`}
          onClick={() => handleCategorySelect('SALES', 'sales-summary')}
        >
          <Receipt size={15} />
          <span>Sales</span>
        </button>

        <button
          className={`category-tab ${activeCategory === 'PURCHASE' ? 'active' : ''}`}
          onClick={() => handleCategorySelect('PURCHASE', 'purchase-summary')}
        >
          <ShoppingCart size={15} />
          <span>Purchase</span>
        </button>

        <button
          className={`category-tab ${activeCategory === 'INVENTORY' ? 'active' : ''}`}
          onClick={() => handleCategorySelect('INVENTORY', 'current-stock')}
        >
          <Boxes size={15} />
          <span>Inventory</span>
        </button>

        <button
          className={`category-tab ${activeCategory === 'FINANCE' ? 'active' : ''}`}
          onClick={() => handleCategorySelect('FINANCE', 'receivables')}
        >
          <Landmark size={15} />
          <span>Finance</span>
        </button>

        <button
          className={`category-tab ${activeCategory === 'WORKSHOP' ? 'active' : ''}`}
          onClick={() => handleCategorySelect('WORKSHOP', 'karigar-jobs')}
        >
          <Hammer size={15} />
          <span>Workshop</span>
        </button>

        <button
          className={`category-tab ${activeCategory === 'GIRVI' ? 'active' : ''}`}
          onClick={() => handleCategorySelect('GIRVI', 'active-loans')}
        >
          <Coins size={15} />
          <span>Girvi Loans</span>
        </button>

        <button
          className={`category-tab ${activeCategory === 'SAVING_SCHEMES' ? 'active' : ''}`}
          onClick={() => handleCategorySelect('SAVING_SCHEMES', 'saving-schemes')}
        >
          <TrendingUp size={15} />
          <span>Saving Schemes</span>
        </button>

        <button
          className={`category-tab ${activeCategory === 'GST' ? 'active' : ''}`}
          onClick={() => handleCategorySelect('GST', 'gst-sales')}
        >
          <BadgePercent size={15} />
          <span>GST Reports</span>
        </button>
      </div>

      {/* Sub-Reports Selector Pills */}
      <div className="sub-reports-pills-bar">
        {activeCategory === 'SALES' && (
          <>
            <button className={`sub-pill ${activeReportKey === 'sales-summary' ? 'active' : ''}`} onClick={() => handleReportSelect('sales-summary')}>
              Sales Summary
            </button>
            <button className={`sub-pill ${activeReportKey === 'sales-register' ? 'active' : ''}`} onClick={() => handleReportSelect('sales-register')}>
              Sales Register
            </button>
            <button className={`sub-pill ${activeReportKey === 'customer-sales' ? 'active' : ''}`} onClick={() => handleReportSelect('customer-sales')}>
              Customer-wise Sales
            </button>
            <button className={`sub-pill ${activeReportKey === 'product-sales' ? 'active' : ''}`} onClick={() => handleReportSelect('product-sales')}>
              Product-wise Sales
            </button>
            <button className={`sub-pill ${activeReportKey === 'metal-sales' ? 'active' : ''}`} onClick={() => handleReportSelect('metal-sales')}>
              Metal-wise Sales
            </button>
          </>
        )}

        {activeCategory === 'PURCHASE' && (
          <>
            <button className={`sub-pill ${activeReportKey === 'purchase-summary' ? 'active' : ''}`} onClick={() => handleReportSelect('purchase-summary')}>
              Purchase Summary
            </button>
            <button className={`sub-pill ${activeReportKey === 'purchase-register' ? 'active' : ''}`} onClick={() => handleReportSelect('purchase-register')}>
              Purchase Register
            </button>
            <button className={`sub-pill ${activeReportKey === 'supplier-purchase' ? 'active' : ''}`} onClick={() => handleReportSelect('supplier-purchase')}>
              Supplier-wise Purchase
            </button>
          </>
        )}

        {activeCategory === 'INVENTORY' && (
          <>
            <button className={`sub-pill ${activeReportKey === 'current-stock' ? 'active' : ''}`} onClick={() => handleReportSelect('current-stock')}>
              Current Stock
            </button>
            <button className={`sub-pill ${activeReportKey === 'stock-valuation' ? 'active' : ''}`} onClick={() => handleReportSelect('stock-valuation')}>
              Stock Valuation
            </button>
            <button className={`sub-pill ${activeReportKey === 'stock-movements' ? 'active' : ''}`} onClick={() => handleReportSelect('stock-movements')}>
              Stock Movements
            </button>
          </>
        )}

        {activeCategory === 'FINANCE' && (
          <>
            <button className={`sub-pill ${activeReportKey === 'receivables' ? 'active' : ''}`} onClick={() => handleReportSelect('receivables')}>
              Receivables
            </button>
            <button className={`sub-pill ${activeReportKey === 'payables' ? 'active' : ''}`} onClick={() => handleReportSelect('payables')}>
              Payables
            </button>
            <button className={`sub-pill ${activeReportKey === 'cash-book' ? 'active' : ''}`} onClick={() => handleReportSelect('cash-book')}>
              Cash Book
            </button>
            <button className={`sub-pill ${activeReportKey === 'payments' ? 'active' : ''}`} onClick={() => handleReportSelect('payments')}>
              Payment Collections
            </button>
          </>
        )}

        {activeCategory === 'WORKSHOP' && (
          <>
            <button className={`sub-pill ${activeReportKey === 'karigar-jobs' ? 'active' : ''}`} onClick={() => handleReportSelect('karigar-jobs')}>
              Karigar Jobs
            </button>
            <button className={`sub-pill ${activeReportKey === 'karigar-labour' ? 'active' : ''}`} onClick={() => handleReportSelect('karigar-labour')}>
              Karigar Labour
            </button>
            <button className={`sub-pill ${activeReportKey === 'repairs' ? 'active' : ''}`} onClick={() => handleReportSelect('repairs')}>
              Repair Register
            </button>
          </>
        )}

        {activeCategory === 'GIRVI' && (
          <>
            <button className={`sub-pill ${activeReportKey === 'active-loans' ? 'active' : ''}`} onClick={() => handleReportSelect('active-loans')}>
              Active Loans
            </button>
            <button className={`sub-pill ${activeReportKey === 'overdue-loans' ? 'active' : ''}`} onClick={() => handleReportSelect('overdue-loans')}>
              Overdue Loans
            </button>
          </>
        )}

        {activeCategory === 'SAVING_SCHEMES' && (
          <>
            <button className={`sub-pill ${activeReportKey === 'saving-schemes' ? 'active' : ''}`} onClick={() => handleReportSelect('saving-schemes')}>
              Scheme Register
            </button>
            <button className={`sub-pill ${activeReportKey === 'saving-installments' ? 'active' : ''}`} onClick={() => handleReportSelect('saving-installments')}>
              Installment Collections
            </button>
          </>
        )}

        {activeCategory === 'GST' && (
          <>
            <button className={`sub-pill ${activeReportKey === 'gst-sales' ? 'active' : ''}`} onClick={() => handleReportSelect('gst-sales')}>
              GST Sales Summary
            </button>
            <button className={`sub-pill ${activeReportKey === 'gst-purchases' ? 'active' : ''}`} onClick={() => handleReportSelect('gst-purchases')}>
              GST Purchase Summary
            </button>
            <button className={`sub-pill ${activeReportKey === 'hsn-summary' ? 'active' : ''}`} onClick={() => handleReportSelect('hsn-summary')}>
              HSN Summary
            </button>
            <button className={`sub-pill ${activeReportKey === 'gst-invoice-register' ? 'active' : ''}`} onClick={() => handleReportSelect('gst-invoice-register')}>
              GST Invoice Register
            </button>
          </>
        )}
      </div>

      {/* Main Report View Area */}
      <div className="report-main-content">
        <ReportHeader
          title={meta.title}
          category={meta.category}
          description={meta.desc}
          onRefresh={loadReportData}
          onExportCsv={handleExportCsv}
          onPrint={() => setShowPrintModal(true)}
          loading={loading}
        />

        {/* Global Report Filters */}
        <ReportFilters
          values={filters}
          onChange={handleFilterChange}
          showSearch={
            activeReportKey.includes('register') ||
            activeReportKey.includes('sales') ||
            activeReportKey.includes('stock') ||
            activeReportKey.includes('receivables') ||
            activeReportKey.includes('payables') ||
            activeReportKey.includes('karigar') ||
            activeReportKey.includes('loans') ||
            activeReportKey.includes('schemes')
          }
        />

        {/* Error Notice */}
        {error && (
          <div className="report-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Summary KPI Cards */}
        <ReportSummaryCards cards={renderSummaryCards()} />

        {/* Tabular Data View */}
        <div className="report-table-wrapper">
          {renderTableContent()}
        </div>
      </div>

      {/* Printable Preview Modal */}
      {showPrintModal && (
        <ReportPrintView
          reportName={meta.title}
          fromDate={filters.preset === 'custom' ? filters.fromDate : filters.preset}
          toDate={filters.preset === 'custom' ? filters.toDate : undefined}
          summaryBlock={<ReportSummaryCards cards={renderSummaryCards()} />}
          onClose={() => setShowPrintModal(false)}
        >
          {renderTableContent()}
        </ReportPrintView>
      )}
    </div>
  );
};
