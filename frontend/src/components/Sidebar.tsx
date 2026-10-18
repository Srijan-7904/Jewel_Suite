import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Hammer,
  Wallet,
  Boxes,
  FileBarChart,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Gem,
} from 'lucide-react';
import './Sidebar.css';

interface NavSection {
  title: string;
  icon: React.ReactNode;
  items: { label: string; path: string; badge?: string }[];
}

export const Sidebar: React.FC = () => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Overview: true,
    Billing: true,
    Workshop: false,
    Finance: false,
    Inventory: false,
    Reports: false,
    Masters: false,
    Settings: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      icon: <LayoutDashboard size={18} />,
      items: [
        { label: 'Dashboard', path: '/dashboard' },
      ],
    },
    {
      title: 'Billing',
      icon: <Receipt size={18} />,
      items: [
        { label: 'All Invoices', path: '/billing/invoices' },
        { label: 'Create Invoice', path: '/billing/create', badge: 'POS' },
        { label: 'Purchase Bill', path: '/billing/purchases' },
        { label: 'Karigar Bill', path: '/billing/karigar-bill' },
        { label: 'Exchange', path: '/billing/exchange' },
        { label: 'Repair', path: '/billing/repair' },
        { label: 'Estimates', path: '/billing/estimates' },
      ],
    },
    {
      title: 'Workshop',
      icon: <Hammer size={18} />,
      items: [
        { label: 'Issue Register', path: '/workshop/issue-register' },
        { label: 'Karigar', path: '/workshop/karigars' },
        { label: 'Karigar Jobs', path: '/workshop/jobs' },
        { label: 'Repairs', path: '/workshop/repairs' },
      ],
    },
    {
      title: 'Finance',
      icon: <Wallet size={18} />,
      items: [
        { label: 'Customer Ledger', path: '/finance/ledger/customer' },
        { label: 'Supplier Ledger', path: '/finance/ledger/supplier' },
        { label: 'Karigar Ledger', path: '/finance/ledger/karigar' },
        { label: 'Payments', path: '/finance/payments' },
        { label: 'Cash Book', path: '/finance/cash-book' },
        { label: 'Girvi Loans', path: '/finance/girvi' },
        { label: 'Saving Schemes', path: '/finance/saving-schemes' },
      ],
    },
    {
      title: 'Inventory',
      icon: <Boxes size={18} />,
      items: [
        { label: 'Stock & Showcase', path: '/inventory/stock' },
      ],
    },
    {
      title: 'Reports',
      icon: <FileBarChart size={18} />,
      items: [
        { label: 'Daybook & Reports', path: '/reports' },
      ],
    },
    {
      title: 'Masters',
      icon: <Users size={18} />,
      items: [
        { label: 'Customers', path: '/masters/customers' },
        { label: 'Suppliers', path: '/masters/suppliers' },
        { label: 'Categories', path: '/masters/categories' },
        { label: 'Products', path: '/masters/products' },
        { label: 'Au/Ag Rates', path: '/masters/rates', badge: 'Live' },
      ],
    },
    {
      title: 'Settings',
      icon: <Settings size={18} />,
      items: [
        { label: 'Store Configuration', path: '/system/settings' },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon-wrapper">
          <Gem className="brand-gem" size={24} />
        </div>
        <div className="brand-info">
          <span className="brand-title font-serif">JEWEL SUITE</span>
          <span className="brand-subtitle">Gold & Diamond ERP</span>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-nav">
        {navSections.map((section) => {
          const isOpen = openSections[section.title] ?? false;
          return (
            <div key={section.title} className="nav-group">
              <button
                type="button"
                className="nav-group-header"
                onClick={() => toggleSection(section.title)}
              >
                <div className="nav-group-title">
                  <span className="nav-icon">{section.icon}</span>
                  <span className="nav-label">{section.title}</span>
                </div>
                <span className="nav-chevron">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </button>

              {isOpen && (
                <div className="nav-items-list">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        isActive ? 'nav-item active' : 'nav-item'
                      }
                    >
                      <span className="nav-item-bullet" />
                      <span className="nav-item-text">{item.label}</span>
                      {item.badge && (
                        <span className="nav-item-badge">{item.badge}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Offline Status Footer */}
      <div className="sidebar-footer">
        <div className="offline-pill">
          <span className="offline-dot" />
          <span className="offline-text">OFFLINE LOCALHOST</span>
        </div>
        <div className="version-tag font-mono">v1.0.0-foundation</div>
      </div>
    </aside>
  );
};
