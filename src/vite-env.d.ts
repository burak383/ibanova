/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** KVKK aydınlatma metninde görünecek veri sorumlusu (ad/unvan ve adres) */
  readonly VITE_VERI_SORUMLUSU?: string;
  /** KVKK başvuruları için iletişim e-postası */
  readonly VITE_ILETISIM_EPOSTA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
