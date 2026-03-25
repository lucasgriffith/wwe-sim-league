"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/roster", label: "Roster" },
  { href: "/tiers", label: "Tiers" },
  { href: "/season", label: "Season" },
  { href: "/tag-teams", label: "Tag Teams" },
  { href: "/dynasty", label: "Dynasty" },
  { href: "/history", label: "History" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        {/* Logo */}
        <Link href="/" className="mr-8 flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="WWE 2K26 Sim League"
            width={32}
            height={32}
            className="rounded-lg opacity-90 transition-opacity group-hover:opacity-100"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none gradient-text-gold">WWE 2K26</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none mt-0.5">
              Sim League
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-1 -bottom-[13px] h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Admin
            </Button>
          </Link>

          {/* Mobile nav */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 hover:bg-accent hover:text-accent-foreground transition-colors">
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                className="text-foreground"
              >
                <path
                  d="M2 4h12M2 8h12M2 12h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 border-border/30 bg-background/95 backdrop-blur-xl">
              <div className="mt-8 flex flex-col gap-1">
                <div className="mb-4 flex items-center gap-2.5 px-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="WWE 2K26 Sim League"
                    width={32}
                    height={32}
                    className="rounded-lg"
                  />
                  <span className="text-sm font-bold gradient-text-gold">WWE 2K26</span>
                </div>
                <nav className="flex flex-col gap-0.5">
                  {navLinks.map((link) => {
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                          active
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
