import { useApp } from "../store";

export default function Toast() {
  const { toastMessage } = useApp();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-5"
    >
      {toastMessage && (
        <div className="rounded-full border border-primary/40 bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
