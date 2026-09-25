import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./store";
import { hasCredential } from "./lib/biometric";
import LockScreen from "./components/LockScreen";
import { useRoute } from "./lib/router";
import Toast from "./components/Toast";
import AnaSayfa from "./screens/AnaSayfa";
import Gecmis from "./screens/Gecmis";
import KayitliIbanlar from "./screens/KayitliIbanlar";
import Profil from "./screens/Profil";
import IbanDetay from "./screens/IbanDetay";
import QrKod from "./screens/QrKod";
import Hesap from "./screens/Hesap";
import Gizlilik from "./screens/Gizlilik";
import SifreSifirla from "./screens/SifreSifirla";

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case "history":
      return <Gecmis />;
    case "saved":
      return <KayitliIbanlar />;
    case "profile":
      return <Profil />;
    case "account":
      return <Hesap />;
    case "privacy":
      return <Gizlilik />;
    case "reset":
      return <SifreSifirla token={route.token} />;
    case "detail":
      return <IbanDetay iban={route.iban} />;
    case "qr":
      return <QrKod iban={route.iban} />;
    default:
      return <AnaSayfa />;
  }
}

const RELOCK_AFTER_MS = 60_000;

function Shell() {
  const { settings, resetAll } = useApp();
  const lockEnabled = settings.biometric && hasCredential();
  const [locked, setLocked] = useState(lockEnabled);

  // Uygulama arka planda bir süre kaldıysa yeniden kilitle
  useEffect(() => {
    if (!lockEnabled) {
      setLocked(false);
      return;
    }
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [lockEnabled]);

  if (locked && lockEnabled) {
    return (
      <LockScreen
        onUnlock={() => setLocked(false)}
        onReset={() => {
          resetAll();
          setLocked(false);
        }}
      />
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[480px]">
        <Screen />
      </div>
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
