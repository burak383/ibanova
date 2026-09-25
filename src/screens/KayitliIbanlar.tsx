import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  CalendarCheck2,
  Check,
  ChevronRight,
  Copy,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  PlusCircle,
  QrCode,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import BankLogo from "../components/BankLogo";
import Sheet, { PrimaryButton, SecondaryButton, SheetAction } from "../components/Sheet";
import { analyzeIban, caretAfterFormat, formatIban, normalizeIban, problemMessage } from "../lib/iban";
import { copyText, vibrate } from "../lib/device";
import { formatDate } from "../lib/format";
import { navigate } from "../lib/router";
import { useApp, type SavedIban } from "../store";

interface CardProps {
  account: SavedIban;
  selecting: boolean;
  selected: boolean;
  onCopy: (iban: string) => void;
  onMenu: (a: SavedIban) => void;
  onEdit: (a: SavedIban) => void;
  onToggle: (id: string) => void;
  onLongPress: (id: string) => void;
}

function AccountCard({ account, selecting, selected, onCopy, onMenu, onEdit, onToggle, onLongPress }: CardProps) {
  const info = analyzeIban(account.iban);
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  const start = () => {
    fired.current = false;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress(account.id);
    }, 500);
  };
  const cancel = () => window.clearTimeout(timer.current);

  return (
    <article
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        if (selecting) onToggle(account.id);
      }}
      className={`min-w-0 select-none rounded-theme border bg-card p-4 shadow-lg ${
        selected ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BankLogo bank={info.bankName} className="h-12 w-16 rounded-xl bg-muted p-2" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-heading text-base font-semibold">{account.name}</h3>
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success"
                aria-label="Doğrulandı"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{info.bankName}</p>
          </div>
        </div>

        {selecting ? (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
              selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
            aria-hidden="true"
          >
            {selected && <Check className="h-4 w-4" />}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onMenu(account)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`${account.name} seçenekleri`}
          >
            <MoreVertical className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-5 rounded-xl bg-muted px-3.5 py-3">
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">IBAN</p>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-body text-[13px] font-semibold tracking-[0.01em] tabular-nums text-foreground min-[360px]:text-[15px] min-[360px]:tracking-[0.06em]">
            {info.masked}
          </p>
          <button
            type="button"
            onClick={() => onCopy(account.iban)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label={`${account.name} IBAN'ını kopyala`}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarCheck2 className="h-4 w-4 text-success" aria-hidden="true" />
          Son kontrol: {formatDate(account.at)}
        </p>
        <button
          type="button"
          onClick={() => onEdit(account)}
          className="flex items-center gap-1 text-xs font-semibold text-primary"
          aria-label={`${account.name} adını düzenle`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Düzenle
        </button>
      </div>
    </article>
  );
}

export default function SavedIbansScreen() {
  const { saved, saveIban, renameSaved, removeSaved, settings, toast } = useApp();
  const [menuFor, setMenuFor] = useState<SavedIban | null>(null);
  const [editing, setEditing] = useState<SavedIban | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [newIban, setNewIban] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const newIbanRef = useRef<HTMLInputElement>(null);
  const newIbanCaret = useRef<number | null>(null);

  // Ortadan düzenlerken imlecin sona atlamasını önler (bkz. AnaSayfa'daki commit())
  useLayoutEffect(() => {
    if (newIbanCaret.current !== null && newIbanRef.current) {
      newIbanRef.current.setSelectionRange(newIbanCaret.current, newIbanCaret.current);
      newIbanCaret.current = null;
    }
  }, [newIban]);

  const commitNewIban = (raw: string, caretRaw?: number) => {
    const formatted = formatIban(normalizeIban(raw));
    if (caretRaw !== undefined) newIbanCaret.current = caretAfterFormat(raw, caretRaw, formatted);
    setNewIban(formatted);
  };

  const selecting = selection.length > 0;

  const handleCopy = useCallback(
    async (iban: string) => {
      const ok = await copyText(formatIban(iban));
      vibrate(settings.haptics);
      toast(ok ? "IBAN kopyalandı" : "Kopyalanamadı");
    },
    [settings.haptics, toast],
  );

  const newInfo = analyzeIban(newIban);

  const submitNew = () => {
    if (!newInfo.valid) return;
    const result = saveIban(newInfo.compact, newLabel);
    if (result === "exists") {
      toast("Bu IBAN zaten kayıtlı");
      return;
    }
    setAdding(false);
    setNewIban("");
    setNewLabel("");
    toast("IBAN kaydedildi");
  };

  const openAdd = () => {
    setNewIban("");
    setNewLabel("");
    setAdding(true);
  };

  return (
    <div className="min-h-screen w-full bg-background pb-28 font-body text-foreground">
      <header className="px-5 pb-6 pt-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Güvenli listen</p>
            <h1 className="font-heading text-[28px] font-bold leading-tight tracking-tight">Kayıtlı IBAN&apos;lar</h1>
            <p className="mt-2 max-w-[260px] text-sm leading-6 text-muted-foreground">
              Sık kullandığın IBAN&apos;lara hızlıca ulaş, kontrol et ve paylaş.
            </p>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg"
            aria-label="Yeni IBAN ekle"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Yeni Ekle
          </button>
        </div>
      </header>

      <main className="px-5">
        {selecting ? (
          <div className="sticky top-2 z-10 mb-5 flex items-center justify-between rounded-theme border border-primary/40 bg-card px-4 py-3 shadow-lg">
            <span className="text-sm font-semibold">{selection.length} seçili</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelection([])}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(selection)}
                className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Sil
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="mb-5 w-full rounded-theme border border-primary/30 bg-card p-4 text-left shadow-lg"
            aria-label="Kayıtlı IBAN özeti"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold">Güvendiğin hesaplar</p>
                <p className="mt-1 text-xs text-muted-foreground">{saved.length} kayıtlı IBAN · Son kontroller güncel</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
          </button>
        )}

        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Kayıtlı hesaplar</h2>
          <span className="text-xs text-muted-foreground">{saved.length} IBAN</span>
        </div>

        {saved.length === 0 ? (
          <div className="rounded-theme border border-border bg-card px-6 py-10 text-center">
            <p className="font-heading text-base font-semibold">Henüz kayıtlı IBAN yok</p>
            <p className="mt-2 text-sm text-muted-foreground">Sık kullandığın IBAN&apos;ları buraya ekleyebilirsin.</p>
          </div>
        ) : (
          <section ref={listRef} className="grid gap-4" aria-label="Kayıtlı IBAN kartları">
            {saved.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                selecting={selecting}
                selected={selection.includes(account.id)}
                onCopy={handleCopy}
                onMenu={setMenuFor}
                onEdit={(a) => {
                  setEditLabel(a.name);
                  setEditing(a);
                }}
                onToggle={(id) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
                onLongPress={(id) => {
                  vibrate(settings.haptics, 20);
                  setSelection((s) => (s.includes(id) ? s : [...s, id]));
                }}
              />
            ))}
          </section>
        )}

        <button
          type="button"
          onClick={openAdd}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-theme border border-primary/50 bg-secondary px-4 py-3.5 text-sm font-semibold text-secondary-foreground"
        >
          <PlusCircle className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
          Yeni IBAN kaydet
        </button>

        <div className="mt-5 flex items-start gap-2.5 px-1">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs leading-5 text-muted-foreground">
            Bir karta uzun basarak birden fazla kayıt seçebilir ve silebilirsin. Yeni IBAN&apos;lar yalnızca doğrulama
            tamamlandıktan sonra kaydedilir.
          </p>
        </div>
      </main>

      {menuFor && (
        <Sheet title={menuFor.name} onClose={() => setMenuFor(null)}>
          <SheetAction
            icon={<Pencil className="h-5 w-5" />}
            label="Adı düzenle"
            onClick={() => {
              setEditLabel(menuFor.name);
              setEditing(menuFor);
              setMenuFor(null);
            }}
          />
          <SheetAction
            icon={<QrCode className="h-5 w-5" />}
            label="QR kod oluştur"
            onClick={() => {
              const iban = menuFor.iban;
              setMenuFor(null);
              navigate(`/qr/${iban}`);
            }}
          />
          <SheetAction
            danger
            icon={<Trash2 className="h-5 w-5" />}
            label="Kayıtlılardan sil"
            onClick={() => {
              setConfirmDelete([menuFor.id]);
              setMenuFor(null);
            }}
          />
        </Sheet>
      )}

      {editing && (
        <Sheet title="Adı düzenle" onClose={() => setEditing(null)}>
          <input
            autoFocus
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editLabel.trim()) {
                renameSaved(editing.id, editLabel);
                setEditing(null);
              }
            }}
            maxLength={40}
            aria-label="Etiket"
            className="w-full rounded-theme border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="mt-4 flex gap-3">
            <SecondaryButton onClick={() => setEditing(null)}>Vazgeç</SecondaryButton>
            <PrimaryButton
              disabled={!editLabel.trim()}
              onClick={() => {
                renameSaved(editing.id, editLabel);
                setEditing(null);
                toast("Ad güncellendi");
              }}
            >
              Kaydet
            </PrimaryButton>
          </div>
        </Sheet>
      )}

      {adding && (
        <Sheet title="Yeni IBAN ekle" onClose={() => setAdding(false)}>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="new-iban">
            Türkiye IBAN&apos;ı
          </label>
          <input
            id="new-iban"
            ref={newIbanRef}
            autoFocus
            value={newIban}
            onChange={(e) => commitNewIban(e.target.value, e.target.selectionStart ?? undefined)}
            autoComplete="off"
            spellCheck={false}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            className="w-full rounded-theme border border-border bg-input px-4 py-3 text-sm font-semibold tracking-[0.04em] text-foreground outline-none placeholder:font-normal focus:border-primary"
          />
          <p
            className={`mt-2 min-h-[1rem] text-xs ${
              newInfo.valid ? "text-success" : newInfo.complete ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {newInfo.valid
              ? `Geçerli · ${newInfo.bankName}`
              : newInfo.complete
                ? problemMessage(newInfo.problem)
                : `${newInfo.compact.length} / 26 karakter`}
          </p>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
            maxLength={40}
            placeholder="Etiket (ör. Kira Ödemesi)"
            aria-label="Etiket"
            className="mt-3 w-full rounded-theme border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="mt-4 flex gap-3">
            <SecondaryButton onClick={() => setAdding(false)}>Vazgeç</SecondaryButton>
            <PrimaryButton disabled={!newInfo.valid} onClick={submitNew}>
              Kaydet
            </PrimaryButton>
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <Sheet title={confirmDelete.length > 1 ? `${confirmDelete.length} kayıt silinsin mi?` : "Kayıt silinsin mi?"} onClose={() => setConfirmDelete(null)}>
          <p className="mb-4 text-sm text-muted-foreground">Bu işlem geri alınamaz.</p>
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setConfirmDelete(null)}>Vazgeç</SecondaryButton>
            <PrimaryButton
              onClick={() => {
                removeSaved(confirmDelete);
                setConfirmDelete(null);
                setSelection([]);
                toast("Silindi");
              }}
            >
              Sil
            </PrimaryButton>
          </div>
        </Sheet>
      )}

      <BottomNav active="saved" />
    </div>
  );
}
