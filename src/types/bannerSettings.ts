export type HalongBannerDisplayMode = 'equal' | 'custom' | 'carousel';

export interface HalongBannerEntry {
  filename: string;
  enabled: boolean;
}

export interface HalongBannerSettings {
  entries: HalongBannerEntry[];
  displayMode: HalongBannerDisplayMode;
  bannerHeight: number;         // px（equal / custom モード）
  topMargin: number;            // px（custom モード: 上部余白）
  bannerGap: number;            // px（custom モード: バナー間隔）
  carouselDurationSec: number;  // 秒（carousel モード: スライド表示時間）
}

export const DEFAULT_HALONG_BANNER_SETTINGS: HalongBannerSettings = {
  entries: [],
  displayMode: 'equal',
  bannerHeight: 200,
  topMargin: 0,
  bannerGap: 20,
  carouselDurationSec: 5,
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
