/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** KVKK aydınlatma metninde görünecek veri sorumlusu (ad/unvan ve adres) */
  readonly VITE_VERI_SORUMLUSU?: string;
  /** KVKK başvuruları için iletişim e-postası */
  readonly VITE_ILETISIM_EPOSTA?: string;
  /** App Store sayfası, ör. https://apps.apple.com/tr/app/ibanova/id1234567890 (tarayıcıdan girenlere gösterilir) */
  readonly VITE_APP_STORE_URL?: string;
  /** Google Play sayfası; boşsa com.ibanova.app sayfası kullanılır */
  readonly VITE_PLAY_STORE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
