import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Gavel,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  apiRequest,
  formatUsd,
  shortenAddress,
  shortenHash,
} from '../../lib/api';
import {
  CONTRACT_ADDRESSES,
  POLYGON_AMOY_NETWORK,
  REVOCATION_GROUNDS,
} from '../../lib/contracts';
import { executeLandTitleRevocation } from '../../lib/web3';
import type {
  EligibleTitleItem,
  OnChainTitleInfo,
  StatutoryRevocationRecord,
  WalletBalances,
} from '../../lib/types';

interface RevocationsWorkspaceProps {
  eligibleTitles: EligibleTitleItem[];
  loading: boolean;
  walletAddress: string | null;
  walletBalances: WalletBalances | null;
  onConnectWallet: () => void;
  onRecordRevocation: (payload: {
    tokenId: string;
    parcelId?: string | null;
    ground: number;
    gazetteNumber: string;
    publicPurposeDetails: string;
    compensationAmount: number;
    compensationDisbursed: boolean;
    txHash?: string | null;
    revokedByWallet?: string | null;
  }) => Promise<StatutoryRevocationRecord>;
}

export function RevocationsWorkspace({
  eligibleTitles,
  loading,
  walletAddress,
  walletBalances,
  onConnectWallet,
  onRecordRevocation,
}: RevocationsWorkspaceProps) {
  const activeTitles = eligibleTitles.filter((t) => !t.is_revoked);

  const [selectedTokenId, setSelectedTokenId] = useState<string>('');
  const [ground, setGround] = useState<number>(0);
  const [gazetteNumber, setGazetteNumber] = useState('');
  const [publicPurposeDetails, setPublicPurposeDetails] = useState('');
  const [compensationAmount, setCompensationAmount] = useState('');
  const [compensationDisbursed, setCompensationDisbursed] = useState(false);

  const [onChainInfo, setOnChainInfo] = useState<OnChainTitleInfo | null>(null);
  const [checkingChain, setCheckingChain] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepStatus, setStepStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] =
    useState<StatutoryRevocationRecord | null>(null);

  const selectedTitle =
    activeTitles.find((t) => t.token_id === selectedTokenId) ||
    activeTitles[0] ||
    null;

  useEffect(() => {
    const targetToken = selectedTokenId || activeTitles[0]?.token_id;
    if (!targetToken) {
      setOnChainInfo(null);
      return;
    }
    let cancelled = false;
    setCheckingChain(true);
    apiRequest<OnChainTitleInfo>(`/api/blockchain/title/${targetToken}`)
      .then((info) => {
        if (!cancelled) setOnChainInfo(info);
      })
      .catch(() => {
        if (!cancelled) setOnChainInfo(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingChain(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTokenId, activeTitles.length]);

  const canSignOnChain = Boolean(
    walletAddress && walletBalances?.hasGovernorRole
  );

  async function handleExecuteRevocation(e: FormEvent) {
    e.preventDefault();
    if (!selectedTitle) return;

    setError(null);
    setSuccessRecord(null);
    setSubmitting(true);

    try {
      let txHash: string | null = null;
      let callerAddress: string | null = walletAddress;

      if (canSignOnChain) {
        setStepStatus(
          `Awaiting MetaMask signature for LandTitleNFT.revoke(#${selectedTitle.token_id}, ${ground}) on Polygon Amoy…`
        );
        const receipt = await executeLandTitleRevocation(
          selectedTitle.token_id,
          ground
        );
        txHash = receipt.txHash;
        callerAddress = receipt.callerAddress;
        setStepStatus(
          `Confirmed in block #${receipt.blockNumber}. Recording statutory revocation in Supabase…`
        );
      } else {
        throw new Error(
          'Connect a MetaMask wallet holding GOVERNOR_ROLE on LandTitleNFT to execute Section 28 on-chain revocation on Polygon Amoy (80002).'
        );
      }

      const record = await onRecordRevocation({
        tokenId: selectedTitle.token_id,
        parcelId: selectedTitle.parcel_id,
        ground,
        gazetteNumber: gazetteNumber.trim(),
        publicPurposeDetails: publicPurposeDetails.trim(),
        compensationAmount: Number(compensationAmount || 0),
        compensationDisbursed,
        txHash,
        revokedByWallet: callerAddress,
      });

      setSuccessRecord(record);
      setGazetteNumber('');
      setPublicPurposeDetails('');
      setCompensationAmount('');
      setCompensationDisbursed(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to execute statutory revocation.'
      );
    } finally {
      setSubmitting(false);
      setStepStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Authority & Role Check Banner */}
      <div className="rounded-2xl bg-[#FAFDF8] border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-sm font-display font-bold text-slate-900">
            Land Use Act 1978 — Section 28 Statutory Revocation Execution
          </h2>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Executes <span className="font-mono">LandTitleNFT.revoke(tokenId, ground)</span>{' '}
            on Polygon Amoy (<span className="font-mono">80002</span>) using your
            authorized <span className="font-mono">GOVERNOR_ROLE</span> signer,
            then atomically updates <span className="font-mono">statutory_revocations</span>,{' '}
            <span className="font-mono">parcels</span>,{' '}
            <span className="font-mono">land_titles</span>, and{' '}
            <span className="font-mono">audit_logs</span>.
          </p>
        </div>

        <div className="text-xs">
          {!walletAddress ? (
            <button
              type="button"
              onClick={onConnectWallet}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Governor Wallet</span>
            </button>
          ) : walletBalances?.hasGovernorRole ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>
                GOVERNOR_ROLE verified ({shortenAddress(walletAddress)})
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-medium">
              <ShieldAlert className="w-4 h-4" />
              <span>
                Wallet {shortenAddress(walletAddress)} lacks GOVERNOR_ROLE on{' '}
                {shortenAddress(CONTRACT_ADDRESSES.LandTitleNFT)}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-800 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {stepStatus && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 font-medium">
          {stepStatus}
        </div>
      )}

      {successRecord && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 space-y-1">
          <p className="font-semibold">
            Section 28 Statutory Revocation Executed &amp; Gazetted
          </p>
          <p>
            Token <span className="font-mono">#{successRecord.token_id}</span> ·
            Gazette <span className="font-mono">{successRecord.gazette_number}</span>
            {successRecord.tx_hash && (
              <>
                {' · '}
                <a
                  href={`${POLYGON_AMOY_NETWORK.blockExplorerUrl}/tx/${successRecord.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-800 underline inline-flex items-center gap-1"
                >
                  <span>{shortenHash(successRecord.tx_hash)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form */}
        <form
          onSubmit={handleExecuteRevocation}
          className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-5"
        >
          <div>
            <label
              htmlFor="revocation-token-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Active Minted Land Title (Token ID)
            </label>
            <select
              id="revocation-token-select"
              value={selectedTitle?.token_id || ''}
              onChange={(e) => setSelectedTokenId(e.target.value)}
              disabled={loading || activeTitles.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            >
              {activeTitles.length === 0 ? (
                <option value="">No active minted titles available</option>
              ) : (
                activeTitles.map((t) => (
                  <option key={t.token_id} value={t.token_id}>
                    Token #{t.token_id} — {t.parcel_code || t.parcel_title} (
                    {t.lga_name || 'N/A'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Statutory Ground (Land Use Act 1978)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {REVOCATION_GROUNDS.map((g) => {
                const active = ground === g.index;
                return (
                  <button
                    key={g.index}
                    type="button"
                    onClick={() => setGround(g.index)}
                    className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'border-emerald-700 bg-emerald-50/70'
                        : 'border-slate-200 bg-white hover:bg-[#FAFDF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-emerald-800">
                        Ground {g.index} · {g.section}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-900">
                      {g.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
                      {g.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="gazette-number"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Official Gazette Number
              </label>
              <input
                id="gazette-number"
                type="text"
                required
                placeholder="GAZ-2026-SEC28-041"
                value={gazetteNumber}
                onChange={(e) => setGazetteNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label
                htmlFor="compensation-amount"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Statutory Compensation (USD / ANAGU Equivalent)
              </label>
              <input
                id="compensation-amount"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="125000"
                value={compensationAmount}
                onChange={(e) => setCompensationAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="public-purpose-details"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Public Purpose &amp; Executive Order Details
            </label>
            <textarea
              id="public-purpose-details"
              rows={3}
              required
              placeholder="Specify the overriding public purpose, infrastructure alignment, or breach citation under Section 28…"
              value={publicPurposeDetails}
              onChange={(e) => setPublicPurposeDetails(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={compensationDisbursed}
              onChange={(e) => setCompensationDisbursed(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
            />
            <span>
              Mark statutory compensation as already disbursed upon issuance
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !selectedTitle || !canSignOnChain}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Gavel className="w-4 h-4" />
            <span>
              {submitting
                ? 'Executing On-Chain Revocation…'
                : 'Execute LandTitleNFT.revoke() & Gazette Revocation'}
            </span>
          </button>
        </form>

        {/* Right Live On-Chain Title Inspection */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-display font-bold text-slate-900">
            Selected Title &amp; Live Polygon Amoy State
          </h3>

          {!selectedTitle ? (
            <p className="text-xs text-slate-500">
              No active minted titles available in Supabase.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-[#FAFDF8] border border-slate-200 space-y-1.5">
                <p className="font-mono font-semibold text-emerald-800">
                  Token #{selectedTitle.token_id}
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedTitle.parcel_title || selectedTitle.parcel_code}
                </p>
                <p className="text-slate-600">
                  {selectedTitle.lga_name || '—'}
                  {selectedTitle.state_name ? `, ${selectedTitle.state_name}` : ''}
                </p>
                <p className="text-slate-600">
                  Valuation:{' '}
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {selectedTitle.valuation_usd != null
                      ? formatUsd(selectedTitle.valuation_usd)
                      : '—'}
                  </span>
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <p className="font-semibold text-slate-800">
                  On-Chain Contract Verification
                </p>
                {checkingChain ? (
                  <p className="text-slate-500">
                    Querying LandTitleNFT ({shortenAddress(CONTRACT_ADDRESSES.LandTitleNFT)})…
                  </p>
                ) : onChainInfo ? (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">ownerOf:</span>
                      <span className="text-slate-900">
                        {shortenAddress(onChainInfo.ownerOf)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">isRevoked:</span>
                      <span
                        className={
                          onChainInfo.isRevoked
                            ? 'text-red-700 font-semibold'
                            : 'text-emerald-700 font-semibold'
                        }
                      >
                        {String(onChainInfo.isRevoked)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">parcelId (b32):</span>
                      <span className="text-slate-700">
                        {shortenHash(onChainInfo.parcelIdBytes32)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">spatialHash:</span>
                      <span className="text-slate-700">
                        {shortenHash(onChainInfo.spatialHashBytes32)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">
                    Token #{selectedTitle.token_id} not yet queried or not found
                    on LandTitleNFT.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
