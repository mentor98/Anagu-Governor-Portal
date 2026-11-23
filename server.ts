import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  requireGovernor,
  signGovernorToken,
  verifyScryptPasscode,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  fetchRegistryStats,
  fetchTitleOnChain,
  fetchWalletBalances,
  verifyRevocationReceipt,
} from './server/blockchain.ts';
import {
  cosignHighValueTransfer,
  getAuditLogs,
  getConsentQueueData,
  getDisputesOversight,
  getEligibleTitlesForRevocation,
  getGovernorNotifications,
  getHighValueTransfers,
  getOverviewData,
  getRevocationsLedger,
  getStaffAccountById,
  grantGovernorConsent,
  isSupabaseConfigured,
  markNotificationsRead,
  recordStatutoryRevocation,
  resolveDisputeOversight,
  returnParcelToRegistrar,
  toggleCompensationDisbursement,
  updateStaffLastLogin,
  writeAuditLog,
} from './server/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Public Health Check (no secrets exposed)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    chainId: 80002,
  });
});

// ------------------------------------------------------------------
// Staff Governor Authentication
// ------------------------------------------------------------------
app.post('/api/staff/login', async (req, res) => {
  const rawStaffId = typeof req.body?.staffId === 'string' ? req.body.staffId : '';
  const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
  const staffId = rawStaffId.trim().toUpperCase();

  if (!/^GOV-[A-Z0-9]{4,}$/.test(staffId) || passcode.length < 4) {
    res.status(400).json({
      error: 'Enter a valid Governor Staff ID (e.g. GOV-4821) and assigned passcode.',
    });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error:
        'Shared Supabase backend service key (SUPABASE_SERVICE_ROLE_KEY) is not configured in environment secrets.',
    });
    return;
  }

  try {
    const staff = await getStaffAccountById(staffId);
    if (!staff) {
      res.status(401).json({ error: 'Invalid Governor Staff ID or passcode.' });
      return;
    }

    const validPasscode = verifyScryptPasscode(passcode, staff.passcode_hash);
    if (!validPasscode) {
      res.status(401).json({ error: 'Invalid Governor Staff ID or passcode.' });
      return;
    }

    if (staff.role !== 'governor' || staff.is_active !== true) {
      res.status(403).json({
        error:
          'Access denied: Account is suspended or does not hold active GOVERNOR executive clearance.',
      });
      return;
    }

    const profile = {
      id: String(staff.id),
      staff_id: String(staff.staff_id),
      role: String(staff.role),
      full_name: String(staff.full_name || staff.name || staff.staff_id),
      email: staff.email ? String(staff.email) : null,
      jurisdiction: staff.jurisdiction ? String(staff.jurisdiction) : null,
      state_name: staff.state_name ? String(staff.state_name) : null,
      lga_name: staff.lga_name ? String(staff.lga_name) : null,
      wallet_address: staff.wallet_address ? String(staff.wallet_address) : null,
      is_active: Boolean(staff.is_active),
      last_login_at: staff.last_login_at ? String(staff.last_login_at) : null,
    };

    const { token, expiresAt } = signGovernorToken(profile);
    await updateStaffLastLogin(profile.staff_id);
    await writeAuditLog({
      actor_id: profile.id,
      actor_staff_id: profile.staff_id,
      actor_role: 'governor',
      action: 'GOVERNOR_LOGIN',
      entity_type: 'staff_account',
      entity_id: profile.staff_id,
    });

    res.json({
      token,
      expiresAt,
      governor: profile,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Authentication service error.';
    res.status(500).json({ error: msg });
  }
});

// ------------------------------------------------------------------
// Authenticated Governor Routes
// ------------------------------------------------------------------
app.get('/api/governor/me', requireGovernor, (req: AuthenticatedRequest, res) => {
  res.json({ governor: req.governor });
});

app.post(
  '/api/governor/logout',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    if (req.governor) {
      await writeAuditLog({
        actor_id: req.governor.id,
        actor_staff_id: req.governor.staff_id,
        actor_role: 'governor',
        action: 'GOVERNOR_LOGOUT',
        entity_type: 'staff_account',
        entity_id: req.governor.staff_id,
      });
    }
    res.json({ ok: true });
  }
);

app.get(
  '/api/governor/overview',
  requireGovernor,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const overview = await getOverviewData();
      res.json(overview);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load overview.',
      });
    }
  }
);

app.get(
  '/api/governor/consent-queue',
  requireGovernor,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const items = await getConsentQueueData();
      res.json({ items });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Failed to load consent queue.',
      });
    }
  }
);

app.post(
  '/api/governor/consent/:parcelId/grant',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    const parcelId = String(req.params.parcelId || '').trim();
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    if (!parcelId) {
      res.status(400).json({ error: 'Parcel ID is required.' });
      return;
    }

    try {
      const result = await grantGovernorConsent({
        parcelId,
        governorStaffId: req.governor!.staff_id,
        governorId: req.governor!.id,
        notes,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to grant Governor consent.',
      });
    }
  }
);

app.post(
  '/api/governor/consent/:parcelId/return',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    const parcelId = String(req.params.parcelId || '').trim();
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    if (!parcelId || !notes) {
      res
        .status(400)
        .json({ error: 'Parcel ID and return reason notes are required.' });
      return;
    }

    try {
      await returnParcelToRegistrar({
        parcelId,
        governorStaffId: req.governor!.staff_id,
        governorId: req.governor!.id,
        notes,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to return parcel.',
      });
    }
  }
);

app.get(
  '/api/governor/high-value-transfers',
  requireGovernor,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const data = await getHighValueTransfers();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to load high-value transfers.',
      });
    }
  }
);

app.post(
  '/api/governor/high-value-transfers/:id/cosign',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id || '').trim();
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    if (!id) {
      res.status(400).json({ error: 'Transfer ID is required.' });
      return;
    }
    try {
      const result = await cosignHighValueTransfer({
        id,
        governorStaffId: req.governor!.staff_id,
        governorId: req.governor!.id,
        notes,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to countersign high-value transfer.',
      });
    }
  }
);

app.get(
  '/api/governor/revocations/eligible',
  requireGovernor,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const items = await getEligibleTitlesForRevocation();
      res.json({ items });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Failed to load minted titles.',
      });
    }
  }
);

app.get(
  '/api/governor/revocations',
  requireGovernor,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const items = await getRevocationsLedger();
      res.json({ items });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to load revocations ledger.',
      });
    }
  }
);

app.post(
  '/api/governor/revocations',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    const tokenId = String(req.body?.tokenId ?? '').trim();
    const parcelId = req.body?.parcelId ? String(req.body.parcelId) : null;
    const ground = Number(req.body?.ground);
    const gazetteNumber = String(req.body?.gazetteNumber ?? '').trim();
    const publicPurposeDetails = String(
      req.body?.publicPurposeDetails ?? ''
    ).trim();
    const compensationAmount = Number(req.body?.compensationAmount ?? 0);
    const compensationDisbursed = Boolean(req.body?.compensationDisbursed);
    const txHash =
      typeof req.body?.txHash === 'string' && req.body.txHash.trim()
        ? req.body.txHash.trim()
        : null;
    const revokedByWallet =
      typeof req.body?.revokedByWallet === 'string'
        ? req.body.revokedByWallet.trim()
        : null;

    if (
      !tokenId ||
      !Number.isInteger(ground) ||
      ground < 0 ||
      ground > 3 ||
      !gazetteNumber ||
      !publicPurposeDetails ||
      !Number.isFinite(compensationAmount) ||
      compensationAmount < 0
    ) {
      res.status(400).json({
        error:
          'Provide valid tokenId, statutory ground (0-3), official gazette number, public purpose details, and compensation amount.',
      });
      return;
    }

    try {
      if (txHash) {
        const verification = await verifyRevocationReceipt(txHash, tokenId);
        if (!verification.verified) {
          res.status(400).json({
            error:
              'Transaction hash could not be verified as a confirmed LandTitleNFT TitleRevoked event for this token on Polygon Amoy (80002).',
          });
          return;
        }
      }

      const record = await recordStatutoryRevocation({
        tokenId,
        parcelId,
        ground,
        gazetteNumber,
        publicPurposeDetails,
        compensationAmount,
        compensationDisbursed,
        governorStaffId: req.governor!.staff_id,
        governorId: req.governor!.id,
        revokedByWallet,
        txHash,
      });

      res.json({ record });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to record statutory revocation.',
      });
    }
  }
);

app.patch(
  '/api/governor/revocations/:id/disbursement',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id || '').trim();
    const disbursed = Boolean(req.body?.disbursed);
    const settlementReference =
      typeof req.body?.settlementReference === 'string'
        ? req.body.settlementReference
        : undefined;

    if (!id) {
      res.status(400).json({ error: 'Revocation ID is required.' });
      return;
    }

    try {
      await toggleCompensationDisbursement({
        id,
        disbursed,
        settlementReference,
        governorStaffId: req.governor!.staff_id,
        governorId: req.governor!.id,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to update compensation disbursement.',
      });
    }
  }
);

app.get(
  '/api/governor/disputes',
  requireGovernor,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const items = await getDisputesOversight();
      res.json({ items });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to load disputed parcels.',
      });
    }
  }
);

app.post(
  '/api/governor/disputes/:id/resolve',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id || '').trim();
    const source = req.body?.source as
      | 'support_ticket'
      | 'parcel_dispute'
      | 'escrow_lock';
    const parcelId = req.body?.parcelId ? String(req.body.parcelId) : null;
    const resolutionStatus = String(
      req.body?.resolutionStatus || 'resolved'
    ).trim();
    const resolutionNotes = String(req.body?.resolutionNotes || '').trim();

    if (!id || !resolutionNotes) {
      res.status(400).json({
        error: 'Dispute ID and executive resolution directive notes are required.',
      });
      return;
    }

    try {
      await resolveDisputeOversight({
        id,
        source: source || 'support_ticket',
        parcelId,
        resolutionStatus,
        resolutionNotes,
        governorStaffId: req.governor!.staff_id,
        governorId: req.governor!.id,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Failed to resolve dispute.',
      });
    }
  }
);

app.get(
  '/api/governor/audit-logs',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    const limit = Math.min(250, Math.max(10, Number(req.query.limit || 100)));
    try {
      const items = await getAuditLogs(limit);
      res.json({ items });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Failed to load audit logs.',
      });
    }
  }
);

app.get(
  '/api/governor/notifications',
  requireGovernor,
  async (req: AuthenticatedRequest, res) => {
    try {
      const items = await getGovernorNotifications(req.governor!.staff_id);
      res.json({ items });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to load notifications.',
      });
    }
  }
);

app.patch(
  '/api/governor/notifications/read',
  requireGovernor,
  async (_req: AuthenticatedRequest, res) => {
    try {
      await markNotificationsRead();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to mark notifications read.',
      });
    }
  }
);

// ------------------------------------------------------------------
// Polygon Amoy Server RPC Proxy (/api/blockchain/*)
// ------------------------------------------------------------------
app.get('/api/blockchain/stats', async (_req, res) => {
  try {
    const stats = await fetchRegistryStats();
    res.json(stats);
  } catch (err) {
    res.status(502).json({
      error:
        err instanceof Error
          ? err.message
          : 'Polygon Amoy RPC stats unavailable.',
    });
  }
});

app.get('/api/blockchain/balances/:address', async (req, res) => {
  const address = String(req.params.address || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid EVM wallet address.' });
    return;
  }
  try {
    const balances = await fetchWalletBalances(address);
    res.json(balances);
  } catch (err) {
    res.status(502).json({
      error:
        err instanceof Error
          ? err.message
          : 'Unable to fetch Polygon Amoy wallet balances.',
    });
  }
});

app.get('/api/blockchain/title/:tokenId', async (req, res) => {
  const tokenId = String(req.params.tokenId || '').trim();
  if (!/^\d+$/.test(tokenId)) {
    res.status(400).json({ error: 'Numeric tokenId is required.' });
    return;
  }
  try {
    const info = await fetchTitleOnChain(tokenId);
    res.json(info);
  } catch (err) {
    res.status(502).json({
      error:
        err instanceof Error
          ? err.message
          : 'Unable to query LandTitleNFT on Polygon Amoy.',
    });
  }
});

// ------------------------------------------------------------------
// Vite / Static Frontend Serving
// ------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ANAGU Executive Governor Portal listening on port ${PORT}`);
  });
}

startServer();
