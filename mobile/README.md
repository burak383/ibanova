# Ibanova mobil uygulaması (Android + iOS)

Canlı web uygulamasını (`https://ibanova.onrender.com`) tam ekran açan Expo uygulaması. Web'in tek başına
yapamadığı telefon özelliklerini bir köprüyle sağlar: paylaşım menüsü, QR görselini paylaşma/kaydetme, pano,
titreşim ve Face ID / parmak izi kilidi. Köprünün web tarafı: `../src/lib/native.ts`.

- Paket adı / Bundle ID: `com.ibanova.app`
- Adres: `app.json` > `expo.extra.appUrl`
- Site güncellenince uygulama da güncellenir; yalnızca bu klasördeki (yerel) kod değişince yeni derleme gerekir.

## Derleme (EAS, PowerShell)

```powershell
cd C:\Users\Burak\Downloads\ibanova\ibanova\mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init                                   # ilk seferde: Expo projesini oluşturur, app.json'a projectId yazar
npx eas-cli@latest build -p android --profile production   # Google Play için .aab
npx eas-cli@latest build -p ios --profile production       # App Store için (Apple Developer hesabı gerekir)
```

Android imzalama anahtarını ilk derlemede EAS'ın oluşturmasına izin verin ("Generate a new keystore" > Yes);
anahtar Expo hesabınızda saklanır. Telefona doğrudan kurulabilen deneme sürümü için: `--profile preview` (.apk).

## Test

Köprünün web tarafı: kök klasörde sunucu çalışırken `python3 e2e/uygulama.py`.
