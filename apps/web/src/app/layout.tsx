import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth/AuthContext";

/**
 * Runs before first paint so the landing page's below-the-fold reveals start
 * hidden with no flash. Harmless on every other page — nothing but the
 * landing page's motion.css reacts to the `mm-motion` class it adds. Skipped
 * under reduced motion; a failsafe un-hides everything if the page script
 * never loads. Must live in the root layout (not a page) per next/script's
 * `beforeInteractive` requirements.
 */
const MOTION_BOOT = `(function(){try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var d=document.documentElement;d.classList.add("mm-motion");window.__mmFailsafe=setTimeout(function(){d.classList.remove("mm-motion")},8000)}catch(e){}})()`;

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MoneyMitra",
  description: "AI-powered personal tax and finance assistant.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <Script id="motion-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <Providers>
            <AuthProvider>{children}</AuthProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
