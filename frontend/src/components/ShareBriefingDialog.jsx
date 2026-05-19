import React from "react";
import { Share2, X, Copy, Check, Link2, Loader2 } from "lucide-react";
import { useShareLink } from "@/hooks/useShareLink";

/**
 * Lightweight inline dialog for generating + copying a secure share link.
 * State and side-effects are owned by the `useShareLink` hook; this component
 * is presentational.
 */
export default function ShareBriefingDialog({ open, onClose, assessmentId }) {
  const { link, loading, error, shareUrl, copied, copy } = useShareLink(assessmentId, open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 no-print flex items-center justify-center"
      data-testid="share-dialog"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-xl mx-4 bg-bone border border-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] animate-fade-in">
        <DialogHeader onClose={onClose} />
        <div className="px-7 py-7">
          <div className="eyebrow mb-3">Read-Only Boardroom Link</div>
          {loading && <DialogLoading />}
          {error && <DialogError message={error} />}
          {link && (
            <DialogBody
              link={link}
              shareUrl={shareUrl}
              copied={copied}
              onCopy={copy}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DialogHeader({ onClose }) {
  return (
    <div className="flex items-center justify-between px-7 py-5 border-b border-hairline">
      <div className="flex items-center gap-3">
        <Share2 className="w-4 h-4 text-ink" strokeWidth={1.5} />
        <h2 className="font-heading text-xl text-ink leading-none">Share Executive Briefing</h2>
      </div>
      <button
        onClick={onClose}
        data-testid="share-dialog-close"
        className="text-graphite hover:text-ink transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function DialogLoading() {
  return (
    <div className="flex items-center gap-3 text-graphite py-6">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm">Generating secure link & executive abstract…</span>
    </div>
  );
}

function DialogError({ message }) {
  return <div className="border-l-2 border-oxblood pl-4 py-2 text-sm text-oxblood">{message}</div>;
}

function DialogBody({ link, shareUrl, copied, onCopy }) {
  return (
    <>
      <div className="flex items-stretch border border-ink">
        <div className="flex items-center px-3 border-r border-ink bg-sunken">
          <Link2 className="w-3.5 h-3.5 text-ink" strokeWidth={1.5} />
        </div>
        <input
          data-testid="share-link-input"
          readOnly
          value={shareUrl}
          onFocus={(e) => e.target.select()}
          className="flex-1 bg-bone px-3 py-3 mono-num text-xs text-ink focus:outline-none"
        />
        <button
          data-testid="share-link-copy"
          onClick={onCopy}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-l border-ink transition-colors ${
            copied ? "bg-moss text-bone" : "bg-ink text-bone hover:bg-graphite"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> Copy
            </>
          )}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
        <MetaCell label="Access" value="View-only · no login required" />
        <MetaCell
          label="Expiration"
          value={link.expires_at ? new Date(link.expires_at).toLocaleDateString() : "None"}
        />
        <MetaCell label="Views" value={String(link.view_count ?? 0)} mono />
        <MetaCell label="Created" value={new Date(link.created_at).toLocaleDateString()} mono />
      </div>

      <p className="mt-6 text-xs text-graphite leading-relaxed border-t border-hairline pt-4">
        Anyone with this link can view a read-only executive briefing — including the
        Claude-generated abstract, scoring, and recommendation. Editing, navigation, and
        assessment controls are hidden from shared viewers.
      </p>
    </>
  );
}

function MetaCell({ label, value, mono }) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className={mono ? "mono-num text-ink" : "text-ink"}>{value}</div>
    </div>
  );
}
