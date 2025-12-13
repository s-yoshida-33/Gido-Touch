// src/types/shop.ts
import type { ShadowConfig, AnimationConfig } from "./locationIcon";

export type FloorId = string;

export interface ShopPosition {
  // 相対座標（0.0〜100.0、0.1単位）
  x: number;
  y: number;
  // 階数（複数階対応）
  floor: FloorId;
  // 表示/非表示（デフォルト: true）
  enabled?: boolean;
  // サイズ（px、デフォルト: 60）
  size?: number;
  // 回転（0-360度、デフォルト: 0）
  rotation?: number;
  // シャドウ設定（オプショナル）
  shadow?: ShadowConfig;
  // アニメーション設定（オプショナル）
  animation?: AnimationConfig;
}

export interface Shop {
  shopId?: string;
  name: string;
  nameEn?: string;
  genre: string;
  genreSub?: string;
  genreMemo: string;
  genreMemoEn?: string;
  number: string;
  floors: FloorId[];
  photo1?: string;
  photo2?: string;
  shopLogo?: string;
  description?: string;
  openTime?: string;
  tel?: string;
  position?: ShopPosition; // 位置情報（オプショナル）
}

// Raw data type from BridgeWebPopper /api/shops
export interface BridgeShop {
  shopId: string | number;
  shopName: string;
  shopNameKana: string;
  shopNameEnglish: string;
  shopNameChinaCn?: string;
  shopNameChinaTw?: string;
  shopNameKorea?: string;
  shopNameFrance?: string;
  shopNameVietnam?: string;
  shopNameThai?: string;
  abbr?: string;
  webStatus?: number;
  searches: string;
  genre: string;
  genreSub: string;
  genreSubEnglish: string;
  genreMemo: string;
  genreMemoEnglish: string;
  genreMemoChinaCn?: string;
  genreMemoChinaTw?: string;
  genreMemoKorea?: string;
  genreMemoFrance?: string;
  genreMemoVietnam?: string;
  genreMemoThai?: string;
  groupId: string | number | null;
  tenantCode?: string | null;
  tel: string;
  userUrl?: string;
  floors: string | string[]; // "3F" or ["3F"]
  area: string;
  areaSub: string;
  number: string;
  openYear?: number | null;
  openMonth?: number | null;
  closeFlg: string | number;
  pubStart?: string;
  pubEnd?: string | null;
  openDay?: string | null;
  openTime: string;
  description: string;
  updateDate: string;
  
  // Web Paths
  photo1: string;
  photo2: string;
  shopLogo: string;

  // Local Paths
  photo1LocalPath: string;
  photo2LocalPath: string;
  shopLogoLocalPath: string;
  
  // Additional fields if needed
  qr?: string;
  foodClass?: string;
  seats?: string;
  smoking?: string;
  reservation?: string;
  lunchMenu?: string;
  dinnerMenu?: string;
  takeOut?: string;
  childrensMenu?: string;
  babySeat?: string;
  alcohol?: string;
  options?: string;
}
