/**
 * Hesap silinince RevenueCat'teki abone kaydını (uygulama kullanıcı kimliği, satın alma geçmişi) da siler.
 * Mağazadaki aboneliği iptal ETMEZ; iptal yalnızca kullanıcının App Store / Google Play hesabından yapılır.
 * REVENUECAT_SECRET_KEY (RevenueCat > Project settings > API keys > Secret API key, "sk_" ile başlar) yoksa kapalıdır.
 */
export function revenuecatDeleter(secretKey, fetchImpl = globalThis.fetch) {
  if (!secretKey) return null;
  return async function deleteSubscriber(userId) {
    const res = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    // 404: bu kullanıcı hiç satın alma ekranına gelmemiş, silinecek kayıt yok
    if (!res.ok && res.status !== 404) throw new Error(`RevenueCat silme başarısız: HTTP ${res.status}`);
    return true;
  };
}
