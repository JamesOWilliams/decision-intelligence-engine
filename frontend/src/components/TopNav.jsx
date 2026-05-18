import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function TopNav({ right = null, crumb = null }) {
  const location = useLocation();
  return (
    <header
      data-testid="top-nav"
      className="no-print h-16 border-b border-ink/90 flex items-center justify-between px-6 md:px-12 bg-bone sticky top-0 z-40"
    >
      <Link to="/" className="flex items-center gap-3" data-testid="brand-home-link">
        <div className="mono-num text-[11px] tracking-[0.22em] uppercase text-graphite">
          DIE / v1.0
        </div>
        <span className="text-ink">·</span>
        <span className="font-heading text-lg text-ink tracking-tight">
          Decision Intelligence Engine
        </span>
      </Link>

      <div className="flex items-center gap-6">
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
