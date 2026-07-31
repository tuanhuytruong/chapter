import { motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { UpgradePrompt } from "../api";

interface ContextualUpgradeCardProps {
  prompt: UpgradePrompt;
  onDismiss: (key: string) => void;
}

/**
 * Phase 2: Calm contextual upgrade card.
 * Appears inline after AI-generated content (Wiki, Lens) based on server-owned value signals.
 * Dismissal is optimistic; preserves scroll state when navigating to /pricing.
 */
export function ContextualUpgradeCard({ prompt, onDismiss }: ContextualUpgradeCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const navigate = useNavigate();

  const handleDismiss = async () => {
    setDismissing(true);
    onDismiss(prompt.key);
  };

  const handleUpgrade = () => {
    // Preserve scroll position for when user returns from /pricing
    sessionStorage.setItem("returnScroll", String(window.scrollY));
    navigate("/pricing");
  };

  if (dismissing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="my-6 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 p-5 relative overflow-hidden"
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-black/20 transition-colors text-gray-500 dark:text-gray-400"
        aria-label="Not now"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
          <Sparkles size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed mb-3">
            {prompt.message}
          </p>
          <button
            onClick={handleUpgrade}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-medium transition-all shadow-sm hover:shadow-md"
          >
            <Sparkles size={16} />
            Xem gói nâng cấp
          </button>
        </div>
      </div>
    </motion.div>
  );
}
