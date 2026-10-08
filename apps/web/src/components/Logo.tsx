"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useHasMounted } from "@/lib/use-has-mounted";

interface LogoProps {
  className?: string;
  height?: number;
  /** Mark only, no wordmark — for the collapsed nav rail. Same on both themes. */
  markOnly?: boolean;
}

export function Logo({ className, height = 40, markOnly = false }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();

  if (markOnly) {
    return (
      <Image
        src="/brand/moneymitra-mark.png"
        alt="MoneyMitra"
        width={Math.round(height * 1.259)}
        height={height}
        className={className}
        priority
      />
    );
  }

  const isDark = mounted && resolvedTheme === "dark";
  const src = isDark
    ? "/brand/moneymitra-logo-dark.png"
    : "/brand/moneymitra-logo-light.png";

  return (
    <Image
      src={src}
      alt="MoneyMitra"
      width={height * 2.51}
      height={height}
      className={className}
      priority
    />
  );
}
