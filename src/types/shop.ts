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
  genre: string;
  genreSub?: string;
  genreMemo: string;
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
  genre: string;
  number: string;
  genre_sub?: string;
  genre_memo: string;
  shop_name: string;
  floors?: string | string[];
  shop_id?: string;
  photo1?: string;
  photo2?: string;
  shop_logo?: string;
  description?: string;
  open_time?: string;
  tel?: string;
}
