"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { IntroLoaderBrand } from "./IntroLoaderBrand";
import { IntroLoaderMark } from "./IntroLoaderMark";

const MIN_VISIBLE_MS = 2000;
const MAX_VISIBLE_MS = 4000;
const easeOut = [0.22, 1, 0.36, 1] as const;

const LOADER_TICKS = Array.from({ length: 12 }, (_, tickIndex) => ({
  id: `intro-loader-tick-${tickIndex}`,
  tickIndex,
}));

export function IntroLoader() {
  const reducedMotion = useReducedMotion();
  const finishedRef = useRef(false);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const motionOn = !reducedMotion && !exiting;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setExiting(true);
    window.setTimeout(() => setVisible(false), 680);
  }, []);

  useEffect(() => {
    if (!visible || exiting) return;

    const shownAt = performance.now();
    let hideTimer: number | undefined;

    const scheduleHide = () => {
      const elapsed = performance.now() - shownAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      hideTimer = window.setTimeout(finish, remaining);
    };

    const maxTimer = window.setTimeout(finish, MAX_VISIBLE_MS);

    if (document.readyState === "complete") {
      scheduleHide();
    } else {
      window.addEventListener("load", scheduleHide, { once: true });
    }

    return () => {
      window.clearTimeout(maxTimer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      window.removeEventListener("load", scheduleHide);
    };
  }, [visible, exiting, finish]);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !reducedMotion || exiting) return;
    const t = window.setTimeout(finish, 500);
    return () => window.clearTimeout(t);
  }, [visible, reducedMotion, exiting, finish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.output
          key="intro-loader"
          aria-live="polite"
          aria-label="Loading Impact Logistics"
          className="intro-loader fixed inset-0 z-9999 flex items-center justify-center border-0 p-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: exiting ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: easeOut }}
        >
          <div className="intro-loader__ambient" aria-hidden>
            <div className="intro-loader__mesh" />
            <div className="intro-loader__grid" />
            <div className="intro-loader__vignette" />
            {motionOn && <div className="intro-loader__scan" />}
          </div>

          <motion.div
            className="intro-loader__hero"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={
              exiting
                ? { opacity: 0, scale: 1.1, filter: "blur(12px)" }
                : { opacity: 1, scale: 1, filter: "blur(0px)" }
            }
            transition={{
              duration: exiting ? 0.62 : 0.8,
              ease: easeOut,
            }}
          >
            <div className="intro-loader__mark-wrap">
              {motionOn && (
                <>
                  <div className="intro-loader__orbit intro-loader__orbit--outer" />
                  <div className="intro-loader__orbit intro-loader__orbit--inner" />
                  <div className="intro-loader__pulse" />
                  <div className="intro-loader__pulse intro-loader__pulse--delay" />
                </>
              )}

              <div className="intro-loader__core-glow" aria-hidden />

              <div className={motionOn ? "intro-loader__spin" : undefined}>
                <IntroLoaderMark />
              </div>

              {motionOn && (
                <div className="intro-loader__ticks" aria-hidden>
                  {LOADER_TICKS.map(({ id, tickIndex }) => (
                    <span
                      key={id}
                      className="intro-loader__tick"
                      style={{ "--i": tickIndex } as CSSProperties}
                    />
                  ))}
                </div>
              )}
            </div>

            <IntroLoaderBrand
              motionOn={motionOn}
              exiting={exiting}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        </motion.output>
      )}
    </AnimatePresence>
  );
}
