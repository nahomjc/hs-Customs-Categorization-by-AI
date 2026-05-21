"use client";

import { motion } from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import { FadeInView, MotionItem, MotionSection, fadeUp } from "./motion";

const features = [
  {
    title: "Smart HS classification",
    description:
      "AI maps line items to HS codes using assessor-style rules and your customs context.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Multi-format upload",
    description:
      "Drop PDF, Word, or Excel packing lists. We parse tables and line items automatically.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    title: "Grouped export",
    description:
      "Download HS-code grouped spreadsheets ready for declaration and audit trails.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Review & chat",
    description:
      "Inspect classifications per document, adjust groups, and ask questions in context.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    title: "Job history",
    description:
      "Track every upload, status, and export from a single dashboard with full history.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Team-ready",
    description:
      "Built for brokers and in-house customs teams handling high-volume shipments.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function FeaturesSection() {
  return (
    <MotionSection id="features" className="bg-white py-20 sm:py-28">
      <LandingWrap>
        <FadeInView className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-medium text-[#007bff] mb-2">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Everything you need for HS workflows
          </h2>
          <p className="mt-4 text-gray-500 leading-relaxed">
            From upload to grouped export — designed for speed, accuracy, and
            customs compliance.
          </p>
        </FadeInView>

        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {features.map((feature) => (
            <MotionItem key={feature.title} variants={fadeUp}>
              <motion.div
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="landing-float-card bg-white rounded-2xl p-6 h-full"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#007bff] flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            </MotionItem>
          ))}
        </motion.div>
      </LandingWrap>
    </MotionSection>
  );
}
