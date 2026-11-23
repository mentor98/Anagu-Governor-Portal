import { useState } from 'react';
import { CheckCircle2, PenTool } from 'lucide-react';
import { formatDateTime, formatUsd, shortenAddress } from '../../lib/api';
import type { HighValueTransferItem } from '../../lib/types';

interface HighValueCosignWorkspaceProps {
  thresholdUsd: number;
  items: HighValueTransferItem[];
  loading: boolean;
  searchQuery: string;
  onCosign: (id: string, notes?: string) => Promise<void>;
}

export function HighValueCosignWorkspace({
  thresholdUsd,
  items,
  loading,
  searchQuery,
  onCosign,
}: HighValueCosignWorkspaceProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const q = searchQuery.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!q) return true;
    return (
      (item.parcel_code || '').toLowerCase().includes(q) ||
      (item.parcel_title || '').toLowerCase().includes(q) ||
      (item.seller_wallet || '').toLowerCase().includes(q) ||
      (item.buyer_wallet || '').toLowerCase().includes(q) ||
      String(item.token_id || '').includes(q)
    );
  });

  async function handleCosign(item: HighValueTransferItem) {
    setBusyId(item.id);
    setFeedback(null);
    try {
      await onCosign(item.id);
      setFeedback({
        type: 'success',
        text: `Countersigned high-value transfer for ${item.parcel_code || item.parcel_id}. Registry transfer unlocked.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Countersignature failed.',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#FAFDF8] border border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-display font-bold text-slate-900">
            Statutory High-Value Transfer Threshold
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Configured in{' '}
            <span className="font-mono">
              system_settings.workflow_rules.governorConsentThresholdUsd
            </span>
            . Transfers meeting or exceeding this valuation require Governor
            countersignature before{' '}
            <span className="font-mono">LandRegistry.transferTitle</span>{' '}
            execution.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-500">Active Threshold</p>
          <p className="text-xl font-display font-bold font-mono tabular-nums text-emerald-800">
            {formatUsd(thresholdUsd)}
          </p>
        </div>
      </div>

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

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#FAFDF8] text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Parcel / Token</th>
                <th className="py-3 px-4">Seller &rarr; Buyer</th>
                <th className="py-3 px-4 text-right">Consideration</th>
                <th className="py-3 px-4">Status / Reference</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Executive Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                    Loading high-value transfers…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                    No transfers above {formatUsd(thresholdUsd)} require
                    countersignature.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAFDF8]">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">
                        {item.parcel_title || item.parcel_code || item.parcel_id}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {item.parcel_code || item.parcel_id.slice(0, 8)}
                        {item.token_id != null ? ` · Token #${item.token_id}` : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700">
                      <p>From: {item.seller_name || shortenAddress(item.seller_wallet)}</p>
                      <p className="mt-0.5 text-slate-500">
                        To: {item.buyer_name || shortenAddress(item.buyer_wallet)}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatUsd(item.consideration_usd)}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-mono text-[11px] font-semibold text-slate-800">
                        {item.status}
                      </p>
                      {item.consent_reference && (
                        <p className="mt-0.5 font-mono text-[11px] text-emerald-700">
                          {item.consent_reference}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDateTime(item.cosigned_at || item.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.governor_cosigned ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold whitespace-nowrap">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Countersigned</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => handleCosign(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-medium whitespace-nowrap cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>
                            {busyId === item.id
                              ? 'Countersigning…'
                              : 'Countersign Transfer'}
                          </span>
                        </button>
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
