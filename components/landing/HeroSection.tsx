"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  easeOut,
  fadeUp,
  floatAnimation,
  slideFrom,
  staggerContainer,
} from "./motion";

function FloatingUploadCard({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="absolute left-4 lg:left-6 top-8 w-[200px] xl:w-[220px] hidden lg:block"
      initial="hidden"
      animate="visible"
      variants={slideFrom("left", 48)}
      transition={{ delay: 0.5, duration: 0.7, ease: easeOut }}
    >
      <motion.div
        className="relative"
        animate={floatAnimation(reduced)}
        style={{ animationDelay: "0s" }}
      >
        <div className="landing-float-card absolute -right-4 top-6 w-14 h-14 rounded-2xl bg-white flex items-center justify-center rotate-6">
          <svg className="w-7 h-7 text-[#007bff]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <title>Upload verified</title>
            <path
              d="M9 12l2 2 4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <div
          className="landing-float-card rounded-2xl p-4 rotate-[-4deg] shadow-lg"
          style={{ background: "#fef08a" }}
        >
          <div className="flex justify-end mb-1">
            <span className="text-red-500 text-lg" aria-hidden>
              📌
            </span>
          </div>
          <p className="text-xs font-medium text-amber-900/90 leading-snug">
            Upload packing lists — PDF, Word, or Excel — in one click.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FloatingQueueCard({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="absolute right-4 lg:right-6 top-4 w-[220px] xl:w-[240px] hidden lg:block"
      initial="hidden"
      animate="visible"
      variants={slideFrom("right", 48)}
      transition={{ delay: 0.6, duration: 0.7, ease: easeOut }}
    >
      <motion.div
        className="landing-float-card bg-white rounded-2xl overflow-hidden"
        animate={floatAnimation(reduced)}
        transition={{ delay: 0.8 }}
      >
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-700">Classification queue</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-900">Shipment #2841</p>
              <p className="text-[10px] text-gray-500 mt-0.5">847 items · Processing</p>
            </div>
            <motion.span
              animate={reduced ? undefined : { rotate: [0, 8, -8, 0] }}
              transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className="text-lg"
              aria-hidden
            >
              ⏱
            </motion.span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[#007bff]"
              initial={{ width: 0 }}
              animate={{ width: "66%" }}
              transition={{ delay: 1, duration: 1.2, ease: easeOut }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FloatingTasksCard({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="absolute left-4 lg:left-6 bottom-0 w-[240px] hidden lg:block"
      initial="hidden"
      animate="visible"
      variants={slideFrom("left", 40)}
      transition={{ delay: 0.7, duration: 0.7, ease: easeOut }}
    >
      <motion.div
        className="landing-float-card bg-white rounded-2xl p-4"
        animate={floatAnimation(reduced)}
        transition={{ delay: 1.2 }}
      >
        <p className="text-xs font-semibold text-gray-800 mb-3">Today&apos;s jobs</p>
        <ul className="space-y-3">
          <li>
            <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1">
              <span>PL-2024-089</span>
              <span className="flex -space-x-1">
                <span className="w-5 h-5 rounded-full bg-orange-200 border border-white" />
                <span className="w-5 h-5 rounded-full bg-blue-200 border border-white" />
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-orange-400"
                initial={{ width: 0 }}
                animate={{ width: "80%" }}
                transition={{ delay: 1.1, duration: 1, ease: easeOut }}
              />
            </div>
          </li>
          <li>
            <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1">
              <span>PL-2024-090</span>
              <span className="w-5 h-5 rounded-full bg-blue-200 border border-white" />
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[#007bff]"
                initial={{ width: 0 }}
                animate={{ width: "50%" }}
                transition={{ delay: 1.3, duration: 1, ease: easeOut }}
              />
            </div>
          </li>
        </ul>
      </motion.div>
    </motion.div>
  );
}

function FloatingFormatsCard({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="absolute right-4 lg:right-6 bottom-4 w-[220px] hidden lg:block"
      initial="hidden"
      animate="visible"
      variants={slideFrom("right", 40)}
      transition={{ delay: 0.8, duration: 0.7, ease: easeOut }}
    >
      <motion.div
        className="landing-float-card bg-white rounded-2xl p-4"
        animate={floatAnimation(reduced)}
        transition={{ delay: 1.6 }}
      >
        <p className="text-xs font-semibold text-gray-800 mb-3">Export formats</p>
        <div className="flex gap-2">
          {[
            { label: "Excel", bg: "bg-emerald-100", text: "text-emerald-700" },
            { label: "PDF", bg: "bg-red-100", text: "text-red-600" },
            { label: "CSV", bg: "bg-blue-100", text: "text-blue-600" },
          ].map((fmt, i) => (
            <motion.div
              key={fmt.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 + i * 0.1, duration: 0.4, ease: easeOut }}
              whileHover={{ scale: 1.06, y: -2 }}
              className={`flex-1 ${fmt.bg} rounded-xl py-3 flex items-center justify-center`}
            >
              <span className={`text-[10px] font-bold ${fmt.text}`}>{fmt.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function HeroSection() {
  const reduced = useReducedMotion() ?? false;

  return (
    <section className="landing-dot-grid relative w-full overflow-hidden pt-12 pb-24 sm:pt-16 sm:pb-32">
      <div className="landing-wrap relative min-h-[520px] sm:min-h-[560px]">
          <FloatingUploadCard reduced={reduced} />
          <FloatingQueueCard reduced={reduced} />
          <FloatingTasksCard reduced={reduced} />
          <FloatingFormatsCard reduced={reduced} />

        <div className="relative z-10 flex min-h-[520px] sm:min-h-[560px] items-center justify-center">
          <motion.div
            className="text-center max-w-2xl mx-auto px-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-gray-900 leading-tight"
            >
              <span className="font-bold">Classify, group, and export</span>
              <br />
              <span className="font-normal text-gray-500">all in one place</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-base sm:text-lg text-gray-500 max-w-md mx-auto leading-relaxed"
            >
              Upload packing lists and get HS-code grouped files with AI-powered
              classification for customs workflows.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-[#007bff] text-white font-semibold text-sm hover:bg-[#0069d9] transition-colors shadow-lg shadow-blue-500/25"
                >
                  Get free demo
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
