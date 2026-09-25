import { blobToBase64, isNativeApp, nativeCall } from "./native";

export async function copyText(text: string): Promise<boolean> {
  if (isNativeApp()) {
    try {
      await nativeCall("copy", { text });
      return true;
    } catch {
      /* web yöntemine düş */
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* aşağıdaki yedek yönteme geç */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Panodan okuma mümkün mü (uygulamada her zaman; tarayıcıda Clipboard API varsa). */
export function canReadClipboard(): boolean {
  return isNativeApp() || Boolean(navigator.clipboard?.readText);
}

/** Pano metnini okur; izin yoksa ya da desteklenmiyorsa hata fırlatır. */
export async function readClipboardText(): Promise<string> {
  if (isNativeApp()) return (await nativeCall<string>("readClipboard")) ?? "";
  if (!navigator.clipboard?.readText) throw new Error("Pano okunamıyor");
  return navigator.clipboard.readText();
}

export function vibrate(enabled: boolean, ms = 12) {
  if (!enabled) return;
  if (isNativeApp()) {
    nativeCall("haptic").catch(() => {});
    return;
  }
  if ("vibrate" in navigator) navigator.vibrate(ms);
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

/** Metni paylaşım menüsüyle paylaşır (uygulamada yerel menü, tarayıcıda Web Share API). */
export async function shareText(title: string, text: string): Promise<ShareResult> {
  try {
    if (isNativeApp()) {
      await nativeCall("share", { title, text });
      return "shared";
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return "shared";
    }
    return "unsupported";
  } catch (e) {
    return (e as Error)?.name === "AbortError" ? "cancelled" : "unsupported";
  }
}

/**
 * Görseli uygulamada yerel paylaşım menüsüyle açar (oradan "Görseli Kaydet", WhatsApp vb. seçilebilir).
 * Tarayıcıda "unsupported" döner; ekran kendi yöntemini (indirme / Web Share) kullanır.
 */
export async function shareImageNative(blob: Blob, filename: string, title: string): Promise<ShareResult> {
  if (!isNativeApp()) return "unsupported";
  await nativeCall("shareImage", { base64: await blobToBase64(blob), filename, title });
  return "shared";
}
