import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { ANAGU_CONFIG } from '../lib/contracts';
import { apiRequest } from '../lib/api';
import type { GovernorProfile } from '../lib/types';
import { AnaguLogo, AuthHeroComposition } from './BrandMark';

interface LoginViewProps {
  supabaseConfigured: boolean | null;
  onAuthenticated: (payload: {
    token: string;
    expiresAt: string;
    governor: GovernorProfile;
  }) => void;
}

export function LoginView({
  supabaseConfigured,
  onAuthenticated,
}: LoginViewProps) {
  const [staffId, setStaffId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiRequest<{
        token: string;
        expiresAt: string;
        governor: GovernorProfile;
      }>('/api/staff/login', {
        method: 'POST',
        body: { staffId: staffId.trim().toUpperCase(), passcode },
      });
      onAuthenticated(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to verify Governor credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFDF8] flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        {/* Left Column: Clean Executive Login Card */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 bg-white border-r border-slate-200">
          <div className="w-full max-w-md mx-auto">
            <div className="flex items-center gap-3.5">
              <AnaguLogo size={42} />
              <div>
                <p className="text-xs font-medium text-emerald-700 tracking-wide">
                  ANAGU Land Administration
                </p>
                <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
                  Executive Governor Portal
                </h1>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              Sign in with your issued Governor Staff ID and assigned executive
              passcode to review statutory consent applications, countersign
              high-value transfers, and execute Section 28 orders on Polygon Amoy.
            </p>

            {supabaseConfigured === false && (
              <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-semibold">
                    Backend Database Key Not Configured
                  </p>
                  <p className="mt-1">
                    Set <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>{' '}
                    in AI Studio Settings &rarr; Secrets to connect live{' '}
                    <span className="font-mono">staff_accounts</span> and PostGIS
                    cadastral records.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-800 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label
                  htmlFor="governor-staff-id"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Governor Staff ID
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="governor-staff-id"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="GOV-4821"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="governor-passcode"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Assigned Passcode
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="governor-passcode"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter assigned executive passcode"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-medium text-sm px-5 py-3 transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{submitting ? 'Verifying Clearance…' : 'Sign In to Governor Portal'}</span>
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-3">
                Shared ANAGU Portals
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <a
                  href={ANAGU_CONFIG.crossPortalLinks.userPlatform}
                  className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors"
                >
                  <span>User Platform</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <a
                  href={ANAGU_CONFIG.crossPortalLinks.gisExplorer}
                  className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors"
                >
                  <span>Public GIS Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <a
                  href={ANAGU_CONFIG.crossPortalLinks.userDashboard}
                  className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors"
                >
                  <span>User Dashboard</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Desktop ONLY Hero Composition (no dark container wrapper) */}
        <div className="hidden lg:flex flex-col items-center justify-center p-12 bg-[#FAFDF8]">
          <AuthHeroComposition />
          <div className="mt-8 max-w-md text-center">
            <h2 className="text-xl font-display font-bold text-slate-900">
              Statutory Land Governance &amp; Immutable Title Custody
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Connected directly to the ANAGU PostGIS cadastral registry and
              Polygon Amoy (<span className="font-mono">Chain ID 80002</span>)
              LandTitleNFT smart contracts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
