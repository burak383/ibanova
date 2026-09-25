import { Bookmark, Clock3, House, UserRound } from "lucide-react";
import { navigate } from "../lib/router";

export type Tab = "home" | "history" | "saved" | "profile";

const tabs = [
  { id: "home", label: "Ana Sayfa", icon: House, path: "/" },
  { id: "history", label: "Geçmiş", icon: Clock3, path: "/gecmis" },
  { id: "saved", label: "Kayıtlı IBAN'lar", icon: Bookmark, path: "/kayitli" },
  { id: "profile", label: "Profil", icon: UserRound, path: "/profil" },
] as const;

export default function BottomNav({ active }: { active: Tab }) {
  return (
    <nav
      aria-label="Ana navigasyon"
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl"
    >
      <div className="mx-auto grid max-w-[393px] grid-cols-4">
        {tabs.map(({ id, label, icon: Icon, path }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(path, { replace: true })}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center gap-1 ${isActive ? "text-primary" : "text-muted-foreground"}`}
            >
              <span
                className={`flex h-8 min-w-14 items-center justify-center ${isActive ? "rounded-full bg-primary/15" : ""}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
