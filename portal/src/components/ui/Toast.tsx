import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const ToastContext = createContext<(message: string) => void>(() => undefined);

/** How long a message stays. Long enough to read a sentence, short enough not to need dismissing. */
const VISIBLE_MS = 5000;

/**
 * A brief confirmation that something happened out of sight — an invitation going out is the case
 * that asked for it: nothing on the page changes when an email is sent. One message at a time; a
 * newer one replaces it. Not for errors, which stay on the page next to what caused them.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  // The id restarts the timer when the same text is shown twice in a row.
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const show = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always mounted, so a screen reader is already listening when the text arrives. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {toast && (
          <p className="max-w-md rounded-lg bg-ink px-4 py-3 text-sm text-surface shadow-lg">
            {toast.message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
