"use client";

import {
  type HTMLMotionProps,
  type TargetAndTransition,
  type Variants,
  motion,
  useReducedMotion,
} from "framer-motion";
import type { ReactNode } from "react";

export const easeOut = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOut },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: easeOut },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: easeOut },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

export function slideFrom(
  direction: "left" | "right" | "up" | "down",
  distance = 36,
): Variants {
  const offset = {
    left: { x: -distance, y: 0 },
    right: { x: distance, y: 0 },
    up: { x: 0, y: distance },
    down: { x: 0, y: -distance },
  }[direction];

  return {
    hidden: { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.65, ease: easeOut },
    },
  };
}

export function floatAnimation(
  reduced: boolean,
): TargetAndTransition | undefined {
  if (reduced) return undefined;
  return {
    y: [0, -10, 0],
    transition: {
      duration: 5,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut",
    },
  };
}

type FadeInViewProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  variants?: Variants;
};

export function FadeInView({
  children,
  className,
  delay = 0,
  variants = fadeUp,
}: FadeInViewProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView={reduced ? undefined : "visible"}
      viewport={{ once: true, margin: "-72px" }}
      variants={variants}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

type MotionSectionProps = HTMLMotionProps<"section"> & {
  children: ReactNode;
};

export function MotionSection({
  children,
  className,
  id,
  ...props
}: MotionSectionProps) {
  const reduced = useReducedMotion();

  return (
    <motion.section
      id={id}
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView={reduced ? undefined : "visible"}
      viewport={{ once: true, margin: "-80px" }}
      variants={staggerContainer}
      {...props}
    >
      {children}
    </motion.section>
  );
}

export function MotionItem({
  children,
  className,
  variants,
}: {
  children: ReactNode;
  className?: string;
  variants?: Variants;
}) {
  return (
    <motion.div className={className} variants={variants ?? fadeUp}>
      {children}
    </motion.div>
  );
}

export { motion };
