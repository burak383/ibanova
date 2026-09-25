const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayDiff(iso: string, now = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = dayDiff(iso);
  const time = timeFmt.format(d);
  if (diff <= 0) return `Bugün, ${time}`;
  if (diff === 1) return `Dün, ${time}`;
  return `${dateFmt.format(d)}, ${time}`;
}

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

export function isThisMonth(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
