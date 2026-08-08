/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingNavbar, MARKETING_NAV, GET_STARTED_HREF,
 *   GET_STARTED_LABEL, PlatformLogo, AUTH_ROUTES, public navbar, sticky header,
 *   Sheet, mobile menu
 *
 * WHAT:  The public site header — brand, in-page nav, sign-in and the primary
 *        CTA, with the nav collapsing into a sheet below md.
 * WHY:   Lives in components/global rather than a route `_components` folder
 *        because it is rendered by the (marketing) LAYOUT, not by one page: every
 *        future public route inherits it unchanged. It is transparent over the
 *        hero and only grows a hairline and a blur once the page scrolls, so the
 *        first screen reads as one surface instead of a bar stuck on top of an
 *        image.
 * WHERE: src/app/(marketing)/layout.tsx.
 */

import * as React from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";

import {
  AUTH_ROUTES,
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_NAV,
} from "@/lib/config";
import { PlatformLogo } from "@/components/global/platform-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MarketingNavbar() {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    /* Passive: this listener never calls preventDefault, and saying so keeps it
     * off the scrolling critical path. */
    window.addEventListener("scroll", onScroll, { passive: true });
    /* Fire once for a restored scroll position on reload. */
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-50 border-b border-transparent transition-colors duration-200 data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/80 supports-backdrop-filter:data-[scrolled=true]:backdrop-blur-md"
    >
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <PlatformLogo href="/" />

        <div className="hidden items-center gap-7 md:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={AUTH_ROUTES.signIn} />}
          >
            Sign in
          </Button>
          <Button
            variant="brand"
            size="sm"
            nativeButton={false}
            render={<Link href={GET_STARTED_HREF} />}
          >
            {GET_STARTED_LABEL}
          </Button>
        </div>

        <Sheet>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="md:hidden" />}
          >
            <MenuIcon />
            <span className="sr-only">Open menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4">
              {/* SheetClose wraps each link so tapping an in-page anchor closes
                  the sheet — otherwise it scrolls behind an open overlay.
                  nativeButton={false} everywhere below: these all resolve to an
                  <a>, and base-ui warns (correctly) if a button-role component
                  renders a non-button without being told to expect one. */}
              {MARKETING_NAV.map((item) => (
                <SheetClose
                  key={item.href}
                  nativeButton={false}
                  render={<Link href={item.href} />}
                  className="rounded-md px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </SheetClose>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-2 p-4">
              <SheetClose
                nativeButton={false}
                render={
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    nativeButton={false}
                    render={<Link href={AUTH_ROUTES.signIn} />}
                  />
                }
              >
                Sign in
              </SheetClose>
              <SheetClose
                nativeButton={false}
                render={
                  <Button
                    variant="brand"
                    size="lg"
                    className="w-full"
                    nativeButton={false}
                    render={<Link href={GET_STARTED_HREF} />}
                  />
                }
              >
                {GET_STARTED_LABEL}
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
