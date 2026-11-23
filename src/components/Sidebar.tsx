import {
  AlertOctagon,
  BookOpenCheck,
  ExternalLink,
  FileBarChart2,
  FileCheck2,
  Gavel,
  LayoutDashboard,
  PenTool,
  X,
} from 'lucide-react';
import { ANAGU_CONFIG } from '../lib/contracts';
import type { WorkspaceTab } from '../lib/types';
import { AnaguLogo } from './BrandMark';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  counts: {
    pendingConsent: number;
    highValuePending: number;
    disputed: number;
  };
}

const NAV_ITEMS: {
  id: WorkspaceTab;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: 'pendingConsent' | 'highValuePending' | 'disputed';
}[] = [
  { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
  {
    id: 'consent',
    label: 'Executive Consent Queue',
    icon: FileCheck2,
    badgeKey: 'pendingConsent',
  },
  {
    id: 'cosign',
    label: 'High-Value Co-Sign',
    icon: PenTool,
    badgeKey: 'highValuePending',
  },
  { id: 'revocations', label: 'Sec. 28 Revocations', icon: Gavel },
  { id: 'ledger', label: 'Gazette & Compensation', icon: BookOpenCheck },
  {
    id: 'disputes',
    label: 'Disputed Parcels',
    icon: AlertOctagon,
    badgeKey: 'disputed',
  },
  { id: 'reports', label: 'Reports & Audit Logs', icon: FileBarChart2 },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  counts,
}: SidebarProps) {
  function handleNavClick(tab: WorkspaceTab) {
    onSelectTab(tab);
    onCloseMobile();
  }

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 w-64">
      {/* Clicking top ANAGU logo always returns to Executive Overview */}
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('overview')}
          className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-lg cursor-pointer"
        >
          <AnaguLogo size={34} />
          <div className="min-w-0">
            <span className="block font-display font-bold text-sm text-slate-900 tracking-tight whitespace-nowrap">
              ANAGU
            </span>
            <span className="block text-[11px] font-medium text-emerald-700 whitespace-nowrap">
              Governor Portal
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav
        aria-label="Governor Workspaces"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const count = item.badgeKey ? counts[item.badgeKey] : 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-emerald-800 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-[#FAFDF8]'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-emerald-100' : 'text-slate-500'
                  }`}
                />
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </span>
              {count > 0 && (
                <span
                  className={`font-mono tabular-nums text-xs shrink-0 ${
                    active ? 'text-emerald-100' : 'text-emerald-700 font-semibold'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Shared Cross-Portal References */}
      <div className="p-4 border-t border-slate-200 bg-[#FAFDF8] space-y-2 shrink-0">
        <p className="text-xs font-medium text-slate-500">ANAGU Ecosystem</p>
        <div className="space-y-1.5 text-xs">
          <a
            href={ANAGU_CONFIG.crossPortalLinks.userPlatform}
            className="flex items-center justify-between text-slate-600 hover:text-emerald-700 py-1 transition-colors"
          >
            <span>User Platform</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <a
            href={ANAGU_CONFIG.crossPortalLinks.gisExplorer}
            className="flex items-center justify-between text-slate-600 hover:text-emerald-700 py-1 transition-colors"
          >
            <span>Public GIS Explorer</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <a
            href={ANAGU_CONFIG.crossPortalLinks.userDashboard}
            className="flex items-center justify-between text-slate-600 hover:text-emerald-700 py-1 transition-colors"
          >
            <span>Landowner Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-30 w-64 no-print">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
