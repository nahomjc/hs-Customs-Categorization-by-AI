"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function AnimatedNumber({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const duration = 1400;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Soft About-like wash — calm lavender-grey + brand blue */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f4f6fb] via-[var(--landing-bg)] to-[#eef2f9]" />
      <div className="hero-mesh-blob absolute -top-40 left-[20%] h-[480px] w-[720px] rounded-full bg-gradient-to-b from-[#007bff]/10 via-sky-200/15 to-transparent blur-3xl" />
      <div className="hero-mesh-blob hero-mesh-blob--delay absolute -right-28 top-24 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[var(--landing-bg)] via-[var(--landing-bg)]/70 to-transparent" />
    </div>
  );
}

const marqueeItems = [
  "PDF packing lists",
  "Excel line items",
  "Word documents",
  "HS code grouping",
  "Customs declaration",
  "Audit trail",
  "Telegram alerts",
  "Bulk export",
  "AI classification",
  "Broker workflows",
];

export function HeroMarquee() {
  const items = [
    ...marqueeItems.map((label, i) => ({ id: `a-${label}-${i}`, label })),
    ...marqueeItems.map((label, i) => ({ id: `b-${label}-${i}`, label })),
  ];

  return (
    <div className="relative mt-14 sm:mt-16 w-full border-t border-gray-200/60 bg-white/50 backdrop-blur-sm overflow-hidden">
      <div className="flex py-4">
        <div className="hero-marquee-track flex shrink-0 items-center gap-3">
          {items.map((item) => (
            <span
              key={item.id}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-200/80 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 shadow-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#007bff]/70" aria-hidden />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeroHeadlineWords({
  reduced,
  className,
  children,
  delay = 0,
}: {
  reduced: boolean;
  className?: string;
  children: string;
  delay?: number;
}) {
  const words = children.split(" ");

  const tokens = words.map((word, i) => ({ id: `${delay}-${word}-${i}`, word }));

  return (
    <span className={className}>
      {tokens.map((token, i) => (
        <motion.span
          key={token.id}
          className="inline-block mr-[0.25em]"
          initial={reduced ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            delay: delay + i * 0.07,
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {token.word}
        </motion.span>
      ))}
    </span>
  );
}
