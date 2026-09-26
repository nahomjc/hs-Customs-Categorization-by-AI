"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";

const easeOut = [0.22, 1, 0.36, 1] as const;
const TITLE = "IMPACT";

const TITLE_LETTERS = Array.from(TITLE, (char, position) => ({
  id: `intro-brand-letter-${char}-${position}`,
  char,
  position,
}));

type IntroLoaderBrandProps = {
  motionOn: boolean;
  exiting: boolean;
  reducedMotion: boolean | null;
};

export function IntroLoaderBrand({
  motionOn,
  exiting,
  reducedMotion,
}: IntroLoaderBrandProps) {
  const animateLetters = !reducedMotion && !exiting;

  return (
    <div className="intro-loader__brand">
      <motion.div
        className="intro-loader__brand-rule"
        aria-hidden
        initial={animateLetters ? { scaleX: 0, opacity: 0 } : false}
        animate={
          exiting ? { scaleX: 0, opacity: 0 } : { scaleX: 1, opacity: 1 }
        }
        transition={{ duration: 0.55, delay: 0.2, ease: easeOut }}
      />

      <h1 className="intro-loader__title" aria-label="Impact">
        {TITLE_LETTERS.map(({ id, char, position }) => (
          <span
            key={id}
            className={`intro-loader__letter${
              !reducedMotion ? " intro-loader__letter--enter" : ""
            }${exiting ? " intro-loader__letter--exit" : ""}`}
            style={
              {
                "--letter-i": position,
              } as CSSProperties
            }
          >
            {char}
          </span>
        ))}
      </h1>

      <motion.p
        className="intro-loader__subtitle"
        initial={
          animateLetters ? { opacity: 0, letterSpacing: "0.6em" } : false
        }
        animate={
          exiting ? { opacity: 0 } : { opacity: 1, letterSpacing: "0.42em" }
        }
        transition={{ duration: 0.65, delay: 0.72, ease: easeOut }}
      >
        LOGISTICS
      </motion.p>

      {motionOn && <div className="intro-loader__brand-scan" aria-hidden />}
    </div>
  );
}
