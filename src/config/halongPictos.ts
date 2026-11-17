// src/config/halongPictos.ts
// halong のピクトボタン（マップ上のピン表示切替）の定義

/**
 * ピクトボタンの並び（マップ下のボタン列、左→右に横1列）。
 * キーはアセットのファイル名（buttons/pictos/{lang}/{key}.svg・icons/pictos/{key}.svg）と同じ。
 */
export const HALONG_PICTO_KEYS = [
  'restroom',
  'escalator',
  'atm',
  'smart-locker',
  'elevator',
  'currency-exchange-counter',
  'information-counter',
  'prayer-room',
] as const;

export type HalongPictoKey = typeof HALONG_PICTO_KEYS[number];

/** 設定画面での表示名 */
export const HALONG_PICTO_LABELS: Record<HalongPictoKey, string> = {
  'restroom':                  'トイレ',
  'escalator':                 'エスカレーター',
  'atm':                       'ATM',
  'smart-locker':              'スマートロッカー',
  'elevator':                  'エレベーター',
  'currency-exchange-counter': '外貨両替所',
  'information-counter':       'インフォメーションカウンター',
  'prayer-room':               '礼拝室',
};

/** キー → マップ上のピン（PictoSettings.instances[].tag）のタグ（ハイフンをアンダースコアに） */
export function pictoTagFromKey(key: HalongPictoKey): string {
  return key.replace(/-/g, '_');
}

/** ピンのタグ → キー（定義外のタグは null） */
export function pictoKeyFromTag(tag: string): HalongPictoKey | null {
  return HALONG_PICTO_KEYS.find(key => pictoTagFromKey(key) === tag) ?? null;
}
