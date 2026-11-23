import { useState } from 'react';
import {
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { formatDateTime, formatUsd, shortenHash } from '../../lib/api';
import { POLYGON_AMOY_NETWORK } from '../../lib/contracts';
import type {
  AuditLogEntry,
  OverviewMetrics,
  StatutoryRevocationRecord,
} from '../../lib/types';

interface ReportsAuditWorkspaceProps {
  overview: OverviewMetrics | null;
  revocations: StatutoryRevocationRecord[];
  auditLogs: AuditLogEntry[];
  loading: boolean;
  searchQuery: string;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsv(val: unknown): string {
  const str = String(val ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function ReportsAuditWorkspace({
  overview,
  revocations,
  auditLogs,
  loading,
  searchQuery,
}: ReportsAuditWorkspaceProps) {
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const actionTypes = Array.from(new Set(auditLogs.map((a) => a.action)));
  const q = searchQuery.trim().toLowerCase();

  const filteredLogs = auditLogs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (!q) return true;
    return (
      log.action.toLowerCase().includes(q) ||
      (log.actor_staff_id || '').toLowerCase().includes(q) ||
      (log.entity_id || '').toLowerCase().includes(q) ||
      (log.tx_hash || '').toLowerCase().includes(q)
    );
  });

  function handleExportCsv() {
    const headers = [
      'id',
      'created_at',
      'action',
      'actor_staff_id',
      'actor_role',
      'entity_type',
      'entity_id',
      'tx_hash',
      'details',
    ];
    const rows = filteredLogs.map((l) =>
      [
        l.id,
        l.created_at,
        l.action,
        l.actor_staff_id || '',
        l.actor_role || '',
        l.entity_type || '',
        l.entity_id || '',
        l.tx_hash || '',
        JSON.stringify(l.details || {}),
      ]
        .map(escapeCsv)
        .join(',')
    );
    downloadBlob(
      `anagu-governor-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(','), ...rows].join('\n'),
      'text/csv;charset=utf-8'
    );
  }

  function handleExportJson() {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: overview,
      revocations,
      auditLogs: filteredLogs,
    };
    downloadBlob(
      `anagu-governor-executive-report-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Export Actions */}
      <div className="rounded-2xl bg-[#FAFDF8] border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-sm font-display font-bold text-slate-900">
            Executive Reports &amp; Immutable Audit Trail
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Export verified Governor consent, Section 28 revocation, and
            compensation ledgers for State Executive Council review.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap cursor-pointer"
          >
            <FileJson className="w-4 h-4 text-emerald-700" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Executive Summary</span>
          </button>
        </div>
      </div>

      {/* Printable Summary Snapshot */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-500">Total Parcels</p>
          <p className="mt-1 text-xl font-display font-bold font-mono tabular-nums text-slate-900">
            {overview?.totalParcels ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Pending Consent</p>
          <p className="mt-1 text-xl font-display font-bold font-mono tabular-nums text-emerald-700">
            {overview?.pendingConsentCount ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Sec. 28 Revocations</p>
          <p className="mt-1 text-xl font-display font-bold font-mono tabular-nums text-slate-900">
            {overview?.revocationsCount ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Compensation Committed</p>
          <p className="mt-1 text-xl font-display font-bold font-mono tabular-nums text-slate-900">
            {formatUsd(overview?.totalCompensationUsd ?? 0)}
          </p>
        </div>
      </div>

      {/* Filterable Audit Logs Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-[#FAFDF8] no-print">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-semibold text-slate-800">
              Immutable Audit Log Stream ({filteredLogs.length})
            </span>
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filter audit logs by action"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-700"
          >
            <option value="ALL">All Actions</option>
            {actionTypes.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#FAFDF8] text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Metadata</th>
                <th className="py-3 px-4">Polygonscan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                    Loading audit logs…
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                    No audit log entries match your filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAFDF8]">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {log.actor_staff_id || log.actor_role || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {log.entity_type ? `${log.entity_type}:` : ''}
                      {log.entity_id || '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs font-mono text-[11px] text-slate-500 truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      {log.tx_hash ? (
                        <a
                          href={`${POLYGON_AMOY_NETWORK.blockExplorerUrl}/tx/${log.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{shortenHash(log.tx_hash)}</span>
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
