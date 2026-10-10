import type { Metadata } from "next";
import { FinalCta } from "@/components/landing/FinalCta";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { LandingNav } from "@/components/landing/LandingNav";
import { NextMove } from "@/components/landing/NextMove";
import { Problem } from "@/components/landing/Problem";
import { Showcase } from "@/components/landing/Showcase";
import { YearRound } from "@/components/landing/YearRound";

export const metadata: Metadata = {
  title: "MoneyMitra — Your money, finally in one place",
  description:
    "MoneyMitra helps Indian salaried users understand taxes, organize financial documents, compare tax regimes, and get personalized financial guidance.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <LandingMotion />
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Showcase />
        <NextMove />
        <YearRound />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
