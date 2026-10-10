"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DashboardMockSlide } from "@/components/auth/showcase/DashboardMockSlide";
import { JourneySlide } from "@/components/auth/showcase/JourneySlide";
import { OrbitSlide } from "@/components/auth/showcase/OrbitSlide";
import { cn } from "@/lib/cn";

const SLIDE_MS = 6000;

interface Slide {
  title: ReactNode;
  caption: string;
  visual: ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: (
      <>
        Your money, <span className="text-[#3155E0] dark:text-[#7B9AFF]">in one place</span>
      </>
    ),
    caption: "Connect your bank accounts and add Form 16, AIS and 26AS — MoneyMitra brings it together so you can see where you stand.",
    visual: <OrbitSlide />,
  },
  {
    title: (
      <>
        Know your <span className="text-[#3155E0] dark:text-[#7B9AFF]">next move</span>
      </>
    ),
    caption: "MoneyMitra reads your income, taxes and investments and points out what could save you money this year.",
    visual: <DashboardMockSlide />,
  },
  {
    title: (
      <>
        See where you&apos;re <span className="text-[#3155E0] dark:text-[#7B9AFF]">headed</span>
      </>
    ),
    caption: "My Journey turns your goals into a timeline, so you can see how today's decisions change where you end up.",
    visual: <JourneySlide />,
  },
];

/**
 * Light-mode-only brand panel for the auth screens: a slowly auto-rotating
 * carousel of real product previews (connected accounts, the dashboard,
 * My Journey) on a tinted panel — dark mode keeps its own separate
 * photo-showcase layout untouched. Every visual mirrors a real in-app
 * screen; only the exact figures/goal titles shown are illustrative,
 * same convention as the landing page's own product mockups.
 */
export function AuthBrandPanel({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, []);

  const slide = SLIDES[index];

  return (
    <div
      className={cn(
        "relative isolate hidden flex-col overflow-hidden rounded-3xl border border-line lg:flex",
        className,
      )}
      style={{ background: "linear-gradient(180deg, #EAF1FF, #F3F7FF)" }}
    >
      <div className="relative flex flex-1 flex-col justify-center gap-6 px-10 py-16 xl:px-12">
        <h2 className="text-center text-3xl font-semibold leading-tight tracking-tight text-foreground xl:text-[34px]">
          {slide.title}
        </h2>

        <div className="min-h-0 flex-1">{slide.visual}</div>

        <p className="mx-auto max-w-md text-center text-sm leading-relaxed text-muted">{slide.caption}</p>
      </div>

      <div className="absolute inset-x-0 bottom-7 flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-7 bg-[#3155E0] dark:bg-[#7B9AFF]" : "w-3.5 bg-line hover:bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
