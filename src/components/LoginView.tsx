import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { GovernorProfile } from '../lib/types';
import { AnaguLogo, AuthHeroComposition } from './BrandMark';

interface LoginViewProps {
  supabaseConfigured?: boolean | null;
  onAuthenticated: (payload: {
    token: string;
    expiresAt: string;
    governor: GovernorProfile;
  }) => void;
}

const PORTAL_LINKS = [
  {
    label: 'Land Owners',
    href: 'https://anagu.vercel.app/',
    className:
      'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm shadow-emerald-900/10',
  },
  {
    label: 'Governors Portal',
    href: 'https://anagu-governor-portal.vercel.app/',
    className:
      'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-900/10',
  },
  {
    label: 'Registrar Portal',
    href: 'https://anagu-registrar-portal.vercel.app/',
    className:
      'bg-teal-700 hover:bg-teal-800 text-white shadow-sm shadow-teal-900/10',
  },
] as const;

const SPARKLES = [
  { top: '14%', left: '18%', size: 8, delay: '0s' },
  { top: '22%', left: '78%', size: 10, delay: '0.7s' },
  { top: '38%', left: '12%', size: 6, delay: '1.4s' },
  { top: '46%', left: '84%', size: 9, delay: '0.3s' },
  { top: '64%', left: '20%', size: 11, delay: '1.9s' },
  { top: '70%', left: '76%', size: 7, delay: '1.1s' },
  { top: '80%', left: '42%', size: 9, delay: '2.2s' },
  { top: '28%', left: '50%', size: 6, delay: '1.6s' },
] as const;

export function LoginView({ onAuthenticated }: LoginViewProps) {
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
        err instanceof Error
          ? err.message
          : 'Unable to verify Governor credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        {/* Left Column: Clean Login Card */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 bg-white border-r border-slate-200">
          <div className="w-full max-w-md mx-auto">
            {/* Centered Logo Above -> Bold Governor Portal -> ANAGU Land Administration Below */}
            <div className="flex flex-col items-center text-center">
              <AnaguLogo size={60} />
              <h1 className="mt-4 text-3xl font-display font-extrabold text-slate-900 tracking-tight">
                Governor Portal
              </h1>
              <p className="mt-1.5 text-sm font-semibold text-emerald-700 tracking-wide">
                ANAGU Land Administration
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-800 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="governor-staff-id"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Governor&apos;s ID
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold text-sm px-5 py-3 transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Verifying Clearance…'
                    : 'Sign In to Governor Portal'}
                </span>
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Colored Cross-Portal Buttons */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 text-center mb-3.5">
                ANAGU Portals
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PORTAL_LINKS.map((portal) => (
                  <a
                    key={portal.label}
                    href={portal.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${portal.className}`}
                  >
                    <span>{portal.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Desktop ONLY Sparkling Grass Gradient Hero */}
        <div className="hidden lg:flex relative overflow-hidden flex-col items-center justify-center p-12 anagu-grass-hero group">
          {/* Sparkling Light Motes (intensify on hover) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-500 opacity-80 group-hover:opacity-100"
          >
            {SPARKLES.map((sp, idx) => (
              <span
                key={idx}
                style={{
                  top: sp.top,
                  left: sp.left,
                  width: sp.size,
                  height: sp.size,
                  animationDelay: sp.delay,
                }}
                className="absolute rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.95)] animate-sparkle"
              />
            ))}
          </div>

          {/* Animated Grass Meadow Wave at Bottom */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 overflow-hidden"
          >
            <svg
              viewBox="0 0 800 120"
              preserveAspectRatio="none"
              className="w-full h-full opacity-50 group-hover:opacity-75 transition-opacity duration-500"
            >
              <g className="animate-grass-sway">
                <path
                  d="M0,120 L0,88 Q40,42 70,88 Q105,36 140,86 Q175,40 210,88 Q250,28 290,88 Q325,45 360,86 Q400,32 440,88 Q480,44 520,88 Q560,26 600,86 Q640,42 680,88 Q725,30 760,88 Q785,55 800,82 L800,120 Z"
                  fill="#237E10"
                />
              </g>
              <g className="animate-grass-sway-delayed">
                <path
                  d="M0,120 L0,96 Q30,58 60,96 Q95,50 130,96 Q170,54 205,96 Q245,46 285,96 Q320,60 355,96 Q395,48 435,96 Q475,58 515,96 Q555,44 595,96 Q635,56 675,96 Q715,48 755,96 Q780,68 800,92 L800,120 Z"
                  fill="#1B7311"
                />
              </g>
            </svg>
          </div>

          {/* Glossy Green Orbital Composition with Hover Float/Scale */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="animate-orbital-float transition-transform duration-500 ease-out group-hover:scale-[1.04]">
              <AuthHeroComposition />
            </div>

            <div className="mt-8 max-w-md text-center px-4">
              <div className="mx-auto mb-3 h-0.5 w-16 rounded-full bg-emerald-800/40" />
              <h2 className="text-2xl xl:text-[28px] font-display font-extrabold text-emerald-950 tracking-tight leading-snug text-balance">
                Statutory Land Governance
                <span className="block text-emerald-800">
                  &amp; Immutable Title Custody
                </span>
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
