import { Suspense } from "react";
import { DemoRequestForm } from "@/components/demo/DemoRequestForm";

export const metadata = {
  title: "Request a demo — Impact Logistics",
  description:
    "Schedule a free demo of AI-powered HS code packing list categorization.",
};

export default function DemoPage() {
  return (
    <div className="space-y-6">
      <div className="text-center px-2">
        <p className="text-sm font-medium text-[#007bff] mb-2">Free demo</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          See HS categorization in action
        </h1>
        <p className="mt-2 text-gray-500 text-sm sm:text-base leading-relaxed">
          Tell us about your team and we&apos;ll schedule a personalized
          walkthrough of Impact Logistics.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="landing-float-card bg-white rounded-2xl p-8 text-center text-gray-500 text-sm">
            Loading form…
          </div>
        }
      >
        <DemoRequestForm />
      </Suspense>
    </div>
  );
}
