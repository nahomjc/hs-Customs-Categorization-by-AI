"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LandingWrap } from "./LandingWrap";
import { FadeInView, MotionItem, MotionSection, fadeUp } from "./motion";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "to try",
    description: "Explore uploads and classification on sample documents.",
    features: ["5 documents / month", "Excel export", "Email support"],
    cta: "Get started",
    href: "/dashboard",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "Custom",
    period: "per team",
    description: "For brokers and teams with steady shipment volume.",
    features: [
      "Unlimited documents",
      "Priority processing",
      "History & audit trail",
      "Dedicated onboarding",
    ],
    cta: "Get demo",
    href: "/demo?source=pricing",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    period: "",
    description: "SSO, SLAs, and integrations for large customs operations.",
    features: [
      "Custom rules & HS tables",
      "API access",
      "Volume pricing",
      "24/7 support",
    ],
    cta: "Contact sales",
    href: "/login",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <MotionSection id="pricing" className="landing-dot-grid py-20 sm:py-28">
      <LandingWrap>
        <FadeInView className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-medium text-[#007bff] mb-2">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Simple plans that scale with you
          </h2>
          <p className="mt-4 text-gray-500 leading-relaxed">
            Start free, then upgrade when your team is ready for production
            volume.
          </p>
        </FadeInView>

        <motion.div
          className="grid md:grid-cols-3 gap-6 items-stretch"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {plans.map((plan) => (
            <MotionItem key={plan.name} variants={fadeUp}>
              <motion.div
                whileHover={{
                  y: plan.highlighted ? -8 : -5,
                  scale: plan.highlighted ? 1.02 : 1.01,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`landing-float-card rounded-2xl p-8 flex flex-col h-full ${
                  plan.highlighted
                    ? "bg-gray-900 text-white ring-2 ring-[#007bff]"
                    : "bg-white"
                }`}
              >
                <h3
                  className={`font-semibold text-lg ${
                    plan.highlighted ? "text-white" : "text-gray-900"
                  }`}
                >
                  {plan.name}
                </h3>
                <div className="mt-4 mb-2">
                  <span
                    className={`text-3xl font-bold ${
                      plan.highlighted ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span
                      className={`text-sm ml-1 ${
                        plan.highlighted ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {plan.period}
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm mb-6 ${
                    plan.highlighted ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {plan.description}
                </p>
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className={`text-sm flex items-center gap-2 ${
                        plan.highlighted ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      <svg
                        className="w-4 h-4 shrink-0 text-[#007bff]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <title>Included</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href={plan.href}
                    className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                      plan.highlighted
                        ? "bg-[#007bff] text-white hover:bg-[#0069d9]"
                        : "border border-gray-200 text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </motion.div>
              </motion.div>
            </MotionItem>
          ))}
        </motion.div>
      </LandingWrap>
    </MotionSection>
  );
}
