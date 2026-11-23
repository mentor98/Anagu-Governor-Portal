export type WorkspaceTab =
  | 'overview'
  | 'consent'
  | 'cosign'
  | 'revocations'
  | 'ledger'
  | 'disputes'
  | 'reports';

export interface GovernorProfile {
  id: string;
  staff_id: string;
  role: string;
  full_name: string;
  email: string | null;
  jurisdiction: string | null;
  state_name: string | null;
  lga_name: string | null;
  wallet_address: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

export interface StatutoryDocument {
  id: string;
  parcel_id?: string | null;
  document_type?: string | null;
  title?: string | null;
  file_name?: string | null;
  storage_path?: string | null;
  public_url: string;
  mime_type?: string | null;
  uploaded_at?: string | null;
  verified?: boolean | null;
}

export interface SurveyData {
  id?: string;
  parcel_id?: string | null;
  beacon_numbers?: string[] | string | null;
  coordinates?: unknown;
  geojson?: unknown;
  area_sqm?: number | null;
  surveyor_name?: string | null;
  survey_plan_no?: string | null;
  spatial_hash?: string | null;
  verified_at?: string | null;
}

export interface OwnershipVerification {
  id: string;
  parcel_id?: string | null;
  statutory_score?: number | null;
  customary_score?: number | null;
  overall_score?: number | null;
  dual_tenure_status?: string | null;
  verifier_notes?: string | null;
  verified_by?: string | null;
  created_at?: string | null;
}

export interface ParcelApprovalRecord {
  id: string;
  parcel_id: string;
  stage: string;
  approved_by?: string | null;
  governor_staff_id?: string | null;
  consent_reference?: string | null;
  tx_hash?: string | null;
  token_id?: string | number | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface ParcelConsentItem {
  id: string;
  parcel_code?: string | null;
  title?: string | null;
  plot_number?: string | null;
  state_name?: string | null;
  lga_name?: string | null;
  district?: string | null;
  area_sqm?: number | null;
  valuation_usd?: number | null;
  status?: string | null;
  governor_consent_status?: string | null;
  consent_reference?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_wallet?: string | null;
  nft_token_id?: string | number | null;
  spatial_hash?: string | null;
  geometry?: unknown;
  centroid?: { lat: number; lng: number } | null;
  created_at?: string | null;
  updated_at?: string | null;
  approvals: ParcelApprovalRecord[];
  documents: StatutoryDocument[];
  survey: SurveyData | null;
  verification: OwnershipVerification | null;
}

export interface HighValueTransferItem {
  id: string;
  parcel_id: string;
  parcel_code?: string | null;
  parcel_title?: string | null;
  state_name?: string | null;
  lga_name?: string | null;
  token_id?: string | number | null;
  application_id?: string | null;
  seller_name?: string | null;
  seller_wallet?: string | null;
  buyer_name?: string | null;
  buyer_wallet?: string | null;
  consideration_usd: number;
  threshold_usd: number;
  governor_cosigned: boolean;
  consent_reference?: string | null;
  cosigned_by?: string | null;
  cosigned_at?: string | null;
  status: string;
  created_at?: string | null;
}

export interface EligibleTitleItem {
  id: string;
  token_id: string;
  parcel_id: string | null;
  parcel_code?: string | null;
  parcel_title?: string | null;
  state_name?: string | null;
  lga_name?: string | null;
  owner_wallet?: string | null;
  owner_name?: string | null;
  valuation_usd?: number | null;
  status: string;
  is_revoked: boolean;
  mint_tx_hash?: string | null;
  metadata_uri?: string | null;
  issued_at?: string | null;
}

export interface StatutoryRevocationRecord {
  id: string;
  token_id: string;
  parcel_id?: string | null;
  parcel_code?: string | null;
  parcel_title?: string | null;
  state_name?: string | null;
  lga_name?: string | null;
  ground: number;
  ground_label?: string | null;
  gazette_number: string;
  public_purpose_details: string;
  compensation_amount: number;
  compensation_disbursed: boolean;
  disbursed_at?: string | null;
  settlement_reference?: string | null;
  revoked_by: string;
  revoked_by_wallet?: string | null;
  tx_hash?: string | null;
  created_at: string;
}

export interface DisputedOversightItem {
  id: string;
  source: 'support_ticket' | 'parcel_dispute' | 'escrow_lock';
  ticket_number?: string | null;
  parcel_id?: string | null;
  parcel_code?: string | null;
  token_id?: string | null;
  subject: string;
  description?: string | null;
  priority?: string | null;
  status: string;
  escalated_by?: string | null;
  owner_wallet?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_id?: string | null;
  actor_staff_id?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  tx_hash?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  recipient_id?: string | null;
  recipient_role?: string | null;
  title: string;
  message: string;
  category?: string | null;
  is_read: boolean;
  related_parcel_id?: string | null;
  created_at: string;
}

export interface OverviewMetrics {
  totalParcels: number;
  pendingConsentCount: number;
  activeTokenizedTitles: number;
  revocationsCount: number;
  totalCompensationUsd: number;
  disbursedCompensationUsd: number;
  highValuePendingCount: number;
  disputedCount: number;
  thresholdUsd: number;
  recentActions: AuditLogEntry[];
}

export interface BlockchainStats {
  chainId: number;
  rpcUrl: string;
  blockNumber: number;
  titlesIssued: string;
  transfersCompleted: string;
  totalFeesCollectedAnagu: string;
  registrationFeeAnagu: string;
  transferFeeAnagu: string;
  anaguTotalSupply: string;
  tokenSymbol: string;
}

export interface WalletBalances {
  address: string;
  polBalance: string;
  anaguBalance: string;
  tokenSymbol: string;
  hasGovernorRole: boolean;
  governorRoleHash: string;
  rpcUrl: string;
}

export interface OnChainTitleInfo {
  tokenId: string;
  ownerOf: string;
  isRevoked: boolean;
  revocationGround: number;
  revokedAt: number;
  parcelIdBytes32: string;
  spatialHashBytes32: string;
  applicationIdBytes32: string;
  issuedAt: number;
  tokenUri: string;
}
