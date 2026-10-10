"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, Ref } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/Logo";
import { SCATTERED_SOURCES, TAX, inr } from "./demo-data";
import { Container, Eyebrow } from "./parts";

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * "Your financial life is scattered everywhere." Seven source cards start
 * scattered around the viewport and converge into a single "MoneyMitra" node
 * as the 260vh section scrolls past — matching the mockup's scroll-jacked
 * physics exactly (same progress curve, same per-card offsets).
 *
 * Falls back to a simple static grid under `prefers-reduced-motion: reduce`,
 * so the scroll-jacking is opt-out, not a requirement to see the content.
 */
export function Problem() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const nodeARef = useRef<HTMLDivElement>(null);
  const nodeBRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    let raf = 0;

    function update() {
      raf = 0;
      const sec = sectionRef.current;
      const stage = stageRef.current;
      if (!sec || !stage) return;

      const vh = window.innerHeight;
      const rect = sec.getBoundingClientRect();
      const total = rect.height - vh;
      const p = total > 0 ? Math.max(0, Math.min(1, -rect.top / total)) : 1;
      const e = smoothstep(0.1, 0.8, p);
      const k = 1 - e;
      const sc = Math.min(1, stage.clientWidth / 1440, stage.clientHeight / 620);

      SCATTERED_SOURCES.forEach((src, i) => {
        const x = src.x * sc;
        const y = src.y * sc;
        const card = cardRefs.current[i];
        if (card) {
          card.style.transform = `translate(-50%,-50%) translate(${x * k}px,${y * k}px) rotate(${src.r * k}deg) scale(${(1 - 0.45 * e) * Math.max(0.7, sc)})`;
          card.style.opacity = String(1 - smoothstep(0.7, 1, e));
        }
        const line = lineRefs.current[i];
        if (line) {
          line.setAttribute("x1", String(x * k));
          line.setAttribute("y1", String(y * k));
          line.style.opacity = String(1 - smoothstep(0.5, 0.9, e));
        }
      });

      if (nodeRef.current) {
        nodeRef.current.style.transform = `translate(-50%,-50%) scale(${(0.82 + 0.28 * e) * Math.max(0.75, sc)})`;
      }
      if (nodeARef.current) nodeARef.current.style.opacity = String(1 - smoothstep(0.6, 0.85, e));
      if (nodeBRef.current) nodeBRef.current.style.opacity = String(smoothstep(0.75, 1, e));
      if (glowRef.current) glowRef.current.style.opacity = String(smoothstep(0.6, 1, e));
      if (textRef.current) textRef.current.style.opacity = String(0.25 + 0.75 * smoothstep(0.6, 1, e));
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  const heading = (
    <>
      <Eyebrow>02 · The problem</Eyebrow>
      <h2 className="mx-auto mt-5 max-w-3xl text-h1 md:text-[44px]">Your financial life is scattered everywhere.</h2>
    </>
  );

  if (reducedMotion) {
    return (
      <section aria-label="The problem" className="py-16 md:py-24">
        <Container>
          <div className="mx-auto mb-14 flex max-w-2xl flex-col items-center gap-3 text-center md:mb-20">
            {heading}
            <p className="text-body text-muted md:text-lg">
              MoneyMitra brings the pieces together so you can understand the whole picture.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {SCATTERED_SOURCES.map((source) => (
              <SourceCard key={source.label} source={source} className="static w-full translate-x-0 translate-y-0 rotate-0" />
            ))}
            <div className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-lg border border-accent/40 bg-field p-3.5 text-center sm:col-span-1">
              <Logo markOnly height={20} />
              <span className="font-semibold text-foreground">MoneyMitra</span>
              <span className="font-mono text-[10px] text-accent-text">
                {SCATTERED_SOURCES.length} of {SCATTERED_SOURCES.length} connected
              </span>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section ref={sectionRef} aria-label="The problem" className="relative h-[260vh] overflow-x-clip">
      <div className="sticky top-0 flex h-screen min-h-[720px] flex-col overflow-hidden">
        <div className="relative z-[2] px-5 pt-24 text-center sm:pt-32">
          {heading}
          <p ref={textRef} className="mx-auto mt-5 max-w-lg text-body text-muted md:text-lg" style={{ opacity: 0.25 }}>
            MoneyMitra brings the pieces together so you can understand the whole picture.
          </p>
        </div>

        <div ref={stageRef} className="relative flex-1">
          <svg aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 overflow-visible" width="1" height="1">
            {SCATTERED_SOURCES.map((src, i) => (
              <line
                key={src.label}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                x1={src.x}
                y1={src.y}
                x2={0}
                y2={0}
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="3 6"
              />
            ))}
          </svg>

          {/* Center node: an empty "not connected" state that cross-fades into the converged "one picture" state. */}
          <div
            ref={nodeRef}
            className="absolute left-1/2 top-1/2 z-[1] h-[230px] w-[380px]"
            style={{ transform: "translate(-50%,-50%) scale(0.82)" }}
          >
            <div className="absolute inset-0 rounded-xl border border-line bg-card shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]" />
            <div
              ref={glowRef}
              className="absolute -inset-px rounded-xl border border-accent/55 shadow-[0_0_80px_-10px_rgba(101,242,164,0.4)]"
              style={{ opacity: 0 }}
            />
            <div ref={nodeARef} className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Logo markOnly height={28} />
              <span className="text-lg font-semibold text-foreground">MoneyMitra</span>
              <span className="font-mono text-xs text-muted">7 sources · not connected</span>
            </div>
            <div ref={nodeBRef} className="absolute inset-0 flex flex-col p-6" style={{ opacity: 0 }}>
              <div className="mb-auto flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] text-foreground">
                  <Logo markOnly height={13} />
                  One picture
                </span>
                <span className="font-mono text-[11px] text-link">7 of 7 connected</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] text-muted">Tax</p>
                  <p className="mt-1 font-mono text-[19px] text-foreground">₹1.43L</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Available</p>
                  <p className="mt-1 font-mono text-[19px] text-foreground">₹32.4K</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Invested</p>
                  <p className="mt-1 font-mono text-[19px] text-foreground">₹4.82L</p>
                </div>
              </div>
              <div className="mt-4 rounded-md bg-accent/10 px-3 py-2.5 text-[13px] text-accent-text">
                {inr(TAX.potentialSavings)} in tax savings found
              </div>
            </div>
          </div>

          {SCATTERED_SOURCES.map((src, i) => (
            <SourceCard
              key={src.label}
              source={src}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="absolute left-1/2 top-1/2 z-[2] w-[220px]"
              style={{ transform: `translate(-50%,-50%) translate(${src.x}px,${src.y}px) rotate(${src.r}deg)` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SourceCard({
  source,
  className,
  style,
  ref,
}: {
  source: (typeof SCATTERED_SOURCES)[number];
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-line bg-surface p-3.5 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-foreground">{source.label}</span>
        {source.tag && (
          <span
            className={cn(
              "shrink-0 font-mono text-[10px]",
              source.tagTone === "warning" ? "text-warning" : "text-muted",
            )}
          >
            {source.tag}
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] text-muted">{source.detail}</p>
        <p className="mt-0.5 font-mono text-sm text-foreground">{source.value}</p>
      </div>
    </div>
  );
}
