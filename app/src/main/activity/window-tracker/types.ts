export const BROWSER_BUNDLES: Record<string, string> = {
  'com.google.Chrome': 'Google Chrome',
  'com.apple.Safari': 'Safari',
  'com.brave.Browser': 'Brave Browser',
  'company.thebrowser.Browser': 'Arc',
  'org.mozilla.firefox': 'Firefox',
};

export interface WindowMeta {
  app: string;
  title: string;
  bundleId?: string;
  browserUrl?: string;
  browserTabTitle?: string;
}
