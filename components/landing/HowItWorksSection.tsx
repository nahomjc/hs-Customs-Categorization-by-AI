"use client";

import { motion } from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import { FadeInView, MotionItem, MotionSection, fadeUp } from "./motion";

const steps = [
  {
    step: "01",
    title: "Upload your packing list",
    description:
      "Drag and drop PDF, Word, or Excel files. We extract line items and quantities automatically.",
  },
  {
    step: "02",
    title: "AI classifies by HS code",
    description:
      "Our engine groups items under the right HS headings using rules aligned with customs practice.",
  },
  {
    step: "03",
    title: "Review and export",
    description:
      "Verify groups in the dashboard, chat about edge cases, then download your grouped Excel file.",
  },
];

export function HowItWorksSection() {
  return (
    <MotionSection id="how-it-works" className="landing-dot-grid py-20 sm:py-28">
      <LandingWrap>
        <FadeInView className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-medium text-[#007bff] mb-2">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Three steps to a grouped file
          </h2>
          <p className="mt-4 text-gray-500 leading-relaxed">
            No manual spreadsheet wrangling — go from raw packing list to
            declaration-ready output in minutes.
          </p>
        </FadeInView>

        <motion.div
          className="grid md:grid-cols-3 gap-6"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {steps.map((item, index) => (
            <MotionItem key={item.step} variants={fadeUp}>
              <motion.div
                whileHover={{ y: -4 }}
                className="relative landing-float-card bg-white rounded-2xl p-8 h-full"
              >
                {index < steps.length - 1 && (
                  <div
                    className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gray-200 z-10"
                    aria-hidden
                  />
                )}
                <motion.span
                  className="inline-block text-4xl font-bold text-gray-100 mb-4"
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                >
                  {item.step}
                </motion.span>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            </MotionItem>
          ))}
        </motion.div>
      </LandingWrap>
    </MotionSection>
  );
}
