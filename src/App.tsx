import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { HeaderBar } from './components/HeaderBar';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { ConsentQueueWorkspace } from './components/workspaces/ConsentQueueWorkspace';
import { DisputesWorkspace } from './components/workspaces/DisputesWorkspace';
import { GazetteLedgerWorkspace } from './components/workspaces/GazetteLedgerWorkspace';
import { HighValueCosignWorkspace } from './components/workspaces/HighValueCosignWorkspace';
import { OverviewWorkspace } from './components/workspaces/OverviewWorkspace';
import { ReportsAuditWorkspace } from './components/workspaces/ReportsAuditWorkspace';
import { RevocationsWorkspace } from './components/workspaces/RevocationsWorkspace';
import { apiRequest } from './lib/api';
import { POLYGON_AMOY_NETWORK } from './lib/contracts';
import type {
  AuditLogEntry,
  BlockchainStats,
  DisputedOversightItem,
  EligibleTitleItem,
  GovernorProfile,
  HighValueTransferItem,
  NotificationItem,
  OverviewMetrics,
  ParcelConsentItem,
  StatutoryRevocationRecord,
  WalletBalances,
  WorkspaceTab,
} from './lib/types';
import {
  connectMetaMaskWallet,
  getConnectedAccounts,
  getCurrentChainId,
  switchMetaMaskWallet,
  switchToPolygonAmoy,
} from './lib/web3';

const SECTION_TITLES: Record<WorkspaceTab, string> = {
  overview: 'Executive Overview',
  consent: 'Executive Consent Queue',
  cosign: 'High-Value Transfer Co-Sign',
  revocations: 'Section 28 Statutory Revocations',
  ledger: 'Gazette & Compensation Ledger',
  disputes: 'Disputed Parcels & Oversight',
  reports: 'Executive Reports & Audit Logs',
};

export default function App() {
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean | null>(
    null
  );
  // Bearer session token stored strictly in React memory (never localStorage/sessionStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [governor, setGovernor] = useState<GovernorProfile | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [walletBalances, setWalletBalances] = useState<WalletBalances | null>(
    null
  );
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);

  // Domain data state
  const [loadingData, setLoadingData] = useState(false);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [blockchainStats, setBlockchainStats] =
    useState<BlockchainStats | null>(null);
  const [consentItems, setConsentItems] = useState<ParcelConsentItem[]>([]);
  const [highValueData, setHighValueData] = useState<{
    thresholdUsd: number;
    items: HighValueTransferItem[];
  }>({ thresholdUsd: 250000, items: [] });
  const [eligibleTitles, setEligibleTitles] = useState<EligibleTitleItem[]>([]);
  const [revocations, setRevocations] = useState<StatutoryRevocationRecord[]>(
    []
  );
  const [disputes, setDisputes] = useState<DisputedOversightItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Check backend configuration status on mount
  useEffect(() => {
    apiRequest<{ ok: boolean; supabaseConfigured: boolean }>('/api/health')
      .then((res) => setSupabaseConfigured(res.supabaseConfigured))
      .catch(() => setSupabaseConfigured(null));
  }, []);

  // Load Polygon Amoy wallet balances via /api/blockchain/balances/:address
  const refreshWalletBalances = useCallback(async (address: string | null) => {
    if (!address) {
      setWalletBalances(null);
      return;
    }
    setWalletLoading(true);
    try {
      const bal = await apiRequest<WalletBalances>(
        `/api/blockchain/balances/${address}`
      );
      setWalletBalances(bal);
    } catch {
      setWalletBalances(null);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  // Attach MetaMask accountsChanged & chainChanged listeners
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [accounts, chainId] = await Promise.all([
          getConnectedAccounts(),
          getCurrentChainId(),
        ]);
        if (!mounted) return;
        setWalletChainId(chainId);
        if (accounts.length > 0) {
          const checksummed = ethers.getAddress(accounts[0]);
          setWalletAddress(checksummed);
          refreshWalletBalances(checksummed);
        }
      } catch {
        // Ignore if no injected provider
      }
    })();

    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setWalletAddress(null);
        setWalletBalances(null);
        return;
      }
      const checksummed = ethers.getAddress(accounts[0]);
      setWalletAddress(checksummed);
      refreshWalletBalances(checksummed);
    };

    const handleChainChanged = (hexChainId: string) => {
      const nextChain = Number.parseInt(hexChainId, 16);
      setWalletChainId(nextChain);
      if (walletAddress) {
        refreshWalletBalances(walletAddress);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      mounted = false;
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [refreshWalletBalances, walletAddress]);

  const loadAllGovernorData = useCallback(async (token: string) => {
    setLoadingData(true);
    try {
      const [
        meRes,
        ovRes,
        bcRes,
        consentRes,
        hvRes,
        eligRes,
        revRes,
        dispRes,
        auditRes,
        notifRes,
      ] = await Promise.allSettled([
        apiRequest<{ governor: GovernorProfile }>('/api/governor/me', {
          token,
        }),
        apiRequest<OverviewMetrics>('/api/governor/overview', { token }),
        apiRequest<BlockchainStats>('/api/blockchain/stats'),
        apiRequest<{ items: ParcelConsentItem[] }>(
          '/api/governor/consent-queue',
          { token }
        ),
        apiRequest<{ thresholdUsd: number; items: HighValueTransferItem[] }>(
          '/api/governor/high-value-transfers',
          { token }
        ),
        apiRequest<{ items: EligibleTitleItem[] }>(
          '/api/governor/revocations/eligible',
          { token }
        ),
        apiRequest<{ items: StatutoryRevocationRecord[] }>(
          '/api/governor/revocations',
          { token }
        ),
        apiRequest<{ items: DisputedOversightItem[] }>(
          '/api/governor/disputes',
          { token }
        ),
        apiRequest<{ items: AuditLogEntry[] }>(
          '/api/governor/audit-logs?limit=150',
          { token }
        ),
        apiRequest<{ items: NotificationItem[] }>(
          '/api/governor/notifications',
          { token }
        ),
      ]);

      if (meRes.status === 'fulfilled') setGovernor(meRes.value.governor);
      if (ovRes.status === 'fulfilled') setOverview(ovRes.value);
      if (bcRes.status === 'fulfilled') setBlockchainStats(bcRes.value);
      if (consentRes.status === 'fulfilled')
        setConsentItems(consentRes.value.items);
      if (hvRes.status === 'fulfilled') setHighValueData(hvRes.value);
      if (eligRes.status === 'fulfilled')
        setEligibleTitles(eligRes.value.items);
      if (revRes.status === 'fulfilled') setRevocations(revRes.value.items);
      if (dispRes.status === 'fulfilled') setDisputes(dispRes.value.items);
      if (auditRes.status === 'fulfilled') setAuditLogs(auditRes.value.items);
      if (notifRes.status === 'fulfilled')
        setNotifications(notifRes.value.items);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (authToken) {
      loadAllGovernorData(authToken);
    }
  }, [authToken, loadAllGovernorData]);

  async function handleConnectWallet() {
    setWalletNotice(null);
    try {
      const addr = await connectMetaMaskWallet();
      setWalletAddress(addr);
      const chainId = await getCurrentChainId();
      setWalletChainId(chainId);
      if (chainId !== POLYGON_AMOY_NETWORK.chainId) {
        await switchToPolygonAmoy();
        setWalletChainId(POLYGON_AMOY_NETWORK.chainId);
      }
      await refreshWalletBalances(addr);
    } catch (err) {
      setWalletNotice(
        err instanceof Error ? err.message : 'Unable to connect MetaMask wallet.'
      );
    }
  }

  async function handleSwitchWallet() {
    setWalletNotice(null);
    try {
      const addr = await switchMetaMaskWallet();
      setWalletAddress(addr);
      await refreshWalletBalances(addr);
    } catch (err) {
      setWalletNotice(
        err instanceof Error ? err.message : 'Unable to switch wallet account.'
      );
    }
  }

  async function handleSwitchToAmoy() {
    setWalletNotice(null);
    try {
      await switchToPolygonAmoy();
      setWalletChainId(POLYGON_AMOY_NETWORK.chainId);
      if (walletAddress) {
        await refreshWalletBalances(walletAddress);
      }
    } catch (err) {
      setWalletNotice(
        err instanceof Error
          ? err.message
          : 'Unable to switch network to Polygon Amoy (80002).'
      );
    }
  }

  async function handleLogout() {
    if (authToken) {
      apiRequest('/api/governor/logout', {
        method: 'POST',
        token: authToken,
      }).catch(() => {});
    }
    setAuthToken(null);
    setGovernor(null);
    setOverview(null);
    setActiveTab('overview');
  }

  if (!authToken || !governor) {
    return (
      <LoginView
        supabaseConfigured={supabaseConfigured}
        onAuthenticated={({ token, governor: profile }) => {
          setAuthToken(token);
          setGovernor(profile);
          setActiveTab('overview');
        }}
      />
    );
  }

  const sidebarCounts = {
    pendingConsent: overview?.pendingConsentCount ?? 0,
    highValuePending: overview?.highValuePendingCount ?? 0,
    disputed: overview?.disputedCount ?? 0,
  };

  return (
    <div className="min-h-screen bg-[#FAFDF8] text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSearchQuery('');
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        counts={sidebarCounts}
      />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <HeaderBar
          sectionTitle={SECTION_TITLES[activeTab]}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          governor={governor}
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          walletBalances={walletBalances}
          walletLoading={walletLoading}
          onConnectWallet={handleConnectWallet}
          onSwitchWallet={handleSwitchWallet}
          onSwitchToAmoy={handleSwitchToAmoy}
          notifications={notifications}
          onMarkNotificationsRead={async () => {
            await apiRequest('/api/governor/notifications/read', {
              method: 'PATCH',
              token: authToken,
            });
            setNotifications((prev) =>
              prev.map((n) => ({ ...n, is_read: true }))
            );
          }}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
          {walletNotice && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 flex items-center justify-between gap-3 no-print">
              <span>{walletNotice}</span>
              <button
                type="button"
                onClick={() => setWalletNotice(null)}
                className="font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewWorkspace
              overview={overview}
              blockchainStats={blockchainStats}
              walletAddress={walletAddress}
              walletBalances={walletBalances}
              loading={loadingData}
              onRefresh={() => {
                loadAllGovernorData(authToken);
                if (walletAddress) refreshWalletBalances(walletAddress);
              }}
              onNavigate={setActiveTab}
              onConnectWallet={handleConnectWallet}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'consent' && (
            <ConsentQueueWorkspace
              items={consentItems}
              loading={loadingData}
              searchQuery={searchQuery}
              onGrantConsent={async (parcelId, notes) => {
                await apiRequest(`/api/governor/consent/${parcelId}/grant`, {
                  method: 'POST',
                  token: authToken,
                  body: { notes },
                });
                await loadAllGovernorData(authToken);
              }}
              onReturnToRegistrar={async (parcelId, notes) => {
                await apiRequest(`/api/governor/consent/${parcelId}/return`, {
                  method: 'POST',
                  token: authToken,
                  body: { notes },
                });
                await loadAllGovernorData(authToken);
              }}
            />
          )}

          {activeTab === 'cosign' && (
            <HighValueCosignWorkspace
              thresholdUsd={highValueData.thresholdUsd}
              items={highValueData.items}
              loading={loadingData}
              searchQuery={searchQuery}
              onCosign={async (id, notes) => {
                await apiRequest(
                  `/api/governor/high-value-transfers/${id}/cosign`,
                  {
                    method: 'POST',
                    token: authToken,
                    body: { notes },
                  }
                );
                await loadAllGovernorData(authToken);
              }}
            />
          )}

          {activeTab === 'revocations' && (
            <RevocationsWorkspace
              eligibleTitles={eligibleTitles}
              loading={loadingData}
              walletAddress={walletAddress}
              walletBalances={walletBalances}
              onConnectWallet={handleConnectWallet}
              onRecordRevocation={async (payload) => {
                const res = await apiRequest<{
                  record: StatutoryRevocationRecord;
                }>('/api/governor/revocations', {
                  method: 'POST',
                  token: authToken,
                  body: payload,
                });
                await loadAllGovernorData(authToken);
                return res.record;
              }}
            />
          )}

          {activeTab === 'ledger' && (
            <GazetteLedgerWorkspace
              revocations={revocations}
              loading={loadingData}
              searchQuery={searchQuery}
              onToggleDisbursement={async (
                id,
                disbursed,
                settlementReference
              ) => {
                await apiRequest(
                  `/api/governor/revocations/${id}/disbursement`,
                  {
                    method: 'PATCH',
                    token: authToken,
                    body: { disbursed, settlementReference },
                  }
                );
                await loadAllGovernorData(authToken);
              }}
            />
          )}

          {activeTab === 'disputes' && (
            <DisputesWorkspace
              items={disputes}
              loading={loadingData}
              searchQuery={searchQuery}
              onResolveDispute={async (payload) => {
                await apiRequest(`/api/governor/disputes/${payload.id}/resolve`, {
                  method: 'POST',
                  token: authToken,
                  body: payload,
                });
                await loadAllGovernorData(authToken);
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsAuditWorkspace
              overview={overview}
              revocations={revocations}
              auditLogs={auditLogs}
              loading={loadingData}
              searchQuery={searchQuery}
            />
          )}
        </main>
      </div>
    </div>
  );
}
