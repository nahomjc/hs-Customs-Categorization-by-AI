"use client";

import { motion } from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import { FadeInView, MotionItem, MotionSection, fadeUp, scaleIn } from "./motion";

const solutions = [
  {
    title: "Customs brokers",
    description:
      "Process dozens of client packing lists per week with consistent HS grouping and audit-ready exports.",
    highlight: "High volume",
  },
  {
    title: "Import / export teams",
    description:
      "Reduce back-and-forth with freight forwarders by delivering pre-grouped HS files on the first pass.",
    highlight: "Faster clearance",
  },
  {
    title: "Compliance & audit",
    description:
      "Keep document history, classification rationale, and exports in one portal for internal review.",
    highlight: "Traceability",
  },
];

export function SolutionsSection() {
  return (
    <MotionSection id="solutions" className="bg-white py-20 sm:py-28">
      <LandingWrap>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-14">
          <FadeInView className="max-w-xl">
            <p className="text-sm font-medium text-[#007bff] mb-2">Solutions</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Built for customs professionals
            </h2>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Whether you run a brokerage or an in-house trade desk, Impact
              Logistics
              fits how you already work with packing lists and declarations.
            </p>
          </FadeInView>
          <motion.div
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="landing-float-card bg-gray-50 rounded-2xl p-6 lg:max-w-xs w-full"
          >
            <p className="text-2xl font-bold text-gray-900">10×</p>
            <p className="text-sm text-gray-500 mt-1">
              faster than manual HS grouping on large line-item lists
            </p>
          </motion.div>
        </div>

        <motion.div
          className="grid md:grid-cols-3 gap-5"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {solutions.map((item) => (
            <MotionItem key={item.title} variants={fadeUp}>
              <motion.article
                whileHover={{ y: -5 }}
                className="landing-float-card rounded-2xl p-6 bg-white border border-gray-100 h-full"
              >
                <span className="inline-block text-xs font-medium text-[#007bff] bg-blue-50 px-2.5 py-1 rounded-full mb-4">
                  {item.highlight}
                </span>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </motion.article>
            </MotionItem>
          ))}
        </motion.div>
      </LandingWrap>
    </MotionSection>
  );
}
