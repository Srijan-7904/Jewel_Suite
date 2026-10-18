// frontend/src/pages/reports/ReportHeader.tsx
import React from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';

interface ReportHeaderProps {
  title: string;
  category: string;
  description: string;
  onRefresh: () => void;
  onExportCsv?: () => void;
  onPrint?: () => void;
  loading?: boolean;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  title,
  category,
  description,
  onRefresh,
  onExportCsv,
  onPrint,
  loading = false,
}) => {
  return (
    <div className="report-header-banner">
      <div className="report-header-info">
        <div className="report-badge-row">
          <span className="report-category-badge">{category}</span>
          <span className="report-live-badge">
            <span className="pulse-dot"></span> Live DB
          </span>
        </div>
        <h2 className="report-title font-serif">{title}</h2>
        <p className="report-desc">{description}</p>
      </div>

      <div className="report-header-actions">
        <button
          className="btn-icon"
          title="Refresh Data"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>

        {onExportCsv && (
          <button className="btn-secondary" onClick={onExportCsv} title="Export full filtered dataset to CSV">
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        )}

        {onPrint && (
          <button className="btn-primary" onClick={onPrint} title="Print report or save as PDF">
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        )}
      </div>
    </div>
  );
};
