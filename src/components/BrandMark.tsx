import { useState } from 'react';
import { ANAGU_CONFIG } from '../lib/contracts';

export function AnaguLogo({
  size = 36,
  className = '',
  src = ANAGU_CONFIG.logoUrl,
}: {
  size?: number;
  className?: string;
  src?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-xl bg-emerald-700 text-white font-display font-bold shrink-0 ${className}`}
        aria-label="ANAGU Monogram"
      >
        A
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="ANAGU Orbital Monogram"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-contain shrink-0 ${className}`}
    />
  );
}

export function AuthHeroComposition() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full max-w-md aspect-square rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-emerald-100 border border-emerald-200 flex flex-col items-center justify-center p-10 text-center">
        <AnaguLogo size={88} />
        <p className="mt-6 text-lg font-display font-semibold text-emerald-900">
          ANAGU Sovereign Cadastral Registry
        </p>
        <p className="mt-2 text-sm text-slate-600 max-w-xs">
          Statutory Governor’s Consent, PostGIS Boundary Verification, and Polygon
          Amoy Title Governance.
        </p>
      </div>
    );
  }

  return (
    <img
      src={ANAGU_CONFIG.authHeroUrl}
      alt="ANAGU Sovereign Land Registry Orbital Composition"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full max-w-lg max-h-[540px] object-contain select-none"
    />
  );
}
