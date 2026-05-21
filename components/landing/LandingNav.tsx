"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { UserMenu, type UserMenuUser } from "@/components/auth/UserMenu";
import { easeOut } from "./motion";
import { LandingWrap } from "./LandingWrap";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#solutions", label: "Solutions" },
  { href: "#pricing", label: "Pricing" },
];

type LandingNavProps = {
  user?: UserMenuUser | null;
};

export function LandingNav({ user }: LandingNavProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut }}
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100"
    >
      <LandingWrap className="h-16 flex items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: easeOut }}
        >
          <BrandLogo href="/" size="md" priority />
        </motion.div>

        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.2, ease: easeOut }}
          className="hidden md:flex items-center gap-8"
        >
          {navLinks.map((link, i) => (
            <motion.a
              key={link.href}
              href={link.href}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 + i * 0.05, ease: easeOut }}
              whileHover={{ y: -1 }}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {link.label}
            </motion.a>
          ))}
        </motion.nav>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: easeOut }}
          className="flex items-center gap-2 sm:gap-3 shrink-0"
        >
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 transition-colors"
              >
                Sign in
              </Link>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/signup"
                  className="text-sm font-medium px-4 py-2 rounded-xl bg-[#007bff] text-white hover:bg-[#0069d9] transition-colors shadow-sm"
                >
                  Get started
                </Link>
              </motion.div>
            </>
          )}
        </motion.div>
      </LandingWrap>
    </motion.header>
  );
}
