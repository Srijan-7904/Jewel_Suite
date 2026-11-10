// frontend/src/components/CreateCustomerModal.tsx
// Jewel Suite: Complete Luxury Customer Registration Modal with Full Options & Opening Khata Balances

import React, { useState, useEffect, useMemo } from 'react';
import { customerApi, rateApi } from '../services/masters';
import { Customer, Metal, MetalPurity } from '../types';
import {
  UserPlus,
  X,
  Save,
  Coins,
  Scale,
  Banknote,
  CreditCard,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { handleTallyKeyDown } from '../utils/tallyNavigation';
import './CreateCustomerModal.css';

export interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
  initialName?: string;
  initialPhone?: string;
  defaultCustomerType?: 'RETAIL' | 'WHOLESALE' | 'GIRVI_CLIENT';
  knownCustomers?: Customer[];
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
  initialPhone = '',
  defaultCustomerType = 'RETAIL',
  knownCustomers = [],
}) => {
  const today = new Date().toISOString().substring(0, 10);

  const [customerForm, setCustomerForm] = useState({
    name: initialName,
    customer_code: '',
    phone: initialPhone,
    alternate_phone: '',
    email: '',
    customer_type: defaultCustomerType,
    address: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    gstin: '',
    opening_balance_date: today,
    opening_balance_ref: '',
    opening_balance_notes: '',
    opening_cash_balance: 0,
    opening_cash_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    opening_bank_balance: 0,
    opening_bank_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    opening_gold_weight: 0,
    opening_gold_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    opening_gold_purity_id: '',
    opening_gold_rate: 0,
    opening_gold_value: 0,
    opening_silver_weight: 0,
    opening_silver_type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    opening_silver_purity_id: '',
    opening_silver_rate: 0,
    opening_silver_value: 0,
    notes: '',
  });

  const [customerPrimaryDirection, setCustomerPrimaryDirection] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync initial props when modal is opened
  useEffect(() => {
    if (isOpen) {
      setCustomerForm((prev) => ({
        ...prev,
        name: initialName || prev.name,
        phone: initialPhone || prev.phone,
        customer_type: defaultCustomerType || prev.customer_type,
      }));
      setFormError(null);
    }
  }, [isOpen, initialName, initialPhone, defaultCustomerType]);

  // Load Metals and Purities for Karat selection
  useEffect(() => {
    if (isOpen && purities.length === 0) {
      Promise.all([
        rateApi.getMetals().catch(() => []),
        rateApi.getAllPurities().catch(() => []),
      ]).then(([metalsList, puritiesList]) => {
        setMetals(metalsList);
        setPurities(puritiesList);
      });
    }
  }, [isOpen, purities.length]);

  // Tally Software Navigation: Enter moves forward, Esc moves backward / closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      handleTallyKeyDown(e, {
        onModalClose: onClose,
      });
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const goldPurities = useMemo(() => {
    const goldMetal = metals.find((m) => m.code?.toUpperCase() === 'GOLD' || m.name?.toLowerCase().includes('gold'));
    if (goldMetal) {
      const filtered = purities.filter((p) => p.metal_id === goldMetal.id);
      if (filtered.length > 0) return filtered;
    }
    return purities.filter(
      (p) =>
        p.metal_code?.toUpperCase() === 'GOLD' ||
        p.metal_name?.toLowerCase().includes('gold') ||
        p.name?.toLowerCase().includes('gold') ||
        p.code?.includes('K') ||
        p.code?.includes('22') ||
        p.code?.includes('24') ||
        p.code?.includes('18')
    );
  }, [metals, purities]);

  const silverPurities = useMemo(() => {
    const silverMetal = metals.find((m) => m.code?.toUpperCase() === 'SILVER' || m.name?.toLowerCase().includes('silver'));
    if (silverMetal) {
      const filtered = purities.filter((p) => p.metal_id === silverMetal.id);
      if (filtered.length > 0) return filtered;
    }
    return purities.filter(
      (p) =>
        p.metal_code?.toUpperCase() === 'SILVER' ||
        p.metal_name?.toLowerCase().includes('silver') ||
        p.name?.toLowerCase().includes('silver') ||
        p.code?.includes('925') ||
        p.code?.includes('999') ||
        (p.tunch_percent !== null && p.tunch_percent !== undefined && p.tunch_percent >= 90 && !p.code?.includes('K'))
    );
  }, [metals, purities]);

  if (!isOpen) return null;

  const handleCustomerPrimaryDirectionChange = (dir: 'DEBIT' | 'CREDIT') => {
    setCustomerPrimaryDirection(dir);
    setCustomerForm((prev) => ({
      ...prev,
      opening_cash_type: dir,
      opening_bank_type: dir,
      opening_gold_type: dir,
      opening_silver_type: dir,
    }));
  };

  // Check if customer already exists by phone or name in known customers
  const existingCustomer = knownCustomers.find((c) => {
    const pDigits = (customerForm.phone || '').replace(/\D/g, '');
    const cPhoneDigits = (c.phone || '').replace(/\D/g, '');
    if (pDigits.length >= 7 && cPhoneDigits === pDigits) return true;
    if (customerForm.name.trim() && c.name.trim().toUpperCase() === customerForm.name.trim().toUpperCase()) return true;
    return false;
  });

  // Calculate Net Monetary balance
  const cashSigned = (customerForm.opening_cash_type === 'DEBIT' ? 1 : -1) * (Number(customerForm.opening_cash_balance) || 0);
  const bankSigned = (customerForm.opening_bank_type === 'DEBIT' ? 1 : -1) * (Number(customerForm.opening_bank_balance) || 0);
  const netMonetary = cashSigned + bankSigned;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim()) {
      setFormError('Customer full name is required');
      return;
    }

    // If an existing customer matches, user can click to auto-select or continue
    setSubmitting(true);
    setFormError(null);

    try {
      const payload: any = {
        name: customerForm.name.trim().toUpperCase(),
        customer_code: customerForm.customer_code.trim() ? customerForm.customer_code.trim().toUpperCase() : undefined,
        phone: customerForm.phone.trim() || null,
        alternate_phone: customerForm.alternate_phone.trim() || null,
        email: customerForm.email.trim() || null,
        customer_type: customerForm.customer_type,
        address: customerForm.address.trim() ? customerForm.address.trim().toUpperCase() : null,
        city: customerForm.city.trim() ? customerForm.city.trim().toUpperCase() : null,
        state: customerForm.state.trim() ? customerForm.state.trim().toUpperCase() : null,
        pincode: customerForm.pincode.trim() || null,
        gstin: customerForm.gstin.trim() ? customerForm.gstin.trim().toUpperCase() : null,
        notes: customerForm.notes.trim() || null,
      };

      // Add Opening Balances if any non-zero values entered or old references specified
      const hasCash = Number(customerForm.opening_cash_balance) > 0;
      const hasBank = Number(customerForm.opening_bank_balance) > 0;
      const hasGold = Number(customerForm.opening_gold_weight) > 0;
      const hasSilver = Number(customerForm.opening_silver_weight) > 0;

      if (hasCash || hasBank || hasGold || hasSilver || customerForm.opening_balance_ref.trim() || customerForm.opening_balance_notes.trim()) {
        payload.opening_balance_date = customerForm.opening_balance_date || undefined;
        payload.opening_balance_ref = customerForm.opening_balance_ref.trim() || undefined;
        payload.opening_balance_notes = customerForm.opening_balance_notes.trim() || undefined;
        payload.opening_cash_balance = Number(customerForm.opening_cash_balance) || 0;
        payload.opening_cash_type = customerForm.opening_cash_type;
        payload.opening_bank_balance = Number(customerForm.opening_bank_balance) || 0;
        payload.opening_bank_type = customerForm.opening_bank_type;
        payload.opening_gold_weight = Number(customerForm.opening_gold_weight) || 0;
        payload.opening_gold_type = customerForm.opening_gold_type;
        payload.opening_gold_purity_id = customerForm.opening_gold_purity_id || undefined;
        payload.opening_gold_rate = Number(customerForm.opening_gold_rate) || 0;
        payload.opening_gold_value = Number(customerForm.opening_gold_value) || 0;
        payload.opening_silver_weight = Number(customerForm.opening_silver_weight) || 0;
        payload.opening_silver_type = customerForm.opening_silver_type;
        payload.opening_silver_purity_id = customerForm.opening_silver_purity_id || undefined;
        payload.opening_silver_rate = Number(customerForm.opening_silver_rate) || 0;
        payload.opening_silver_value = Number(customerForm.opening_silver_value) || 0;
      }

      const created = await customerApi.create(payload);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="customer-modal-backdrop" onClick={onClose}>
      <div
        className="customer-modal-dialog customer-modal-dialog-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="modal-header-icon-box">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="modal-title font-serif">Add Customer Master (Complete Registration)</h3>
              <p className="modal-subtitle">
                Full customer profile with Contact, Tax details, Address, and Opening Monetary & Metal Khata
              </p>
            </div>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            disabled={submitting}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="customer-modal-body compact-body">
            {formError && (
              <div className="customer-form-error-alert">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {existingCustomer && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(212, 175, 55, 0.12)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: '6px',
                  marginBottom: '0.75rem',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} color="var(--gold-primary)" />
                  <span>
                    Existing Customer Found: <strong>{existingCustomer.name}</strong> ({existingCustomer.phone || 'No phone'}) - {existingCustomer.customer_code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSuccess(existingCustomer);
                    onClose();
                  }}
                  style={{
                    padding: '0.25rem 0.65rem',
                    background: 'var(--gold-gradient)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#000',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Select Existing
                </button>
              </div>
            )}

            <div className="customer-modal-grid-compact">
              {/* Row 1: Full Name (span 2), Customer Code (span 1), Customer Type (span 1) */}
              <div className="compact-field col-span-2">
                <label className="compact-field-label">Full Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="compact-field-input font-semibold"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Chandra / Meena Jewellers"
                />
              </div>

              <div className="compact-field col-span-1">
                <label className="compact-field-label">Customer Code (Optional)</label>
                <input
                  type="text"
                  className="compact-field-input font-mono text-xs uppercase"
                  value={customerForm.customer_code}
                  onChange={(e) => setCustomerForm({ ...customerForm, customer_code: e.target.value })}
                  placeholder="Auto-generated if blank"
                />
              </div>

              <div className="compact-field col-span-1">
                <label className="compact-field-label">Customer Type</label>
                <select
                  className="compact-field-select font-mono text-xs"
                  value={customerForm.customer_type}
                  onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      customer_type: e.target.value as any,
                    })
                  }
                >
                  <option value="RETAIL">Retail Customer</option>
                  <option value="WHOLESALE">Wholesale Party</option>
                  <option value="GIRVI_CLIENT">Girvi Client</option>
                </select>
              </div>

              {/* Row 2: Mobile Phone (span 1), Alternate Phone (span 1), Email (span 1), GSTIN (span 1) */}
              <div className="compact-field col-span-1">
                <label className="compact-field-label">Mobile Phone</label>
                <input
                  type="tel"
                  className="compact-field-input font-mono"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="10-digit mobile"
                />
              </div>

              <div className="compact-field col-span-1">
                <label className="compact-field-label">Alternate Phone</label>
                <input
                  type="tel"
                  className="compact-field-input font-mono"
                  value={customerForm.alternate_phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, alternate_phone: e.target.value })}
                  placeholder="Landline / second"
                />
              </div>

              <div className="compact-field col-span-1">
                <label className="compact-field-label">Email Address (Optional)</label>
                <input
                  type="email"
                  className="compact-field-input"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  placeholder="customer@domain.com"
                />
              </div>

              <div className="compact-field col-span-1">
                <label className="compact-field-label">GSTIN (Optional)</label>
                <input
                  type="text"
                  className="compact-field-input font-mono uppercase"
                  value={customerForm.gstin}
                  onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value.toUpperCase() })}
                  placeholder="15-digit GSTIN"
                />
              </div>

              {/* Row 3: Address (span 2), City (span 1), State (span 1) */}
              <div className="compact-field col-span-2">
                <label className="compact-field-label">Address / Shop Address</label>
                <input
                  type="text"
                  className="compact-field-input"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  placeholder="Door / Building / Street name"
                />
              </div>

              <div className="compact-field col-span-1">
                <label className="compact-field-label">City / Town</label>
                <input
                  type="text"
                  className="compact-field-input"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                  placeholder="City / Town"
                />
              </div>

              <div className="compact-field col-span-1">
                <label className="compact-field-label">State</label>
                <input
                  type="text"
                  className="compact-field-input"
                  value={customerForm.state}
                  onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                  placeholder="State (e.g. Maharashtra)"
                />
              </div>

              {/* Row 4: Pincode (span 1), Internal Notes (span 3) */}
              <div className="compact-field col-span-1">
                <label className="compact-field-label">Pincode</label>
                <input
                  type="text"
                  className="compact-field-input font-mono"
                  value={customerForm.pincode}
                  onChange={(e) => setCustomerForm({ ...customerForm, pincode: e.target.value })}
                  placeholder="400001"
                />
              </div>

              <div className="compact-field col-span-3">
                <label className="compact-field-label">Internal Notes (Optional)</label>
                <input
                  type="text"
                  className="compact-field-input"
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  placeholder="Customer preferences, referral, family details..."
                />
              </div>

              {/* OPENING BALANCES & METAL KHATA ("OP") SECTION - FULL LUXURY SUITE */}
              <div className="col-span-4 pt-1 mt-1 border-t border-[var(--border-subtle)]">
                <div className="opening-section-compact-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Coins size={15} color="var(--gold-primary)" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--gold-primary)' }}>
                      Opening Khata & Metal Balances (At Registration)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Primary Direction Toggle */}
                    <div className="opening-direction-toggle">
                      <button
                        type="button"
                        className={`opening-dir-btn ${customerPrimaryDirection === 'DEBIT' ? 'active' : ''}`}
                        onClick={() => handleCustomerPrimaryDirectionChange('DEBIT')}
                      >
                        Customer Owes Us / Baaki (Dr - बाकी)
                      </button>
                      <button
                        type="button"
                        className={`opening-dir-btn ${customerPrimaryDirection === 'CREDIT' ? 'active' : ''}`}
                        onClick={() => handleCustomerPrimaryDirectionChange('CREDIT')}
                      >
                        We Owe Customer / Jama (Cr - जमा)
                      </button>
                    </div>

                    {/* Opening Date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Date:</span>
                      <input
                        type="date"
                        className="compact-field-input font-mono"
                        style={{ height: '26px', width: '125px', padding: '0 4px', fontSize: '0.75rem' }}
                        value={customerForm.opening_balance_date}
                        onChange={(e) =>
                          setCustomerForm({ ...customerForm, opening_balance_date: e.target.value })
                        }
                      />
                    </div>

                    {/* Ref Voucher */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ref #:</span>
                      <input
                        type="text"
                        className="compact-field-input font-mono uppercase"
                        style={{ height: '26px', width: '120px', padding: '0 4px', fontSize: '0.75rem' }}
                        placeholder="OB-VOUCHER"
                        value={customerForm.opening_balance_ref}
                        onChange={(e) =>
                          setCustomerForm({ ...customerForm, opening_balance_ref: e.target.value.toUpperCase() })
                        }
                      />
                    </div>

                    {/* Opening Balance Notes */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Notes:</span>
                      <input
                        type="text"
                        className="compact-field-input"
                        style={{ height: '26px', width: '140px', padding: '0 4px', fontSize: '0.75rem' }}
                        placeholder="Old bahi-khata note"
                        value={customerForm.opening_balance_notes}
                        onChange={(e) =>
                          setCustomerForm({ ...customerForm, opening_balance_notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 4 Opening Cards Grid: Row 1 = Cash & Bank, Row 2 = Gold & Silver */}
                <div className="opening-cards-grid">
                  {/* Cash Card */}
                  <div className="opening-card-compact card-cash">
                    <div className="card-heading">
                      <span className="card-title-badge" style={{ color: '#10b981' }}>
                        <Banknote size={15} />
                        Cash Opening (₹)
                      </span>
                      <select
                        className="opening-type-select"
                        value={customerForm.opening_cash_type}
                        onChange={(e) =>
                          setCustomerForm({
                            ...customerForm,
                            opening_cash_type: e.target.value as 'DEBIT' | 'CREDIT',
                          })
                        }
                      >
                        <option value="DEBIT">Baaki / Dr (Customer Owes - बाकी)</option>
                        <option value="CREDIT">Jama / Cr (Advance - जमा)</option>
                      </select>
                    </div>
                    <div className="opening-currency-input-row">
                      <div className="opening-input-wrapper">
                        <span className="opening-input-prefix">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="opening-styled-input"
                          placeholder="0.00"
                          value={customerForm.opening_cash_balance || ''}
                          onChange={(e) =>
                            setCustomerForm({
                              ...customerForm,
                              opening_cash_balance: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <span className={`opening-status-chip ${customerForm.opening_cash_type === 'DEBIT' ? 'is-debit' : 'is-credit'}`}>
                        {customerForm.opening_cash_type === 'DEBIT' ? 'Dr / बाकी' : 'Cr / जमा'}
                      </span>
                    </div>
                  </div>

                  {/* Bank Card */}
                  <div className="opening-card-compact card-bank">
                    <div className="card-heading">
                      <span className="card-title-badge" style={{ color: '#3b82f6' }}>
                        <CreditCard size={15} />
                        Bank / RTGS Opening (₹)
                      </span>
                      <select
                        className="opening-type-select"
                        value={customerForm.opening_bank_type}
                        onChange={(e) =>
                          setCustomerForm({
                            ...customerForm,
                            opening_bank_type: e.target.value as 'DEBIT' | 'CREDIT',
                          })
                        }
                      >
                        <option value="DEBIT">Baaki / Dr (Customer Owes - बाकी)</option>
                        <option value="CREDIT">Jama / Cr (Advance - जमा)</option>
                      </select>
                    </div>
                    <div className="opening-currency-input-row">
                      <div className="opening-input-wrapper">
                        <span className="opening-input-prefix">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="opening-styled-input"
                          placeholder="0.00"
                          value={customerForm.opening_bank_balance || ''}
                          onChange={(e) =>
                            setCustomerForm({
                              ...customerForm,
                              opening_bank_balance: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <span className={`opening-status-chip ${customerForm.opening_bank_type === 'DEBIT' ? 'is-debit' : 'is-credit'}`}>
                        {customerForm.opening_bank_type === 'DEBIT' ? 'Dr / बाकी' : 'Cr / जमा'}
                      </span>
                    </div>
                  </div>

                  {/* Gold Card */}
                  <div className="opening-card-compact card-gold">
                    <div className="card-heading">
                      <span className="card-title-badge" style={{ color: '#b8860b' }}>
                        <Coins size={15} />
                        Gold Opening (grams)
                      </span>
                      <select
                        className="opening-type-select"
                        value={customerForm.opening_gold_type}
                        onChange={(e) =>
                          setCustomerForm({
                            ...customerForm,
                            opening_gold_type: e.target.value as 'DEBIT' | 'CREDIT',
                          })
                        }
                      >
                        <option value="DEBIT">Baaki / Dr (Owes Gold - बाकी)</option>
                        <option value="CREDIT">Jama / Cr (Deposited - जमा)</option>
                      </select>
                    </div>
                    <div className="opening-metal-inputs-grid">
                      <div className="compact-field-group">
                        <span className="compact-field-label">Weight (g) *</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="compact-field-input"
                          style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}
                          placeholder="0.000 g"
                          value={customerForm.opening_gold_weight || ''}
                          onChange={(e) => {
                            const wt = parseFloat(e.target.value) || 0;
                            const rate = customerForm.opening_gold_rate || 0;
                            setCustomerForm({
                              ...customerForm,
                              opening_gold_weight: wt,
                              opening_gold_value: rate > 0 ? Number((wt * rate).toFixed(2)) : customerForm.opening_gold_value || 0,
                            });
                          }}
                        />
                      </div>
                      <div className="compact-field-group">
                        <span className="compact-field-label">Select Karat/Purity</span>
                        <select
                          className="compact-field-select"
                          style={{ fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }}
                          value={customerForm.opening_gold_purity_id}
                          onChange={(e) =>
                            setCustomerForm({
                              ...customerForm,
                              opening_gold_purity_id: e.target.value,
                            })
                          }
                        >
                          <option value="">Select Karat</option>
                          {goldPurities.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.tunch_percent ? `(${p.tunch_percent}%)` : `(${p.code})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="compact-field-group">
                        <span className="compact-field-label">Rate (₹/g)</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className="compact-field-input"
                          style={{ fontFamily: 'var(--font-mono, monospace)' }}
                          placeholder="₹/g"
                          value={customerForm.opening_gold_rate || ''}
                          onChange={(e) => {
                            const rate = parseFloat(e.target.value) || 0;
                            const wt = customerForm.opening_gold_weight || 0;
                            setCustomerForm({
                              ...customerForm,
                              opening_gold_rate: rate,
                              opening_gold_value: Number((wt * rate).toFixed(2)),
                            });
                          }}
                        />
                      </div>
                    </div>
                    {Boolean(customerForm.opening_gold_value && customerForm.opening_gold_value > 0) && (
                      <div className="opening-metal-valuation-strip gold-val">
                        <span>🪙 Gold Valuation:</span>
                        <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                          ₹{customerForm.opening_gold_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Silver Card */}
                  <div className="opening-card-compact card-silver">
                    <div className="card-heading">
                      <span className="card-title-badge" style={{ color: '#64748b' }}>
                        <Scale size={15} />
                        Silver Opening (grams)
                      </span>
                      <select
                        className="opening-type-select"
                        value={customerForm.opening_silver_type}
                        onChange={(e) =>
                          setCustomerForm({
                            ...customerForm,
                            opening_silver_type: e.target.value as 'DEBIT' | 'CREDIT',
                          })
                        }
                      >
                        <option value="DEBIT">Baaki / Dr (Owes Silver - बाकी)</option>
                        <option value="CREDIT">Jama / Cr (Deposited - जमा)</option>
                      </select>
                    </div>
                    <div className="opening-metal-inputs-grid">
                      <div className="compact-field-group">
                        <span className="compact-field-label">Weight (g) *</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="compact-field-input"
                          style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}
                          placeholder="0.000 g"
                          value={customerForm.opening_silver_weight || ''}
                          onChange={(e) => {
                            const wt = parseFloat(e.target.value) || 0;
                            const rate = customerForm.opening_silver_rate || 0;
                            setCustomerForm({
                              ...customerForm,
                              opening_silver_weight: wt,
                              opening_silver_value: rate > 0 ? Number((wt * rate).toFixed(2)) : customerForm.opening_silver_value || 0,
                            });
                          }}
                        />
                      </div>
                      <div className="compact-field-group">
                        <span className="compact-field-label">Select Purity</span>
                        <select
                          className="compact-field-select"
                          style={{ fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }}
                          value={customerForm.opening_silver_purity_id}
                          onChange={(e) =>
                            setCustomerForm({
                              ...customerForm,
                              opening_silver_purity_id: e.target.value,
                            })
                          }
                        >
                          <option value="">Select Purity</option>
                          {silverPurities.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.tunch_percent ? `(${p.tunch_percent}%)` : `(${p.code})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="compact-field-group">
                        <span className="compact-field-label">Rate (₹/g)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className="compact-field-input"
                          style={{ fontFamily: 'var(--font-mono, monospace)' }}
                          placeholder="₹/g"
                          value={customerForm.opening_silver_rate || ''}
                          onChange={(e) => {
                            const rate = parseFloat(e.target.value) || 0;
                            const wt = customerForm.opening_silver_weight || 0;
                            setCustomerForm({
                              ...customerForm,
                              opening_silver_rate: rate,
                              opening_silver_value: Number((wt * rate).toFixed(2)),
                            });
                          }}
                        />
                      </div>
                    </div>
                    {Boolean(customerForm.opening_silver_value && customerForm.opening_silver_value > 0) && (
                      <div className="opening-metal-valuation-strip silver-val">
                        <span>⚪ Silver Valuation:</span>
                        <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                          ₹{customerForm.opening_silver_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Net Summary Bar */}
                {(() => {
                  const isCurDebit = netMonetary > 0;
                  const isCurCredit = netMonetary < 0;
                  return (
                    <div className="opening-net-summary-strip">
                      <div className="opening-net-group">
                        <span className="opening-net-label">Net Currency:</span>
                        <span
                          className={`opening-net-badge ${
                            isCurDebit
                              ? 'badge-currency-dr'
                              : isCurCredit
                              ? 'badge-currency-cr'
                              : 'badge-currency-nil'
                          }`}
                        >
                          ₹{Math.abs(netMonetary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {isCurDebit
                            ? ' (Dr / Customer Owes Us)'
                            : isCurCredit
                            ? ' (Cr / We Owe Customer)'
                            : ' (₹0.00 Nil)'}
                        </span>
                      </div>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        {Boolean(customerForm.opening_gold_weight && customerForm.opening_gold_weight > 0) && (
                          <div className="opening-net-group">
                            <span className="opening-net-label">Gold:</span>
                            <span className="opening-net-badge badge-gold">
                              🟡 {Number(customerForm.opening_gold_weight).toFixed(3)}g ({customerForm.opening_gold_type === 'DEBIT' ? 'Dr / बाकी' : 'Cr / जमा'})
                            </span>
                          </div>
                        )}

                        {Boolean(customerForm.opening_silver_weight && customerForm.opening_silver_weight > 0) && (
                          <div className="opening-net-group">
                            <span className="opening-net-label">Silver:</span>
                            <span className="opening-net-badge badge-silver">
                              ⚪ {Number(customerForm.opening_silver_weight).toFixed(3)}g ({customerForm.opening_silver_type === 'DEBIT' ? 'Dr / बाकी' : 'Cr / जमा'})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="customer-modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.25rem',
                background: 'var(--gold-gradient)',
                border: 'none',
                borderRadius: '6px',
                color: '#1A160F',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              <Save size={15} />
              <span>{submitting ? 'Saving to Master...' : 'Save & Select Customer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
