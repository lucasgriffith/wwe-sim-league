import type { Metadata } from "next";
import { Barlow, Big_Shoulders, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Broadcast type system: condensed display for names and headlines, a plain
// sans for reading, a mono for ratings and times
const fontBody = Barlow({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fontDisplay = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "800", "900"],
});

const fontData = JetBrains_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "WWE 2K26 Simulation League",
  description:
    "CPU-vs-CPU simulation league with tiered championships and relegation",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookie-less visitors resolve to null without a network call
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${fontBody.variable} ${fontDisplay.variable} ${fontData.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <SiteHeader />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <MobileNav isAdmin={!!user} />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
