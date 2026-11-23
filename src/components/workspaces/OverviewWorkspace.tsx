import {
  ArrowRight,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  formatDateTime,
  formatTokenAmount,
  formatUsd,
  shortenAddress,
  shortenHash,
} from '../../lib/api';
import { CONTRACT_ADDRESSES, POLYGON_AMOY_NETWORK } from '../../lib/contracts';
import type {
  BlockchainStats,
  OverviewMetrics,
  WalletBalances,
  WorkspaceTab,
} from '../../lib/types';

interface OverviewWorkspaceProps {
  overview: OverviewMetrics | null;
  blockchainStats: BlockchainStats | null;
  walletAddress: string | null;
  walletBalances: WalletBalances | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: WorkspaceTab) => void;
  onConnectWallet: () => void;
  searchQuery: string;
}

export function OverviewWorkspace({
  overview,
  blockchainStats,
  walletAddress,
  walletBalances,
  loading,
  onRefresh,
  onNavigate,
  onConnectWallet,
  searchQuery,
}: OverviewWorkspaceProps) {
  const q = searchQuery.trim().toLowerCase();
  const filteredActions = (overview?.recentActions || []).filter((a) => {
    if (!q) return true;
    return (
      a.action.toLowerCase().includes(q) ||
      (a.actor_staff_id || '').toLowerCase().includes(q) ||
      (a.entity_id || '').toLowerCase().includes(q) ||
      (a.tx_hash || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Registered Parcels
          </p>
          <p className="mt-2 text-3xl font-display font-bold text-slate-900 font-mono tabular-nums">
            {loading && !overview ? '—' : overview?.totalParcels ?? 0}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-mono tabular-nums font-medium text-emerald-700">
              {overview?.activeTokenizedTitles ?? 0}
            </span>{' '}
            active tokenized NFT titles
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500">
            Awaiting Governor Consent
          </p>
          <p className="mt-2 text-3xl font-display font-bold text-emerald-700 font-mono tabular-nums">
            {loading && !overview ? '—' : overview?.pendingConsentCount ?? 0}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('consent')}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            <span>Open Consent Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500">
            Section 28 Revocations
          </p>
          <p className="mt-2 text-3xl font-display font-bold text-slate-900 font-mono tabular-nums">
            {loading && !overview ? '—' : overview?.revocationsCount ?? 0}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            High-value co-signs pending:{' '}
            <button
              type="button"
              onClick={() => onNavigate('cosign')}
              className="font-mono tabular-nums font-semibold text-emerald-700 hover:underline cursor-pointer"
            >
              {overview?.highValuePendingCount ?? 0}
            </button>
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Compensation Committed
          </p>
          <p className="mt-2 text-3xl font-display font-bold text-slate-900 font-mono tabular-nums">
            {loading && !overview
              ? '—'
              : formatUsd(overview?.totalCompensationUsd ?? 0)}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Disbursed:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {formatUsd(overview?.disbursedCompensationUsd ?? 0)}
            </span>
          </p>
        </div>
      </div>

      {/* Wallet & Polygon Amoy Smart Contract Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#FAFDF8] border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-display font-bold text-slate-900">
              Executive Governor Wallet (Polygon Amoy 80002)
            </h2>
            {!walletAddress && (
              <button
                type="button"
                onClick={onConnectWallet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect MetaMask</span>
              </button>
            )}
          </div>

          {walletAddress ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200/80">
              <div>
                <p className="text-xs text-slate-500">Connected Signer</p>
                <p className="mt-1 font-mono tabular-nums text-sm font-semibold text-slate-900">
                  {shortenAddress(walletAddress)}
                </p>
                <p className="mt-1 text-xs text-emerald-700 font-medium inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {walletBalances?.hasGovernorRole
                      ? 'GOVERNOR_ROLE active'
                      : 'View-only (No GOVERNOR_ROLE)'}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">ANAGU Fee Balance</p>
                <p className="mt-1 font-mono tabular-nums text-lg font-bold text-emerald-800">
                  {formatTokenAmount(walletBalances?.anaguBalance, 2)} ANAGU
                </p>
                <p className="mt-0.5 text-[11px] font-mono text-slate-500">
                  {shortenAddress(CONTRACT_ADDRESSES.ANAGUToken)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Gas Balance (POL)</p>
                <p className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-900">
                  {formatTokenAmount(walletBalances?.polBalance, 4)} POL
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Chain ID 80002
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Connect your authorized Governor MetaMask wallet to verify{' '}
              <span className="font-mono">GOVERNOR_ROLE</span> on{' '}
              <span className="font-mono">LandTitleNFT</span>, monitor live{' '}
              <span className="font-mono">ANAGU</span> &amp;{' '}
              <span className="font-mono">POL</span> balances, and sign Section
              28 revocations on Polygon Amoy.
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-display font-bold text-slate-900">
              On-Chain LandRegistry &amp; LandTitleNFT State
            </h2>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Titles Issued</p>
              <p className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-900">
                {blockchainStats?.titlesIssued ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Transfers Done</p>
              <p className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-900">
                {blockchainStats?.transfersCompleted ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Fees Collected</p>
              <p className="mt-1 font-mono tabular-nums text-lg font-bold text-emerald-800">
                {blockchainStats
                  ? `${formatTokenAmount(blockchainStats.totalFeesCollectedAnagu, 2)}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Amoy Block</p>
              <p className="mt-1 font-mono tabular-nums text-sm font-semibold text-slate-700">
                {blockchainStats?.blockNumber
                  ? `#${blockchainStats.blockNumber.toLocaleString()}`
                  : '—'}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span>
              NFT:{' '}
              <a
                href={`${POLYGON_AMOY_NETWORK.blockExplorerUrl}/address/${CONTRACT_ADDRESSES.LandTitleNFT}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-emerald-700 hover:underline inline-flex items-center gap-0.5"
              >
                {shortenAddress(CONTRACT_ADDRESSES.LandTitleNFT)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Registry:{' '}
              <a
                href={`${POLYGON_AMOY_NETWORK.blockExplorerUrl}/address/${CONTRACT_ADDRESSES.LandRegistry}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-emerald-700 hover:underline inline-flex items-center gap-0.5"
              >
                {shortenAddress(CONTRACT_ADDRESSES.LandRegistry)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Consent Threshold:{' '}
              <span className="font-mono tabular-nums text-slate-700 font-medium">
                {formatUsd(overview?.thresholdUsd ?? 250000)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Recent Executive Actions */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-display font-bold text-slate-900">
              Recent Executive Actions
            </h2>
            <p className="text-xs text-slate-500">
              Latest Governor approvals, countersignatures, and Section 28
              revocations recorded in <span className="font-mono">audit_logs</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap cursor-pointer"
          >
            View Full Audit Ledger &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#FAFDF8] text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Staff ID</th>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">Polygon Amoy Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredActions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 px-4 text-center text-slate-500"
                  >
                    No executive actions logged yet.
                  </td>
                </tr>
              ) : (
                filteredActions.map((act) => (
                  <tr key={act.id} className="hover:bg-[#FAFDF8]">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateTime(act.created_at)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {act.action}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {act.actor_staff_id || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {act.entity_type ? `${act.entity_type}: ` : ''}
                      {act.entity_id || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {act.tx_hash ? (
                        <a
                          href={`${POLYGON_AMOY_NETWORK.blockExplorerUrl}/tx/${act.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{shortenHash(act.tx_hash)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
