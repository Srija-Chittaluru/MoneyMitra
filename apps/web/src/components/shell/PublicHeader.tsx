import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";

export function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-line bg-frame px-4 py-4 md:px-8">
      <Link href="/" className="flex items-center">
        <Logo height={40} />
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Log in
          </Button>
        </Link>
        <Link href="/signup">
          <Button variant="primary" size="sm">
            Get started
          </Button>
        </Link>
      </div>
    </header>
  );
}
