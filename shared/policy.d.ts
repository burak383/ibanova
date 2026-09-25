export interface PolicySection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}
export interface PolicyDoc {
  taslak: boolean;
  sections: PolicySection[];
}
export interface PolicyInfo {
  sorumlu?: string;
  eposta?: string;
  appUrl?: string;
}
export const SON_GUNCELLEME: string;
export function privacyPolicy(info?: PolicyInfo): PolicyDoc;
export function deletionPage(info?: PolicyInfo): PolicyDoc;
