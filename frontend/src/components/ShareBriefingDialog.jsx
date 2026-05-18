import React, { useEffect, useState } from "react";
import { Share2, X, Copy, Check, Link2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Lightweight inline dialog for generating + copying a secure share link.
 * Idempotent: backend returns the existing link if one is active.
 */
export default function ShareBriefingDialog({ open, onClose, assessmentId }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || link) return;
    setLoading(true);
    setError(null);
    api
      .createShareLink(assessmentId)
      .then((data) => setLink(data))
      .catch((e) => setError(e?.response?.data?.detail || "Unable to generate share link."))
      .finally(() => setLoading(false));
  }, [open, assessmentId, link]);

  if (!open) return null;

  const shareUrl = link ? `${window.location.origin}/shared/${link.token}` : "";

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

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
        {/* Header */}
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

        {/* Body */}
        <div className="px-7 py-7">
          <div className="eyebrow mb-3">Read-Only Boardroom Link</div>

          {loading && (
            <div className="flex items-center gap-3 text-graphite py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Generating secure link & executive abstract…</span>
            </div>
          )}

          {error && (
            <div className="border-l-2 border-oxblood pl-4 py-2 text-sm text-oxblood">{error}</div>
          )}

          {link && (
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
                  onClick={copy}
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
                <div>
                  <div className="eyebrow mb-1.5">Access</div>
                  <div className="text-ink">View-only · no login required</div>
                </div>
                <div>
                  <div className="eyebrow mb-1.5">Expiration</div>
                  <div className="text-ink">{link.expires_at ? new Date(link.expires_at).toLocaleDateString() : "None"}</div>
                </div>
                <div>
                  <div className="eyebrow mb-1.5">Views</div>
                  <div className="mono-num text-ink">{link.view_count ?? 0}</div>
                </div>
                <div>
                  <div className="eyebrow mb-1.5">Created</div>
                  <div className="mono-num text-ink">
                    {new Date(link.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <p className="mt-6 text-xs text-graphite leading-relaxed border-t border-hairline pt-4">
                Anyone with this link can view a read-only executive briefing — including the
                Claude-generated abstract, scoring, and recommendation. Editing, navigation, and
                assessment controls are hidden from shared viewers.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
