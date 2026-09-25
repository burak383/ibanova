import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Alttan açılan basit iletişim kutusu: dışarı tıklama ve Esc ile kapanır. */
export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Klavye odağını sheet içinde tut (odak tuzağı) — arkadaki sayfaya Tab ile kaçılmasın
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey ? active === first || !panelRef.current.contains(active) : active === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Açılışta odağı sheet'e taşı; kapanınca arka plandaki tetikleyici öğeye geri ver
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const toFocus = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    // autoFocus'lu bir input varsa React zaten odaklamıştır; yoksa ilk odaklanabilir öğeye geç
    if (toFocus && document.activeElement !== toFocus && !panelRef.current?.contains(document.activeElement)) {
      toFocus.focus();
    }

    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Kapat" className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        className="relative w-full max-w-[480px] rounded-t-3xl border border-b-0 border-border bg-card px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-4 font-heading text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SheetAction({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium hover:bg-muted ${
        danger ? "text-destructive" : "text-card-foreground"
      }`}
    >
      <span className={danger ? "" : "text-primary"}>{icon}</span>
      {label}
    </button>
  );
}

export function PrimaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`flex h-12 flex-1 items-center justify-center rounded-theme bg-primary text-sm font-bold text-primary-foreground disabled:opacity-40 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`flex h-12 flex-1 items-center justify-center rounded-theme border border-border bg-secondary text-sm font-semibold text-secondary-foreground ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
