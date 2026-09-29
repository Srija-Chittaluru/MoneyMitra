import { cn } from "@/lib/cn";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  initial: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-16 w-16 text-xl",
};

export function Avatar({ initial, size = "md", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-surface-muted font-semibold text-foreground",
        sizeClasses[size],
        className,
      )}
    >
      {initial}
    </div>
  );
}
