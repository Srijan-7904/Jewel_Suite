import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/masters/CustomersPage';
import { SuppliersPage } from './pages/masters/SuppliersPage';
import { KarigarsPage } from './pages/masters/KarigarsPage';
import { CategoriesPage } from './pages/masters/CategoriesPage';
import { ProductsPage } from './pages/masters/ProductsPage';
import { MetalRatesPage } from './pages/masters/MetalRatesPage';
import { StockPage } from './pages/inventory/StockPage';
import { InvoicesPage } from './pages/billing/InvoicesPage';
import { CreateInvoicePage } from './pages/billing/CreateInvoicePage';
import { PurchaseBillsPage } from './pages/billing/PurchaseBillsPage';
import { KarigarBillsPage } from './pages/billing/KarigarBillsPage';
import { ExchangePage } from './pages/billing/ExchangePage';
import { EstimatesPage } from './pages/billing/EstimatesPage';
import { IssueRegisterPage } from './pages/workshop/IssueRegisterPage';
import { JobsPage } from './pages/workshop/JobsPage';
import { RepairsPage } from './pages/workshop/RepairsPage';
import { CustomerLedgerPage } from './pages/finance/CustomerLedgerPage';
import { SupplierLedgerPage } from './pages/finance/SupplierLedgerPage';
import { KarigarLedgerPage } from './pages/finance/KarigarLedgerPage';
import { PaymentsPage } from './pages/finance/PaymentsPage';
import { CashBookPage } from './pages/finance/CashBookPage';
import { GirviLoansPage } from './pages/girvi/GirviLoansPage';
import { GirviDetailPage } from './pages/girvi/GirviDetailPage';
import { SavingSchemesPage } from './pages/saving-schemes/SavingSchemesPage';
import { SavingSchemeDetailPage } from './pages/saving-schemes/SavingSchemeDetailPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { Gem } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading-screen flex flex-col items-center justify-center h-screen bg-app">
        <div className="loading-logo-box mb-4">
          <Gem size={36} className="text-gold animate-pulse" />
        </div>
        <span className="font-serif text-gold text-lg tracking-wider">JEWEL SUITE</span>
        <span className="text-muted text-xs mt-1">Starting offline terminal...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public Auth Route */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />

          {/* Authenticated Application Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Billing Routes */}
            <Route path="billing/invoices" element={<InvoicesPage />} />
            <Route path="billing/create" element={<CreateInvoicePage />} />
            <Route path="billing/purchases" element={<PurchaseBillsPage />} />
            <Route path="billing/karigar-bill" element={<KarigarBillsPage />} />
            <Route path="billing/exchange" element={<ExchangePage />} />
            <Route path="billing/repair" element={<RepairsPage />} />
            <Route path="billing/estimates" element={<EstimatesPage />} />

            {/* Workshop Routes (Part 7: Workshop + Repairs + Karigar Jobs) */}
            <Route path="workshop/issue-register" element={<IssueRegisterPage />} />
            <Route path="workshop/karigars" element={<KarigarsPage />} />
            <Route path="workshop/jobs" element={<JobsPage />} />
            <Route path="workshop/repairs" element={<RepairsPage />} />

            {/* Finance Routes (Part 8: Finance - Cr/Dr Ledger + Payments) */}
            <Route path="finance/ledger" element={<Navigate to="/finance/ledger/customer" replace />} />
            <Route path="finance/ledger/customer" element={<CustomerLedgerPage />} />
            <Route path="finance/ledger/supplier" element={<SupplierLedgerPage />} />
            <Route path="finance/ledger/karigar" element={<KarigarLedgerPage />} />
            <Route path="finance/payments" element={<PaymentsPage />} />
            <Route path="finance/cash-book" element={<CashBookPage />} />

            {/* Girvi & Saving Schemes Routes (Part 9: Girvi Loans + Saving Schemes) */}
            <Route path="finance/girvi" element={<GirviLoansPage />} />
            <Route path="finance/girvi/:id" element={<GirviDetailPage />} />
            <Route path="finance/saving-schemes" element={<SavingSchemesPage />} />
            <Route path="finance/saving-schemes/:id" element={<SavingSchemeDetailPage />} />

            {/* Inventory Routes (Part 3: Inventory & Valuation) */}
            <Route path="inventory/stock" element={<StockPage />} />

            {/* Reports & Compliance (Part 10: Reports + GST Reports) */}
            <Route path="reports" element={<ReportsPage />} />

            {/* Masters Routes */}
            <Route path="masters/customers" element={<CustomersPage />} />
            <Route path="masters/suppliers" element={<SuppliersPage />} />
            <Route path="masters/categories" element={<CategoriesPage />} />
            <Route path="masters/products" element={<ProductsPage />} />
            <Route path="masters/rates" element={<MetalRatesPage />} />

            {/* System & Store Settings (Part 11: Settings + AMC + Shop Configuration) */}
            <Route path="system/settings" element={<SettingsPage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};
