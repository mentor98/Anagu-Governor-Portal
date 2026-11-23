import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANAGU_CONFIG, REVOCATION_GROUNDS } from '../src/lib/contracts.ts';
import type {
  AuditLogEntry,
  DisputedOversightItem,
  EligibleTitleItem,
  HighValueTransferItem,
  NotificationItem,
  OverviewMetrics,
  ParcelApprovalRecord,
  ParcelConsentItem,
  StatutoryDocument,
  StatutoryRevocationRecord,
  SurveyData,
  OwnershipVerification,
} from '../src/lib/types.ts';

const SUPABASE_URL =
  process.env.SUPABASE_URL || ANAGU_CONFIG.supabaseUrl;

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

export function isSupabaseConfigured(): boolean {
  return getServiceRoleKey().trim().length > 0;
}

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';

export function getSupabaseAdmin(): SupabaseClient {
  const key = getServiceRoleKey().trim();
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Add it in Settings -> Secrets.'
    );
  }
  if (!cachedClient || cachedKey !== key) {
    cachedClient = createClient(SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedKey = key;
  }
  return cachedClient;
}

export interface StaffAccountRow {
  id: string;
  staff_id: string;
  role: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  passcode_hash?: string | null;
  jurisdiction?: string | null;
  state_name?: string | null;
  lga_name?: string | null;
  wallet_address?: string | null;
  is_active: boolean;
  last_login_at?: string | null;
}

async function safeSelect(
  table: string,
  configure?: (q: any) => any
): Promise<Record<string, any>[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from(table).select('*');
  if (configure) {
    query = configure(query);
  }
  const { data, error } = await query;
  if (error) {
    // Gracefully return empty if optional table is not yet provisioned
    if (
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message?.includes('does not exist')
    ) {
      return [];
    }
    throw new Error(`Supabase query failed on ${table}: ${error.message}`);
  }
  return (data as Record<string, any>[]) || [];
}

export async function getStaffAccountById(
  staffId: string
): Promise<StaffAccountRow | null> {
  const sb = getSupabaseAdmin();
  const normalized = staffId.trim().toUpperCase();
  const { data, error } = await sb
    .from('staff_accounts')
    .select('*')
    .eq('staff_id', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to query staff_accounts: ${error.message}`);
  }
  return (data as StaffAccountRow | null) || null;
}

export async function updateStaffLastLogin(staffId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb
    .from('staff_accounts')
    .update({ last_login_at: new Date().toISOString() })
    .eq('staff_id', staffId);
}

export async function writeAuditLog(entry: {
  actor_id?: string | null;
  actor_staff_id?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  tx_hash?: string | null;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  const payload = {
    actor_id: entry.actor_id ?? null,
    actor_staff_id: entry.actor_staff_id ?? null,
    actor_role: entry.actor_role ?? 'governor',
    action: entry.action,
    entity_type: entry.entity_type ?? null,
    entity_id: entry.entity_id ?? null,
    tx_hash: entry.tx_hash ?? null,
    details: entry.details ?? {},
  };
  const { error } = await sb.from('audit_logs').insert(payload);
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
    console.warn('audit_logs insert warning:', error.message);
  }
}

export async function createNotification(entry: {
  recipient_id?: string | null;
  recipient_role?: string | null;
  title: string;
  message: string;
  category?: string | null;
  related_parcel_id?: string | null;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('notifications').insert({
    recipient_id: entry.recipient_id ?? null,
    recipient_role: entry.recipient_role ?? 'landowner',
    title: entry.title,
    message: entry.message,
    category: entry.category ?? 'governor_action',
    is_read: false,
    related_parcel_id: entry.related_parcel_id ?? null,
  });
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
    console.warn('notifications insert warning:', error.message);
  }
}

function buildPublicDocumentUrl(doc: Record<string, any>): string {
  if (typeof doc.public_url === 'string' && doc.public_url.startsWith('http')) {
    return doc.public_url;
  }
  if (typeof doc.file_url === 'string' && doc.file_url.startsWith('http')) {
    return doc.file_url;
  }
  const storagePath = String(doc.storage_path || doc.file_path || '').replace(
    /^\/+/,
    ''
  );
  if (!storagePath) return '';
  return `${ANAGU_CONFIG.publicDocumentBaseUrl}/${storagePath}`;
}

function extractCentroid(
  parcel: Record<string, any>,
  survey: Record<string, any> | null
): { lat: number; lng: number } | null {
  const lat = Number(
    parcel.latitude ?? parcel.center_lat ?? survey?.center_lat ?? NaN
  );
  const lng = Number(
    parcel.longitude ?? parcel.center_lng ?? survey?.center_lng ?? NaN
  );
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  const geom = parcel.geometry ?? survey?.geojson ?? survey?.coordinates;
  if (geom && typeof geom === 'object') {
    const coords = (geom as any).coordinates;
    if (Array.isArray(coords)) {
      const ring = Array.isArray(coords[0]?.[0])
        ? coords[0][0]
        : Array.isArray(coords[0])
          ? coords[0]
          : coords;
      if (Array.isArray(ring) && ring.length > 0 && Array.isArray(ring[0])) {
        const first = ring[0];
        if (typeof first[0] === 'number' && typeof first[1] === 'number') {
          return { lat: first[1], lng: first[0] };
        }
      }
    }
  }
  return null;
}

export async function getWorkflowThresholdUsd(): Promise<number> {
  const settings = await safeSelect('system_settings');
  for (const row of settings) {
    const rules =
      row.workflow_rules ||
      (row.key === 'workflow_rules' ? row.value : null) ||
      (row.setting_key === 'workflow_rules' ? row.setting_value : null);
    if (rules && typeof rules === 'object') {
      const val = Number((rules as any).governorConsentThresholdUsd);
      if (Number.isFinite(val) && val > 0) {
        return val;
      }
    }
  }
  return 250000; // Statutory default if setting row not yet initialized
}

export async function getOverviewData(): Promise<OverviewMetrics> {
  const [
    parcels,
    landTitles,
    revocations,
    tickets,
    auditLogs,
    thresholdUsd,
  ] = await Promise.all([
    safeSelect('parcels'),
    safeSelect('land_titles'),
    safeSelect('statutory_revocations'),
    safeSelect('support_tickets'),
    safeSelect('audit_logs', (q) =>
      q.order('created_at', { ascending: false }).limit(12)
    ),
    getWorkflowThresholdUsd(),
  ]);

  const pendingConsentCount = parcels.filter(
    (p) => p.governor_consent_status === 'GOVERNOR_CONSENT_PENDING'
  ).length;

  const activeTokenizedTitles =
    landTitles.length > 0
      ? landTitles.filter(
          (t) =>
            !t.is_revoked &&
            String(t.status || '').toLowerCase() !== 'revoked'
        ).length
      : parcels.filter((p) => p.nft_token_id != null && !p.is_revoked).length;

  const totalCompensationUsd = revocations.reduce(
    (sum, r) => sum + (Number(r.compensation_amount) || 0),
    0
  );
  const disbursedCompensationUsd = revocations.reduce(
    (sum, r) =>
      sum + (r.compensation_disbursed ? Number(r.compensation_amount) || 0 : 0),
    0
  );

  const highValuePendingCount = parcels.filter((p) => {
    const val = Number(p.valuation_usd ?? p.declared_value_usd ?? 0);
    const pendingTransfer =
      p.transfer_status === 'PENDING_GOVERNOR_COSIGN' ||
      p.governor_consent_status === 'HIGH_VALUE_TRANSFER_PENDING';
    return pendingTransfer || (val >= thresholdUsd && !p.governor_cosigned);
  }).length;

  const disputedParcelIds = new Set(
    parcels
      .filter(
        (p) =>
          String(p.status || '').toLowerCase() === 'disputed' ||
          String(p.title_status || '').toUpperCase() === 'ESCROW_LOCKED'
      )
      .map((p) => String(p.id))
  );
  const escalatedTickets = tickets.filter(
    (t) =>
      String(t.status || '').toLowerCase() === 'escalated' ||
      String(t.escalated_to || '').toLowerCase() === 'governor'
  );

  return {
    totalParcels: parcels.length,
    pendingConsentCount,
    activeTokenizedTitles,
    revocationsCount: revocations.length,
    totalCompensationUsd,
    disbursedCompensationUsd,
    highValuePendingCount,
    disputedCount: disputedParcelIds.size + escalatedTickets.length,
    thresholdUsd,
    recentActions: auditLogs.map((a) => ({
      id: String(a.id),
      actor_id: a.actor_id ?? null,
      actor_staff_id: a.actor_staff_id ?? null,
      actor_role: a.actor_role ?? null,
      action: String(a.action || 'EXECUTIVE_ACTION'),
      entity_type: a.entity_type ?? null,
      entity_id: a.entity_id ?? null,
      tx_hash: a.tx_hash ?? null,
      details: a.details ?? null,
      created_at: String(a.created_at || new Date().toISOString()),
    })),
  };
}

export async function getConsentQueueData(): Promise<ParcelConsentItem[]> {
  const [parcels, approvals, documents, surveys, verifications] =
    await Promise.all([
      safeSelect('parcels', (q) => q.order('updated_at', { ascending: false })),
      safeSelect('parcel_approvals', (q) =>
        q.order('created_at', { ascending: false })
      ),
      safeSelect('statutory_documents'),
      safeSelect('survey_data'),
      safeSelect('ownership_verifications'),
    ]);

  const approvalMap = new Map<string, ParcelApprovalRecord[]>();
  for (const a of approvals) {
    const pid = String(a.parcel_id || '');
    if (!pid) continue;
    const list = approvalMap.get(pid) || [];
    list.push({
      id: String(a.id),
      parcel_id: pid,
      stage: String(a.stage || 'registrar_verified'),
      approved_by: a.approved_by ?? null,
      governor_staff_id: a.governor_staff_id ?? null,
      consent_reference: a.consent_reference ?? null,
      tx_hash: a.tx_hash ?? null,
      token_id: a.token_id ?? null,
      notes: a.notes ?? null,
      created_at: a.created_at ?? null,
    });
    approvalMap.set(pid, list);
  }

  const docMap = new Map<string, StatutoryDocument[]>();
  for (const d of documents) {
    const pid = String(d.parcel_id || '');
    if (!pid) continue;
    const list = docMap.get(pid) || [];
    list.push({
      id: String(d.id),
      parcel_id: pid,
      document_type: d.document_type ?? d.category ?? 'Statutory Deed',
      title: d.title ?? d.file_name ?? 'Statutory Document',
      file_name: d.file_name ?? null,
      storage_path: d.storage_path ?? null,
      public_url: buildPublicDocumentUrl(d),
      mime_type: d.mime_type ?? null,
      uploaded_at: d.created_at ?? d.uploaded_at ?? null,
      verified: typeof d.verified === 'boolean' ? d.verified : null,
    });
    docMap.set(pid, list);
  }

  const surveyMap = new Map<string, SurveyData>();
  for (const s of surveys) {
    const pid = String(s.parcel_id || '');
    if (!pid) continue;
    surveyMap.set(pid, {
      id: String(s.id),
      parcel_id: pid,
      beacon_numbers: s.beacon_numbers ?? null,
      coordinates: s.coordinates ?? s.boundary_points ?? null,
      geojson: s.geojson ?? null,
      area_sqm: s.area_sqm != null ? Number(s.area_sqm) : null,
      surveyor_name: s.surveyor_name ?? null,
      survey_plan_no: s.survey_plan_no ?? null,
      spatial_hash: s.spatial_hash ?? null,
      verified_at: s.verified_at ?? s.created_at ?? null,
    });
  }

  const verificationMap = new Map<string, OwnershipVerification>();
  for (const v of verifications) {
    const pid = String(v.parcel_id || '');
    if (!pid) continue;
    verificationMap.set(pid, {
      id: String(v.id),
      parcel_id: pid,
      statutory_score:
        v.statutory_score != null ? Number(v.statutory_score) : null,
      customary_score:
        v.customary_score != null ? Number(v.customary_score) : null,
      overall_score: v.overall_score != null ? Number(v.overall_score) : null,
      dual_tenure_status: v.dual_tenure_status ?? v.status ?? null,
      verifier_notes: v.verifier_notes ?? v.notes ?? null,
      verified_by: v.verified_by ?? null,
      created_at: v.created_at ?? null,
    });
  }

  return parcels.map((p) => {
    const pid = String(p.id);
    const surveyRaw = surveys.find((s) => String(s.parcel_id) === pid) || null;
    return {
      id: pid,
      parcel_code: p.parcel_code ?? p.cadastral_id ?? p.parcel_number ?? pid.slice(0, 8),
      title: p.title ?? p.name ?? p.plot_number ?? `Parcel ${pid.slice(0, 8)}`,
      plot_number: p.plot_number ?? null,
      state_name: p.state_name ?? p.state ?? null,
      lga_name: p.lga_name ?? p.lga ?? null,
      district: p.district ?? p.locality ?? null,
      area_sqm: p.area_sqm != null ? Number(p.area_sqm) : null,
      valuation_usd:
        p.valuation_usd != null
          ? Number(p.valuation_usd)
          : p.declared_value_usd != null
            ? Number(p.declared_value_usd)
            : null,
      status: p.status ?? null,
      governor_consent_status: p.governor_consent_status ?? null,
      consent_reference: p.consent_reference ?? null,
      owner_id: p.owner_id ?? p.user_id ?? null,
      owner_name: p.owner_name ?? null,
      owner_email: p.owner_email ?? null,
      owner_wallet: p.owner_wallet ?? p.wallet_address ?? null,
      nft_token_id: p.nft_token_id ?? null,
      spatial_hash: p.spatial_hash ?? surveyRaw?.spatial_hash ?? null,
      geometry: p.geometry ?? surveyRaw?.geojson ?? null,
      centroid: extractCentroid(p, surveyRaw),
      created_at: p.created_at ?? null,
      updated_at: p.updated_at ?? null,
      approvals: approvalMap.get(pid) || [],
      documents: docMap.get(pid) || [],
      survey: surveyMap.get(pid) || null,
      verification: verificationMap.get(pid) || null,
    };
  });
}

export async function grantGovernorConsent(params: {
  parcelId: string;
  governorStaffId: string;
  governorId: string;
  notes?: string;
}): Promise<{ consentReference: string }> {
  const sb = getSupabaseAdmin();
  const { data: parcel, error: fetchErr } = await sb
    .from('parcels')
    .select('*')
    .eq('id', params.parcelId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Failed to fetch parcel: ${fetchErr.message}`);
  }
  if (!parcel) {
    throw new Error('Parcel not found.');
  }

  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const consentReference = `ANAGU-GOV-${year}-${rand}`;

  const { error: updateErr } = await sb
    .from('parcels')
    .update({
      governor_consent_status: 'GOVERNOR_CONSENT_GRANTED',
      consent_reference: consentReference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.parcelId);

  if (updateErr) {
    throw new Error(`Failed to update parcel consent: ${updateErr.message}`);
  }

  const { error: approvalErr } = await sb.from('parcel_approvals').insert({
    parcel_id: params.parcelId,
    stage: 'governor_consent_granted',
    approved_by: params.governorId,
    governor_staff_id: params.governorStaffId,
    consent_reference: consentReference,
    token_id: parcel.nft_token_id ?? null,
    notes:
      params.notes?.trim() ||
      'Executive Governor’s Consent granted under the Land Use Act.',
  });

  if (approvalErr) {
    console.warn('parcel_approvals insert warning:', approvalErr.message);
  }

  await writeAuditLog({
    actor_id: params.governorId,
    actor_staff_id: params.governorStaffId,
    actor_role: 'governor',
    action: 'GOVERNOR_CONSENT_GRANTED',
    entity_type: 'parcel',
    entity_id: params.parcelId,
    details: {
      consent_reference: consentReference,
      parcel_code: parcel.parcel_code ?? null,
      notes: params.notes ?? null,
    },
  });

  await createNotification({
    recipient_id: parcel.owner_id ?? parcel.user_id ?? null,
    recipient_role: 'landowner',
    title: 'Governor’s Consent Granted',
    message: `Executive Consent (${consentReference}) has been granted for parcel ${parcel.parcel_code || params.parcelId}.`,
    category: 'governor_consent',
    related_parcel_id: params.parcelId,
  });

  return { consentReference };
}

export async function returnParcelToRegistrar(params: {
  parcelId: string;
  governorStaffId: string;
  governorId: string;
  notes: string;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('parcels')
    .update({
      governor_consent_status: 'RETURNED_TO_REGISTRAR',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.parcelId);

  if (error) {
    throw new Error(`Failed to return parcel: ${error.message}`);
  }

  await sb.from('parcel_approvals').insert({
    parcel_id: params.parcelId,
    stage: 'governor_returned',
    approved_by: params.governorId,
    governor_staff_id: params.governorStaffId,
    notes: params.notes,
  });

  await writeAuditLog({
    actor_id: params.governorId,
    actor_staff_id: params.governorStaffId,
    actor_role: 'governor',
    action: 'GOVERNOR_CONSENT_RETURNED',
    entity_type: 'parcel',
    entity_id: params.parcelId,
    details: { notes: params.notes },
  });
}

export async function getHighValueTransfers(): Promise<{
  thresholdUsd: number;
  items: HighValueTransferItem[];
}> {
  const [thresholdUsd, parcels, approvals, landTitles, transfers] =
    await Promise.all([
      getWorkflowThresholdUsd(),
      safeSelect('parcels'),
      safeSelect('parcel_approvals'),
      safeSelect('land_titles'),
      safeSelect('title_transfers'),
    ]);

  const titleByParcel = new Map<string, Record<string, any>>();
  for (const t of landTitles) {
    if (t.parcel_id) titleByParcel.set(String(t.parcel_id), t);
  }

  const cosignByParcel = new Map<string, Record<string, any>>();
  for (const a of approvals) {
    if (a.stage === 'high_value_transfer_cosigned' && a.parcel_id) {
      cosignByParcel.set(String(a.parcel_id), a);
    }
  }

  const items: HighValueTransferItem[] = [];

  if (transfers.length > 0) {
    for (const tr of transfers) {
      const val = Number(tr.consideration_usd ?? tr.sale_price_usd ?? 0);
      if (val >= thresholdUsd || tr.requires_governor_cosign) {
        const parcel = parcels.find((p) => String(p.id) === String(tr.parcel_id));
        items.push({
          id: String(tr.id),
          parcel_id: String(tr.parcel_id || ''),
          parcel_code: parcel?.parcel_code ?? tr.parcel_code ?? null,
          parcel_title: parcel?.title ?? tr.parcel_title ?? null,
          state_name: parcel?.state_name ?? null,
          lga_name: parcel?.lga_name ?? null,
          token_id: tr.token_id ?? parcel?.nft_token_id ?? null,
          application_id: tr.application_id ?? null,
          seller_name: tr.seller_name ?? parcel?.owner_name ?? null,
          seller_wallet: tr.seller_wallet ?? parcel?.owner_wallet ?? null,
          buyer_name: tr.buyer_name ?? null,
          buyer_wallet: tr.buyer_wallet ?? null,
          consideration_usd: val,
          threshold_usd: thresholdUsd,
          governor_cosigned: Boolean(tr.governor_cosigned),
          consent_reference: tr.consent_reference ?? null,
          cosigned_by: tr.cosigned_by ?? null,
          cosigned_at: tr.cosigned_at ?? null,
          status: String(tr.status || 'PENDING_GOVERNOR_COSIGN'),
          created_at: tr.created_at ?? null,
        });
      }
    }
  }

  for (const p of parcels) {
    const pid = String(p.id);
    if (items.some((i) => i.parcel_id === pid)) continue;
    const val = Number(p.valuation_usd ?? p.declared_value_usd ?? 0);
    const flagged =
      val >= thresholdUsd ||
      p.transfer_status === 'PENDING_GOVERNOR_COSIGN' ||
      p.governor_consent_status === 'HIGH_VALUE_TRANSFER_PENDING';
    if (!flagged) continue;

    const title = titleByParcel.get(pid);
    const cosign = cosignByParcel.get(pid);
    const cosigned = Boolean(p.governor_cosigned || cosign);

    items.push({
      id: pid,
      parcel_id: pid,
      parcel_code: p.parcel_code ?? p.cadastral_id ?? null,
      parcel_title: p.title ?? p.plot_number ?? `Parcel ${pid.slice(0, 8)}`,
      state_name: p.state_name ?? null,
      lga_name: p.lga_name ?? null,
      token_id: p.nft_token_id ?? title?.token_id ?? null,
      application_id: p.application_id ?? null,
      seller_name: p.owner_name ?? null,
      seller_wallet: p.owner_wallet ?? title?.owner_wallet ?? null,
      buyer_name: p.pending_buyer_name ?? null,
      buyer_wallet: p.pending_buyer_wallet ?? null,
      consideration_usd: val,
      threshold_usd: thresholdUsd,
      governor_cosigned: cosigned,
      consent_reference: cosign?.consent_reference ?? p.consent_reference ?? null,
      cosigned_by: cosign?.governor_staff_id ?? null,
      cosigned_at: cosign?.created_at ?? null,
      status: cosigned
        ? 'COSIGNED_READY_FOR_REGISTRY'
        : String(p.transfer_status || 'PENDING_GOVERNOR_COSIGN'),
      created_at: p.updated_at ?? p.created_at ?? null,
    });
  }

  return { thresholdUsd, items };
}

export async function cosignHighValueTransfer(params: {
  id: string;
  governorStaffId: string;
  governorId: string;
  notes?: string;
}): Promise<{ consentReference: string }> {
  const sb = getSupabaseAdmin();
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const consentReference = `ANAGU-HVX-${year}-${rand}`;

  // Try title_transfers first if table exists, otherwise update parcels directly
  let parcelId = params.id;
  const { data: transferRow, error: trCheckErr } = await sb
    .from('title_transfers')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!trCheckErr && transferRow) {
    parcelId = String(transferRow.parcel_id || params.id);
    await sb
      .from('title_transfers')
      .update({
        governor_cosigned: true,
        consent_reference: consentReference,
        cosigned_by: params.governorStaffId,
        cosigned_at: new Date().toISOString(),
        status: 'COSIGNED_READY_FOR_REGISTRY',
      })
      .eq('id', params.id);
  }

  await sb
    .from('parcels')
    .update({
      governor_cosigned: true,
      consent_reference: consentReference,
      transfer_status: 'COSIGNED_READY_FOR_REGISTRY',
      updated_at: new Date().toISOString(),
    })
    .eq('id', parcelId);

  await sb.from('parcel_approvals').insert({
    parcel_id: parcelId,
    stage: 'high_value_transfer_cosigned',
    approved_by: params.governorId,
    governor_staff_id: params.governorStaffId,
    consent_reference: consentReference,
    notes:
      params.notes?.trim() ||
      'Governor high-value transfer countersignature approved prior to LandRegistry.transferTitle.',
  });

  await writeAuditLog({
    actor_id: params.governorId,
    actor_staff_id: params.governorStaffId,
    actor_role: 'governor',
    action: 'HIGH_VALUE_TRANSFER_COSIGNED',
    entity_type: 'transfer',
    entity_id: params.id,
    details: { parcel_id: parcelId, consent_reference: consentReference },
  });

  return { consentReference };
}

export async function getEligibleTitlesForRevocation(): Promise<
  EligibleTitleItem[]
> {
  const [landTitles, parcels] = await Promise.all([
    safeSelect('land_titles', (q) => q.order('created_at', { ascending: false })),
    safeSelect('parcels'),
  ]);

  const parcelMap = new Map<string, Record<string, any>>();
  for (const p of parcels) {
    parcelMap.set(String(p.id), p);
  }

  const items: EligibleTitleItem[] = [];

  for (const t of landTitles) {
    const tokenId = t.token_id ?? t.nft_token_id;
    if (tokenId == null) continue;
    const p = t.parcel_id ? parcelMap.get(String(t.parcel_id)) : undefined;
    items.push({
      id: String(t.id),
      token_id: String(tokenId),
      parcel_id: t.parcel_id ? String(t.parcel_id) : null,
      parcel_code: p?.parcel_code ?? t.parcel_code ?? null,
      parcel_title: p?.title ?? t.title ?? `Title #${tokenId}`,
      state_name: p?.state_name ?? null,
      lga_name: p?.lga_name ?? null,
      owner_wallet: t.owner_wallet ?? p?.owner_wallet ?? null,
      owner_name: p?.owner_name ?? t.owner_name ?? null,
      valuation_usd:
        p?.valuation_usd != null ? Number(p.valuation_usd) : null,
      status: String(t.status || (t.is_revoked ? 'revoked' : 'active')),
      is_revoked: Boolean(t.is_revoked || p?.is_revoked),
      mint_tx_hash: t.tx_hash ?? t.mint_tx_hash ?? null,
      metadata_uri:
        t.metadata_uri ||
        (t.parcel_id
          ? `${ANAGU_CONFIG.metadataUriBase}/${t.parcel_id}`
          : null),
      issued_at: t.issued_at ?? t.created_at ?? null,
    });
  }

  for (const p of parcels) {
    if (p.nft_token_id == null) continue;
    const tok = String(p.nft_token_id);
    if (items.some((i) => i.token_id === tok)) continue;
    items.push({
      id: String(p.id),
      token_id: tok,
      parcel_id: String(p.id),
      parcel_code: p.parcel_code ?? null,
      parcel_title: p.title ?? `Parcel ${String(p.id).slice(0, 8)}`,
      state_name: p.state_name ?? null,
      lga_name: p.lga_name ?? null,
      owner_wallet: p.owner_wallet ?? null,
      owner_name: p.owner_name ?? null,
      valuation_usd: p.valuation_usd != null ? Number(p.valuation_usd) : null,
      status: String(p.status || (p.is_revoked ? 'revoked' : 'active')),
      is_revoked: Boolean(p.is_revoked),
      mint_tx_hash: p.mint_tx_hash ?? null,
      metadata_uri: `${ANAGU_CONFIG.metadataUriBase}/${p.id}`,
      issued_at: p.created_at ?? null,
    });
  }

  return items;
}

export async function recordStatutoryRevocation(params: {
  tokenId: string;
  parcelId?: string | null;
  ground: number;
  gazetteNumber: string;
  publicPurposeDetails: string;
  compensationAmount: number;
  compensationDisbursed: boolean;
  governorStaffId: string;
  governorId: string;
  revokedByWallet?: string | null;
  txHash?: string | null;
}): Promise<StatutoryRevocationRecord> {
  const sb = getSupabaseAdmin();
  const groundMeta =
    REVOCATION_GROUNDS.find((g) => g.index === params.ground) ||
    REVOCATION_GROUNDS[0];

  const insertPayload = {
    token_id: String(params.tokenId),
    parcel_id: params.parcelId ?? null,
    ground: params.ground,
    gazette_number: params.gazetteNumber.trim(),
    public_purpose_details: params.publicPurposeDetails.trim(),
    compensation_amount: params.compensationAmount,
    compensation_disbursed: params.compensationDisbursed,
    revoked_by: params.governorStaffId,
    tx_hash: params.txHash ?? null,
  };

  const { data: revRow, error: revErr } = await sb
    .from('statutory_revocations')
    .insert(insertPayload)
    .select()
    .single();

  if (revErr) {
    throw new Error(`Failed to record statutory_revocations: ${revErr.message}`);
  }

  // Update parcels atomically
  if (params.parcelId) {
    await sb
      .from('parcels')
      .update({
        status: 'revoked',
        is_revoked: true,
        is_for_sale: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.parcelId);
  } else {
    await sb
      .from('parcels')
      .update({
        status: 'revoked',
        is_revoked: true,
        is_for_sale: false,
        updated_at: new Date().toISOString(),
      })
      .eq('nft_token_id', params.tokenId);
  }

  // Update land_titles
  await sb
    .from('land_titles')
    .update({
      status: 'revoked',
      is_revoked: true,
      revocation_ground: groundMeta.code,
      revoked_at: new Date().toISOString(),
      revocation_tx_hash: params.txHash ?? null,
    })
    .eq('token_id', params.tokenId);

  await writeAuditLog({
    actor_id: params.governorId,
    actor_staff_id: params.governorStaffId,
    actor_role: 'governor',
    action: 'SECTION_28_REVOCATION_EXECUTED',
    entity_type: 'land_title',
    entity_id: params.tokenId,
    tx_hash: params.txHash ?? null,
    details: {
      parcel_id: params.parcelId ?? null,
      ground: params.ground,
      ground_code: groundMeta.code,
      gazette_number: params.gazetteNumber,
      compensation_amount: params.compensationAmount,
      compensation_disbursed: params.compensationDisbursed,
      revoked_by_wallet: params.revokedByWallet ?? null,
    },
  });

  if (params.parcelId) {
    const { data: p } = await sb
      .from('parcels')
      .select('owner_id, user_id, parcel_code')
      .eq('id', params.parcelId)
      .maybeSingle();

    await createNotification({
      recipient_id: p?.owner_id ?? p?.user_id ?? null,
      recipient_role: 'landowner',
      title: 'Statutory Revocation Notice (Sec. 28 Land Use Act)',
      message: `Title #${params.tokenId} (${p?.parcel_code || params.parcelId}) has been revoked under ${groundMeta.label} (${groundMeta.section}). Official Gazette: ${params.gazetteNumber}.`,
      category: 'statutory_revocation',
      related_parcel_id: params.parcelId,
    });
  }

  return {
    id: String(revRow.id),
    token_id: String(revRow.token_id),
    parcel_id: revRow.parcel_id ?? null,
    ground: Number(revRow.ground),
    ground_label: `${groundMeta.label} (${groundMeta.section})`,
    gazette_number: String(revRow.gazette_number),
    public_purpose_details: String(revRow.public_purpose_details),
    compensation_amount: Number(revRow.compensation_amount || 0),
    compensation_disbursed: Boolean(revRow.compensation_disbursed),
    revoked_by: String(revRow.revoked_by),
    revoked_by_wallet: params.revokedByWallet ?? null,
    tx_hash: revRow.tx_hash ?? null,
    created_at: String(revRow.created_at || new Date().toISOString()),
  };
}

export async function getRevocationsLedger(): Promise<
  StatutoryRevocationRecord[]
> {
  const [revocations, parcels] = await Promise.all([
    safeSelect('statutory_revocations', (q) =>
      q.order('created_at', { ascending: false })
    ),
    safeSelect('parcels'),
  ]);

  const parcelMap = new Map<string, Record<string, any>>();
  for (const p of parcels) {
    parcelMap.set(String(p.id), p);
  }

  return revocations.map((r) => {
    const p = r.parcel_id ? parcelMap.get(String(r.parcel_id)) : undefined;
    const gIndex = Number(r.ground ?? 0);
    const groundMeta =
      REVOCATION_GROUNDS.find((g) => g.index === gIndex) ||
      REVOCATION_GROUNDS[0];
    return {
      id: String(r.id),
      token_id: String(r.token_id),
      parcel_id: r.parcel_id ? String(r.parcel_id) : null,
      parcel_code: p?.parcel_code ?? null,
      parcel_title: p?.title ?? null,
      state_name: p?.state_name ?? null,
      lga_name: p?.lga_name ?? null,
      ground: gIndex,
      ground_label: `${groundMeta.label} (${groundMeta.section})`,
      gazette_number: String(r.gazette_number || ''),
      public_purpose_details: String(r.public_purpose_details || ''),
      compensation_amount: Number(r.compensation_amount || 0),
      compensation_disbursed: Boolean(r.compensation_disbursed),
      disbursed_at: r.disbursed_at ?? null,
      settlement_reference: r.settlement_reference ?? null,
      revoked_by: String(r.revoked_by || ''),
      tx_hash: r.tx_hash ?? null,
      created_at: String(r.created_at || new Date().toISOString()),
    };
  });
}

export async function toggleCompensationDisbursement(params: {
  id: string;
  disbursed: boolean;
  settlementReference?: string;
  governorStaffId: string;
  governorId: string;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('statutory_revocations')
    .update({
      compensation_disbursed: params.disbursed,
      disbursed_at: params.disbursed ? new Date().toISOString() : null,
      settlement_reference: params.settlementReference?.trim() || null,
    })
    .eq('id', params.id);

  if (error) {
    throw new Error(`Failed to update disbursement status: ${error.message}`);
  }

  await writeAuditLog({
    actor_id: params.governorId,
    actor_staff_id: params.governorStaffId,
    actor_role: 'governor',
    action: params.disbursed
      ? 'COMPENSATION_DISBURSED'
      : 'COMPENSATION_MARKED_PENDING',
    entity_type: 'statutory_revocation',
    entity_id: params.id,
    details: {
      compensation_disbursed: params.disbursed,
      settlement_reference: params.settlementReference ?? null,
    },
  });
}

export async function getDisputesOversight(): Promise<DisputedOversightItem[]> {
  const [tickets, parcels, landTitles] = await Promise.all([
    safeSelect('support_tickets', (q) =>
      q.order('created_at', { ascending: false })
    ),
    safeSelect('parcels'),
    safeSelect('land_titles'),
  ]);

  const items: DisputedOversightItem[] = [];

  for (const t of tickets) {
    const status = String(t.status || '').toLowerCase();
    const escalated =
      status === 'escalated' ||
      String(t.escalated_to || '').toLowerCase() === 'governor' ||
      status === 'disputed' ||
      status === 'open';
    if (!escalated) continue;
    const parcel = parcels.find((p) => String(p.id) === String(t.parcel_id));
    items.push({
      id: String(t.id),
      source: 'support_ticket',
      ticket_number: t.ticket_number ?? `TKT-${String(t.id).slice(0, 6)}`,
      parcel_id: t.parcel_id ?? null,
      parcel_code: parcel?.parcel_code ?? null,
      token_id: parcel?.nft_token_id ? String(parcel.nft_token_id) : null,
      subject: String(t.subject || t.title || 'Escalated Title Dispute'),
      description: t.description ?? t.message ?? null,
      priority: t.priority ?? 'high',
      status: String(t.status || 'escalated'),
      escalated_by: t.escalated_by ?? 'Registrar',
      owner_wallet: parcel?.owner_wallet ?? null,
      resolution_notes: t.resolution_notes ?? null,
      created_at: String(t.created_at || new Date().toISOString()),
      updated_at: t.updated_at ?? null,
    });
  }

  for (const p of parcels) {
    const pid = String(p.id);
    const isDisputed =
      String(p.status || '').toLowerCase() === 'disputed' ||
      String(p.title_status || '').toUpperCase() === 'ESCROW_LOCKED';
    if (!isDisputed) continue;
    if (items.some((i) => i.parcel_id === pid)) continue;

    items.push({
      id: pid,
      source:
        String(p.title_status || '').toUpperCase() === 'ESCROW_LOCKED'
          ? 'escrow_lock'
          : 'parcel_dispute',
      parcel_id: pid,
      parcel_code: p.parcel_code ?? null,
      token_id: p.nft_token_id ? String(p.nft_token_id) : null,
      subject: `${p.title || p.parcel_code || pid.slice(0, 8)} — ${String(p.title_status || p.status || 'Disputed')}`,
      description: p.dispute_notes ?? 'Flagged for Executive Governor oversight.',
      priority: 'high',
      status: String(p.title_status || p.status || 'disputed'),
      escalated_by: 'Registry System',
      owner_wallet: p.owner_wallet ?? null,
      resolution_notes: null,
      created_at: String(p.updated_at || p.created_at || new Date().toISOString()),
    });
  }

  for (const lt of landTitles) {
    if (String(lt.status || '').toUpperCase() !== 'ESCROW_LOCKED') continue;
    const pid = lt.parcel_id ? String(lt.parcel_id) : null;
    if (pid && items.some((i) => i.parcel_id === pid)) continue;
    items.push({
      id: String(lt.id),
      source: 'escrow_lock',
      parcel_id: pid,
      token_id: lt.token_id ? String(lt.token_id) : null,
      subject: `Token #${lt.token_id} — ESCROW_LOCKED`,
      description: 'Title placed in escrow lock pending dispute resolution.',
      priority: 'high',
      status: 'ESCROW_LOCKED',
      escalated_by: 'Registry Escrow',
      owner_wallet: lt.owner_wallet ?? null,
      created_at: String(lt.updated_at || lt.created_at || new Date().toISOString()),
    });
  }

  return items;
}

export async function resolveDisputeOversight(params: {
  id: string;
  source: 'support_ticket' | 'parcel_dispute' | 'escrow_lock';
  parcelId?: string | null;
  resolutionStatus: string;
  resolutionNotes: string;
  governorStaffId: string;
  governorId: string;
}): Promise<void> {
  const sb = getSupabaseAdmin();

  if (params.source === 'support_ticket') {
    await sb
      .from('support_tickets')
      .update({
        status: params.resolutionStatus,
        resolution_notes: params.resolutionNotes,
        resolved_by: params.governorStaffId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);
  }

  if (params.parcelId && params.resolutionStatus === 'cleared') {
    await sb
      .from('parcels')
      .update({
        status: 'verified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.parcelId);
  }

  await writeAuditLog({
    actor_id: params.governorId,
    actor_staff_id: params.governorStaffId,
    actor_role: 'governor',
    action: 'GOVERNOR_DISPUTE_DIRECTIVE',
    entity_type: params.source,
    entity_id: params.id,
    details: {
      parcel_id: params.parcelId ?? null,
      resolution_status: params.resolutionStatus,
      resolution_notes: params.resolutionNotes,
    },
  });
}

export async function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  const rows = await safeSelect('audit_logs', (q) =>
    q.order('created_at', { ascending: false }).limit(limit)
  );
  return rows.map((a) => ({
    id: String(a.id),
    actor_id: a.actor_id ?? null,
    actor_staff_id: a.actor_staff_id ?? null,
    actor_role: a.actor_role ?? null,
    action: String(a.action || ''),
    entity_type: a.entity_type ?? null,
    entity_id: a.entity_id ?? null,
    tx_hash: a.tx_hash ?? null,
    details: a.details ?? null,
    created_at: String(a.created_at || new Date().toISOString()),
  }));
}

export async function getGovernorNotifications(
  staffId: string
): Promise<NotificationItem[]> {
  const rows = await safeSelect('notifications', (q) =>
    q.order('created_at', { ascending: false }).limit(30)
  );
  return rows
    .filter(
      (n) =>
        !n.recipient_role ||
        n.recipient_role === 'governor' ||
        n.recipient_id === staffId
    )
    .map((n) => ({
      id: String(n.id),
      recipient_id: n.recipient_id ?? null,
      recipient_role: n.recipient_role ?? null,
      title: String(n.title || 'Executive Notice'),
      message: String(n.message || ''),
      category: n.category ?? null,
      is_read: Boolean(n.is_read),
      related_parcel_id: n.related_parcel_id ?? null,
      created_at: String(n.created_at || new Date().toISOString()),
    }));
}

export async function markNotificationsRead(): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_role', 'governor')
    .eq('is_read', false);
}
