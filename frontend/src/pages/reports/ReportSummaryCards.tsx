// frontend/src/pages/reports/ReportSummaryCards.tsx
import React from 'react';

export interface SummaryCardItem {
  label: string;
  value: string | number;
  subtitle?: string;
  highlight?: 'gold' | 'green' | 'red' | 'blue' | 'purple' | 'neutral';
  icon?: React.ReactNode;
}

interface ReportSummaryCardsProps {
  cards: SummaryCardItem[];
}

export const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({ cards }) => {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="report-summary-cards-grid">
      {cards.map((card, idx) => (
        <div key={idx} className={`summary-card ${card.highlight || 'neutral'}`}>
          <div className="summary-card-header">
            <span className="summary-card-label">{card.label}</span>
            {card.icon && <div className="summary-card-icon">{card.icon}</div>}
          </div>
          <div className="summary-card-value font-mono">{card.value}</div>
          {card.subtitle && <div className="summary-card-sub">{card.subtitle}</div>}
        </div>
      ))}
    </div>
  );
};
