// src/config/halongPictos.ts
// halong のピクトボタン（マップ上のピン表示切替）の定義

/**
 * ピクトボタンの配置（3列 × 4行）。各列を上から順に記載。
 * キーはアセットのファイル名（buttons/pictos/{lang}/{key}.svg・icons/pictos/{key}.svg）と同じ。
 */
export const HALONG_PICTO_COLUMNS = [
  ['relax-room', 'atm', 'elevator', 'exit'],
  ['smart-locker', 'rest-space', 'escalator', 'restroom'],
  ['currency-exchange-counter', 'charging-station', 'babyroom', 'entrance'],
] as const;

export type HalongPictoKey = typeof HALONG_PICTO_COLUMNS[number][number];

/** 画面表示用の行（上から順、各行は左→右） */
export const HALONG_PICTO_ROWS: HalongPictoKey[][] = HALONG_PICTO_COLUMNS[0].map(
  (_, row) => HALONG_PICTO_COLUMNS.map(col => col[row]),
);

/** 全ピクト（列順） */
export const HALONG_PICTO_KEYS: HalongPictoKey[] = HALONG_PICTO_COLUMNS.flat();

/** 設定画面での表示名 */
export const HALONG_PICTO_LABELS: Record<HalongPictoKey, string> = {
  'relax-room':                'リラックスルーム',
  'atm':                       'ATM',
  'elevator':                  'エレベーター',
  'exit':                      '非常口',
  'smart-locker':              'スマートロッカー',
  'rest-space':                '休憩スペース',
  'escalator':                 'エスカレーター',
  'restroom':                  'トイレ',
  'currency-exchange-counter': '外貨両替所',
  'charging-station':          '充電ステーション',
  'babyroom':                  'ベビールーム',
  'entrance':                  '入口',
};

/** キー → マップ上のピン（PictoSettings.instances[].tag）のタグ（ハイフンをアンダースコアに） */
export function pictoTagFromKey(key: HalongPictoKey): string {
  return key.replace(/-/g, '_');
}

/** ピンのタグ → キー（12ピクト以外のタグは null） */
export function pictoKeyFromTag(tag: string): HalongPictoKey | null {
  return HALONG_PICTO_KEYS.find(key => pictoTagFromKey(key) === tag) ?? null;
}
