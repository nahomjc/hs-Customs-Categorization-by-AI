"use client";

import { useCallback, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import { FadeInView, MotionSection, easeOut, fadeUp } from "./motion";

const features = [
  {
    title: "Smart HS classification",
    description:
      "AI maps line items to HS codes using assessor-style rules and your customs context.",
    tag: "Classification",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
  },
  {
    title: "Multi-format upload",
    description:
      "Drop PDF, Word, or Excel packing lists. We parse tables and line items automatically.",
    tag: "Ingestion",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
    ),
  },
  {
    title: "Grouped export",
    description:
      "Download HS-code grouped spreadsheets ready for declaration and audit trails.",
    tag: "Export",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    title: "Review & chat",
    description:
      "Inspect classifications per document, adjust groups, and ask questions in context.",
    tag: "Review",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
  },
  {
    title: "Telegram monitoring",
    description:
      "Real-time alerts on uploads, HS classification progress, exports, and exceptions — straight to your ops channel.",
    tag: "Alerts",
    icon: (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
      </svg>
    ),
  },
  {
    title: "Job history",
    description:
      "Track every upload, status, and export from a single dashboard with full history.",
    tag: "History",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    title: "Team-ready",
    description:
      "Built for brokers and in-house customs teams handling high-volume shipments.",
    tag: "Teams",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

const VISIBLE_DEPTH = 3;

function stackOffset(distance: number) {
  if (distance === 0) {
    return { y: 0, scale: 1, rotate: 0, opacity: 1 };
  }
  if (distance === 1) {
    return { y: 18, scale: 0.96, rotate: -2.5, opacity: 0.92 };
  }
  return { y: 34, scale: 0.92, rotate: 2.5, opacity: 0.78 };
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

function FeatureCardStack() {
  const reduced = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const goTo = useCallback((index: number) => {
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  }, [activeIndex]);

  const goPrev = useCallback(() => {
    const next = (activeIndex - 1 + features.length) % features.length;
    setDirection(-1);
    setActiveIndex(next);
  }, [activeIndex]);

  const goNext = useCallback(() => {
    const next = (activeIndex + 1) % features.length;
    setDirection(1);
    setActiveIndex(next);
  }, [activeIndex]);

  const activeFeature = features[activeIndex];

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:items-center">
      {/* Feature list — quick nav (desktop) */}
      <div className="order-2 lg:order-1 hidden lg:block">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Workflow capabilities
          </p>
          <p className="text-sm font-medium text-gray-500 tabular-nums">
            <span className="text-gray-900">{String(activeIndex + 1).padStart(2, "0")}</span>
            <span className="mx-1 text-gray-300">/</span>
            {String(features.length).padStart(2, "0")}
          </p>
        </div>

        <ul className="space-y-2" role="tablist" aria-label="Feature cards">
          {features.map((feature, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={feature.title}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`feature-panel-${index}`}
                  id={`feature-tab-${index}`}
                  onClick={() => goTo(index)}
                  className={`group w-full text-left rounded-xl px-4 py-3.5 transition-all duration-200 border ${
                    isActive
                      ? "bg-white border-gray-200 shadow-sm"
                      : "bg-transparent border-transparent hover:bg-gray-50 hover:border-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isActive
                          ? "bg-[#007bff] text-white shadow-sm shadow-blue-500/20"
                          : "bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-[#007bff]"
                      }`}
                    >
                      {feature.icon}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate transition-colors ${
                          isActive ? "text-gray-900" : "text-gray-600"
                        }`}
                      >
                        {feature.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{feature.tag}</p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Card stack */}
      <div className="order-1 lg:order-2">
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-blue-50/80 via-white to-sky-50/60 blur-2xl"
            aria-hidden="true"
          />

          <div
            className="relative h-[340px] sm:h-[360px]"
            role="tabpanel"
            id={`feature-panel-${activeIndex}`}
            aria-labelledby={`feature-tab-${activeIndex}`}
          >
            {features.map((feature, index) => {
              const distance =
                (index - activeIndex + features.length) % features.length;
              if (distance >= VISIBLE_DEPTH) return null;

              const offset = stackOffset(distance);
              const isTop = distance === 0;

              return (
                <motion.article
                  key={feature.title}
                  className={`absolute inset-x-0 top-0 mx-auto w-full max-w-[420px] ${
                    isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
                  }`}
                  style={{ zIndex: VISIBLE_DEPTH - distance }}
                  animate={{
                    y: offset.y,
                    scale: offset.scale,
                    rotate: offset.rotate,
                    opacity: offset.opacity,
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.45, ease: easeOut }
                  }
                  drag={isTop && !reduced ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.12}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -80 || info.velocity.x < -400) goNext();
                    else if (info.offset.x > 80 || info.velocity.x > 400) goPrev();
                  }}
                >
                  <div
                    className={`landing-float-card relative overflow-hidden rounded-2xl bg-white p-7 sm:p-8 h-[300px] sm:h-[320px] flex flex-col ${
                      isTop ? "border border-gray-100" : "border border-gray-100/80"
                    }`}
                  >
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-blue-100/70 to-transparent"
                      aria-hidden="true"
                    />

                    <div className="relative flex items-start justify-between gap-4 mb-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60 text-[#007bff] ring-1 ring-blue-100">
                        {feature.icon}
                      </div>
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-100">
                        {feature.tag}
                      </span>
                    </div>

                    <div className="relative flex-1">
                      <AnimatePresence mode="wait" custom={direction}>
                        {isTop && (
                          <motion.div
                            key={activeIndex}
                            custom={direction}
                            initial={
                              reduced
                                ? false
                                : {
                                    opacity: 0,
                                    x: direction >= 0 ? 24 : -24,
                                  }
                            }
                            animate={{ opacity: 1, x: 0 }}
                            exit={
                              reduced
                                ? undefined
                                : {
                                    opacity: 0,
                                    x: direction >= 0 ? -24 : 24,
                                  }
                            }
                            transition={{ duration: 0.3, ease: easeOut }}
                          >
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-snug">
                              {feature.title}
                            </h3>
                            <p className="mt-3 text-sm sm:text-[15px] text-gray-500 leading-relaxed">
                              {feature.description}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!isTop && (
                        <div className="opacity-60">
                          <h3 className="text-lg font-semibold text-gray-900 leading-snug">
                            {feature.title}
                          </h3>
                          <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                            {feature.description}
                          </p>
                        </div>
                      )}
                    </div>

                    {isTop && (
                      <div className="relative mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          Swipe or use arrows to explore
                        </p>
                        <div className="flex gap-1">
                          {features.map((item, dotIndex) => (
                            <button
                              key={item.title}
                              type="button"
                              aria-label={`Go to feature ${dotIndex + 1}`}
                              onClick={() => goTo(dotIndex)}
                              className={`h-1.5 rounded-full transition-all duration-200 ${
                                dotIndex === activeIndex
                                  ? "w-5 bg-[#007bff]"
                                  : "w-1.5 bg-gray-200 hover:bg-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>

          <div className="relative z-10 mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous feature"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:text-gray-900 hover:shadow"
            >
              <ChevronIcon direction="left" />
            </button>
            <p className="hidden sm:block text-sm text-gray-500 min-w-[10rem] text-center truncate px-2">
              {activeFeature.title}
            </p>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next feature"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:text-gray-900 hover:shadow"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <MotionSection id="features" className="bg-white py-20 sm:py-28">
      <LandingWrap>
        <FadeInView className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
          <p className="text-sm font-medium text-[#007bff] mb-2">Features</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Everything you need for HS workflows
          </h2>
          <p className="mt-4 text-gray-500 leading-relaxed">
            From upload to grouped export — designed for speed, accuracy, and
            customs compliance.
          </p>
        </FadeInView>

        <FadeInView variants={fadeUp}>
          <FeatureCardStack />
        </FadeInView>
      </LandingWrap>
    </MotionSection>
  );
}
