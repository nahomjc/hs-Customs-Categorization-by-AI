"use client";

import Link from "next/link";
import { Inter } from "next/font/google";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { easeOut, fadeUp, staggerContainer } from "@/components/landing/motion";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const highlights = [
  "AI-powered HS code grouping",
  "PDF, Word & Excel uploads",
  "Export-ready customs files",
];

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className={`auth-page landing-page min-h-screen flex flex-col ${inter.className}`}>
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="landing-container h-14 flex items-center justify-between">
          <BrandLogo href="/" size="md" />
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Brand panel — desktop */}
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="hidden lg:flex lg:w-[44%] xl:w-[42%] landing-dot-grid relative overflow-hidden flex-col justify-center px-10 xl:px-14 py-12 border-r border-gray-100"
        >
          <div className="relative z-10 max-w-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: easeOut }}
              className="mb-8"
            >
              <BrandLogo size="lg" />
            </motion.div>
            <h2 className="text-3xl xl:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
              <span className="font-bold">Classify, group, and export</span>
              <br />
              <span className="font-normal text-gray-500">for customs teams</span>
            </h2>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Upload packing lists and get HS-code grouped files with AI-powered
              classification — built for brokers and trade desks.
            </p>
            <ul className="mt-8 space-y-3">
              {highlights.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: easeOut }}
                  className="flex items-center gap-3 text-sm text-gray-600"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#007bff]/10 text-[#007bff]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                      <title>Included</title>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Decorative float cards */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="absolute bottom-12 right-10 w-36 landing-float-card bg-white rounded-2xl p-3 hidden xl:block"
          >
            <p className="text-[10px] font-semibold text-gray-700">Today&apos;s jobs</p>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full w-3/4 rounded-full bg-[#007bff]" />
            </div>
          </motion.div>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1 }}
            className="absolute top-20 right-16 w-32 rounded-2xl p-3 shadow-lg hidden xl:block rotate-[-3deg]"
            style={{ background: "#fef08a" }}
          >
            <p className="text-[10px] font-medium text-amber-900/90">Upload & classify in seconds</p>
          </motion.div>
        </motion.aside>

        {/* Form panel */}
        <div className="flex-1 landing-dot-grid flex items-center justify-center p-4 sm:p-6 lg:p-10">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="w-full max-w-[420px]"
          >
            <motion.div
              variants={fadeUp}
              className="landing-float-card bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-10"
            >
              <div className="flex flex-col items-center text-center mb-8 lg:hidden">
                <BrandLogo size="md" className="mb-4" />
              </div>

              <motion.div variants={fadeUp} className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
                <p className="auth-muted mt-2">{subtitle}</p>
              </motion.div>

              <motion.div variants={fadeUp}>{children}</motion.div>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="text-center text-xs text-gray-400 mt-6"
            >
              © {new Date().getFullYear()} Impact Logistics · Customs categorization
            </motion.p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
