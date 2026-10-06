import type { Metadata } from "next";
import { FinalCta } from "@/components/landing/FinalCta";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { LandingNav } from "@/components/landing/LandingNav";
import { Showcase } from "@/components/landing/Showcase";
import { ValueStrip } from "@/components/landing/ValueStrip";

export const metadata: Metadata = {
  title: "MoneyMitra — Your money, finally in one place",
  description:
    "MoneyMitra helps Indian salaried users understand taxes, organize financial documents, compare tax regimes, and get personalized financial guidance.",
};

/**
 * Runs before first paint so below-the-fold reveals start hidden with no
 * flash. Skipped under reduced motion; a failsafe un-hides everything if the
 * page script never loads.
 */
const MOTION_BOOT = `(function(){try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var d=document.documentElement;d.classList.add("mm-motion");window.__mmFailsafe=setTimeout(function(){d.classList.remove("mm-motion")},8000)}catch(e){}})()`;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      <LandingMotion />
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <ValueStrip />
        <Features />
        <HowItWorks />
        <Showcase />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
