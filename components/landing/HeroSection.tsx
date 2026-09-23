"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { HeroBackground } from "./HeroExtras";
import { HeroGlobeVisual } from "./HeroGlobeVisual";
import { fadeUp, staggerContainer } from "./motion";

export function HeroSection() {
  const reduced = useReducedMotion() ?? false;

  return (
    <section className="landing-dot-grid relative w-full overflow-hidden min-h-[90vh] flex flex-col -mt-[var(--landing-nav-offset)] pt-[var(--landing-nav-offset)]">
      <HeroBackground />

      <div className="relative flex-1 flex flex-col justify-center">
        <div className="landing-wrap relative z-20 w-full py-14 sm:py-16 lg:py-20 pointer-events-none">
          <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-8 lg:gap-4 xl:gap-8 items-center">
            {/* Copy — pointer-events restored so CTA stays clickable */}
            <motion.div
              className="relative z-20 text-center lg:text-left max-w-xl mx-auto lg:mx-0 pointer-events-auto"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={fadeUp} className="flex justify-center lg:justify-start">
                <span className="inline-flex items-center rounded-full bg-gray-100/90 px-3.5 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200/80">
                  Impact Logistics
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="mt-6 text-[2.4rem] sm:text-5xl lg:text-[3.35rem] xl:text-[3.75rem] font-semibold tracking-tight text-[#0e1526] leading-[1.08]"
              >
                We&apos;re building
                <br />
                <span className="bg-gradient-to-r from-[#007bff] via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  AI classification
                  <br />
                  for your trade.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-6 text-base sm:text-lg text-gray-500 max-w-md mx-auto lg:mx-0 leading-relaxed"
              >
                Upload packing lists and get HS-code grouped files — built for
                customs brokers and trade teams.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-9 flex justify-center lg:justify-start"
              >
                <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/demo?source=hero"
                    className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-gradient-to-r from-[#007bff] to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:brightness-105 transition-[filter]"
                  >
                    Get free demo
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Spacer for grid on desktop — globe is absolute fill on right */}
            <div className="hidden lg:block min-h-[560px] xl:min-h-[640px]" aria-hidden />
          </div>
        </div>

        {/* Globe fills right half and bleeds off edges */}
        <motion.div
          className="relative z-10 w-full lg:absolute lg:inset-y-0 lg:right-0 lg:w-[58%] xl:w-[55%] pointer-events-auto"
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative h-[360px] sm:h-[440px] lg:h-full lg:min-h-full -mx-4 sm:mx-0 lg:-mr-[8%] lg:ml-[-6%]">
            <HeroGlobeVisual reduced={reduced} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
