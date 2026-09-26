import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "history" }
  | { name: "saved" }
  | { name: "profile" }
  | { name: "account" }
  | { name: "privacy" }
  | { name: "subscription" }
  | { name: "reset"; token: string }
  | { name: "detail"; iban: string }
  | { name: "qr"; iban: string };

function decode(part: string | undefined): string {
  if (!part) return "";
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/";
  const [, first, arg] = path.split("/");
  switch (first) {
    case "gecmis":
      return { name: "history" };
    case "kayitli":
      return { name: "saved" };
    case "profil":
      return { name: "profile" };
    case "hesap":
      return { name: "account" };
    case "gizlilik":
      return { name: "privacy" };
    case "abonelik":
      return { name: "subscription" };
    case "sifre-sifirla":
      return arg ? { name: "reset", token: decode(arg) } : { name: "account" };
    case "iban":
      return arg ? { name: "detail", iban: decode(arg) } : { name: "home" };
    case "qr":
      return arg ? { name: "qr", iban: decode(arg) } : { name: "home" };
    default:
      return { name: "home" };
  }
}

/**
 * Uygulama içi geçmiş derinliği. history.state.idx içinde tutulur; böylece
 * "geri" yalnızca uygulamanın kendi girişlerine gider, sayfadan çıkmaz.
 */
const EVENT = "ibanova:navigate";

function currentIdx(): number {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" ? idx : 0;
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

export function navigate(path: string, opts?: { replace?: boolean }) {
  const target = `#${path}`;
  if (window.location.hash === target || (path === "/" && window.location.hash === "")) return;
  if (opts?.replace) {
    window.history.replaceState({ idx: currentIdx() }, "", target);
  } else {
    window.history.pushState({ idx: currentIdx() + 1 }, "", target);
  }
  notify();
  window.scrollTo(0, 0);
}

export function goBack(fallback = "/") {
  if (currentIdx() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener(EVENT, update);
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);
  return route;
}
