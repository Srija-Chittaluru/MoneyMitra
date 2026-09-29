"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useHasMounted } from "@/lib/use-has-mounted";

interface LogoProps {
  className?: string;
  height?: number;
}

export function Logo({ className, height = 40 }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();

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
