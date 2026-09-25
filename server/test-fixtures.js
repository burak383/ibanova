// TCMB listesinin yapısını birebir taklit eden küçük örnek
export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bankaSubeTumListe xmlns="http://eft.tcmb.gov.tr" tarih="2026-09-01">
  <bankaSubeleri>
    <banka sonIslemTuru="G" sonIslemZamani="2020-01-01"><bKd>0010</bKd><bAd>T.C. ZİRAAT BANKASI A.Ş.</bAd><bIlAd>ANKARA</bIlAd><adr>x</adr></banka>
    <sube sonIslemTuru="G" sonIslemZamani="2020-01-01"><bKd>0010</bKd><sKd>00519</sKd><sAd>KADIKÖY/İSTANBUL ŞUBESİ</sAd><sIlKd>34</sIlKd><sIlAd>İSTANBUL</sIlAd><sIlcKd>1</sIlcKd><sIlcAd>KADIKÖY</sIlcAd><adr>a</adr></sube>
    <sube><bKd>0010</bKd><sKd>00001</sKd><sAd>A &amp; B ŞUBESİ</sAd><sIlAd>ANKARA</sIlAd><sIlcAd>ÇANKAYA</sIlcAd></sube>
    <sube><bKd>0010</bKd><sKd>00002</sKd><sAd></sAd></sube>
  </bankaSubeleri>
</bankaSubeTumListe>`;
