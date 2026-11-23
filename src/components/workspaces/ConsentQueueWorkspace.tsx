import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  MapPin,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { formatDateTime, formatUsd, shortenAddress } from '../../lib/api';
import { ANAGU_CONFIG } from '../../lib/contracts';
import type { ParcelConsentItem } from '../../lib/types';

interface ConsentQueueWorkspaceProps {
  items: ParcelConsentItem[];
  loading: boolean;
  searchQuery: string;
  onGrantConsent: (parcelId: string, notes: string) => Promise<void>;
  onReturnToRegistrar: (parcelId: string, notes: string) => Promise<void>;
}

function PolygonGeometryPreview({
  geometry,
  coordinates,
}: {
  geometry: unknown;
  coordinates: unknown;
}) {
  const points = useMemo(() => {
    const raw =
      (geometry as any)?.coordinates ??
      (coordinates as any)?.coordinates ??
      coordinates;
    if (!Array.isArray(raw)) return null;
    const ring = Array.isArray(raw[0]?.[0])
      ? raw[0][0]
      : Array.isArray(raw[0])
        ? raw[0]
        : raw;
    if (!Array.isArray(ring) || ring.length < 3) return null;
    const coords = ring
      .map((pt: any) =>
        Array.isArray(pt) && pt.length >= 2
          ? [Number(pt[0]), Number(pt[1])]
          : pt && typeof pt === 'object' && 'lng' in pt && 'lat' in pt
            ? [Number(pt.lng), Number(pt.lat)]
            : null
      )
      .filter((p): p is [number, number] => Boolean(p && Number.isFinite(p[0]) && Number.isFinite(p[1])));

    if (coords.length < 3) return null;
    const xs = coords.map((c) => c[0]);
    const ys = coords.map((c) => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 0.001;
    const spanY = maxY - minY || 0.001;

    return coords
      .map(([x, y]) => {
        const nx = 16 + ((x - minX) / spanX) * 188;
        const ny = 124 - ((y - minY) / spanY) * 108;
        return `${nx.toFixed(1)},${ny.toFixed(1)}`;
      })
      .join(' ');
  }, [geometry, coordinates]);

  if (!points) {
    return (
      <div className="h-36 rounded-xl bg-[#FAFDF8] border border-slate-200 flex items-center justify-center text-xs text-slate-500">
        PostGIS polygon geometry synced via Cadastral GIS Explorer
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 220 140"
      className="w-full h-36 rounded-xl bg-[#FAFDF8] border border-slate-200"
      aria-label="Parcel GIS Boundary Preview"
    >
      <polygon
        points={points}
        fill="#DFF9CA"
        stroke="#1B7311"
        strokeWidth="2"
      />
    </svg>
  );
}

export function ConsentQueueWorkspace({
  items,
  loading,
  searchQuery,
  onGrantConsent,
  onReturnToRegistrar,
}: ConsentQueueWorkspaceProps) {
  const [filter, setFilter] = useState<
    'pending' | 'granted' | 'returned' | 'all'
  >('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const status = String(item.governor_consent_status || '').toUpperCase();
      if (filter === 'pending' && status !== 'GOVERNOR_CONSENT_PENDING') {
        return false;
      }
      if (filter === 'granted' && status !== 'GOVERNOR_CONSENT_GRANTED') {
        return false;
      }
      if (filter === 'returned' && status !== 'RETURNED_TO_REGISTRAR') {
        return false;
      }
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        (item.parcel_code || '').toLowerCase().includes(q) ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.lga_name || '').toLowerCase().includes(q) ||
        (item.owner_name || '').toLowerCase().includes(q)
      );
    });
  }, [items, filter, searchQuery]);

  const selected = useMemo(
    () =>
      filtered.find((i) => i.id === selectedId) ||
      filtered[0] ||
      null,
    [filtered, selectedId]
  );

  async function handleGrant() {
    if (!selected) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await onGrantConsent(selected.id, notes);
      setNotes('');
      setFeedback({
        type: 'success',
        text: `Governor's Consent granted for ${selected.parcel_code || selected.id}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Consent grant failed.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReturn() {
    if (!selected) return;
    if (!notes.trim()) {
      setFeedback({
        type: 'error',
        text: 'Enter executive review notes explaining why the parcel is returned to the Registrar.',
      });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await onReturnToRegistrar(selected.id, notes.trim());
      setNotes('');
      setFeedback({
        type: 'success',
        text: `Parcel ${selected.parcel_code || selected.id} returned to Registrar.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Return action failed.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Segmented Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {(
            [
              ['pending', 'Pending Consent'],
              ['granted', 'Consent Granted'],
              ['returned', 'Returned'],
              ['all', 'All Parcels'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500 font-mono tabular-nums">
          {filtered.length} parcel{filtered.length === 1 ? '' : 's'} shown
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Queue Table */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-[#FAFDF8]">
            <h2 className="text-xs font-semibold text-slate-700">
              Registrar-Verified Cadastral Queue
            </h2>
          </div>

          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 text-center">
                Loading cadastral consent queue…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-xs text-slate-500 text-center">
                No parcels match the selected Governor consent filter.
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setFeedback(null);
                    }}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      isSelected ? 'bg-emerald-50/70' : 'hover:bg-[#FAFDF8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-emerald-800">
                        {item.parcel_code || item.id.slice(0, 8)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {item.governor_consent_status || item.status || 'PENDING'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 truncate">
                      <span>{item.lga_name || 'LGA Unspecified'}</span>
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span className="font-mono tabular-nums">
                        {item.area_sqm ? `${item.area_sqm.toLocaleString()} sqm` : 'Area N/A'}
                      </span>
                      {item.valuation_usd != null && (
                        <>
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatUsd(item.valuation_usd)}
                          </span>
                        </>
                      )}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Inspection Dossier */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
          {!selected ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Select a parcel from the queue to inspect survey geometry,
              statutory deeds, dual-tenure scores, and execute Governor’s Consent.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <p className="text-xs font-mono text-emerald-700 font-semibold">
                    {selected.parcel_code || selected.id}
                    {selected.consent_reference
                      ? ` · Ref: ${selected.consent_reference}`
                      : ''}
                  </p>
                  <h2 className="mt-1 text-xl font-display font-bold text-slate-900">
                    {selected.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    <span>
                      {selected.district ? `${selected.district}, ` : ''}
                      {selected.lga_name || '—'}
                      {selected.state_name ? `, ${selected.state_name}` : ''}
                    </span>
                    <span aria-hidden="true" className="mx-1.5">
                      ·
                    </span>
                    <span>Owner: {selected.owner_name || shortenAddress(selected.owner_wallet)}</span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] text-slate-500">Status</p>
                  <p className="text-xs font-mono font-semibold text-slate-900">
                    {selected.governor_consent_status || selected.status || '—'}
                  </p>
                  {selected.valuation_usd != null && (
                    <p className="mt-1 text-xs font-mono tabular-nums text-emerald-800 font-semibold">
                      {formatUsd(selected.valuation_usd)}
                    </p>
                  )}
                </div>
              </div>

              {/* GIS Coordinates & Dual-Tenure Scores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    <span>GIS Survey Geometry &amp; Coordinates</span>
                  </h3>
                  <PolygonGeometryPreview
                    geometry={selected.geometry}
                    coordinates={selected.survey?.coordinates}
                  />
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <p>
                      Centroid:{' '}
                      <span className="font-mono tabular-nums text-slate-900">
                        {selected.centroid
                          ? `${selected.centroid.lat.toFixed(6)}, ${selected.centroid.lng.toFixed(6)}`
                          : 'See GIS Explorer'}
                      </span>
                    </p>
                    <p>
                      Survey Plan:{' '}
                      <span className="font-mono text-slate-900">
                        {selected.survey?.survey_plan_no || '—'}
                      </span>
                      {selected.survey?.surveyor_name
                        ? ` · ${selected.survey.surveyor_name}`
                        : ''}
                    </p>
                    <p className="truncate">
                      Metadata URI:{' '}
                      <span className="font-mono text-[11px] text-slate-700">
                        {ANAGU_CONFIG.metadataUriBase}/{selected.id}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Dual-Tenure Ownership Verification</span>
                  </h3>
                  <div className="rounded-xl bg-[#FAFDF8] border border-slate-200 p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Statutory Tenure Score</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {selected.verification?.statutory_score != null
                          ? `${selected.verification.statutory_score}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Customary Tenure Score</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {selected.verification?.customary_score != null
                          ? `${selected.verification.customary_score}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-medium text-slate-700">
                        Composite Verification
                      </span>
                      <span className="font-mono tabular-nums font-bold text-emerald-800">
                        {selected.verification?.overall_score != null
                          ? `${selected.verification.overall_score}%`
                          : selected.verification?.dual_tenure_status || 'Verified'}
                      </span>
                    </div>
                    {selected.verification?.verifier_notes && (
                      <p className="pt-1 text-slate-600 leading-relaxed">
                        {selected.verification.verifier_notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Statutory Documents */}
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Statutory Documents (Supabase Documents Bucket)</span>
                </h3>
                {selected.documents.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No statutory documents attached to this parcel record.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {selected.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs bg-white hover:bg-[#FAFDF8]"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {doc.title || doc.file_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {doc.document_type || 'Statutory Filing'}
                            {doc.uploaded_at
                              ? ` · ${formatDateTime(doc.uploaded_at)}`
                              : ''}
                          </p>
                        </div>
                        {doc.public_url ? (
                          <a
                            href={doc.public_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium whitespace-nowrap shrink-0"
                          >
                            <span>Preview</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400">Unavailable</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approval Trail */}
              {selected.approvals.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">
                    Registrar &amp; Executive Approval History
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    {selected.approvals.map((app) => (
                      <div
                        key={app.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0"
                      >
                        <span className="font-mono text-slate-800 font-medium">
                          {app.stage}
                        </span>
                        <span className="text-slate-600">
                          {app.notes || app.consent_reference || 'Recorded'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {formatDateTime(app.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Executive Action Form */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <label
                  htmlFor="governor-consent-notes"
                  className="block text-xs font-medium text-slate-700"
                >
                  Executive Consent Remarks / Return Directive
                </label>
                <textarea
                  id="governor-consent-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional executive consent endorsement notes, or required reason if returning to Registrar…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      selected.governor_consent_status ===
                        'GOVERNOR_CONSENT_GRANTED'
                    }
                    onClick={handleGrant}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selected.governor_consent_status ===
                      'GOVERNOR_CONSENT_GRANTED'
                        ? 'Governor Consent Already Granted'
                        : submitting
                          ? 'Recording Consent…'
                          : "Grant Governor's Consent"}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReturn}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Return to Registrar</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
