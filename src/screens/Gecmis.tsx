import { useMemo, useState } from "react";
import { BookmarkPlus, Check, ChevronRight, Ellipsis, Search, SearchX, Trash2, X } from "lucide-react";
import BottomNav from "../components/BottomNav";
import BankLogo from "../components/BankLogo";
import Sheet, { PrimaryButton, SecondaryButton, SheetAction } from "../components/Sheet";
import { analyzeIban, last4 } from "../lib/iban";
import { dayDiff, formatWhen } from "../lib/format";
import { navigate } from "../lib/router";
import { useApp, type CheckRecord } from "../store";

type Filter = "Tümü" | "Geçerli" | "Geçersiz";
const FILTERS: Filter[] = ["Tümü", "Geçerli", "Geçersiz"];

function StatusBadge({ valid }: { valid: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        valid ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      }`}
    >
      {valid ? "Geçerli" : "Geçersiz"}
    </span>
  );
}

function RecordActions({
  bank,
  canSave,
  isSaved,
  onSave,
  onRemove,
}: {
  bank: string;
  canSave: boolean;
  isSaved: boolean;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-4 border-t border-border bg-muted/40 px-4 py-2">
      {canSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={isSaved}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground disabled:opacity-70"
          aria-label={`${bank} kaydını kaydet`}
        >
          {isSaved ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <BookmarkPlus className="h-4 w-4 text-primary" />
          )}
          {isSaved ? "Kayıtlı" : "Kaydet"}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
        aria-label={`${bank} kaydını geçmişten kaldır`}
      >
        <Trash2 className="h-4 w-4" />
        Geçmişten kaldır
      </button>
    </div>
  );
}

function HistoryRecord({
  record,
  onSave,
  onRemove,
}: {
  record: CheckRecord;
  onSave: (iban: string) => void;
  onRemove: (id: string) => void;
}) {
  const { isSaved } = useApp();
  const info = analyzeIban(record.iban);
  const showBank = info.bankName;

  return (
    <article className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => navigate(`/iban/${record.iban}`)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
        aria-label={`${showBank} kaydını incele`}
      >
        <div className="relative shrink-0">
          <BankLogo bank={showBank} className="h-12 w-14 rounded-xl bg-secondary p-2" />
          <span
            className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-card ${
              info.valid ? "bg-success" : "bg-destructive"
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-sm font-semibold text-card-foreground">{showBank}</h3>
            <StatusBadge valid={info.valid} />
          </div>
          <p className="mt-1 text-sm font-medium tracking-[0.04em] text-foreground">•••• {last4(record.iban)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatWhen(record.at)}</p>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>
      <RecordActions
        bank={showBank}
        canSave={info.valid}
        isSaved={isSaved(record.iban)}
        onSave={() => onSave(record.iban)}
        onRemove={() => onRemove(record.id)}
      />
    </article>
  );
}

function HistorySection({
  title,
  items,
  onSave,
  onRemove,
}: {
  title: string;
  items: CheckRecord[];
  onSave: (iban: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="mt-7" aria-labelledby={`${title}-title`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 id={`${title}-title`} className="font-heading text-sm font-semibold">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{items.length} kayıt</span>
      </div>

      <div className="overflow-hidden rounded-theme border border-border bg-card shadow-[0_10px_28px_rgba(0,0,0,0.14)]">
        {items.map((record) => (
          <HistoryRecord key={record.id} record={record} onSave={onSave} onRemove={onRemove} />
        ))}
      </div>
    </section>
  );
}

export default function HistoryScreen() {
  const { history, saved, removeHistory, clearHistory, saveIban, toast } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Tümü");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const match = (r: CheckRecord) => {
      const info = analyzeIban(r.iban);
      const name = saved.find((s) => s.iban === r.iban)?.name ?? "";
      const okQuery = !q || `${info.bankName} ${name} ${r.iban}`.toLocaleLowerCase("tr-TR").includes(q);
      const okFilter = filter === "Tümü" || (filter === "Geçerli" ? info.valid : !info.valid);
      return okQuery && okFilter;
    };
    const list = history.filter(match);
    return {
      today: list.filter((r) => dayDiff(r.at) <= 0),
      yesterday: list.filter((r) => dayDiff(r.at) === 1),
      older: list.filter((r) => dayDiff(r.at) > 1),
    };
  }, [history, saved, query, filter]);

  const hasResults = groups.today.length + groups.yesterday.length + groups.older.length > 0;

  const confirmSave = () => {
    if (!saving) return;
    const result = saveIban(saving, label);
    setSaving(null);
    setLabel("");
    toast(result === "saved" ? "IBAN kaydedildi" : "Bu IBAN zaten kayıtlı");
  };

  const sectionProps = {
    onSave: (iban: string) => {
      setLabel("");
      setSaving(iban);
    },
    onRemove: (id: string) => {
      removeHistory(id);
      toast("Geçmişten kaldırıldı");
    },
  };

  return (
    <div className="min-h-screen w-full bg-background pb-28 font-body text-foreground">
      <header className="px-5 pb-5 pt-12">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">İşlemler</p>
            <h1 className="mt-1 font-heading text-[28px] font-bold tracking-tight">Geçmiş</h1>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            aria-label="Geçmiş ayarları"
          >
            <Ellipsis className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex h-12 items-center gap-3 rounded-theme border border-primary/60 bg-input px-4 shadow-[0_0_22px_rgba(0,213,232,0.08)]">
          <Search className="h-5 w-5 text-primary" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Geçmişte ara"
            placeholder="Banka, etiket veya IBAN sonu ara"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground"
              aria-label="Aramayı temizle"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="px-5">
        <div className="flex rounded-theme border border-border bg-card p-1" role="tablist" aria-label="Geçmiş filtresi">
          {FILTERS.map((item) => {
            const active = filter === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs ${
                  active ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-muted-foreground"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {hasResults ? (
          <>
            {groups.today.length > 0 && <HistorySection title="Bugün" items={groups.today} {...sectionProps} />}
            {groups.yesterday.length > 0 && <HistorySection title="Dün" items={groups.yesterday} {...sectionProps} />}
            {groups.older.length > 0 && <HistorySection title="Daha eski" items={groups.older} {...sectionProps} />}
          </>
        ) : (
          <div className="mt-12 flex flex-col items-center rounded-theme border border-border bg-card px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-heading text-base font-semibold">
              {history.length === 0 ? "Henüz kontrol yok" : "Eşleşen IBAN bulunamadı"}
            </h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              {history.length === 0
                ? "Ana Sayfa'da bir IBAN doğruladığında burada görünür."
                : "Arama ölçütünü değiştirin veya tüm kayıtları görüntüleyin."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (history.length === 0) {
                  navigate("/");
                } else {
                  setQuery("");
                  setFilter("Tümü");
                }
              }}
              className="mt-5 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground"
            >
              {history.length === 0 ? "IBAN doğrula" : "Filtreyi temizle"}
            </button>
          </div>
        )}
      </main>

      {menuOpen && (
        <Sheet title="Geçmiş" onClose={() => setMenuOpen(false)}>
          <SheetAction
            danger
            icon={<Trash2 className="h-5 w-5" />}
            label="Tüm geçmişi temizle"
            onClick={() => {
              setMenuOpen(false);
              setConfirmClear(true);
            }}
          />
        </Sheet>
      )}

      {confirmClear && (
        <Sheet title="Geçmiş temizlensin mi?" onClose={() => setConfirmClear(false)}>
          <p className="mb-4 text-sm text-muted-foreground">
            {history.length} kayıt silinecek. Kayıtlı IBAN&apos;larına dokunulmaz.
          </p>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setConfirmClear(false)}>Vazgeç</SecondaryButton>
            <PrimaryButton
              onClick={() => {
                clearHistory();
                setConfirmClear(false);
                toast("Geçmiş temizlendi");
              }}
            >
              Temizle
            </PrimaryButton>
          </div>
        </Sheet>
      )}

      {saving && (
        <Sheet title="IBAN'ı kaydet" onClose={() => setSaving(null)}>
          <p className="mb-3 text-xs text-muted-foreground">
            {analyzeIban(saving).bankName} · {analyzeIban(saving).formatted}
          </p>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmSave()}
            maxLength={40}
            placeholder="Etiket (ör. Kira Ödemesi)"
            aria-label="Etiket"
            className="w-full rounded-theme border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="mt-4 flex gap-3">
            <SecondaryButton onClick={() => setSaving(null)}>Vazgeç</SecondaryButton>
            <PrimaryButton onClick={confirmSave}>Kaydet</PrimaryButton>
          </div>
        </Sheet>
      )}

      <BottomNav active="history" />
    </div>
  );
}
