import React, { useState, useEffect, useCallback } from 'react';
import { CurrentRate, Metal, MetalPurity } from '../../types';
import { rateApi } from '../../services/masters';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp,
  Plus,
  History,
  X,
  RefreshCw,
  Coins,
  ShieldAlert,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import '../../styles/masters.css';

export const MetalRatesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Update Rate Modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateFormData, setUpdateFormData] = useState<{
    metal_id: string;
    purity_id: string;
    rate: number;
    unit: string;
    effective_from: string;
  }>({
    metal_id: '',
    purity_id: '',
    rate: 0,
    unit: 'gram',
    effective_from: new Date().toISOString().slice(0, 16),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyRates, setHistoryRates] = useState<CurrentRate[]>([]);
  const [selectedPurityName, setSelectedPurityName] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await rateApi.getCurrentRates();
      setRates(data);
    } catch (err: any) {
      console.error('Failed to load rates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    rateApi.getMetals().then(setMetals).catch(console.error);
    rateApi.getAllPurities().then(setPurities).catch(console.error);
  }, [fetchRates]);

  const handleOpenUpdate = (rateItem?: CurrentRate) => {
    if (rateItem) {
      setUpdateFormData({
        metal_id: rateItem.metal_id,
        purity_id: rateItem.purity_id,
        rate: rateItem.rate || 0,
        unit: rateItem.unit || 'gram',
        effective_from: new Date().toISOString().slice(0, 16),
      });
    } else {
      const defaultMetal = metals[0]?.id || '';
      const matchingPurities = purities.filter((p) => p.metal_id === defaultMetal);
      setUpdateFormData({
        metal_id: defaultMetal,
        purity_id: matchingPurities[0]?.id || '',
        rate: 0,
        unit: 'gram',
        effective_from: new Date().toISOString().slice(0, 16),
      });
    }
    setFormError(null);
    setShowUpdateModal(true);
  };

  const handleOpenHistory = async (rateItem: CurrentRate) => {
    setSelectedPurityName(`${rateItem.metal_name} - ${rateItem.purity_name}`);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const history = await rateApi.getRateHistory(rateItem.purity_id, rateItem.metal_id, 30);
      setHistoryRates(history);
    } catch (err: any) {
      console.error('Failed to load rate history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFormError('Only Admin can update metal rates.');
      return;
    }

    if (updateFormData.rate <= 0) {
      setFormError('Rate must be greater than zero.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await rateApi.createRate({
        metal_id: updateFormData.metal_id,
        purity_id: updateFormData.purity_id,
        rate: updateFormData.rate,
        unit: updateFormData.unit,
        effective_from: new Date(updateFormData.effective_from).toISOString(),
      });
      setShowUpdateModal(false);
      fetchRates();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update metal rate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPuritiesForModal = purities.filter((p) => p.metal_id === updateFormData.metal_id);

  return (
    <div className="master-page-container">
      {/* Header */}
      <div className="master-header">
        <div className="master-title-group">
          <h2>Au / Ag / Pt Daily Board Rates</h2>
          <p>Official jewellery benchmark rates for Gold, Silver, and Platinum. Invoices store rates used at the exact moment of sale.</p>
        </div>
        <div className="master-header-actions">
          <button type="button" className="btn-secondary" onClick={() => fetchRates()}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {isAdmin ? (
            <button type="button" className="btn-primary" onClick={() => handleOpenUpdate()}>
              <Plus size={16} />
              <span>Update Metal Rate</span>
            </button>
          ) : (
            <span className="badge badge-warning flex items-center gap-1">
              <ShieldAlert size={12} />
              <span>Admin Role Required to Edit</span>
            </span>
          )}
        </div>
      </div>

      {/* Rates Table */}
      <div className="master-table-card">
        <div className="master-table-responsive">
          <table className="master-table">
            <thead>
              <tr>
                <th>Metal</th>
                <th>Purity Grade</th>
                <th>Tunch %</th>
                <th>Current Rate</th>
                <th>Unit</th>
                <th>Effective Date</th>
                <th>Updated By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty-state">
                      <Coins size={32} className="text-gold" />
                      <span>No rates currently configured in database.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                rates.map((r) => (
                  <tr key={r.purity_id}>
                    <td>
                      <span className="badge badge-gold">{r.metal_name}</span>
                    </td>
                    <td>
                      <strong>{r.purity_name}</strong> ({r.purity_code})
                    </td>
                    <td className="font-mono">
                      {r.tunch_percent ? `${r.tunch_percent.toFixed(2)}%` : '—'}
                    </td>
                    <td>
                      {r.rate ? (
                        <span className="text-base font-bold font-mono text-gold">
                          ₹{r.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-muted-cell font-mono">N/A</span>
                      )}
                    </td>
                    <td className="font-mono text-muted">{r.unit || 'gram'}</td>
                    <td className="text-muted-cell font-mono">
                      {r.effective_from ? new Date(r.effective_from).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-muted">
                        <UserIcon size={12} />
                        <span>{r.created_by_username || 'System'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn-icon"
                          title="View Rate History"
                          onClick={() => handleOpenHistory(r)}
                        >
                          <History size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn-icon"
                            title="Update Rate"
                            onClick={() => handleOpenUpdate(r)}
                          >
                            <TrendingUp size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Rate Modal */}
      {showUpdateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Update Daily Metal Rate</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowUpdateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit}>
              <div className="modal-body">
                {formError && <div className="form-error-alert">{formError}</div>}

                <div className="modal-form-grid">
                  <div className="form-field">
                    <label>Metal *</label>
                    <select
                      required
                      value={updateFormData.metal_id}
                      onChange={(e) => {
                        const mId = e.target.value;
                        const matchingPurities = purities.filter((p) => p.metal_id === mId);
                        setUpdateFormData({
                          ...updateFormData,
                          metal_id: mId,
                          purity_id: matchingPurities[0]?.id || '',
                        });
                      }}
                    >
                      {metals.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Purity Grade *</label>
                    <select
                      required
                      value={updateFormData.purity_id}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, purity_id: e.target.value })}
                    >
                      {filteredPuritiesForModal.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>New Rate (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      value={updateFormData.rate || ''}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, rate: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 7850.00"
                      autoFocus
                    />
                  </div>

                  <div className="form-field">
                    <label>Unit</label>
                    <select
                      value={updateFormData.unit}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, unit: e.target.value })}
                    >
                      <option value="gram">Per Gram (g)</option>
                      <option value="10gram">Per 10 Gram</option>
                      <option value="tola">Per Tola</option>
                      <option value="carat">Per Carat</option>
                    </select>
                  </div>

                  <div className="form-field col-span-2">
                    <label>Effective Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={updateFormData.effective_from}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, effective_from: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowUpdateModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Recording Rate...' : 'Record Rate Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Rate History: {selectedPurityName}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowHistoryModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh' }}>
              {historyLoading ? (
                <div className="table-empty-state">
                  <RefreshCw size={24} className="animate-spin text-gold" />
                  <span>Loading history...</span>
                </div>
              ) : historyRates.length === 0 ? (
                <div className="table-empty-state">
                  <span>No historical rates recorded for this grade.</span>
                </div>
              ) : (
                <table className="master-table">
                  <thead>
                    <tr>
                      <th>Effective Date</th>
                      <th>Rate</th>
                      <th>Unit</th>
                      <th>Logged By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRates.map((h) => (
                      <tr key={h.id}>
                        <td className="font-mono text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar size={13} className="text-muted" />
                            <span>{new Date(h.effective_from).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="font-mono font-bold text-gold">
                          ₹{h.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-muted font-mono">{h.unit}</td>
                        <td className="text-muted text-xs">
                          {h.created_by_username || 'System'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowHistoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
