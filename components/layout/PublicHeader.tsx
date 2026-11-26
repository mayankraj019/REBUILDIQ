'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

export interface PublicHeaderProps {
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ user = null }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="border-b border-cream-300 bg-white sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Logo variant="full" size="sm" asLink href="/" />

        {/* Desktop Navigation */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center space-x-6">
          <Link
            href="/#workflow"
            className="text-sm font-medium text-navy-400 hover:text-navy-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded px-1.5 py-1"
          >
            Workflow
          </Link>
          <Link
            href="/#evidence-vs-inference"
            className="text-sm font-medium text-navy-400 hover:text-navy-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded px-1.5 py-1"
          >
            Architecture
          </Link>
          <Link
            href="/design-system"
            className={`text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded px-1.5 py-1 ${
              pathname === '/design-system' ? 'text-coral-500' : 'text-navy-400 hover:text-navy-500'
            }`}
          >
            Design System
          </Link>

          <div className="h-4 w-px bg-cream-300" aria-hidden="true" />

          {user ? (
            <div className="flex items-center space-x-3">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-navy-500 hover:text-coral-500 transition-colors px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
              >
                Dashboard
              </Link>
              <Link href="/analysis/new">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  New Analysis
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                href="/login"
                className={`text-sm font-medium px-2.5 py-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
                  pathname === '/login'
                    ? 'text-navy-500 bg-cream-100'
                    : 'text-navy-500 hover:bg-cream-100'
                }`}
              >
                Sign in
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Create Account
                </Button>
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile Menu Trigger */}
        <button
          type="button"
          className="md:hidden p-2 rounded-md text-navy-500 hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
          aria-expanded={mobileMenuOpen}
          aria-controls="public-mobile-nav"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown Panel */}
      {mobileMenuOpen && (
        <nav
          id="public-mobile-nav"
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-cream-300 bg-white px-4 py-4 space-y-2"
        >
          <Link
            href="/#workflow"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-navy-500 hover:bg-cream-100"
          >
            Workflow
          </Link>
          <Link
            href="/#evidence-vs-inference"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-navy-500 hover:bg-cream-100"
          >
            Architecture
          </Link>
          <Link
            href="/design-system"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-sm font-medium text-navy-500 hover:bg-cream-100"
          >
            Design System
          </Link>

          <div className="pt-2 border-t border-cream-200 flex flex-col space-y-2">
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="md" className="w-full">
                    Open Dashboard
                  </Button>
                </Link>
                <Link href="/analysis/new" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="md" className="w-full">
                    New Analysis
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="md" className="w-full">
                    Sign in
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="md" className="w-full">
                    Create Account
                  </Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};
