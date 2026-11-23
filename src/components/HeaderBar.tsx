import { useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  formatDateTime,
  formatTokenAmount,
  shortenAddress,
} from '../lib/api';
import { POLYGON_AMOY_NETWORK } from '../lib/contracts';
import type {
  GovernorProfile,
  NotificationItem,
  WalletBalances,
} from '../lib/types';

interface HeaderBarProps {
  sectionTitle: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenMobileMenu: () => void;
  governor: GovernorProfile;
  walletAddress: string | null;
  walletChainId: number | null;
  walletBalances: WalletBalances | null;
  walletLoading: boolean;
  onConnectWallet: () => void;
  onSwitchWallet: () => void;
  onSwitchToAmoy: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  onLogout: () => void;
}

export function HeaderBar({
  sectionTitle,
  searchQuery,
  onSearchChange,
  onOpenMobileMenu,
  governor,
  walletAddress,
  walletChainId,
  walletBalances,
  walletLoading,
  onConnectWallet,
  onSwitchWallet,
  onSwitchToAmoy,
  notifications,
  onMarkNotificationsRead,
  onLogout,
}: HeaderBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const wrongNetwork =
    walletAddress != null &&
    walletChainId !== null &&
    walletChainId !== POLYGON_AMOY_NETWORK.chainId;

  const staffWalletMatches =
    walletAddress &&
    governor.wallet_address &&
    walletAddress.toLowerCase() === governor.wallet_address.toLowerCase();

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 no-print">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Drawer Trigger + Section Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-display font-bold text-slate-900 truncate">
              {sectionTitle}
            </h1>
            <p className="text-xs text-slate-500 truncate hidden sm:block">
              <span>{governor.full_name}</span>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
              <span className="font-mono">{governor.staff_id}</span>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
              <span>
                {governor.jurisdiction ||
                  governor.state_name ||
                  'State Executive Council'}
              </span>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
              <span className="font-semibold text-emerald-700">GOVERNOR</span>
            </p>
          </div>
        </div>

        {/* Center: Search Input */}
        <div className="hidden md:flex flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search parcel ID, gazette, token ID, wallet…"
              aria-label="Search current workspace"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-[#FAFDF8] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>
        </div>

        {/* Right: Wallet + Notifications + Sign Out */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Desktop Wallet Bar */}
          <div className="hidden xl:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#FAFDF8] border border-slate-200 text-xs">
            {walletAddress ? (
              <>
                <Wallet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="font-mono tabular-nums text-slate-900 font-medium whitespace-nowrap">
                  {shortenAddress(walletAddress)}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono tabular-nums text-emerald-800 font-semibold whitespace-nowrap">
                  {walletLoading
                    ? '…'
                    : `${formatTokenAmount(walletBalances?.anaguBalance, 2)} ANAGU`}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-700 whitespace-nowrap">
                  {walletLoading
                    ? '…'
                    : `${formatTokenAmount(walletBalances?.polBalance, 4)} POL`}
                </span>
                {walletBalances?.hasGovernorRole && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span
                      title={
                        staffWalletMatches
                          ? 'Matches staff_accounts.wallet_address & GOVERNOR_ROLE verified on LandTitleNFT'
                          : 'GOVERNOR_ROLE verified on LandTitleNFT'
                      }
                      className="inline-flex items-center gap-1 text-emerald-700 font-medium whitespace-nowrap"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>On-Chain Gov</span>
                    </span>
                  </>
                )}
                {wrongNetwork ? (
                  <button
                    type="button"
                    onClick={onSwitchToAmoy}
                    className="ml-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium whitespace-nowrap cursor-pointer"
                  >
                    Switch to Amoy (80002)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onSwitchWallet}
                    className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium whitespace-nowrap cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>Switch Wallet</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onConnectWallet}
                className="inline-flex items-center gap-1.5 text-emerald-800 hover:text-emerald-900 font-medium whitespace-nowrap cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label="Governor notifications"
              className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-700 text-white text-[10px] font-mono tabular-nums flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-[#FAFDF8]">
                  <span className="text-xs font-semibold text-slate-900">
                    Executive Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkNotificationsRead}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500 text-center">
                      No executive notifications recorded.
                    </p>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 text-xs ${
                          n.is_read ? 'bg-white' : 'bg-emerald-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {n.title}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                            {formatDateTime(n.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sign Out */}
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Wallet + Search Bar (ensures live ANAGU + POL + Switch controls on mobile too) */}
      <div className="xl:hidden px-4 sm:px-6 py-2.5 border-t border-slate-100 bg-[#FAFDF8] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {walletAddress ? (
            <>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-900 font-medium">
                <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                {shortenAddress(walletAddress)}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono tabular-nums text-emerald-800 font-semibold">
                {walletLoading
                  ? '…'
                  : `${formatTokenAmount(walletBalances?.anaguBalance, 2)} ANAGU`}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono tabular-nums text-slate-700">
                {walletLoading
                  ? '…'
                  : `${formatTokenAmount(walletBalances?.polBalance, 4)} POL`}
              </span>
              {walletBalances?.hasGovernorRole && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>GOVERNOR_ROLE</span>
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-slate-600">
              No Polygon Amoy wallet connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!walletAddress ? (
            <button
              type="button"
              onClick={onConnectWallet}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium whitespace-nowrap cursor-pointer"
            >
              Connect Wallet
            </button>
          ) : wrongNetwork ? (
            <button
              type="button"
              onClick={onSwitchToAmoy}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium whitespace-nowrap cursor-pointer"
            >
              Switch to Amoy (80002)
            </button>
          ) : (
            <button
              type="button"
              onClick={onSwitchWallet}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Switch Wallet</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
