import { Landmark } from "lucide-react";

/**
 * Banka simgesi. Harici bir depolamaya (ör. tasarım aracının sunucusu) bağımlı olmamak ve tüm bankalarda
 * tutarlı görünmek için yerel simge kullanılır. İleride logo eklenecekse dosyalar `public/` altına konmalı.
 */
export default function BankLogo({
  bank,
  className = "",
  iconClassName = "h-6 w-6",
}: {
  bank: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      <Landmark className={`text-muted-foreground ${iconClassName}`} aria-label={bank} />
    </div>
  );
}
