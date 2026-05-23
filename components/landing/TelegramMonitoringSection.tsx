"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import { TelegramFlowAnimation } from "./TelegramFlowAnimation";
import { FadeInView, MotionItem, MotionSection, fadeUp } from "./motion";

const TELEGRAM_BLUE = "#2AABEE";

const capabilities = [
  {
    title: "Live job status",
    description:
      "Know when uploads are parsed, classification starts, and exports are ready — without opening the dashboard.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <title>Live status</title>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "HS classification trail",
    description:
      "Follow line-item counts, HS group summaries, and completion percentages for every shipment in your channel.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <title>Classification trail</title>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    title: "Team visibility",
    description:
      "Route alerts to broker, compliance, or ops channels so the right people see exceptions and approvals instantly.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <title>Team visibility</title>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Audit-ready alerts",
    description:
      "Timestamped events for uploads, re-classifications, and exports — a lightweight log for customs workflows.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <title>Audit alerts</title>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <title>Telegram</title>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

export function TelegramMonitoringSection() {
  return (
    <MotionSection
      id="telegram-monitoring"
      className="relative py-20 sm:py-28 overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            "linear-gradient(135deg, rgba(42, 171, 238, 0.06) 0%, rgba(0, 123, 255, 0.04) 50%, transparent 100%)",
        }}
      />
      <div className="landing-dot-grid absolute inset-0 opacity-40 pointer-events-none" aria-hidden />

      <LandingWrap className="relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <FadeInView>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2AABEE]/30 bg-[#2AABEE]/8 px-3 py-1 mb-4">
                <TelegramIcon className="w-4 h-4 text-[#2AABEE]" />
                <span className="text-xs font-semibold text-[#1a8cd8]">Telegram integration</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
                Monitor every HS classification from Telegram
              </h2>
              <p className="mt-4 text-gray-500 leading-relaxed max-w-lg">
                Connect your operations channel and stay informed on uploads, AI
                classification progress, exports, and exceptions — in real time,
                where your team already communicates.
              </p>
            </FadeInView>

            <motion.ul
              className="mt-10 grid sm:grid-cols-2 gap-4"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.08 } },
              }}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
            >
              {capabilities.map((item) => (
                <MotionItem key={item.title} variants={fadeUp}>
                  <div className="flex gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[#2AABEE]"
                      style={{ backgroundColor: "rgba(42, 171, 238, 0.12)" }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </MotionItem>
              ))}
            </motion.ul>

            <FadeInView className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                href="/demo?source=telegram"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#007bff] text-white text-sm font-semibold hover:bg-[#0069d9] transition-colors shadow-lg shadow-blue-500/20"
              >
                Request Telegram setup
              </Link>
              <p className="text-xs text-gray-400 sm:self-center max-w-xs">
                Available on Professional and Enterprise plans. Channel routing
                and alert rules configured during onboarding.
              </p>
            </FadeInView>
          </div>

          <TelegramFlowAnimation />
        </div>

        {/* Event types strip */}
        <FadeInView className="mt-14">
          <div className="landing-float-card rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-100 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Events sent to your channel
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Document uploaded",
                "Parsing complete",
                "Classification started",
                "Progress updates",
                "HS grouping complete",
                "Export generated",
                "Review flagged",
                "Job failed / retry",
                "User invited",
              ].map((label) => (
                <span
                  key={label}
                  className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </FadeInView>
      </LandingWrap>
    </MotionSection>
  );
}
