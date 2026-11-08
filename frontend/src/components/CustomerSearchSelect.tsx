import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  User,
  Phone,
  MapPin,
  X,
  ChevronDown,
  Check,
  UserPlus,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { Customer } from '../types';
import { customerApi } from '../services/masters';
import './CustomerSearchSelect.css';

export interface CustomerSearchSelectProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer?: () => void;
  onAddNewCustomer?: (initialQuery?: string) => void;
  onQuickWalkin?: () => void;
  onCustomerDiscovered?: (customer: Customer) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const CustomerSearchSelect: React.FC<CustomerSearchSelectProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onClearCustomer,
  onAddNewCustomer,
  onQuickWalkin,
  onCustomerDiscovered,
  placeholder = 'Search customer by name or phone (e.g. Srijan / 96281...)',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiCustomers, setApiCustomers] = useState<Customer[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Identify current selected customer from combined local + discovered customers
  const allKnownCustomers = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    apiCustomers.forEach((c) => {
      if (!map.has(c.id)) map.set(c.id, c);
    });
    return Array.from(map.values());
  }, [customers, apiCustomers]);

  const selectedCustomer = useMemo(() => {
    return allKnownCustomers.find((c) => c.id === selectedCustomerId) || null;
  }, [allKnownCustomers, selectedCustomerId]);

  // Click outside listener to close dropdown
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

  // Debounced API search for server-side lookups
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setApiCustomers([]);
      setIsSearchingApi(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingApi(true);
        const res = await customerApi.list({ search: trimmed, pageSize: 25 });
        const items = res?.items || [];
        setApiCustomers(items);

        // Notify parent of any discovered customer records
        if (onCustomerDiscovered) {
          items.forEach((item) => {
            if (!customers.some((c) => c.id === item.id)) {
              onCustomerDiscovered(item);
            }
          });
        }
      } catch {
        // Silently keep local search results
      } finally {
        setIsSearchingApi(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, customers, onCustomerDiscovered]);

  // Filter customers based on query
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = searchQuery.replace(/\D/g, '');

    if (!query) {
      return allKnownCustomers;
    }

    return allKnownCustomers.filter((c) => {
      // 1. Name match
      if (c.name && c.name.toLowerCase().includes(query)) return true;

      // 2. Customer code match
      if (c.customer_code && c.customer_code.toLowerCase().includes(query)) return true;

      // 3. Phone match (exact substring or normalized digits)
      if (c.phone) {
        const phoneLower = c.phone.toLowerCase();
        if (phoneLower.includes(query)) return true;
        if (queryDigits.length >= 2) {
          const cleanPhone = c.phone.replace(/\D/g, '');
          if (cleanPhone.includes(queryDigits)) return true;
        }
      }

      // 4. Alternate phone match
      if (c.alternate_phone) {
        const altLower = c.alternate_phone.toLowerCase();
        if (altLower.includes(query)) return true;
        if (queryDigits.length >= 2) {
          const cleanAlt = c.alternate_phone.replace(/\D/g, '');
          if (cleanAlt.includes(queryDigits)) return true;
        }
      }

      // 5. City or Address match
      if (c.city && c.city.toLowerCase().includes(query)) return true;
      if (c.address && c.address.toLowerCase().includes(query)) return true;

      return false;
    });
  }, [allKnownCustomers, searchQuery]);

  // Scroll active item into view
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
        setActiveIndex((prev) => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredCustomers.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCustomers.length > 0 && filteredCustomers[activeIndex]) {
          handleSelect(filteredCustomers[activeIndex]);
        } else if (onAddNewCustomer && searchQuery.trim()) {
          onAddNewCustomer(searchQuery.trim());
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    if (onCustomerDiscovered) {
      onCustomerDiscovered(customer);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClearCustomer) {
      onClearCustomer();
    }
    setSearchQuery('');
    setIsOpen(true);
  };

  // Helper to highlight search matches in text
  const highlightMatch = (text: string | null | undefined, query: string) => {
    if (!text) return null;
    const trimmed = query.trim();
    if (!trimmed) return text;

    // Check if query is numeric for phone matching
    const queryDigits = trimmed.replace(/\D/g, '');
    const isDigitsSearch = queryDigits.length >= 2 && /^\d+$/.test(trimmed);

    let regex: RegExp;
    try {
      if (isDigitsSearch) {
        regex = new RegExp(`(${queryDigits})`, 'gi');
      } else {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`(${escaped})`, 'gi');
      }
    } catch {
      return text;
    }

    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="cust-match-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Get customer initials for avatar
  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return 'C';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      ref={containerRef}
      className={`customer-search-select-container ${isOpen ? 'is-open' : ''} ${
        disabled ? 'is-disabled' : ''
      } ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* TRIGGER DISPLAY / CLOSED BOX */}
      {!isOpen ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className="customer-select-trigger"
          onClick={() => !disabled && setIsOpen(true)}
        >
          {selectedCustomer ? (
            <div className="selected-customer-pill">
              <div className="customer-avatar-badge">{getInitials(selectedCustomer.name)}</div>
              <div className="selected-customer-details">
                <div className="selected-customer-name-row">
                  <span className="selected-name">{selectedCustomer.name}</span>
                  {selectedCustomer.phone && (
                    <span className="selected-phone font-mono">
                      <Phone size={11} className="inline-icon" />
                      {selectedCustomer.phone}
                    </span>
                  )}
                  <span className={`selected-type-badge ${selectedCustomer.customer_type?.toLowerCase() || 'retail'}`}>
                    {selectedCustomer.customer_type || 'RETAIL'}
                  </span>
                  {(() => {
                    const n = (selectedCustomer.name || '').toUpperCase();
                    const code = (selectedCustomer.customer_code || '').toUpperCase();
                    const isCash = n.includes('CASH') || n.includes('WALK-IN') || n.includes('WALKIN') || code === 'CASH';
                    if (isCash) {
                      return <span className="selected-balance-pill is-cash-sale font-mono">CASH SALE</span>;
                    }
                    if (selectedCustomer.current_balance !== undefined && selectedCustomer.current_balance !== 0) {
                      return (
                        <span className={`selected-balance-pill ${selectedCustomer.current_balance > 0 ? 'is-debit' : 'is-credit'} font-mono`}>
                          {selectedCustomer.current_balance > 0
                            ? `₹${Number(selectedCustomer.current_balance).toLocaleString('en-IN')} Baaki (Dr)`
                            : `₹${Math.abs(Number(selectedCustomer.current_balance)).toLocaleString('en-IN')} Jama (Cr)`}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                {(selectedCustomer.address || selectedCustomer.city) && (
                  <span
                    className="selected-subaddress"
                    title={[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ')}
                  >
                    <MapPin size={10} className="inline-icon" />
                    {[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="customer-select-placeholder">
              <Search size={15} className="placeholder-icon text-muted" />
              <span>{placeholder}</span>
            </div>
          )}

          <div className="customer-select-actions">
            {selectedCustomer && !disabled && (
              <button
                type="button"
                className="clear-customer-btn"
                title="Clear selected customer"
                onClick={handleClear}
              >
                <X size={14} />
              </button>
            )}
            <ChevronDown size={15} className="chevron-icon text-muted" />
          </div>
        </div>
      ) : (
        /* SEARCH INPUT (ACTIVE WHEN OPEN) */
        <div className="customer-search-input-wrapper">
          <div className="search-input-prefix">
            {isSearchingApi ? (
              <Loader2 size={15} className="spin-icon text-gold" />
            ) : (
              <Search size={15} className="text-gold" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="customer-search-field font-mono"
            placeholder="Type name, phone (e.g. 9628), or city..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveIndex(0);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-query-btn"
              title="Clear search input"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className="close-dropdown-btn"
            title="Close dropdown"
            onClick={() => setIsOpen(false)}
          >
            Esc
          </button>
        </div>
      )}

      {/* FLOATING DROPDOWN LIST */}
      {isOpen && (
        <div className="customer-dropdown-menu">
          {/* Header Bar inside dropdown */}
          <div className="dropdown-meta-header">
            <span className="results-count">
              {filteredCustomers.length}{' '}
              {filteredCustomers.length === 1 ? 'customer found' : 'customers found'}
              {isSearchingApi && <span className="searching-hint"> (searching server...)</span>}
            </span>
            <span className="keyboard-hint">↑↓ to navigate • ↵ to select</span>
          </div>

          {/* Results List */}
          <div ref={listRef} className="customer-select-list">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((cust, idx) => {
                const isSelected = cust.id === selectedCustomerId;
                const isActive = idx === activeIndex;

                return (
                  <div
                    key={cust.id}
                    className={`customer-select-item ${isActive ? 'active' : ''} ${
                      isSelected ? 'is-selected' : ''
                    }`}
                    onClick={() => handleSelect(cust)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <div className="item-avatar">{getInitials(cust.name)}</div>
                    <div className="item-info">
                      <div className="item-primary-row">
                        <span className="item-name">{highlightMatch(cust.name, searchQuery)}</span>
                        {cust.customer_code && (
                          <span className="item-code font-mono">{cust.customer_code}</span>
                        )}
                        {isSelected && (
                          <span className="item-selected-tag">
                            <Check size={12} strokeWidth={2.5} />
                            <span>Current</span>
                          </span>
                        )}
                      </div>

                      <div className="item-secondary-row font-mono">
                        {cust.phone ? (
                          <span className="item-phone">
                            <Phone size={11} className="inline-icon" />
                            {highlightMatch(cust.phone, searchQuery)}
                          </span>
                        ) : (
                          <span className="item-phone text-dim">No phone</span>
                        )}

                        {(cust.address || cust.city) && (
                          <>
                            <span className="item-secondary-dot">•</span>
                            <span className="item-address" title={[cust.address, cust.city].filter(Boolean).join(', ')}>
                              <MapPin size={10} className="inline-icon" />
                              {highlightMatch(
                                [cust.address, cust.city].filter(Boolean).join(', '),
                                searchQuery
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="item-badge-col">
                      {(() => {
                        const n = (cust.name || '').toUpperCase();
                        const code = (cust.customer_code || '').toUpperCase();
                        const isCash = n.includes('CASH') || n.includes('WALK-IN') || n.includes('WALKIN') || code === 'CASH';
                        if (isCash) {
                          return <span className="item-balance-tag is-cash-sale font-mono">CASH SALE</span>;
                        }
                        if (cust.current_balance !== undefined && cust.current_balance !== 0) {
                          return (
                            <span className={`item-balance-tag ${cust.current_balance > 0 ? 'is-debit' : 'is-credit'} font-mono`}>
                              {cust.current_balance > 0
                                ? `₹${Number(cust.current_balance).toLocaleString('en-IN')} Baaki (Dr)`
                                : `₹${Math.abs(Number(cust.current_balance)).toLocaleString('en-IN')} Jama (Cr)`}
                            </span>
                          );
                        }
                        if (cust.current_balance === 0) {
                          return <span className="item-balance-tag is-settled font-mono">₹0</span>;
                        }
                        return null;
                      })()}
                      <span className={`cust-type-pill ${cust.customer_type?.toLowerCase() || 'retail'}`}>
                        {cust.customer_type || 'RETAIL'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              /* EMPTY NO MATCH STATE */
              <div className="customer-select-empty">
                <User size={32} className="empty-icon text-muted opacity-40" />
                <p className="empty-title">
                  No customer matching <strong>"{searchQuery}"</strong>
                </p>
                <p className="empty-sub">
                  Would you like to register this customer or proceed as CASH CUSTOMER?
                </p>
                <div className="empty-actions">
                  {onAddNewCustomer && (
                    <button
                      type="button"
                      className="btn-empty-add"
                      onClick={() => {
                        onAddNewCustomer(searchQuery);
                        setIsOpen(false);
                      }}
                    >
                      <UserPlus size={13} />
                      <span>+ Add "{searchQuery}" as Customer</span>
                    </button>
                  )}
                  {onQuickWalkin && (
                    <button
                      type="button"
                      className="btn-empty-walkin"
                      onClick={() => {
                        onQuickWalkin();
                        setIsOpen(false);
                      }}
                    >
                      <UserCheck size={13} />
                      <span>+ CASH CUSTOMER</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Footer Links */}
          <div className="dropdown-footer-actions">
            {onAddNewCustomer && (
              <button
                type="button"
                className="dropdown-footer-btn add-btn"
                onClick={() => {
                  onAddNewCustomer(searchQuery);
                  setIsOpen(false);
                }}
              >
                <UserPlus size={13} />
                <span>+ Add New Customer</span>
              </button>
            )}
            {onQuickWalkin && (
              <button
                type="button"
                className="dropdown-footer-btn walkin-btn"
                onClick={() => {
                  onQuickWalkin();
                  setIsOpen(false);
                }}
              >
                <UserCheck size={13} />
                <span>+ CASH CUSTOMER</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
