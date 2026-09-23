"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { easeOut } from "./motion";

export type HowItWorksStep = {
  id: string;
  label: string;
};

type HowItWorksPhaseProps = {
  eyebrow: string;
  title: ReactNode;
  tags: string[];
  subhead: string;
  steps: HowItWorksStep[];
  renderDemo: (activeIndex: number) => ReactNode;
  className?: string;
};

/** Viewport height per step while scrolling (desktop only) */
const STEP_VH = 75;

export function HowItWorksPhase({
  eyebrow,
  title,
  tags,
  subhead,
  steps,
  renderDemo,
  className = "",
}: HowItWorksPhaseProps) {
  const reduced = useReducedMotion();
  const baseId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isClickScrolling, setIsClickScrolling] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const clickLockRef = useRef(false);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    // Desktop scroll scrub only — mobile uses tap
    if (
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 1024px)").matches
    ) {
      return;
    }
    if (clickLockRef.current || steps.length === 0) return;
    const clamped = Math.min(0.999, Math.max(0, progress));
    const next = Math.min(
      steps.length - 1,
      Math.floor(clamped * steps.length),
    );
    setActiveIndex((prev) => (prev === next ? prev : next));
  });

  const scrollToStep = useCallback(
    (index: number) => {
      const maxIndex = steps.length - 1;
      const target = Math.max(0, Math.min(maxIndex, index));
      setActiveIndex(target);

      const desktop =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 1024px)").matches;
      if (!desktop) return;

      const track = trackRef.current;
      if (!track || steps.length === 0) return;

      const rect = track.getBoundingClientRect();
      const trackTop = window.scrollY + rect.top;
      const scrollable = track.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const progress = maxIndex === 0 ? 0 : (target + 0.5) / steps.length;
      const top = trackTop + progress * scrollable;

      clickLockRef.current = true;
      setIsClickScrolling(true);
      window.scrollTo({
        top,
        behavior: reduced ? "auto" : "smooth",
      });

      window.setTimeout(
        () => {
          clickLockRef.current = false;
          setIsClickScrolling(false);
        },
        reduced ? 50 : 700,
      );
    },
    [reduced, steps.length],
  );

  const goTo = useCallback(
    (index: number) => {
      scrollToStep(index);
    },
    [scrollToStep],
  );

  const onTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      let next = index;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        next = (index + 1) % steps.length;
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        next = (index - 1 + steps.length) % steps.length;
      } else if (event.key === "Home") {
        event.preventDefault();
        next = 0;
      } else if (event.key === "End") {
        event.preventDefault();
        next = steps.length - 1;
      } else {
        return;
      }
      goTo(next);
      tabRefs.current[next]?.focus();
    },
    [goTo, steps.length],
  );

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const nodeTopPercent =
    steps.length <= 1 ? 50 : (activeIndex / (steps.length - 1)) * 100;

  const stepCount = Math.max(steps.length, 1);

  return (
    <div
      ref={trackRef}
      className={`how-it-works-track relative min-w-0 ${className}`}
      style={
        {
          "--how-steps": String(stepCount),
          "--how-step-vh": `${STEP_VH}vh`,
        } as CSSProperties
      }
    >
      {/*
        Sticky + tall track are CSS-driven on lg+ so scroll scrub works
        immediately on desktop (not gated on a JS media hook).
      */}
      <div className="py-2 lg:sticky lg:top-[var(--landing-nav-offset,4.75rem)] lg:py-10">
        {/* Mobile header */}
        <div className="lg:hidden mb-5 min-w-0">
          <p className="text-sm font-medium text-[#007bff] mb-2">{eyebrow}</p>
          <h2 className="text-[1.65rem] sm:text-3xl font-bold text-gray-900 tracking-tight leading-[1.15] break-words">
            {title}
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium text-gray-400 tracking-wide"
              >
                #{tag}
              </span>
            ))}
          </div>
          <p className="text-base font-semibold text-[#007bff] leading-snug">
            {subhead}
          </p>
        </div>

        {/* Mobile dots */}
        <div
          className="lg:hidden flex items-center justify-center gap-2 mb-5"
          role="presentation"
        >
          {steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => goTo(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex ? "w-8 bg-[#007bff]" : "w-1.5 bg-gray-200"
              }`}
              aria-label={`Go to step ${index + 1}: ${step.label}`}
              aria-current={index === activeIndex ? "step" : undefined}
            />
          ))}
        </div>

        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,0.95fr)_auto_minmax(0,1.35fr)] lg:gap-6 xl:gap-10 lg:items-start">
          {/* Steps — after demo on mobile, left column on desktop */}
          <div className="order-2 lg:order-1 lg:pt-4">
            <div className="hidden lg:block">
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium text-gray-400 tracking-wide"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <p className="text-xl font-semibold text-[#007bff] mb-6 leading-snug">
                {subhead}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white/80 p-2 sm:p-3 shadow-sm lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              <ul
                className="space-y-0.5 sm:space-y-1"
                role="tablist"
                aria-label="How it works steps"
                aria-orientation="vertical"
              >
                {steps.map((step, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <li key={step.id}>
                      <button
                        ref={(el) => {
                          tabRefs.current[index] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`${baseId}-tab-${index}`}
                        aria-selected={isActive}
                        aria-controls={`${baseId}-panel`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => goTo(index)}
                        onKeyDown={(e) => onTabKeyDown(e, index)}
                        className={`group flex w-full items-baseline gap-2.5 sm:gap-3 rounded-lg px-2 py-2 sm:py-2.5 text-left transition-colors duration-200 ${
                          isActive
                            ? "text-gray-900 bg-blue-50/80 lg:bg-transparent"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <span
                          className={`text-[11px] sm:text-xs font-semibold tabular-nums shrink-0 transition-colors ${
                            isActive
                              ? "text-[#007bff]"
                              : "text-gray-300 group-hover:text-gray-400"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`text-sm sm:text-base lg:text-lg leading-snug transition-all ${
                            isActive ? "font-bold" : "font-medium"
                          }`}
                        >
                          {step.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 px-2 text-[11px] text-gray-400 lg:hidden">
                Tap a step to preview
              </p>
              <p className="mt-6 text-xs text-gray-400 hidden lg:block">
                {isClickScrolling
                  ? "Jumping to step…"
                  : "Scroll to advance steps"}
              </p>
            </div>
          </div>

          {/* Timeline — desktop only */}
          <div
            className="order-1 hidden lg:order-2 lg:flex flex-col items-center self-stretch pt-4 pb-8 px-2"
            aria-hidden
          >
            <div className="relative flex-1 w-px min-h-[280px]">
              <div className="absolute inset-0 bg-gradient-to-b from-[#007bff]/40 via-gray-200 to-gray-100 rounded-full" />
              <motion.div
                className="absolute left-1/2 top-0 w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#007bff] to-[#007bff]/30 shadow-[0_0_12px_rgba(0,123,255,0.45)]"
                animate={{ height: `${Math.max(12, nodeTopPercent)}%` }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 280, damping: 28 }
                }
              />
              <motion.div
                className="absolute left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#007bff] text-white shadow-lg shadow-blue-500/35 ring-4 ring-white"
                animate={{ top: `${nodeTopPercent}%` }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 280, damping: 28 }
                }
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <title>Active step</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </motion.div>
            </div>
          </div>

          {/* Demo — first on mobile, right column on desktop */}
          <div className="order-1 lg:order-3 min-w-0">
            <div className="hidden lg:block mb-6">
              <p className="text-sm font-medium text-[#007bff] mb-2">{eyebrow}</p>
              <h2 className="text-3xl xl:text-4xl font-bold text-gray-900 tracking-tight">
                {title}
              </h2>
            </div>

            <div
              role="tabpanel"
              id={`${baseId}-panel`}
              aria-labelledby={`${baseId}-tab-${activeIndex}`}
              className="relative min-w-0 w-full overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={steps[activeIndex]?.id ?? activeIndex}
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: reduced ? 0 : 0.35, ease: easeOut }}
                  className="min-w-0"
                >
                  {renderDemo(activeIndex)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
