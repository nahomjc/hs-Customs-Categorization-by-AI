"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingWrap } from "./LandingWrap";
import { DashboardFlowAnimation } from "./DashboardFlowAnimation";
import { OrderStatusPanel } from "./OrderStatusPanel";
import { FadeInView, MotionSection, easeOut, fadeUp } from "./motion";

function TrafficLights() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <span className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
      <span className="w-3 h-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
      <span className="w-3 h-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
    </div>
  );
}

const highlights = [
  {
    title: "Live order tracking",
    description: "Clients see every stage — from upload to export — in real time.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <title>Live order tracking</title>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" />
        <circle cx="12" cy="11" r="2.5" />
      </svg>
    ),
  },
  {
    title: "Instant notifications",
    description: "Push alerts when an order moves to parsing, classifying, or export ready.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <title>Instant notifications</title>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    title: "Multi-order dashboard",
    description: "Track dozens of shipments at once with status badges and timelines.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <title>Multi-order dashboard</title>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

export function DashboardPreviewSection() {
  return (
    <MotionSection
      id="dashboard-preview"
      className="landing-dashboard-preview-bg py-20 sm:py-28 border-t border-white/40"
    >
      <LandingWrap>
        <div className="max-w-2xl mx-auto text-center lg:text-left mb-12 sm:mb-14">
          <FadeInView>
            <p className="text-sm font-medium text-[#007bff] mb-2">Dashboard</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Manage everything in one place
            </h2>
            <p className="mt-4 text-gray-600 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Upload a packing list, let AI classify every line by HS code, then
              review the grouped list — while clients stay informed on exactly
              where their order is at every step.
            </p>
          </FadeInView>

          <div className="mt-8 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto lg:mx-0">
            {highlights.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45, ease: easeOut }}
                className="rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm px-4 py-3 text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#007bff]/10 text-[#007bff]">
                  {item.icon}
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-2">{item.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Main dashboard + mobile order panel */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: easeOut }}
          className="grid lg:grid-cols-[1.4fr_1fr] gap-5 lg:gap-6 items-stretch"
        >
          <div className="landing-glass-window rounded-2xl overflow-hidden min-h-[480px]">
            <div className="landing-glass-titlebar flex items-center gap-4 px-4 py-3">
              <TrafficLights />
              <div className="flex-1 flex justify-center">
                <span className="text-xs font-medium text-gray-700 truncate max-w-[240px] sm:max-w-md">
                  Impact Logistics — Dashboard
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#007bff] opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#007bff]" />
                </span>
                <span className="text-[10px] font-medium text-gray-500 hidden sm:inline">Live</span>
              </div>
            </div>

            <div className="relative min-h-[420px] sm:min-h-[460px]">
              <div
                className="absolute inset-0 bg-gradient-to-br from-[#007bff]/8 via-transparent to-sky-400/10 pointer-events-none"
                aria-hidden
              />

              <div className="landing-glass-header relative flex items-center justify-between gap-4 px-4 sm:px-5 py-3">
                <BrandLogo size="sm" className="min-w-0 max-w-[120px] sm:max-w-none" />
                <nav className="hidden sm:flex items-center gap-1">
                  {["Dashboard", "Upload", "History", "Orders"].map((label, i) => (
                    <span
                      key={label}
                      className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                        i === 0
                          ? "bg-[#007bff]/90 text-white shadow-sm shadow-blue-500/25"
                          : i === 3
                            ? "text-[#007bff] bg-blue-50/80 border border-blue-100/80"
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
          </div>

          {/* Order panel — mobile + desktop beside dashboard */}
          <div className="landing-float-card rounded-2xl border border-white/80 bg-white/75 backdrop-blur-xl p-5 shadow-xl lg:min-h-[480px]">
            <OrderStatusPanel />
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-[#007bff] text-white text-sm font-semibold hover:bg-[#0069d9] transition-colors shadow-lg shadow-blue-500/25"
          >
            Open your dashboard
          </Link>
          <Link
            href="#telegram-monitoring"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border border-gray-200 bg-white/80 text-gray-700 text-sm font-semibold hover:bg-white transition-colors"
          >
            Get Telegram alerts
          </Link>
        </motion.div>
      </LandingWrap>
    </MotionSection>
  );
}
