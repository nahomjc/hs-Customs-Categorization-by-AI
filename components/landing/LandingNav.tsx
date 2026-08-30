"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { UserMenu, type UserMenuUser } from "@/components/auth/UserMenu";
import { easeOut } from "./motion";
import { LandingWrap } from "./LandingWrap";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#telegram-monitoring", label: "Telegram" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#solutions", label: "Solutions" },
  { href: "#pricing", label: "Pricing" },
];

type LandingNavProps = {
  user?: UserMenuUser | null;
};

export function LandingNav({ user }: LandingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeOut }}
      className="sticky top-0 z-50 px-3 sm:px-4 pt-3 sm:pt-4 pointer-events-none"
    >
      <LandingWrap className="pointer-events-auto">
        <div className="landing-nav-pill flex items-center justify-between gap-3 sm:gap-4 rounded-full px-3 sm:px-5 py-2 sm:py-2.5">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: easeOut }}
            className="shrink-0"
          >
            <BrandLogo href="/" size="md" priority />
          </motion.div>

          {/* Desktop nav */}
          <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.2, ease: easeOut }}
            className="hidden lg:flex flex-1 items-center justify-center gap-6 xl:gap-8 min-w-0"
            aria-label="Main navigation"
          >
            {navLinks.map((link, i) => (
              <motion.a
                key={link.href}
                href={link.href}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 + i * 0.04, ease: easeOut }}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
              >
                {link.label}
              </motion.a>
            ))}
          </motion.nav>

          {/* Right actions */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: easeOut }}
            className="flex items-center gap-2 sm:gap-3 shrink-0"
          >
            {user ? (
              <UserMenu user={user} variant="landing-pill" />
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex text-sm text-gray-600 hover:text-gray-900 px-2 py-2 transition-colors"
                >
                  Sign in
                </Link>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 rounded-full bg-[#007bff] text-white hover:bg-[#0069d9] transition-colors shadow-md shadow-blue-500/20"
                  >
                    Get started
                  </Link>
                </motion.div>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <title>{mobileOpen ? "Close" : "Menu"}</title>
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </motion.div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: easeOut }}
              className="lg:hidden mt-2 rounded-2xl border border-gray-200/80 bg-white/90 backdrop-blur-xl p-3 shadow-xl shadow-gray-900/5"
            >
              <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              {!user && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-2 sm:hidden">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm text-center text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </LandingWrap>
    </motion.header>
  );
}
