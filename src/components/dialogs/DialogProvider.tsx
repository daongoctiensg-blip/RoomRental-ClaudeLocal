"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// Custom confirm()/alert() replacement — round 11. The browser's native
// window.confirm()/alert() block the whole tab (including any in-flight
// network request UI) and look completely out of place next to the rest of
// this app's styled UI. This provider renders one shared modal instead,
// exposing useConfirm()/useAlertDialog() hooks that return a Promise —
// callers await it exactly like they awaited the boolean from
// window.confirm(), so replacing a call site is a one-line change.

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in red — use for destructive/irreversible
   * actions (delete, cancel a deposit with money attached, etc). */
  danger?: boolean;
};

type AlertOptions = {
  title?: string;
  message: string;
  okLabel?: string;
};

type PendingConfirm = ConfirmOptions & { kind: "confirm"; resolve: (v: boolean) => void };
type PendingAlert = AlertOptions & { kind: "alert"; resolve: () => void };
type Pending = PendingConfirm | PendingAlert;

type DialogContextValue = {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
  alertDialog: (opts: AlertOptions | string) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // Guards against a lingering keydown/click resolving a dialog twice (e.g.
  // Enter key + a click landing in the same tick).
  const settledRef = useRef(false);

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      settledRef.current = false;
      setPending({ kind: "confirm", ...normalized, resolve });
    });
  }, []);

  const alertDialog = useCallback((opts: AlertOptions | string): Promise<void> => {
    const normalized: AlertOptions = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<void>((resolve) => {
      settledRef.current = false;
      setPending({ kind: "alert", ...normalized, resolve });
    });
  }, []);

  const settle = (value?: boolean) => {
    if (settledRef.current || !pending) return;
    settledRef.current = true;
    if (pending.kind === "confirm") pending.resolve(!!value);
    else pending.resolve();
    setPending(null);
  };

  return (
    <DialogContext.Provider value={{ confirm, alertDialog }}>
      {children}
      {pending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => settle(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {pending.title ? (
              <h2 className="mb-2 text-base font-semibold text-slate-900">
                {pending.title}
              </h2>
            ) : null}
            <p className="whitespace-pre-wrap text-sm text-slate-600">
              {pending.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              {pending.kind === "confirm" ? (
                <>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => settle(false)}
                    className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {pending.cancelLabel ?? "Huỷ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => settle(true)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium text-white ${
                      pending.danger
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-dark)]"
                    }`}
                  >
                    {pending.confirmLabel ?? "Xác nhận"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  autoFocus
                  onClick={() => settle()}
                  className="rounded-lg bg-[color:var(--color-accent)] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[color:var(--color-accent-dark)]"
                >
                  {pending.okLabel ?? "Đã hiểu"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

/** Drop-in async replacement for window.confirm(msg) — `await useConfirm()(msg)`
 * (or pass { title, message, danger } for a styled destructive-action
 * dialog). Must be called from a component rendered under <DialogProvider>
 * (the root layout provides it app-wide). */
export function useConfirm() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useConfirm() must be used within <DialogProvider>");
  }
  return ctx.confirm;
}

/** Drop-in async replacement for window.alert(msg) — `await useAlertDialog()(msg)`. */
export function useAlertDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useAlertDialog() must be used within <DialogProvider>");
  }
  return ctx.alertDialog;
}
