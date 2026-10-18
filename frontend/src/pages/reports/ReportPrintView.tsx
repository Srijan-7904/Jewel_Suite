// frontend/src/pages/reports/ReportPrintView.tsx
import React, { useEffect, useState } from 'react';
import { reportsApi, ShopReportHeader } from '../../services/reports';
import { Printer, X, Gem } from 'lucide-react';

interface ReportPrintViewProps {
  reportName: string;
  fromDate?: string;
  toDate?: string;
  summaryBlock?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
}

export const ReportPrintView: React.FC<ReportPrintViewProps> = ({
  reportName,
  fromDate,
  toDate,
  summaryBlock,
  children,
  onClose,
}) => {
  const [header, setHeader] = useState<ShopReportHeader | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi
      .getShopHeader(reportName, fromDate, toDate)
      .then((data) => {
        setHeader(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load shop header:', err);
        setLoading(false);
      });
  }, [reportName, fromDate, toDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print-modal-overlay">
      <div className="print-modal-container">
        {/* Modal Toolbar (hidden on paper) */}
        <div className="print-toolbar no-print">
          <div className="print-toolbar-left">
            <Gem size={18} className="text-gold" />
            <span className="font-serif font-bold text-gold">Print Preview</span>
            <span className="text-muted text-xs font-mono">• {reportName}</span>
          </div>
          <div className="print-toolbar-right">
            <button className="btn-primary" onClick={handlePrint} disabled={loading}>
              <Printer size={15} />
              <span>Send to Printer</span>
            </button>
            <button className="btn-icon" onClick={onClose} title="Close Preview">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="printable-paper">
          {loading ? (
            <div className="p-8 text-center text-muted">Loading shop configuration...</div>
          ) : (
            <>
              {/* Shop Header */}
              <div className="print-shop-header">
                <div className="shop-title-row">
                  <h1 className="shop-legal-name font-serif">{header?.shopName}</h1>
                  <span className="shop-tagline">JEWELLERY ERP & POS SYSTEM</span>
                </div>
                <div className="shop-contact-line">
                  {header?.address && <span>{header.address}</span>}
                  {header?.phone && <span>• Tel: {header.phone}</span>}
                  {header?.email && <span>• Email: {header.email}</span>}
                </div>
                <div className="shop-tax-line font-mono">
                  <span>GSTIN: <strong>{header?.gstin || 'UNSPECIFIED'}</strong></span>
                </div>
              </div>

              <div className="print-report-meta-box">
                <div className="report-meta-left">
                  <h2 className="print-report-title">{header?.reportName}</h2>
                  <span className="print-period-label font-mono">Period: {header?.dateRange}</span>
                </div>
                <div className="report-meta-right">
                  <span className="print-timestamp-label font-mono">
                    Generated On: {header?.generatedOn}
                  </span>
                </div>
              </div>

              {/* Report Summary Cards / Highlights if any */}
              {summaryBlock && (
                <div className="print-summary-section">
                  {summaryBlock}
                </div>
              )}

              {/* Report Data Table */}
              <div className="print-content-section">
                {children}
              </div>

              {/* Print Footer */}
              <div className="print-footer">
                <span className="print-system-tag">JEWEL SUITE ERP • AUTHENTIC DATABASE REPORT</span>
                <span className="print-page-number">Computer Generated • No Signature Required</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
