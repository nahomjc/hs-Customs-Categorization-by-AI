"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import { easeOut, fadeUp, staggerContainer } from "./motion";

export function CtaSection() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <LandingWrap>
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: easeOut }}
          className="landing-float-card relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#007bff] to-[#0056b3] px-8 py-14 sm:px-16 sm:py-16 text-center"
        >
          <div
            className="absolute inset-0 opacity-20 landing-dot-grid pointer-events-none"
            aria-hidden
          />
          <motion.div
            className="relative z-10"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
            >
              Ready to categorize your next shipment?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-3 text-blue-100 max-w-lg mx-auto text-sm sm:text-base"
            >
              Upload a packing list and see HS-grouped output in minutes — no
              credit card required for the demo.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
            >
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/demo?source=cta"
                  className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-white text-[#007bff] font-semibold text-sm hover:bg-blue-50 transition-colors"
                >
                  Get free demo
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border border-white/40 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
                >
                  Sign in
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </LandingWrap>
    </section>
  );
}
