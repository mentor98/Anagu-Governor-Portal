import { useState } from 'react';
import { AlertOctagon, CheckCircle2, Search } from 'lucide-react';
import { apiRequest, formatDateTime, shortenAddress } from '../../lib/api';
import type { DisputedOversightItem, OnChainTitleInfo } from '../../lib/types';

interface DisputesWorkspaceProps {
  items: DisputedOversightItem[];
  loading: boolean;
  searchQuery: string;
  onResolveDispute: (payload: {
    id: string;
    source: 'support_ticket' | 'parcel_dispute' | 'escrow_lock';
    parcelId?: string | null;
    resolutionStatus: string;
    resolutionNotes: string;
  }) => Promise<void>;
}

export function DisputesWorkspace({
  items,
  loading,
  searchQuery,
  onResolveDispute,
}: DisputesWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [chainCheck, setChainCheck] = useState<OnChainTitleInfo | null>(null);
  const [checkingChain, setCheckingChain] = useState(false);

  const q = searchQuery.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!q) return true;
    return (
      item.subject.toLowerCase().includes(q) ||
      (item.ticket_number || '').toLowerCase().includes(q) ||
      (item.parcel_code || '').toLowerCase().includes(q) ||
      (item.token_id || '').toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  const selected =
    filtered.find((i) => i.id === selectedId) || filtered[0] || null;

  async function inspectOnChain(tokenId: string) {
    setCheckingChain(true);
    setChainCheck(null);
    try {
      const info = await apiRequest<OnChainTitleInfo>(
        `/api/blockchain/title/${tokenId}`
      );
      setChainCheck(info);
    } catch {
      setChainCheck(null);
    } finally {
      setCheckingChain(false);
    }
  }

  async function handleResolve() {
    if (!selected) return;
    if (!resolutionNotes.trim()) {
      setFeedback({
        type: 'error',
        text: 'Enter an executive oversight directive before recording resolution.',
      });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await onResolveDispute({
        id: selected.id,
        source: selected.source,
        parcelId: selected.parcel_id,
        resolutionStatus,
        resolutionNotes: resolutionNotes.trim(),
      });
      setResolutionNotes('');
      setFeedback({
        type: 'success',
        text: `Executive directive recorded for ${selected.ticket_number || selected.parcel_code || selected.id}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to record directive.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`rounded-xl p-3.5 text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-[#FAFDF8] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-700">
              Escalated Tickets, Disputed Parcels &amp; Escrow Locks
            </h2>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {filtered.length}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 text-center">
                Loading escalated disputes…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-xs text-slate-500 text-center">
                No disputed parcels, ESCROW_LOCKED titles, or escalated tickets
                pending Governor oversight.
              </div>
            ) : (
              filtered.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setChainCheck(null);
                      setFeedback(null);
                    }}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      active ? 'bg-emerald-50/70' : 'hover:bg-[#FAFDF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-amber-800">
                        {item.ticket_number || item.parcel_code || item.source}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {item.subject}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Escalated by {item.escalated_by || 'Registrar'} ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatDateTime(item.created_at)}
                      </span>
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-5">
          {!selected ? (
            <div className="py-16 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
              <AlertOctagon className="w-6 h-6 text-slate-400" />
              <span>
                Select an escalated parcel or support ticket to issue an
                executive oversight ruling.
              </span>
            </div>
          ) : (
            <>
              <div className="pb-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-amber-800">
                    {selected.ticket_number || selected.source} · {selected.status}
                  </p>
                  <h2 className="mt-1 text-lg font-display font-bold text-slate-900">
                    {selected.subject}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Parcel: <span className="font-mono">{selected.parcel_code || selected.parcel_id || '—'}</span>
                    {selected.token_id ? ` · Token #${selected.token_id}` : ''}
                    {selected.owner_wallet
                      ? ` · Owner ${shortenAddress(selected.owner_wallet)}`
                      : ''}
                  </p>
                </div>

                {selected.token_id && (
                  <button
                    type="button"
                    onClick={() => inspectOnChain(selected.token_id!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-[#FAFDF8] hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>
                      {checkingChain ? 'Checking Amoy…' : 'Verify On-Chain NFT'}
                    </span>
                  </button>
                )}
              </div>

              <div className="rounded-xl bg-[#FAFDF8] border border-slate-200 p-4 text-xs text-slate-700 leading-relaxed">
                {selected.description || 'No escalation details recorded.'}
              </div>

              {chainCheck && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs font-mono space-y-1">
                  <p className="font-semibold text-emerald-900">
                    Polygon Amoy LandTitleNFT #{chainCheck.tokenId}
                  </p>
                  <p>ownerOf: {chainCheck.ownerOf}</p>
                  <p>isRevoked: {String(chainCheck.isRevoked)}</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div>
                  <label
                    htmlFor="dispute-resolution-status"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Executive Determination
                  </label>
                  <select
                    id="dispute-resolution-status"
                    value={resolutionStatus}
                    onChange={(e) => setResolutionStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  >
                    <option value="resolved">
                      Resolved — Issue Final Administrative Ruling
                    </option>
                    <option value="cleared">
                      Cleared — Restore Parcel to Verified Registry Status
                    </option>
                    <option value="stay_of_alienation">
                      Hold — Maintain Administrative Stay of Alienation
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="dispute-resolution-notes"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Governor Directive &amp; Audit Justification
                  </label>
                  <textarea
                    id="dispute-resolution-notes"
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Record formal Governor directive for the Registrar and immutable audit log…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  />
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleResolve}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Recording Directive…'
                      : 'Record Executive Oversight Directive'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
