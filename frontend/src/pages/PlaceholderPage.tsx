import React from 'react';
import { Layers, Construction, CheckCircle2 } from 'lucide-react';
import './PlaceholderPage.css';

interface PlaceholderProps {
  title: string;
  moduleGroup: string;
  targetPhase: string;
  description: string;
  plannedFeatures: string[];
}

export const PlaceholderPage: React.FC<PlaceholderProps> = ({
  title,
  moduleGroup,
  targetPhase,
  description,
  plannedFeatures,
}) => {
  return (
    <div className="placeholder-container">
      <div className="placeholder-card">
        <div className="placeholder-badge-group">
          <span className="badge badge-gold">{moduleGroup}</span>
          <span className="badge badge-warning font-mono">{targetPhase}</span>
        </div>

        <div className="placeholder-icon-box">
          <Construction size={32} className="text-gold" />
        </div>

        <h2 className="placeholder-title font-serif">{title}</h2>
        <p className="placeholder-desc">{description}</p>

        <div className="placeholder-features-section">
          <div className="features-title">
            <Layers size={14} />
            <span>Planned Module Capabilities</span>
          </div>
          <div className="features-list">
            {plannedFeatures.map((feat, idx) => (
              <div key={idx} className="feature-item">
                <CheckCircle2 size={14} className="feature-check" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="placeholder-footer">
          <span>In accordance with Master Build Instruction, business logic will be implemented incrementally in its designated phase.</span>
        </div>
      </div>
    </div>
  );
};
