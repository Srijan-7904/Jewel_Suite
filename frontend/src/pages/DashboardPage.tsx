import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rateApi } from '../services/masters';
import { inventoryApi } from '../services/inventory';
import { financeApi } from '../services/finance';
import { reportsApi, DashboardMetricsData } from '../services/reports';
import { CurrentRate, StockValuationResponse, FinanceSummary, Metal, MetalPurity } from '../types';
import {
  TrendingUp,
  Scale,
  ShieldCheck,
  Database,
  Layers,
  Sparkles,
  Wallet,
  Coins,
  Plus,
  Edit3,
  RefreshCw,
  X,
  CheckCircle2,
  ArrowRight,
  Flame,
  Check,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, health } = useAuth();
  const [rates, setRates] = useState<CurrentRate[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [purities, setPurities] = useState<MetalPurity[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [valuation, setValuation] = useState<StockValuationResponse | null>(null);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [reportMetrics, setReportMetrics] = useState<DashboardMetricsData | null>(null);

  // Privacy / Counter Display Mode Toggle (Hand-drawn: "Dashboard [On/Off] [********]")
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    // For counter security, default to true (masked) unless explicitly unlocked
    const stored = localStorage.getItem('jewel_dashboard_privacy');
    if (stored === 'false') return false;
    return true;
  });

  // Password / PIN modal state for unlocking Live Figures (Password: 1234)
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [unlockPin, setUnlockPin] = useState<string>('');
  const [showPinText, setShowPinText] = useState<boolean>(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Collapsible view for advanced full rate cards and foundation health
  const [showExtendedPanels, setShowExtendedPanels] = useState<boolean>(false);

  // Quick Rate Update Modal State
  const [showRateModal, setShowRateModal] = useState(false);
  const [modalMetalId, setModalMetalId] = useState<string>('');
  const [modalPurityId, setModalPurityId] = useState<string>('');
  const [modalRatePerGram, setModalRatePerGram] = useState<string>('');
  const [modalRate10g, setModalRate10g] = useState<string>('');
  const [autoDeriveGold, setAutoDeriveGold] = useState<boolean>(true);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [rateToast, setRateToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Inline "Today Metal Rate Change (Option in Bottom Line)" State
  const [inlineGoldGram, setInlineGoldGram] = useState<string>('');
  const [inlineGold10g, setInlineGold10g] = useState<string>('');
  const [inlineSilverGram, setInlineSilverGram] = useState<string>('');
  const [inlineSilver1kg, setInlineSilver1kg] = useState<string>('');
  const [isSavingInlineRate, setIsSavingInlineRate] = useState<boolean>(false);

  const fetchDashboardData = useCallback(() => {
    setIsLoadingRates(true);
    rateApi.getCurrentRates()
      .then(setRates)
      .catch((err) => console.error('Failed to load dashboard rates:', err))
      .finally(() => setIsLoadingRates(false));

    rateApi.getMetals()
      .then(setMetals)
      .catch((err) => console.error('Failed to load metals:', err));

    rateApi.getAllPurities()
      .then(setPurities)
      .catch((err) => console.error('Failed to load purities:', err));

    inventoryApi.getValuation()
      .then(setValuation)
      .catch((err) => console.error('Failed to load dashboard stock valuation:', err));

    financeApi.getSummary()
      .then(setFinance)
      .catch((err) => console.error('Failed to load dashboard finance summary:', err));

    reportsApi.getDashboardMetrics()
      .then(setReportMetrics)
      .catch((err) => console.error('Failed to load reporting dashboard metrics:', err));
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Identify key benchmark rates: 24K Gold (Fine) and Fine Silver (999)
  const gold24 = rates.find((r) => r.metal_code?.toUpperCase() === 'GOLD' && (r.purity_code?.toUpperCase() === '24K' || r.purity_name?.toLowerCase().includes('24k') || r.purity_code === '999'));
  const silver999 = rates.find((r) => r.metal_code?.toUpperCase() === 'SILVER' && (r.purity_code === '999' || r.purity_name?.includes('999') || r.purity_code?.toUpperCase() === '24K'));

  const hasActiveGold = metals.some((m) => m.code?.toUpperCase() === 'GOLD' || m.name?.toLowerCase().includes('gold'));
  const hasActiveSilver = metals.some((m) => m.code?.toUpperCase() === 'SILVER' || m.name?.toLowerCase().includes('silver'));

  // Sync inline rate inputs when rates load from DB
  useEffect(() => {
    if (gold24?.rate && !inlineGoldGram) {
      setInlineGoldGram(String(gold24.rate));
      setInlineGold10g(String(Math.round(gold24.rate * 10 * 100) / 100));
    }
    if (silver999?.rate && !inlineSilverGram) {
      setInlineSilverGram(String(silver999.rate));
      setInlineSilver1kg(String(Math.round(silver999.rate * 1000 * 100) / 100));
    }
  }, [gold24, silver999, inlineGoldGram, inlineSilverGram]);

  // Auto-focus input when unlock modal opens and handle Escape key
  useEffect(() => {
    if (showUnlockModal) {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
        pinInputRef.current?.select();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowUnlockModal(false);
          setUnlockPin('');
          setUnlockError(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showUnlockModal]);

  // Privacy Mode Toggle Handler - Password Protected for Live Mode
  const togglePrivacyMode = () => {
    if (isPrivacyMode) {
      // Currently masked -> Require password to reveal live figures
      setShowUnlockModal(true);
      setUnlockPin('');
      setUnlockError(null);
      setShowPinText(false);
    } else {
      // Currently live -> Immediately lock back to masked mode
      setIsPrivacyMode(true);
      localStorage.setItem('jewel_dashboard_privacy', 'true');
      setRateToast({ type: 'success', message: 'Display Mode: Off (Masked) — Figures locked.' });
    }
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = unlockPin.trim();
    if (entered === '1234') {
      setIsPrivacyMode(false);
      localStorage.setItem('jewel_dashboard_privacy', 'false');
      setShowUnlockModal(false);
      setUnlockPin('');
      setUnlockError(null);
      setRateToast({
        type: 'success',
        message: 'Display Mode: On (Live) — Live financial figures unlocked.',
      });
    } else {
      setUnlockError('Incorrect password! Enter 1234 to unlock.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      pinInputRef.current?.focus();
      pinInputRef.current?.select();
    }
  };

  // Helper to format currency numbers respecting Privacy / Confidential Counter Mode
  const formatAmount = (val?: number | null, fallback = '₹0.00'): string => {
    if (isPrivacyMode) {
      return '••••••••';
    }
    if (val === undefined || val === null || isNaN(val)) {
      return fallback;
    }
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Live Physical Metal Stock Breakdown (Gold & Silver Fine Wt + Valuation)
  const goldGroups = useMemo(() => {
    return (
      valuation?.groups.filter(
        (g) => g.metal_code?.toUpperCase() === 'GOLD' || g.metal_name?.toUpperCase().includes('GOLD')
      ) || []
    );
  }, [valuation]);

  const silverGroups = useMemo(() => {
    return (
      valuation?.groups.filter(
        (g) => g.metal_code?.toUpperCase() === 'SILVER' || g.metal_name?.toUpperCase().includes('SILVER')
      ) || []
    );
  }, [valuation]);

  const goldFineWeight = useMemo(() => {
    return goldGroups.reduce((acc, g) => acc + (g.fine_weight || 0), 0);
  }, [goldGroups]);

  const goldGrossWeight = useMemo(() => {
    return goldGroups.reduce((acc, g) => acc + (g.gross_weight || 0), 0);
  }, [goldGroups]);

  const goldNetWeight = useMemo(() => {
    return goldGroups.reduce((acc, g) => acc + (g.net_weight || 0), 0);
  }, [goldGroups]);

  const goldItemsCount = useMemo(() => {
    return goldGroups.reduce((acc, g) => acc + (g.item_count || 0), 0);
  }, [goldGroups]);

  const goldValuation = useMemo(() => {
    return goldGroups.reduce((acc, g) => acc + (g.current_valuation || 0), 0);
  }, [goldGroups]);

  const silverFineWeight = useMemo(() => {
    return silverGroups.reduce((acc, g) => acc + (g.fine_weight || 0), 0);
  }, [silverGroups]);

  const silverGrossWeight = useMemo(() => {
    return silverGroups.reduce((acc, g) => acc + (g.gross_weight || 0), 0);
  }, [silverGroups]);

  const silverNetWeight = useMemo(() => {
    return silverGroups.reduce((acc, g) => acc + (g.net_weight || 0), 0);
  }, [silverGroups]);

  const silverItemsCount = useMemo(() => {
    return silverGroups.reduce((acc, g) => acc + (g.item_count || 0), 0);
  }, [silverGroups]);

  const silverValuation = useMemo(() => {
    return silverGroups.reduce((acc, g) => acc + (g.current_valuation || 0), 0);
  }, [silverGroups]);

  const totalMetalValuation = useMemo(() => {
    const sum = goldValuation + silverValuation;
    return sum > 0 ? sum : (valuation?.total_current_valuation ?? 0);
  }, [goldValuation, silverValuation, valuation]);

  // Inline Rate Handlers
  const handleInlineGoldGramChange = (val: string) => {
    setInlineGoldGram(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setInlineGold10g(String(Math.round(num * 10 * 100) / 100));
    } else {
      setInlineGold10g('');
    }
  };

  const handleInlineSilverGramChange = (val: string) => {
    setInlineSilverGram(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setInlineSilver1kg(String(Math.round(num * 1000 * 100) / 100));
    } else {
      setInlineSilver1kg('');
    }
  };

  // Inline "Save Today's Rate" Handler (Directly updates 24K, 999 & auto-derives touch)
  const handleSaveInlineRates = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const goldNum = parseFloat(inlineGoldGram);
    const silverNum = parseFloat(inlineSilverGram);

    if ((!goldNum || goldNum <= 0) && (!silverNum || silverNum <= 0)) {
      setRateToast({ type: 'error', message: 'Please enter a valid Gold or Silver rate greater than 0' });
      return;
    }

    setIsSavingInlineRate(true);
    try {
      // 1. Update Gold 24K and auto-derive 22K (91.67%), 18K (75%), 14K (58.5%)
      if (goldNum > 0) {
        const goldMetal = metals.find((m) => m.code?.toUpperCase() === 'GOLD' || m.name?.toLowerCase().includes('gold')) || metals[0];
        const goldPurities = purities.filter((p) => p.metal_id === goldMetal?.id);
        const targetGold24Purity = goldPurities.find((p) => p.code?.toUpperCase() === '24K' || p.code === '999' || p.name?.toLowerCase().includes('24k') || p.name?.includes('999')) || goldPurities[0];

        if (goldMetal && targetGold24Purity) {
          await rateApi.createRate({
            metal_id: goldMetal.id,
            purity_id: targetGold24Purity.id,
            rate: goldNum,
            unit: 'gram',
            effective_from: new Date().toISOString(),
          });

          // Derive other gold purities
          const otherGoldPurities = goldPurities.filter((p) => p.id !== targetGold24Purity.id);
          for (const p of otherGoldPurities) {
            let tunch = p.tunch_percent;
            if (!tunch) {
              if (p.code?.toUpperCase() === '22K' || p.name?.includes('916')) tunch = 91.67;
              else if (p.code?.toUpperCase() === '18K' || p.name?.includes('750')) tunch = 75.0;
              else if (p.code?.toUpperCase() === '14K' || p.name?.includes('585')) tunch = 58.5;
            }
            if (tunch && tunch > 0) {
              const derived = Math.round(goldNum * (tunch / 100) * 100) / 100;
              await rateApi.createRate({
                metal_id: goldMetal.id,
                purity_id: p.id,
                rate: derived,
                unit: 'gram',
                effective_from: new Date().toISOString(),
              });
            }
          }
        }
      }

      // 2. Update Silver 999 and auto-derive 925, 80 tunch, 70 tunch
      if (silverNum > 0) {
        const silverMetal = metals.find((m) => m.code?.toUpperCase() === 'SILVER' || m.name?.toLowerCase().includes('silver'));
        const silverPurities = purities.filter((p) => p.metal_id === silverMetal?.id);
        const targetSilverPurity = silverPurities.find((p) => p.code === '999' || p.name?.includes('999')) || silverPurities[0];

        if (silverMetal && targetSilverPurity) {
          await rateApi.createRate({
            metal_id: silverMetal.id,
            purity_id: targetSilverPurity.id,
            rate: silverNum,
            unit: 'gram',
            effective_from: new Date().toISOString(),
          });

          // Derive other silver purities
          const otherSilverPurities = silverPurities.filter((p) => p.id !== targetSilverPurity.id);
          for (const p of otherSilverPurities) {
            let tunch = p.tunch_percent;
            if (!tunch) {
              if (p.code === '925' || p.name?.includes('925')) tunch = 92.5;
              else if (p.name?.includes('80')) tunch = 80.0;
              else if (p.name?.includes('70')) tunch = 70.0;
            }
            if (tunch && tunch > 0) {
              const derived = Math.round(silverNum * (tunch / 100) * 100) / 100;
              await rateApi.createRate({
                metal_id: silverMetal.id,
                purity_id: p.id,
                rate: derived,
                unit: 'gram',
                effective_from: new Date().toISOString(),
              });
            }
          }
        }
      }

      setRateToast({
        type: 'success',
        message: "Today's Metal Rates saved & applied successfully across Billing & Inwards!",
      });
      fetchDashboardData();
    } catch (err: any) {
      setRateToast({ type: 'error', message: err.message || 'Failed to update rates' });
    } finally {
      setIsSavingInlineRate(false);
    }
  };

  // Quick Rate Modal Handlers
  const handleOpenRateModal = (metalId?: string, purityId?: string) => {
    const goldMetal = metals.find((m) => m.code?.toUpperCase() === 'GOLD' || m.name?.toLowerCase().includes('gold')) || metals[0];
    const targetMetalId = metalId || goldMetal?.id || '';
    const metalPurities = purities.filter((p) => p.metal_id === targetMetalId);
    const targetPurity = purityId
      ? metalPurities.find((p) => p.id === purityId)
      : metalPurities.find((p) => p.code?.toUpperCase() === '24K' || p.code === '999' || p.name?.toLowerCase().includes('24k') || p.name?.includes('999')) || metalPurities[0];
    const targetPurityId = targetPurity?.id || metalPurities[0]?.id || '';
    const existingRateObj = rates.find((r) => r.purity_id === targetPurityId);
    const existingRate = existingRateObj?.rate ? String(existingRateObj.rate) : '';

    setModalMetalId(targetMetalId);
    setModalPurityId(targetPurityId);
    setModalRatePerGram(existingRate);
    setModalRate10g(existingRate ? String(Math.round(Number(existingRate) * 10 * 100) / 100) : '');
    setAutoDeriveGold(true);
    setShowRateModal(true);
  };

  const handleModalMetalChange = (newMetalId: string) => {
    setModalMetalId(newMetalId);
    const metalPurities = purities.filter((p) => p.metal_id === newMetalId);
    const newPurity = metalPurities.find((p) => p.code?.toUpperCase() === '24K' || p.code === '999' || p.name?.toLowerCase().includes('24k') || p.name?.includes('999')) || metalPurities[0];
    const newPurityId = newPurity?.id || '';
    setModalPurityId(newPurityId);

    const existing = rates.find((r) => r.purity_id === newPurityId);
    const exRate = existing?.rate ? String(existing.rate) : '';
    setModalRatePerGram(exRate);
    setModalRate10g(exRate ? String(Math.round(Number(exRate) * 10 * 100) / 100) : '');
  };

  const handleModalPurityChange = (newPurityId: string) => {
    setModalPurityId(newPurityId);
    const existing = rates.find((r) => r.purity_id === newPurityId);
    const exRate = existing?.rate ? String(existing.rate) : '';
    setModalRatePerGram(exRate);
    setModalRate10g(exRate ? String(Math.round(Number(exRate) * 10 * 100) / 100) : '');
  };

  const handleGramRateChange = (val: string) => {
    setModalRatePerGram(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setModalRate10g(String(Math.round(num * 10 * 100) / 100));
    } else {
      setModalRate10g('');
    }
  };

  const handle10gRateChange = (val: string) => {
    setModalRate10g(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setModalRatePerGram(String(Math.round((num / 10) * 100) / 100));
    } else {
      setModalRatePerGram('');
    }
  };

  // Derive preview for other purities according to touch (tunch %)
  const selectedPurityObj = purities.find((p) => p.id === modalPurityId);
  const selectedMetalObj = metals.find((m) => m.id === modalMetalId);
  const isBenchmark24K = selectedPurityObj && (selectedPurityObj.code?.toUpperCase() === '24K' || selectedPurityObj.code === '999' || selectedPurityObj.name?.includes('24K') || selectedPurityObj.name?.includes('999'));
  const gramVal = parseFloat(modalRatePerGram) || 0;
  const isGold = selectedMetalObj?.code?.toUpperCase() === 'GOLD' || selectedMetalObj?.name?.toLowerCase().includes('gold');
  const isSilver = selectedMetalObj?.code?.toUpperCase() === 'SILVER' || selectedMetalObj?.name?.toLowerCase().includes('silver');

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(modalRatePerGram);
    if (isNaN(rateNum) || rateNum <= 0) {
      setRateToast({ type: 'error', message: 'Please enter a valid rate greater than 0' });
      return;
    }
    if (!modalMetalId || !modalPurityId) {
      setRateToast({ type: 'error', message: 'Please select metal and purity' });
      return;
    }

    setIsSavingRate(true);
    try {
      // 1. Save target 24K / Pure benchmark rate
      await rateApi.createRate({
        metal_id: modalMetalId,
        purity_id: modalPurityId,
        rate: rateNum,
        unit: 'gram',
        effective_from: new Date().toISOString(),
      });

      // 2. Automatically derive and save rates for ALL other purities of this metal according to touch %
      if (isBenchmark24K && autoDeriveGold) {
        const otherPurities = purities.filter((p) => p.metal_id === modalMetalId && p.id !== modalPurityId);
        for (const p of otherPurities) {
          let tunch = p.tunch_percent;
          if (!tunch) {
            if (p.code?.toUpperCase() === '22K' || p.name?.includes('916')) tunch = 91.67;
            else if (p.code?.toUpperCase() === '18K' || p.name?.includes('750')) tunch = 75.0;
            else if (p.code?.toUpperCase() === '14K' || p.name?.includes('585')) tunch = 58.5;
            else if (p.code === '925' || p.name?.includes('925')) tunch = 92.5;
          }
          if (tunch && tunch > 0) {
            const derivedRate = Math.round(rateNum * (tunch / 100) * 100) / 100;
            await rateApi.createRate({
              metal_id: modalMetalId,
              purity_id: p.id,
              rate: derivedRate,
              unit: 'gram',
              effective_from: new Date().toISOString(),
            });
          }
        }
      }

      setShowRateModal(false);
      setRateToast({
        type: 'success',
        message: "Today's 24K benchmark rate updated! All other purities auto-calculated and synced according to touch.",
      });
      fetchDashboardData();
    } catch (err: any) {
      setRateToast({ type: 'error', message: err.message || 'Failed to update metal rate' });
    } finally {
      setIsSavingRate(false);
    }
  };

  const formatRate = (rateObj?: CurrentRate) => {
    if (!rateObj || !rateObj.rate) return 'N/A';
    return `₹${rateObj.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/g`;
  };

  return (
    <div className="dashboard-page">
      {/* Toast Notification */}
      {rateToast && (
        <div className={`rate-toast ${rateToast.type}`}>
          <div className="rate-toast-content">
            {rateToast.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
            <span>{rateToast.message}</span>
          </div>
          <button type="button" className="rate-toast-close" onClick={() => setRateToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* TOP HEADER - Exact representation of hand-drawn schematic: "(1) Dashboard  On/Off  [********]" */}
      <div className="sketch-dashboard-header">
        <div className="header-left-cluster">
          <div className="circle-badge-num">1</div>
          <div className="header-title-box">
            <h1 className="header-dashboard-title font-serif">Dashboard</h1>
            <span className="header-system-tag">JEWEL SUITE POS • TERMINAL 01</span>
          </div>

          {/* Hand-drawn Toggle: [switch] On / Off [********] */}
          <div className="counter-privacy-cluster" title="Toggle Privacy Mode: hides or masks sales and cash from walk-in customers">
            <span className="privacy-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={12} style={{ color: isPrivacyMode ? '#d97706' : '#059669' }} />
              Display Mode:
            </span>
            <button
              type="button"
              className={`toggle-on-off-btn ${isPrivacyMode ? 'mode-privacy-active' : 'mode-live-active'}`}
              onClick={togglePrivacyMode}
              title={isPrivacyMode ? 'Counter Privacy ON (Amounts masked with ********). Click to enter password (1234) and reveal.' : 'Live Mode ON (Real amounts visible). Click to lock.'}
            >
              <div className="toggle-switch-slider" />
              <span className="toggle-text-opt">{isPrivacyMode ? 'Off (Masked)' : 'On (Live)'}</span>
            </button>

            {/* Hand-drawn Asterisks / Mask Box: [ * * * * * * * * ] */}
            <div
              className={`masked-indicator-box ${isPrivacyMode ? 'is-masked' : 'is-visible'}`}
              onClick={togglePrivacyMode}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  togglePrivacyMode();
                }
              }}
              title={isPrivacyMode ? 'Click to enter password (1234) and reveal live figures' : 'Click to lock and hide live figures'}
            >
              {isPrivacyMode ? (
                <>
                  <Lock size={13} className="mask-icon text-amber-600" />
                  <span className="asterisks-display font-mono">* * * * * * * *</span>
                </>
              ) : (
                <>
                  <Unlock size={13} className="mask-icon text-emerald-600" />
                  <span className="asterisks-display font-mono text-emerald-600">₹ LIVE FIGURES</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="header-right-cluster">
          <button
            type="button"
            className="btn-refresh-rates"
            onClick={fetchDashboardData}
            title="Refresh all metrics and live rates"
          >
            <RefreshCw size={14} className={isLoadingRates ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn-quick-new-bill"
            onClick={() => navigate('/billing/invoice')}
            title="Create a new sale invoice"
          >
            <Plus size={15} />
            <span>New Sale Bill</span>
          </button>
        </div>
      </div>

      {/* ROW 1: 4 KPI BLOCKS (Exact layout from sketch) */}
      <div className="dashboard-row-1-blocks">
        {/* BLOCK 1: Sale / Summary with Return & Today Sale */}
        <div
          className="kpi-block kpi-sale-block"
          onClick={() => navigate('/reports?category=SALES&report=sales-summary&preset=today')}
          title="Click to view Sales Summary in Daybook"
        >
          <div className="kpi-block-top">
            <div className="kpi-block-name font-serif">Sale / Summary</div>
            <div className="badge-return-tag">Return</div>
          </div>

          <div className="kpi-main-label">Today Sale</div>
          <div className="kpi-main-value font-mono">
            {formatAmount(reportMetrics?.todaySales ?? finance?.today_sales ?? 0)}
          </div>

          <div className="kpi-sub-rows font-mono">
            <div className="kpi-sub-row">
              <span className="sub-label">Return:</span>
              <span className="sub-val">{formatAmount(reportMetrics?.todaySalesReturn ?? 0)}</span>
            </div>
            <div className="kpi-sub-row">
              <span className="sub-label">All Time:</span>
              <span className="sub-val">{formatAmount(reportMetrics?.allTimeSales ?? 0)}</span>
            </div>
            <div className="kpi-sub-row sub-info-line">
              <span className="bills-count">{reportMetrics?.todaySalesCount || 0} Bills Today</span>
              <span className="link-arrow">Daybook →</span>
            </div>
          </div>
        </div>

        {/* BLOCK 2: Buy / Summary with Return & Today Buy */}
        <div
          className="kpi-block kpi-buy-block"
          onClick={() => navigate('/purchase/bills')}
          title="Click to view Purchase Bills & Supplier Inwards"
        >
          <div className="kpi-block-top">
            <div className="kpi-block-name font-serif">Buy / Summary</div>
            <div className="badge-return-tag buy-tag">Return</div>
          </div>

          <div className="kpi-main-label">Today Buy</div>
          <div className="kpi-main-value font-mono">
            {formatAmount(reportMetrics?.todayPurchases ?? 0)}
          </div>

          <div className="kpi-sub-rows font-mono">
            <div className="kpi-sub-row">
              <span className="sub-label">Return:</span>
              <span className="sub-val">{formatAmount(reportMetrics?.todayPurchasesReturn ?? 0)}</span>
            </div>
            <div className="kpi-sub-row">
              <span className="sub-label">All Time:</span>
              <span className="sub-val">{formatAmount(reportMetrics?.allTimePurchases ?? 0)}</span>
            </div>
            <div className="kpi-sub-row sub-info-line">
              <span className="bills-count">{reportMetrics?.todayPurchasesCount || 0} Inwards Today</span>
              <span className="link-arrow">Inwards →</span>
            </div>
          </div>
        </div>

        {/* BLOCK 3: Today Rec / All Time (Collections / Receipts) */}
        <div
          className="kpi-block kpi-rec-block"
          onClick={() => navigate('/reports?category=FINANCE&report=cash-book&preset=today')}
          title="Click to view Cash Book & Collections"
        >
          <div className="kpi-block-top">
            <div className="kpi-block-name font-serif">Today Rec</div>
            <div className="badge-rec-tag">Collections</div>
          </div>

          <div className="kpi-main-label">Today Received (Jama)</div>
          <div className="kpi-main-value font-mono">
            {formatAmount(reportMetrics?.todayReceipts ?? finance?.today_collections ?? 0)}
          </div>

          <div className="kpi-sub-rows font-mono">
            <div className="kpi-sub-row highlight-rec">
              <span className="sub-label">All Time:</span>
              <span className="sub-val">{formatAmount(reportMetrics?.allTimeReceipts ?? 0)}</span>
            </div>
            <div className="kpi-sub-row sub-info-line">
              <span className="bills-count">Cash • UPI • Bank</span>
              <span className="link-arrow">Ledger →</span>
            </div>
          </div>
        </div>

        {/* BLOCK 4: Today Due / All Time (Baaki / Customer Balances) */}
        <div
          className="kpi-block kpi-due-block"
          onClick={() => navigate('/reports?category=FINANCE&report=receivables')}
          title="Click to view Customer Receivables (Baaki report)"
        >
          <div className="kpi-block-top">
            <div className="kpi-block-name font-serif">Today Due</div>
            <div className="badge-due-tag">Baaki / बाकी</div>
          </div>

          <div className="kpi-main-label">Today's Due (New Balance)</div>
          <div className="kpi-main-value font-mono">
            {formatAmount(reportMetrics?.todayDue ?? 0)}
          </div>

          <div className="kpi-sub-rows font-mono">
            <div className="kpi-sub-row highlight-due">
              <span className="sub-label">All Time:</span>
              <span className="sub-val">
                {formatAmount(reportMetrics?.allTimeDue ?? reportMetrics?.receivables ?? finance?.total_receivables ?? 0)}
              </span>
            </div>
            <div className="kpi-sub-row sub-info-line">
              <span className="bills-count">Customer Receivables</span>
              <span className="link-arrow">Baaki List →</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2 & 3: MAIN SPLIT SECTION (Left: Stock Valuation | Right: Active Girvi + Cash in Draw + Rate Change) */}
      <div className="dashboard-main-split-grid">
        {/* LEFT COLUMN: STOCK VALUATION (Large Card as drawn) */}
        <div className="stock-valuation-sketch-card">
          <div className="stock-card-header">
            <div className="stock-title-group">
              <Scale size={20} className="stock-icon text-gold" />
              <div>
                <h3 className="stock-title font-serif">Stock Valuation</h3>
                <span className="stock-subtitle">Live Physical Gold & Silver Store Valuation</span>
              </div>
            </div>

            {/* Hand-drawn Top-Right Subbox: Gold Rate / Silver Rate */}
            <div className="rates-mini-badge-box font-mono" onClick={() => handleOpenRateModal()}>
              {hasActiveGold && (
                <div className="mini-rate-item gold-rate">
                  <span className="mini-rate-label">Gold Rate:</span>
                  <span className="mini-rate-val">{formatRate(gold24)}</span>
                </div>
              )}
              {hasActiveGold && hasActiveSilver && <div className="mini-rate-divider" />}
              {hasActiveSilver && (
                <div className="mini-rate-item silver-rate">
                  <span className="mini-rate-label">Silver Rate:</span>
                  <span className="mini-rate-val">{formatRate(silver999)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stock Valuation Items as drawn:
              Gold Fine  -  Gold Amount
              Silver Fine - Silver Amount
              Total Value -> [           ]
          */}
          <div className="stock-items-table">
            {/* Gold Row */}
            <div className="stock-item-row gold-stock-row font-mono">
              <div className="stock-left-col">
                <div className="metal-name-tag gold">GOLD FINE</div>
                <div className="fine-wt-display">
                  <span className="wt-number">{goldFineWeight.toFixed(3)}</span>
                  <span className="wt-unit">g fine Au</span>
                </div>
                <div className="gross-net-sub text-[11px] text-muted">
                  Gross: {goldGrossWeight.toFixed(3)}g • Net: {goldNetWeight.toFixed(3)}g ({goldItemsCount} items)
                </div>
              </div>

              <div className="arrow-sep">—</div>

              <div className="stock-right-col text-right">
                <div className="amount-label">Gold Amount</div>
                <div className="amount-val gold-amount">{formatAmount(goldValuation)}</div>
              </div>
            </div>

            {/* Silver Row */}
            <div className="stock-item-row silver-stock-row font-mono">
              <div className="stock-left-col">
                <div className="metal-name-tag silver">SILVER FINE</div>
                <div className="fine-wt-display">
                  <span className="wt-number text-blue-600">{silverFineWeight.toFixed(3)}</span>
                  <span className="wt-unit">g fine Ag</span>
                </div>
                <div className="gross-net-sub text-[11px] text-muted">
                  Gross: {silverGrossWeight.toFixed(3)}g • Net: {silverNetWeight.toFixed(3)}g ({silverItemsCount} items)
                </div>
              </div>

              <div className="arrow-sep">—</div>

              <div className="stock-right-col text-right">
                <div className="amount-label">Silver Amount</div>
                <div className="amount-val silver-amount">{formatAmount(silverValuation)}</div>
              </div>
            </div>
          </div>

          {/* Hand-drawn: Total Vale -> [           ] */}
          <div className="total-value-boxed-container">
            <div className="total-value-label font-serif">
              <span>Total Value</span>
              <span className="total-arrow">→</span>
            </div>
            <div className="total-value-box font-mono">
              <span className="val-text">{formatAmount(totalMetalValuation)}</span>
            </div>
          </div>

          <div className="stock-card-footer">
            <button
              type="button"
              className="btn-link-stock"
              onClick={() => navigate('/inventory/stock')}
            >
              <span>View Physical Stock & Showcase</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              className="btn-link-stock-secondary"
              onClick={() => navigate('/settings?tab=metal-stock')}
            >
              <span>+ Add Metal Stock Inward</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: UPPER (Active Girvi & Cash in Draw) + LOWER (Today Metal Rate Change) */}
        <div className="right-column-cluster">
          {/* Upper Row: 2 Blocks side by side */}
          <div className="right-upper-grid">
            {/* Block 1: Active Girvi */}
            <div
              className="kpi-block-secondary girvi-card"
              onClick={() => navigate('/reports?category=GIRVI&report=active-loans')}
              title="Click to view Active Girvi Loans"
            >
              <div className="card-mini-head">
                <Coins size={18} className="text-amber-500" />
                <span className="card-mini-title font-serif">Active Girvi</span>
              </div>
              <div className="card-mini-val font-mono">
                {formatAmount(reportMetrics?.activeLoansAmount ?? 0)}
              </div>
              <div className="card-mini-footer font-mono">
                <span className="badge-count-pill">{reportMetrics?.activeLoansCount || 0} Active Loans</span>
                <span className="link-arrow">Girvi →</span>
              </div>
            </div>

            {/* Block 2: Cash in Draw */}
            <div
              className="kpi-block-secondary cash-card"
              onClick={() => navigate('/reports?category=FINANCE&report=cash-book&preset=today')}
              title="Click to view Cash Book and Counter Safe Drawer"
            >
              <div className="card-mini-head">
                <Wallet size={18} className="text-indigo-500" />
                <span className="card-mini-title font-serif">Cash in Draw</span>
              </div>
              <div className="card-mini-val font-mono">
                {formatAmount(reportMetrics?.cashInDrawer ?? finance?.cash_balance ?? 0)}
              </div>
              <div className="card-mini-footer font-mono">
                <span className="text-muted text-[11px]">Counter Cash Balance</span>
                <span className="link-arrow">Cashbook →</span>
              </div>
            </div>
          </div>

          {/* Lower Block: Today Metal Rate Change (Option in Bottom Line) */}
          <div className="metal-rate-bottom-line-card">
            <div className="bottom-line-header">
              <div className="bottom-line-title-group">
                <Flame size={18} className="text-amber-500" />
                <div>
                  <h4 className="bottom-line-title font-serif">Today Metal Rate Change</h4>
                  <span className="bottom-line-subtitle">Option in Bottom Line • Instant Shop Benchmark Update</span>
                </div>
              </div>

              <div className="bottom-line-actions">
                <button
                  type="button"
                  className="btn-modal-rate-alt font-mono"
                  onClick={() => handleOpenRateModal()}
                >
                  <Edit3 size={13} />
                  <span>Advanced Purities Modal</span>
                </button>
                <button
                  type="button"
                  className="btn-view-master font-mono"
                  onClick={() => navigate('/masters/metal-rates')}
                >
                  <span>Rates Master →</span>
                </button>
              </div>
            </div>

            {/* Inline Quick Change Inputs */}
            <form onSubmit={handleSaveInlineRates} className="bottom-line-form">
              <div className="rate-inputs-row">
                {/* Gold Rate Input */}
                {hasActiveGold && (
                  <div className="rate-input-cell">
                    <div className="cell-top">
                      <span className="cell-metal gold">GOLD 24K (PURE)</span>
                      <span className="cell-current font-mono">Current: {formatRate(gold24)}</span>
                    </div>
                    <div className="input-group">
                      <span className="input-prefix font-mono">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control font-mono inline-rate-input"
                        placeholder="Gold ₹/g"
                        value={inlineGoldGram}
                        onChange={(e) => handleInlineGoldGramChange(e.target.value)}
                      />
                      <span className="input-suffix font-mono">/g</span>
                    </div>
                    <div className="sub-unit-rate font-mono">
                      <span className="text-muted">10g (Tola):</span>
                      <span className="text-gold font-bold">
                        ₹{inlineGold10g ? Number(inlineGold10g).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Silver Rate Input */}
                {hasActiveSilver && (
                  <div className="rate-input-cell">
                    <div className="cell-top">
                      <span className="cell-metal silver">SILVER 999 (CHANDI)</span>
                      <span className="cell-current font-mono">Current: {formatRate(silver999)}</span>
                    </div>
                    <div className="input-group">
                      <span className="input-prefix font-mono">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control font-mono inline-rate-input"
                        placeholder="Silver ₹/g"
                        value={inlineSilverGram}
                        onChange={(e) => handleInlineSilverGramChange(e.target.value)}
                      />
                      <span className="input-suffix font-mono">/g</span>
                    </div>
                    <div className="sub-unit-rate font-mono">
                      <span className="text-muted">1 Kg (1000g):</span>
                      <span className="text-blue-600 font-bold">
                        ₹{inlineSilver1kg ? Number(inlineSilver1kg).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Save Button right in the bottom line */}
                <div className="rate-save-btn-cell">
                  <button
                    type="submit"
                    className="btn-save-inline-rate font-mono"
                    disabled={isSavingInlineRate}
                  >
                    {isSavingInlineRate ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Applying...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Save Today's Rate</span>
                      </>
                    )}
                  </button>
                  <span className="save-hint font-mono">Auto-computes 22K, 18K, 14K & 925 by touch %</span>
                </div>
              </div>

              {/* Touch Derivation Preview Bar */}
              <div className="touch-preview-strip font-mono">
                <span className="strip-title font-sans">Auto-Synced by Touch:</span>
                <span className="strip-tag">
                  22K (916): ₹{inlineGoldGram ? (Math.round(Number(inlineGoldGram) * 0.9167 * 100) / 100).toFixed(2) : '0.00'}/g
                </span>
                <span className="strip-dot">•</span>
                <span className="strip-tag">
                  18K (750): ₹{inlineGoldGram ? (Math.round(Number(inlineGoldGram) * 0.75 * 100) / 100).toFixed(2) : '0.00'}/g
                </span>
                <span className="strip-dot">•</span>
                <span className="strip-tag">
                  14K: ₹{inlineGoldGram ? (Math.round(Number(inlineGoldGram) * 0.585 * 100) / 100).toFixed(2) : '0.00'}/g
                </span>
                <span className="strip-dot">•</span>
                <span className="strip-tag silver">
                  Silver 925: ₹{inlineSilverGram ? (Math.round(Number(inlineSilverGram) * 0.925 * 100) / 100).toFixed(2) : '0.00'}/g
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE TOGGLE FOR EXTENDED PANELS (Master Board Rate Cards & Architecture Verification) */}
      <div className="extended-panels-toggle-row">
        <button
          type="button"
          className="btn-toggle-extended"
          onClick={() => setShowExtendedPanels(!showExtendedPanels)}
        >
          <span>{showExtendedPanels ? 'Hide Detailed Benchmark Cards & System Health' : 'Show Detailed Benchmark Cards & System Health'}</span>
          {showExtendedPanels ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {showExtendedPanels && (
        <div className="extended-dashboard-section">
          {/* Extended Board Rate Cards */}
          <div className="board-rates-grid">
            {/* Gold 24K */}
            {hasActiveGold && (
              <div className="board-rate-card featured-default" onClick={() => handleOpenRateModal(gold24?.metal_id, gold24?.purity_id)}>
                <div className="default-pill font-mono">
                  <Sparkles size={12} />
                  <span>DEFAULT RATE IN INVOICES & PURCHASES (24K GOLD)</span>
                </div>
                <div className="card-top">
                  <span className="metal-badge gold-hallmark">GOLD 24K (FINE BULLION)</span>
                  <span className="purity-badge font-mono">99.90% Pure Base • 100 Tunch</span>
                </div>
                <div className="card-rate-main font-mono highlight">
                  <span className="currency-symbol">₹</span>
                  <span className="rate-number">
                    {gold24?.rate ? gold24.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </span>
                  <span className="rate-unit">/ g</span>
                </div>
                <div className="card-secondary-rate font-mono">
                  <span className="label">10 Grams (Tola):</span>
                  <span className="value">
                    ₹{gold24?.rate ? (gold24.rate * 10).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </span>
                </div>

                <div className="card-touch-breakdown">
                  <div className="touch-breakdown-title">
                    <SlidersHorizontal size={13} />
                    <span>Auto-Calculated by Touch (टंच) in Invoices:</span>
                  </div>
                  <div className="touch-rates-list">
                    <div className="touch-rate-row">
                      <span className="touch-name">22K (916 Hallmark) • 91.67% Tunch</span>
                      <span className="touch-val font-mono">
                        ₹{gold24?.rate ? (Math.round(gold24.rate * 0.9167 * 100) / 100).toFixed(2) : '0.00'}/g
                      </span>
                    </div>
                    <div className="touch-rate-row">
                      <span className="touch-name">18K (750 Studded) • 75.00% Tunch</span>
                      <span className="touch-val font-mono">
                        ₹{gold24?.rate ? (Math.round(gold24.rate * 0.75 * 100) / 100).toFixed(2) : '0.00'}/g
                      </span>
                    </div>
                    <div className="touch-rate-row">
                      <span className="touch-name">14K (585) • 58.50% Tunch</span>
                      <span className="touch-val font-mono">
                        ₹{gold24?.rate ? (Math.round(gold24.rate * 0.585 * 100) / 100).toFixed(2) : '0.00'}/g
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fine Silver 999 */}
            {hasActiveSilver && (
              <div className="board-rate-card featured-silver-default" onClick={() => handleOpenRateModal(silver999?.metal_id, silver999?.purity_id)}>
                <div className="default-pill silver-pill font-mono">
                  <Sparkles size={12} />
                  <span>DEFAULT RATE IN INVOICES & PURCHASES (FINE SILVER)</span>
                </div>
                <div className="card-top">
                  <span className="metal-badge silver">FINE SILVER 999 (CHANDI)</span>
                  <span className="purity-badge font-mono">99.90% Pure Base • 100 Tunch</span>
                </div>
                <div className="card-rate-main font-mono">
                  <span className="currency-symbol">₹</span>
                  <span className="rate-number" style={{ color: '#0369A1' }}>
                    {silver999?.rate ? silver999.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </span>
                  <span className="rate-unit">/ g</span>
                </div>
                <div className="card-secondary-rate font-mono">
                  <span className="label">1 Kg (1000g):</span>
                  <span className="value highlight-silver">
                    ₹{silver999?.rate ? (silver999.rate * 1000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </span>
                </div>

                <div className="card-touch-breakdown">
                  <div className="touch-breakdown-title">
                    <SlidersHorizontal size={13} />
                    <span>Auto-Calculated by Touch (टंच) in Invoices:</span>
                  </div>
                  <div className="touch-rates-list">
                    <div className="touch-rate-row">
                      <span className="touch-name">Silver 925 (Sterling) • 92.50% Tunch</span>
                      <span className="touch-val silver font-mono">
                        ₹{silver999?.rate ? (Math.round(silver999.rate * 0.925 * 100) / 100).toFixed(2) : '0.00'}/g
                      </span>
                    </div>
                    <div className="touch-rate-row">
                      <span className="touch-name">Chandi 80 Tunch • 80.00% Tunch</span>
                      <span className="touch-val silver font-mono">
                        ₹{silver999?.rate ? (Math.round(silver999.rate * 0.80 * 100) / 100).toFixed(2) : '0.00'}/g
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Part 1 Foundation Verification Panel */}
          <div className="foundation-status-panel mt-6">
            <div className="panel-header">
              <div className="panel-title-group">
                <ShieldCheck size={20} className="panel-icon gold" />
                <div>
                  <h3 className="panel-title font-serif">Architecture & Foundation Health</h3>
                  <p className="panel-subtitle">Current status of offline database, authentication, and core API</p>
                </div>
              </div>
              <span className="badge badge-success">ALL SYSTEMS NOMINAL</span>
            </div>

            <div className="foundation-grid">
              <div className="foundation-item">
                <div className="item-label">
                  <Database size={15} />
                  <span>Database Engine</span>
                </div>
                <div className="item-val font-mono">SQLite (better-sqlite3: {health?.database || 'CONNECTED'})</div>
                <div className="item-sub">WAL Mode • Foreign Keys Enabled</div>
              </div>

              <div className="foundation-item">
                <div className="item-label">
                  <Layers size={15} />
                  <span>Migration Pipeline</span>
                </div>
                <div className="item-val font-mono">schema_migrations: Active</div>
                <div className="item-sub">All Schema Migrations Applied</div>
              </div>

              <div className="foundation-item">
                <div className="item-label">
                  <TrendingUp size={15} />
                  <span>Session & Security</span>
                </div>
                <div className="item-val font-mono">User: {user?.username} ({user?.role})</div>
                <div className="item-sub">Bcrypt Hash • Offline JWT Token</div>
              </div>

              <div className="foundation-item">
                <div className="item-label">
                  <Sparkles size={15} />
                  <span>Transaction Engine</span>
                </div>
                <div className="item-val font-mono">Atomic Rollbacks Ready</div>
                <div className="item-sub">withTransaction() utility verified</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK RATE UPDATE MODAL */}
      {showRateModal && (
        <div className="modal-backdrop" onClick={() => setShowRateModal(false)}>
          <div className="dashboard-rate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-box gold">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="modal-title font-serif">Update Today's Daily Metal Rate</h3>
                  <p className="modal-subtitle">
                    New rates take effect immediately across all POS billing screens and inward entries.
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowRateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRate} className="rate-modal-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Metal</label>
                  <select
                    className="form-control"
                    value={modalMetalId}
                    onChange={(e) => handleModalMetalChange(e.target.value)}
                  >
                    {metals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Purity / Karat</label>
                  <select
                    className="form-control"
                    value={modalPurityId}
                    onChange={(e) => handleModalPurityChange(e.target.value)}
                  >
                    {purities
                      .filter((p) => p.metal_id === modalMetalId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code}) {p.tunch_percent ? `• ${p.tunch_percent}%` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="rate-inputs-container">
                <div className="form-group">
                  <label className="form-label">
                    Rate per Gram (₹/g) <span className="required">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-prefix font-mono">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-control font-mono rate-input-bold"
                      placeholder="e.g. 7250"
                      value={modalRatePerGram}
                      onChange={(e) => handleGramRateChange(e.target.value)}
                      required
                      autoFocus
                    />
                    <span className="input-suffix font-mono">/ gram</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Rate per 10 Grams (₹/10g)
                  </label>
                  <div className="input-group">
                    <span className="input-prefix font-mono">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-control font-mono"
                      placeholder="e.g. 72500"
                      value={modalRate10g}
                      onChange={(e) => handle10gRateChange(e.target.value)}
                    />
                    <span className="input-suffix font-mono">/ 10g</span>
                  </div>
                </div>
              </div>

              {/* Smart Derivation Box for Benchmark Rates */}
              {isBenchmark24K && (
                <div className="derived-rates-box">
                  <div className="derived-header">
                    <label className="derive-checkbox-label">
                      <input
                        type="checkbox"
                        checked={autoDeriveGold}
                        onChange={(e) => setAutoDeriveGold(e.target.checked)}
                      />
                      <span className="derive-checkbox-text">
                        <strong>Auto-calculate & sync all other purities according to Touch % (टंच)</strong>
                      </span>
                    </label>
                    <span className="badge-standard font-mono">Standard Trade Touch Formula</span>
                  </div>

                  {autoDeriveGold && gramVal > 0 && isGold && (
                    <div className="derived-preview-grid">
                      <div className="derived-item">
                        <span className="item-title">Gold 22K (916) • 91.67% Tunch</span>
                        <span className="item-val font-mono">₹{(Math.round(gramVal * 0.9167 * 100) / 100).toFixed(2)}/g</span>
                        <span className="item-sub font-mono">₹{((Math.round(gramVal * 0.9167 * 100) / 100) * 10).toFixed(2)} / 10g</span>
                      </div>
                      <div className="derived-item">
                        <span className="item-title">Gold 18K (750) • 75.00% Tunch</span>
                        <span className="item-val font-mono">₹{(Math.round(gramVal * 0.75 * 100) / 100).toFixed(2)}/g</span>
                        <span className="item-sub font-mono">₹{((Math.round(gramVal * 0.75 * 100) / 100) * 10).toFixed(2)} / 10g</span>
                      </div>
                      <div className="derived-item">
                        <span className="item-title">Gold 14K (585) • 58.50% Tunch</span>
                        <span className="item-val font-mono">₹{(Math.round(gramVal * 0.585 * 100) / 100).toFixed(2)}/g</span>
                        <span className="item-sub font-mono">₹{((Math.round(gramVal * 0.585 * 100) / 100) * 10).toFixed(2)} / 10g</span>
                      </div>
                    </div>
                  )}

                  {autoDeriveGold && gramVal > 0 && isSilver && (
                    <div className="derived-preview-grid">
                      <div className="derived-item">
                        <span className="item-title">Silver 925 • 92.50% Tunch</span>
                        <span className="item-val font-mono" style={{ color: '#0369A1' }}>
                          ₹{(Math.round(gramVal * 0.925 * 100) / 100).toFixed(2)}/g
                        </span>
                        <span className="item-sub font-mono">₹{((Math.round(gramVal * 0.925 * 100) / 100) * 1000).toFixed(2)} / 1 Kg</span>
                      </div>
                      <div className="derived-item">
                        <span className="item-title">Chandi 80 Tunch • 80.00% Tunch</span>
                        <span className="item-val font-mono" style={{ color: '#0369A1' }}>
                          ₹{(Math.round(gramVal * 0.80 * 100) / 100).toFixed(2)}/g
                        </span>
                        <span className="item-sub font-mono">₹{((Math.round(gramVal * 0.80 * 100) / 100) * 1000).toFixed(2)} / 1 Kg</span>
                      </div>
                      <div className="derived-item">
                        <span className="item-title">Chandi 70 Tunch • 70.00% Tunch</span>
                        <span className="item-val font-mono" style={{ color: '#0369A1' }}>
                          ₹{(Math.round(gramVal * 0.70 * 100) / 100).toFixed(2)}/g
                        </span>
                        <span className="item-sub font-mono">₹{((Math.round(gramVal * 0.70 * 100) / 100) * 1000).toFixed(2)} / 1 Kg</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowRateModal(false)}
                  disabled={isSavingRate}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save-rate font-mono"
                  disabled={isSavingRate || !modalRatePerGram || parseFloat(modalRatePerGram) <= 0}
                >
                  {isSavingRate ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Saving Today's Rate...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Save & Apply Today's Rate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password / PIN Modal for Display Mode: On (Live) */}
      {showUnlockModal && (
        <div className="rate-modal-backdrop" onClick={() => setShowUnlockModal(false)}>
          <div
            className={`rate-modal-container unlock-pin-modal ${isShaking ? 'shake-animation' : ''}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '92%' }}
          >
            <div className="rate-modal-header" style={{ borderBottomColor: '#f59e0b', background: '#FFFBEB' }}>
              <div className="header-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#B45309'
                  }}>
                    <Lock size={19} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
                      Unlock Live Figures
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: '#6B7280' }}>
                      Display Mode: On (Live) • Password Protected
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowUnlockModal(false)}
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUnlockSubmit} className="rate-modal-body">
              <div style={{ padding: '0.4rem 0' }}>
                <p style={{ fontSize: '0.82rem', color: '#4B5563', margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                  Enter counter password to reveal real-time sales, net revenue, cash-in-hand, and metal balances.
                </p>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                    Password / PIN <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      ref={pinInputRef}
                      type={showPinText ? 'text' : 'password'}
                      value={unlockPin}
                      onChange={(e) => {
                        setUnlockPin(e.target.value);
                        if (unlockError) setUnlockError(null);
                      }}
                      placeholder="Enter PIN (1234)"
                      className="input-rate font-mono"
                      autoFocus
                      style={{
                        paddingRight: '2.5rem',
                        fontSize: '1.15rem',
                        letterSpacing: showPinText ? 'normal' : '0.22em',
                        textAlign: 'center',
                        borderColor: unlockError ? '#EF4444' : undefined,
                        boxShadow: unlockError ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinText(!showPinText)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                      }}
                      title={showPinText ? 'Hide password' : 'Show password'}
                    >
                      {showPinText ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {unlockError && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <X size={14} />
                      <span>{unlockError}</span>
                    </div>
                  )}
                </div>

                {/* Quick Hint / Fill for Testing */}
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: '#64748B'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <KeyRound size={13} style={{ color: '#D97706' }} />
                    <span>PIN: <strong>1234</strong></span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUnlockPin('1234');
                      if (unlockError) setUnlockError(null);
                    }}
                    style={{
                      background: '#EEF2FF',
                      color: '#4338CA',
                      border: '1px solid #C7D2FE',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Auto Fill (1234)
                  </button>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowUnlockModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save-rate font-mono"
                  style={{ background: '#059669', borderColor: '#047857' }}
                >
                  <Unlock size={15} />
                  <span>Unlock Live Figures</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
