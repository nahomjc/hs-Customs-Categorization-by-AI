"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import {
  ClassifyStepVisual,
  ExportStepVisual,
  UploadStepVisual,
} from "./HowItWorksStepVisuals";
import { FadeInView, MotionItem, MotionSection, fadeUp } from "./motion";

const steps: {
  step: string;
  title: string;
  description: string;
  visual: ReactNode;
  accent: string;
}[] = [
  {
    step: "01",
    title: "Upload your packing list",
    description:
      "Drag and drop PDF, Word, or Excel files. We extract line items and quantities automatically.",
    visual: <UploadStepVisual />,
    accent: "from-sky-500 to-blue-600",
  },
  {
    step: "02",
    title: "AI classifies by HS code",
    description:
      "Our engine groups items under the right HS headings using rules aligned with customs practice.",
    visual: <ClassifyStepVisual />,
    accent: "from-indigo-500 to-violet-600",
  },
  {
    step: "03",
    title: "Review and export",
    description:
      "Verify groups in the dashboard, chat about edge cases, then download your grouped Excel file.",
    visual: <ExportStepVisual />,
    accent: "from-emerald-500 to-teal-600",
  },
];

export function HowItWorksSection() {
  return (
    <MotionSection id="how-it-works" className="landing-dot-grid py-20 sm:py-28">
      <LandingWrap>
        <FadeInView className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
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
          className="relative grid md:grid-cols-3 gap-6 lg:gap-8"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.14 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {/* Desktop connector line */}
          <div
            className="hidden md:block absolute top-[5.5rem] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent pointer-events-none"
            aria-hidden="true"
          />

          {steps.map((item, index) => (
            <MotionItem key={item.step} variants={fadeUp}>
              <motion.article
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="group relative landing-float-card bg-white rounded-2xl overflow-hidden h-full flex flex-col border border-gray-100/80"
              >
                {/* Visual header */}
                <div className="relative">
                  {item.visual}

                  {/* Step badge */}
                  <div className="absolute left-4 top-4 z-10">
                    <span
                      className={`inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-full bg-gradient-to-br ${item.accent} text-white text-xs font-bold shadow-lg shadow-black/10`}
                    >
                      {item.step}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="relative flex flex-col flex-1 p-6 sm:p-7">
                  {index < steps.length - 1 && (
                    <div
                      className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-300 shadow-sm"
                      aria-hidden="true"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <title>Next step</title>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}

                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 tracking-tight group-hover:text-[#007bff] transition-colors duration-200">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1">
                    {item.description}
                  </p>

                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${item.accent}`}
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium text-gray-400">
                      Step {index + 1} of {steps.length}
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
