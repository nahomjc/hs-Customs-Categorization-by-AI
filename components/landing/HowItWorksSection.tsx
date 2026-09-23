"use client";

import { LandingWrap } from "./LandingWrap";
import { HowItWorksPhase } from "./HowItWorksPhase";
import {
  ClassifyDemoVisual,
  ExportDemoVisual,
  ReviewDemoVisual,
  UploadDemoVisual,
} from "./HowItWorksStepVisuals";

const steps = [
  { id: "upload", label: "Drop a packing list" },
  { id: "classify", label: "AI maps every line to HS" },
  { id: "review", label: "Review groups in one dashboard" },
  { id: "export", label: "Export declaration-ready Excel" },
] as const;

const demoByIndex = [
  UploadDemoVisual,
  ClassifyDemoVisual,
  ReviewDemoVisual,
  ExportDemoVisual,
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-dot-grid py-8 sm:py-12 lg:py-14">
      <LandingWrap className="min-w-0">
        <HowItWorksPhase
          eyebrow="How it works?"
          title={
            <>
              Manage{" "}
              <em className="italic font-semibold text-[#007bff]">
                everything in one place
              </em>
            </>
          }
          tags={["Upload", "Classification"]}
          subhead="From raw packing list to grouped export."
          steps={[...steps]}
          renderDemo={(activeIndex) => {
            const Demo = demoByIndex[activeIndex] ?? demoByIndex[0];
            return <Demo />;
          }}
        />
      </LandingWrap>
    </section>
  );
}
