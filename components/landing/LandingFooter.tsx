"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingWrap } from "./LandingWrap";
import { easeOut, fadeUp, staggerContainer } from "./motion";

export function LandingFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: easeOut }}
      className="bg-white border-t border-gray-100 py-12"
    >
      <LandingWrap>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8"
        >
          <motion.div variants={fadeUp}>
            <BrandLogo href="/" size="md" />
            <p className="mt-3 text-sm text-gray-500 max-w-xs">
              AI-powered packing list categorization by HS code for customs
              teams.
            </p>
          </motion.div>
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-500"
          >
            {[
              { href: "#features", label: "Features", external: true },
              { href: "#how-it-works", label: "How it works", external: true },
              { href: "#solutions", label: "Solutions", external: true },
              { href: "#pricing", label: "Pricing", external: true },
              { href: "/login", label: "Sign in", external: false },
              { href: "/dashboard", label: "Dashboard", external: false },
            ].map((link) =>
              link.external ? (
                <motion.a
                  key={link.href}
                  href={link.href}
                  whileHover={{ y: -1, color: "#111827" }}
                  className="hover:text-gray-900 transition-colors"
                >
                  {link.label}
                </motion.a>
              ) : (
                <motion.div key={link.href} whileHover={{ y: -1 }}>
                  <Link
                    href={link.href}
                    className="hover:text-gray-900 transition-colors"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ),
            )}
          </motion.div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mt-10 text-xs text-gray-400"
        >
          © {new Date().getFullYear()} Impact Logistics. All rights reserved.
        </motion.p>
      </LandingWrap>
    </motion.footer>
  );
}
