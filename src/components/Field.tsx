import { Eye, EyeOff } from "lucide-react";

/** Etiketli metin/şifre alanı (isteğe bağlı "şifreyi göster" düğmesiyle). */
export default function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  toggle,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  toggle?: { shown: boolean; onToggle: () => void };
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-theme border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
        />
        {toggle && (
          <button
            type="button"
            onClick={toggle.onToggle}
            aria-label={toggle.shown ? "Şifreyi gizle" : "Şifreyi göster"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {toggle.shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
