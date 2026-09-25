/**
 * Mobil uygulama köprüsü. Ibanova Android/iOS uygulaması (mobile/ klasöründeki Expo projesi) siteyi bir
 * WebView içinde açar ve sayfa yüklenmeden önce `window.IbanovaNative` nesnesini ekler. Tarayıcıda bu nesne
 * yoktur; o zaman her şey eskisi gibi web API'leriyle çalışır.
 */

export type NativeMethod =
  | "share"
  | "shareImage"
  | "copy"
  | "readClipboard"
  | "haptic"
  | "biometricAvailable"
  | "biometricAuth";

interface NativeBridge {
  platform: "ios" | "android";
  version: string;
  call: (method: NativeMethod, args?: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Window {
    IbanovaNative?: NativeBridge;
  }
}

export function nativeBridge(): NativeBridge | undefined {
  return typeof window !== "undefined" ? window.IbanovaNative : undefined;
}

export function isNativeApp(): boolean {
  return Boolean(nativeBridge());
}

export async function nativeCall<T = unknown>(method: NativeMethod, args?: Record<string, unknown>): Promise<T> {
  const bridge = nativeBridge();
  if (!bridge) throw new Error("Uygulama köprüsü yok");
  return (await bridge.call(method, args)) as T;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
