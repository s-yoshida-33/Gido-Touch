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
  shop_id: number;
  shop_name: string;
  shop_name_kana: string;
  shop_name_english: string;
  shop_name_china_cn: string;
  shop_name_china_tw: string;
  shop_name_korea: string;
  shop_name_france: string;
  shop_name_vietnam: string;
  shop_name_thai: string;
  abbr: string;
  web_status: number;
  searches: string;
  genre: string;
  genre_sub: string;
  genre_sub_english: string;
  genre_memo: string;
  genre_memo_english: string;
  genre_memo_china_cn: string;
  genre_memo_china_tw: string;
  genre_memo_korea: string;
  genre_memo_france: string;
  genre_memo_vietnam: string;
  genre_memo_thai: string;
  group_id: number | null;
  tenant_code: string | null;
  tel: string;
  user_url: string;
  floor: string;
  floors: string | string[];
  area: string;
  area_sub: string;
  number: string;
  open_year: number | null;
  open_month: number | null;
  close_flg: number;
  pub_start: string;
  pub_end: string | null;
  open_day: string | null;
  open_time: string;
  description: string;
  update_date: string;
  
  // Web Paths
  photo1: string;
  photo1_thumb: string;
  photo1_thumb150x150: string;
  photo1_thumb640x640: string;
  photo1_thumb_w320: string;
  photo1_thumb_w640: string;
  
  photo2: string;
  photo2_thumb: string;
  photo2_thumb150x150: string;
  photo2_thumb640x640: string;
  photo2_thumb_w320: string;
  photo2_thumb_w640: string;
  
  shop_logo: string;
  shop_logo_thumb: string;
  shop_logo_thumb150x150: string;
  shop_logo_thumb640x640: string;
  shop_logo_thumb_w320: string;
  shop_logo_thumb_w640: string;

  // Local Paths
  photo1_local_path: string;
  photo1_thumb_local_path: string;
  photo1_thumb150x150_local_path: string;
  photo1_thumb640x640_local_path: string;
  photo1_thumb_w320_local_path: string;
  photo1_thumb_w640_local_path: string;

  photo2_local_path: string;
  photo2_thumb_local_path: string;
  photo2_thumb150x150_local_path: string;
  photo2_thumb640x640_local_path: string;
  photo2_thumb_w320_local_path: string;
  photo2_thumb_w640_local_path: string;

  shop_logo_local_path: string;
  shop_logo_thumb_local_path: string;
  shop_logo_thumb150x150_local_path: string;
  shop_logo_thumb640x640_local_path: string;
  shop_logo_thumb_w320_local_path: string;
  shop_logo_thumb_w640_local_path: string;

  qr: string;
  
  // Options
  food_class: string;
  seats: string;
  smoking: string;
  reservation: string;
  lunch_menu: string;
  dinner_menu: string;
  take_out: string;
  childrens_menu: string;
  baby_seat: string;
  alcohol: string;
  options: string;
}
