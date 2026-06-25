export interface HalongBannerEntry {
  filename: string;
  enabled: boolean;
}

export interface HalongBannerSettings {
  entries: HalongBannerEntry[];
}

export const DEFAULT_HALONG_BANNER_SETTINGS: HalongBannerSettings = {
  entries: [],
};

export function mergeBannerEntries(
  saved: HalongBannerEntry[],
  available: { filename: string }[],
): HalongBannerEntry[] {
  const availableSet = new Set(available.map((a) => a.filename));
  const existing = saved.filter((e) => availableSet.has(e.filename));
  const existingNames = new Set(existing.map((e) => e.filename));
  const fresh = available
    .filter((a) => !existingNames.has(a.filename))
    .map((a) => ({ filename: a.filename, enabled: true }));
  return [...existing, ...fresh];
}
