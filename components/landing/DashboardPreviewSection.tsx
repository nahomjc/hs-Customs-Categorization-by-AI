"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingWrap } from "./LandingWrap";
import { DashboardFlowAnimation } from "./DashboardFlowAnimation";
import { FadeInView, easeOut, fadeUp } from "./motion";

function TrafficLights() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
      <span className="w-3 h-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
      <span className="w-3 h-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
    </div>
  );
}

export function DashboardPreviewSection() {
  return (
    <section
      id="dashboard-preview"
      className="landing-dashboard-preview-bg py-16 sm:py-24 border-t border-white/40"
    >
      <LandingWrap>
        <FadeInView className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <p className="text-sm font-medium text-[#007bff] mb-2">Dashboard</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Manage everything in one place
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            Upload a packing list, let AI classify every line by HS code, then
            review the grouped list — all from one workspace.
          </p>
        </FadeInView>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: easeOut }}
          className="landing-glass-window rounded-2xl overflow-hidden"
        >
          <div className="landing-glass-titlebar flex items-center gap-4 px-4 py-3">
            <TrafficLights />
            <div className="flex-1 flex justify-center">
              <span className="text-xs font-medium text-gray-700 truncate max-w-[240px] sm:max-w-md">
                Impact Logistics — Dashboard
              </span>
            </div>
            <div className="w-[52px] shrink-0" aria-hidden />
          </div>

          <div className="relative min-h-[420px] sm:min-h-[480px]">
            <div
              className="absolute inset-0 bg-gradient-to-br from-[#007bff]/8 via-transparent to-sky-400/10 pointer-events-none"
              aria-hidden
            />

            <div className="landing-glass-header relative flex items-center justify-between gap-4 px-4 sm:px-5 py-3">
              <BrandLogo size="sm" className="min-w-0 max-w-[120px] sm:max-w-none" />
              <nav className="hidden sm:flex items-center gap-1">
                {["Dashboard", "Upload", "History"].map((label, i) => (
                  <span
                    key={label}
                    className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                      i === 0
                        ? "bg-[#007bff]/90 text-white shadow-sm shadow-blue-500/25"
                        : "text-gray-600 bg-white/40 border border-white/50"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </nav>
              <span className="text-[10px] text-gray-500 hidden md:block truncate max-w-[120px]">
                broker@company.com
              </span>
            </div>

            <div className="relative p-4 sm:p-6">
              <DashboardFlowAnimation />
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#007bff]/90 backdrop-blur-sm text-white text-sm font-semibold hover:bg-[#0069d9] transition-colors shadow-lg shadow-blue-500/25 border border-white/20"
          >
            Open your dashboard
          </Link>
        </motion.div>
      </LandingWrap>
    </section>
  );
}
