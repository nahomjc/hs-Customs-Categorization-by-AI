"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  HeroBackground,
  HeroHeadlineWords,
  HeroMarquee,
} from "./HeroExtras";
import { HeroProductVisual } from "./HeroProductVisual";
import { fadeUp, staggerContainer } from "./motion";

export function HeroSection() {
  const reduced = useReducedMotion() ?? false;

  return (
    <section className="landing-dot-grid relative w-full overflow-hidden min-h-[92vh] flex flex-col -mt-[var(--landing-nav-offset)] pt-[var(--landing-nav-offset)]">
      <HeroBackground />

      <div className="landing-wrap relative flex-1 flex flex-col pt-6 pb-0 sm:pt-8 lg:pt-10">
        <div className="flex-1 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Copy */}
          <motion.div
            className="relative z-10 text-center lg:text-left"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp} className="flex justify-center lg:justify-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100/80 bg-white/90 backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-[#007bff] shadow-sm ring-1 ring-blue-50">
                <motion.span
                  className="relative flex h-2 w-2"
                  aria-hidden
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#007bff] opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#007bff]" />
                </motion.span>
                AI-powered HS classification
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mt-7 text-[2.6rem] sm:text-5xl lg:text-[3.6rem] xl:text-[4rem] font-bold tracking-tight text-gray-900 leading-[1.06]"
            >
              <HeroHeadlineWords reduced={reduced} delay={0.15}>
                Classify, group,
              </HeroHeadlineWords>
              <br />
              <span className="bg-gradient-to-r from-[#007bff] via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                <HeroHeadlineWords reduced={reduced} delay={0.45}>
                  and export
                </HeroHeadlineWords>
              </span>
              <br />
              <motion.span
                className="font-semibold text-gray-400/90"
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                all in one place
              </motion.span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 text-base sm:text-lg text-gray-500 max-w-lg mx-auto lg:mx-0 leading-relaxed"
            >
              Upload packing lists and get HS-code grouped files with AI-powered
              classification built for customs brokers and trade teams.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-9 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3"
            >
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/demo?source=hero"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#007bff] text-white font-semibold text-sm hover:bg-[#0069d9] transition-all shadow-xl shadow-blue-500/30 ring-1 ring-blue-400/20"
                >
                  Get free demo
                  <motion.span
                    className="inline-block"
                    animate={reduced ? undefined : { x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                    aria-hidden
                  >
                    →
                  </motion.span>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-gray-200/80 bg-white/80 backdrop-blur-md text-gray-700 font-semibold text-sm hover:border-gray-300 hover:bg-white transition-colors shadow-sm"
                >
                  <svg className="h-4 w-4 text-[#007bff]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <title>Play</title>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  See how it works
                </Link>
              </motion.div>
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="mt-8 text-xs text-gray-400 flex items-center justify-center lg:justify-start gap-2"
            >
              <span className="flex -space-x-1" aria-hidden>
                {["bg-blue-200", "bg-emerald-200", "bg-violet-200"].map((c) => (
                  <span key={c} className={`h-5 w-5 rounded-full border-2 border-white ${c}`} />
                ))}
              </span>
              Built for customs brokers & in-house trade teams
            </motion.p>
          </motion.div>

          {/* Product visual */}
          <motion.div
            className="relative z-10 lg:pl-4"
            initial={{ opacity: 0, y: 50, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.15, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroProductVisual reduced={reduced} />
          </motion.div>
        </div>
      </div>

      <HeroMarquee />
    </section>
  );
}
