// frontend/src/pages/reports/ReportFilters.tsx
import React from 'react';
import { Calendar, Search, Filter, X } from 'lucide-react';

export interface FilterValues {
  preset: string;
  fromDate: string;
  toDate: string;
  search: string;
  status?: string;
  paymentMode?: string;
  extraFilter?: string;
}

interface ReportFiltersProps {
  values: FilterValues;
  onChange: (newValues: FilterValues) => void;
  statusOptions?: { label: string; value: string }[];
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  values,
  onChange,
  statusOptions,
  showSearch = true,
  searchPlaceholder = 'Search records...',
}) => {
  const presets = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_fy', label: 'This FY' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
  ];

  const handlePresetSelect = (presetId: string) => {
    if (presetId === 'custom') {
      onChange({ ...values, preset: 'custom' });
    } else {
      onChange({ ...values, preset: presetId });
    }
  };

  return (
    <div className="report-filters-bar">
      {/* Preset Pills */}
      <div className="filter-presets-group">
        <span className="filter-group-label">
          <Calendar size={13} /> Period:
        </span>
        <div className="preset-pills">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`preset-pill ${values.preset === p.id ? 'active' : ''}`}
              onClick={() => handlePresetSelect(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Pickers (Shown always or when custom) */}
      {values.preset === 'custom' && (
        <div className="custom-date-inputs">
          <div className="date-input-wrap">
            <label>From</label>
            <input
              type="date"
              value={values.fromDate}
              onChange={(e) => onChange({ ...values, fromDate: e.target.value })}
              className="filter-date-input"
            />
          </div>
          <div className="date-input-wrap">
            <label>To</label>
            <input
              type="date"
              value={values.toDate}
              onChange={(e) => onChange({ ...values, toDate: e.target.value })}
              className="filter-date-input"
            />
          </div>
        </div>
      )}

      {/* Search Input & Status Filter */}
      <div className="filter-search-group">
        {showSearch && (
          <div className="search-input-wrap">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              value={values.search}
              placeholder={searchPlaceholder}
              onChange={(e) => onChange({ ...values, search: e.target.value })}
              className="filter-search-input"
            />
            {values.search && (
              <button
                className="clear-search-btn"
                onClick={() => onChange({ ...values, search: '' })}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {statusOptions && statusOptions.length > 0 && (
          <div className="status-select-wrap">
            <Filter size={13} className="filter-icon" />
            <select
              value={values.status || ''}
              onChange={(e) => onChange({ ...values, status: e.target.value || undefined })}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
