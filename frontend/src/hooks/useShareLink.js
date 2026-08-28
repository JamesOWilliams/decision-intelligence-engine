import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

/**
 * Manages the share-link lifecycle for the ShareBriefingDialog:
 * - lazily creates (or reuses) a share link when the dialog opens
 * - exposes the derived public URL
 * - provides a clipboard-safe `copy` with browser-fallback + transient confirmation
 */
export function useShareLink(assessmentId, isOpen) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || link) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .createShareLink(assessmentId)
      .then((data) => {
        if (alive) setLink(data);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.detail || "Unable to generate share link.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOpen, assessmentId, link]);

  const shareUrl = useMemo(
    () => (link ? `${window.location.origin}/shared/${link.token}` : ""),
    [link]
  );

  const copy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Fallback for older browsers / insecure contexts
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    const t = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(t);
  }, [shareUrl]);

  return { link, loading, error, shareUrl, copied, copy };
}
