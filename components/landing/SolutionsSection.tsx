"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import {
  BrokersVisual,
  ComplianceVisual,
  ImportExportVisual,
} from "./SolutionsCardVisuals";
import { FadeInView, MotionItem, MotionSection, fadeUp, scaleIn } from "./motion";

const solutions: {
  title: string;
  description: string;
  highlight: string;
  visual: ReactNode;
  accent: string;
  accentBg: string;
}[] = [
  {
    title: "Customs brokers",
    description:
      "Process dozens of client packing lists per week with consistent HS grouping and audit-ready exports.",
    highlight: "High volume",
    visual: <BrokersVisual />,
    accent: "from-amber-500 to-orange-600",
    accentBg: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  {
    title: "Import / export teams",
    description:
      "Reduce back-and-forth with freight forwarders by delivering pre-grouped HS files on the first pass.",
    highlight: "Faster clearance",
    visual: <ImportExportVisual />,
    accent: "from-sky-500 to-cyan-600",
    accentBg: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  {
    title: "Compliance & audit",
    description:
      "Keep document history, classification rationale, and exports in one portal for internal review.",
    highlight: "Traceability",
    visual: <ComplianceVisual />,
    accent: "from-indigo-500 to-violet-600",
    accentBg: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  },
];

export function SolutionsSection() {
  return (
    <MotionSection id="solutions" className="bg-white py-20 sm:py-28">
      <LandingWrap>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-14 sm:mb-16">
          <FadeInView className="max-w-xl">
            <p className="text-sm font-medium text-[#007bff] mb-2">Solutions</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Built for customs professionals
            </h2>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Whether you run a brokerage or an in-house trade desk, Impact
              Logistics fits how you already work with packing lists and
              declarations.
            </p>
          </FadeInView>

          <motion.div
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="relative landing-float-card rounded-2xl p-6 lg:max-w-xs w-full overflow-hidden border border-gray-100"
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#007bff]/10 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative">
              <p className="text-4xl font-bold bg-gradient-to-br from-[#007bff] to-indigo-600 bg-clip-text text-transparent">
                10×
              </p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                faster than manual HS grouping on large line-item lists
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#007bff] to-indigo-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: "100%" }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-[#007bff]">vs manual</span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="grid md:grid-cols-3 gap-6 lg:gap-8"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {solutions.map((item) => (
            <MotionItem key={item.title} variants={fadeUp}>
              <motion.article
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="group landing-float-card rounded-2xl bg-white border border-gray-100/80 h-full flex flex-col overflow-hidden"
              >
                <div className="relative">
                  {item.visual}
                  <span
                    className={`absolute right-4 top-4 z-10 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${item.accentBg}`}
                  >
                    {item.highlight}
                  </span>
                </div>

                <div className="flex flex-col flex-1 p-6 sm:p-7">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 tracking-tight group-hover:text-[#007bff] transition-colors duration-200">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1">
                    {item.description}
                  </p>

                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2">
                    <span
                      className={`h-1.5 w-8 rounded-full bg-gradient-to-r ${item.accent}`}
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium text-gray-400">
                      {item.highlight}
                    </p>
                  </div>
                </div>
              </motion.article>
            </MotionItem>
          ))}
        </motion.div>
      </LandingWrap>
    </MotionSection>
  );
}
