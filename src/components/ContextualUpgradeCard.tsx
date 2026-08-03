import { motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { UpgradePrompt } from "../api";

interface ContextualUpgradeCardProps {
  prompt: UpgradePrompt;
  onDismiss: (key: string) => Promise<void>;
  dismissError?: string | null;
}

/**
 * Phase 2: Calm contextual upgrade card.
 * Appears inline after AI-generated content (Wiki, Lens) based on server-owned value signals.
 * Dismissal remains visible until the server confirms it; preserves scroll state when navigating to /pricing.
 */
export function ContextualUpgradeCard({ prompt, onDismiss, dismissError }: ContextualUpgradeCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const navigate = useNavigate();

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await onDismiss(prompt.key);
    } finally {
      setDismissing(false);
    }
  };

  const handleUpgrade = () => {
    // Preserve scroll position for when user returns from /pricing
    sessionStorage.setItem("chapter:pricing-return-scroll", String(window.scrollY));
    navigate("/pricing");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative my-6 overflow-hidden rounded-2xl border border-natural-sage/25 bg-natural-sage/5 p-5"
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-natural-stone transition-colors hover:bg-natural-cream hover:text-natural-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/50 disabled:cursor-wait disabled:opacity-60"
        aria-label="Not now"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-natural-sage/15 text-natural-sage">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-natural-sage">Optional next step</p>
          <p className="mt-1 font-sans text-sm leading-relaxed text-natural-stone">
            {prompt.message}
          </p>
          {dismissError && (
            <p role="status" className="mt-2 text-xs font-medium text-natural-dark">
              {dismissError}
            </p>
          )}
          <button
            onClick={handleUpgrade}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-natural-sage/25 bg-natural-cream px-4 font-sans text-xs font-bold text-natural-dark transition-colors hover:border-natural-sage hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-natural-sage/50"
          >
            <Sparkles size={16} />
            Explore membership
          </button>
        </div>
      </div>
    </motion.div>
  );
}
