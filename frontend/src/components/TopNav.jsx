import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function TopNav({ right = null, crumb = null }) {
  const location = useLocation();
  return (
    <header
      data-testid="top-nav"
      className="no-print h-16 border-b border-ink/90 flex items-center justify-between px-4 md:px-12 bg-bone sticky top-0 z-40 gap-3"
    >
      <Link
        to="/"
        className="flex items-center gap-3 min-w-0 flex-shrink"
        data-testid="brand-home-link"
      >
        {/* Eyebrow rail — desktop only */}
        <div className="mono-num text-[11px] tracking-[0.22em] uppercase text-graphite hidden md:block whitespace-nowrap">
          DIE / v1.0
        </div>
        <span className="text-ink hidden md:inline">·</span>
        {/* Brand wordmark — short on mobile, full on desktop */}
        <span className="font-heading text-ink tracking-tight truncate">
          <span className="md:hidden text-base">DIE</span>
          <span className="hidden md:inline text-lg">Decision Intelligence Engine</span>
        </span>
      </Link>

      <div className="flex items-center gap-2 md:gap-6 flex-shrink-0">
        {crumb && (
          <div className="hidden md:flex items-center gap-2 eyebrow" data-testid="top-nav-crumb">
            {crumb}
          </div>
        )}
        {right}
      </div>
    </header>
  );
}
