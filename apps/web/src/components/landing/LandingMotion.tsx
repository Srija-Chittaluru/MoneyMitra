"use client";

import { useLayoutEffect } from "react";
import "./motion.css";

/**
 * Drives the landing page's scroll motion. Every time a `[data-reveal]`
 * element enters the viewport it plays its reveal; when it has fully left the
 * viewport it is snapped back to its hidden state (off-screen, so nothing is
 * seen) and will play again on the next entry. `[data-countup]` numbers count
 * up on each entry the same way, and the hero copy replays its load-in.
 *
 * Renders nothing and touches no markup beyond toggling classes / transient
 * inline styles. Hidden-until-revealed styling only applies while
 * `html.mm-motion` is set (and never under `prefers-reduced-motion`), so the
 * page is fully visible if this never runs.
 */

const ROOT_CLASS = "mm-motion";
const STAGGER_MS = 70;
const MAX_STAGGER_STEPS = 5;
const REVEAL_SETTLE_MS = 900;
const REVEAL_RATIO = 0.1;
const COUNT_RATIO = 0.3;
// Reveal a little before an element reaches the very bottom edge of the screen.
const ENTER_MARGIN = "0px 0px -6% 0px";
// Reset only once an element is clear of the viewport by more than its hidden-pose
// offset (--mm-rise, at most 16px), so snapping it back can never nudge it into view.
const EXIT_MARGIN = "20px 0px 20px 0px";

declare global {
  interface Window {
    __mmFailsafe?: number;
  }
}

function domOrder(a: Element, b: Element): number {
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const indianGrouping = new Intl.NumberFormat("en-IN");

function parseCount(text: string) {
  const match = text.match(/^(\D*)(\d[\d,]*)(\D*)$/);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  return {
    prefix,
    suffix,
    target: Number(digits.replace(/,/g, "")),
    grouped: digits.includes(","),
  };
}

export function LandingMotion() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (window.__mmFailsafe) window.clearTimeout(window.__mmFailsafe);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      root.classList.remove(ROOT_CLASS);
      return;
    }
    // Normally set before first paint by the inline script; this covers client-side navigation.
    root.classList.add(ROOT_CLASS);

    const small = window.matchMedia("(max-width: 767px)").matches;
    const stagger = small ? STAGGER_MS * 0.6 : STAGGER_MS;
    const countMs = small ? 800 : 1100;

    const frames = new Set<number>();
    const settleTimers = new Map<Element, number>();
    const counters = new Map<HTMLElement, () => void>();

    /* ---------- Scroll reveal ---------- */
    const clearSettle = (el: Element) => {
      const id = settleTimers.get(el);
      if (id !== undefined) window.clearTimeout(id);
      settleTimers.delete(el);
    };

    const playReveal = (el: HTMLElement, delay: number) => {
      clearSettle(el);
      el.style.transitionDelay = `${delay}ms`;
      el.classList.add("is-visible");
      // The stagger delay must not linger, or it would also delay hover transitions.
      settleTimers.set(
        el,
        window.setTimeout(() => {
          el.style.transitionDelay = "";
          settleTimers.delete(el);
        }, delay + REVEAL_SETTLE_MS),
      );
    };

    // Snap back to the hidden state instantly. This only runs once the element
    // is entirely outside the viewport, so the snap is never seen.
    const resetReveal = (el: HTMLElement) => {
      clearSettle(el);
      el.style.transition = "none";
      el.style.transitionDelay = "";
      el.classList.remove("is-visible");
      void el.offsetWidth; // commit the hidden state before transitions come back
      el.style.transition = "";
    };

    const revealObserver = new IntersectionObserver(
      (entries) => {
        const batch = entries
          .filter(
            (entry) =>
              entry.isIntersecting &&
              entry.intersectionRatio >= REVEAL_RATIO &&
              !(entry.target as HTMLElement).classList.contains("is-visible"),
          )
          .map((entry) => entry.target as HTMLElement)
          .sort(domOrder);

        batch.forEach((el, index) => {
          playReveal(el, Math.min(index, MAX_STAGGER_STEPS) * stagger);
        });
      },
      { threshold: [0, REVEAL_RATIO], rootMargin: ENTER_MARGIN },
    );

    /* ---------- Number count-up ---------- */
    const startCount = (el: HTMLElement) => {
      if (counters.has(el)) return;
      const parsed = parseCount(el.textContent ?? "");
      if (!parsed || parsed.target === 0) return;

      // Keep the original text nodes so the finished DOM is exactly what was rendered.
      const originalNodes = Array.from(el.childNodes);
      const format = (n: number) => (parsed.grouped ? indianGrouping.format(n) : String(n));

      // Hold the element's width so the shrinking number never shifts neighbours.
      const rect = el.getBoundingClientRect();
      const previous = { display: el.style.display, minWidth: el.style.minWidth };
      if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
      el.style.minWidth = `${rect.width}px`;

      let frame = 0;
      let poll = 0;

      const stop = () => {
        window.clearInterval(poll);
        cancelAnimationFrame(frame);
        frames.delete(frame);
        el.replaceChildren(...originalNodes);
        el.style.display = previous.display;
        el.style.minWidth = previous.minWidth;
        if (!el.getAttribute("style")) el.removeAttribute("style");
        counters.delete(el);
      };
      counters.set(el, stop);

      el.textContent = `${parsed.prefix}${format(0)}${parsed.suffix}`;

      const run = () => {
        const begin = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - begin) / countMs, 1);
          if (progress >= 1) {
            stop();
            return;
          }
          const value = Math.round(parsed.target * easeOutCubic(progress));
          el.textContent = `${parsed.prefix}${format(value)}${parsed.suffix}`;
          frame = requestAnimationFrame(tick);
          frames.add(frame);
        };
        frame = requestAnimationFrame(tick);
        frames.add(frame);
      };

      // Wait for the enclosing reveal (if any) to begin so the count is actually seen.
      const host = el.closest("[data-reveal]");
      if (!host || host.classList.contains("is-visible")) {
        run();
        return;
      }
      poll = window.setInterval(() => {
        if (host.classList.contains("is-visible")) {
          window.clearInterval(poll);
          run();
        }
      }, 40);
    };

    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= COUNT_RATIO) {
            startCount(entry.target as HTMLElement);
          }
        });
      },
      { threshold: [0, COUNT_RATIO], rootMargin: ENTER_MARGIN },
    );

    /* ---------- Reset once fully out of the viewport (never while any of it is on screen) ---------- */
    const exitObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          if (el.hasAttribute("data-reveal") && el.classList.contains("is-visible")) resetReveal(el);
          counters.get(el)?.();
          if (el.hasAttribute("data-hero-item")) el.setAttribute("data-hero-paused", "");
        });
      },
      { rootMargin: EXIT_MARGIN },
    );

    /* ---------- Hero: replay the same load-in whenever it comes back into view ---------- */
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting && el.hasAttribute("data-hero-paused")) {
          el.removeAttribute("data-hero-paused"); // animation restarts from its first frame
        }
      });
    });

    const revealEls = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const countEls = document.querySelectorAll<HTMLElement>("[data-countup]");
    const heroEls = document.querySelectorAll<HTMLElement>("[data-hero-item]");

    revealEls.forEach((el) => {
      revealObserver.observe(el);
      exitObserver.observe(el);
    });
    countEls.forEach((el) => {
      countObserver.observe(el);
      exitObserver.observe(el);
    });
    heroEls.forEach((el) => {
      heroObserver.observe(el);
      exitObserver.observe(el);
    });

    return () => {
      revealObserver.disconnect();
      countObserver.disconnect();
      exitObserver.disconnect();
      heroObserver.disconnect();
      frames.forEach((id) => cancelAnimationFrame(id));
      settleTimers.forEach((id) => window.clearTimeout(id));
      // Never leave a number mid-count, an element mid-reveal, or the hero paused behind.
      Array.from(counters.values()).forEach((stop) => stop());
      revealEls.forEach((el) => {
        el.classList.remove("is-visible");
        el.style.transitionDelay = "";
      });
      heroEls.forEach((el) => el.removeAttribute("data-hero-paused"));
      root.classList.remove(ROOT_CLASS);
    };
  }, []);

  return null;
}
