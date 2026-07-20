import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

export default function Toast({ toast, onClose }: { toast: { type: 'ok' | 'err'; msg: string }; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const ok = toast.type === 'ok';
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white border border-natural-border rounded-2xl shadow-lg px-4 py-3 max-w-sm animate-[fadeIn_0.2s_ease]">
      {ok ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
      <p className="text-xs font-sans text-natural-dark flex-1">{toast.msg}</p>
      <button onClick={onClose} className="text-natural-stone hover:text-natural-dark"><X className="w-4 h-4" /></button>
    </div>
  );
}
