import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, ShieldAlert, Layers, ExternalLink, Zap,
  DollarSign, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Cpu, Lock, Smartphone, LogOut, Bot, Check, ArrowRight, Info,
  Copy, Droplets
} from 'lucide-react';
import { PeraWalletConnect, closePeraWalletSignTxnToast } from '@perawallet/connect';
import algosdk from 'algosdk';
import {
  createAtomicTxGroup,
  getOrCreateAgentAccount,
  getAccountBalance,
  ALGORAND_TESTNET_NODE,
  VERIFIER_ADDRS,
  AtomicTxGroupResult
} from './services/algorand';

// ─── Pera Wallet singleton ─────────────────────────────────────────────────
const peraWallet = new PeraWalletConnect({ network: 'testnet' });

// ─── Product Catalog ───────────────────────────────────────────────────────
interface Product {
  id: string;
  emoji: string;
  name: string;
  currency?: 'ALGO' | '$';
  normalPrice: number;
  riskyPrice: number;
  expectedRange: [number, number];
  seller: string;
  riskySellerRating: number;
  riskySeller: string;
  riskyDomainAge: number;
  normalSellerRating: number;
  normalSeller: string;
  normalDomainAge: number;
  riskyTerms: string;
  normalTerms: string;
  riskLabel: string;
  category?: 'low-budget' | 'premium';
}

const formatPrice = (price: number, currency: 'ALGO' | '$' = '$') =>
  currency === 'ALGO' ? `${price} ALGO` : `$${price}`;

const PRODUCTS: Product[] = [
  // ── LOW BUDGET PRODUCTS (< 10 ALGO) ──
  {
    id: 'espresso',
    emoji: '☕',
    name: 'Artisanal Coffee Beans (250g)',
    currency: 'ALGO',
    category: 'low-budget',
    normalPrice: 5,
    riskyPrice: 45,
    expectedRange: [3, 8],
    riskySeller: 'BeanDrop_FakeSeller',
    riskySellerRating: 2.9,
    riskyDomainAge: 5,
    normalSeller: 'RoastMasters_Official',
    normalSellerRating: 4.9,
    normalDomainAge: 820,
    riskyTerms: 'Expired batch clearance. No refunds or replacements under any circumstance.',
    normalTerms: 'Freshly roasted guarantee. 14-day replacement if dissatisfied.',
    riskLabel: 'Price Inflation +800%',
  },
  {
    id: 'gamekey',
    emoji: '🔑',
    name: 'Indie Game Steam Key Code',
    currency: 'ALGO',
    category: 'low-budget',
    normalPrice: 4,
    riskyPrice: 0.3,
    expectedRange: [3, 7],
    riskySeller: 'KeyGenerator_Bot',
    riskySellerRating: 2.1,
    riskyDomainAge: 4,
    normalSeller: 'IndieVault_Authorized',
    normalSellerRating: 4.8,
    normalDomainAge: 450,
    riskyTerms: 'Revoked / regional key risk. No key replacement if duplicate or invalid.',
    normalTerms: 'Instant delivery. 100% working key guarantee with full refund support.',
    riskLabel: 'Suspiciously Cheap -92%',
  },
  {
    id: 'cable',
    emoji: '🔌',
    name: 'Braided USB-C Cable (2m)',
    currency: 'ALGO',
    category: 'low-budget',
    normalPrice: 3,
    riskyPrice: 0.2,
    expectedRange: [2, 5],
    riskySeller: 'CheapWires_Direct',
    riskySellerRating: 2.7,
    riskyDomainAge: 8,
    normalSeller: 'Anker_Official_Distributor',
    normalSellerRating: 4.9,
    normalDomainAge: 950,
    riskyTerms: 'No warranty. Non-certified cable, buyer accepts fire & short-circuit risk.',
    normalTerms: 'Lifetime warranty with USB-IF safety certification.',
    riskLabel: 'Uncertified Cable -93%',
  },
  {
    id: 'yubikey',
    emoji: '🛡️',
    name: 'YubiKey 5 NFC Security Key',
    currency: 'ALGO',
    category: 'low-budget',
    normalPrice: 8,
    riskyPrice: 0.8,
    expectedRange: [6, 12],
    riskySeller: 'CryptoKey_Discount',
    riskySellerRating: 2.4,
    riskyDomainAge: 12,
    normalSeller: 'Yubico_Certified_Partner',
    normalSellerRating: 4.9,
    normalDomainAge: 1100,
    riskyTerms: 'Pre-opened box. Tamper seal removed. Sold as-is without returns.',
    normalTerms: 'Factory sealed in original box with Yubico authenticity seal.',
    riskLabel: 'Tampered Hardware -90%',
  },
  {
    id: 'powerbank',
    emoji: '🔋',
    name: 'Anker 10,000mAh Power Bank',
    currency: 'ALGO',
    category: 'low-budget',
    normalPrice: 9,
    riskyPrice: 1.2,
    expectedRange: [7, 12],
    riskySeller: 'ElectroDrop_Unverified',
    riskySellerRating: 3.0,
    riskyDomainAge: 10,
    normalSeller: 'Anker_Official_Store',
    normalSellerRating: 4.9,
    normalDomainAge: 780,
    riskyTerms: 'Refurbished grade C unit. Battery capacity not guaranteed.',
    normalTerms: '18-month Anker warranty with full money-back guarantee.',
    riskLabel: 'Counterfeit Battery -87%',
  },
  {
    id: 'stickerpack',
    emoji: '🎨',
    name: 'Algorand NFT Art Sticker Pack',
    currency: 'ALGO',
    category: 'low-budget',
    normalPrice: 2,
    riskyPrice: 35,
    expectedRange: [1, 4],
    riskySeller: 'NFT_Scalper_99',
    riskySellerRating: 3.1,
    riskyDomainAge: 6,
    normalSeller: 'AlgoArt_Creator_Guild',
    normalSellerRating: 4.95,
    normalDomainAge: 520,
    riskyTerms: 'Unlicensed copy. No commercial usage rights or IP royalty inclusion.',
    normalTerms: 'Full creator license and commercial rights included with purchase.',
    riskLabel: 'Price Scalping +1650%',
  },

  // ── PREMIUM / STANDARD PRODUCTS ──
  {
    id: 'iphone',
    emoji: '📱',
    name: 'Apple iPhone 15 Pro 128GB',
    currency: '$',
    category: 'premium',
    normalPrice: 999,
    riskyPrice: 1800,
    expectedRange: [700, 1100],
    riskySeller: 'QuickDeals99_Store',
    riskySellerRating: 3.2,
    riskyDomainAge: 14,
    normalSeller: 'Official_Apple_Reseller',
    normalSellerRating: 4.9,
    normalDomainAge: 720,
    riskyTerms: 'All sales final. No returns, no refunds, sold as-is under all circumstances.',
    normalTerms: 'Standard 30-day money-back guarantee with full buyer protection and free return shipping.',
    riskLabel: 'Price Inflation +63%',
  },
  {
    id: 'macbook',
    emoji: '💻',
    name: 'MacBook Pro 14" M3 Pro',
    currency: '$',
    category: 'premium',
    normalPrice: 1999,
    riskyPrice: 3500,
    expectedRange: [1800, 2200],
    riskySeller: 'TechFlipX_Unverified',
    riskySellerRating: 2.8,
    riskyDomainAge: 7,
    normalSeller: 'Apple_Certified_Partner',
    normalSellerRating: 4.8,
    normalDomainAge: 1200,
    riskyTerms: 'No warranty. No returns. Buyer assumes all risk. International grey-market unit.',
    normalTerms: 'Full 1-year Apple warranty included. 14-day hassle-free returns.',
    riskLabel: 'Price Inflation +75%',
  },
  {
    id: 'rolex',
    emoji: '⌚',
    name: 'Rolex Submariner Date',
    currency: '$',
    category: 'premium',
    normalPrice: 9500,
    riskyPrice: 89,
    expectedRange: [8000, 12000],
    riskySeller: 'LuxuryDeals_Fake',
    riskySellerRating: 3.0,
    riskyDomainAge: 3,
    normalSeller: 'Certified_Luxury_Auth',
    normalSellerRating: 4.7,
    normalDomainAge: 900,
    riskyTerms: 'Replica item. No authenticity guarantee. No refunds on luxury goods.',
    normalTerms: 'Full authenticity certificate, box & papers. 7-day buyer protection.',
    riskLabel: 'Suspiciously Cheap -99%',
  },
  {
    id: 'ps5',
    emoji: '🎮',
    name: 'Sony PlayStation 5 Console',
    currency: '$',
    category: 'premium',
    normalPrice: 499,
    riskyPrice: 950,
    expectedRange: [400, 560],
    riskySeller: 'ScalpBot_Reseller',
    riskySellerRating: 2.5,
    riskyDomainAge: 20,
    normalSeller: 'GameZone_Certified',
    normalSellerRating: 4.6,
    normalDomainAge: 600,
    riskyTerms: 'Scalped unit at market premium. No returns accepted. Non-negotiable final price.',
    normalTerms: 'Official Sony warranty. 30-day return policy. Ships in original sealed box.',
    riskLabel: 'Price Scalping +90%',
  },
  {
    id: 'airpods',
    emoji: '🎧',
    name: 'Apple AirPods Pro 2nd Gen',
    currency: '$',
    category: 'premium',
    normalPrice: 249,
    riskyPrice: 49,
    expectedRange: [200, 280],
    riskySeller: 'CheapAudio_Knockoffs',
    riskySellerRating: 3.1,
    riskyDomainAge: 11,
    normalSeller: 'AudioTech_Authorized',
    normalSellerRating: 4.9,
    normalDomainAge: 850,
    riskyTerms: 'Unbranded clone. No Apple logo guaranteed. Sold as "compatible" device.',
    normalTerms: 'Genuine Apple product. Full warranty and return policy applies.',
    riskLabel: 'Counterfeit Risk -80%',
  },
  {
    id: 'gpu',
    emoji: '🖥️',
    name: 'NVIDIA RTX 4090 24GB GPU',
    currency: '$',
    category: 'premium',
    normalPrice: 1599,
    riskyPrice: 2900,
    expectedRange: [1400, 1800],
    riskySeller: 'MiningFarm_Dump',
    riskySellerRating: 2.9,
    riskyDomainAge: 30,
    normalSeller: 'PCMasters_Authorized',
    normalSellerRating: 4.7,
    normalDomainAge: 500,
    riskyTerms: 'Used mining card. No warranty. Thermal paste not fresh. Sold as-is.',
    normalTerms: 'New retail sealed. Full NVIDIA warranty. 30-day performance guarantee.',
    riskLabel: 'Used Mining Card +81%',
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────
interface VerifierOutput {
  verifier_id: string;
  confidence_score: number;
  verdict: 'SAFE' | 'RISKY' | 'UNCERTAIN';
  reasoning: string;
  tx_id?: string;
}

interface CombinedResult {
  decision: 'APPROVED' | 'HALTED';
  combined_confidence: number;
  safety_threshold: number;
  disagreement_detected: boolean;
  verdicts: Record<string, VerifierOutput>;
  weights: Record<string, number>;
  halt_reason?: string;
  lora_group_url: string;
  tx_group_id: string;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function App() {
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

  // Wallet & Signing Mode
  const [peraAccount, setPeraAccount] = useState<string | null>(null);
  const [peraConnecting, setPeraConnecting] = useState(false);
  const [useAutonomousMode, setUseAutonomousMode] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Product selection
  const [selectedProduct, setSelectedProduct] = useState<Product>(PRODUCTS[0]);
  const [isRisky, setIsRisky] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'low-budget' | 'premium'>('all');

  // Derived form values
  const currentPrice = isRisky ? selectedProduct.riskyPrice : selectedProduct.normalPrice;
  const currentSeller = isRisky ? selectedProduct.riskySeller : selectedProduct.normalSeller;
  const currentRating = isRisky ? selectedProduct.riskySellerRating : selectedProduct.normalSellerRating;
  const currentDomain = isRisky ? selectedProduct.riskyDomainAge : selectedProduct.normalDomainAge;
  const currentTerms = isRisky ? selectedProduct.riskyTerms : selectedProduct.normalTerms;

  // Results
  const [loading, setLoading] = useState(false);
  const [stepText, setStepText] = useState('');
  const [waitingForPera, setWaitingForPera] = useState(false);
  const [atomicTxGroup, setAtomicTxGroup] = useState<AtomicTxGroupResult | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<CombinedResult | null>(null);
  const [verifiersStatus, setVerifiersStatus] = useState<any>(null);

  const demoAccount = getOrCreateAgentAccount();
  const activeAddress = (!useAutonomousMode && peraAccount) ? peraAccount : demoAccount.addr;

  // ── Update balance on address change ──
  const refreshBalance = useCallback(async () => {
    try {
      const algodClient = new algosdk.Algodv2('', ALGORAND_TESTNET_NODE, '');
      const bal = await getAccountBalance(algodClient, activeAddress);
      setWalletBalance(bal);
    } catch {}
  }, [activeAddress]);

  useEffect(() => {
    refreshBalance();
    const interval = setInterval(refreshBalance, 8000);
    return () => clearInterval(interval);
  }, [refreshBalance]);

  // ── Reconnect Pera on mount ──
  useEffect(() => {
    peraWallet.reconnectSession().then((accounts: string[]) => {
      if (accounts.length) {
        setPeraAccount(accounts[0]);
        setUseAutonomousMode(false);
      }
    }).catch(() => {});

    peraWallet.connector?.on('disconnect', () => {
      setPeraAccount(null);
      setUseAutonomousMode(true);
    });
  }, []);

  // ── Fetch verifier status ──
  useEffect(() => {
    fetch(`${API_BASE}/verifiers/status`)
      .then(r => r.json())
      .then(d => setVerifiersStatus(d))
      .catch(() => {});
  }, [API_BASE]);

  // ── Pera Connect ──
  const connectPera = async () => {
    setPeraConnecting(true);
    try {
      const accounts = await peraWallet.connect();
      setPeraAccount(accounts[0]);
      setUseAutonomousMode(false);
    } catch (e: any) {
      if (e?.data?.type !== 'CONNECT_MODAL_CLOSED') {
        console.warn('Pera connect note:', e?.message);
      }
    } finally {
      setPeraConnecting(false);
    }
  };

  const disconnectPera = () => {
    try { peraWallet.disconnect(); } catch {}
    try { closePeraWalletSignTxnToast(); } catch {}
    setPeraAccount(null);
    setUseAutonomousMode(true);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Main verification pipeline ──
  const runVerification = useCallback(async (forceAutonomousOverride = false) => {
    setLoading(true);
    setWaitingForPera(false);
    setEvaluationResult(null);
    setAtomicTxGroup(null);

    const isAuto = forceAutonomousOverride || useAutonomousMode || !peraAccount;

    try {
      if (!isAuto) {
        setWaitingForPera(true);
        setStepText('Step 1/3: 📲 Pera Signing Request sent to your phone! Please open Pera app & confirm.');
      } else {
        setStepText('Step 1/3: Autonomous AI Agent building 3x Atomic Algorand Tx Group...');
      }

      await new Promise(r => setTimeout(r, 400));

      const algodClient = new algosdk.Algodv2('', ALGORAND_TESTNET_NODE, '');
      const txGroupResult = await createAtomicTxGroup(
        algodClient,
        peraWallet,
        peraAccount,
        isAuto
      );
      setAtomicTxGroup(txGroupResult);
      setWaitingForPera(false);

      setStepText('Step 2/3: Dispatching x402 verifications via GoPlausible + Groq LLMs...');
      await new Promise(r => setTimeout(r, 600));

      const resp = await fetch(`${API_BASE}/evaluate/combined`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: selectedProduct.name,
          price: currentPrice,
          expected_range: selectedProduct.expectedRange,
          seller: currentSeller,
          seller_rating: currentRating,
          domain_age_days: currentDomain,
          terms_text: currentTerms,
          tx_group_id: txGroupResult.group_id,
          tx_ids: txGroupResult.tx_ids,
        }),
      });

      if (!resp.ok) throw new Error(`Server returned status ${resp.status}`);

      setStepText('Step 3/3: Running Bayesian calibration & disagreement checks...');
      await new Promise(r => setTimeout(r, 400));

      const data = await resp.json();
      setEvaluationResult(data);
      refreshBalance();
      fetch(`${API_BASE}/verifiers/status`).then(r => r.json()).then(d => setVerifiersStatus(d)).catch(() => {});
    } catch (err: any) {
      alert(`Pipeline note: ${err?.message || 'Check backend logs'}`);
    } finally {
      setLoading(false);
      setWaitingForPera(false);
      setStepText('');
      try { closePeraWalletSignTxnToast(); } catch {}
    }
  }, [selectedProduct, currentPrice, currentSeller, currentRating, currentDomain, currentTerms, peraAccount, useAutonomousMode, API_BASE, refreshBalance]);

  const shortAddr = `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`;

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px 20px 80px' }}>

      {/* ── HEADER ── */}
      <header className="glass-card" style={{ padding: '18px 28px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'linear-gradient(135deg, #0284c7, #9333ea)', padding: '11px', borderRadius: '13px', display: 'flex' }}>
            <ShieldCheck size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 800, background: 'linear-gradient(90deg, #38bdf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AgentGuard
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Machine-to-Machine (M2M) Pay-Per-Verification Marketplace · Algorand Testnet + GoPlausible x402
            </p>
          </div>
        </div>

        {/* Top Right: Network + Mode Selector + Faucet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="glass-card" style={{ padding: '7px 13px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(15,23,42,0.6)' }}>
            <div className="pulse-dot" />
            <span>Algorand <strong style={{ color: '#38bdf8' }}>Testnet</strong></span>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setUseAutonomousMode(true)}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                background: useAutonomousMode ? 'linear-gradient(135deg, #0284c7, #6366f1)' : 'transparent',
                color: useAutonomousMode ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}
              title="Autonomous Machine-to-Machine settlement (No phone prompt needed)"
            >
              <Bot size={13} /> 🤖 Autonomous Agent (M2M)
            </button>
            <button
              onClick={() => {
                if (!peraAccount) connectPera();
                else setUseAutonomousMode(false);
              }}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                background: !useAutonomousMode && peraAccount ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: !useAutonomousMode && peraAccount ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Smartphone size={13} /> {peraAccount ? `📱 Pera: ${shortAddr}` : '📱 Connect Pera'}
            </button>
          </div>

          {peraAccount && (
            <button onClick={disconnectPera} title="Disconnect Pera Wallet" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}>
              <LogOut size={14} />
            </button>
          )}
        </div>
      </header>

      {/* ── WALLET INFO & FAUCET BAR ── */}
      <div className="glass-card" style={{ padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'rgba(15,23,42,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Active Signer:</span>
          <code style={{ fontSize: '0.78rem', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: '6px', color: '#38bdf8' }}>
            {shortAddr}
          </code>
          <button onClick={copyAddress} title="Copy full address" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4ade80' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy'}
          </button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
            Balance: <strong style={{ color: (walletBalance || 0) > 0 ? '#4ade80' : '#f87171' }}>{walletBalance !== null ? `${walletBalance.toFixed(3)} ALGO` : 'Loading...'}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="https://lora.algokit.io/testnet/fund"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Droplets size={13} /> 💧 Get Free Testnet ALGO (Lora Faucet) <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* ── M2M EXPLAINER BANNER ── */}
      <div className="glass-card" style={{ padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: useAutonomousMode ? 'rgba(56,189,248,0.06)' : 'rgba(16,185,129,0.06)', border: useAutonomousMode ? '1px solid rgba(56,189,248,0.2)' : '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {useAutonomousMode ? <Bot size={20} color="#38bdf8" /> : <Smartphone size={20} color="#4ade80" />}
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: useAutonomousMode ? '#38bdf8' : '#4ade80' }}>
              {useAutonomousMode
                ? '🤖 Autonomous AI Agent Mode (Machine-to-Machine / M2M)'
                : '📱 Human-in-the-Loop Mode (Pera Mobile Wallet Connected)'
              }
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {useAutonomousMode
                ? 'The Primary AI Agent autonomously constructs, signs (0.003 ALGO), and settles x402 verifications with specialist agents in 0.5s with zero human intervention.'
                : 'Transactions are sent to your Pera Mobile App for on-chain signing. Please ensure you tap "Confirm" on your phone.'
              }
            </div>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Facilitator: <strong style={{ color: '#c084fc' }}>GoPlausible x402</strong>
        </div>
      </div>

      {/* ── PRODUCT CATALOG GRID ── */}
      <section className="glass-card" style={{ padding: '22px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={18} color="#38bdf8" /> Select Product Scenario to Verify
          </h2>

          {/* Category Filter Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `All Products (${PRODUCTS.length})` },
              { id: 'low-budget', label: '⚡ Low Budget (< 10 ALGO)' },
              { id: 'premium', label: '💎 Premium Goods' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 700,
                  background: activeCategory === cat.id ? 'linear-gradient(135deg, #0284c7, #9333ea)' : 'rgba(255,255,255,0.06)',
                  color: activeCategory === cat.id ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                  boxShadow: activeCategory === cat.id ? '0 2px 10px rgba(2,132,199,0.3)' : 'none',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
          {PRODUCTS.filter(p => activeCategory === 'all' || p.category === activeCategory).map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedProduct(p); setEvaluationResult(null); setAtomicTxGroup(null); }}
              style={{
                background: selectedProduct.id === p.id ? 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(168,85,247,0.18))' : 'rgba(15,23,42,0.5)',
                border: selectedProduct.id === p.id ? '1.5px solid rgba(56,189,248,0.6)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px', padding: '14px 12px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s', color: '#fff', position: 'relative'
              }}
            >
              {p.category === 'low-budget' && (
                <span style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '0.62rem', fontWeight: 800, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#4ade80', borderRadius: '6px', padding: '2px 6px' }}>
                  &lt;10 ALGO
                </span>
              )}
              <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>{p.emoji}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', lineHeight: 1.2 }}>{p.name}</div>
              <div style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700 }}>{formatPrice(p.normalPrice, p.currency)} normal</div>
              <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '2px' }}>{p.riskLabel}</div>
            </button>
          ))}
        </div>
      </section>

      {/* ── SCENARIO TOGGLE + DETAILS ── */}
      <section className="glass-card" style={{ padding: '22px', marginBottom: '24px', background: isRisky ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(168,85,247,0.07))' : 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(56,189,248,0.07))', border: isRisky ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(34,197,94,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '2rem' }}>{selectedProduct.emoji}</span>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selectedProduct.name}</h3>
                <span className={`badge badge-${isRisky ? 'risky' : 'safe'}`} style={{ marginTop: '4px' }}>
                  {isRisky ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  {isRisky ? `RISKY SCENARIO — ${selectedProduct.riskLabel}` : 'SAFE SCENARIO'}
                </span>
              </div>
            </div>
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => { setIsRisky(true); setEvaluationResult(null); setAtomicTxGroup(null); }}
              style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: isRisky ? 'linear-gradient(135deg, #dc2626, #991b1b)' : 'rgba(255,255,255,0.07)', color: '#fff', boxShadow: isRisky ? '0 4px 16px rgba(220,38,38,0.4)' : 'none' }}
            >
              🚨 Risky Scenario
            </button>
            <button
              onClick={() => { setIsRisky(false); setEvaluationResult(null); setAtomicTxGroup(null); }}
              style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: !isRisky ? 'linear-gradient(135deg, #16a34a, #15803d)' : 'rgba(255,255,255,0.07)', color: '#fff', boxShadow: !isRisky ? '0 4px 16px rgba(220,38,38,0.4)' : 'none' }}
            >
              ✅ Safe Scenario
            </button>
          </div>
        </div>

        {/* Parameters Display */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Listed Price', value: formatPrice(currentPrice, selectedProduct.currency), highlight: isRisky },
            { label: 'Seller', value: currentSeller, highlight: false },
            { label: 'Seller Rating', value: `${currentRating} ⭐`, highlight: isRisky && currentRating < 4 },
            { label: 'Domain Age', value: `${currentDomain} days`, highlight: isRisky && currentDomain < 30 },
          ].map(f => (
            <div key={f.label} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '10px 14px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: f.highlight ? '#f87171' : '#fff' }}>{f.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: '#fff' }}>Terms:</strong> {currentTerms}
        </div>

        {/* Action Button & Bypass */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            className={isRisky ? 'btn-demo' : 'btn-primary'}
            onClick={() => runVerification(false)}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
          >
            {loading
              ? <><RefreshCw size={18} style={{ animation: 'spin 1.2s linear infinite' }} /> {stepText}</>
              : <><Zap size={18} /> Run AgentGuard Verification (0.3 ALGO) · {useAutonomousMode ? '🤖 M2M Autonomous' : '📱 Pera Wallet'}</>
            }
          </button>

          {/* Quick Bypass Button if Pera modal is open/waiting */}
          {waitingForPera && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
              <button
                onClick={() => runVerification(true)}
                style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '8px', padding: '8px 18px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Bot size={14} /> Skip Mobile Sign & Proceed with Autonomous Agent (Instant)
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── RESULTS ── */}
      {(evaluationResult || atomicTxGroup) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Decision Banner */}
          {evaluationResult && (
            <section className="glass-card" style={{
              padding: '24px',
              borderLeft: evaluationResult.decision === 'APPROVED' ? '6px solid #22c55e' : '6px solid #ef4444',
              background: evaluationResult.decision === 'APPROVED' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    {evaluationResult.decision === 'APPROVED'
                      ? <CheckCircle2 size={34} color="#22c55e" />
                      : <XCircle size={34} color="#ef4444" />
                    }
                    <h2 style={{ fontSize: '1.7rem', fontWeight: 800, color: evaluationResult.decision === 'APPROVED' ? '#4ade80' : '#f87171' }}>
                      AI AGENT: {evaluationResult.decision}
                    </h2>
                  </div>
                  {evaluationResult.halt_reason && (
                    <p style={{ fontSize: '0.9rem', color: '#fca5a5', maxWidth: '700px', background: 'rgba(239,68,68,0.12)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <strong>Halt Reason:</strong> {evaluationResult.halt_reason}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Combined Confidence</div>
                  <div style={{ fontSize: '2.4rem', fontWeight: 800, color: (evaluationResult.combined_confidence || 0) >= 0.7 ? '#4ade80' : '#f87171' }}>
                    {((evaluationResult.combined_confidence || 0) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Safety Threshold: {((evaluationResult.safety_threshold || 0.7) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Atomic Tx Group */}
          {atomicTxGroup && (
            <section className="glass-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}>
                  <Layers size={20} color="#a855f7" /> Atomic Algorand Transaction Group (3 Verifier Payments)
                  <span className="badge badge-safe" style={{ fontSize: '0.7rem' }}>
                    {atomicTxGroup.signed_by === 'pera' ? '📱 Signed via Pera Wallet' : '🤖 Signed via Autonomous Agent'}
                  </span>
                  {atomicTxGroup.confirmed_round ? (
                    <span className="badge badge-safe" style={{ fontSize: '0.7rem', background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                      ✅ Confirmed Block #{atomicTxGroup.confirmed_round}
                    </span>
                  ) : null}
                </h3>
                <a href={atomicTxGroup.lora_tx_urls[0]} target="_blank" rel="noreferrer"
                  className="btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem', textDecoration: 'none' }}>
                  Inspect on Lora Explorer <ExternalLink size={13} />
                </a>
              </div>

              {/* On-Chain Status Banner */}
              {atomicTxGroup.on_chain_status === 'CONFIRMED' ? (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.82rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#4ade80" />
                  <span><strong>Settled on Algorand Testnet!</strong> 0.3 ALGO was deducted from your wallet and confirmed in Block #{atomicTxGroup.confirmed_round}.</span>
                </div>
              ) : atomicTxGroup.broadcast_error ? (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.82rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} color="#f87171" />
                  <span><strong>On-Chain Notice:</strong> {atomicTxGroup.broadcast_error}</span>
                </div>
              ) : null}

              <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.4)', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', color: '#c084fc', wordBreak: 'break-all' }}>
                <strong>Group ID:</strong> {atomicTxGroup.group_id}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {(atomicTxGroup.tx_ids || []).map((txId, idx) => {
                  const labels = ['💰 Price-Check · 0.1 ALGO', '🔍 Scam-Check · 0.1 ALGO', '📄 Terms-Check · 0.1 ALGO'];
                  const txUrl = atomicTxGroup.lora_tx_urls?.[idx] || `https://lora.algokit.io/testnet/transaction/${txId}`;
                  return (
                    <div key={txId} style={{ background: 'rgba(15,23,42,0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{labels[idx]}</div>
                      <a href={txUrl} target="_blank" rel="noreferrer"
                        style={{ fontSize: '0.73rem', fontFamily: 'var(--font-mono)', color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {txId.slice(0, 10)}...{txId.slice(-6)} <ExternalLink size={11} />
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3 Verifier Cards */}
          {evaluationResult?.verdicts && (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {[
                { key: 'price-check', label: 'Price Anomaly Verifier', icon: <DollarSign size={16} color="#38bdf8" />, color: '#38bdf8', to: VERIFIER_ADDRS['price-check'] },
                { key: 'scam-check', label: 'Scam & Seller Verifier', icon: <ShieldAlert size={16} color="#a855f7" />, color: '#a855f7', to: VERIFIER_ADDRS['scam-check'] },
                { key: 'terms-check', label: 'Terms & Legal Verifier', icon: <Cpu size={16} color="#22c55e" />, color: '#22c55e', to: VERIFIER_ADDRS['terms-check'] },
              ].map(({ key, label, icon, color, to }) => {
                const v = evaluationResult.verdicts[key];
                if (!v) return null;
                const isGood = v.verdict === 'SAFE';
                return (
                  <div key={key} className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {icon} {label}
                      </h4>
                      <span className={`badge badge-${v.verdict.toLowerCase()}`}>{v.verdict}</span>
                    </div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: isGood ? '#4ade80' : v.verdict === 'UNCERTAIN' ? '#fbbf24' : '#f87171', marginBottom: '8px' }}>
                      {((v.confidence_score || 0) * 100).toFixed(0)}%
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>confidence</span>
                    </div>
                    <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '12px' }}>
                      {v.reasoning}
                    </p>
                    <div style={{ fontSize: '0.72rem', color, display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                      <Lock size={11} /> x402 Paid: 0.1 ALGO → {to.slice(0, 6)}...{to.slice(-4)}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

        </div>
      )}

      {/* Empty state */}
      {!evaluationResult && !loading && !atomicTxGroup && (
        <div className="glass-card" style={{ padding: '50px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ShieldCheck size={46} color="#38bdf8" style={{ marginBottom: '14px', opacity: 0.7 }} />
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '8px' }}>Ready to Verify Autonomous Purchase</h3>
          <p style={{ fontSize: '0.88rem', maxWidth: '540px', margin: '0 auto', lineHeight: 1.5 }}>
            Select any item above, toggle between <strong>Risky</strong> and <strong>Safe</strong> scenarios, then click <strong>Run AgentGuard Verification</strong>.
            The system executes a 3x Atomic Algorand Transaction Group and queries Groq Llama-3.3 LLM verifiers in real time.
          </p>
        </div>
      )}

      {/* Verifier weights footer */}
      {verifiersStatus?.weights && (
        <div className="glass-card" style={{ padding: '16px 22px', marginTop: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
            Bayesian Verifier Weights:
          </span>
          {Object.entries(verifiersStatus.weights).map(([k, w]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{k}</span>
              <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Number(w) * 75)}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #a855f7)' }} />
              </div>
              <strong style={{ fontSize: '0.78rem', color: '#38bdf8' }}>{Number(w).toFixed(2)}</strong>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
