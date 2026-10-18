// frontend/src/pages/reports/ReportTable.tsx
import React from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export interface ColumnDef<T> {
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
}

interface ReportTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  emptyMessage?: string;
}

export function ReportTable<T>({
  columns,
  data,
  loading = false,
  total,
  page = 1,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  emptyMessage = 'No records found for the selected filters.',
}: ReportTableProps<T>) {
  const totalPages = total !== undefined ? Math.ceil(total / pageSize) : 1;

  return (
    <div className="report-table-container">
      <div className="report-table-scroll">
        <table className="report-data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                  className={col.className}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Loading skeleton rows
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="skeleton-row">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx}>
                      <div className="skeleton-line"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="empty-table-cell">
                  <div className="empty-state-box">
                    <Inbox size={32} className="text-muted mb-2" />
                    <span className="empty-title">{emptyMessage}</span>
                    <span className="empty-hint">Try adjusting the date range or filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              // Real data rows
              data.map((row, rIdx) => (
                <tr key={rIdx} className="data-row">
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      style={{ textAlign: col.align || 'left' }}
                      className={col.className}
                    >
                      {col.render(row, rIdx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {total !== undefined && total > 0 && onPageChange && (
        <div className="report-pagination-bar">
          <div className="pagination-info">
            Showing <span className="font-mono">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-mono">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="font-mono">{total}</span> records
          </div>

          <div className="pagination-controls">
            {onPageSizeChange && (
              <div className="page-size-wrap">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="page-size-select"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            )}

            <button
              className="pagination-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="pagination-pages font-mono">
              {page} / {totalPages || 1}
            </span>

            <button
              className="pagination-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
