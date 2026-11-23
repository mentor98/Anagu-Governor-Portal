import { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Printer,
  X,
} from 'lucide-react';
import { formatDateTime, formatUsd, shortenHash } from '../../lib/api';
import { POLYGON_AMOY_NETWORK, REVOCATION_GROUNDS } from '../../lib/contracts';
import type { StatutoryRevocationRecord } from '../../lib/types';
import { AnaguLogo } from '../BrandMark';

interface GazetteLedgerWorkspaceProps {
  revocations: StatutoryRevocationRecord[];
  loading: boolean;
  searchQuery: string;
  onToggleDisbursement: (
    id: string,
    disbursed: boolean,
    settlementReference?: string
  ) => Promise<void>;
}

export function GazetteLedgerWorkspace({
  revocations,
  loading,
  searchQuery,
  onToggleDisbursement,
}: GazetteLedgerWorkspaceProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [gazettePreview, setGazettePreview] =
    useState<StatutoryRevocationRecord | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const q = searchQuery.trim().toLowerCase();
  const filtered = revocations.filter((r) => {
    if (!q) return true;
    return (
      r.gazette_number.toLowerCase().includes(q) ||
      r.token_id.toLowerCase().includes(q) ||
      (r.parcel_code || '').toLowerCase().includes(q) ||
      r.public_purpose_details.toLowerCase().includes(q) ||
      (r.tx_hash || '').toLowerCase().includes(q)
    );
  });

  const totalCommitted = filtered.reduce(
    (acc, r) => acc + (r.compensation_amount || 0),
    0
  );
  const totalDisbursed = filtered.reduce(
    (acc, r) => acc + (r.compensation_disbursed ? r.compensation_amount || 0 : 0),
    0
  );

  async function handleToggle(item: StatutoryRevocationRecord) {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const nextDisbursed = !item.compensation_disbursed;
      const ref = nextDisbursed
        ? `TREASURY-${new Date().getFullYear()}-${item.token_id}`
        : undefined;
      await onToggleDisbursement(item.id, nextDisbursed, ref);
      setFeedback(
        `Compensation for Gazette ${item.gazette_number} marked ${
          nextDisbursed ? 'Disbursed' : 'Pending Settlement'
        }.`
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Ledger Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500">Gazetted Revocations</p>
          <p className="mt-1 text-2xl font-display font-bold font-mono tabular-nums text-slate-900">
            {filtered.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500">Total Compensation Assessed</p>
          <p className="mt-1 text-2xl font-display font-bold font-mono tabular-nums text-slate-900">
            {formatUsd(totalCommitted)}
          </p>
        </div>
        <div className="rounded-2xl bg-[#FAFDF8] border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500">Compensation Disbursed</p>
          <p className="mt-1 text-2xl font-display font-bold font-mono tabular-nums text-emerald-800">
            {formatUsd(totalDisbursed)}
          </p>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 no-print">
          {feedback}
        </div>
      )}

      {/* Ledger Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#FAFDF8] text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Gazette / Date</th>
                <th className="py-3 px-4">Title / Ground</th>
                <th className="py-3 px-4">Public Purpose</th>
                <th className="py-3 px-4 text-right">Compensation</th>
                <th className="py-3 px-4">Disbursement</th>
                <th className="py-3 px-4">On-Chain Tx</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && revocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-500">
                    Loading statutory gazette ledger…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-500">
                    No Section 28 revocations recorded in the ledger.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const groundMeta =
                    REVOCATION_GROUNDS.find((g) => g.index === r.ground) ||
                    REVOCATION_GROUNDS[0];
                  return (
                    <tr key={r.id} className="hover:bg-[#FAFDF8]">
                      <td className="py-3.5 px-4">
                        <p className="font-mono font-semibold text-slate-900">
                          {r.gazette_number}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatDateTime(r.created_at)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-mono font-semibold text-emerald-800">
                          Token #{r.token_id}
                          {r.parcel_code ? ` · ${r.parcel_code}` : ''}
                        </p>
                        <p className="mt-0.5 text-slate-600">
                          {groundMeta.label} ({groundMeta.section})
                        </p>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-slate-700">
                        <p className="line-clamp-2">{r.public_purpose_details}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatUsd(r.compensation_amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleToggle(r)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer ${
                            r.compensation_disbursed
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          {r.compensation_disbursed && (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {busyId === r.id
                              ? 'Updating…'
                              : r.compensation_disbursed
                                ? 'Disbursed'
                                : 'Pending Settlement'}
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {r.tx_hash ? (
                          <a
                            href={`${POLYGON_AMOY_NETWORK.blockExplorerUrl}/tx/${r.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{shortenHash(r.tx_hash)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setGazettePreview(r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium whitespace-nowrap cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Gazette Notice</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Section 28 Gazette Notice Modal */}
      {gazettePreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between no-print">
              <span className="text-sm font-display font-bold text-slate-900">
                Official Section 28 Gazette Notice
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Gazette Notice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGazettePreview(null)}
                  aria-label="Close Gazette preview"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-sm text-slate-900">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-3">
                  <AnaguLogo size={44} />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      ANAGU Land Administration
                    </p>
                    <h3 className="text-lg font-display font-bold">
                      EXTRAORDINARY OFFICIAL GAZETTE NOTICE
                    </h3>
                  </div>
                </div>
                <div className="text-right font-mono text-xs">
                  <p className="font-bold">{gazettePreview.gazette_number}</p>
                  <p className="text-slate-600">
                    {formatDateTime(gazettePreview.created_at)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <p className="font-semibold text-sm">
                  NOTICE OF REVOCATION OF RIGHT OF OCCUPANCY UNDER SECTION 28 OF
                  THE LAND USE ACT (1978)
                </p>
                <p>
                  Notice is hereby given that in exercise of powers conferred upon
                  the Executive Governor under Section 28 of the Land Use Act,
                  the Statutory Right of Occupancy tokenized as{' '}
                  <span className="font-mono font-semibold">
                    LandTitleNFT #{gazettePreview.token_id}
                  </span>{' '}
                  {gazettePreview.parcel_code
                    ? `(Parcel ${gazettePreview.parcel_code})`
                    : ''}{' '}
                  is hereby revoked on the ground of{' '}
                  <span className="font-semibold">
                    {gazettePreview.ground_label}
                  </span>
                  .
                </p>
                <div className="p-4 rounded-xl bg-[#FAFDF8] border border-slate-200 space-y-2">
                  <p>
                    <span className="font-semibold">Public Purpose Citation:</span>{' '}
                    {gazettePreview.public_purpose_details}
                  </p>
                  <p>
                    <span className="font-semibold">Assessed Compensation:</span>{' '}
                    <span className="font-mono tabular-nums">
                      {formatUsd(gazettePreview.compensation_amount)}
                    </span>{' '}
                    (
                    {gazettePreview.compensation_disbursed
                      ? 'Disbursed'
                      : 'Pending Treasury Settlement'}
                    )
                  </p>
                  <p>
                    <span className="font-semibold">Authorized Signatory:</span>{' '}
                    <span className="font-mono">{gazettePreview.revoked_by}</span>
                  </p>
                  {gazettePreview.tx_hash && (
                    <p>
                      <span className="font-semibold">
                        Polygon Amoy (80002) Tx:
                      </span>{' '}
                      <span className="font-mono break-all">
                        {gazettePreview.tx_hash}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
