// frontend/src/pages/workshop/IssueRegisterPage.tsx
import React, { useState, useEffect } from 'react';
import { workshopApi } from '../../services/workshop';
import { karigarApi } from '../../services/masters';
import { WorkshopJob, Karigar } from '../../types';
import { BookOpen } from 'lucide-react';
import './Workshop.css';

export const IssueRegisterPage: React.FC = () => {
  const [issues, setIssues] = useState<WorkshopJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [karigars, setKarigars] = useState<Karigar[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [karigarFilter, setKarigarFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await workshopApi.getIssueRegister({
        page,
        pageSize: 20,
        search: search || undefined,
        karigar_id: karigarFilter,
        status: statusFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setIssues(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load issue register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    karigarApi.list({ pageSize: 100 })
      .then((res) => setKarigars(res.items))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    loadData();
  }, [page, search, karigarFilter, statusFilter, fromDate, toDate]);

  return (
    <div className="workshop-page">
      <div className="workshop-header">
        <div>
          <h1 className="workshop-title">
            <BookOpen size={26} className="text-gold" />
            Workshop Issue Register
          </h1>
          <div className="workshop-subtitle">
            Audited daily register of jewellery items and bullion issued to goldsmith artisans
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search Job No, Tag, Karigar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
          style={{ width: '240px' }}
        />

        <select
          value={karigarFilter}
          onChange={(e) => setKarigarFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Karigars</option>
          {karigars.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-input"
        >
          <option value="ALL">All Statuses</option>
          <option value="ISSUED">ISSUED</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="RETURNED">RETURNED</option>
          <option value="COMPLETED">COMPLETED</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#9da4b3' }}>From:</span>
          <input
            type="date"
            className="filter-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#9da4b3' }}>To:</span>
          <input
            type="date"
            className="filter-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* Register Table */}
      <div className="workshop-table-container">
        <table className="workshop-table">
          <thead>
            <tr>
              <th>Job / Issue No</th>
              <th>Issue Date</th>
              <th>Karigar</th>
              <th>Issued Items / Tags</th>
              <th>Issue Net Wt</th>
              <th>Returned Net Wt</th>
              <th>Weight Diff</th>
              <th>Status</th>
              <th>Expected Return</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading issue register...
                </td>
              </tr>
            ) : issues.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#8e95a5' }}>
                  No issue register entries found for selected criteria.
                </td>
              </tr>
            ) : (
              issues.map((row) => {
                const firstItem = row.items && row.items[0];
                return (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600, color: '#d4af37' }}>{row.job_number}</td>
                    <td>{row.issue_date || row.created_at.substring(0, 10)}</td>
                    <td>
                      <strong>{row.karigar_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#8e95a5' }}>
                        {row.karigar_specialization}
                      </div>
                    </td>
                    <td>
                      {row.items && row.items.length > 0 ? (
                        row.items.map((it: any) => (
                          <div key={it.id}>
                            <span style={{ fontWeight: 600 }}>{it.tag_no}</span>
                            {it.material_issued && (
                              <span style={{ color: '#8e95a5', marginLeft: '4px' }}>
                                (+{it.material_issued})
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {firstItem ? `${firstItem.issue_net_weight}g` : `${row.estimated_weight}g`}
                    </td>
                    <td>
                      {firstItem && firstItem.return_net_weight !== null ? (
                        `${firstItem.return_net_weight}g`
                      ) : (
                        <span style={{ color: '#8e95a5' }}>Pending</span>
                      )}
                    </td>
                    <td>
                      {firstItem && firstItem.return_net_weight !== null ? (
                        <span
                          style={{
                            fontWeight: 600,
                            color: Math.abs(firstItem.weight_difference) > 0.2 ? '#f87171' : '#34d399',
                          }}
                        >
                          {firstItem.weight_difference > 0
                            ? `+${firstItem.weight_difference}g`
                            : `${firstItem.weight_difference}g`}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${row.status.toLowerCase().replace('_', '-')}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.expected_return_date || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#9da4b3' }}>
            Page {page} ({total} items)
          </span>
          <button
            className="btn-secondary"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
