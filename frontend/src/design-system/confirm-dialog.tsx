"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./components";

/**
 * ConfirmDialog (section 8.3). Built on the native `<dialog>` + `showModal()`,
 * which gives the focus trap, `Esc` to close and an inert background; focus is
 * returned to whatever opened the dialog.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "ยกเลิก",
  tone = "danger",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      if (opener.current instanceof HTMLElement) {
        opener.current.focus();
      }
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) {
          onCancel();
        }
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-surface p-0 shadow-lg backdrop:bg-surface-inverse backdrop:opacity-50 sm:m-auto sm:h-auto sm:max-w-lg sm:rounded-lg"
    >
      <div className="flex h-full flex-col gap-4 p-6">
        <h2 id={titleId} className="font-heading text-xl font-semibold text-ink">
          {title}
        </h2>
        {children ? <div className="text-body">{children}</div> : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col-reverse gap-2 sm:mt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
