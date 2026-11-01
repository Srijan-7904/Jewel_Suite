import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Truck,
  Phone,
  MapPin,
  X,
  ChevronDown,
  Check,
  UserPlus,
  Loader2,
  Banknote,
} from 'lucide-react';
import { Supplier } from '../types';
import { supplierApi } from '../services/masters';
import './CustomerSearchSelect.css';
import './SupplierSearchSelect.css';

export interface SupplierSearchSelectProps {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSelectSupplier: (supplier: Supplier) => void;
  onClearSupplier?: () => void;
  onAddNewSupplier?: (initialQuery?: string) => void;
  onQuickCashSupplier?: () => void;
  onSupplierDiscovered?: (supplier: Supplier) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SupplierSearchSelect: React.FC<SupplierSearchSelectProps> = ({
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  onClearSupplier,
  onAddNewSupplier,
  onQuickCashSupplier,
  onSupplierDiscovered,
  placeholder = 'Search supplier or purchase account by name, phone, code...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiSuppliers, setApiSuppliers] = useState<Supplier[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Combine local master list with any discovered suppliers
  const allKnownSuppliers = useMemo(() => {
    const map = new Map<string, Supplier>();
    suppliers.forEach((s) => map.set(s.id, s));
    apiSuppliers.forEach((s) => {
      if (!map.has(s.id)) map.set(s.id, s);
    });
    return Array.from(map.values());
  }, [suppliers, apiSuppliers]);

  const selectedSupplier = useMemo(() => {
    return allKnownSuppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [allKnownSuppliers, selectedSupplierId]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      setActiveIndex(0);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Debounced API search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setApiSuppliers([]);
      setIsSearchingApi(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingApi(true);
        const res = await supplierApi.list({ search: trimmed, pageSize: 25 });
        const items = res?.items || [];
        setApiSuppliers(items);

        if (onSupplierDiscovered) {
          items.forEach((item) => {
            if (!suppliers.some((s) => s.id === item.id)) {
              onSupplierDiscovered(item);
            }
          });
        }
      } catch {
        // keep local search results
      } finally {
        setIsSearchingApi(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, suppliers, onSupplierDiscovered]);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = searchQuery.replace(/\D/g, '');

    if (!query) {
      return allKnownSuppliers;
    }

    return allKnownSuppliers.filter((s) => {
      if (s.name && s.name.toLowerCase().includes(query)) return true;
      if (s.supplier_code && s.supplier_code.toLowerCase().includes(query)) return true;
      if (s.phone) {
        if (s.phone.toLowerCase().includes(query)) return true;
        if (queryDigits.length >= 2 && s.phone.replace(/\D/g, '').includes(queryDigits)) return true;
      }
      if (s.city && s.city.toLowerCase().includes(query)) return true;
      if (s.address && s.address.toLowerCase().includes(query)) return true;
      if (s.gstin && s.gstin.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [allKnownSuppliers, searchQuery]);

  // Scroll active into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>('.customer-select-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < filteredSuppliers.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredSuppliers.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredSuppliers[activeIndex]) {
          handleSelect(filteredSuppliers[activeIndex]);
        } else if (onAddNewSupplier && searchQuery.trim()) {
          onAddNewSupplier(searchQuery.trim());
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (supplier: Supplier) => {
    onSelectSupplier(supplier);
    setIsOpen(false);
    setSearchQuery('');
  };

  const isCashSupplier = useMemo(() => {
    if (!selectedSupplier) return false;
    const n = (selectedSupplier.name || '').toUpperCase();
    const c = (selectedSupplier.supplier_code || '').toUpperCase();
    return (
      n.includes('CASH') ||
      n.includes('WALK-IN') ||
      n.includes('WALKIN') ||
      c === 'CASH' ||
      selectedSupplier.phone === '9999999999'
    );
  }, [selectedSupplier]);

  return (
    <div
      ref={containerRef}
      className={`customer-search-select-container supplier-search-select-container uppercase ${isOpen ? 'is-open' : ''} ${
        disabled ? 'is-disabled' : ''
      } ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* TRIGGER BAR */}
      <div
        className="customer-select-trigger font-mono uppercase"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {selectedSupplier ? (
          <div className="selected-customer-pill uppercase">
            <div className={`customer-avatar-badge ${isCashSupplier ? 'is-cash' : 'is-supplier'}`}>
              {isCashSupplier ? (
                <Banknote size={15} />
              ) : (
                (selectedSupplier.supplier_code || selectedSupplier.name.slice(0, 2)).toUpperCase()
              )}
            </div>
            <div className="selected-customer-details">
              <div className="selected-customer-name-row">
                <span className="selected-name font-bold text-main">
                  {selectedSupplier.name}
                </span>
                {selectedSupplier.supplier_code && !isCashSupplier && (
                  <span className="selected-code-badge font-mono">
                    {selectedSupplier.supplier_code}
                  </span>
                )}
                {isCashSupplier && (
                  <span className="selected-walkin-badge">
                    SPOT CASH PURCHASE
                  </span>
                )}
              </div>
              <div className="customer-contact-line text-xs text-muted">
                {selectedSupplier.contact_person && (
                  <>
                    <span className="text-gold font-medium">Attn: {selectedSupplier.contact_person}</span>
                    <span className="customer-contact-bullet">•</span>
                  </>
                )}
                {selectedSupplier.phone && (
                  <span className="customer-contact-phone">
                    <Phone size={10} className="inline-icon" />
                    <span>{selectedSupplier.phone}</span>
                  </span>
                )}
                {selectedSupplier.phone && (selectedSupplier.address || selectedSupplier.city) && (
                  <span className="customer-contact-bullet">•</span>
                )}
                {(selectedSupplier.address || selectedSupplier.city) && (
                  <span className="customer-contact-address">
                    <MapPin size={10} className="inline-icon" />
                    <span>{[selectedSupplier.address, selectedSupplier.city].filter(Boolean).join(', ')}</span>
                  </span>
                )}
                {selectedSupplier.gstin && (
                  <>
                    <span className="customer-contact-bullet">•</span>
                    <span className="text-gold">GST: {selectedSupplier.gstin}</span>
                  </>
                )}
              </div>

              {/* Live Closing Balances */}
              {!isCashSupplier && (
                <div className="supplier-select-balances flex items-center gap-2 mt-0.5 text-[11px] font-mono">
                  {selectedSupplier.current_balance !== undefined && selectedSupplier.current_balance !== null && (
                    <span
                      className={`font-semibold ${
                        Number(selectedSupplier.current_balance) > 0
                          ? 'text-rose-400'
                          : Number(selectedSupplier.current_balance) < 0
                          ? 'text-emerald-400'
                          : 'text-muted'
                      }`}
                    >
                      Bal: ₹{Math.abs(Number(selectedSupplier.current_balance)).toLocaleString('en-IN')}{' '}
                      {Number(selectedSupplier.current_balance) > 0 ? 'Jama (Cr)' : Number(selectedSupplier.current_balance) < 0 ? 'Baaki (Dr)' : 'Nil'}
                    </span>
                  )}
                  {Number(selectedSupplier.gold_balance_grams || 0) !== 0 && (
                    <span className="text-amber-400 font-semibold">
                      Au: {Number(selectedSupplier.gold_balance_grams).toFixed(3)}g{' '}
                      {Number(selectedSupplier.gold_balance_grams) > 0 ? 'Jama (Cr)' : 'Baaki (Dr)'}
                    </span>
                  )}
                  {Number(selectedSupplier.silver_balance_grams || 0) !== 0 && (
                    <span className="text-slate-300 font-semibold">
                      Ag: {Number(selectedSupplier.silver_balance_grams).toFixed(3)}g{' '}
                      {Number(selectedSupplier.silver_balance_grams) > 0 ? 'Jama (Cr)' : 'Baaki (Dr)'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="customer-select-placeholder uppercase">
            <Truck size={14} className="placeholder-icon text-muted" />
            <span className="placeholder-text">{placeholder}</span>
          </div>
        )}

        <div className="customer-select-actions">
          {selectedSupplier && onClearSupplier && !disabled && (
            <button
              type="button"
              className="btn-clear-selection"
              onClick={(e) => {
                e.stopPropagation();
                onClearSupplier();
              }}
              title="Deselect supplier"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown size={14} className={`dropdown-caret ${isOpen ? 'rotate' : ''}`} />
        </div>
      </div>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="customer-select-dropdown uppercase" role="listbox">
          {/* SEARCH INPUT BAR */}
          <div className="dropdown-search-bar">
            <Search size={14} className="search-input-icon text-muted" />
            <input
              ref={inputRef}
              type="text"
              className="dropdown-search-input uppercase font-mono"
              placeholder="Type supplier name, phone, code, or city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveIndex(0);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {isSearchingApi && <Loader2 size={13} className="spin text-gold" />}
            {searchQuery && (
              <button
                type="button"
                className="btn-clear-query"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* QUICK SHORTCUT BUTTONS BAR */}
          <div className="dropdown-shortcuts-bar">
            {onQuickCashSupplier && (
              <button
                type="button"
                className="shortcut-btn quick-walkin uppercase"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickCashSupplier();
                  setIsOpen(false);
                }}
                title="Quick Spot Cash Purchase Supplier (No Khata Ledger)"
              >
                <Banknote size={12} />
                <span>+ CASH SUPPLIER</span>
              </button>
            )}

            {onAddNewSupplier && (
              <button
                type="button"
                className="shortcut-btn add-new uppercase"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNewSupplier(searchQuery.trim());
                  setIsOpen(false);
                }}
                title="Create New Supplier in Master Directory"
              >
                <UserPlus size={12} />
                <span>+ Add Supplier</span>
              </button>
            )}
          </div>

          {/* SUPPLIERS LIST */}
          <div ref={listRef} className="customer-select-list custom-scrollbar">
            {filteredSuppliers.length === 0 ? (
              <div className="no-customers-found uppercase">
                <p className="no-cust-title">No matching suppliers found</p>
                <p className="no-cust-hint font-mono">
                  {searchQuery ? `No supplier matching "${searchQuery}"` : 'No suppliers registered in master directory'}
                </p>
                {onAddNewSupplier && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs mt-2 uppercase"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNewSupplier(searchQuery.trim());
                      setIsOpen(false);
                    }}
                  >
                    <UserPlus size={11} />
                    <span>Create "{searchQuery.trim() || 'New Supplier'}"</span>
                  </button>
                )}
              </div>
            ) : (
              filteredSuppliers.map((supplier, idx) => {
                const isSelected = supplier.id === selectedSupplierId;
                const isActive = idx === activeIndex;

                return (
                  <div
                    key={supplier.id}
                    className={`customer-select-item uppercase ${isSelected ? 'selected' : ''} ${
                      isActive ? 'active' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(supplier);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="item-avatar-col">
                      <div className="item-avatar-circle">
                        {(supplier.supplier_code || supplier.name.slice(0, 2)).toUpperCase()}
                      </div>
                    </div>

                    <div className="item-content-col">
                      <div className="item-primary-line">
                        <span className="item-name font-bold text-main">{supplier.name}</span>
                        {supplier.supplier_code && (
                          <span className="item-code-tag font-mono">{supplier.supplier_code}</span>
                        )}
                      </div>

                      <div className="customer-contact-line text-xs text-muted">
                        {supplier.contact_person && (
                          <>
                            <span className="text-gold font-medium">Attn: {supplier.contact_person}</span>
                            <span className="customer-contact-bullet">•</span>
                          </>
                        )}
                        {supplier.phone && (
                          <span className="customer-contact-phone font-mono">
                            <Phone size={10} className="inline-icon" />
                            <span>{supplier.phone}</span>
                          </span>
                        )}
                        {supplier.phone && (supplier.address || supplier.city) && (
                          <span className="customer-contact-bullet">•</span>
                        )}
                        {(supplier.address || supplier.city) && (
                          <span className="customer-contact-address">
                            <MapPin size={10} className="inline-icon" />
                            <span>{[supplier.address, supplier.city].filter(Boolean).join(', ')}</span>
                          </span>
                        )}
                        {supplier.gstin && (
                          <>
                            <span className="customer-contact-bullet">•</span>
                            <span className="text-gold font-mono">GST: {supplier.gstin}</span>
                          </>
                        )}
                      </div>

                      {/* Supplier Live Closing Balances */}
                      <div className="supplier-item-balances flex items-center gap-2 mt-0.5 text-[11px] font-mono">
                        {supplier.current_balance !== undefined && supplier.current_balance !== null && Number(supplier.current_balance) !== 0 && (
                          <span
                            className={`font-semibold ${
                              Number(supplier.current_balance) > 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            ₹{Math.abs(Number(supplier.current_balance)).toLocaleString('en-IN')}{' '}
                            {Number(supplier.current_balance) > 0 ? 'Jama / Cr (Payable)' : 'Baaki / Dr (Adv)'}
                          </span>
                        )}
                        {Number(supplier.gold_balance_grams || 0) !== 0 && (
                          <span className="text-amber-400 font-semibold">
                            Au: {Number(supplier.gold_balance_grams).toFixed(3)}g{' '}
                            {Number(supplier.gold_balance_grams) > 0 ? 'Jama (Cr)' : 'Baaki (Dr)'}
                          </span>
                        )}
                        {Number(supplier.silver_balance_grams || 0) !== 0 && (
                          <span className="text-slate-300 font-semibold">
                            Ag: {Number(supplier.silver_balance_grams).toFixed(3)}g{' '}
                            {Number(supplier.silver_balance_grams) > 0 ? 'Jama (Cr)' : 'Baaki (Dr)'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="item-trailing-col">
                      {isSelected && <Check size={14} className="text-gold font-bold" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
