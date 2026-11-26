'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Plus,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  Palette,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

export interface AppShellUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AppShellProps {
  user: AppShellUser;
  pageTitle?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
}

const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history', label: 'Analysis History', icon: History },
  { href: '/settings', label: 'Account Settings', icon: Settings },
];

export const AppShell: React.FC<AppShellProps> = ({
  user,
  pageTitle,
  breadcrumb,
  children,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const isRouteActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-white">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-cream-300 flex items-center justify-between">
          <Logo variant="horizontal" size="sm" asLink href="/dashboard" />
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded text-navy-400 hover:text-navy-600 hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Action */}
        <div className="p-4">
          <Link href="/analysis/new" className="block">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              className="w-full"
            >
              New Analysis
            </Button>
          </Link>
        </div>

        {/* Workspace Navigation */}
        <nav aria-label="Workspace Navigation" className="px-3 space-y-1">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
                  active
                    ? 'bg-cream-100 text-navy-500 border border-cream-300'
                    : 'text-navy-400 hover:text-navy-500 hover:bg-cream-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-coral-500' : 'text-navy-400'}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Reference / Preview Section */}
        <div className="mt-6 pt-5 mx-3 border-t border-cream-200 space-y-1">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-300">
            Reference
          </p>
          <Link
            href="/analysis/preview"
            aria-current={pathname.startsWith('/analysis/preview') ? 'page' : undefined}
            className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
              pathname.startsWith('/analysis/preview')
                ? 'bg-cream-100 text-navy-500 border border-cream-300'
                : 'text-navy-400 hover:text-navy-500 hover:bg-cream-50'
            }`}
          >
            <span className="flex items-center space-x-2.5">
              <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>UI Sample Workspace</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cream-200 text-navy-500">
              Preview
            </span>
          </Link>

          <Link
            href="/design-system"
            className="flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium text-navy-400 hover:text-navy-500 hover:bg-cream-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
          >
            <Palette className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Design System</span>
          </Link>
        </div>
      </div>

      {/* Account Footer */}
      <div className="p-4 border-t border-cream-300 bg-cream-50/40">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-navy-500 truncate">{user.name}</p>
            <p className="text-[11px] text-navy-400 truncate">{user.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<LogOut className="w-3.5 h-3.5" />}
          onClick={handleSignOut}
          isLoading={isSigningOut}
          className="w-full"
        >
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream-100 text-navy-500 flex">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-cream-300 bg-white sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace navigation"
        >
          <div
            className="fixed inset-0 bg-navy-900/50"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full border-r border-cream-300 bg-white z-10 shadow-lg">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility Header */}
        <header className="h-16 border-b border-cream-300 bg-white px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-md text-navy-500 hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
            >
              <Menu className="w-5 h-5" />
            </button>

            {breadcrumb && breadcrumb.length > 0 ? (
              <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-sm min-w-0">
                {breadcrumb.map((item, index) => {
                  const isLast = index === breadcrumb.length - 1;
                  return (
                    <React.Fragment key={`${item.label}-${index}`}>
                      {index > 0 && (
                        <ChevronRight className="w-3.5 h-3.5 text-navy-300 shrink-0" aria-hidden="true" />
                      )}
                      {item.href && !isLast ? (
                        <Link
                          href={item.href}
                          className="text-navy-400 hover:text-navy-500 truncate transition-colors"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span className="font-semibold text-navy-500 truncate">{item.label}</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>
            ) : (
              <h1 className="text-sm sm:text-base font-semibold text-navy-500 truncate">
                {pageTitle || 'Workspace'}
              </h1>
            )}
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <Link
              href="/analysis/new"
              className="hidden sm:inline-flex text-xs font-medium text-coral-600 hover:text-coral-700"
            >
              + Analyze URL
            </Link>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
};
