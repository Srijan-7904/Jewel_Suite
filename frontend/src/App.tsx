import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
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

            {/* Billing Routes (Roadmap: Part 3, 4, 5) */}
            <Route
              path="billing/invoices"
              element={
                <PlaceholderPage
                  title="Retail & Wholesale Invoices"
                  moduleGroup="Billing"
                  targetPhase="Part 3: Retail Billing"
                  description="Complete invoice registry tracking customer sales, payment breakdown, and print history."
                  plannedFeatures={[
                    'Invoice search by Bill No, Date, and Customer Phone',
                    'Tax invoice generation with HSN/GST summary',
                    'Direct thermal & A4 receipt re-printing',
                    'Payment settlement & balance tracking',
                  ]}
                />
              }
            />
            <Route
              path="billing/create"
              element={
                <PlaceholderPage
                  title="POS Bill Creation Terminal"
                  moduleGroup="Billing"
                  targetPhase="Part 3: Retail Billing"
                  description="Primary high-speed retail checkout with weight, purity, tunch, wastage, making charges, and old gold exchange."
                  plannedFeatures={[
                    'Barcode / RFID tag scanner auto-fetch',
                    'Dynamic Net Weight and Fine Weight math engine',
                    'Integrated Old Gold / Silver exchange adjustment',
                    'Split payment tender (Cash, UPI, Card, Metal, Credit)',
                  ]}
                />
              }
            />
            <Route
              path="billing/purchases"
              element={
                <PlaceholderPage
                  title="Purchase Bills & Inward Stock"
                  moduleGroup="Billing"
                  targetPhase="Part 4: Purchase"
                  description="Inward metal and ornament purchases from bullion dealers and manufacturing suppliers."
                  plannedFeatures={[
                    'Supplier tax invoice logging and item tagging',
                    'Fine weight credit / bullion settlement',
                    'Automatic stock-in tag generation',
                    'Supplier Cr/Dr ledger balance sync',
                  ]}
                />
              }
            />
            <Route
              path="billing/karigar-bill"
              element={
                <PlaceholderPage
                  title="Karigar Labour & Settlement Bills"
                  moduleGroup="Billing"
                  targetPhase="Part 6: Workshop"
                  description="Settlement of manufacturing and repair labour charges with workshop artisans."
                  plannedFeatures={[
                    'Job-by-job making charge calculation',
                    'Purity wastage and dust tolerance ledger',
                    'Artisan account debit/credit voucher generation',
                  ]}
                />
              }
            />
            <Route
              path="billing/exchange"
              element={
                <PlaceholderPage
                  title="Old Metal Exchange Register"
                  moduleGroup="Billing"
                  targetPhase="Part 5: Exchange"
                  description="Valuation and tracking of customer scrap jewellery, touch testing, and melting reconciliation."
                  plannedFeatures={[
                    'Gross, Less (stones/wax), Net, and Tunch % test',
                    'Automated fine weight and melting value computation',
                    'Scrap bin inventory tracking',
                  ]}
                />
              }
            />
            <Route
              path="billing/repair"
              element={
                <PlaceholderPage
                  title="Customer Repair Management"
                  moduleGroup="Billing"
                  targetPhase="Part 6: Workshop"
                  description="Intake, tracking, estimation, and delivery of customer jewellery repair jobs."
                  plannedFeatures={[
                    'Repair receipt ticket printing with item photograph',
                    'Gold added / loss tracking during repair',
                    'Delivery and settlement status',
                  ]}
                />
              }
            />
            <Route
              path="billing/estimates"
              element={
                <PlaceholderPage
                  title="Quotations & Estimates"
                  moduleGroup="Billing"
                  targetPhase="Part 3: Retail Billing"
                  description="Non-fiscal customer quotation bills based on live daily metal rates."
                  plannedFeatures={[
                    '1-click conversion from Estimate to Tax Invoice',
                    'Rate lock validity period',
                    'Printable quotation slip',
                  ]}
                />
              }
            />

            {/* Workshop Routes (Roadmap: Part 6) */}
            <Route
              path="workshop/issue-register"
              element={
                <PlaceholderPage
                  title="Metal Issue / Return Register"
                  moduleGroup="Workshop"
                  targetPhase="Part 6: Workshop"
                  description="Daily bullion and raw gold issue and return ledger with workshop karigars."
                  plannedFeatures={[
                    'Metal purity and weight issuance tracking',
                    'Unreturned raw gold balance per artisan',
                    'Daily workshop opening and closing weight balance',
                  ]}
                />
              }
            />
            <Route
              path="workshop/karigars"
              element={
                <PlaceholderPage
                  title="Karigar & Artisan Master"
                  moduleGroup="Workshop"
                  targetPhase="Part 1: Masters"
                  description="Directory of workshop artisans, specialized crafts, and contact profiles."
                  plannedFeatures={[
                    'Artisan contact and guarantee details',
                    'Specialty tags (Bangles, Casting, Hand-made, Polishing)',
                    'Current metal liability summary',
                  ]}
                />
              }
            />
            <Route
              path="workshop/jobs"
              element={
                <PlaceholderPage
                  title="Manufacturing Job Cards"
                  moduleGroup="Workshop"
                  targetPhase="Part 6: Workshop"
                  description="End-to-end custom jewellery manufacturing workflow from design to finished tag."
                  plannedFeatures={[
                    'Job card creation with target delivery date',
                    'WIP stage tracking (Melting, Casting, Stone Setting, Polish)',
                    'Finished item tag assignment',
                  ]}
                />
              }
            />
            <Route
              path="workshop/repairs"
              element={
                <PlaceholderPage
                  title="Workshop Repair Jobs"
                  moduleGroup="Workshop"
                  targetPhase="Part 6: Workshop"
                  description="Active repair orders currently dispatched to workshop artisans."
                  plannedFeatures={[
                    'Dispatched repair orders queue',
                    'Karigar repair return verification',
                    'Quality control sign-off',
                  ]}
                />
              }
            />

            {/* Finance Routes (Roadmap: Part 7) */}
            <Route
              path="finance/girvi"
              element={
                <PlaceholderPage
                  title="Girvi / Pawn Loans"
                  moduleGroup="Finance"
                  targetPhase="Part 7: Finance"
                  description="Traditional gold and silver loan management with interest calculation and pledge vault tracking."
                  plannedFeatures={[
                    'Pledged jewellery valuation & security vault location',
                    'Monthly interest calculation & payment register',
                    'Pledge redemption and release voucher printing',
                    'Auction notice generation for delinquent loans',
                  ]}
                />
              }
            />
            <Route
              path="finance/ledger"
              element={
                <PlaceholderPage
                  title="Party Cr/Dr Ledger"
                  moduleGroup="Finance"
                  targetPhase="Part 7: Finance"
                  description="Double-entry financial accounting ledger for customers, suppliers, and karigars."
                  plannedFeatures={[
                    'Party statement generation with running balance',
                    'Payment voucher entry (Cash, UPI, Cheque, Adjustment)',
                    'Outstanding receivables and payables aging report',
                  ]}
                />
              }
            />
            <Route
              path="finance/saving-schemes"
              element={
                <PlaceholderPage
                  title="Jewellery Saving Schemes (Gold Chit)"
                  moduleGroup="Finance"
                  targetPhase="Part 7: Finance"
                  description="Customer monthly installment gold savings schemes with bonus redemption."
                  plannedFeatures={[
                    '11+1 monthly installment tracker',
                    'Monthly installment receipt printing',
                    'Scheme maturity conversion into jewellery purchase',
                  ]}
                />
              }
            />

            {/* Inventory Routes (Roadmap: Part 2) */}
            <Route
              path="inventory/stock"
              element={
                <PlaceholderPage
                  title="Jewellery Stock & Tag Inventory"
                  moduleGroup="Inventory"
                  targetPhase="Part 2: Inventory"
                  description="Tag-level jewellery inventory tracking Gross, Less, Net, Tunch %, Fine Weight, and Valuation."
                  plannedFeatures={[
                    'Individual RFID / Barcode tag generation',
                    'Purity classification (24K, 22K, 18K, 14K, Silver 999, 925)',
                    'Immutable stock movement audit trail (Purchased, Sold, In-Repair)',
                    'Live stock valuation using current daily metal rates',
                  ]}
                />
              }
            />

            {/* Reports Routes (Roadmap: Part 8) */}
            <Route
              path="reports"
              element={
                <PlaceholderPage
                  title="Business Reports & GSTR Analytics"
                  moduleGroup="Reports"
                  targetPhase="Part 8: Reports"
                  description="Comprehensive audit daybook, GST summaries, and profit/loss reporting."
                  plannedFeatures={[
                    'Daily Cash & Metal Daybook',
                    'GSTR-1 and GSTR-3B tax summaries',
                    'Stock balance & fine weight audit report',
                    'Karigar metal balance summary',
                  ]}
                />
              }
            />

            {/* Masters Routes (Roadmap: Part 1) */}
            <Route
              path="masters/customers"
              element={
                <PlaceholderPage
                  title="Customer & Party Master"
                  moduleGroup="Masters"
                  targetPhase="Part 1: Masters"
                  description="Centralized directory of retail customers, wholesale parties, and suppliers."
                  plannedFeatures={[
                    'Customer contact, GSTIN, and PAN records',
                    'Purchase history and loyalty points',
                    'Credit limit and balance overview',
                  ]}
                />
              }
            />
            <Route
              path="masters/rates"
              element={
                <PlaceholderPage
                  title="Metal Rate Master (Au/Ag/Pt)"
                  moduleGroup="Masters"
                  targetPhase="Part 1: Masters"
                  description="Daily gold, silver, and platinum board rate board with historical rate logs."
                  plannedFeatures={[
                    'Today’s board rates: 24K, 22K, 18K, 14K, Silver 999, 925',
                    'Historical rate archive for invoice auditing',
                    'Automatic billing rate pre-fill',
                  ]}
                />
              }
            />

            {/* System Routes */}
            <Route
              path="system/settings"
              element={
                <PlaceholderPage
                  title="Store Settings & Configuration"
                  moduleGroup="System"
                  targetPhase="Part 1: Masters"
                  description="Shop profile, invoice header/footer, thermal printer settings, and tax parameters."
                  plannedFeatures={[
                    'Shop legal name, address, GSTIN, and logo configuration',
                    'Default wastage and making charge rules',
                    'Thermal barcode & invoice template customizer',
                  ]}
                />
              }
            />
            <Route
              path="system/amc"
              element={
                <PlaceholderPage
                  title="AMC & Support Status"
                  moduleGroup="System"
                  targetPhase="Part 11: Licensing & AMC"
                  description="Offline software maintenance contract and local license status."
                  plannedFeatures={[
                    'Annual maintenance status and coverage',
                    'Local license key validation',
                    'Diagnostic reports export',
                  ]}
                />
              }
            />
            <Route
              path="system/super-admin"
              element={
                <PlaceholderPage
                  title="Super Admin Terminal & Backups"
                  moduleGroup="System"
                  targetPhase="Part 10: Backup & Recovery"
                  description="One-click database backup, audit trail logs, and system maintenance."
                  plannedFeatures={[
                    'Instant SQLite backup to %LOCALAPPDATA%/JewelSuite/backups',
                    'Database integrity check and WAL compaction (VACUUM)',
                    'System audit log browser',
                  ]}
                />
              }
            />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};
